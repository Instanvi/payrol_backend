import { Router } from "express"

import { validate } from "../../common/middleware/validate"
import * as controller from "./companies.controller"
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
router.get("/me/wallet", controller.getCompanyWallet)

export { router as companiesRouter }
