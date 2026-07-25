-- 20260722_roles_and_task_source.sql
-- Additive migration: role-based ownership + task source separation.
-- Reviewed with Jess BEFORE apply. No destructive changes.

-- 1. New vendor_roles for the functions that exist in workflow templates but
--    have no role yet. Designers + Editor already exist.
INSERT INTO vendor_roles (name, color, description, sort_order)
SELECT v.name, v.color, v.description, v.sort_order
FROM (VALUES
  ('Trainer',              '#1B365D', 'Instructors & lead trainers', 3),
  ('Marketing & Ops',      '#046A38', 'Marketing and operations coordination', 4),
  ('Operations & Finance', '#B29838', 'Operations and financial management', 5),
  ('Enterprise Lead',      '#C8350D', 'Enterprise & partnerships', 6)
) AS v(name, color, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM vendor_roles r WHERE r.name = v.name);

-- 2. Link the people who currently own template tasks to their new roles.
--    (Nick/RMY=Designers and Matty=Editor are already linked.)
UPDATE team_members SET vendor_role_id = (SELECT id FROM vendor_roles WHERE name='Trainer')
  WHERE name IN ('Brett Caughran') AND vendor_role_id IS NULL;
UPDATE team_members SET vendor_role_id = (SELECT id FROM vendor_roles WHERE name='Enterprise Lead')
  WHERE name IN ('Andrew Carr') AND vendor_role_id IS NULL;
UPDATE team_members SET vendor_role_id = (SELECT id FROM vendor_roles WHERE name='Marketing & Ops')
  WHERE name IN ('Jessica Corbin') AND vendor_role_id IS NULL;
UPDATE team_members SET vendor_role_id = (SELECT id FROM vendor_roles WHERE name='Operations & Finance')
  WHERE name IN ('Paul Teraberry') AND vendor_role_id IS NULL;

-- 3. Source separation on vendor_deliverables:
--    'manual'   = added by hand in the vendor workspace (default, current behavior)
--    'template' = generated from a project/workflow template
ALTER TABLE vendor_deliverables
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE vendor_deliverables DROP CONSTRAINT IF EXISTS vendor_deliverables_source_check;
ALTER TABLE vendor_deliverables
  ADD CONSTRAINT vendor_deliverables_source_check CHECK (source IN ('manual','template'));

-- 4. Role-based ownership on template_tasks. owner_ids (people) is kept for
--    backward compatibility; role_id becomes the source of truth going forward.
ALTER TABLE template_tasks
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES vendor_roles(id) ON DELETE SET NULL;

-- Backfill role_id from the first owner's role (best-effort; NULL if unmapped).
UPDATE template_tasks tt
SET role_id = tm.vendor_role_id
FROM team_members tm
WHERE tt.role_id IS NULL
  AND tt.owner_ids IS NOT NULL
  AND array_length(tt.owner_ids, 1) >= 1
  AND tm.id = tt.owner_ids[1]
  AND tm.vendor_role_id IS NOT NULL;

-- Same role-based ownership on project_tasks so generated tasks carry a role.
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES vendor_roles(id) ON DELETE SET NULL;
