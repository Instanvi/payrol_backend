import { Router } from "express"

import { validate } from "../../common/middleware/validate"
import * as controller from "./projects.controller"
import {
  createProjectSchema,
  projectIdParamSchema,
  setProjectEmployeesSchema,
  updateProjectSchema,
} from "./projects.validation"

const router = Router()

router.get("/", controller.listProjects)
router.post("/", validate({ body: createProjectSchema }), controller.createProject)
router.get(
  "/:id",
  validate({ params: projectIdParamSchema }),
  controller.getProject
)
router.patch(
  "/:id",
  validate({ params: projectIdParamSchema, body: updateProjectSchema }),
  controller.updateProject
)
router.delete(
  "/:id",
  validate({ params: projectIdParamSchema }),
  controller.deleteProject
)
router.get(
  "/:id/employees",
  validate({ params: projectIdParamSchema }),
  controller.listProjectEmployees
)
router.put(
  "/:id/employees",
  validate({ params: projectIdParamSchema, body: setProjectEmployeesSchema }),
  controller.setProjectEmployees
)
router.get(
  "/:id/export",
  validate({ params: projectIdParamSchema }),
  controller.exportProjectPayroll
)

export { router as projectsRouter }
