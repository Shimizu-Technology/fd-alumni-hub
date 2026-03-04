# Ingestion Queue Workflow

Use `/admin/ingest` to stage content from partners/scrapers before publishing.

## Flow
1. Queue item as `article` or `media` with source attribution.
2. Item starts as `pending`.
3. Review and click:
   - **Approve** → imports to `ArticleLink` or `MediaAsset`
   - **Reject** → marks item as rejected

## Safety
- URL validation requires `http/https`
- Queue can be fed manually or by script
- Script allowlist domains:
  - guamsportsnetwork.com
  - clutchguam.com
  - guampdn.com

## Helper script
```bash
cd apps/web
npx tsx scripts/ingest-content-from-urls.ts <tournamentId> <url1> <url2>
```
This script only queues records for review; it does not auto-publish.
