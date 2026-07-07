# Strive UR Intelligence Tracker

Utilization Review authorization tracking for Strive Recovery (Indiana). Tracks prior authorizations, concurrent reviews, denials, appeals, and coordinator workloads across ASAM 3.5 and 3.1 levels of care.

## Deployment

This app auto-deploys to GitHub Pages via GitHub Actions on every push to `main`.

**Live URL:** https://provident-hcc.github.io/strive-ur/

## Usage

- All data is stored in browser `localStorage` under key `strive_ur_v6`
- Import authorization data via **Import** — drop Sunwave MASTER `.xlsx` or single `Report Auth` CSV
- Use **Settings → Export JSON** to back up your data
- Demo/test records are prefixed with "TEST" in patient first name

## Local Development

Open `index.html` directly in any modern browser — no build step required.

```bash
# If you need a local server (e.g. for MSAL redirect URIs):
python -m http.server 8080
# then open http://localhost:8080/index.html
```

## Data Backup

Regularly export JSON backups via Settings. Data lives in the browser and is not synced across devices or browsers.

---

## Architecture

```
strive-ur/
├── index.html          # Full UR Intelligence Tracker (primary app)
├── simple.html         # ReviewDesk — lightweight worklist view
├── config.js           # Azure AD credentials (CLIENT_ID, TENANT_ID)
└── .github/
    └── workflows/
        └── deploy.yml  # Auto-deploys to GitHub Pages on push to main
```

### Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| UI framework | Vanilla HTML/CSS/JS | No build step — open in any browser |
| Data storage | `localStorage` | Key `strive_ur_v6` — browser-local, not synced |
| Cadence config | `localStorage` | Key `strive_cadence_v1` — SLA rules per MCE/level |
| File import | SheetJS (xlsx 0.18.5) | Parses `.xlsx` Sunwave MASTER workbook or CSV |
| Authentication | Microsoft MSAL v3 | Azure AD SSO, restricted to org domains |
| Deployment | GitHub Pages | Branch `main` → `https://provident-hcc.github.io/strive-ur/` |

### Data Model

Each record represents **one authorization period** (not one patient). A single episode may have multiple records sharing the same `mri` + `admit`:

```
{
  id, mri, last, first, admit, discharge, dischargeType,
  payer, insType, loc,                    // payer & level of care
  authCode, authPeriod,                   // "Initial PA" | "Concurrent Review 1" …
  authStart, authEnd, daysReq, daysAuth,
  submitDate, authReceived, decision,
  denialReason, denialSub, avoidable,
  appealFiled, appealOutcome,
  stage,                                  // STAGES key (see Stage Machine below)
  coordinator, owner, dept,
  tasks[],                                // [{id, desc, owner, due, done, …}]
  wfNotes, notes, priority
}
```

### Stage Machine (v1.1 — post June 17 meeting)

**Ideal path:**
`pre-auth-gathering` → `pre-auth-submitted` → `authorized` → `concurrent-pending` → `authorized-concurrent` → `discharged-auth-received`

**Denial / appeal path:**
`denial-pre-auth` | `denial-concurrent` → `peer-to-peer` → `written-appeal` → `discharged-denied`

Old stage keys from v8 and earlier are automatically migrated to v1.1 names on load.

### Views

| View | Description |
|---|---|
| **Worklist** | All active episodes sorted by urgency; drag-and-drop Kanban board |
| **Tasks** | Every auto-generated and manual task across all episodes |
| **Denials** | Denied/partial records with reason taxonomy and MCE breakdown |
| **Appeals** | Active appeals, overturn rate, resolved outcomes |
| **Missed Auth Days** | Records with uncompensated days; CSV export |
| **SLA & Cadence** | Per-MCE/level interval config (submit buffer, remind ahead, P2P, appeal windows) |
| **Audit** | Data-quality checks flagging missing fields, overdue tasks, stale records |
| **Reports** | Approval yield by MCE, census by level, workload by coordinator, pipeline breakdown |
| **Import** | Drop Sunwave MASTER `.xlsx` or single `Report Auth` CSV to load live data |

---

## Changelog

### v9 (July 2026)
- **New views:** Missed Auth Days, SLA & Cadence tab, Audit tab
- **Kanban board:** drag-and-drop episode cards between stage columns
- **Stage machine v1.1:** 11 named stages (ideal path + denial/appeal path) replacing free-text status; automatic migration of all old stage keys on load
- **XLSX import:** full Sunwave MASTER workbook import via SheetJS — parses `Report Auth`, `Census_Admitted`, `GroupNotes`, and additional tabs in one drop; shows record diff preview before committing
- **Clear All Filters** button added to filter bar
- **Audit tab:** data-quality checks with pass/warn/fail severity; badge shows open fail count; CSV export
- **Missed Auth Days report:** calculates uncompensated days per episode; CSV export
- **Coordinator registry:** confirmed payer/LOC reference data stored separately; flags unrecognized values on import
- Auth overlay removed from both files (handled upstream)
- Seed data updated to v1.1 stage keys with 6 realistic multi-period patient episodes
- `simple.html` trimmed to 449 lines — removed auth overlay, tightened styles

### v8 (June 2026)
- Microsoft SSO authentication added to both `index.html` and `simple.html` via MSAL v3
- Azure AD credentials injected via GitHub Actions secrets (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`)
- Allowed domains restricted to `striverecovery.com`, `providenthcc.com`, `gshealthcarellc.com`
- Cross-tab auth bridge via `localStorage['strive_ur_xpage']` — clicking MRN in `simple.html` opens `index.html` in new tab without re-login
- `openRec()` changed from `window.location.href` to `window.open(..., '_blank')`
- Fixed nested `<button>` HTML invalidity causing click handlers to break on episode cards

### v7 (May–June 2026)
- `?record=` URL parameter support — deep-link directly to a record modal
- Task system overhauled — tasks stored as `r.tasks[]` array per record
- `simple.html` added as lightweight ReviewDesk companion view
- Sidebar facility filter (All / Fort Wayne / Indianapolis)
- Coordinator filter dropdown

### v6 (April 2026)
- localStorage key bumped to `strive_ur_v6`
- Reports tab: approval yield by MCE, workload by coordinator, pipeline breakdown
- Appeals tab: overturn rate, active vs resolved split
- Urgency band colors: overdue (red), due today (red), amber, gold, green
- Auto-generated tasks per episode status
- Cadence config editable per MCE per level

### v5 and earlier (March 2026)
- Initial release: worklist, tasks, denials views
- ASAM level + MCE filter bar
- Episode cards with urgency deadlines derived from SLA cadence rules
- Denial taxonomy bar charts and MCE denial volume chart
- `localStorage` persistence with JSON export/import
- Demo seed data: 3 patient episodes across Fort Wayne and Indianapolis
