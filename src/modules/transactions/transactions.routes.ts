import { Router } from "express"

import { validate } from "../../common/middleware/validate"
import { listQuerySchema } from "../../common/utils/pagination"
import * as controller from "./transactions.controller"

const router = Router()

router.get("/", validate({ query: listQuerySchema }), controller.listTransactions)

export { router as transactionsRouter }
