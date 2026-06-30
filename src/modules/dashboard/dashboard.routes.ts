import { Router } from "express"

import * as controller from "./dashboard.controller"

const router = Router()

router.get("/stats", controller.getDashboardStats)

export { router as dashboardRouter }
