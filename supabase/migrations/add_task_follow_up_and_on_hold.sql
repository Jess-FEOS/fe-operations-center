-- Add on_hold flag and follow_up_date to project_tasks
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS on_hold BOOLEAN DEFAULT false;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS follow_up_date DATE;
