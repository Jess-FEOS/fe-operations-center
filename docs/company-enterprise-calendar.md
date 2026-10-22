# Enterprise Projects and Company Calendar

## Preview scope
This extends FE Operations Center, not a new dashboard. No live enterprise records or historical dates are imported, and the proposed database migration requires separate approval before production use.

## Mapping

| Business information | Existing home | Calendar behavior |
|---|---|---|
| Enterprise engagement / client workstream | One Project per engagement, not per client firm | Independent dates and status for each engagement |
| Client identity | Approved client display label in Project → Company calendar settings | Use a safe, recognizable engagement name; no confidential account details |
| Engagement accountability | One engagement owner | Filters enterprise kickoff/launch milestones by that owner |
| Program kickoff | Existing Project Program Start | Automatic “Client kickoff” milestone for enterprise projects |
| Marketing launch | Existing Project Marketing Launch | Automatic marketing-launch milestone; never repurposed as kickoff |
| Client-facing deadline | Existing task marked “Client deliverable” | Original due date, owner, status and task link |
| Workshop/coaching/office hours | Existing task marked “Client session” | Original task date; date-only in this version |
| Internal preparation / operations | Existing task, default “Not shown” | Remains in Projects, not Company calendar |
| Seminar | Existing manually managed seminar | Date/time, seminar editor and original record |
| Email/social/blog/video | Existing Marketing asset | Marketing view only |
| Pricing, contracts, proposals, invoicing and payment | Restricted source systems | Not imported or surfaced by this change |
| Reusable process | Existing SOPs and templates | Retained, not duplicated or rewritten |

## Team workflow
1. Create a Project through the existing template/review flow, or open an existing engagement. No separate enterprise creation wizard is added in this preview.
2. In Company calendar settings, identify it as an enterprise engagement, enter an approved client display label and choose its owner. This categorization does not replace its workflow or erase tasks.
3. Set Program Start and, when relevant, Marketing Launch through the existing reviewed project schedule.
4. Edit selected tasks and choose Client deliverable or Client session. Keep ordinary preparation tasks unselected. Each client commitment needs one accountable task owner.
5. Open Calendar → Company to see commitments. The calendar links back to the exact task editor.

No second calendar entry is created. Reloading or returning to the calendar reads current source dates/status; this is not a websocket live-sync feature.

## Visibility and changes
- Only active projects contribute milestones and enterprise commitments. Archived, completed and paused projects are excluded.
- A done task disappears from the Company feed, including historical month views. Its record and history remain in Projects.
- Old dates do not mark work complete. An overdue open commitment still appears when viewing its date.
- Clearing the task's calendar selection hides it without deleting it.
- Removing the enterprise classification hides its client commitments but preserves their selections for later restoration.
- Ordinary program launches and starts remain in Company. Marketing's existing milestone view is unchanged; this intentionally retains shared anchor dates, not duplicated marketing assets.
- Owner filters use the engagement owner for milestones and task owner for commitments. Seminars and unassigned milestones are hidden with an owner filter.
- A project filter hides unlinked seminars; saving a seminar clears project/owner filters so it becomes visible.
- Editing an individual task date changes only that task and makes the date fixed. The previous silent cascade to later tasks is removed. Project-wide schedule review remains the way to shift anchored work.

## Database and access
The additive migration `20261022_enterprise_company_calendar.sql` proposes four fields:
- `projects.is_enterprise`: boolean, default false.
- `projects.enterprise_client_label`: nullable text.
- `projects.enterprise_owner_id`: nullable team-member reference.
- `project_tasks.company_calendar_kind`: nullable `deliverable` or `session`.

No policy changes, sign-in requirement, schema removals, enterprise seeds, historical backfills or production data imports are included. Until the migration is approved and applied, existing dates/seminars work; Project settings explicitly say enterprise saves are unavailable. Vercel previews retain read-only write guards.

Open access remains as previously approved. The new label is not a privacy barrier: project names, task names and schedules must also be safe for that access model. Restricted Company Brain snapshots, commercial information and raw email content are not copied into the app or this repository.

## Release gates
Review the branch preview and fictional enterprise example; approve the migration and deployment separately. Before applying the migration, verify project/task counts; after applying, verify unchanged counts and four added fields. Then merge only the reviewed commit, verify Vercel production and test approved sample changes with cleanup.

## Verification completed for this preview
- 77 unit/API tests pass, including date movement, completion/archive visibility, ownership, missing migration handling, validation and marketing-feed separation.
- TypeScript and optimized Next.js build pass.
- The proposed migration passes twice in a disposable PostgreSQL-compatible database, preserving existing row counts and validating enum/default/owner-reference behavior. It has not been applied to production.
- Local browser checks cover Company layers and navigation, owner filtering, month changes, seminar date prefill, exact-task links, read-only save failures, missing-migration messaging, Marketing month/platform-week, Pipeline, Strategy and project template navigation.
- Desktop and 390px mobile checks show no document-level horizontal overflow on the changed pages. No browser runtime errors were observed.
- Fictional engagement screenshots illustrate features requiring the proposed schema. The read-only branch connected to the current production schema cannot save enterprise settings or contain that fictional example.
