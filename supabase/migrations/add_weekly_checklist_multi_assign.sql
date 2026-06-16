-- Weekly Checklist — multi-assignee
-- Additive: adds assigned_to_ids array and backfills from the single
-- assigned_to. The old assigned_to column is intentionally KEPT (not dropped)
-- for safety; the app switches to assigned_to_ids and a later cleanup
-- migration can drop assigned_to once nothing reads it.

ALTER TABLE weekly_checklist
  ADD COLUMN IF NOT EXISTS assigned_to_ids uuid[] NOT NULL DEFAULT '{}';

-- Backfill: existing single assignee becomes a one-element array.
-- Re-runnable: only touches rows still at the default empty array.
UPDATE weekly_checklist
SET assigned_to_ids = ARRAY[assigned_to]
WHERE assigned_to IS NOT NULL
  AND assigned_to_ids = '{}';
