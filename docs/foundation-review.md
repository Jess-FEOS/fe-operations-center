# Foundation-fix preview

This branch changes the existing FE Operations Center. It does not create a second app or redesign the company overview.

## Included

- Existing-project workflow replacement returns a conflict instead of deleting tasks.
- Duplicate reviews the selected project's actual checklist. Status, comments, links, dependencies, and historical completion are not copied.
- Creation from either a template or a project uses the same server-generated review and save path.
- Course creation reviews Marketing Launch and Program Start separately. Fixed/custom deadlines on copied tasks require an explicit new date.
- Missing, departed, or joint owner names require an accountable-person choice. Existing joint assignments remain intact and are flagged, not automatically reassigned.
- Explicit people take precedence, then current operating roles, then legacy roles. A modern role without a holder never silently falls back to an unrelated legacy person.
- Team, weekly review, project detail, date-range work, and ownership alerts use consistent ownership resolution.
- Active-work views exclude completed work and inactive project history by default. Full history stays in Projects.
- Template GET is read-only; it no longer restores deleted/renamed seeded templates.
- Progress is calculated on read; editing a task no longer attempts writes to nonexistent project progress fields or silently completes its project.
- Preview saves are blocked in both middleware and the server database client, even if a write-enabled environment flag is inherited.
- Production access requires an approved Supabase Auth user, an exact email allowlist, and a verified server-side session. Authentication is enforced at the database boundary as well as middleware.
- Next.js and its ESLint configuration are upgraded to 15.5.28, retaining React 18 and the existing interface. Dynamic API parameters and cookie access use the asynchronous API.
- PostCSS is pinned through an override to 8.5.31. Production dependency audit reports no known vulnerabilities at this check; nine development-tooling findings remain for follow-up.
- Weekly Review ignores late responses from an earlier filter selection. Read failures are surfaced rather than presented as an empty workload.
- Shared card grids fit a 375px viewport; weekly-review task names wrap on mobile. Page-header dates use the company’s Phoenix time zone.

## Review guide

1. Open Projects. Existing project counts, dates, and history should be unchanged.
2. Open PM Academy and choose Duplicate. Enter new dates and review its 37-step checklist. Nothing is saved.
3. Try New Project with a course template. Enter different marketing-launch and program-start dates. Review the owner and deadline decisions; use Recheck changes after edits.
4. Open Team and Weekly Review. Active Analyst Academy work is now included; completed and archived project tasks are omitted from operational counts.
5. Open a project workflow selector. It explains that existing work is protected and offers a new project instead.
6. Compare Projects, This Week, and owner-decision alerts. Explicit owners should not be replaced by a different role holder.

## Deployment and release gates

This is a preview, not a production release.

- Keep Vercel Deployment Protection enabled for the preview. Preview reads rely on that existing access boundary; production does not.
- `VERCEL_ENV=preview` always blocks writes. Locally, `OPS_LOCAL_REVIEW=true` permits read-only UI QA only in development.
- Apply `supabase/migrations/20261020_foundation_creation.sql` only after approval. It adds project-creation provenance, an idempotency key, and a transactional RPC; it relaxes the legacy task-role NOT NULL constraint so a modern-only person does not need an invented old role.
- The migration does not backfill owners, reschedule tasks, archive projects, or rewrite templates.
- Provision approved team Auth accounts and configure `OPS_ALLOWED_EMAILS` before merging. No invitations, emails, password changes, or account provisioning are performed by this branch.
- Set `OPS_WRITES_ENABLED=true` in production only after access and database tests pass. Without it, production remains read-only; without approved sign-in configuration, production data access fails closed.
- Sessions use a secure HTTP-only cookie and expire at the auth-token lifetime. Refresh-token renewal and richer account administration are not included.
- Review role holders and ambiguous owner decisions with the team. No mass reassignment is included.
- Shared-company homepage simplification, recurring production, lightweight email UX, and transcript ingestion remain the next packages.

## QA contract

- Unit and route tests: ownership precedence, missing/joint owners, launch/start dates, fixed-date copying, read-only policy, workflow protection, archive/restore and existing marketing regressions.
- Disposable PostgreSQL-compatible tests: atomic creation, retries, stale sources, rollback on task/log failure, migration re-run, and service-role-only RPC execution.
- UI checks: project listing, duplicate review, new-template review, owner/date overrides and recheck, invalid dates, Team and weekly review, workflow protection, and desktop/mobile fit.
- Local UI QA uses a private, read-only snapshot server. The snapshot is ignored by Git and must never be committed or deployed.
- Preview verification must distinguish public Deployment Protection from authenticated app checks. A protected login page is not proof that the application itself loaded successfully.

No production writes are authorized by this document.

## Local verification results

Completed on October 20, 2026, against a private read-only snapshot and disposable test databases:

- Production build and TypeScript checks pass.
- All 45 unit/route tests pass; both disposable database suites pass.
- All seven existing editable templates prepare successfully, preserving all 174 template steps.
- The duplicate-project screen reviews the actual selected checklist, permits owner/date decisions, and disables Save in preview.
- Owner overrides and fixed-date overrides survive Recheck. Missing launch dates are flagged; a launch after program start is rejected visibly.
- Role and weekly views include active legacy-role work. Completed project tasks are absent from open-work lists; unresolved ownership has its own review group.
- An intentionally delayed weekly response cannot overwrite a newer All Open selection.
- A simulated API failure shows an error; Retry restores the actual workload.
- Existing-project workflow replacement shows the protected-work message instead of offering destructive confirmation.
- Task-owner editing can be cancelled without changing the original assignment.
- Local POST, PATCH, and DELETE attempts are rejected with 403.
- Tested desktop and mobile layouts show no page-level horizontal overflow in the new checklist review, Team review, and This Week flows. No browser runtime exceptions occurred in these tests.

These checks do not constitute authenticated verification of the hosted Vercel preview or approval to release production.
