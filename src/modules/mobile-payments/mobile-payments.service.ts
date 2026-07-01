import { eq } from "drizzle-orm"

import { paymentLogService } from "../../common/logging/payment-log.service"
import { AppError } from "../../common/errors/AppError"
import {
  detectCarrier,
  validateCarrierForMobileMoney,
} from "../../common/utils/phone-carrier"
import { createId, nowIso } from "../../common/utils/id"
import { env } from "../../config/env"
import { db } from "../../db"
import { findOne } from "../../db/query"
import { mobilePaymentTransactions } from "../../db/schema"
import {
  disburseJobId,
  getPaymentQueue,
} from "../../queues/payment.queue"
import { walletsService } from "../wallets/wallets.service"
import { syncLinkedPayrollTransaction } from "../payments/payroll-mobile-sync"
import { companyIntegrationsService } from "../integrations/company-integrations.service"
import type { InstanviProvider } from "./instanvi-payments.types"
import {
  carrierToProvider,
  internalTypeToInstanvi,
  mapProviderStatus,
  toInstanviAmount,
  toInstanviPhoneNumber,
} from "./provider.utils"
import type {
  BulkDisburseItem,
  CollectInput,
  DisburseInput,
  ExecuteDisburseMeta,
  QueueDisburseOptions,
} from "./mobile-payments.types"

function resolveProvider(
  phone: string,
  explicit?: InstanviProvider
): InstanviProvider {
  if (explicit) return explicit
  const carrier = detectCarrier(phone)
  const provider = carrierToProvider(carrier.carrier)
  if (!provider) {
    throw AppError.validation(
      `Carrier ${carrier.carrier} is not supported for mobile money payments`
    )
  }
  return provider
}

