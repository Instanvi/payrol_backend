import { Router } from "express"

import { requireRoles } from "../../common/middleware/authenticate"
import { validate } from "../../common/middleware/validate"
import * as controller from "./companies.controller"
import { saveInstanviKeysSchema } from "../integrations/integrations.validation"
import {
  updateCompanyProfileSchema,
  uploadKycDocumentSchema,
} from "./companies.validation"

const router = Router()

router.get("/me", controller.getMyCompany)
router.patch("/me", validate({ body: updateCompanyProfileSchema }), controller.updateMyCompany)
router.get("/me/onboarding", controller.getOnboardingStatus)
router.get("/me/kyc/documents", controller.listKycDocuments)
router.post(
  "/me/kyc/documents",
  validate({ body: uploadKycDocumentSchema }),
  controller.uploadKycDocument
)
router.post("/me/kyc/submit", controller.submitKyc)

router.get(
  "/me/integrations/instanvi",
  controller.getInstanviIntegration
)
router.put(
  "/me/integrations/instanvi",
  requireRoles("owner", "admin"),
  validate({ body: saveInstanviKeysSchema }),
  controller.saveInstanviIntegration
)
router.post(
  "/me/integrations/instanvi/test",
  requireRoles("owner", "admin"),
  controller.testInstanviIntegration
)
router.delete(
  "/me/integrations/instanvi",
  requireRoles("owner", "admin"),
  controller.removeInstanviIntegration
)

export { router as companiesRouter }
