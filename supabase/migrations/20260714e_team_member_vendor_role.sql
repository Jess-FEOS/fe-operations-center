-- ============================================================================
-- Migration: Link team members to a vendor role (Designers / Editor).
-- Date: 2026-07-14
-- ADDITIVE. Adds a nullable vendor_role_id to team_members. This is SEPARATE
-- from the existing role_id (which drives the Team page). vendor_role_id says
-- which Vendors-workspace section (Designers/Editor) the person belongs to.
-- ============================================================================

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS vendor_role_id uuid REFERENCES public.vendor_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_vendor_role ON public.team_members(vendor_role_id);
