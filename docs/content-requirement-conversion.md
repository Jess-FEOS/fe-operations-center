# Content requirements and asset conversion

This supersedes the broad role/phase-only flagging described in `project-marketing-requirements.md`.

## Behavior

- Completed project tasks never appear in the requirements panel. If a program has no open qualifying tasks, its requirements panel is omitted entirely. Its program card and any existing marketing assets remain.
- Task suggestions require both marketing role/phase context and a content-oriented title (email, social post, graphic, video, clip, blog/article, ad, show notes, or thumbnail).
- Sales/landing pages, website work, setup, automation, enrollment forms, monitoring, testing, onboarding/welcome emails, surveys, and collecting testimonials are excluded. This is a conservative deterministic rule, not an AI classification or an exhaustive taxonomy. Operational work remains unchanged in Projects.
- `Create asset` opens the existing shared form with title, project, source-task link, deadline as a proposed post date, and an owner if exactly one is assigned. Explicitly named platforms are suggested; unspecified ones are left for review. An email-only task suggests Email and the Email type.
- The user confirms or changes the post date before saving; linked conversions require a date. The asset starts as Ready to write, not Scheduled, and does not publish anything.
- Saving creates one normal `marketing_content` record shared by Strategy, Pipeline and Calendar. The requirement switches to `Open asset` and no longer counts as “to plan.”
- Creating an asset never completes or reschedules the project task. Task completion remains in Projects. Dates/status are not automatically synchronized after conversion.
- A unique nullable source-task link prevents repeat conversions, including concurrent requests. The user can still create additional ordinary assets for multi-piece campaigns; one-click conversion creates one starter asset.
- Editing an asset cannot reassign its source task or move it to another project. Deleting the source task retains the asset and clears the link. Deleting the asset makes its still-open qualifying task eligible again.

## Approved database change

Jessica explicitly approved the additive link on September 23, 2026. `20260923_marketing_source_task.sql` adds `marketing_content.source_task_id`, a foreign key with `ON DELETE SET NULL`, and a unique partial index. The migration was applied through Supabase. Existing asset count was unchanged; no existing task/asset data, RLS rules, or project date anchors were edited.

## QA inventory

- Helper tests: positive content examples, operational exclusions, all-Done exclusion, owner/platform/date defaults, linked-task counts.
- API tests with a Supabase test double: valid conversion, completed/operational/deleted-source rejection, project mismatch, required date, unique conflict, immutable link, status-only updates, ordinary unlinked saves.
- Real Supabase: verify column/foreign key/index; transaction-scoped temporary QA asset checks with rollback and no persistent changes.
- Local browser: real task snapshot; no AI Accelerator/Podcast requirement panels; no sales-page tasks; create/cancel/save, same asset in all three views, re-open instead of duplicate, editable date, completed task removed after refresh, errors retain form, desktop/mobile layout.
- Preserve production isolation: branch PR only; do not merge. Vercel authenticated E2E remains dependent on access to the protected preview. Local browser checks use intercepted API responses, not a live authenticated application session.

## Results

- Production build, TypeScript checks, and 13 automated tests passed.
- Current task snapshot yielded seven open content requirements each for PM Academy and Credit Academy, and none for AI Accelerator or Invest with AI Podcast.
- Local browser checks passed: completed-program panels omitted; sales-page tasks excluded; prefill/cancel/date-required behavior; duplicate error displayed without closing the form; save changes to Open asset; the same record appears in Pipeline and Calendar; Pipeline edits retain the source link; marking the source task Done removes its requirement without removing the asset.
- Desktop and 390px mobile screenshots were visually reviewed. No page-level horizontal overflow was found; requirement tables scroll within their own containers.
- A transaction-scoped real-database test confirmed linked insertion and unique rejection, then rolled back both temporary QA inserts. The persisted asset count remained one.
- The approved additive migration is live; application changes remain in the unmerged PR. Authenticated Vercel application-level persistence is not claimed.
