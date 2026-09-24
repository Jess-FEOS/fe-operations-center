-- Additive link only. Does not alter task statuses, dates, RLS, or existing assets.
ALTER TABLE public.marketing_content
  ADD COLUMN IF NOT EXISTS source_task_id uuid
  REFERENCES public.project_tasks(id) ON DELETE SET NULL;

-- Multiple unlinked assets are allowed; converting a task twice is not.
CREATE UNIQUE INDEX IF NOT EXISTS marketing_content_source_task_unique
  ON public.marketing_content(source_task_id) WHERE source_task_id IS NOT NULL;
