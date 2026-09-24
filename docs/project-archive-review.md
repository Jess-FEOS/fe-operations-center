# Project Archive and Restore

## Scope

- Archive and Restore on project cards and project details, with confirmation and recoverable errors.
- Active and Archived views in Projects. Existing paused/completed projects remain reachable through Other inactive.
- Archived projects stay out of the default Strategy timeline and cards even when they have assets. Show archived / inactive programs reveals them.
- Tasks, dates, assets, campaign states, priority states and existing history remain intact. Status changes append activity history.
- Restore returns a project to Active. Task completion never archives it automatically.
- Existing marketing assets remain in Pipeline and Calendar. Pipeline retains the selected project when editing an archived project's asset.

## Database

The user approved extending `projects_status_check` with `archived`. Migration `20260924_project_archive.sql` records the applied constraint change. No project statuses were changed. The optional RLS work and parked date migration are untouched.

## QA inventory

- Active list: complete projects stay active until explicitly archived.
- Archive confirmation: Cancel and Escape do not save; confirmation sends status only.
- Successful archive: card leaves Active; Archived count and list update; reload retains state.
- Restore: confirmation returns the project to Active without changing linked work.
- Failure: show API error, retain original state and allow retry.
- Project detail: archive banner and Restore action; controls fit desktop and mobile.
- Strategy: archived project with an asset hidden by default, revealed by opt-in; asset does not move to Unassigned.
- Pipeline: archived asset's project badge and edit selection remain intact.
- API: default active filter, explicit archived/all/paused/completed, invalid filter and status rejected.
- API: prior status logged, failed and repeated updates do not create success activity; no task/asset/date/priority/campaign writes for archive or restore.
- Visual: desktop 1440px and mobile 390px, dialog keyboard focus and no horizontal overflow.

## Release

This is a separate feature branch and PR after Marketing PR #3. Do not merge without release approval. Browser write tests use isolated fixtures, not live projects.

## Results

- All 18 automated tests pass, including five new archive API regressions.
- Optimized Next.js production build passes.
- Browser checks passed for archive/restore from list and details, Cancel, Escape, failed-save retry, reload persistence, default Strategy exclusion and opt-in visibility, and preserved Pipeline asset project selection.
- Browser tests used a read-only snapshot of current production data with isolated mock writes. No production project was archived.
- The mobile card minimum width was corrected after visual QA found overflow. Detail actions wrap on small screens.
- Supabase constraint verified to allow archived; all four existing projects remain active.
