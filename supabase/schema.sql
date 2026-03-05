-- Fundamental Edge Operations Center - Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Team Members
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  initials TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workflow Templates (Course Launch, Podcast, Newsletter, Subscription)
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL,
  total_weeks INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Template Tasks (SOP steps for each workflow)
CREATE TABLE template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  phase_order INT NOT NULL,
  task_name TEXT NOT NULL,
  task_order INT NOT NULL,
  week_offset INT NOT NULL, -- weeks from start (0 = first week)
  owner_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects (instantiated workflows)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  workflow_template_id UUID REFERENCES workflow_templates(id),
  workflow_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  current_week INT DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Project Tasks (generated from template_tasks)
CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  phase_order INT NOT NULL,
  task_name TEXT NOT NULL,
  task_order INT NOT NULL,
  due_date DATE NOT NULL,
  week_number INT NOT NULL,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done', 'blocked')),
  owner_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task Comments
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task Links
CREATE TABLE task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task Dependencies
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id)
);

-- Course Metrics (performance tracking for course launches)
CREATE TABLE course_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  enrollment_count INT NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  email_open_rate NUMERIC(5,2),
  email_click_rate NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (open for now - add auth policies as needed)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- Permissive policies for internal app (no auth required)
CREATE POLICY "Allow all on team_members" ON team_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on workflow_templates" ON workflow_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on template_tasks" ON template_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on project_tasks" ON project_tasks FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on task_comments" ON task_comments FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on task_links" ON task_links FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on task_dependencies" ON task_dependencies FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE course_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on course_metrics" ON course_metrics FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);
CREATE INDEX idx_project_tasks_due_date ON project_tasks(due_date);
CREATE INDEX idx_template_tasks_workflow ON template_tasks(workflow_template_id);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_links_task ON task_links(task_id);
CREATE INDEX idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends ON task_dependencies(depends_on_task_id);
CREATE INDEX idx_course_metrics_project ON course_metrics(project_id);
