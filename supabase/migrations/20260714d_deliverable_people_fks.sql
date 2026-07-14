-- ============================================================================
-- Migration: Point deliverable assignee/claim/approval at team_members;
--            add direct role tag on deliverables (manual override).
-- Date: 2026-07-14
-- ADDITIVE / CORRECTIVE. The columns added in 20260714c referenced vendors(id);
-- the actual PEOPLE live in team_members. These columns carry no data yet, so
-- we drop and re-add them pointed at team_members. Also adds role_id override.
-- ============================================================================

ALTER TABLE public.vendor_deliverables
  DROP COLUMN IF EXISTS assigned_vendor_id,
  DROP COLUMN IF EXISTS claimed_by_vendor_id,
  DROP COLUMN IF EXISTS approved_by_vendor_id;

ALTER TABLE public.vendor_deliverables
  ADD COLUMN IF NOT EXISTS assigned_to_id   uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_by_id    uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by_id   uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  -- Manual role override: routes a deliverable to a role section even when no
  -- person is assigned yet. When a person IS assigned, their role wins.
  ADD COLUMN IF NOT EXISTS role_id          uuid REFERENCES public.vendor_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_assigned_to ON public.vendor_deliverables(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_role        ON public.vendor_deliverables(role_id);
