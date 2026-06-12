# S3 Upload Setup (FD Alumni Hub)

The current Next.js app uses presigned POST uploads for media assets in Admin > Media.

The Rails-backed `/web` app should get the same capability before production cutover so admins can upload gallery images and sponsor logos directly from the app instead of pasting image URLs.

## Required env vars

- `S3_BUCKET`
- `S3_REGION` (example: `ap-southeast-2`)
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL` (optional; if omitted, defaults to standard S3 URL)

## Minimal IAM permissions

Grant the app user access to this bucket:
- `s3:PutObject`
- `s3:GetObject`
- `s3:ListBucket`

Resource scope:
- `arn:aws:s3:::<bucket>`
- `arn:aws:s3:::<bucket>/*`

## Bucket CORS

Allow browser uploads from app origins (dev + prod), methods `POST,GET,HEAD`.

## Current Next.js flow

1. Admin picks image file in `/admin/media`
2. App calls `POST /api/admin/media/presign`
3. Browser uploads file directly to S3 using returned form fields
4. App stores resulting public image URL in `MediaAsset.imageUrl`

## Rails/Vite follow-up

Implement after the data migration/staging work:

1. Add Rails S3 configuration using the Brain-Dump starter-app AWS S3 guide.
2. Add a Rails admin presign endpoint for public image uploads.
3. Add upload controls in `/web` admin media and sponsor forms.
4. Store the resulting public URL in `MediaAsset.image_url` or `Sponsor.logo_url`.
5. Keep manual URL entry as a fallback.
6. Validate file type (`image/*`), size limits, and least-privilege IAM permissions.

Good implementation references: existing Shimizu Rails/Vite projects with S3 upload flows such as Marianas Open and Aire Services.

## Notes

- Upload endpoint should validate image MIME (`image/*`).
- Uploads should be size-limited in presign conditions, typically 10MB or less.
- If no file is selected, manual image URL should still work.
