# Foundation fixes

This package repairs the existing FE Operations Center without creating a second app or replacing projects, SOPs, templates, or history.

## Approved access model

On October 22, 2026, the owner explicitly chose to keep the current open-access setup after reviewing its implications. The initially proposed app sign-in, Auth routes, session checks, and email allowlist have been removed.

- Production has no new login requirement. Data and editing functions are not restricted to approved teammates.
- Keeping the service-role key on the server and checking browser origins are not user authentication.
- Vercel previews remain read-only at both middleware and database-client boundaries, even if they inherit a write-enabled flag.
- Production writes are enabled by default when `VERCEL_ENV=production`. `OPS_WRITES_ENABLED=false` is an explicit write-disable switch.
- Local review mode is always read-only. Unknown environments default to read-only unless explicitly write-enabled.
- Existing Vercel Deployment Protection settings and database RLS policies are unchanged. Previously flagged RLS coverage is outside this release.

## Included repairs

- Existing-project workflow replacement returns a conflict instead of deleting tasks.
- Duplicate copies the selected project's actual checklist as fresh tasks. Completion, comments, linked assets, dependencies, and historical activity are not copied into the new task rows.
- Template and project copies share one server-reviewed creation path.
- Scheduling reviews identify the date anchor for each task. Missing launch dates and new fixed deadlines require a decision; existing source records are untouched.
- One accountable owner is required before creation. Missing, departed, or joint owner names are flagged rather than guessed.
- Explicit people take precedence, followed by current operating roles and then legacy roles. Existing assignments remain intact.
- Team, Weekly Review, project detail, date-range work, and owner-decision alerts use the shared ownership resolver.
- Default operational lists exclude completed work and inactive projects. Project history remains available.
- Template GET is read-only and no longer recreates deleted or renamed seeded templates.
- Progress is calculated on read. Task edits no longer attempt writes to nonexistent progress columns or silently complete projects.
- Weekly Review ignores late responses from an earlier filter selection. Read failures are visible instead of appearing as an empty workload.
- Mobile task names wrap, card grids fit narrow screens, and page-header dates use Phoenix time.
- Next.js is updated to 15.5.28, retaining React 18 and the existing visual system. API parameters use the asynchronous API; PostCSS is overridden to 8.5.31.

## Migration and release

Apply `supabase/migrations/20261020_foundation_creation.sql` separately before merging the app changes. It adds project provenance and creation idempotency, provides a transactional creation RPC, and relaxes the legacy task-role NOT NULL constraint so a modern-only owner does not require an invented old role.

The migration does not backfill owners, reschedule tasks, archive projects, rewrite templates, or alter RLS policies. Failed creation rolls back the entire project, checklist, and activity entry.

The owner authorized go-live and retaining open access. Supabase Auth account setup and Vercel email-allowlist settings are no longer prerequisites. Do not apply this migration automatically during preview builds.

## Review guide

1. In Projects, choose Duplicate on an existing project and review its actual checklist.
2. In New Project, choose a template and review the proposed dates and owners. Recheck after changing an owner or deadline.
3. Check Team and Weekly Review for active legacy-role work, owner-decision flags, and exclusion of completed/archived work.
4. Try the workflow selector on an existing project; it should protect the existing checklist and offer a new project instead.
5. Review project history to confirm it remains intact.

## Verification

The original preview passed its production build, 50 unit/route tests, and both disposable database suites. Browser QA used a private read-only snapshot, not a signed-in hosted session.

The release revision replaces the sign-in tests with checks for the approved open-access production behavior, preview write blocking, the write-disable switch, and cross-origin rejection. Re-run the full suite and production build before merging.

Local UI coverage includes all seven editable templates, duplicate/new-project review, owner/date overrides and recheck, missing/invalid dates, cancellation, workflow protection, late filter responses, read-error recovery, and desktop/mobile layouts. Private snapshots and screenshots are excluded from Git.

After deployment, verify the canonical production URL without sign-in, live read-only preparation against existing data, and the release deployment status. Any live write test must be clearly labeled and cleaned up.

The previous production dependency audit had zero known findings; development-tooling findings remain separately tracked. This package is not a claim that the open-access app is private or fully security-hardened.

## Next packages

The shared-company overview, recurring work, lightweight email workflow, and transcript ingestion remain separate follow-up work.
