# Operations Update Intake Preview

## Included
- More → Import updates, within the existing FE Operations Center.
- A reusable, copyable prompt with instructions for authorized Outlook/Notion review, meeting transcripts, evidence, owners, dates, tentative decisions, privacy and structured JSON.
- Paste text or upload TXT, MD, VTT, SRT, DOCX and JSON, up to 2 MB and 80,000 extracted characters. Audio/video, image OCR, PDF and old binary DOC files are not supported.
- DOCX is read as text only in the browser. No HTML rendering, links, attachments or macros are executed.
- JSON batches validate and review locally. Exact repeated proposals within the same batch are skipped.
- Optional AI extraction for notes/transcripts and plain-language summaries. Explicit user consent precedes sending the text to the configured provider; the server requests no tools or web search.
- Evidence, unresolved questions, item selection and proposal download. No source file is stored by this app; inputs are held in browser memory.
- A temporary practice workspace loaded from a preview-only, SELECT-only endpoint. Exact project/owner/record matching, explicit conflict resolution, per-item or batch evidence confirmation, and a full before/after approval step.
- Apply selected changes together to the in-memory copy; view connected Projects, Marketing and dated Calendar results. These are practice result views inside Import updates, not modifications to the main app pages.
- Session-only history with evidence, before/after values, reviewer labels and safe latest-batch undo. Retries with the same batch key do not apply twice; changed content and stale reviews fail.
- Project date imports merge both anchors before validation, display cascading changes using saved rules, and preserve fixed, completed and unconfigured task dates. Explicit task date imports become fixed dates, shown in review.

## Boundaries
### Fuller editing in the practice reviewer
- Edit title, destination, owner, project, record match, date meaning/date and status without changing JSON or re-uploading.
- Marketing adds editable platforms, caption/description, asset type, audience, copy readiness and creative readiness. Email reminders do not require copy or creative approval.
- Task descriptions append to the existing `task_comments` model; seminar descriptions use `notes`. No description column or migration is invented. Existing text is not erased by a blank input.
- Original excerpts/questions remain read-only; reviewer corrections are visible in before/after history. Every edit invalidates previous approval.
- Select specific items for bulk project/owner/date edits. Bulk dates affect assets, tasks and seminars only, never project milestone anchors. Held/skipped items are excluded.
- Hold/Skip excludes an item from the atomic apply without deleting it. Restore it using Include; all edits remain for this session. Refresh discards held items too.
- Original extraction is collapsed to avoid two long lists. Its download is clearly labeled as original, not an edited export; the edited data goes directly through review into the practice copy.
- The SELECT-only copy now includes task comments and marketing captions/seminar notes to show accurate before/after values. This still introduces no database writes.

This is a functional practice workflow, not a live import engine. It matches against a fetched copy and applies atomically to browser memory only. No Apply HTTP endpoint exists, no Supabase mutations occur, and no database migration or production configuration change is included. Existing middleware continues blocking preview API writes, and the privileged database client remains server-only.

Refresh or navigate away from Import updates to discard the practice copy, changes and history. Clearing/replacing the intake within this page preserves the copy, allowing follow-up batches and duplicate checks against earlier practice changes. It is not durable or shared with other teammates. Loading/resetting reads current records again; edits made by other people after loading are not synchronized into the copy.

AI responses are proposals, not verified facts. The validator flags missing context and excerpts absent from the provided transcript; semantic grounding still requires review. Matching is exact, never fuzzy or inferred from arbitrary source URLs. Ambiguity or a changed existing create candidate requires explicit selection. Duplicate matching is conservative, not a guarantee of semantic deduplication.

Status and date safeguards are explicit: “done” alone cannot mean a published asset; completed tasks and posted status regressions are protected. Unknown fields never erase existing values. Existing seminar records do not have owner/project fields, so such commitments require reclassification instead of inventing a database relationship. Program audience, goal and notes require explicit structured fields or reviewer entry. Enterprise calendar opt-ins remain separate in PR #10.

Reviewer labels and checked approval boxes are not authentication. Production release still requires protected authorization and database-enforced concurrency, transaction, idempotency, audit and undo checks. A browser-only atomic apply is not a substitute for that backend.

The user can use Copy prompt + source text with their own AI app, then upload the resulting JSON, without connecting that AI app to the database or configuring the app's AI extraction.

## Preview-only AI route
`POST /api/updates/prepare` is allowed through the existing read-only review middleware but imports no database client and makes no database writes. It is disabled in production until a separate access/cost-control and approval flow is agreed. Vercel previews retain their existing protection; no team login or new production access policy is introduced.

The route uses the existing server-only `PERPLEXITY_API_KEY`; optional `OPS_IMPORT_MODEL` overrides the model. A missing key produces instructions for the external-AI prompt path, not fabricated results. Provider-level processing/retention is not controlled by clearing this page.

The request follows the documented [Perplexity Agent API](https://docs.perplexity.ai/api-reference/agent-post.md): explicit model, `tools: []`, `tool_choice: "none"`, non-streaming response, assistant output-text parsing. The existing marketing drafter is unchanged.

## Release requirements
Review this intake preview separately from calendar PR #10. Before enabling actual imports, agree the team-only approval mechanism; port and revalidate the matching plan against current server records; add transactional, retry-safe database application with durable audit and safe reversal; and test on a separately authorized persistent staging database. No new paid database resources were provisioned for this temporary preview. Real-provider AI extraction remains separately unverified.
