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

    // 30 days from now
    const thirtyDaysOut = new Date(now);
    thirtyDaysOut.setDate(now.getDate() + 30);
    const thirtyDaysStr = thirtyDaysOut.toISOString().split('T')[0];

    // Run all queries in parallel
    const [
      projectsRes,
      allTasksRes,
      thisWeekTasksRes,
      prioritiesRes,
      campaignsRes,
      latestMetricsRes,
    ] = await Promise.all([
      // Active projects with linked priority + goals
      supabase
        .from('projects')
        .select('*, monthly_priorities!projects_priority_id_fkey(title, status)')
        .eq('status', 'active'),

      // All tasks for active projects
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

      // Active campaigns
      supabase
        .from('campaigns')
        .select('*, projects(name)')
        .neq('status', 'done'),

      // Latest metrics for enrollment and revenue per project
      supabase
        .from('metrics')
        .select('project_id, metric_name, metric_value')
        .in('metric_name', ['enrollments', 'revenue'])
        .order('metric_date', { ascending: false }),
    ]);

    // -- Active projects with progress + priority info --
    const projects = projectsRes.data || [];
    const allTasks = allTasksRes.data || [];

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
        revenue_goal: project.revenue_goal || null,
        enrollment_goal: project.enrollment_goal || null,
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

    // -- Next Launch Countdown --
    // Find soonest future launch among active projects
    const projectsWithFutureLaunch = activeProjects
      .filter((p: any) => p.launch_date && p.launch_date >= todayStr)
      .sort((a: any, b: any) => a.launch_date.localeCompare(b.launch_date));
    const nextLaunch = projectsWithFutureLaunch.length > 0 ? projectsWithFutureLaunch[0] : null;

    // -- Enrollment & Revenue Tracker --
    // Build latest metric per project (take first occurrence per project+metric_name since sorted desc)
    const metricsRaw = latestMetricsRes.data || [];
    const latestMetricMap: Record<string, Record<string, number>> = {};
    for (const m of metricsRaw) {
      if (!m.project_id) continue;
      if (!latestMetricMap[m.project_id]) latestMetricMap[m.project_id] = {};
      // Only keep the first (latest) value per metric_name
      if (latestMetricMap[m.project_id][m.metric_name] === undefined) {
        latestMetricMap[m.project_id][m.metric_name] = Number(m.metric_value) || 0;
      }
    }

    const enrollmentTracker = activeProjects
      .filter((p: any) => p.workflow_type === 'course-launch' && (p.enrollment_goal || p.revenue_goal))
      .map((p: any) => {
        const metrics = latestMetricMap[p.id] || {};
        return {
          id: p.id,
          name: p.name,
          enrollment_goal: p.enrollment_goal,
          enrollment_actual: metrics['enrollments'] || 0,
          revenue_goal: p.revenue_goal,
          revenue_actual: metrics['revenue'] || 0,
          launch_date: p.launch_date,
        };
      });

    // -- Attention Needed --
    // Projects with no priority linked
    const noPriorityProjects = activeProjects
      .filter((p: any) => !p.priority_id)
      .map((p: any) => ({ id: p.id, name: p.name }));

    // Projects launching within 30 days with 0% progress
    const stalled30Day = activeProjects
      .filter((p: any) => {
        if (!p.launch_date) return false;
        return p.launch_date >= todayStr && p.launch_date <= thirtyDaysStr && p.progress === 0;
      })
      .map((p: any) => ({ id: p.id, name: p.name, launch_date: p.launch_date }));

    // -- Active campaigns --
    const campaignsRaw2 = campaignsRes.data || [];
    const activeCampaigns = campaignsRaw2.map((c: any) => ({
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
      active_campaigns: activeCampaigns,
      next_launch: nextLaunch,
      enrollment_tracker: enrollmentTracker,
      attention_needed: {
        overdue_count: overdueCount,
        no_priority_projects: noPriorityProjects,
        stalled_launching_soon: stalled30Day,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
