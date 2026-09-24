-- Allow reversible archiving. No project or related record is changed.
BEGIN;
ALTER TABLE public.projects DROP CONSTRAINT projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'completed', 'paused', 'archived'));
COMMIT;
