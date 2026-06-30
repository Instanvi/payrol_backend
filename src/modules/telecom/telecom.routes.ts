import { Router } from "express"

import { validate } from "../../common/middleware/validate"
import * as controller from "./telecom.controller"
import {
  validatePhoneQuerySchema,
  validatePhonesBodySchema,
} from "./telecom.validation"

const router = Router()

router.get(
  "/validate",
  validate({ query: validatePhoneQuerySchema }),
  controller.validatePhone
)
router.post(
  "/validate-bulk",
  validate({ body: validatePhonesBodySchema }),
  controller.validatePhones
)

export { router as telecomRouter }
