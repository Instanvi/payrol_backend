import { Router } from "express"

import { authenticate } from "../common/middleware/authenticate"
import { adminRouter } from "../modules/admin/admin.routes"
import { handleWebhook } from "../modules/mobile-payments/mobile-payments.webhook.controller"
import { authRouter } from "../modules/auth/auth.routes"
import { companiesRouter } from "../modules/companies/companies.routes"
import { dashboardRouter } from "../modules/dashboard/dashboard.routes"
import { employeesRouter } from "../modules/employees/employees.routes"
import { membersRouter } from "../modules/members/members.routes"
import { paymentLogsRouter } from "../modules/payment-logs/payment-logs.routes"
import { paymentsRouter } from "../modules/payments/payments.routes"
import { projectsRouter } from "../modules/projects/projects.routes"
import { telecomRouter } from "../modules/telecom/telecom.routes"
import { transactionsRouter } from "../modules/transactions/transactions.routes"
import { usersRouter } from "../modules/users/users.routes"

const apiRouter = Router()

apiRouter.use("/auth", authRouter)
apiRouter.post("/payments/mobile/webhook", handleWebhook)
apiRouter.put("/payments/mobile/webhook", handleWebhook)

apiRouter.use(authenticate)

apiRouter.use("/admin", adminRouter)
apiRouter.use("/companies", companiesRouter)
apiRouter.use("/users", usersRouter)
apiRouter.use("/employees", employeesRouter)
apiRouter.use("/projects", projectsRouter)
apiRouter.use("/payments", paymentsRouter)
apiRouter.use("/payment-logs", paymentLogsRouter)
apiRouter.use("/transactions", transactionsRouter)
apiRouter.use("/members", membersRouter)
apiRouter.use("/dashboard", dashboardRouter)
apiRouter.use("/telecom", telecomRouter)

export { apiRouter }
