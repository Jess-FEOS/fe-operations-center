'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import WorkflowBadge from '@/components/WorkflowBadge';
import ProgressBar from '@/components/ProgressBar';
import StatusBadge from '@/components/StatusBadge';
import { TaskStatus, STATUS_LABELS } from '@/lib/types';

interface Project {
  id: string;
  name: string;
  workflow_type: string;
  start_date: string;
  current_week: number;
  status: string;
  total_tasks: number;
  done_tasks: number;
  progress: number;
  launch_date?: string | null;
  priority_id?: string | null;
  priority_status?: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  color: string;
  role_data: { id: string; name: string; color: string } | null;
}

interface Task {
  id: string;
  task_name: string;
  project_id: string;
  status: string;
  due_date: string;
  owner_ids: string[];
  project_name: string;
  workflow_type: string;
}

interface OverdueTask {
  id: string;
  task_name: string;
  due_date: string;
  project_id: string;
  project_name: string;
  owner_ids: string[];
}

interface UnassignedTask {
  id: string;
  task_name: string;
  project_id: string;
  project_name: string;
  role_id: string;
  status: string;
  due_date: string;
}

interface Role {
  id: string;
  name: string;
  color: string;
}

interface Priority {
  id: string;
  month: string;
  title: string;
  status: TaskStatus;
  goal: string | null;
  target_date: string | null;
  sort_order: number;
  project_id?: string | null;
  project_name?: string | null;
  project_status?: string | null;
  project_progress?: number | null;
}

interface LaunchCard {
  id: string;
  name: string;
  status: TaskStatus;
  goal: string | null;
  target_date: string | null;
  source: 'priority' | 'project';
  workflow_type?: string;
  progress?: number;
  launch_date?: string | null;
  priority_status?: string | null;
  open_tasks?: number;
}

interface Campaign {
  id: string;
  name: string;
  campaign_type: string | null;
  status: string;
  goal_metric: string | null;
  actual_metric: string | null;
  project_id: string | null;
  project_name: string | null;
  owner_ids: string[] | null;
}

const MONTH_OPTIONS = [
  { value: '2026-03', label: 'March 2026' },
  { value: '2026-04', label: 'April 2026' },
  { value: '2026-05', label: 'May 2026' },
];

const ALL_STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'done', 'blocked'];

