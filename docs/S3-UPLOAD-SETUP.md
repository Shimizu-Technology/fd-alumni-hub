# S3 Upload Setup (FD Alumni Hub)

The current Next.js app uses presigned POST uploads for media assets in Admin > Media.

The Rails-backed `/web` app now has the same public-image upload capability for admin image URL fields. Admins can still paste manually hosted URLs, or choose a local image and let the browser upload directly to S3 before saving the record.

## Required env vars

- `S3_BUCKET`
- `S3_REGION` (example: `ap-southeast-2`)
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL` (optional; if omitted, defaults to standard S3 URL)
- `S3_IMAGE_UPLOAD_MAX_BYTES` (optional; defaults to `10485760` / 10MB)

`AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_PUBLIC_BASE_URL` are also supported as aliases to match the Shimizu starter S3 guide.

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

## Rails/Vite flow

1. Admin chooses an image in a supported admin form.
2. App calls `POST /api/v1/admin/uploads/presign` with `tournamentId`, `filename`, `contentType`, `byteSize`, and upload `purpose`.
3. Rails validates staff auth, tournament, `image/*` MIME, and max size, then returns presigned S3 POST fields and a public URL.
4. Browser uploads the file directly to S3.
5. The form stores the returned public URL in the existing image URL field.
6. Admin saves the record normally.

Implemented upload controls currently cover:
- sponsor `logoUrl`
- media asset `imageUrl`
- article `imageUrl`
- ingest candidate `imageUrl`

Manual URL entry remains available for every field.

Good implementation references: existing Shimizu Rails/Vite projects with S3 upload flows such as Marianas Open and Aire Services.

## Notes

- Upload endpoint should validate image MIME (`image/*`).
- Uploads should be size-limited in presign conditions, typically 10MB or less.
- If no file is selected, manual image URL should still work.
