# Projects to Marketing Strategy

## Scope

Planning is removed from desktop and mobile navigation. Its existing route and data remain intact.

Strategy reads existing project tasks through the read-only server endpoint `/api/marketing/requirements`. No migration, copied task, automatic asset creation, live record edits, or task scheduling changes are involved.

## Automatic selection

- Include any task assigned to a role whose name contains the word “marketing”, regardless of phase.
- Include any role's tasks in Market, Marketing, Marketing Launch, or Pre-Launch phases (case-insensitive).
- Other roles/phases are not inferred from task titles. To surface a requirement, use the existing marketing role or one of those phases in Projects.
- Show the current task name, deadline, explicit owners (or role when no person is assigned), status, and phase under its project.
- Hide completed tasks by default; show open, overdue, blocked, and completed counts.
- Refresh on Strategy mount, window focus, or explicit Refresh. This is a read-only projection, not a realtime subscription.
- A requirement-load failure remains visible and does not take down the asset plan.

## Sources of truth

- Project names and default program dates come from Projects. Project Launch is marketing launch; Project Start is program start. Existing marketing-specific date overrides still take precedence.
- Task names, deadlines, assignment, and completion are edited in Projects.
- Marketing assets remain in `marketing_content` and share Pipeline, Calendar, and Strategy.
- Task deadline is not assumed to be the asset's post date.
- Open requirements do not imply missing assets. There is no persisted task-to-asset relationship yet, so coverage is not claimed.
- No task is automatically completed when an asset is posted; one task may require several assets or may be operational rather than publishable.

## QA inventory

- Desktop/mobile navigation: Planning absent; Marketing destinations and Projects remain available.
- Real read-only task snapshot: 62 qualifying tasks across four projects; compare per-project counts to database query.
- Status/deadline cases: completed tasks hidden, toggle shown then hidden; overdue excludes done and today; blocked and missing-deadline cases.
- Manage in Projects links: correct project destination.
- Refresh: changed source-task status/name appears without duplicate rows.
- Failure and recovery: requirement fetch fails visibly while asset view remains; retry restores tasks.
- Empty case: clear wording, no false error or missing-asset assertion.
- Regression: asset counts and shared assets remain unchanged by requirement display.
- Desktop and mobile screenshot/overflow checks; local production build and unit tests.

## Test environment boundary

Real task records were read through the Supabase connector. Local frontend checks use that snapshot through intercepted API responses, plus isolated fixtures for failure and unusual-state tests. This is not authenticated Vercel end-to-end signoff; the preview remains protected and the user's browser bridge is unavailable. No temporary live asset was needed or created.

The database snapshot on September 23, 2026 contained 17 requirements for AI Accelerator (all done), 17 for Credit Academy (all open), 11 for Invest with AI Podcast (all done), and 17 for PM Academy (all open). Existing deadlines are displayed, not recalculated.

## Results

Production build and seven shared-helper tests passed. Local browser checks passed for the real snapshot counts, completed-task show/hide, refreshed status, blocked/undated tasks, error/retry recovery while preserving asset controls, and correct project-link targets. Desktop and 390px mobile screenshots were reviewed; no page-level horizontal overflow was present. The requirements table intentionally scrolls inside its container on mobile. Planning was absent in both navigation layouts, including the mobile More menu.
