-- Migration: Add campaigns, metrics tables and interconnect existing tables
-- Run this in Supabase SQL Editor
-- This migration only ADDS new columns and tables — no existing data is modified

-- ============================================================
-- 1. Add columns to monthly_priorities
-- ============================================================
ALTER TABLE monthly_priorities
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_metric TEXT,
  ADD COLUMN IF NOT EXISTS actual_metric NUMERIC;

-- Index for looking up priorities by project
CREATE INDEX IF NOT EXISTS idx_monthly_priorities_project ON monthly_priorities(project_id);

-- ============================================================
-- 2. Add columns to projects
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS priority_id UUID REFERENCES monthly_priorities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS launch_date DATE,
  ADD COLUMN IF NOT EXISTS revenue_goal NUMERIC,
  ADD COLUMN IF NOT EXISTS enrollment_goal INTEGER;

-- Index for looking up projects by priority
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority_id);

-- ============================================================
-- 3. Create campaigns table
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  priority_id UUID REFERENCES monthly_priorities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  campaign_type TEXT CHECK (campaign_type IN ('email', 'social', 'paid_ads', 'content', 'launch_push', 'evergreen')),
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done', 'paused')),
  launch_date DATE,
  goal_description TEXT,
  goal_metric TEXT,
  actual_metric NUMERIC,
  notes TEXT,
  owner_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS with permissive policy (matches existing pattern)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on campaigns" ON campaigns FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_project ON campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_priority ON campaigns(priority_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ============================================================
-- 4. Create metrics table
-- ============================================================
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  priority_id UUID REFERENCES monthly_priorities(id) ON DELETE SET NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS with permissive policy
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on metrics" ON metrics FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_metrics_project ON metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_metrics_campaign ON metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_metrics_priority ON metrics(priority_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics(metric_date);

-- ============================================================
-- 5. Add columns to project_tasks
-- ============================================================
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'operational' CHECK (task_type IN ('operational', 'marketing', 'content', 'admin')),
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

-- Index for looking up tasks by campaign
CREATE INDEX IF NOT EXISTS idx_project_tasks_campaign ON project_tasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_type ON project_tasks(task_type);
