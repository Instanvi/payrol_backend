import type { InstanviProvider } from "./instanvi-payments.types"

export interface CollectInput {
  amount: number
  currency: string
  phone: string
  provider?: InstanviProvider
  payerMessage?: string
  payeeNote?: string
}

export interface DisburseInput {
  amount: number
  currency: string
  phone: string
  provider?: InstanviProvider
  externalId?: string
  payerMessage?: string
  payeeNote?: string
  payrollTransactionId?: string
}

export interface BulkDisburseItem {
  idempotencyKey: string
  input: DisburseInput
}

export interface QueueDisburseOptions {
  skipBalanceCheck?: boolean
  payRunId?: string
}

export interface ExecuteDisburseMeta {
  idempotencyKey?: string
  jobId?: string
  payRunId?: string
  skipWalletDebit?: boolean
}
