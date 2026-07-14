-- ============================================================================
-- Migration: Vendor Roles + Deliverable Assignment / Claim / Approval
-- Date: 2026-07-14
-- ADDITIVE ONLY. Creates one new table and adds nullable columns. Nothing is
-- altered or dropped. Safe to run once; guarded with IF NOT EXISTS.
-- ============================================================================

-- 1. VENDOR ROLES ----------------------------------------------------------
-- A role/section on the Vendors landing page (e.g. "Designers", "Editor").
-- Vendors (people) belong to a role; the landing page shows one card per role.
CREATE TABLE IF NOT EXISTS public.vendor_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  color       text DEFAULT '#647692',   -- accent chip color for the role card
  description text,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.vendor_roles ENABLE ROW LEVEL SECURITY;

-- 2. VENDORS: attach to a role --------------------------------------------
-- role_id is NULLABLE so existing vendors keep working (they simply show under
-- an "Unassigned" bucket until given a role).
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.vendor_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_role ON public.vendors(role_id);

-- 3. VENDOR DELIVERABLES: assignment, claim, approval ----------------------
-- All nullable / defaulted so existing rows are unaffected.
ALTER TABLE public.vendor_deliverables
  ADD COLUMN IF NOT EXISTS assigned_vendor_id    uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_by_vendor_id  uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at            timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at           timestamptz,
  ADD COLUMN IF NOT EXISTS review_state          text DEFAULT 'pending'
                             CHECK (review_state = ANY (ARRAY[
                               'pending','approved','changes_requested'
                             ]));

CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_assigned ON public.vendor_deliverables(assigned_vendor_id);
