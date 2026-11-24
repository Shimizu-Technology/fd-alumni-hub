import { api, type AdminImageUploadPresign } from './api'

export const ADMIN_IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
export const ADMIN_IMAGE_UPLOAD_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.gif,.svg,.heic,.heif,.avif'
// Omit .heic/.heif on public web photo pickers so iOS Safari auto-transcodes camera-roll HEIC photos to JPEG
// for universal rendering across Chrome, Android, and desktop browsers.
export const WEB_IMAGE_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.avif'
export const RECEIPT_UPLOAD_MAX_BYTES = 15 * 1024 * 1024
export const RECEIPT_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf'

const RECEIPT_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
])

const RECEIPT_EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
  pdf: 'application/pdf',
}

export type AdminImageUploadPurpose = 'article-image' | 'ingest-image' | 'media-asset' | 'sponsor-logo' | 'tonight-photo' | 'admin'

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

export async function uploadAdminImage({ file, tournamentId, purpose, signal }: {
  file: File; tournamentId: string; purpose: AdminImageUploadPurpose; signal?: AbortSignal
}) {
  const contentType = imageContentType(file)
  validateImageFile(file, contentType)

  const presign = await api.adminPresignImageUpload({
    tournamentId,
    filename: file.name,
    contentType,
    byteSize: file.size,
    purpose,
  }, signal)

  await uploadToS3(presign, file, signal)
  return presign.publicUrl
}

export async function uploadCampaignImage({ file, campaignSlug }: { file: File; campaignSlug: string }) {
  const contentType = imageContentType(file)
  validateImageFile(file, contentType)

  const presign = await api.campaignPresignImageUpload(campaignSlug, {
    filename: file.name,
    contentType,
    byteSize: file.size,
  })

  await uploadToS3(presign, file)
  return presign.publicUrl
}

export async function uploadCampaignReceipt({ file, campaignSlug }: { file: File; campaignSlug: string }) {
  const rawDeclared = file.type.split(';')[0]?.trim().toLowerCase()
  const declared = rawDeclared === 'image/heif' ? 'image/heic' : rawDeclared
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const contentType = (declared && RECEIPT_ALLOWED_TYPES.has(declared))
    ? declared
    : (RECEIPT_EXTENSION_TYPES[ext] || declared || '')

  if (file.size <= 0) throw new Error('Choose a receipt file that is not empty')
  if (file.size > RECEIPT_UPLOAD_MAX_BYTES) throw new Error('Receipt must be 15MB or smaller')
  if (!RECEIPT_ALLOWED_TYPES.has(contentType)) {
    throw new Error('Receipt must be a JPEG, PNG, WebP, HEIC photo, or PDF')
  }

  const presign = await api.campaignPresignReceipt(campaignSlug, {
    filename: file.name,
    contentType,
    byteSize: file.size,
  })

  await uploadToS3({ uploadUrl: presign.upload.url, fields: presign.upload.fields }, file)
  return presign.uploadToken
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

async function uploadToS3(presign: Pick<AdminImageUploadPresign, 'uploadUrl' | 'fields'>, file: File, signal?: AbortSignal) {
  const form = new FormData()
  Object.entries(presign.fields).forEach(([key, value]) => form.append(key, value))
  form.append('file', file, file.name)

  const response = await fetch(presign.uploadUrl, { method: 'POST', body: form, signal })
  if (response.ok) return

  const text = await response.text().catch(() => '')
  const detail = text.trim().slice(0, 180)
  throw new Error(`Storage upload failed (${response.status})${detail ? `: ${detail}` : ''}`)
}
