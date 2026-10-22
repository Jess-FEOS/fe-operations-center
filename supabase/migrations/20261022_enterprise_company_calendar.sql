-- PREVIEW ONLY: requires separate approval before production application.
-- Additive; no imports, backfills, policy changes or existing row deletions.
begin;
alter table public.projects add column if not exists is_enterprise boolean not null default false;
alter table public.projects add column if not exists enterprise_client_label text;
alter table public.projects add column if not exists enterprise_owner_id uuid references public.team_members(id) on delete set null;
alter table public.project_tasks add column if not exists company_calendar_kind text
  check (company_calendar_kind in ('deliverable','session'));
comment on column public.projects.is_enterprise is 'One project per client engagement/workstream; independent of workflow template.';
comment on column public.projects.enterprise_client_label is 'Approved display label only. Application currently has open access.';
comment on column public.project_tasks.company_calendar_kind is 'Explicit Company calendar opt-in. NULL hides ordinary operational work.';
commit;
