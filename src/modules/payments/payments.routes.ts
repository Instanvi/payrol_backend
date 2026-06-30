import { Router } from "express"

import { requireCompanyApproved } from "../../common/middleware/require-company-approved"
import { validate } from "../../common/middleware/validate"
import { listQuerySchema } from "../../common/utils/pagination"
import * as controller from "./payments.controller"
import {
  bulkDisburseBodySchema,
  createPaymentSchema,
  paymentIdParamSchema,
  updatePaymentStatusSchema,
} from "./payments.validation"

const router = Router()

router.get("/", validate({ query: listQuerySchema }), controller.listPayments)
router.post(
  "/",
  requireCompanyApproved,
  validate({ body: createPaymentSchema }),
  controller.createPayment
)
router.get(
  "/:id",
  validate({ params: paymentIdParamSchema }),
  controller.getPayment
)
router.get(
  "/:id/transactions",
  validate({ params: paymentIdParamSchema }),
  controller.getPaymentTransactions
)
router.get(
  "/:id/mobile-validation",
  validate({ params: paymentIdParamSchema }),
  controller.validateMobilePayRun
)
router.post(
  "/:id/bulk-disburse",
  requireCompanyApproved,
  validate({ params: paymentIdParamSchema, body: bulkDisburseBodySchema }),
  controller.bulkDisbursePayRun
)
router.patch(
  "/:id/status",
  validate({
    params: paymentIdParamSchema,
    body: updatePaymentStatusSchema,
  }),
  controller.updatePaymentStatus
)

export { router as paymentsRouter }
