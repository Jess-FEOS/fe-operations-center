-- =====================================================================
-- Marketing strategy layer. Additive only — safe to run on the live DB.
--
--   1. marketing_programs — one row per program (project) holding its
--      marketing window: when marketing launches and when the program
--      starts. Strategy page groups assets by program and checks that
--      every asset lands inside this window.
--   2. marketing_content  — each row is a marketing ASSET. New columns
--      capture what the asset is, who it's for, and whether the copy and
--      creative are done. Readiness (red / amber / green) is derived from
--      these + status, so planned placeholders are visibly "not done".
-- =====================================================================

CREATE TABLE IF NOT EXISTS marketing_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  marketing_start date,          -- when marketing for this program launches
  program_start date,            -- when the program itself starts (end of the window)
  target_audience text,          -- default audience for this program's assets
  goal text,                     -- what marketing should achieve (e.g. 40 enrollments)
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Server routes use the service_role key (bypasses RLS). Deny-by-default for anon.
ALTER TABLE marketing_programs ENABLE ROW LEVEL SECURITY;

ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS asset_type text;          -- graphic | video | email | post | ad | blog | other
ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS copy_ready boolean DEFAULT false;
ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS creative_ready boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_marketing_content_project ON marketing_content(project_id);

-- =====================================================================
-- VERIFY after apply:
--   SELECT count(*) FROM marketing_programs;                          -- 0
--   SELECT copy_ready, creative_ready FROM marketing_content LIMIT 1; -- no error
-- =====================================================================
