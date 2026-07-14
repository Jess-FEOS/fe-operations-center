-- ============================================================================
-- Migration: Vendor Asset Library — archiving, versioning, designer notes
-- Date: 2026-07-14
-- ADDITIVE ONLY. Adds nullable columns to existing tables; no drops, no alters
-- of existing columns, no data changes. Safe to re-run (IF NOT EXISTS guards).
-- ============================================================================

-- 1. ARCHIVE support on deliverables --------------------------------------
-- Manual archive: completed / retired deliverables are hidden from the main
-- view but remain one click away and fully searchable in the Asset Library.
ALTER TABLE public.vendor_deliverables
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2. ARCHIVE + VERSIONING + NOTES on assets -------------------------------
-- version     : iteration number for the same logical asset (v1, v2, v3 ...)
-- is_current  : exactly one row per (deliverable/label) marked as the current
--               version — that's what the library surfaces by default.
-- notes       : designer / reviewer notes that travel with the asset.
-- project_id  : direct optional project link, so vendor-level assets (not tied
--               to a deliverable) are still findable by project in the library.
ALTER TABLE public.vendor_assets
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS version     integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes       text,
  ADD COLUMN IF NOT EXISTS project_id  uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- 3. Indexes for the library's search / filter paths ----------------------
CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_archived ON public.vendor_deliverables(is_archived);
CREATE INDEX IF NOT EXISTS idx_vendor_assets_archived       ON public.vendor_assets(is_archived);
CREATE INDEX IF NOT EXISTS idx_vendor_assets_current        ON public.vendor_assets(is_current);
CREATE INDEX IF NOT EXISTS idx_vendor_assets_project        ON public.vendor_assets(project_id);
