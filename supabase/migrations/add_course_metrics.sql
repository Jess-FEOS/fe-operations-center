-- Add course_metrics table for tracking course launch performance
CREATE TABLE IF NOT EXISTS course_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  enrollment_count INT NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  email_open_rate NUMERIC(5,2),
  email_click_rate NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE course_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on course_metrics" ON course_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_course_metrics_project ON course_metrics(project_id);
