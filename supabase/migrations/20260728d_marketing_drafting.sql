-- Marketing content pipeline: add drafting-workflow columns.
-- Additive only. Supports the "Ready to write" stage + FE-voice auto-draft.

-- Source material the FE-voice drafter reads (clip or episode transcript).
ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS transcript text;

-- Which FE skill to run: 'clip' (podcast-clip-writer) or 'episode' (podcast-content-writer).
ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS content_kind text DEFAULT 'clip';

-- Generated hashtags line, kept separate from caption/description.
ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS hashtags text;

-- Optional link to the source video (Drive link in Phase 2; manual for now).
ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS video_link text;

-- Allow the new 'ready' status (Ready to write). Existing statuses stay valid.
-- status is a free-text column with a default of 'idea'; no CHECK constraint to alter.
