# Project date scheduling: review-only release

## Scope

Project Launch means marketing launch. Project Start means program start. Editing either date opens a read-only schedule review before saving. The separate Review schedule control can repair legacy deadlines even when project dates are already correct.

Each open task has a marketing-launch, program-start, or fixed-date rule. Offsets use calendar days. Completed tasks retain their historical deadlines. Legacy custom deadlines and unrecognized workflows default to fixed dates rather than being guessed. Recognized course-launch phase suggestions require a consistent legacy schedule and explicit review.

This branch is a proposal, not a production release. Do not merge before the additive migration is approved and installed. Do not run any legacy bulk rescheduling.

## Data changes and safeguards

The proposed migration adds nullable `schedule_anchor` and `schedule_offset_days` fields to `project_tasks`, validates their combination, and adds a service-role-only transactional save function. It does not backfill or move any existing deadlines.

The save function locks and compares the project and full task snapshot before updating. Stale reviews are rejected. Project fields, task rules, deadlines, and the audit entry commit together or roll back together. Direct date-changing PATCH requests are rejected in favor of this reviewed endpoint.

Manual deadline edits and manually added tasks use fixed-date rules. Re-saving an unchanged individual deadline preserves its existing rule. Explicit bulk rescheduling makes the affected dates fixed. The old global reschedule endpoint returns 410 without touching records.

Existing marketing post dates, Strategy-specific date overrides, and separately assigned vendor deadlines do not move in this change. Shared project-task views read the revised deadlines after a successful save. New-project template generation is not redesigned by this change; use Review schedule to establish or adjust its rules.

Enrollment-reminder offsets are preserved rather than inferred from task titles. Wrap-up offsets remain relative to program start, not an unknown course-end date. Both need human review.

## QA inventory

| Claim or control | Check and evidence |
| --- | --- |
| Read-only Review schedule | Open and cancel/Escape; no update request; existing data unchanged |
| Two separate anchors | Unit tests for launch-only/start-only, missing initial launch, leap dates, offsets and repeated saves |
| Legacy repair | Current project snapshot produces phase-level old/new dates without writes |
| Rule controls | Change anchor and offset, return to original, observe count/date and reset acknowledgment |
| Save acknowledgment | Save disabled until checked; changed rules invalidate acknowledgment |
| Successful save | Isolated browser fixture updates visible project/task values and confirmation |
| Completed/fixed/custom protection | Unit tests and isolated database checks preserve old deadlines |
| Error recovery | Missing migration and stale snapshot leave dialog open with an error |
| Transaction safety | Execute exact migration in isolated PGlite; forced audit failure rolls back all changes |
| Permissions | Function execute denied to public, anon, authenticated; service_role only |
| Responsive review | Desktop and narrow mobile screenshots, dialog scrolling and viewport-fit inspection |
| Regressions | Existing marketing and archive tests, TypeScript/Next production build |

Off-happy-path coverage includes stale reviews, forged or missing task IDs, absent anchors, invalid dates, malformed rule combinations, and a failed transactional save.

## Validation results

- All 30 automated Node tests passed, including existing marketing and archive regressions.
- The Next.js production build passed compilation and type checking.
- The exact proposed migration passed isolated PGlite tests for preservation, atomic save, completed-task protection, stale snapshots, forced rollback, constraints and execute permissions.
- Desktop (1440 px) and mobile (390 px) browser checks passed. The dialog stayed within the viewport with no horizontal overflow, clipped controls or JavaScript page errors.
- Isolated frontend tests covered anchor/offset/fixed-date changes, acknowledgment reset, Escape/cancel, missing-migration and stale-review errors, immediate task-list refresh, start-only and launch-only changes, invalid date ordering and an unchanged repeated preview.
- The live project snapshot was fetched read-only and verified unchanged after testing. Successful writes were exercised only with local browser fixtures and the isolated database.

The preview branch has not been merged, its migration has not been applied to Supabase, and live deadlines have not been changed. A protected Vercel preview may require sign-in. Before the migration is installed, real schedule saves intentionally fail without updating project dates.

## Release order

1. Review the code, visual preview, and proposed real-project schedule.
2. Obtain explicit approval for the additive migration and any live deadline changes.
3. Apply the migration, then merge and verify the production deployment.
4. Review and save the approved project schedule through the new interface.
5. Verify project-backed overdue views against the resulting stored dates.

The migration is intentionally not reversible through a destructive down-script. Reverting the application requires care because the old code contains unsafe date-cascade behavior.
