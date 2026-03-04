# S3 Upload Setup (FD Alumni Hub)

This project uses presigned POST uploads for media assets in Admin > Media.

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

## Flow

1. Admin picks image file in `/admin/media`
2. App calls `POST /api/admin/media/presign`
3. Browser uploads file directly to S3 using returned form fields
4. App stores resulting public image URL in `MediaAsset.imageUrl`

## Notes

- Upload endpoint validates image MIME (`image/*`)
- Upload is size-limited in presign conditions (default 10MB)
- If no file is selected, manual `imageUrl` still works
