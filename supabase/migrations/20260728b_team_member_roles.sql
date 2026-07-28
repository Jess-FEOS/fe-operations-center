-- =====================================================================
-- Phase 1b: Allow a person to hold MULTIPLE roles (join table).
-- Additive-only. Keeps team_members.vendor_role_id as the "primary" role
-- for back-compat; the join table is the source of truth for cascades.
-- =====================================================================

CREATE TABLE IF NOT EXISTS team_member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  vendor_role_id uuid NOT NULL REFERENCES vendor_roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_member_id, vendor_role_id)
);

CREATE INDEX IF NOT EXISTS idx_tmr_member ON team_member_roles(team_member_id);
CREATE INDEX IF NOT EXISTS idx_tmr_role   ON team_member_roles(vendor_role_id);

-- Seed the join table from each member's current single vendor_role_id
-- so nobody loses their existing role. Idempotent via ON CONFLICT.
INSERT INTO team_member_roles (team_member_id, vendor_role_id)
SELECT id, vendor_role_id
FROM team_members
WHERE vendor_role_id IS NOT NULL
ON CONFLICT (team_member_id, vendor_role_id) DO NOTHING;

-- =====================================================================
-- VERIFY after apply:
--   SELECT tm.name, vr.name FROM team_member_roles tmr
--     JOIN team_members tm ON tm.id=tmr.team_member_id
--     JOIN vendor_roles vr ON vr.id=tmr.vendor_role_id
--     ORDER BY tm.name;
--   -- expect 7 rows, one per person (their current role)
-- =====================================================================
