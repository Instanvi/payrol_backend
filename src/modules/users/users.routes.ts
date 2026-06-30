import { Router } from "express"

import { authenticate, requireRoles } from "../../common/middleware/authenticate"
import { validate } from "../../common/middleware/validate"
import { listQuerySchema } from "../../common/utils/pagination"
import * as controller from "./users.controller"
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from "./users.validation"

const router = Router()

router.use(authenticate)

router.get("/me", controller.getMe)
router.get(
  "/",
  requireRoles("owner", "admin"),
  validate({ query: listQuerySchema }),
  controller.listUsers
)
router.get(
  "/:id",
  requireRoles("owner", "admin"),
  validate({ params: userIdParamSchema }),
  controller.getUser
)
router.post(
  "/",
  requireRoles("owner", "admin"),
  validate({ body: createUserSchema }),
  controller.createUser
)
router.patch(
  "/:id",
  requireRoles("owner", "admin"),
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  controller.updateUser
)
router.delete(
  "/:id",
  requireRoles("owner", "admin"),
  validate({ params: userIdParamSchema }),
  controller.removeUser
)

export { router as usersRouter }
