export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DUPLICATE"
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "INVALID_2FA"
  | "SESSION_EXPIRED"
  | "INTERNAL_ERROR"
  | "INSTANVI_AUTH_FAILED"
  | "INSTANVI_PAYMENTS_FAILED"
  | "MOBILE_PAYMENT_VALIDATION_FAILED"
  | "COMPANY_NOT_APPROVED"
  | "COMPANY_PENDING_REVIEW"
  | "COMPANY_REJECTED"
  | "COMPANY_SUSPENDED"
  | "CLOUDINARY_NOT_CONFIGURED"
  | "CLOUDINARY_UPLOAD_FAILED"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_SEND_FAILED"
  | "OTP_ATTEMPTS_EXCEEDED"
  | "INVITE_EXPIRED"

export class AppError extends Error {
  readonly statusCode: number
  readonly code: AppErrorCode
  readonly details?: unknown

  constructor(
    message: string,
    statusCode = 400,
    code: AppErrorCode = "BAD_REQUEST",
    details?: unknown
  ) {
    super(message)
    this.name = "AppError"
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError(message, 401, "UNAUTHORIZED")
  }

  static notFound(message = "Resource not found") {
    return new AppError(message, 404, "NOT_FOUND")
  }

  static duplicate(message = "Resource already exists") {
    return new AppError(message, 409, "DUPLICATE")
  }

  static forbidden(message = "Forbidden") {
    return new AppError(message, 403, "FORBIDDEN")
  }

  static validation(message = "Validation failed", details?: unknown) {
    return new AppError(message, 422, "VALIDATION_ERROR", details)
  }
}
