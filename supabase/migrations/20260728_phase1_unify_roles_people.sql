-- =====================================================================
-- Phase 1: Unify role systems + wire project<->people/role assignment
-- Additive-only (renames + 1 insert + backfills). No drops.
-- Safe to run on live DB with active Supabase backups.
-- =====================================================================
-- GOAL (Jess priority #1): ONE role system (vendor_roles). A project's work
-- is owned by a ROLE, filled by the PERSON in that role. Change the person
-- on the Team page -> everything owned by that role reassigns automatically.
--
-- Locked decisions (Jess, 2026-07-28):
--   * vendor_roles is the surviving role system. `roles` retired (kept, not
--     dropped this phase for data safety).
--   * Final 7 roles: Designers, Editor, Founder & Trainer,
--     Marketing & Operations, Operations & Finance, Enterprise Lead,
--     Brand Strategist (NEW).
--   * Role holders: RMY=Designers, Matty=Editor, Brett=Founder & Trainer,
--     Jessica=Marketing & Operations, Paul=Operations & Finance,
--     Andrew=Enterprise Lead, Nick North=Brand Strategist.
--   * Old project_task role crosswalk (138 tasks):
--       Marketing Director (57)   -> Marketing & Operations
--       Founder & Instructor (36) -> Founder & Trainer
--       Operations Director (36)  -> Operations & Finance
--       Creative Director (9)     -> Brand Strategist   (Nick's function)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rename two existing vendor_roles to Jess's preferred names.
-- ---------------------------------------------------------------------
UPDATE vendor_roles SET name = 'Founder & Trainer'
  WHERE id = 'd6c67ea7-257f-4b9b-ac70-b0b8d78dec2b';       -- was "Trainer"
UPDATE vendor_roles SET name = 'Marketing & Operations'
  WHERE id = 'd1a2d211-154a-49c4-9904-00046041635c';       -- was "Marketing & Ops"

-- ---------------------------------------------------------------------
-- 2. Add the NEW Brand Strategist role (Nick North). Idempotent by name.
--    Color = FE navy #1B365D-adjacent; slot after Designers (sort 1.5 -> 7).
-- ---------------------------------------------------------------------
INSERT INTO vendor_roles (name, color, description, sort_order)
SELECT 'Brand Strategist', '#C8350D', 'Brand strategy & creative direction', 7
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_roles WHERE lower(trim(name)) = 'brand strategist'
);

-- ---------------------------------------------------------------------
-- 3. Move Nick North onto Brand Strategist (he was on Designers).
--    RMY stays on Designers.
-- ---------------------------------------------------------------------
UPDATE team_members
SET vendor_role_id = (SELECT id FROM vendor_roles WHERE lower(trim(name))='brand strategist')
WHERE id = 'a1000000-0000-0000-0000-000000000005';        -- Nick North

-- ---------------------------------------------------------------------
-- 4. Put project_tasks on the SAME role system as vendor_deliverables.
--    Add vendor_role_id -> vendor_roles (additive; old role_id kept).
-- ---------------------------------------------------------------------
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS vendor_role_id uuid REFERENCES vendor_roles(id);

-- Backfill via the explicit crosswalk (old roles.name -> vendor_roles.name).
UPDATE project_tasks pt
SET vendor_role_id = vr.id
FROM roles r
JOIN (VALUES
  ('Marketing Director',   'Marketing & Operations'),
  ('Founder & Instructor', 'Founder & Trainer'),
  ('Operations Director',  'Operations & Finance'),
  ('Creative Director',    'Brand Strategist')
) AS xwalk(old_name, new_name)
  ON lower(trim(r.name)) = lower(trim(xwalk.old_name))
JOIN vendor_roles vr
  ON lower(trim(vr.name)) = lower(trim(xwalk.new_name))
WHERE pt.role_id = r.id
  AND pt.vendor_role_id IS NULL;

-- ---------------------------------------------------------------------
-- 5. Indexes for the reverse "who holds this role" lookup + project join.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_team_members_vendor_role_id
  ON team_members(vendor_role_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_vendor_role_id
  ON project_tasks(vendor_role_id);
CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_role_id
  ON vendor_deliverables(role_id);
CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_project_id
  ON vendor_deliverables(project_id);

-- =====================================================================
-- VERIFY after apply:
--   SELECT vr.name, count(pt.*) FROM project_tasks pt
--     JOIN vendor_roles vr ON pt.vendor_role_id=vr.id
--     GROUP BY vr.name ORDER BY 2 DESC;
--   -- expect: Marketing & Operations 57, Founder & Trainer 36,
--   --         Operations & Finance 36, Brand Strategist 9  (total 138)
--   SELECT tm.name, vr.name FROM team_members tm
--     JOIN vendor_roles vr ON tm.vendor_role_id=vr.id ORDER BY tm.name;
--   SELECT count(*) FROM project_tasks WHERE vendor_role_id IS NULL; -- expect 0
-- =====================================================================
