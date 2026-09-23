# Marketing Strategy and Calendar review

## Scope

- Three Marketing destinations share `marketing_content`; no duplicate asset table.
- Existing Content Pipeline and FE-voice drafting route preserved.
- Supplied migration recorded only. It was already applied; do not rerun it for this PR.
- No optional RLS changes, project task-anchor changes, or two-anchor migration.

## Date semantics

Confirmed with Jessica during review on September 23, 2026:

- Project `launch_date` means marketing launch.
- Project `start_date` means actual program start.
- API resolves marketing launch as `marketing_programs.marketing_start ?? projects.launch_date`.
- API resolves program start as `marketing_programs.program_start ?? projects.start_date`.
- Strategy edits are marketing-specific overrides, not writes to Projects or task scheduling.
- Clearing an override resumes the corresponding project fallback.
- All four current project launch dates were null at review; no dates were invented.

## Fixes beyond the supplied archive

- Corrected reversed launch/start fallback semantics.
- Surface Strategy/Calendar load failures instead of silently showing an empty plan.
- Strategy saves wait for success and reload canonical data; failures remain visible.
- Shared readiness colors on Pipeline assets as well as Strategy/Calendar.
- Weekly volume excludes assets outside partial edge weeks and covers windows beyond 52 weeks.
- Month overflow can be expanded instead of hiding assets behind inert “more” text.
- Platform filter prefills new calendar assets.
- Scrollable timeline/month grid and wrapping calendar toolbar for narrow screens.
- Failed asset deletion is visible; shared modal has dialog semantics.
- Marketing dropdown exposes expanded state and Escape handling.
- Narrow-screen primary navigation moves under More so the Marketing dropdown remains reachable.

## QA inventory

- Automated: all readiness combinations; date round trips and Monday weeks; inclusive window bounds; partial-week counts; long windows; API failures.
- Build: `npm run build`, including TypeScript and framework lint checks.
- Preview: real projects, team owners, empty marketing data and project-date fallbacks.
- Live temporary QA asset: create in Strategy, see Calendar and Pipeline, edit readiness/status, refresh to verify persistence, remove only QA records.
- Calendar: month/week, previous/next/today, program/platform/readiness filters, empty-cell prefills, undated assets, program milestones.
- Strategy: program counts, timeline dots, inline checkboxes, weekly volume, outside-window warnings, unassigned assets.
- Navigation: dropdown routes and existing drafter form.
- Off-happy-path: failed API request remains visible; >4 assets on one day remain reachable.
- Visual: desktop and narrow-screen Strategy, Calendar and Pipeline, including modal and populated states.

## Separate follow-ups

- Supply actual marketing launch dates for the four active programs.
- Optional deny-by-default RLS hardening requires separate review of API authorization. Service-role access bypasses RLS; RLS alone does not protect an unauthenticated server API.
- Dependency install reports an existing security advisory for Next.js 14.1.0. Framework upgrade is outside this focused PR.

## Verification outcome

- Production build and five automated regression groups passed.
- Vercel Git integration successfully deployed the feature branch.
- Direct Supabase read checks confirmed four active projects, zero marketing assets, zero marketing-program overrides, and four null project launch dates.
- Live preview UI verification is **blocked**: Vercel requires authentication; the connected management CLI has a certificate-signature failure; this session cannot reach the user's local browser even after they opened it.
- No live test assets or program dates were written. Supabase counts were rechecked unchanged.
- Local browser QA uses intercepted API responses with a snapshot of the real project names/dates and isolated temporary assets. This validates frontend behavior only, not live API persistence.
- Local flow checked Strategy create → Calendar edit → Pipeline visibility, readiness colors/outlines, retained FE drafter controls, filters, month/week navigation, and cell date/platform defaults.
- Do not treat this PR as live-data QA signoff until the protected Vercel preview can be tested.
