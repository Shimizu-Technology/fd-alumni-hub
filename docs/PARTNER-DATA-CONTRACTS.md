# Partner Data Contracts

Use these minimal contracts for reliable ingestion.

## 1) Content CSV (articles/media)
Columns:
- `kind` (`article` | `media`)
- `source`
- `title`
- `url`
- `image_url` (optional for article, recommended for media)
- `excerpt` (optional)
- `confidence` (`confirmed` | `review-required`)
- `notes` (optional)

### Example
```csv
kind,source,title,url,image_url,excerpt,confidence,notes
article,GSPN,FD Alumni Weekly Recap,https://example.com/recap,https://example.com/img.jpg,Weekly recap,confirmed,partner-import
media,Clutch,FD Alumni Semis Clip,https://youtube.com/watch?v=abc123,https://i.ytimg.com/vi/abc123/hqdefault.jpg,,review-required,partner-import
```

## 2) Score CSV
Columns:
- `date` (YYYY-MM-DD)
- `winner`
- `loser`
- `winner_score` (optional)
- `loser_score` (optional)
- `source_url`
- `confidence` (`confirmed` preferred)

## Workflow
1. Partner sends CSV (or Google Sheet export)
2. Admin pastes into `/admin/ingest` bulk import panel
3. Items queue as `pending`
4. Approve/reject after quick review
5. Approved items publish into News/Gallery
