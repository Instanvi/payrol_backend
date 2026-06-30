import { Router } from "express"

import { validate } from "../../common/middleware/validate"
import { listQuerySchema } from "../../common/utils/pagination"
import * as controller from "./payment-logs.controller"

const router = Router()

router.get("/", validate({ query: listQuerySchema }), controller.listPaymentLogs)

export { router as paymentLogsRouter }
