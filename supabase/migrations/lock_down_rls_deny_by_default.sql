-- Migration: lock_down_rls_deny_by_default
--
-- Purpose: Close the security hole where the public/anon key had full
-- read/write access to every table. After this migration:
--   * RLS is ENABLED on all public tables (5 were previously unprotected).
--   * All permissive "USING (true) WITH CHECK (true)" allow-all policies are
--     DROPPED, leaving NO policies -> deny-by-default for anon/publishable keys.
--   * The server (service_role key) still has full access because service_role
--     BYPASSES RLS. All app DB access already goes through server /api routes.
--
-- Safe to re-run: enabling RLS is idempotent; DROP POLICY IF EXISTS is a no-op
-- when the policy is already gone.
--
-- Reversal: re-create the "Allow all" policies (see bottom of file, commented).

-- 1. Enable RLS on the five tables that had it disabled.
ALTER TABLE public.activity_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_links         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_checklist   ENABLE ROW LEVEL SECURITY;

-- Ensure RLS stays enabled on tables that already had it (idempotent).
ALTER TABLE public.campaigns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates     ENABLE ROW LEVEL SECURITY;

-- 2. Drop every known allow-all policy (names come from the live database).
DROP POLICY IF EXISTS "Allow all on campaigns"                    ON public.campaigns;
DROP POLICY IF EXISTS "Allow all on course_metrics"               ON public.course_metrics;
DROP POLICY IF EXISTS "Allow all on metrics"                      ON public.metrics;
DROP POLICY IF EXISTS "Allow all on project_tasks"                ON public.project_tasks;
DROP POLICY IF EXISTS "Allow all access to project_template_tasks" ON public.project_template_tasks;
DROP POLICY IF EXISTS "Allow all access to project_templates"     ON public.project_templates;
DROP POLICY IF EXISTS "Allow all on projects"                     ON public.projects;
DROP POLICY IF EXISTS "Allow all"                                 ON public.roles;
DROP POLICY IF EXISTS "Allow all on task_dependencies"            ON public.task_dependencies;
DROP POLICY IF EXISTS "Allow all on team_members"                 ON public.team_members;
DROP POLICY IF EXISTS "Allow all on template_tasks"               ON public.template_tasks;
DROP POLICY IF EXISTS "Allow all on workflow_templates"           ON public.workflow_templates;

-- The five newly-protected tables never had policies, but guard anyway in case
-- ad-hoc policies were added outside version control.
DROP POLICY IF EXISTS "Allow all on activity_log"       ON public.activity_log;
DROP POLICY IF EXISTS "Allow all on monthly_priorities" ON public.monthly_priorities;
DROP POLICY IF EXISTS "Allow all on task_comments"      ON public.task_comments;
DROP POLICY IF EXISTS "Allow all on task_links"         ON public.task_links;
DROP POLICY IF EXISTS "Allow all on weekly_checklist"   ON public.weekly_checklist;

-- Result: RLS enabled everywhere, zero policies -> anon/publishable keys get
-- no access. service_role (server) bypasses RLS and continues to work.

-- ---------------------------------------------------------------------------
-- REVERSAL (run manually only if you must restore open access):
--   CREATE POLICY "Allow all on <table>" ON public.<table>
--     FOR ALL USING (true) WITH CHECK (true);
-- ...for each table above.
-- ---------------------------------------------------------------------------
