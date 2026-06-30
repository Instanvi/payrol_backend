import { v2 as cloudinary } from "cloudinary"

import { AppError } from "../errors/AppError"
import { env } from "../../config/env"

let configured = false

function ensureConfigured() {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    throw new AppError(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      500,
      "CLOUDINARY_NOT_CONFIGURED"
    )
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    })
    configured = true
  }
}

function sanitizeFileName(fileName: string) {
  const base = fileName.replace(/\.[^/.]+$/, "")
  return base.replace(/[^\w.-]+/g, "_").slice(0, 80) || "document"
}

export const cloudinaryService = {
  isConfigured() {
    return Boolean(
      env.CLOUDINARY_CLOUD_NAME &&
        env.CLOUDINARY_API_KEY &&
        env.CLOUDINARY_API_SECRET
    )
  },

  async uploadKycDocument(input: {
    companyId: string
    documentId: string
    fileName: string
    buffer: Buffer
  }) {
    ensureConfigured()

    const folder = `${env.CLOUDINARY_KYC_FOLDER}/${input.companyId}`
    const publicId = `${input.documentId}-${sanitizeFileName(input.fileName)}`

    return new Promise<{ publicId: string; secureUrl: string }>(
      (resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          {
            folder,
            public_id: publicId,
            resource_type: "auto",
            overwrite: true,
          },
          (error, result) => {
            if (error || !result) {
              reject(
                error ??
                  new AppError("Cloudinary upload failed", 502, "CLOUDINARY_UPLOAD_FAILED")
              )
              return
            }

            resolve({
              publicId: result.public_id,
              secureUrl: result.secure_url,
            })
          }
        )

        upload.end(input.buffer)
      }
    )
  },

  resolveDocumentUrl(storageKey: string, fileUrl?: string | null) {
    if (fileUrl) return fileUrl
    if (!storageKey || !this.isConfigured()) return undefined

    ensureConfigured()
    return cloudinary.url(storageKey, { secure: true, resource_type: "auto" })
  },
}
