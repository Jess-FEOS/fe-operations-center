import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function correctDueDate(launchDate: string, weekNumber: number): string {
  const launch = new Date(launchDate + 'T12:00:00');
  const target = new Date(launch.getTime() - weekNumber * 7 * 24 * 60 * 60 * 1000);
  return getMonday(target).toISOString().split('T')[0];
}

export async function POST() {
  try {
    // Fetch all active projects with a launch_date
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, launch_date, start_date')
      .eq('status', 'active')
      .not('launch_date', 'is', null);

    if (projectsError) {
      return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ message: 'No active projects with launch dates found', results: [] });
    }

    const results = [];

    for (const project of projects) {
      const { data: tasks, error: tasksError } = await supabase
        .from('project_tasks')
        .select('id, due_date, week_number')
        .eq('project_id', project.id);

      if (tasksError) {
        results.push({
          project_name: project.name,
          error: tasksError.message,
        });
        continue;
      }

      if (!tasks || tasks.length === 0) {
        results.push({
          project_name: project.name,
          tasks_updated: 0,
          note: 'No tasks found',
        });
        continue;
      }

      const oldEarliestDue = tasks.reduce((min, t) => (t.due_date < min ? t.due_date : min), tasks[0].due_date);
      let newEarliestDue: string | null = null;
      let updated = 0;

      for (const task of tasks) {
        const newDueDate = correctDueDate(project.launch_date, task.week_number);

        if (!newEarliestDue || newDueDate < newEarliestDue) {
          newEarliestDue = newDueDate;
        }

        if (newDueDate !== task.due_date) {
          const { error: updateError } = await supabase
            .from('project_tasks')
            .update({ due_date: newDueDate })
            .eq('id', task.id);

          if (updateError) {
            console.error(`[recascade] Failed to update task ${task.id}:`, updateError.message);
          } else {
            updated++;
          }
        }
      }

      // Update project start_date to earliest task due_date
      if (newEarliestDue && newEarliestDue !== project.start_date) {
        await supabase
          .from('projects')
          .update({ start_date: newEarliestDue })
          .eq('id', project.id);
      }

      results.push({
        project_name: project.name,
        launch_date: project.launch_date,
        tasks_updated: updated,
        total_tasks: tasks.length,
        old_earliest_due: oldEarliestDue,
        new_earliest_due: newEarliestDue,
        old_start_date: project.start_date,
        new_start_date: newEarliestDue,
      });
    }

    return NextResponse.json({ message: 'Recascade complete', results });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