const WORKFLOW_TOTAL_WEEKS: Record<string, number> = {
  'course-launch': 8,
  podcast: 2,
  newsletter: 2,
  subscription: 12,
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<UnassignedTask[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [overdueExpanded, setOverdueExpanded] = useState(false);
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [overdueThisWeekOnly, setOverdueThisWeekOnly] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [allPriorities, setAllPriorities] = useState<Priority[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('2026-03');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('not_started');
  const [newGoal, setNewGoal] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [addingPriority, setAddingPriority] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashboardRes, teamRes, prioritiesRes, tasksRes, overdueRes, unassignedRes, rolesRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/team'),
          fetch('/api/priorities'),
          fetch('/api/tasks/this-week'),
          fetch('/api/tasks/overdue').catch(() => null),
          fetch('/api/tasks/unassigned').catch(() => null),
          fetch('/api/roles').catch(() => null),
        ]);

        const dashboardData = await dashboardRes.json();
        const teamData = await teamRes.json();
        const allPrioritiesData = await prioritiesRes.json();
        const tasksData = await tasksRes.json();
        const overdueData = overdueRes ? await overdueRes.json() : [];
        const unassignedData = unassignedRes ? await unassignedRes.json() : [];
        const rolesData = rolesRes ? await rolesRes.json() : [];

        // Use dashboard active_projects as primary project source
        setProjects(Array.isArray(dashboardData.active_projects) ? dashboardData.active_projects : []);
        setTeam(Array.isArray(teamData) ? teamData : []);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setOverdueTasks(Array.isArray(overdueData) ? overdueData : []);
        setUnassignedTasks(Array.isArray(unassignedData) ? unassignedData : []);
        setRoles(Array.isArray(rolesData) ? rolesData : []);
        setCampaigns(Array.isArray(dashboardData.active_campaigns) ? dashboardData.active_campaigns : []);

        // Use dashboard monthly_priorities for the current month
        const dashboardPriorities: Priority[] = Array.isArray(dashboardData.monthly_priorities) ? dashboardData.monthly_priorities : [];

        // Use /api/priorities for allPriorities (needed for month switching and launch pipeline)
        const allP = Array.isArray(allPrioritiesData) ? allPrioritiesData : [];
        setAllPriorities(allP);

        // For the current month (2026-03), use the enriched dashboard priorities
        setPriorities(dashboardPriorities);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const activeProjectCount = projects.filter((p) => p.status === 'active').length || projects.length;
  const dueThisWeekCount = tasks.length;
  const overdueCount = overdueTasks.length;
  const completedThisWeekCount = tasks.filter((t) => t.status === 'done').length;

  const daysOverdue = (dueDate: string) => {
    const due = new Date(dueDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Filter overdue tasks by "this week only" (last 7 days)
  const filteredOverdue = overdueThisWeekOnly
    ? overdueTasks.filter(t => daysOverdue(t.due_date) <= 7)
    : overdueTasks;

  // Group by project
  const overdueByProject = filteredOverdue.reduce<Record<string, { projectName: string; projectId: string; tasks: OverdueTask[] }>>((acc, task) => {
    if (!acc[task.project_id]) {
      acc[task.project_id] = { projectName: task.project_name, projectId: task.project_id, tasks: [] };
    }
    acc[task.project_id].tasks.push(task);
    return acc;
  }, {});

  const overdueProjectGroups = Object.values(overdueByProject).sort((a, b) => b.tasks.length - a.tasks.length);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const teamMap = new Map(team.map((m) => [m.id, m]));

  function getProjectOwners(projectId: string): TeamMember[] {
    const ownerIds = new Set<string>();
    tasks
      .filter((t) => t.project_id === projectId)
      .forEach((t) => {
        t.owner_ids?.forEach((id) => ownerIds.add(id));
      });
    return Array.from(ownerIds)
      .map((id) => teamMap.get(id))
      .filter((m): m is TeamMember => !!m);
  }

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setPriorities(allPriorities.filter(p => p.month === month));
    setShowAddForm(false);
  };

  const handleStatusChange = async (id: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch('/api/priorities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAllPriorities(prev => prev.map(p => p.id === id ? { ...p, status: updated.status } : p));
        setPriorities(prev => prev.map(p => p.id === id ? { ...p, status: updated.status } : p));
      }
    } catch (err) {
      console.error('Failed to update priority status:', err);
    }
  };

  const handleAddPriority = async () => {
    if (!newTitle.trim()) return;
    setAddingPriority(true);
    try {
      const res = await fetch('/api/priorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          month: selectedMonth,
          status: newStatus,
          goal: newGoal.trim() || null,
          target_date: newTargetDate || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setAllPriorities(prev => [...prev, created]);
        setPriorities(prev => [...prev, created]);
        setNewTitle('');
        setNewStatus('not_started');
        setNewGoal('');
        setNewTargetDate('');
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Failed to add priority:', err);
    } finally {
      setAddingPriority(false);
    }
  };

  // Build launch pipeline: priorities with goal/target_date + active projects
  const priorityLaunches: LaunchCard[] = allPriorities
    .filter(p => p.goal || p.target_date)
    .map(p => ({
      id: `priority-${p.id}`,
      name: p.title,
      status: p.status,
      goal: p.goal,
      target_date: p.target_date,
      source: 'priority' as const,
    }));

  const projectLaunches: LaunchCard[] = projects
    .filter(p => p.status === 'active')
    .filter(p => !priorityLaunches.some(pl => pl.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])))
    .map(p => ({
      id: `project-${p.id}`,
      name: p.name,
      status: p.progress === 100 ? 'done' as TaskStatus : p.progress > 0 ? 'in_progress' as TaskStatus : 'not_started' as TaskStatus,
      goal: null,
      target_date: p.start_date,
      source: 'project' as const,
      workflow_type: p.workflow_type,
      progress: p.progress,
      launch_date: p.launch_date,
      priority_status: p.priority_status,
      open_tasks: p.total_tasks - p.done_tasks,
    }));

  const launchPipeline = [...priorityLaunches, ...projectLaunches];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-fe-navy font-fira text-lg">Loading dashboard...</div>
      </div>
    );
  }

  const metrics = [
    { label: 'Active Projects', value: activeProjectCount },
    { label: 'Due This Week', value: dueThisWeekCount },
    { label: 'Overdue', value: overdueCount },
    { label: 'Completed This Week', value: completedThisWeekCount },
  ];

  return (
    <div className="font-fira">
      <h1 className="font-barlow font-extrabold text-2xl text-fe-navy mb-6">
        Dashboard
      </h1>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-white border border-gray-100 rounded-xl p-5"
          >
            <div
              className="text-3xl font-barlow font-extrabold"
              style={{ color: '#B29838' }}
            >
              {metric.value}
            </div>
            <div className="text-sm text-fe-anthracite mt-1">{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Overdue Tasks Banner */}
      {overdueTasks.length > 0 && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setOverdueExpanded(!overdueExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-100/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-2.99L13.73 4.01c-.77-1.33-2.69-1.33-3.46 0L3.34 16.01C2.57 17.33 3.53 19 5.07 19z" />
              </svg>
              <span className="font-barlow font-bold text-red-700 text-sm">
                {overdueTasks.length} Overdue Task{overdueTasks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-fira text-red-600">
              {overdueExpanded ? 'Collapse' : 'View All'}
              <svg className={`w-4 h-4 transition-transform ${overdueExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {overdueExpanded && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-3 mb-3 pt-1 border-t border-red-200">
                <label className="flex items-center gap-1.5 cursor-pointer mt-3">
                  <input
                    type="checkbox"
                    checked={overdueThisWeekOnly}
                    onChange={e => setOverdueThisWeekOnly(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-red-300 text-red-500 focus:ring-red-400"
                  />
                  <span className="text-xs font-fira text-red-700">Show only last 7 days</span>
                </label>
                {overdueThisWeekOnly && filteredOverdue.length !== overdueTasks.length && (
                  <span className="text-xs font-fira text-red-500 mt-3">
                    Showing {filteredOverdue.length} of {overdueTasks.length}
                  </span>
                )}
              </div>

              {overdueProjectGroups.length === 0 && (
                <p className="text-xs font-fira text-red-400 text-center py-2">No overdue tasks in the last 7 days.</p>
              )}

              <div className="space-y-3">
                {overdueProjectGroups.map(group => {
                  const showAll = expandedProjects.has(group.projectId);
                  const visibleTasks = showAll ? group.tasks : group.tasks.slice(0, 5);
                  const hasMore = group.tasks.length > 5;

                  return (
                    <div key={group.projectId}>
                      <Link
                        href={`/projects/${group.projectId}`}
                        className="flex items-center gap-2 mb-1.5 hover:opacity-80 transition-opacity"
                      >
                        <h3 className="text-xs font-barlow font-bold text-red-800">
                          {group.projectName}
                        </h3>
                        <span className="text-xs font-fira text-red-500">
                          ({group.tasks.length} overdue)
                        </span>
                      </Link>
                      <div className="space-y-1">
                        {visibleTasks.map(task => {
                          const days = daysOverdue(task.due_date);
                          return (
                            <Link
                              key={task.id}
                              href={`/projects/${task.project_id}`}
                              className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-red-100 hover:border-red-300 transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex -space-x-1 shrink-0">
                                  {task.owner_ids?.map(oid => {
                                    const member = teamMap.get(oid);
                                    return member ? (
                                      <Avatar key={oid} initials={member.initials} color={member.color} size="sm" />
                                    ) : null;
                                  })}
                                  {(!task.owner_ids || task.owner_ids.length === 0) && (
                                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm font-fira text-fe-anthracite truncate group-hover:text-fe-navy transition-colors">
                                  {task.task_name}
                                </span>
                              </div>
                              <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-fira font-bold bg-red-100 text-red-600">
                                {days}d
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                      {hasMore && !showAll && (
                        <button
                          onClick={(e) => { e.preventDefault(); toggleProjectExpanded(group.projectId); }}
                          className="mt-1 text-xs font-fira text-red-500 hover:text-red-700 transition-colors"
                        >
                          Show {group.tasks.length - 5} more...
                        </button>
                      )}
                      {hasMore && showAll && (
                        <button
                          onClick={(e) => { e.preventDefault(); toggleProjectExpanded(group.projectId); }}
                          className="mt-1 text-xs font-fira text-red-500 hover:text-red-700 transition-colors"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unassigned Tasks Banner */}
      {unassignedTasks.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setUnassignedExpanded(!unassignedExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-barlow font-bold text-amber-700 text-sm">
                {unassignedTasks.length} Task{unassignedTasks.length !== 1 ? 's' : ''} With No Person Assigned
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-fira text-amber-600">
              {unassignedExpanded ? 'Collapse' : 'View All'}
              <svg className={`w-4 h-4 transition-transform ${unassignedExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {unassignedExpanded && (
            <div className="px-4 pb-4">
              {(() => {
                const roleMap = new Map(roles.map(r => [r.id, r]));
                const byRole = unassignedTasks.reduce<Record<string, UnassignedTask[]>>((acc, t) => {
                  const key = t.role_id;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(t);
                  return acc;
                }, {});

                return (
                  <div className="space-y-4 pt-2 border-t border-amber-200">
                    {Object.entries(byRole).map(([roleId, roleTasks]) => {
                      const role = roleMap.get(roleId);
                      return (
                        <div key={roleId}>
                          <div className="flex items-center gap-2 mb-2 mt-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: role?.color || '#999' }}
                            />
                            <h3 className="text-xs font-barlow font-bold text-amber-800">
                              {role?.name || 'Unknown Role'} ({roleTasks.length})
                            </h3>
                          </div>
                          <div className="space-y-1">
                            {roleTasks.map(task => (
                              <div
                                key={task.id}
                                className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-amber-100"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className="w-6 h-6 rounded-full border-2 border-dashed flex items-center justify-center shrink-0"
                                    style={{ borderColor: role?.color || '#999' }}
                                  >
                                    <span className="text-[8px] font-bold" style={{ color: role?.color || '#999' }}>?</span>
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-sm font-fira text-fe-anthracite truncate block">{task.task_name}</span>
                                    <span className="text-xs font-fira text-fe-blue-gray">{task.project_name}</span>
                                  </div>
                                </div>
                                <select
                                  value=""
                                  onChange={async (e) => {
                                    const memberId = e.target.value;
                                    if (!memberId) return;
                                    setClaimingTaskId(task.id);
                                    await fetch(`/api/projects/${task.project_id}/tasks/${task.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ owner_ids: [memberId] }),
                                    });
                                    setUnassignedTasks(prev => prev.filter(t => t.id !== task.id));
                                    setClaimingTaskId(null);
                                  }}
                                  disabled={claimingTaskId === task.id}
                                  className="shrink-0 px-2 py-1 border border-amber-200 rounded text-xs font-fira bg-white focus:outline-none focus:ring-1 focus:ring-fe-blue"
                                >
                                  <option value="">Assign to...</option>
                                  {team.map(m => (
                                    <option key={m.id} value={m.id}>
                                      {m.role_data ? `${m.role_data.name} · ${m.name}` : m.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Monthly Priorities */}
      <div className="mb-8 bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-barlow font-extrabold text-xl text-fe-navy">
              Monthly Priorities
            </h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-fira font-bold text-fe-blue hover:bg-blue-50 transition-colors border border-fe-blue/20"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Priority
            </button>
          </div>
          <div className="flex gap-1">
            {MONTH_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleMonthChange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-fira font-bold transition-colors ${
                  selectedMonth === opt.value
                    ? 'bg-fe-navy text-white'
                    : 'bg-gray-100 text-fe-anthracite hover:bg-gray-200'
                }`}
              >
                {opt.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Add Priority Inline Form */}
        {showAddForm && (
          <div className="mb-4 p-4 rounded-lg border border-blue-100 bg-blue-50/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Priority name..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue"
                  onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim()) handleAddPriority(); }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue bg-white"
                >
                  {ALL_STATUSES.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Goal (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 50+ sold"
                  value={newGoal}
                  onChange={e => setNewGoal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Target date (optional)</label>
                <input
                  type="date"
                  value={newTargetDate}
                  onChange={e => setNewTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddPriority}
                disabled={!newTitle.trim() || addingPriority}
                className="px-4 py-1.5 rounded-lg text-xs font-fira font-bold text-white bg-fe-blue hover:bg-fe-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingPriority ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTitle(''); setNewGoal(''); setNewTargetDate(''); setNewStatus('not_started'); }}
                className="px-4 py-1.5 rounded-lg text-xs font-fira font-bold text-fe-anthracite bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <span className="text-xs font-fira text-fe-blue-gray ml-2">
                Adding to {MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label}
              </span>
            </div>
          </div>
        )}

        {priorities.length === 0 && !showAddForm ? (
          <p className="text-sm text-fe-anthracite">No priorities for this month.</p>
        ) : (
          <div className="space-y-2">
            {priorities.map(priority => (
              <div
                key={priority.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => handleStatusChange(priority.id, priority.status === 'done' ? 'not_started' : 'done')}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      priority.status === 'done'
                        ? 'border-fe-green bg-fe-green'
                        : 'border-gray-300 hover:border-fe-green'
                    }`}
                  >
                    {priority.status === 'done' && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="min-w-0">
                    <span className={`text-sm font-fira ${priority.status === 'done' ? 'line-through text-gray-400' : 'text-fe-anthracite'}`}>
                      {priority.title}
                    </span>
                    {priority.goal && (
                      <span className="ml-2 text-xs font-fira text-fe-gold font-bold">
                        (Goal: {priority.goal})
                      </span>
                    )}
                    {priority.project_id && priority.project_name ? (
                      <Link href={`/projects/${priority.project_id}`} className="block mt-1">
                        <div className="text-xs font-fira text-fe-blue-gray">{priority.project_name}</div>
                        <ProgressBar percent={priority.project_progress || 0} size="sm" />
                      </Link>
                    ) : (
                      <div className="mt-1">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-fira font-bold bg-yellow-100 text-yellow-700">No project linked</span>
                      </div>
                    )}
                  </div>
                </div>
                <StatusBadge
                  status={priority.status}
                  onClick={(newStatus) => handleStatusChange(priority.id, newStatus)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Launch Pipeline */}
      {launchPipeline.length > 0 && (
        <div className="mb-8 bg-white border border-gray-100 rounded-xl p-5">
          <h2 className="font-barlow font-extrabold text-xl text-fe-navy mb-4">
            Launch Pipeline
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {launchPipeline.map(item => {
              return (
                <div
                  key={item.id}
                  className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-barlow font-bold text-sm text-fe-navy leading-tight">
                      {item.name}
                    </h3>
                    {item.source === 'priority' ? (
                      <StatusBadge
                        status={item.status}
                        onClick={(ns) => {
                          const realId = item.id.replace('priority-', '');
                          handleStatusChange(realId, ns);
                        }}
                      />
                    ) : (
                      <StatusBadge status={item.status} interactive={false} />
                    )}
                  </div>
                  <div className="space-y-1.5 mt-3">
                    {item.launch_date ? (
                      <div className="flex items-center gap-2 text-xs font-fira text-fe-anthracite">
                        <svg className="w-3.5 h-3.5 text-fe-blue-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(item.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    ) : item.target_date ? (
                      <div className="flex items-center gap-2 text-xs font-fira text-fe-anthracite">
                        <svg className="w-3.5 h-3.5 text-fe-blue-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(item.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    ) : (
                      <span className="text-xs font-fira text-gray-400">No launch date set</span>
                    )}
                    {item.priority_status && (
                      <span className="text-xs font-fira text-fe-blue-gray">Priority: <span className="font-bold">{STATUS_LABELS[item.priority_status as TaskStatus]}</span></span>
                    )}
                    {item.open_tasks !== undefined && (
                      <div>
                        <span className="text-xs font-fira text-fe-blue-gray">{item.open_tasks} open tasks</span>
                      </div>
                    )}
                    {item.goal && (
                      <div className="flex items-center gap-2 text-xs font-fira">
                        <svg className="w-3.5 h-3.5 text-fe-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-bold" style={{ color: '#B29838' }}>Goal:</span>
                        <span className="text-fe-anthracite">{item.goal}</span>
                      </div>
                    )}
                    {item.source === 'project' && item.workflow_type && (
                      <div className="flex items-center gap-2 mt-1">
                        <WorkflowBadge type={item.workflow_type} />
                        {item.progress !== undefined && (
                          <span className="text-xs font-fira text-fe-blue-gray">{item.progress}% complete</span>
                        )}
                      </div>
                    )}
                    {item.source === 'priority' && (
                      <div className="flex items-center gap-1.5 text-xs font-fira text-fe-blue-gray">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        From priorities
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Campaigns */}
      <div className="mb-8 bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-barlow font-extrabold text-xl text-fe-navy mb-4">
          Active Campaigns
        </h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-fe-blue-gray font-fira">No active campaigns — add one from the Marketing page.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map(campaign => (
              <div key={campaign.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-barlow font-bold text-sm text-fe-navy leading-tight">{campaign.name}</h3>
                  <StatusBadge status={(campaign.status as TaskStatus) || 'not_started'} interactive={false} />
                </div>
                {campaign.campaign_type && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-fira font-bold bg-gray-100 text-fe-blue-gray mb-2">{campaign.campaign_type}</span>
                )}
                {campaign.project_name && (
                  <p className="text-xs font-fira text-fe-blue-gray mb-1">Project: {campaign.project_name}</p>
                )}
                {campaign.goal_metric && (
                  <p className="text-xs font-fira text-fe-anthracite">Goal: <span className="font-bold">{campaign.goal_metric}</span></p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Projects */}
      <h2 className="font-barlow font-extrabold text-xl text-fe-navy mb-4">
        Active Projects
      </h2>

      {projects.length === 0 ? (
        <p className="text-fe-anthracite">No active projects found.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => {
            const totalWeeks =
              WORKFLOW_TOTAL_WEEKS[project.workflow_type] ?? 8;
            const owners = getProjectOwners(project.id);

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-white border border-gray-100 rounded-xl p-5 block hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-barlow font-bold text-lg text-fe-navy">
                    {project.name}
                  </h3>
                  <WorkflowBadge type={project.workflow_type} />
                </div>

                <p className="text-sm text-fe-anthracite mb-3">
                  Week {project.current_week} of {totalWeeks}
                </p>

                <ProgressBar percent={project.progress} size="sm" />

                <p className="text-sm text-fe-anthracite mt-2 mb-3">
                  {project.done_tasks} of {project.total_tasks} tasks complete
                </p>

                {owners.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {owners.map((member) => (
                      <Avatar
                        key={member.id}
                        initials={member.initials}
                        color={member.color}
                        size="sm"
                      />
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
