import type { NextFunction, Request, Response } from "express"
import asyncHandler from "express-async-handler"

export { asyncHandler }

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>
