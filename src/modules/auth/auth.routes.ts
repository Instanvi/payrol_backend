import { Router } from "express"

import { authenticate } from "../../common/middleware/authenticate"
import { validate } from "../../common/middleware/validate"
import * as controller from "./auth.controller"
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  inviteTokenParamSchema,
  loginSchema,
  registerSchema,
  resend2FASchema,
  resetPasswordSchema,
  resetTokenParamSchema,
  verify2FASchema,
} from "./auth.validation"

const router = Router()

router.post("/register", validate({ body: registerSchema }), controller.register)
router.post("/login", validate({ body: loginSchema }), controller.login)
router.post(
  "/forgot-password",
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword
)
router.get(
  "/reset-password/:token",
  validate({ params: resetTokenParamSchema }),
  controller.getResetPreview
)
router.post(
  "/reset-password",
  validate({ body: resetPasswordSchema }),
  controller.resetPassword
)
router.get(
  "/invites/:token",
  validate({ params: inviteTokenParamSchema }),
  controller.getInvitePreview
)
router.post(
  "/invites/accept",
  validate({ body: acceptInviteSchema }),
  controller.acceptInvite
)
router.post(
  "/verify-2fa",
  validate({ body: verify2FASchema }),
  controller.verify2FA
)
router.post(
  "/resend-2fa",
  validate({ body: resend2FASchema }),
  controller.resend2FA
)
router.get("/me", authenticate, controller.getMe)
router.post("/logout", authenticate, controller.logout)

export { router as authRouter }
