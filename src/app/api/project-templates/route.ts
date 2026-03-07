import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SEED_TEMPLATE = {
  name: 'Existing Course - New Cohort',
  type: 'course-launch',
  description: 'Full 34-task workflow for launching a new cohort of an existing course, from setup through post-cohort wrap-up.',
};

const SEED_TASKS = [
  // WEEK 6 - Setup
  { title: 'Set cohort dates - start, end, office hours schedule', description: null, owner: 'Paul', week_number: 6, order_index: 1 },
  { title: 'Confirm faculty availability - Brett and all instructors', description: null, owner: 'Paul', week_number: 6, order_index: 2 },
  { title: 'Create new course in Teachable for new cohort', description: null, owner: 'Paul', week_number: 6, order_index: 3 },
  { title: 'Remove old cohort live session recordings from Teachable', description: null, owner: 'Paul', week_number: 6, order_index: 4 },
  { title: 'Update syllabus document with new dates', description: null, owner: 'Paul', week_number: 6, order_index: 5 },
  { title: 'Load updated syllabus into Kit for download', description: null, owner: 'Paul', week_number: 6, order_index: 6 },
  { title: 'Create new enrollment form in Formsite', description: null, owner: 'Jess', week_number: 6, order_index: 7 },
  { title: 'Update website with new cohort dates and enrollment form', description: null, owner: 'Jess', week_number: 6, order_index: 8 },
  { title: 'Update sales page copy and pricing', description: null, owner: 'Jess', week_number: 6, order_index: 9 },
  { title: 'Update welcome email in Kit', description: null, owner: 'Jess', week_number: 6, order_index: 10 },
  { title: 'Set up Zapier automation - Teachable enrollment to Kit list to welcome email', description: null, owner: 'Jess', week_number: 6, order_index: 11 },
  { title: 'Test full enrollment flow end to end', description: null, owner: 'Jess + Paul', week_number: 6, order_index: 12 },
  // WEEK 4 - Marketing Launch
  { title: 'Write launch announcement email', description: null, owner: 'Jess', week_number: 4, order_index: 13 },
  { title: 'Write social posts for X, LinkedIn, YouTube', description: null, owner: 'Jess', week_number: 4, order_index: 14 },
  { title: 'Schedule email campaign in Kit', description: null, owner: 'Jess', week_number: 4, order_index: 15 },
  { title: 'Publish social content', description: null, owner: 'Jess', week_number: 4, order_index: 16 },
  { title: 'Send to enterprise contacts', description: null, owner: 'Jess', week_number: 4, order_index: 17 },
  // WEEK 2 - Enrollment Push
  { title: 'Send mid-campaign email', description: null, owner: 'Jess', week_number: 2, order_index: 18 },
  { title: 'Monitor enrollment numbers daily', description: null, owner: 'Jess', week_number: 2, order_index: 19 },
  { title: 'Send final urgency email - last 48 hours', description: null, owner: 'Jess', week_number: 2, order_index: 20 },
  { title: 'Close enrollment and update website', description: null, owner: 'Jess', week_number: 2, order_index: 21 },
  // WEEK 1 - Delivery Prep
  { title: 'Set up Zoom recurring meeting for live office hours', description: null, owner: 'Paul', week_number: 1, order_index: 22 },
  { title: 'Send welcome email to enrolled students with Zoom links and schedule', description: null, owner: 'Paul', week_number: 1, order_index: 23 },
  { title: 'Upload any updated content and materials to Teachable', description: null, owner: 'Paul', week_number: 1, order_index: 24 },
  { title: 'Confirm all students have Teachable access', description: null, owner: 'Paul', week_number: 1, order_index: 25 },
  // WEEK 0 - Delivery (During Cohort)
  { title: 'Weekly office hours session delivered', description: null, owner: 'Brett', week_number: 0, order_index: 26 },
  { title: 'Upload office hours recording to Teachable', description: null, owner: 'Paul', week_number: 0, order_index: 27 },
  { title: 'Monitor student progress and flag disengaged students', description: null, owner: 'Paul', week_number: 0, order_index: 28 },
  // WEEK -1 - Wrap Up (Post Cohort)
  { title: 'Send completion email to students', description: null, owner: 'Paul', week_number: -1, order_index: 29 },
  { title: 'Send feedback survey', description: null, owner: 'Paul', week_number: -1, order_index: 30 },
  { title: 'Collect testimonials for marketing', description: null, owner: 'Jess', week_number: -1, order_index: 31 },
  { title: 'Log final enrollment count and revenue', description: null, owner: 'Paul', week_number: -1, order_index: 32 },
  { title: 'Debrief - document what changed for next cohort', description: null, owner: 'Paul', week_number: -1, order_index: 33 },
  { title: 'Identify upsell opportunities to AI Accelerator and PM Academy', description: null, owner: 'Jess', week_number: -1, order_index: 34 },
];

const WEEK_PHASES: Record<number, string> = {
  6: 'Setup',
  4: 'Marketing Launch',
  2: 'Enrollment Push',
  1: 'Delivery Prep',
  0: 'Delivery',
  [-1]: 'Wrap Up',
};

