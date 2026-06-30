import { Router } from "express"

import { requireSystemAdmin } from "../../common/middleware/require-system-admin"
import { validate } from "../../common/middleware/validate"
import * as controller from "./admin.controller"
import {
  approveCompanySchema,
  assignChargeSchema,
  createChargeSchema,
  rejectCompanySchema,
} from "../companies/companies.validation"

const router = Router()

router.use(requireSystemAdmin)

router.get("/stats", controller.getAdminStats)

router.get("/companies", controller.listCompanies)
router.get("/companies/:id", controller.getCompanyDetail)
router.post(
  "/companies/:id/approve",
  validate({ body: approveCompanySchema }),
  controller.approveCompany
)
router.post(
  "/companies/:id/reject",
  validate({ body: rejectCompanySchema }),
  controller.rejectCompany
)
router.post(
  "/companies/:id/charge",
  validate({ body: assignChargeSchema }),
  controller.assignCompanyCharge
)
router.get("/companies/:id/charge-preview", controller.previewCompanyCharge)

router.get("/charges", controller.listCharges)
router.post(
  "/charges",
  validate({ body: createChargeSchema }),
  controller.createCharge
)

export { router as adminRouter }
