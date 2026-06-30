import { Router } from "express"

import { validate } from "../../common/middleware/validate"
import { listQuerySchema } from "../../common/utils/pagination"
import * as controller from "./employees.controller"
import {
  createEmployeeSchema,
  employeeIdParamSchema,
  importEmployeesSchema,
  updateEmployeeSchema,
  validateAccountsBodySchema,
} from "./employees.validation"

const router = Router()

router.get("/", validate({ query: listQuerySchema }), controller.listEmployees)
router.post("/", validate({ body: createEmployeeSchema }), controller.createEmployee)
router.post(
  "/import",
  validate({ body: importEmployeesSchema }),
  controller.importEmployees
)
router.post(
  "/validate-accounts",
  validate({ body: validateAccountsBodySchema }),
  controller.validateEmployeeAccounts
)
router.get(
  "/:id",
  validate({ params: employeeIdParamSchema }),
  controller.getEmployee
)
router.patch(
  "/:id",
  validate({ params: employeeIdParamSchema, body: updateEmployeeSchema }),
  controller.updateEmployee
)
router.post(
  "/:id/validate-account",
  validate({ params: employeeIdParamSchema }),
  controller.validateEmployeeAccount
)
router.delete(
  "/:id",
  validate({ params: employeeIdParamSchema }),
  controller.deactivateEmployee
)

export { router as employeesRouter }
