-- ============================================================================
-- Migration: Vendors & Deliverables Tracker
-- Date: 2026-07-14
-- ADDITIVE ONLY. Creates three new tables; does not alter or drop anything.
-- ============================================================================

-- 1. VENDORS ---------------------------------------------------------------
-- A vendor or deliverable category (e.g. "Podcast", "Website Redesign", or an
-- actual outside vendor). Holds shared contact + an external folder link
-- (e.g. a OneDrive/Google Drive/Dropbox SHARE url where their source files live).
CREATE TABLE IF NOT EXISTS public.vendors (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  contact_name        text,
  contact_email       text,
  external_folder_url text,                       -- shared OneDrive/Drive/Dropbox link
  color               text DEFAULT '#647692',     -- accent chip color, like roles/team
  notes               text,
  sort_order          integer DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);

-- 2. VENDOR DELIVERABLES ---------------------------------------------------
-- One tracked deliverable. Mirrors the columns from the current Excel sheet
-- (deliverable, recurring, date assigned, concepts due, due date) and adds
-- status, comments, and an optional link to an existing project. project_id is
-- NULLABLE so deliverables can also be stand-alone (outside any project).
CREATE TABLE IF NOT EXISTS public.vendor_deliverables (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  project_id     uuid REFERENCES public.projects(id) ON DELETE SET NULL,  -- nullable: link OR stand-alone
  deliverable    text NOT NULL,
  recurring      boolean DEFAULT false,           -- the "Recurring y/n" column
  date_assigned  date,                            -- "Date Assigned to Vendor"
  concepts_due   date,                            -- "Concepts Due"
  due_date       date,                            -- "Due Date"
  status         text DEFAULT 'not_started'
                   CHECK (status = ANY (ARRAY[
                     'not_started','in_progress','in_review','approved','delivered'
                   ])),
  comments       text,                            -- running notes / back-and-forth
  external_link  text,                            -- e.g. draft/copy link like the sheet's "Copy Draft"
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_vendor  ON public.vendor_deliverables(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_deliverables_project ON public.vendor_deliverables(project_id);

-- 3. VENDOR ASSETS ---------------------------------------------------------
-- Graphics / documents. Either an uploaded file living in Supabase Storage
-- (bucket 'vendor-assets', object at storage_path) OR an external link.
-- Optionally tied to a specific deliverable; always tied to a vendor.
CREATE TABLE IF NOT EXISTS public.vendor_assets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  deliverable_id uuid REFERENCES public.vendor_deliverables(id) ON DELETE SET NULL,
  file_name      text NOT NULL,                   -- display name
  storage_path   text,                            -- object path in the 'vendor-assets' bucket (uploads)
  external_url   text,                            -- OR a pasted external link (Drive/OneDrive/Figma)
  file_type      text,                            -- mime or short label (image/pdf/link)
  file_size      bigint,                          -- bytes, when uploaded
  uploaded_by    text,                            -- free-text name (vendors aren't team_members)
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_assets_vendor      ON public.vendor_assets(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_assets_deliverable ON public.vendor_assets(deliverable_id);

-- 4. RLS -------------------------------------------------------------------
-- Match the rest of the schema: RLS enabled, deny-by-default for anon/public.
-- All app access goes through server routes using the service_role key, which
-- bypasses RLS (same pattern as every existing table here).
ALTER TABLE public.vendors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_assets       ENABLE ROW LEVEL SECURITY;
