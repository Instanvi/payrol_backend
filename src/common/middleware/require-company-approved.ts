import type { NextFunction, Request, Response } from "express"

import { AppError } from "../errors/AppError"
import { requireTenantAuth } from "../utils/auth-context"
import { companyApprovalService } from "../services/company-approval.service"

export function requireCompanyApproved(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const auth = requireTenantAuth(req)
    void companyApprovalService
      .assertCanMakePayments(auth.companyId)
      .then(() => next())
      .catch(next)
  } catch (error) {
    next(error)
  }
}
