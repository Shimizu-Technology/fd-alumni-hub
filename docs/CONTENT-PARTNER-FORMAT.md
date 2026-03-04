# Content Partner Format (Clutch / GSPN / GuamPDN)

Use this format when sharing article/media batches for import.

## Article fields
- `tournament_year` (number)
- `source` (e.g. GSPN, Clutch, GuamPDN)
- `title`
- `url`
- `published_at` (YYYY-MM-DD)
- `image_url` (optional but recommended)
- `excerpt` (optional)

## CSV Template
```csv
tournament_year,source,title,url,published_at,image_url,excerpt
2025,GSPN,FD Alumni Hoops Opens With A Bang,https://...,2025-06-28,https://...,Opening night recap...
```

## Score update fields (separate feed)
- `date` (YYYY-MM-DD)
- `winner`
- `loser`
- `winner_score` (optional)
- `loser_score` (optional)
- `source_url`
- `confidence` (`confirmed` preferred)

## Notes
- If score is unknown, send winner-only row and leave scores blank.
- If article has a recap graphic, include `image_url` so it appears in the archive UI.
- One source URL per row for auditability.
