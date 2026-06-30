import type { Response } from "express"

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  message?: string
}

export interface ApiPaginatedResponse<T> {
  success: true
  data: T[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface ApiErrorBody {
  success: false
  message: string
  code?: string
  details?: unknown
}

/** Paginated list response shape for the frontend */
export function sendPaginated<T>(
  res: Response,
  payload: { data: T[]; meta: ApiPaginatedResponse<T>["meta"] }
) {
  return res.status(200).json(payload)
}

/** Single resource JSON response */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json(data)
}

export function sendCreated<T>(res: Response, data: T) {
  return sendSuccess(res, data, 201)
}

export function sendNoContent(res: Response) {
  return res.status(204).send()
}

export function sendMessage(res: Response, message: string, statusCode = 200) {
  return res.status(statusCode).json({ message })
}
