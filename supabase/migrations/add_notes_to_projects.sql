-- Add notes column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes TEXT;
