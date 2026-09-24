-- PROPOSED ONLY. Requires separate approval before applying.
-- No existing dates, statuses, rules, or templates are backfilled.
BEGIN;
ALTER TABLE public.project_tasks
  ADD COLUMN schedule_anchor text,
  ADD COLUMN schedule_offset_days integer,
  ADD CONSTRAINT project_tasks_schedule_rule_check CHECK (
    (schedule_anchor IS NULL AND schedule_offset_days IS NULL) OR
    (schedule_anchor IS NOT NULL AND schedule_anchor = 'fixed' AND schedule_offset_days IS NULL) OR
    (schedule_anchor IS NOT NULL AND schedule_anchor IN ('launch', 'start') AND schedule_offset_days IS NOT NULL
      AND schedule_offset_days BETWEEN -3650 AND 3650)
  );

CREATE FUNCTION public.save_project_schedule(
  p_project_id uuid, p_expected_project jsonb, p_expected_tasks jsonb,
  p_patch jsonb, p_changes jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_next public.projects%ROWTYPE;
  v_tasks jsonb;
  v_change jsonb;
  v_task public.project_tasks%ROWTYPE;
  v_count integer := 0;
  v_date date;
BEGIN
  SELECT * INTO STRICT v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  -- Lock the full task set. Concurrent edits or inserts conflict with the preview.
  PERFORM id FROM public.project_tasks WHERE project_id = p_project_id ORDER BY id FOR UPDATE;
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)
    INTO v_tasks FROM public.project_tasks t WHERE project_id = p_project_id;
  IF to_jsonb(v_project) IS DISTINCT FROM p_expected_project OR v_tasks IS DISTINCT FROM p_expected_tasks THEN
    RAISE EXCEPTION 'SCHEDULE_CONFLICT';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) k
    WHERE k NOT IN ('name','start_date','launch_date','workflow_type','revenue_goal','enrollment_goal')) THEN
    RAISE EXCEPTION 'Unsupported project field';
  END IF;
  v_next := jsonb_populate_record(v_project, p_patch);
  IF v_next.start_date IS NULL OR (v_next.launch_date IS NOT NULL AND v_next.launch_date > v_next.start_date) THEN
    RAISE EXCEPTION 'Invalid project dates';
  END IF;
  IF jsonb_typeof(p_changes) IS DISTINCT FROM 'array' OR
     (SELECT count(*) FROM jsonb_array_elements(p_changes)) <>
     (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_changes)) THEN
    RAISE EXCEPTION 'Invalid task changes';
  END IF;
  IF jsonb_array_length(p_changes) <> (SELECT count(*) FROM public.project_tasks WHERE project_id=p_project_id AND status <> 'done') THEN
    RAISE EXCEPTION 'Review every open task';
  END IF;
  FOR v_change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    SELECT * INTO v_task FROM public.project_tasks
      WHERE id = (v_change->>'id')::uuid AND project_id = p_project_id;
    IF NOT FOUND OR v_task.status = 'done' THEN RAISE EXCEPTION 'Task missing or completed'; END IF;
    IF v_change->>'schedule_anchor' = 'fixed' THEN
      IF (v_change->>'due_date')::date IS DISTINCT FROM v_task.due_date
        OR v_change->>'schedule_offset_days' IS NOT NULL THEN
        RAISE EXCEPTION 'Fixed dates must be preserved';
      END IF;
      v_date := v_task.due_date;
    ELSIF v_change->>'schedule_anchor' IN ('launch', 'start') THEN
      v_date := (CASE WHEN v_change->>'schedule_anchor' = 'launch'
        THEN v_next.launch_date ELSE v_next.start_date END)
        + (v_change->>'schedule_offset_days')::integer;
      IF v_date IS NULL OR v_date IS DISTINCT FROM (v_change->>'due_date')::date THEN
        RAISE EXCEPTION 'Task date does not match its anchor';
      END IF;
    ELSE RAISE EXCEPTION 'Invalid task anchor';
    END IF;
    UPDATE public.project_tasks SET due_date = v_date,
      schedule_anchor = v_change->>'schedule_anchor',
      schedule_offset_days = (v_change->>'schedule_offset_days')::integer
      WHERE id = v_task.id;
    IF v_date IS DISTINCT FROM v_task.due_date THEN v_count := v_count + 1; END IF;
  END LOOP;
  UPDATE public.projects SET name = v_next.name, start_date = v_next.start_date,
    launch_date = v_next.launch_date, workflow_type = v_next.workflow_type,
    revenue_goal = v_next.revenue_goal, enrollment_goal = v_next.enrollment_goal
    WHERE id = p_project_id RETURNING * INTO v_next;
  INSERT INTO public.activity_log (project_id, project_name, change_type, description, old_value, new_value)
    VALUES (p_project_id, v_next.name, 'schedule_changed',
      format('Reviewed project schedule: %s task deadlines changed', v_count),
      jsonb_build_object('start_date',v_project.start_date,'launch_date',v_project.launch_date,'tasks',v_tasks)::text,
      jsonb_build_object('start_date',v_next.start_date,'launch_date',v_next.launch_date,'rules',p_changes)::text);
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.phase_order,t.task_order,t.id), '[]'::jsonb)
    INTO v_tasks FROM public.project_tasks t WHERE project_id = p_project_id;
  RETURN jsonb_build_object('project',to_jsonb(v_next),'tasks',v_tasks,'rescheduled',v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.save_project_schedule(uuid,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_project_schedule(uuid,jsonb,jsonb,jsonb,jsonb) TO service_role;
COMMIT;
