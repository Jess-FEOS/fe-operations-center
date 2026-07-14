-- Deliverable workflow: "Ready" signal + per-status timestamps + hidden activity log.
-- Additive only. Safe to re-run (IF NOT EXISTS / IF EXISTS guards).

-- 1. Designer "Ready for review" signal (who + when).
ALTER TABLE vendor_deliverables
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_by_id uuid REFERENCES team_members(id) ON DELETE SET NULL;

-- 2. "Request changes" tracking (who + when) — mirrors approved_by/approved_at.
ALTER TABLE vendor_deliverables
  ADD COLUMN IF NOT EXISTS changes_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS changes_requested_by_id uuid REFERENCES team_members(id) ON DELETE SET NULL;

-- 3. Extend review_state to allow the new 'ready' state alongside existing values.
--    (existing CHECK allowed pending/approved/changes_requested)
ALTER TABLE vendor_deliverables DROP CONSTRAINT IF EXISTS vendor_deliverables_review_state_check;
ALTER TABLE vendor_deliverables
  ADD CONSTRAINT vendor_deliverables_review_state_check
  CHECK (review_state IN ('pending', 'ready', 'approved', 'changes_requested'));

-- 4. Hidden full activity log — one row per action, always recorded, shown on demand.
CREATE TABLE IF NOT EXISTS vendor_deliverable_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES vendor_deliverables(id) ON DELETE CASCADE,
  action text NOT NULL,               -- 'ready' | 'approved' | 'changes_requested' | 'completed' | 'assigned' | 'version_uploaded' | 'edited'
  actor_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  actor_name text,                    -- denormalized snapshot so the log survives member changes
  detail text,                        -- optional free text (e.g. "assigned to Matty", "v3 uploaded")
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_activity_deliverable
  ON vendor_deliverable_activity(deliverable_id, created_at DESC);
