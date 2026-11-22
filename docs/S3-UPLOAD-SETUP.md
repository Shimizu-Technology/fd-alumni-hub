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

---

## Private Receipt Storage (Board Finance Tracker — Slice A3.2)

Finance receipts (photos of receipts, bank transfer confirmations, PDF invoices) are stored in a **dedicated private S3 bucket** separate from the public `S3_BUCKET`.

### Fail-closed env vars

- `S3_PRIVATE_BUCKET` (**required** — intentionally **never** falls back to `S3_BUCKET`; if unset, receipt presign and receipt view return `503 Service Unavailable`)
- `S3_PRIVATE_REGION` (optional; defaults to `S3_REGION` / `AWS_REGION` / `ap-southeast-2`)
- `S3_RECEIPT_UPLOAD_MAX_BYTES` (optional; defaults to `15728640` / 15MB)
- Reuses `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` (or `AWS_*` aliases)

### Required AWS bucket settings

1. **Block all public access:** Enable all four S3 Block Public Access settings on `S3_PRIVATE_BUCKET`. Do not attach a public-read bucket policy.
2. **Encryption:** Enable default server-side encryption (SSE-S3 or SSE-KMS). If using SSE-KMS, also grant the app IAM role `kms:GenerateDataKey` and `kms:Decrypt` on the KMS key.
3. **IAM permissions** on `arn:aws:s3:::<private-bucket>/*`:
   - `s3:PutObject`
   - `s3:GetObject` (authorizes both signed `GET` receipt views and server-side `HEAD` verification on attach)
4. **Bucket CORS:** Allow browser uploads from the Hub origins (`POST`, `GET`, `HEAD`).
5. **Lifecycle cleanup (recommended):** Configure an S3 lifecycle rule or periodic cleanup for unattached abandoned uploads (for example, abort incomplete multipart uploads after 1 day).

### Security flow

1. `treasurer` or `admin` calls `POST /api/v1/campaign/:slug/receipts/presign` with `filename`, `contentType` (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`), and `byteSize` (<= 15MB).
2. Rails creates a `pending_receipt_uploads` row (expires in 10 min) and returns a 60-second presigned S3 POST (`upload.fields.key` is scoped to `receipts/<campaign_id>/…`) plus an opaque `uploadToken` (never a public URL; direct `receiptKey` / receipt metadata params on ledger create/update are rejected with `422`).
3. Browser uploads directly to S3, then sends `receiptUploadToken` when creating or updating the ledger entry.
4. Rails verifies the object via signed S3 `HEAD`, locks & marks the pending upload attached (preventing replay or cross-campaign key reuse), saves the receipt metadata, and writes an `attach_receipt` audit event.
5. Any campaign member (`board`, `chair`, `treasurer`, `admin`) views a receipt via `GET /api/v1/campaign/:slug/ledger-entries/:id/receipt-url`, which returns a 120-second signed GET URL with sanitized RFC 5987 `Content-Disposition` and logs a `view_receipt` audit event.
