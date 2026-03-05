-- Add task_links table
CREATE TABLE IF NOT EXISTS task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on task_links" ON task_links FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_task_links_task ON task_links(task_id);
