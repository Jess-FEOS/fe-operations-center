# Unified Calendar

The existing calendars are combined at `/calendar`. This is a navigation and UI
consolidation, not a new database or another operations dashboard.

## Views

- Company: open task deadlines from active projects, program milestones,
  seminars, and dated marketing assets. Layer toggles remain available.
- Marketing: the existing month and week-by-platform tools, readiness colors,
  asset editor, and undated-assets section.
- Program, owner, and selected date remain in the URL across view changes.
  The Marketing view additionally filters by platform and readiness.
- The old `/marketing/calendar` route redirects to the Marketing view, preserving
  supported filters and deep links. Pipeline and Strategy point directly there.
- Calendar is a primary navigation item; the duplicate Marketing Calendar menu
  item is removed. Mobile navigation includes Calendar under More.

## Existing records and ownership

Both views use the existing `marketing_content` rows and save through the same
server API routes. A Company asset opens that exact asset in Marketing. Project
deadlines still link to the source project. No copy of an asset or task is made.

Company task filtering resolves explicit ownership and current/legacy roles.
Marketing owner filtering uses the asset's existing owner. Completed tasks and
archived-project tasks stay out of the Company deadline feed.

Milestones use the same effective dates as Marketing Strategy: marketing-program
overrides when present, otherwise the project's launch/start dates. Only active
programs produce milestone markers. Selecting an owner hides unassigned
milestones and seminars; selecting a program hides unlinked seminars.

Seminars do not currently have a program or owner association. Their editor
explains this, and a successful seminar save clears those filters so the saved
event can be seen.

## Adding and editing

Clicking a Company day offers a seminar or marketing asset with that date
prefilled. Marketing week cells retain date/platform prefill. A new marketing
asset also inherits the selected program and owner.

Company and Marketing use the same red/amber/green readiness calculation.
Unfinished marketing entries have dashed borders. Company data failures show a
retry action instead of appearing to be an empty calendar. Late responses cannot
overwrite a more recently selected month.

## Verification

- 68 unit/route tests pass, including calendar date validation, URL state,
  legacy redirect, active-only milestones, ownership filtering, readiness fields,
  and failed-query behavior.
- Browser QA uses a private read-only snapshot; synthetic assets/seminars and
  successful writes are simulated in the browser only.
- Verified rapid program/owner/view switching, date/platform defaults, exact-ID
  asset editing, failed-save messages, post-save modal closure, seminar editing,
  create/delete confirmation, layer toggles, seven platform rows, undated assets,
  old-link redirects, and error/retry.
- Explicitly delayed old-month responses were released after a newer month
  loaded; the newer calendar remained displayed.
- Desktop/mobile layouts are checked with internally scrolling calendar grids.

No migration, production record change, permission change, or new sign-in is
included. The separately identified `/api/dashboard` summary error remains out
of scope. Production release requires approval of the PR.
