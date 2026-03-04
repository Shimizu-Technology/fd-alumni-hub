# Historical Content Ingestion Report

**Generated:** 2026-03-04T10:01:10.024Z
**Scope:** FD Alumni Hub - Multi-year historical content acquisition

---

## Executive Summary

This report documents a comprehensive historical content acquisition sweep for the FD Alumni Hub, covering tournament coverage from 2014-2025.

### Totals

| Metric | Count |
|--------|-------|
| **Total Articles** | 47 |
| **Total Media Assets** | 74 |
| **Queue Approved** | 57 |
| **Queue Pending** | 0 |
| **Queue Rejected** | 13 |

---

## Content by Tournament Year

| Year | Articles | Media | Status |
|------|----------|-------|--------|
| 2025 | 4 | 18 | ✅ Complete |
| 2024 | 3 | 4 | ✅ Complete |
| 2023 | 5 | 4 | ✅ Complete |
| 2022 | 6 | 9 | ✅ Complete |
| 2021 | 2 | 7 | ✅ Complete |
| 2019 | 3 | 6 | ✅ Complete |
| 2018 | 4 | 5 | ✅ Complete |
| 2017 | 5 | 3 | ✅ Complete |
| 2015 | 7 | 11 | ✅ Complete |
| 2014 | 8 | 7 | ✅ Complete |

---

## Source Breakdown

### Articles by Source

| Source | Count |
|--------|-------|
| guamsportsnetwork.com | 2 |
| GSPN | 45 |

### Media by Source

| Source | Count |
|--------|-------|
| Clutch | 1 |
| guamsportsnetwork.com | 15 |
| GSPN | 58 |

---

## Content Coverage Details

### 2025 Tournament (Most Recent)
- **Opening Night:** Class of 2025 defeats defending champs 16/17 64-51
- **Key Players:** Noah Tenorio, Noah Cruz, David Del Carmen, DJ Alcantara
- **Leon Shimizu:** 21 points in loss as defending champ
- **Championship Preview:** Tourney culminating July 18

### 2024 Tournament
- **Champion:** Class of 2016/17 (first title)
- **Championship Game:** 16/17 def. 2013 58-56
- **Hero:** Leon Shimizu - game-winning shot at buzzer
- **Tournament:** 40th annual edition

### 2023 Tournament
- **Opening Night Highlights:** 16/17 destroyed 2018 100-32
- **Devin Sudo:** 34 points in blowout win
- **Gold Division:** Classes of 75, 79/80 compete

### 2022 Tournament
- **Champion:** Class of 2002/04 (5th title)
- **Championship Game:** 02/04 def. 2020 62-52
- **Semifinal Upset:** 2020 def. 2006 57-26 (dynasty ends)
- **Shaun Perez:** 25 points in championship

### 2021 Tournament
- **Champion:** Class of 2006 (8th title)
- **Championship Game:** 2006 def. 02/04 58-38
- **Post-COVID Return:** First tourney after 2020 cancellation

### 2019 Tournament
- **Opening Night Classic:** 2006 def. 2016 68-64
- **Julius Yu:** 19 points for 2006
- **Frankie Tenorio:** 24 points in loss

### 2018 Tournament
- **Champion:** Class of 2002/04 (repeat)
- **Championship Game:** 02/04 def. 2011/12
- **Gold Division Champion:** Class of 1991 def. 90/92/93/94/95

### 2017 - Historic Jersey Retirement
- First ever FD basketball jersey retirement ceremony
- **Retired Numbers:**
  - Ricardo Eusebio #33 (1972)
  - Eduardo 'Champ' Calvo #10 (1974)
  - Stephen Baza #30 (1985)
  - Chris Fernandez #21 (1996)
  - Vince Estella #12 (2002)
  - Willie Stinnett #23 (2004)

### 2015 Tournament (30th Anniversary)
- **Champion:** Class of 2013 (first title)
- **Championship Game:** 2013 def. 2004 60-48
- **John Baza:** 23 points in championship
- **Historical Data:** Complete champions list 1985-2015 documented

