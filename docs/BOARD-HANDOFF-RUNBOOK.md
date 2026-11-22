# FD Alumni Basketball Hub — Host Class Board Handoff Runbook

> **Audience:** Incoming Host Class Officers (Chair, Treasurer, Board Members), Tournament Staff, and Game-Night Scorekeepers (e.g., Class of 2017 → Class of 2018).
> **No engineering background required.** Everything in this runbook is done through the Admin Workspace (`/admin`).

---

## 1. Roles & Permissions Map

Every person gets only the access they need:

| Role | Where it's assigned | What they can do | What they cannot do |
|---|---|---|---|
| **Admin** | Site-wide Allowlist (`/admin/people`) | Full system access: create/clone/archive campaigns, invite/revoke roles, run Setup Wizard, overwrite finalized scores, manage all tournaments. | Cannot demote or deactivate their own admin account. |
| **Staff** | Site-wide Allowlist (`/admin/people`) | Run tournament operations: teams, divisions, schedule/roster import, games & scores, game-day notes, storm alerts, links, news, media, sponsors. | Cannot view host-class finance ledgers unless also given a campaign role; cannot archive/clone campaigns or manage user roles. |
| **Scorekeeper** | Site-wide Allowlist (`/admin/people`) | Phone-first live score entry at `/admin/scorekeeper` for **live or upcoming** tournaments only. | Cannot edit/reopen games after marking them Final; cannot touch past/completed tournaments, teams, schedules, sponsors, alerts, or finance. |
| **Campaign Chair** | Campaign Invitations (`/admin/people`) | Manage the Host Year public page (`/admin/campaign/host-year`), view finance summary & final report, and approve reimbursements (when not the person who paid). | Cannot record/void ledger entries (Treasurer's job) or access other years' campaigns. |
| **Campaign Treasurer** | Campaign Invitations (`/admin/people`) | Full finance ledger access (`/admin/campaign/finance`): record income/expenses, upload receipts, manage budget lines & sponsor pledges, approve/mark reimbursements, export CSV/Final Report. | Cannot approve their own out-of-pocket reimbursement (two-officer rule). |
| **Campaign Board** | Campaign Invitations (`/admin/people`) | Read-only visibility into the Finance Tracker, Audit Log, and Board Final Report. | Cannot modify ledger entries, settings, or tournament data. |

---

## 2. Starting a New Host Year (August–September)

### Option A: Clone from Last Year (Recommended)
1. An **Admin** signs into `/admin` and opens **System → Campaigns** (`/admin/campaigns`).
2. Find the outgoing host year campaign (e.g., `Class of 2017 Host Year`) and click **Clone for Next Year**.
3. Enter next year's tournament details (year, dates, name), next host class graduation year (e.g., `2018`), campaign title/slug, and fundraising goal.
4. Keep **Copy active divisions**, **Copy budget categories**, and **Copy event templates** checked (leave **Copy budget dollar amounts** unchecked if building the budget fresh).
5. Click **Create Cloned Draft Campaign**.
   - **Data isolation guarantee:** Cloning creates a private `draft` campaign and **never** copies prior-year ledger entries, receipts, pledges, audit logs, donation URLs, HåfaPass slugs, or board memberships.

### Option B: Fresh Tournament Setup Wizard
- Open **Tournaments → Setup Wizard** (`/admin/tournaments/setup`) to walk through `Tournament Details → Divisions → Host Campaign → Review & Create` in four steps.

### Onboarding the New Host Class Officers
1. Open **System → People & Roles** (`/admin/people`).
2. Select the new campaign and invite the incoming **Chair**, **Treasurer**, and **Board** members by email.
3. Ask each officer to sign in at `/admin` with that exact email address — Clerk verifies the email and automatically activates their role.
4. Before launching the public `/host-year` page, an Admin configures the new campaign's `donationUrl`, `donationInstructions`, `golfUrl`, and HåfaPass organizer slugs in **System → Campaigns**, then switches status from `draft` to `active` and enables **Featured**.

---

## 3. Host-Year Fundraising & Finance Workflow (September–June)

All host-class finances live in **Host Year → Finance** (`/admin/campaign/finance`).

### Core Financial Rules
- **No silent deletions:** Ledger entries cannot be deleted. If a mistake is made, **Void** the entry with a written reason and re-enter the corrected transaction. Every action is recorded in the **Audit Log**.
- **Receipt capture:** Upload a photo or PDF receipt (`JPEG`, `PNG`, `WebP`, `HEIC`, or `PDF`, up to 10 MB) on every expense. Receipts are stored privately and viewed via time-limited signed URLs.
- **Two-officer reimbursement rule:** When a board member pays an expense out of pocket:
  1. Record the expense with **Paid by** set to that member and reimbursement status **Requested**.
  2. A **different** officer (Treasurer, Chair, or Admin who did *not* pay) clicks **Approve**.
  3. Once paid back (check/Zelle/cash), the Treasurer clicks **Mark Reimbursed** with the payment reference.
- **Public fundraising meter:** Controlled in **Finance Settings**. You can keep the meter hidden until ready, and choose whether FDAA's upfront allocation and ticket share count toward the public meter.

### Linking HåfaPass Fundraisers & Tournament Tickets
1. Create your fundraiser event in HåfaPass under your host class organizer account.
2. In **Host Year → Host Year** (`/admin/campaign/host-year`), add or edit the event and paste its HåfaPass event slug/ID (and optional distribution code).
3. On `/tickets` and `/host-year`, the hub automatically displays live ticket status and all-in pricing from HåfaPass — and falls back cleanly to direct HåfaPass links if HåfaPass is temporarily unreachable.

---

## 4. Pre-Tournament Setup (May–June)

1. **Divisions & Teams (`/admin/divisions`):** Confirm active divisions (e.g., Maroon, Gold, Platinum, Special). Note that divisions with `countsForStandings = false` (such as Special / Father-Son) stay cleanly separated from pool standings.
2. **Schedule & Roster Import (`/admin/import`):**
   - Upload the FDMSAA CSV or paste FDMSAA schedule text into **Schedule Import**, click **Preview**, review any warnings or unmatched existing games (especially after a reschedule), fix any highlighted rows inline, and click **Commit**.
   - Repeat on the **Roster Import** tab once class captains submit player rosters.
3. **Sponsors (`/admin/sponsors`):** Add approved partners under canonical tiers (`Diamond → Platinum → Gold → Silver → Community Partner`) with logos, descriptions, and HTTPS links.
4. **Scorekeeper Accounts (`/admin/people`):** Add game-night volunteers to the site-wide allowlist with role **Scorekeeper**.

---

## 5. Game-Night Playbook (June–July)

### Scorekeeping on a Phone (`/admin/scorekeeper`)
1. Scorekeepers sign in and land directly on **Live score entry** (`/admin/scorekeeper`).
2. Tap `+1`, `+2`, `+3`, or `-1` to update live scores as baskets drop.
   - **Offline resilience:** If Phoenix Center Wi-Fi or cell service drops, updates queue safely on the device (`Offline — queuing locally`) and auto-sync when connectivity returns.
   - **Conflict resolution:** If two devices edit the same game simultaneously, a conflict banner shows both scores and lets the operator pick **Use server score** or **Keep my score**.
3. At the final buzzer, tap **Finalize Game** and confirm:
   - Finalizing a **pool** game automatically recalculates division standings.
   - Finalizing a **playoff** game automatically advances the winner into the next bracket round on `/bracket`.
   - Once a game is marked Final, scorekeepers cannot edit it — ask **Staff** or an **Admin** to make any official correction in `/admin/games`.

### Storm, Power-Outage & Delay Playbook
1. Open **Tournament ops → Game Day** (`/admin/game-day`).
2. Under **Site-wide storm & schedule alerts**, pick **Warning** (delay/schedule) or **Urgent** (typhoon/power outage), enter a clear title and message, optionally set an auto-expiry time, and click **Publish alert**.
   - Active alerts appear immediately at the top of **every public page** and refresh automatically for visitors already on the site.
3. For individual delayed/postponed games, set the game's status to `Delayed` or `Postponed` and enter a short **Status note** (e.g., `"Tip-off moved to 8:15 PM"`). That note displays directly on `/today` and `/bracket`.
4. When play resumes, click **Hide** or **Delete** on the alert in `/admin/game-day`.

---

## 6. August Close-Out & Archival Checklist

1. **Finalize all scores & champions:** Verify every played game is `final` (or `cancelled` if rained out and not rescheduled). Ask an admin/developer to import the year's completed division champions into tournament history (`bin/rails fd_history:import` or direct record) so they appear on the Hall of Champions and clear the close-out warning.
2. **Settle reimbursements & receipts:** Open **Host Year → Finance → Final Report** (`/admin/campaign/finance`) and review the **Close-Out Compliance Checklist**:
   - Pay out all pending reimbursements.
   - Attach missing expense receipts.
   - Mark fulfilled/cancelled cash pledges.
3. **Export the Board Packet:** In the **Final Report** tab, click **Print / Save PDF** for the board meeting packet, and download **Summary CSV** and **JSON** (plus the full Ledger CSV) for permanent class records.
4. **Archive the Year:** An **Admin** opens **System → Campaigns** (`/admin/campaigns`), clicks **Close-Out & Archive** on the campaign, verifies blockers are clear (or enters an audited override reason if the board approved early archival), checks **Also mark tournament as completed**, and clicks **Confirm Archive Campaign**.
   - Archived campaigns become read-only (protecting historical financial records from accidental edits) and stop appearing as the active featured campaign.
5. **Clone for the Next Host Class:** Click **Clone for Next Year** on the archived campaign to hand a clean, ready-to-go workspace to the incoming host class!
