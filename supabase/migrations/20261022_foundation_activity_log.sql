-- Production compatibility repair: activity_log.project_name is required.
-- Preserve the original migration history and replace only the creation RPC.
begin;
create or replace function public.create_project_from_review(
  p_project jsonb, p_tasks jsonb, p_source jsonb, p_request_id uuid, p_review_hash text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_project public.projects;
  v_task jsonb;
  v_priority uuid;
  v_steps jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_project from public.projects where creation_key = p_request_id;
  if found then
    if v_project.creation_hash is distinct from p_review_hash then raise exception 'Request ID already used for different content'; end if;
    return to_jsonb(v_project);
  end if;
  if jsonb_typeof(p_tasks) <> 'array' or length(trim(p_project->>'name')) = 0 then
    raise exception 'Invalid project/checklist';
  end if;
  if (p_project->>'launch_date')::date > (p_project->>'start_date')::date then raise exception 'Invalid launch date'; end if;
  if p_source->>'kind' not in ('project','template') then raise exception 'Invalid source'; end if;
  if p_source->>'kind' = 'template' then
    perform 1 from public.project_templates where id=(p_source->>'id')::uuid for share;
    if not found then raise exception 'Source template no longer exists'; end if;
    perform 1 from public.project_template_tasks where template_id=(p_source->>'id')::uuid for share;
    select coalesce(jsonb_agg(to_jsonb(t) order by t.order_index,t.id),'[]'::jsonb) into v_steps
      from public.project_template_tasks t where template_id=(p_source->>'id')::uuid;
  else
    perform 1 from public.projects where id=(p_source->>'id')::uuid for share;
    if not found then raise exception 'Source project no longer exists'; end if;
    perform 1 from public.project_tasks where project_id=(p_source->>'id')::uuid for share;
    select coalesce(jsonb_agg(to_jsonb(t) order by t.phase_order,t.task_order,t.id),'[]'::jsonb) into v_steps
      from public.project_tasks t where project_id=(p_source->>'id')::uuid;
  end if;
  if v_steps is distinct from p_source->'steps' then raise exception 'Source changed; review again'; end if;
  v_priority := (p_project->>'priority_id')::uuid;
  insert into public.projects(name,workflow_type,workflow_template_id,start_date,launch_date,current_week,status,
    priority_id,revenue_goal,enrollment_goal,source_template_id,source_project_id,template_snapshot,creation_key,creation_hash)
  values (p_project->>'name',p_project->>'workflow_type',(p_project->>'workflow_template_id')::uuid,
    (p_project->>'start_date')::date,(p_project->>'launch_date')::date,1,'active',v_priority,
    (p_project->>'revenue_goal')::numeric,(p_project->>'enrollment_goal')::integer,
    case when p_source->>'kind'='template' then (p_source->>'id')::uuid end,
    case when p_source->>'kind'='project' then (p_source->>'id')::uuid end,p_source,p_request_id,p_review_hash)
  returning * into v_project;
  for v_task in select value from jsonb_array_elements(p_tasks) loop
    if jsonb_array_length(v_task->'owner_ids') <> 1 or jsonb_array_length(v_task->'issues') <> 0 then
      raise exception 'Every commitment requires one reviewed owner and valid dates';
    end if;
    perform 1 from public.team_members where id=(v_task->'owner_ids'->>0)::uuid;
    if not found then raise exception 'Owner no longer exists'; end if;
    insert into public.project_tasks(project_id,phase,phase_order,task_name,task_order,due_date,week_number,
      status,owner_ids,role_id,vendor_role_id,schedule_anchor,schedule_offset_days)
    values(v_project.id,v_task->>'phase',(v_task->>'phase_order')::integer,v_task->>'task_name',
      (v_task->>'task_order')::integer,(v_task->>'due_date')::date,(v_task->>'week_number')::integer,
      'not_started',array[(v_task->'owner_ids'->>0)::uuid],(v_task->>'role_id')::uuid,
      (v_task->>'vendor_role_id')::uuid,v_task->>'schedule_anchor',(v_task->>'schedule_offset_days')::integer);
  end loop;
  if v_priority is not null then
    update public.monthly_priorities set project_id=v_project.id where id=v_priority and project_id is null;
    if not found then raise exception 'Priority already linked or unavailable'; end if;
  end if;
  insert into public.activity_log(project_id,project_name,change_type,description)
    values(v_project.id,v_project.name,'project_created','Created from reviewed ' || (p_source->>'kind') || ' checklist');
  return to_jsonb(v_project);
end;
$$;
revoke all on function public.create_project_from_review(jsonb,jsonb,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.create_project_from_review(jsonb,jsonb,jsonb,uuid,text) to service_role;
commit;
