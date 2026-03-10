import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET: Search/filter project tasks or template tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'active';
    const roleId = searchParams.get('role_id');
    const keyword = searchParams.get('keyword');

    // Reschedule mode: fetch tasks for a project with due_date + week_number
    if (mode === 'reschedule') {
      const projectId = searchParams.get('project_id');
      if (!projectId) {
        return NextResponse.json({ error: 'project_id required for reschedule mode' }, { status: 400 });
      }

      // Get project start_date
      const { data: project } = await supabase
        .from('projects')
        .select('id, name, start_date')
        .eq('id', projectId)
        .single();

      const { data: tasks, error } = await supabase
        .from('project_tasks')
        .select('id, task_name, due_date, week_number, status, phase_order, task_order')
        .eq('project_id', projectId)
        .order('phase_order', { ascending: true })
        .order('task_order', { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        project: project || null,
        tasks: tasks || [],
      });
    }

    if (mode === 'template') {
      const templateId = searchParams.get('template_id');

      let query = supabase
        .from('project_template_tasks')
        .select('id, title, template_id, owner, week_number, order_index, role_id')
        .order('order_index', { ascending: true });

      if (templateId) query = query.eq('template_id', templateId);
      if (roleId) query = query.eq('role_id', roleId);

      const { data: tasks, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      let filtered = tasks || [];
      if (keyword) {
        const kw = keyword.toLowerCase();
        filtered = filtered.filter((t: any) => t.title.toLowerCase().includes(kw));
      }

      // Fetch template names
      const templateIds = [...new Set(filtered.map((t: any) => t.template_id))];
      let templateMap: Record<string, string> = {};
      if (templateIds.length > 0) {
        const { data: templates } = await supabase
          .from('project_templates')
          .select('id, name')
          .in('id', templateIds);
        (templates || []).forEach((t: any) => { templateMap[t.id] = t.name; });
      }

      const enriched = filtered.map((t: any) => ({
        ...t,
        template_name: templateMap[t.template_id] || 'Unknown',
      }));

      return NextResponse.json(enriched);
    }

    // Active project tasks mode
    const projectId = searchParams.get('project_id');

    let query = supabase
      .from('project_tasks')
      .select('id, task_name, project_id, owner_ids, role_id, status')
      .order('task_order', { ascending: true });

    if (roleId) query = query.eq('role_id', roleId);
    if (projectId) query = query.eq('project_id', projectId);

    const { data: tasks, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let filtered = tasks || [];

    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = filtered.filter((t: any) => t.task_name.toLowerCase().includes(kw));
    }

    // Fetch project names for all matching tasks
    const projectIds = [...new Set(filtered.map((t: any) => t.project_id))];
    let projectMap: Record<string, string> = {};
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);
      (projects || []).forEach((p: any) => { projectMap[p.id] = p.name; });
    }

    const enriched = filtered.map((t: any) => ({
      ...t,
      project_name: projectMap[t.project_id] || 'Unknown',
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Bulk update tasks (active or template) or reschedule
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // --- Reschedule action ---
    if (body.action === 'reschedule') {
      const { updates } = body;
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: 'No reschedule updates provided' }, { status: 400 });
      }

      let updatedCount = 0;
      for (const item of updates) {
        const { task_id, new_due_date } = item;
        if (!task_id || !new_due_date) continue;
        const { error } = await supabase
          .from('project_tasks')
          .update({ due_date: new_due_date })
          .eq('id', task_id);
        if (!error) updatedCount++;
      }

      return NextResponse.json({ updated: updatedCount });
    }

    const { task_ids, role_id, owner_id, mode, sync_to_projects } = body;

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return NextResponse.json({ error: 'No task IDs provided' }, { status: 400 });
    }

    // Template mode
    if (mode === 'template') {
      if (role_id === undefined) {
        return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
      }

      if (!role_id) {
        return NextResponse.json({ error: 'Cannot remove role from template tasks.' }, { status: 400 });
      }

      const { error } = await supabase
        .from('project_template_tasks')
        .update({ role_id })
        .in('id', task_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      let syncedCount = 0;

      // Sync role changes to active project tasks using these templates
      if (sync_to_projects) {
        // Get the template tasks we just updated to find their titles and template_ids
        const { data: updatedTemplateTasks } = await supabase
          .from('project_template_tasks')
          .select('id, title, template_id')
          .in('id', task_ids);

        if (updatedTemplateTasks && updatedTemplateTasks.length > 0) {
          // Find template_ids involved
          const templateIds = [...new Set(updatedTemplateTasks.map(t => t.template_id))];

          // Find templates to get their types
          const { data: templates } = await supabase
            .from('project_templates')
            .select('id, type')
            .in('id', templateIds);

          const templateTypeMap: Record<string, string> = {};
          (templates || []).forEach((t: any) => { templateTypeMap[t.id] = t.type; });

          // For each template, find active projects using that workflow type
          for (const tmplId of templateIds) {
            const wfType = templateTypeMap[tmplId];
            if (!wfType) continue;

            const { data: projects } = await supabase
              .from('projects')
              .select('id')
              .eq('workflow_type', wfType)
              .eq('status', 'active');

            if (!projects || projects.length === 0) continue;

            const projectIds = projects.map(p => p.id);

            // Get the task titles from this template that were updated
            const taskTitles = updatedTemplateTasks
              .filter(t => t.template_id === tmplId)
              .map(t => t.title);

            // Update matching project tasks by task_name
            for (const title of taskTitles) {
              const { data: matched } = await supabase
                .from('project_tasks')
                .select('id')
                .in('project_id', projectIds)
                .eq('task_name', title);

              if (matched && matched.length > 0) {
                const matchedIds = matched.map(m => m.id);
                await supabase
                  .from('project_tasks')
                  .update({ role_id })
                  .in('id', matchedIds);
                syncedCount += matched.length;
              }
            }
          }
        }
      }

      return NextResponse.json({ updated: task_ids.length, synced: syncedCount });
    }

    // Active project tasks mode
    if (role_id === undefined && owner_id === undefined) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    let updatedCount = 0;

    if (role_id !== undefined) {
      if (!role_id) {
        return NextResponse.json({ error: 'Cannot remove role from tasks. Every task must have a role.' }, { status: 400 });
      }
      const { error } = await supabase
        .from('project_tasks')
        .update({ role_id })
        .in('id', task_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedCount = task_ids.length;
    }

    if (owner_id !== undefined) {
      const newOwnerIds = owner_id ? [owner_id] : [];
      const { error } = await supabase
        .from('project_tasks')
        .update({ owner_ids: newOwnerIds })
        .in('id', task_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedCount = task_ids.length;
    }

    return NextResponse.json({ updated: updatedCount });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