export async function GET() {
  try {
    // Fetch all templates
    const { data: templates, error } = await supabase
      .from('project_templates')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-seed if empty
    if (!templates || templates.length === 0) {
      const { data: seeded, error: seedError } = await supabase
        .from('project_templates')
        .insert(SEED_TEMPLATE)
        .select()
        .single();

      if (seedError) {
        return NextResponse.json({ error: seedError.message }, { status: 500 });
      }

      const tasksToInsert = SEED_TASKS.map(t => ({
        ...t,
        template_id: seeded.id,
      }));

      const { error: tasksSeedError } = await supabase
        .from('project_template_tasks')
        .insert(tasksToInsert);

      if (tasksSeedError) {
        return NextResponse.json({ error: tasksSeedError.message }, { status: 500 });
      }

      // Return the seeded template with tasks
      const { data: tasks } = await supabase
        .from('project_template_tasks')
        .select('*')
        .eq('template_id', seeded.id)
        .order('order_index', { ascending: true });

      return NextResponse.json([{ ...seeded, tasks: tasks || [] }]);
    }

    // Fetch tasks for all templates
    const templateIds = templates.map(t => t.id);
    const { data: allTasks } = await supabase
      .from('project_template_tasks')
      .select('*')
      .in('template_id', templateIds)
      .order('order_index', { ascending: true });

    const templatesWithTasks = templates.map(t => ({
      ...t,
      tasks: (allTasks || []).filter(task => task.template_id === t.id),
    }));

    return NextResponse.json(templatesWithTasks);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a project from a template, or create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Create a new template (from the template editor)
    if (body.action === 'create_template') {
      const { name, type, description } = body;
      if (!name || !type) {
        return NextResponse.json({ error: 'Missing name or type' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('project_templates')
        .insert({ name, type, description: description || null })
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data, { status: 201 });
    }

    // Create a project from a template
    const { template_id, name, start_date } = body;

    if (!template_id || !name || !start_date) {
      return NextResponse.json(
        { error: 'Missing required fields: template_id, name, start_date' },
        { status: 400 }
      );
    }

    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('project_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Fetch template tasks
    const { data: templateTasks, error: tasksError } = await supabase
      .from('project_template_tasks')
      .select('*')
      .eq('template_id', template_id)
      .order('order_index', { ascending: true });

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    // Fetch team members to resolve owner names to IDs
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('id, name');

    const nameToId: Record<string, string> = {};
    (teamMembers || []).forEach((m: any) => {
      // Map first name to ID (e.g., "Jess" matches "Jessica Corbin")
      const firstName = m.name.split(' ')[0];
      nameToId[firstName.toLowerCase()] = m.id;
      nameToId[m.name.toLowerCase()] = m.id;
    });

    function resolveOwnerIds(ownerStr: string): string[] {
      const parts = ownerStr.split(/\s*\+\s*/);
      const ids: string[] = [];
      for (const part of parts) {
        const key = part.trim().toLowerCase();
        if (nameToId[key]) {
          ids.push(nameToId[key]);
        }
      }
      return ids;
    }

    // Look up or create a matching workflow template for the project type
    let workflowTemplateId: string | null = null;
    const { data: wfTemplates } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('slug', template.type)
      .limit(1);

    if (wfTemplates && wfTemplates.length > 0) {
      workflowTemplateId = wfTemplates[0].id;
    }

    // Calculate total weeks span from template tasks
    const weekNumbers = (templateTasks || []).map(t => t.week_number);
    const maxWeek = Math.max(...weekNumbers, 0);
    const minWeek = Math.min(...weekNumbers, 0);
    const totalWeeks = maxWeek - minWeek + 1;

    // Create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name,
        workflow_type: template.type,
        start_date,
        workflow_template_id: workflowTemplateId,
        current_week: 1,
        status: 'active',
      })
      .select()
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    // Generate project tasks with dates calculated from start date
    // week_number > 0 = weeks BEFORE start date
    // week_number 0 = at start date
    // week_number < 0 = weeks AFTER start date
    if (templateTasks && templateTasks.length > 0) {
      const startDateObj = new Date(start_date + 'T00:00:00');

      const phaseOrder: Record<number, number> = { 6: 1, 4: 2, 2: 3, 1: 4, 0: 5, [-1]: 6 };

      const projectTasks = templateTasks.map((task: any) => {
        const offsetDays = -task.week_number * 7; // negative week_number = before start
        const dueDate = new Date(startDateObj.getTime() + offsetDays * 24 * 60 * 60 * 1000);
        const dueDateStr = dueDate.toISOString().split('T')[0];
        const phase = WEEK_PHASES[task.week_number] || `Week ${task.week_number}`;

        return {
          project_id: project.id,
          phase,
          phase_order: phaseOrder[task.week_number] || 99,
          task_name: task.title,
          task_order: task.order_index,
          due_date: dueDateStr,
          week_number: task.week_number,
          status: 'not_started',
          owner_ids: resolveOwnerIds(task.owner),
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
