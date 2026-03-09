'use client';

import { useState, useEffect, useRef } from 'react';
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
  project_name?: string;
  project_id?: string;
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
  const [projectsRaw, setProjectsRaw] = useState<Project[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<UnassignedTask[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [upcomingLaunches, setUpcomingLaunches] = useState<{ id: string; name: string; launch_date: string; status: string; workflow_type: string }[]>([]);
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
  const [newMonth, setNewMonth] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [allProjectsList, setAllProjectsList] = useState<{ id: string; name: string; workflow_type: string; launch_date?: string | null; priority_id?: string | null }[]>([]);
  const [addingPriority, setAddingPriority] = useState(false);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
  const [editPTitle, setEditPTitle] = useState('');
  const [editPMonth, setEditPMonth] = useState('');
  const [editPStatus, setEditPStatus] = useState<TaskStatus>('not_started');
  const [editPGoal, setEditPGoal] = useState('');
  const [editPTargetDate, setEditPTargetDate] = useState('');
  const [editPProjectId, setEditPProjectId] = useState('');
  const [savingPriority, setSavingPriority] = useState(false);
  const [deletingPriorityId, setDeletingPriorityId] = useState<string | null>(null);
  const [projectSort, setProjectSort] = useState('launch_date');
  const [projectFilter, setProjectFilter] = useState('all');
  const manualFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashboardRes, teamRes, prioritiesRes, tasksRes, overdueRes, unassignedRes, rolesRes, projectsListRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/team'),
          fetch('/api/priorities'),
          fetch('/api/tasks/this-week'),
          fetch('/api/tasks/overdue').catch(() => null),
          fetch('/api/tasks/unassigned').catch(() => null),
          fetch('/api/roles').catch(() => null),
          fetch('/api/projects').catch(() => null),
        ]);

        const dashboardData = await dashboardRes.json();
        const teamData = await teamRes.json();
        const allPrioritiesData = await prioritiesRes.json();
        const tasksData = await tasksRes.json();
        const overdueData = overdueRes ? await overdueRes.json() : [];
        const unassignedData = unassignedRes ? await unassignedRes.json() : [];
        const rolesData = rolesRes ? await rolesRes.json() : [];
        const projectsListData = projectsListRes ? await projectsListRes.json() : [];

        // Use dashboard active_projects as primary project source
        setProjectsRaw(Array.isArray(dashboardData.active_projects) ? dashboardData.active_projects : []);
        setTeam(Array.isArray(teamData) ? teamData : []);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setOverdueTasks(Array.isArray(overdueData) ? overdueData : []);
        setUnassignedTasks(Array.isArray(unassignedData) ? unassignedData : []);
        setRoles(Array.isArray(rolesData) ? rolesData : []);
        setAllProjectsList(Array.isArray(projectsListData) ? projectsListData : []);
        setCampaigns(Array.isArray(dashboardData.active_campaigns) ? dashboardData.active_campaigns : []);
        setUpcomingLaunches(Array.isArray(dashboardData.upcoming_launches) ? dashboardData.upcoming_launches : []);

        // Use /api/priorities as the SOLE source for priorities — deduplicate by ID
        const rawP = Array.isArray(allPrioritiesData) ? allPrioritiesData : [];
        const seen = new Set<string>();
        const allP = rawP.filter((p: Priority) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        setAllPriorities(allP);
        setPriorities(allP.filter((p: Priority) => p.month === '2026-03'));
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Sort + filter active projects
  const sortedProjects = (() => {
    let list = [...projectsRaw];
    if (projectFilter !== 'all') {
      list = list.filter(p => p.workflow_type === projectFilter);
    }
    list.sort((a, b) => {
      if (projectSort === 'launch_date') {
        if (a.launch_date && b.launch_date) return a.launch_date.localeCompare(b.launch_date);
        if (a.launch_date && !b.launch_date) return -1;
        if (!a.launch_date && b.launch_date) return 1;
        return 0;
      }
      if (projectSort === 'start_date') return a.start_date.localeCompare(b.start_date);
      if (projectSort === 'name') return a.name.localeCompare(b.name);
      if (projectSort === 'progress') return b.progress - a.progress;
      return 0;
    });
    return list;
  })();
  const projects = sortedProjects;
  const activeProjectCount = projectsRaw.filter((p) => p.status === 'active').length || projectsRaw.length;
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
    const monthToUse = newMonth || selectedMonth;
    // Client-side duplicate check
    const isDuplicate = allPriorities.some(p =>
      p.title.toLowerCase() === newTitle.trim().toLowerCase() && p.month === monthToUse
    );
    if (isDuplicate) {
      setDuplicateWarning('A priority with this title already exists for this month');
      return;
    }
    setDuplicateWarning('');
    setAddingPriority(true);
    try {
      const res = await fetch('/api/priorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          month: monthToUse,
          status: newStatus,
          goal: newGoal.trim() || null,
          target_date: newTargetDate || null,
          project_id: newProjectId || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        // If project_id was selected, also PATCH the project to set its priority_id
        if (newProjectId && created.id) {
          await fetch(`/api/projects/${newProjectId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority_id: created.id }),
          });
        }
        setAllPriorities(prev => [...prev, created]);
        if (monthToUse === selectedMonth) {
          setPriorities(prev => [...prev, created]);
        }
        setNewTitle('');
        setNewStatus('not_started');
        setNewGoal('');
        setNewTargetDate('');
        setNewMonth('');
        setNewProjectId('');
        setSelectedSuggestionId(null);
        setDuplicateWarning('');
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Failed to add priority:', err);
    } finally {
      setAddingPriority(false);
    }
  };

  const startEditPriority = (p: Priority) => {
    setEditingPriorityId(p.id);
    setEditPTitle(p.title);
    setEditPMonth(p.month);
    setEditPStatus(p.status);
    setEditPGoal(p.goal || '');
    setEditPTargetDate(p.target_date || '');
    setEditPProjectId(p.project_id || '');
  };

  const cancelEditPriority = () => {
    setEditingPriorityId(null);
  };

  const saveEditPriority = async () => {
    if (!editingPriorityId || !editPTitle.trim()) return;
    setSavingPriority(true);
    try {
      const res = await fetch('/api/priorities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPriorityId,
          title: editPTitle.trim(),
          month: editPMonth,
          status: editPStatus,
          goal: editPGoal.trim() || null,
          target_date: editPTargetDate || null,
          project_id: editPProjectId || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        const updater = (p: Priority) => p.id === editingPriorityId ? { ...p, ...updated } : p;
        setAllPriorities(prev => prev.map(updater));
        setPriorities(prev => prev.map(updater));
        setEditingPriorityId(null);
      }
    } catch (err) {
      console.error('Failed to save priority:', err);
    } finally {
      setSavingPriority(false);
    }
  };

  const deletePriority = async (id: string) => {
    try {
      const res = await fetch(`/api/priorities?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAllPriorities(prev => prev.filter(p => p.id !== id));
        setPriorities(prev => prev.filter(p => p.id !== id));
        setDeletingPriorityId(null);
      }
    } catch (err) {
      console.error('Failed to delete priority:', err);
    }
  };

  // Generate suggested priority title based on workflow type
  function generateSuggestion(proj: { name: string; workflow_type: string; launch_date?: string | null }) {
    const dateFmt = proj.launch_date
      ? new Date(proj.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'launch';
    switch (proj.workflow_type) {
      case 'course-launch': return `Fill ${proj.name} — enroll students by ${dateFmt}`;
      case 'newsletter': return `Grow ${proj.name} subscriber list before ${dateFmt}`;
      case 'podcast': return `Build audience and launch ${proj.name} by ${dateFmt}`;
      case 'subscription': return `Build waitlist for ${proj.name} by ${dateFmt}`;
      default: return `Complete ${proj.name} by ${dateFmt}`;
    }
  }

  // Get the month before a date as YYYY-MM string
  function monthBefore(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  // Projects eligible for priority suggestions: active, launch within 90 days, no priority_id
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const suggestedProjects = allProjectsList.filter(p => {
    if (p.priority_id) return false;
    if (!p.launch_date) return false;
    const ld = new Date(p.launch_date + 'T00:00:00');
    return ld >= now && ld <= in90Days;
  });

  // Ghost cards: active projects launching within 60 days with no linked priority
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const ghostProjects = allProjectsList.filter(p => {
    if (p.priority_id) return false;
    if (!p.launch_date) return false;
    const ld = new Date(p.launch_date + 'T00:00:00');
    return ld >= now && ld <= in60Days;
  });

  // Pre-fill form from a suggested project
  function useSuggestion(proj: { id: string; name: string; workflow_type: string; launch_date?: string | null }) {
    setNewTitle(generateSuggestion(proj));
    setNewProjectId(proj.id);
    setNewTargetDate(proj.launch_date || '');
    if (proj.launch_date) {
      const mb = monthBefore(proj.launch_date);
      if (MONTH_OPTIONS.some(o => o.value === mb)) {
        setNewMonth(mb);
      }
    }
    setNewStatus('not_started');
    setNewGoal('');
    setSelectedSuggestionId(proj.id);
    setDuplicateWarning('');
    // Scroll to manual form and briefly highlight
    setTimeout(() => {
      manualFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      manualFormRef.current?.classList.add('ring-2', 'ring-fe-blue');
      setTimeout(() => manualFormRef.current?.classList.remove('ring-2', 'ring-fe-blue'), 1500);
    }, 50);
  }

  // Pre-fill and open form for a ghost card project
  function openGhostPriority(proj: { id: string; name: string; workflow_type: string; launch_date?: string | null }) {
    useSuggestion(proj);
    setShowAddForm(true);
  }

  // Build Upcoming Launches from priorities with a future target_date only
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const launchPipeline: LaunchCard[] = allPriorities
    .filter(p => {
      if (!p.target_date) return false;
      const td = new Date(p.target_date + 'T00:00:00');
      return td >= today;
    })
    .sort((a, b) => (a.target_date || '').localeCompare(b.target_date || ''))
    .map(p => ({
      id: `priority-${p.id}`,
      name: p.title,
      status: p.status,
      goal: p.goal,
      target_date: p.target_date,
      source: 'priority' as const,
      project_name: p.project_name || undefined,
      project_id: p.project_id || undefined,
    }));

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

      {/* This Month's Focus */}
      <div className="mb-8 bg-white border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-barlow font-extrabold text-xl text-fe-navy">
              This Month&apos;s Focus
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

        {/* Add Priority Modal */}
        {showAddForm && (
          <div className="mb-4 p-4 rounded-lg border border-blue-100 bg-blue-50/30">
            {/* SECTION 1: Suggested from your projects */}
            {suggestedProjects.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-barlow font-bold text-fe-navy uppercase tracking-wide mb-2">Suggested from your projects</h3>
                <div className="space-y-2">
                  {suggestedProjects.map(proj => {
                    const suggestion = generateSuggestion(proj);
                    const launchFmt = proj.launch_date
                      ? new Date(proj.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : null;
                    return (
                      <div key={proj.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white">
                        <div className="min-w-0">
                          <p className="text-sm font-fira text-fe-navy truncate">{suggestion}</p>
                          <p className="text-xs font-fira text-fe-blue-gray mt-0.5">{proj.name}{launchFmt ? ` · launches ${launchFmt}` : ''}</p>
                        </div>
                        <button
                          onClick={() => useSuggestion(proj)}
                          disabled={selectedSuggestionId === proj.id}
                          className={`shrink-0 px-3 py-1 rounded text-xs font-fira font-bold transition-colors ${
                            selectedSuggestionId === proj.id
                              ? 'text-gray-400 cursor-default'
                              : 'text-fe-blue hover:bg-fe-blue/10'
                          }`}
                        >
                          {selectedSuggestionId === proj.id ? 'Selected \u2713' : 'Use This \u2192'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-gray-200 mt-4 mb-3" />
              </div>
            )}

            {/* SECTION 2: Manual form */}
            <div ref={manualFormRef} className="rounded-lg transition-all" />
            <h3 className="text-xs font-barlow font-bold text-fe-navy uppercase tracking-wide mb-2">
              {suggestedProjects.length > 0 ? 'Or add your own' : 'Add a priority'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Fill Analyst Academy — 30 seats by May 11th"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue"
                  onKeyDown={e => { if (e.key === 'Enter' && newTitle.trim()) handleAddPriority(); }}
                  autoFocus
                />
                <p className="text-xs font-fira text-gray-400 mt-1">Priorities are outcomes, not actions. What must be true by end of this month for the business to move forward?</p>
              </div>
              <div>
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Month</label>
                <select
                  value={newMonth || selectedMonth}
                  onChange={e => setNewMonth(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue bg-white"
                >
                  {MONTH_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
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
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Success Looks Like (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 30 enrollments, $15,000 revenue"
                  value={newGoal}
                  onChange={e => setNewGoal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Must be achieved by (optional)</label>
                <input
                  type="date"
                  value={newTargetDate}
                  onChange={e => setNewTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Link to Project (optional)</label>
                <select
                  value={newProjectId}
                  onChange={e => setNewProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue bg-white"
                >
                  <option value="">None</option>
                  {allProjectsList.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.workflow_type === 'course-launch' ? 'Course Launch' : p.workflow_type === 'podcast' ? 'Podcast' : p.workflow_type === 'newsletter' ? 'Newsletter' : 'Subscription'})</option>
                  ))}
                </select>
              </div>
            </div>
            {duplicateWarning && (
              <p className="text-xs font-fira text-red-500 font-bold mb-2">{duplicateWarning}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddPriority}
                disabled={!newTitle.trim() || addingPriority}
                className="px-4 py-1.5 rounded-lg text-xs font-fira font-bold text-white bg-fe-blue hover:bg-fe-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingPriority ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewTitle(''); setNewGoal(''); setNewTargetDate(''); setNewStatus('not_started'); setNewMonth(''); setNewProjectId(''); setSelectedSuggestionId(null); setDuplicateWarning(''); }}
                className="px-4 py-1.5 rounded-lg text-xs font-fira font-bold text-fe-anthracite bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {priorities.length === 0 && !showAddForm ? (
          <p className="text-sm text-fe-anthracite">No priorities for this month.</p>
        ) : (
          <div className="space-y-2">
            {priorities.map(priority => {
              // Inline edit mode for this priority
              if (editingPriorityId === priority.id) {
                return (
                  <div key={priority.id} className="p-4 rounded-lg border border-fe-blue/30 bg-blue-50/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-fira text-fe-blue-gray mb-1">Title</label>
                        <input type="text" value={editPTitle} onChange={e => setEditPTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue" />
                      </div>
                      <div>
                        <label className="block text-xs font-fira text-fe-blue-gray mb-1">Month</label>
                        <select value={editPMonth} onChange={e => setEditPMonth(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue bg-white">
                          {MONTH_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-fira text-fe-blue-gray mb-1">Status</label>
                        <select value={editPStatus} onChange={e => setEditPStatus(e.target.value as TaskStatus)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue bg-white">
                          {ALL_STATUSES.map(s => (<option key={s} value={s}>{STATUS_LABELS[s]}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-fira text-fe-blue-gray mb-1">Success Looks Like</label>
                        <input type="text" value={editPGoal} onChange={e => setEditPGoal(e.target.value)} placeholder="e.g. 30 enrollments" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue" />
                      </div>
                      <div>
                        <label className="block text-xs font-fira text-fe-blue-gray mb-1">Must be achieved by</label>
                        <input type="date" value={editPTargetDate} onChange={e => setEditPTargetDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-fira text-fe-blue-gray mb-1">Link to Project</label>
                        <select value={editPProjectId} onChange={e => setEditPProjectId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue bg-white">
                          <option value="">None</option>
                          {allProjectsList.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEditPriority} disabled={!editPTitle.trim() || savingPriority} className="px-4 py-1.5 rounded-lg text-xs font-fira font-bold text-white bg-fe-blue hover:bg-fe-blue/90 transition-colors disabled:opacity-50">{savingPriority ? 'Saving...' : 'Save'}</button>
                      <button onClick={cancelEditPriority} className="px-4 py-1.5 rounded-lg text-xs font-fira font-bold text-fe-anthracite bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                    </div>
                  </div>
                );
              }

              // Delete confirmation
              if (deletingPriorityId === priority.id) {
                return (
                  <div key={priority.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-red-200 bg-red-50">
                    <span className="text-sm font-fira text-red-700">Delete &ldquo;{priority.title}&rdquo;?</span>
                    <div className="flex gap-2">
                      <button onClick={() => deletePriority(priority.id)} className="px-3 py-1 rounded text-xs font-fira font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Yes, delete</button>
                      <button onClick={() => setDeletingPriorityId(null)} className="px-3 py-1 rounded text-xs font-fira font-bold text-fe-anthracite bg-gray-100 hover:bg-gray-200 transition-colors">No</button>
                    </div>
                  </div>
                );
              }

              // Normal display
              return (
                <div
                  key={priority.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors group/card"
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
                      <span className={`text-sm font-fira font-bold ${priority.status === 'done' ? 'line-through text-gray-400' : 'text-fe-navy'}`}>
                        {priority.title}
                      </span>
                      {priority.project_id && priority.project_name ? (
                        <Link href={`/projects/${priority.project_id}`} className="flex items-center gap-1 mt-0.5 group/link">
                          <svg className="w-3 h-3 text-fe-blue-gray shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                          </svg>
                          <span className="text-xs font-fira text-fe-blue-gray group-hover/link:text-fe-blue transition-colors">&rarr; {priority.project_name}</span>
                        </Link>
                      ) : (
                        <div className="mt-0.5">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-fira font-bold bg-yellow-100 text-yellow-700">No project linked</span>
                        </div>
                      )}
                      {priority.goal && (
                        <p className="text-xs font-fira text-fe-gold font-bold mt-1">
                          Success: {priority.goal}
                        </p>
                      )}
                      {priority.target_date && (
                        <p className="text-xs font-fira text-fe-blue-gray mt-0.5">
                          By {new Date(priority.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Edit/Delete icons — visible on hover */}
                    <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditPriority(priority)}
                        className="p-1 rounded text-fe-blue-gray hover:text-fe-navy hover:bg-gray-100 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeletingPriorityId(priority.id)}
                        className="p-1 rounded text-fe-blue-gray hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <StatusBadge
                      status={priority.status}
                      onClick={(newStatus) => handleStatusChange(priority.id, newStatus)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ghost cards for unlinked projects launching soon */}
        {ghostProjects.length > 0 && (
          <div className={`space-y-2 ${priorities.length > 0 || showAddForm ? 'mt-3' : ''}`}>
            {ghostProjects.map(proj => {
              const launchFmt = proj.launch_date
                ? new Date(proj.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '';
              return (
                <div
                  key={`ghost-${proj.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">&#9888;&#65039;</span>
                    <span className="text-sm font-fira text-amber-700">
                      No priority set — <span className="font-bold">{proj.name}</span> launches {launchFmt}
                    </span>
                  </div>
                  <button
                    onClick={() => openGhostPriority(proj)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-fira font-bold text-amber-700 hover:bg-amber-100 transition-colors border border-amber-300"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Set Priority
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming Launches */}
      {launchPipeline.length > 0 && (
        <div className="mb-8 bg-white border border-gray-100 rounded-xl p-5">
          <h2 className="font-barlow font-extrabold text-xl text-fe-navy mb-1">
            Upcoming Launches
          </h2>
          <p className="text-xs font-fira text-fe-blue-gray mb-4">Prepare now — these are coming</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {launchPipeline.map(item => {
              const realId = item.id.replace('priority-', '');
              return (
                <div
                  key={item.id}
                  className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-barlow font-bold text-sm text-fe-navy leading-tight">
                      {item.name}
                    </h3>
                    <StatusBadge
                      status={item.status}
                      onClick={(ns) => handleStatusChange(realId, ns)}
                    />
                  </div>
                  <div className="space-y-1.5 mt-3">
                    {item.target_date && (
                      <div className="flex items-center gap-2 text-xs font-fira text-fe-anthracite">
                        <svg className="w-3.5 h-3.5 text-fe-blue-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(item.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                    {item.goal && (
                      <div className="flex items-center gap-2 text-xs font-fira">
                        <svg className="w-3.5 h-3.5 text-fe-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-bold" style={{ color: '#B29838' }}>Success:</span>
                        <span className="text-fe-anthracite">{item.goal}</span>
                      </div>
                    )}
                    {item.project_name ? (
                      <Link href={`/projects/${item.project_id}`} className="flex items-center gap-1.5 text-xs font-fira text-fe-blue-gray hover:text-fe-blue transition-colors">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                        </svg>
                        &rarr; {item.project_name}
                      </Link>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-fira font-bold bg-yellow-100 text-yellow-700">No project linked</span>
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

      {/* Projects In Progress */}
      <h2 className="font-barlow font-extrabold text-xl text-fe-navy mb-4">
        Projects In Progress
      </h2>

      <div style={{display:'flex', gap:'12px', marginBottom:'12px', alignItems:'center'}}>
        <select value={projectSort} onChange={e => setProjectSort(e.target.value)} style={{fontSize:'13px', padding:'4px 8px', borderRadius:'4px', border:'1px solid #ddd'}}>
          <option value="launch_date">Sort: Launch Date</option>
          <option value="start_date">Sort: Start Date</option>
          <option value="name">Sort: Name</option>
          <option value="progress">Sort: Progress</option>
        </select>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} style={{fontSize:'13px', padding:'4px 8px', borderRadius:'4px', border:'1px solid #ddd'}}>
          <option value="all">All Types</option>
          <option value="course-launch">Course Launch</option>
          <option value="newsletter">Newsletter</option>
          <option value="podcast">Podcast</option>
          <option value="subscription">Subscription</option>
          <option value="operations">Operations</option>
        </select>
      </div>

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

                <div className="mt-2 mb-1 space-y-0.5">
                  <p className="text-xs font-fira text-fe-anthracite">
                    📅 Started: {new Date(project.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-xs font-fira">
                    {project.launch_date ? (
                      <span className="text-fe-anthracite">🚀 Launch: {new Date(project.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    ) : (
                      <span className="text-gray-400">🚀 No launch date set</span>
                    )}
                  </p>
                </div>

                <p className="text-sm text-fe-anthracite mt-1 mb-3">
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
