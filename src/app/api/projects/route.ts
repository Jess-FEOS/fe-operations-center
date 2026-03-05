import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active');

    if (projectsError) {
      return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }

    const projectsWithProgress = await Promise.all(
      (projects || []).map(async (project) => {
        const { data: tasks, error: tasksError } = await supabase
          .from('project_tasks')
          .select('status')
          .eq('project_id', project.id);

        if (tasksError) {
          return { ...project, progress: 0, total_tasks: 0, done_tasks: 0 };
        }

        const totalCount = tasks?.length || 0;
        const doneCount = tasks?.filter((t) => t.status === 'done').length || 0;
        const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

        return {
          ...project,
          progress,
          total_tasks: totalCount,
          done_tasks: doneCount,
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
    const { name, workflow_type, start_date, workflow_template_id } = body;

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
      })
      .select()
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
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