### 2014 Tournament
- Complete day-by-day scoreboard archived
- Championship: 2004 wins title

---

## Historical Champions (1985-2024)

| Year | Champion |
|------|----------|
| 2024 | Class of 2016/17 |
| 2023 | Class of 2013 |
| 2022 | Class of 2002/04 |
| 2021 | Class of 2006 (8th) |
| 2020 | *Cancelled (COVID-19)* |
| 2019 | Class of 2006 |
| 2018 | Class of 2002/04 |
| 2017 | Class of 2002/04 |
| 2015 | Class of 2013 |
| 2014 | Class of 2004 |
| 2013 | Class of 2006 |
| 2012 | Class of 2006 |
| 2011 | Class of 2006 |
| 2010 | Class of 2006 |
| 2009 | Class of 2002 |
| 2008 | Class of 1995 |
| 2007 | Class of 2006 |
| 2006 | Class of 2002/03 |
| 2005 | Class of 1991 |

---

## Unresolved Gaps

| Year | Gap Description | Priority |
|------|-----------------|----------|
| 2016 | Championship article not found on GSPN | Medium |
| 2020 | Tournament cancelled (COVID-19) | N/A |
| 2023 | Championship article URL 404 | Low |

---

## Quality Guardrails Applied

- ✅ Only allowlisted domains processed (guamsportsnetwork.com, clutchguam.com, guampdn.com)
- ✅ URL verification performed before approval
- ✅ Duplicate detection by URL and title
- ✅ Tournament year matching validated
- ✅ 404/dead links rejected or flagged for review
- ✅ Channel/index pages excluded (only specific content)

---

## Pending Review Queue

Exported to: `docs/exports/historical-ingest-pending.csv`

Items requiring manual review: 0

---

## Implementation Notes

- Reused existing ingestion architecture from `apps/web/scripts/ingest-content-from-urls.ts`
- Created historical ingestion scripts: `historical-ingest.ts`, `historical-ingest-pass2.ts`
- All content items tracked in `ContentIngestItem` table with confidence labels
- Build verified successful before commit

---

## Deep-Pass Research (2026-03-04)

### Objective
Increase high-confidence real content coverage beyond initial ingest, prioritizing Clutch YouTube, GSPN video/archive links, and unresolved year gaps.

### Research Conducted
1. **2014 Pending Item Verification**
   - URL `https://www.guamsportsnetwork.com/2014/fd-alumni-basketball-tournament/` verified
   - Redirects to valid 2014 scoreboard page
   - Status: ✅ **Approved**

2. **Clutch YouTube Deep Search**
   - Searched for specific FD Alumni videos on Clutch Guam channel
   - Found: Index pages only (rejected per policy)
   - Generic "Final Score" videos not FD Alumni-specific
   - Status: ❌ **No new content found**

3. **GSPN Archive Investigation**
   - Searched for 2016 championship articles
   - Multiple URL patterns tested - all return 404
   - Search results reference 2016 as a team, not tournament year
   - Status: ❌ **2016 tournament data unavailable**

4. **GuamPDN Search**
   - Found year-end recap article mentioning FD Alumni
   - Limited direct tournament coverage
   - Status: ⚠️ **Secondary source only**

5. **Wayback Machine**
   - Searched for archived GSPN content from 2016
   - No relevant snapshots found
   - Status: ❌ **No archived content**

### Results
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Queue Approved | 56 | 57 | +1 |
| Queue Pending | 1 | 0 | -1 |
| Queue Rejected | 13 | 13 | 0 |

### Conclusion
Deep research confirmed that the 2016 tournament gap is a **source-side issue** - either the tournament wasn't held, coverage was never published online, or articles were deleted. No additional high-confidence content was identified. See `docs/HISTORICAL-GAP-REPORT.md` for detailed gap analysis.

---

*Report generated by FD Alumni Hub Historical Content Acquisition System*
