import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get the team member's name for string matching in template tasks
    const { data: member } = await supabase
      .from('team_members')
      .select('name')
      .eq('id', id)
      .single();

    const firstName = member ? member.name.split(' ')[0] : '';

    // 1. Fetch project_tasks where this member is in owner_ids (UUID array)
    const { data: projectTasks, error: ptError } = await supabase
      .from('project_tasks')
      .select('id, task_name, status, due_date, project_id, owner_ids')
      .contains('owner_ids', [id]);

    if (ptError) {
      return NextResponse.json({ error: ptError.message }, { status: 500 });
    }

    // Get project names for context
    const projectIds = [...new Set((projectTasks || []).map(t => t.project_id))];
    let projectNames: Record<string, string> = {};
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);

      if (projects) {
        projects.forEach((p: { id: string; name: string }) => {
          projectNames[p.id] = p.name;
        });
      }
    }

    const enrichedProjectTasks = (projectTasks || []).map(t => ({
      id: t.id,
      task_name: t.task_name,
      context_name: projectNames[t.project_id] || 'Unknown Project',
      status: t.status,
      due_date: t.due_date,
      type: 'project' as const,
    }));

    // 2. Fetch project_template_tasks where owner matches by name
    // Owner field stores text like "Jess", "Paul", "Jess + Paul"
    let enrichedTemplateTasks: { id: string; task_name: string; context_name: string; status: string; due_date: string | null; type: 'template' }[] = [];

    if (firstName) {
      const { data: allTemplateTasks } = await supabase
        .from('project_template_tasks')
        .select('id, title, owner, template_id');

      if (allTemplateTasks) {
        // Match tasks where this person's first name appears in the owner string
        const namePattern = firstName.toLowerCase();
        const matchingTasks = allTemplateTasks.filter((t: any) => {
          const parts = t.owner.toLowerCase().split(/\s*\+\s*/);
          return parts.some((p: string) => p.trim() === namePattern);
        });

        if (matchingTasks.length > 0) {
          // Get template names for context
          const templateIds = [...new Set(matchingTasks.map((t: any) => t.template_id))];
          const { data: templates } = await supabase
            .from('project_templates')
            .select('id, name')
            .in('id', templateIds);

          const templateNames: Record<string, string> = {};
          if (templates) {
            templates.forEach((t: { id: string; name: string }) => {
              templateNames[t.id] = t.name;
            });
          }

          enrichedTemplateTasks = matchingTasks.map((t: any) => ({
            id: t.id,
            task_name: t.title,
            context_name: templateNames[t.template_id] || 'Unknown Template',
            status: 'template',
            due_date: null,
            type: 'template' as const,
          }));
        }
      }
    }

    return NextResponse.json({
      project_tasks: enrichedProjectTasks,
      template_tasks: enrichedTemplateTasks,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
