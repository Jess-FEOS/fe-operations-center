import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSimplifiedPhase } from '@/lib/phases';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*, monthly_priorities!projects_priority_id_fkey(title, status)')
      .eq('status', 'active');

    if (projectsError) {
      return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }

    const projectsWithProgress = await Promise.all(
      (projects || []).map(async (project: any) => {
        const { data: tasks, error: tasksError } = await supabase
          .from('project_tasks')
          .select('status, phase')
          .eq('project_id', project.id);

        if (tasksError) {
          return {
            ...project,
            priority_title: project.monthly_priorities?.title || null,
            priority_status: project.monthly_priorities?.status || null,
            monthly_priorities: undefined,
            progress: 0,
            total_tasks: 0,
            done_tasks: 0,
            phase_breakdown: { Build: { total: 0, done: 0 }, Market: { total: 0, done: 0 }, 'Launch & Run': { total: 0, done: 0 } },
          };
        }

        const totalCount = tasks?.length || 0;
        const doneCount = tasks?.filter((t) => t.status === 'done').length || 0;
        const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

        // Compute phase breakdown using simplified phases
        const phase_breakdown: Record<string, { total: number; done: number }> = {
          Build: { total: 0, done: 0 },
          Market: { total: 0, done: 0 },
          'Launch & Run': { total: 0, done: 0 },
        };
        for (const t of tasks || []) {
          const sp = getSimplifiedPhase(t.phase);
          phase_breakdown[sp].total++;
          if (t.status === 'done') phase_breakdown[sp].done++;
        }

        return {
          ...project,
          priority_title: project.monthly_priorities?.title || null,
          priority_status: project.monthly_priorities?.status || null,
          monthly_priorities: undefined,
          progress,
          total_tasks: totalCount,
          done_tasks: doneCount,
          phase_breakdown,
        };
      })
    );

    return NextResponse.json(projectsWithProgress);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, workflow_type, start_date, workflow_template_id, priority_id, launch_date, revenue_goal, enrollment_goal } = body;

    if (!name || !workflow_type || !start_date || !workflow_template_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, workflow_type, start_date, workflow_template_id' },
        { status: 400 }
      );
    }

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name,
        workflow_type,
        start_date,
        workflow_template_id,
        current_week: 1,
        status: 'active',
        priority_id: priority_id || null,
        launch_date: launch_date || null,
        revenue_goal: revenue_goal || null,
        enrollment_goal: enrollment_goal || null,
      })
      .select()
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    // Two-way link: update the priority's project_id if priority_id was provided
    if (priority_id) {
      await supabase
        .from('monthly_priorities')
        .update({ project_id: project.id })
        .eq('id', priority_id);
    }

    // Fetch template tasks for this workflow template
    const { data: templateTasks, error: templateError } = await supabase
      .from('template_tasks')
      .select('*')
      .eq('workflow_template_id', workflow_template_id);

    if (templateError) {
      return NextResponse.json({ error: templateError.message }, { status: 500 });
    }

    // Generate project tasks from template tasks
    if (templateTasks && templateTasks.length > 0) {
      const startDateObj = new Date(start_date);

      const projectTasks = templateTasks.map((task) => {
        const dueDate = new Date(startDateObj.getTime() + task.week_offset * 7 * 24 * 60 * 60 * 1000);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        return {
          project_id: project.id,
          phase: task.phase,
          phase_order: task.phase_order,
          task_name: task.task_name,
          task_order: task.task_order,
          due_date: dueDateStr,
          week_number: task.week_offset + 1,
          status: 'not_started',
          owner_ids: task.owner_ids,
        };
      });

      const { error: insertError } = await supabase
        .from('project_tasks')
        .insert(projectTasks);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
