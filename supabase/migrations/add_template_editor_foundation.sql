-- ============================================================================
-- Template Editor — Foundation Migration
-- ----------------------------------------------------------------------------
-- Purpose: Add the structural "homes" for fields the full template editor will
--          edit, and backfill them from existing data so current behavior is
--          preserved exactly.
--
-- Scope:   ADDITIVE ONLY. No columns are dropped or renamed. The old system
--          (workflow_templates / template_tasks) is intentionally untouched.
--
-- Safety:  Every column add uses IF NOT EXISTS. Every backfill only writes to
--          rows where the new column IS NULL, so the migration is safe to
--          re-run and will never clobber values set by the editor later.
-- ============================================================================


-- ============================================================================
-- 1. project_template_tasks.phase  +  phase_order
-- ----------------------------------------------------------------------------
-- Today the "phase" of a template task is DERIVED at runtime from week_number
-- via the WEEK_PHASES map in the API. This gives it a persisted home so the
-- editor can edit phase directly. We backfill from the exact same derivation
-- so existing rows keep the phase they currently display.
-- ============================================================================

ALTER TABLE project_template_tasks
  ADD COLUMN IF NOT EXISTS phase TEXT;

ALTER TABLE project_template_tasks
  ADD COLUMN IF NOT EXISTS phase_order INT;

-- Backfill `phase` from week_number using the SAME mapping as WEEK_PHASES in
-- src/app/api/project-templates/route.ts. Weeks not in the map fall back to
-- "Week N" (identical to the `WEEK_PHASES[week] || `Week ${week}`` behavior).
UPDATE project_template_tasks
SET phase = CASE week_number
    WHEN 8  THEN 'Planning'
    WHEN 6  THEN 'Setup'
    WHEN 4  THEN 'Build'
    WHEN 3  THEN 'Marketing Launch'
    WHEN 2  THEN 'Pre-Launch'
    WHEN 1  THEN 'Delivery Prep'
    WHEN 0  THEN 'Launch'
    WHEN -1 THEN 'Wrap Up'
    ELSE 'Week ' || week_number::text
  END
WHERE phase IS NULL;

-- Backfill `phase_order`. The creation flow computes this per-template as:
-- distinct week_numbers, sorted descending, numbered 1..N (highest week = 1).
-- dense_rank() over week_number DESC reproduces that exactly.
UPDATE project_template_tasks t
SET phase_order = ranked.rnk
FROM (
  SELECT id,
         dense_rank() OVER (
           PARTITION BY template_id
           ORDER BY week_number DESC
         ) AS rnk
  FROM project_template_tasks
) ranked
WHERE t.id = ranked.id
  AND t.phase_order IS NULL;


-- ============================================================================
-- 2. project_template_tasks.role_id  (owner-by-role)
-- ----------------------------------------------------------------------------
-- Owner is currently free text (e.g. "Jess", "Jess + Paul"). This adds a real
-- role reference. The original `owner` text column is KEPT INTACT (not dropped)
-- for migration safety and so nothing currently relying on it breaks.
--
-- Backfill resolves owner text -> role_id using the SAME matching the creation
-- flow uses (resolveRoleId): split on "+", lowercase/trim each part, match a
-- team_member by first-name OR full-name, and take the FIRST part that resolves
-- to a NON-NULL role_id.
-- ============================================================================

ALTER TABLE project_template_tasks
  ADD COLUMN IF NOT EXISTS role_id UUID;

-- Add the foreign key to roles only if it isn't already present (so re-running
-- doesn't error). ON DELETE SET NULL: deleting a role nulls the reference
-- rather than blocking the delete.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_template_tasks_role_id_fkey'
  ) THEN
    ALTER TABLE project_template_tasks
      ADD CONSTRAINT project_template_tasks_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Backfill role_id. For each task, expand the owner string into its "+"-parts
-- preserving order, join each part to a team member (by first name or full
-- name, case-insensitive), keep only parts that resolve to a non-null role_id,
-- and pick the FIRST such part (lowest ordinal) — mirroring resolveRoleId().
UPDATE project_template_tasks t
SET role_id = sub.role_id
FROM (
  SELECT DISTINCT ON (tt.id)
         tt.id AS task_id,
         tm.role_id
  FROM project_template_tasks tt
  CROSS JOIN LATERAL unnest(string_to_array(tt.owner, '+'))
                     WITH ORDINALITY AS parts(part, ord)
  JOIN team_members tm
    ON lower(btrim(parts.part)) = lower(tm.name)
    OR lower(btrim(parts.part)) = lower(split_part(tm.name, ' ', 1))
  WHERE tm.role_id IS NOT NULL
  ORDER BY tt.id, parts.ord, tm.id   -- ord => first owner part; tm.id => stable tiebreak
) sub
WHERE t.id = sub.task_id
  AND t.role_id IS NULL;

-- Index to keep role-based lookups fast (matches existing idx_* conventions).
CREATE INDEX IF NOT EXISTS idx_project_template_tasks_role
  ON project_template_tasks(role_id);


-- ============================================================================
-- 3. project_templates.length_weeks  (editable project length)
-- ----------------------------------------------------------------------------
-- Project length is currently implicit in the spread of task week_numbers.
-- This gives it an explicit, editable home. Backfill stores each template's
-- MAX(week_number): how many weeks before launch the template's earliest task
-- begins (the highest week_number is the earliest-starting task).
-- e.g. a template with tasks at weeks 6..-1 backfills to 6.
-- ============================================================================

ALTER TABLE project_templates
  ADD COLUMN IF NOT EXISTS length_weeks INT;

UPDATE project_templates pt
SET length_weeks = spans.length_weeks
FROM (
  SELECT template_id,
         MAX(week_number) AS length_weeks
  FROM project_template_tasks
  GROUP BY template_id
) spans
WHERE pt.id = spans.template_id
  AND pt.length_weeks IS NULL;

-- (Templates with zero tasks are left as NULL — there is no span to derive.)
