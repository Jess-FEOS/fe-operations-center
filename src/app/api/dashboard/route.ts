import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Current week boundaries (Mon–Sun)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    // Current month for priorities
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 90 days from now for upcoming launches
    const ninetyDaysOut = new Date(now);
    ninetyDaysOut.setDate(now.getDate() + 90);
    const ninetyDaysStr = ninetyDaysOut.toISOString().split('T')[0];

    // Run all queries in parallel
    const [
      projectsRes,
      allTasksRes,
      thisWeekTasksRes,
      prioritiesRes,
      upcomingLaunchesRes,
      campaignsRes,
    ] = await Promise.all([
      // Active projects with linked priority
      supabase
        .from('projects')
        .select('*, monthly_priorities!projects_priority_id_fkey(title, status)')
        .eq('status', 'active'),

      // All tasks for active projects (for overdue + unassigned counts)
      supabase
        .from('project_tasks')
        .select('id, project_id, status, due_date, owner_ids'),

      // This week's tasks
      supabase
        .from('project_tasks')
        .select('status')
        .gte('due_date', mondayStr)
        .lte('due_date', sundayStr),

      // Current month priorities with linked project
      supabase
        .from('monthly_priorities')
        .select('*, projects(name, status)')
        .eq('month', currentMonth)
        .order('sort_order', { ascending: true }),

      // Upcoming launches (projects with launch_date in next 90 days)
      supabase
        .from('projects')
        .select('id, name, launch_date, status, workflow_type, priority_id, monthly_priorities!projects_priority_id_fkey(title)')
        .gte('launch_date', todayStr)
        .lte('launch_date', ninetyDaysStr)
        .order('launch_date', { ascending: true }),

      // Active campaigns
      supabase
        .from('campaigns')
        .select('*, projects(name)')
        .neq('status', 'done'),
    ]);

    // -- Active projects with progress + priority info --
    const projects = projectsRes.data || [];
    const allTasks = allTasksRes.data || [];

    // Build project progress map
    const activeProjectIds = new Set(projects.map((p: any) => p.id));
    const activeProjects = projects.map((project: any) => {
      const tasks = allTasks.filter((t: any) => t.project_id === project.id);
      const total = tasks.length;
      const done = tasks.filter((t: any) => t.status === 'done').length;
      return {
        id: project.id,
        name: project.name,
        workflow_type: project.workflow_type,
        start_date: project.start_date,
        launch_date: project.launch_date,
        priority_id: project.priority_id,
        priority_title: project.monthly_priorities?.title || null,
        priority_status: project.monthly_priorities?.status || null,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
        total_tasks: total,
        done_tasks: done,
      };
    });

    // -- This week summary --
    const weekTasks = thisWeekTasksRes.data || [];
    const thisWeekSummary = {
      not_started: weekTasks.filter((t: any) => t.status === 'not_started').length,
      in_progress: weekTasks.filter((t: any) => t.status === 'in_progress').length,
      done: weekTasks.filter((t: any) => t.status === 'done').length,
      total: weekTasks.length,
    };

    // -- Overdue count --
    const overdueCount = allTasks.filter(
      (t: any) => t.due_date < todayStr && t.status !== 'done'
    ).length;

    // -- Unassigned count --
    const unassignedCount = allTasks.filter(
      (t: any) => !t.owner_ids || t.owner_ids.length === 0
    ).length;

    // -- Monthly priorities with linked project info --
    const prioritiesRaw = prioritiesRes.data || [];

    // Calculate progress for linked projects in priorities
    const monthlyPriorities = prioritiesRaw.map((p: any) => {
      let projectProgress = null;
      if (p.project_id) {
        const tasks = allTasks.filter((t: any) => t.project_id === p.project_id);
        const total = tasks.length;
        const done = tasks.filter((t: any) => t.status === 'done').length;
        projectProgress = total > 0 ? Math.round((done / total) * 100) : 0;
      }
      return {
        ...p,
        project_name: p.projects?.name || null,
        project_status: p.projects?.status || null,
        project_progress: projectProgress,
        projects: undefined,
      };
    });

    // -- Upcoming launches (enriched with priority title + task progress) --
    const upcomingLaunchesRaw = upcomingLaunchesRes.data || [];
    const upcomingLaunches = upcomingLaunchesRaw.map((proj: any) => {
      const tasks = allTasks.filter((t: any) => t.project_id === proj.id);
      const total = tasks.length;
      const done = tasks.filter((t: any) => t.status === 'done').length;
      return {
        id: proj.id,
        name: proj.name,
        launch_date: proj.launch_date,
        status: proj.status,
        workflow_type: proj.workflow_type,
        priority_id: proj.priority_id || null,
        priority_title: proj.monthly_priorities?.title || null,
        total_tasks: total,
        done_tasks: done,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });

    // -- Active campaigns --
    const campaignsRaw = campaignsRes.data || [];
    const activeCampaigns = campaignsRaw.map((c: any) => ({
      ...c,
      project_name: c.projects?.name || null,
      projects: undefined,
    }));

    return NextResponse.json({
      active_projects: activeProjects,
      this_week_summary: thisWeekSummary,
      overdue_count: overdueCount,
      unassigned_count: unassignedCount,
      monthly_priorities: monthlyPriorities,
      upcoming_launches: upcomingLaunches,
      active_campaigns: activeCampaigns,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
