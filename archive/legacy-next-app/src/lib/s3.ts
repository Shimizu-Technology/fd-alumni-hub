import { S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'

function required(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export function getS3Config() {
  return {
    bucket: required('S3_BUCKET'),
    region: process.env.S3_REGION || 'ap-southeast-2',
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || null,
  }
}

export function getS3Client() {
  const { region } = getS3Config()
  return new S3Client({
    region,
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    },
  })
}

function sanitizeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-')
}

export async function createImageUploadPost(params: {
  tournamentId: string
  filename: string
  contentType: string
  maxBytes?: number
}) {
  const { bucket, region, publicBaseUrl } = getS3Config()
  const client = getS3Client()

  const timestamp = Date.now()
  const safe = sanitizeFilename(params.filename)
  const key = `media/${params.tournamentId}/${timestamp}-${safe}`

  const post = await createPresignedPost(client, {
    Bucket: bucket,
    Key: key,
    Expires: 60,
    Conditions: [
      ['content-length-range', 1, params.maxBytes ?? 10 * 1024 * 1024],
      ['starts-with', '$Content-Type', 'image/'],
    ],
    Fields: {
      'Content-Type': params.contentType,
    },
  })

  const publicUrl = publicBaseUrl
    ? `${publicBaseUrl.replace(/\/$/, '')}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`

  return { ...post, key, publicUrl }
}
