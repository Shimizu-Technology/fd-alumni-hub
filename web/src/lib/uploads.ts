import { api, type AdminImageUploadPresign } from './api'

export const ADMIN_IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
export const ADMIN_IMAGE_UPLOAD_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.gif,.svg,.heic,.heif,.avif'

export type AdminImageUploadPurpose = 'article-image' | 'ingest-image' | 'media-asset' | 'sponsor-logo' | 'admin'

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
}

export async function uploadAdminImage({ file, tournamentId, purpose }: { file: File; tournamentId: string; purpose: AdminImageUploadPurpose }) {
  const contentType = imageContentType(file)
  validateImageFile(file, contentType)

  const presign = await api.adminPresignImageUpload({
    tournamentId,
    filename: file.name,
    contentType,
    byteSize: file.size,
    purpose,
  })

  await uploadToS3(presign, file)
  return presign.publicUrl
}

export function imageContentType(file: File) {
  const declared = file.type.split(';')[0]?.trim().toLowerCase()
  if (declared) return declared

  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension ? EXTENSION_CONTENT_TYPES[extension] || '' : ''
}

function validateImageFile(file: File, contentType: string) {
  if (file.size <= 0) throw new Error('Choose an image that is not empty')
  if (file.size > ADMIN_IMAGE_UPLOAD_MAX_BYTES) throw new Error('Image must be 10MB or smaller')
  if (!contentType.startsWith('image/')) throw new Error('Choose an image file')
}

async function uploadToS3(presign: AdminImageUploadPresign, file: File) {
  const form = new FormData()
  Object.entries(presign.fields).forEach(([key, value]) => form.append(key, value))
  form.append('file', file, file.name)

  const response = await fetch(presign.uploadUrl, { method: 'POST', body: form })
  if (response.ok) return

  const text = await response.text().catch(() => '')
  const detail = text.trim().slice(0, 180)
  throw new Error(`Storage upload failed (${response.status})${detail ? `: ${detail}` : ''}`)
}
