# Operations Update Intake Preview

## Included
- More → Import updates, within the existing FE Operations Center.
- A reusable, copyable prompt with instructions for authorized Outlook/Notion review, meeting transcripts, evidence, owners, dates, tentative decisions, privacy and structured JSON.
- Paste text or upload TXT, MD, VTT, SRT, DOCX and JSON, up to 2 MB and 80,000 extracted characters. Audio/video, image OCR, PDF and old binary DOC files are not supported.
- DOCX is read as text only in the browser. No HTML rendering, links, attachments or macros are executed.
- JSON batches validate and review locally. Exact repeated proposals within the same batch are skipped.
- Optional AI extraction for notes/transcripts and plain-language summaries. Explicit user consent precedes sending the text to the configured provider; the server requests no tools or web search.
- Evidence, unresolved questions, item selection and proposal download. No source file is stored by this app; inputs are held in browser memory.

## Boundaries
This is intake and review, not a live import engine. It does not match existing records, independently verify private source links, apply changes, publish assets, reconcile competing team submissions or maintain an applied-batch history. No Apply endpoint exists, and no database migration is included.

AI responses are proposals, not verified facts. The validator flags missing context and excerpts absent from the provided transcript; semantic grounding still requires review. Exact duplicate suppression within one batch is not cross-batch or database deduplication.

The user can use Copy prompt + source text with their own AI app, then upload the resulting JSON, without connecting that AI app to the database or configuring the app's AI extraction.

## Preview-only AI route
`POST /api/updates/prepare` is allowed through the existing read-only review middleware but imports no database client and makes no database writes. It is disabled in production until a separate access/cost-control and approval flow is agreed. Vercel previews retain their existing protection; no team login or new production access policy is introduced.

The route uses the existing server-only `PERPLEXITY_API_KEY`; optional `OPS_IMPORT_MODEL` overrides the model. A missing key produces instructions for the external-AI prompt path, not fabricated results. Provider-level processing/retention is not controlled by clearing this page.

The request follows the documented [Perplexity Agent API](https://docs.perplexity.ai/api-reference/agent-post.md): explicit model, `tools: []`, `tool_choice: "none"`, non-streaming response, assistant output-text parsing. The existing marketing drafter is unchanged.

## Release requirements
Review this intake preview separately from calendar PR #10. Before enabling actual imports, agree the team-only approval mechanism, implement current-record matching and duplicate/conflict handling, and add transactional, retry-safe application with an audit trail and safe reversal. Those are separate from uploading files or parsing proposals.