export const mobilePaymentsService = {
  async validatePayeeAccount(companyId: string, phone: string) {
    const carrierCheck = validateCarrierForMobileMoney(phone)
    if (!carrierCheck.ok) {
      throw AppError.validation(carrierCheck.message)
    }

    const msisdn = carrierCheck.parsed.national
    const provider = resolveProvider(msisdn)

    await paymentLogService.info({
      companyId,
      event: "mobile_payments.account.validated",
      message: "Payee mobile money account validated by carrier",
      metadata: {
        phone: msisdn,
        carrier: carrierCheck.parsed.carrier,
        provider,
      },
    })

    return {
      phone: msisdn,
      e164: carrierCheck.parsed.e164,
      carrier: carrierCheck.parsed.carrier,
      provider,
      active: true as const,
    }
  },

  async collect(companyId: string, input: CollectInput) {
    const instanvi = await companyIntegrationsService.getInstanviClient(companyId)
    const wallet = await walletsService.getByCompanyId(companyId)
    const carrierCheck = validateCarrierForMobileMoney(input.phone)
    if (!carrierCheck.ok) {
      throw AppError.validation(carrierCheck.message)
    }

    const msisdn = carrierCheck.parsed.national
    const provider = resolveProvider(msisdn, input.provider)

    const externalId = createId()
    const now = nowIso()

    await paymentLogService.info({
      companyId,
      event: "mobile_payments.collect.initiated",
      message: "Collection request initiated",
      metadata: { amount: input.amount, phone: msisdn, provider },
    })

    const payment = await instanvi.makePayment({
      type: "COLLECTION",
      amount: toInstanviAmount(input.amount, input.currency),
      phone_number: toInstanviPhoneNumber(msisdn),
      provider,
      callback_url: env.INSTANVI_CALLBACK_URL,
    })

    const row = {
      id: createId(),
      companyId,
      walletId: wallet.id,
      externalReferenceId: payment.transaction_id,
      type: "collection" as const,
      amount: input.amount,
      currency: input.currency,
      partyId: msisdn,
      provider,
      externalId,
      payerMessage: input.payerMessage ?? null,
      payeeNote: input.payeeNote ?? null,
      status: "pending" as const,
      providerStatus: payment.status,
      financialTransactionId: payment.id,
      failureReason: null,
      payRunId: null,
      payrollTransactionId: null,
      idempotencyKey: null,
      jobId: null,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(mobilePaymentTransactions).values(row)

    return {
      id: row.id,
      transactionId: payment.transaction_id,
      referenceId: payment.transaction_id,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      provider,
    }
  },

  async queueDisburse(
    companyId: string,
    input: DisburseInput,
    idempotencyKey: string,
    options?: QueueDisburseOptions
  ) {
    const carrierCheck = validateCarrierForMobileMoney(input.phone)
    if (!carrierCheck.ok) {
      throw AppError.validation(carrierCheck.message)
    }

    const msisdn = carrierCheck.parsed.national
    const provider = resolveProvider(msisdn, input.provider)

    await paymentLogService.info({
      companyId,
      event: "mobile_payments.disburse.queued",
      message: "Enqueueing disbursement after carrier validation",
      metadata: {
        idempotencyKey,
        amount: input.amount,
        phone: msisdn,
        carrier: carrierCheck.parsed.carrier,
        provider,
      },
    })

    if (!options?.skipBalanceCheck) {
      const wallet = await walletsService.getByCompanyId(companyId)
      if (wallet.balance < input.amount) {
        throw AppError.validation("Insufficient wallet balance for disbursement")
      }
    }

    const jobId = disburseJobId(companyId, idempotencyKey)

    try {
      const job = await getPaymentQueue().add(
        "disburse",
        {
          companyId,
          idempotencyKey,
          payRunId: options?.payRunId,
          skipWalletDebit: options?.skipBalanceCheck,
          input: { ...input, phone: msisdn, provider },
        },
        { jobId }
      )

      const response = {
        status: "queued" as const,
        jobId: job.id,
        idempotencyKey,
        message:
          "Disbursement queued. Poll job status or transaction status.",
      }

      await paymentLogService.info({
        companyId,
        event: "mobile_payments.disburse.enqueued",
        message: "Disbursement added to payment queue",
        jobId: job.id,
        metadata: { idempotencyKey, provider },
      })

      return response
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Job already exists")
      ) {
        return {
          status: "queued" as const,
          jobId,
          idempotencyKey,
          message: "Disbursement already queued for this idempotency key",
        }
      }
      throw error
    }
  },

  async queueBulkDisburse(
    companyId: string,
    items: BulkDisburseItem[],
    options?: { payRunId?: string }
  ) {
    await companyIntegrationsService.getInstanviCredentials(companyId)

    if (items.length === 0) {
      return { queued: [] as Array<{ idempotencyKey: string; jobId: string }> }
    }

    const jobs = items.map((item) => {
      const carrierCheck = validateCarrierForMobileMoney(item.input.phone)
      if (!carrierCheck.ok) {
        throw AppError.validation(carrierCheck.message)
      }

      const msisdn = carrierCheck.parsed.national
      const provider = resolveProvider(msisdn, item.input.provider)
      const jobId = disburseJobId(companyId, item.idempotencyKey)

      return {
        name: "disburse" as const,
        data: {
          companyId,
          idempotencyKey: item.idempotencyKey,
          payRunId: options?.payRunId,
          skipWalletDebit: true,
          input: { ...item.input, phone: msisdn, provider },
        },
        opts: { jobId },
      }
    })

    await paymentLogService.info({
      companyId,
      event: "mobile_payments.bulk.enqueued",
      message: `Queued ${items.length} mobile disbursement jobs`,
      metadata: {
        payRunId: options?.payRunId,
        count: items.length,
      },
    })

    const added = await getPaymentQueue().addBulk(jobs)

    return {
      queued: added.map((job, index) => ({
        idempotencyKey: items[index]!.idempotencyKey,
        jobId: job.id ?? jobs[index]!.opts.jobId!,
      })),
    }
  },

  async executeDisburse(
    companyId: string,
    input: DisburseInput,
    meta?: ExecuteDisburseMeta
  ) {
    const instanvi = await companyIntegrationsService.getInstanviClient(companyId)
    const carrierCheck = validateCarrierForMobileMoney(input.phone)
    if (!carrierCheck.ok) {
      throw AppError.validation(carrierCheck.message)
    }

    const msisdn = carrierCheck.parsed.national
    const provider = resolveProvider(msisdn, input.provider)
    const wallet = await walletsService.getByCompanyId(companyId)

    if (!meta?.skipWalletDebit && wallet.balance < input.amount) {
      throw AppError.validation("Insufficient wallet balance for disbursement")
    }

    const externalId = input.externalId ?? createId()
    const now = nowIso()

    await paymentLogService.info({
      companyId,
      event: "mobile_payments.disburse.executing",
      message: "Executing mobile money disbursement",
      jobId: meta?.jobId,
      metadata: {
        idempotencyKey: meta?.idempotencyKey,
        amount: input.amount,
        provider,
      },
    })

    const payment = await instanvi.makePayment({
      type: "DEPOSIT",
      amount: toInstanviAmount(input.amount, input.currency),
      phone_number: toInstanviPhoneNumber(msisdn),
      provider,
      callback_url: env.INSTANVI_CALLBACK_URL,
    })

    if (!meta?.skipWalletDebit) {
      await walletsService.debit(
        wallet.id,
        input.amount,
        `Disbursement ${payment.transaction_id}`
      )
    }

    const row = {
      id: createId(),
      companyId,
      walletId: wallet.id,
      externalReferenceId: payment.transaction_id,
      type: "disbursement" as const,
      amount: input.amount,
      currency: input.currency,
      partyId: msisdn,
      provider,
      externalId,
      payerMessage: input.payerMessage ?? null,
      payeeNote: input.payeeNote ?? null,
      status: "pending" as const,
      providerStatus: payment.status,
      financialTransactionId: payment.id,
      failureReason: null,
      payRunId: meta?.payRunId ?? null,
      payrollTransactionId: input.payrollTransactionId ?? null,
      idempotencyKey: meta?.idempotencyKey ?? null,
      jobId: meta?.jobId ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(mobilePaymentTransactions).values(row)

    return {
      id: row.id,
      transactionId: payment.transaction_id,
      referenceId: payment.transaction_id,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      provider,
    }
  },

  async syncStatus(transactionId: string, companyId: string) {
    const instanvi = await companyIntegrationsService.getInstanviClient(companyId)
    const txn = await findOne(
      db
        .select()
        .from(mobilePaymentTransactions)
        .where(eq(mobilePaymentTransactions.externalReferenceId, transactionId))
    )

    if (!txn || txn.companyId !== companyId) {
      throw AppError.notFound("Mobile payment transaction not found")
    }

    const remote = await instanvi.getTransaction(transactionId)
    const status = mapProviderStatus(remote.status)
    const now = nowIso()
    const wasPending = txn.status === "pending"

    await db
      .update(mobilePaymentTransactions)
      .set({
        status,
        providerStatus: remote.status,
        financialTransactionId: remote.reference_id ?? remote.id,
        failureReason: status === "failed" ? "Payment failed at provider" : null,
        updatedAt: now,
      })
      .where(eq(mobilePaymentTransactions.id, txn.id))

    if (
      wasPending &&
      status === "successful" &&
      txn.type === "collection" &&
      txn.walletId
    ) {
      await walletsService.credit(
        txn.walletId,
        txn.amount,
        `Collection ${transactionId}`
      )
    }

    if (
      wasPending &&
      status === "failed" &&
      txn.type === "disbursement" &&
      txn.walletId
    ) {
      await walletsService.credit(
        txn.walletId,
        txn.amount,
        `Disbursement reversal ${transactionId}`
      )
    }

    if (txn.payrollTransactionId) {
      await syncLinkedPayrollTransaction(
        txn.payrollTransactionId,
        status,
        status === "failed" ? "Payment failed at provider" : null
      )
    }

    await paymentLogService.info({
      companyId,
      event: "mobile_payments.status.synced",
      message: `Mobile payment status synced: ${status}`,
      mobilePaymentTransactionId: txn.id,
      metadata: {
        transactionId,
        providerStatus: remote.status,
        type: internalTypeToInstanvi(txn.type),
      },
    })

    return {
      id: txn.id,
      transactionId,
      referenceId: transactionId,
      type: txn.type,
      status,
      providerStatus: remote.status,
      amount: txn.amount,
      currency: txn.currency,
      provider: txn.provider,
      financialTransactionId: remote.reference_id ?? remote.id,
      failureReason: status === "failed" ? "Payment failed at provider" : null,
    }
  },

  async listByCompany(companyId: string) {
    const rows = await db
      .select()
      .from(mobilePaymentTransactions)
      .where(eq(mobilePaymentTransactions.companyId, companyId))

    return rows.map((row) => ({
      id: row.id,
      transactionId: row.externalReferenceId,
      referenceId: row.externalReferenceId,
      type: row.type,
      amount: row.amount,
      currency: row.currency,
      partyId: row.partyId,
      provider: row.provider,
      status: row.status,
      providerStatus: row.providerStatus,
      idempotencyKey: row.idempotencyKey ?? undefined,
      jobId: row.jobId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  },
}
