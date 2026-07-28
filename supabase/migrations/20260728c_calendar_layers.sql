-- =====================================================================
-- Master calendar: two new layer tables. Additive-only.
--   1. seminars          — high-level "what's coming up" for booking around.
--                          Entered directly on the calendar.
--   2. marketing_content — scheduled content the Marketing page will own;
--                          the calendar READS this layer and links out to
--                          the (future) Marketing page. Created here so the
--                          calendar's Marketing layer has a real data source.
-- =====================================================================

CREATE TABLE IF NOT EXISTS seminars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,                         -- optional topic/label
  seminar_date date NOT NULL,         -- day it lands on the calendar
  start_time time,                    -- optional time of day
  client_name text,                   -- who it's for
  location text,                      -- venue or "virtual"
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seminars_date ON seminars(seminar_date);

CREATE TABLE IF NOT EXISTS marketing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scheduled_date date,                -- when it appears on the calendar
  -- channels stored as text[] so one item can post to several platforms
  channels text[] DEFAULT '{}',       -- e.g. {youtube,tiktok,instagram,linkedin}
  status text DEFAULT 'idea',         -- idea | drafted | scheduled | posted
  asset_link text,                    -- Google Drive / source asset URL
  caption text,
  owner_id uuid REFERENCES team_members(id),  -- who's posting
  project_id uuid REFERENCES projects(id),    -- optional link to a project
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_content_date ON marketing_content(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_marketing_content_status ON marketing_content(status);

-- =====================================================================
-- VERIFY after apply:
--   SELECT table_name FROM information_schema.tables
--     WHERE table_name IN ('seminars','marketing_content');   -- expect 2 rows
-- =====================================================================
