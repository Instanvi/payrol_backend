import { Router } from "express"

import { authenticate, requireRoles } from "../../common/middleware/authenticate"
import { validate } from "../../common/middleware/validate"
import { listQuerySchema } from "../../common/utils/pagination"
import * as controller from "./members.controller"
import {
  addMemberSchema,
  inviteMemberSchema,
  memberIdParamSchema,
  updateMemberRoleSchema,
} from "./members.validation"

const router = Router()

router.use(authenticate)

router.get(
  "/",
  validate({ query: listQuerySchema }),
  controller.listMembers
)
router.post(
  "/",
  requireRoles("owner", "admin"),
  validate({ body: inviteMemberSchema }),
  controller.inviteMember
)
router.post(
  "/add",
  requireRoles("owner", "admin"),
  validate({ body: addMemberSchema }),
  controller.addMember
)
router.post(
  "/:id/resend-invite",
  requireRoles("owner", "admin"),
  validate({ params: memberIdParamSchema }),
  controller.resendMemberInvite
)
router.patch(
  "/:id",
  requireRoles("owner", "admin"),
  validate({ params: memberIdParamSchema, body: updateMemberRoleSchema }),
  controller.updateMemberRole
)
router.delete(
  "/:id",
  requireRoles("owner", "admin"),
  validate({ params: memberIdParamSchema }),
  controller.removeMember
)

export { router as membersRouter }
