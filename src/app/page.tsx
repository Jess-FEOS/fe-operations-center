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
  priority_title?: string | null;
  priority_status?: string | null;
  revenue_goal?: number | null;
  enrollment_goal?: number | null;
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
  status: string;
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

interface EnrollmentRow {
  id: string;
  name: string;
  enrollment_goal: number | null;
  enrollment_actual: number;
  revenue_goal: number | null;
  revenue_actual: number;
  launch_date: string | null;
}

interface AttentionNeeded {
  overdue_count: number;
  no_priority_projects: { id: string; name: string }[];
  stalled_launching_soon: { id: string; name: string; launch_date: string }[];
}

interface AtRiskProject {
  id: string;
  name: string;
  launch_date: string;
  days_until_launch: number;
  phase_breakdown: Record<string, { total: number; done: number }>;
  total_tasks: number;
  risk_reason: string;
}

interface ActivityEntry {
  id: string;
  project_id: string;
  project_name: string;
  action: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

const MONTH_OPTIONS = [
  { value: '2026-03', label: 'March 2026' },
  { value: '2026-04', label: 'April 2026' },
  { value: '2026-05', label: 'May 2026' },
];

const ALL_STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'done', 'blocked'];

export default function Dashboard() {
  const [projectsRaw, setProjectsRaw] = useState<Project[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<UnassignedTask[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [overdueNotStartedExpanded, setOverdueNotStartedExpanded] = useState(false);
  const [overdueInProgressExpanded, setOverdueInProgressExpanded] = useState(false);
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
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
  const [collapsedPriorityGroups, setCollapsedPriorityGroups] = useState<Set<string>>(new Set());
  const manualFormRef = useRef<HTMLDivElement>(null);

  // New dashboard sections
  const [nextLaunch, setNextLaunch] = useState<Project | null>(null);
  const [enrollmentTracker, setEnrollmentTracker] = useState<EnrollmentRow[]>([]);
  const [attentionNeeded, setAttentionNeeded] = useState<AttentionNeeded>({ overdue_count: 0, no_priority_projects: [], stalled_launching_soon: [] });

  // At Risk & Recent Changes
  const [atRiskProjects, setAtRiskProjects] = useState<AtRiskProject[]>([]);
  const [recentChanges, setRecentChanges] = useState<ActivityEntry[]>([]);

  // Metric logging modal
  const [logMetricProjectId, setLogMetricProjectId] = useState<string | null>(null);
  const [logMetricName, setLogMetricName] = useState('enrollments');
  const [logMetricValue, setLogMetricValue] = useState('');
  const [logMetricSaving, setLogMetricSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashboardRes, teamRes, prioritiesRes, tasksRes, overdueRes, unassignedRes, rolesRes, projectsListRes, activityRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/team'),
          fetch('/api/priorities'),
          fetch('/api/tasks/this-week'),
          fetch('/api/tasks/overdue').catch(() => null),
          fetch('/api/tasks/unassigned').catch(() => null),
          fetch('/api/roles').catch(() => null),
          fetch('/api/projects').catch(() => null),
          fetch('/api/activity-log').catch(() => null),
        ]);

        const dashboardData = await dashboardRes.json();
        const teamData = await teamRes.json();
        const allPrioritiesData = await prioritiesRes.json();
        const tasksData = await tasksRes.json();
        const overdueData = overdueRes ? await overdueRes.json() : [];
        const unassignedData = unassignedRes ? await unassignedRes.json() : [];
        const rolesData = rolesRes ? await rolesRes.json() : [];
        const projectsListData = projectsListRes ? await projectsListRes.json() : [];
        const activityData = activityRes ? await activityRes.json() : [];

        setProjectsRaw(Array.isArray(dashboardData.active_projects) ? dashboardData.active_projects : []);
        setTeam(Array.isArray(teamData) ? teamData : []);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setOverdueTasks(Array.isArray(overdueData) ? overdueData : []);
        setUnassignedTasks(Array.isArray(unassignedData) ? unassignedData : []);
        setRoles(Array.isArray(rolesData) ? rolesData : []);
        setAllProjectsList(Array.isArray(projectsListData) ? projectsListData : []);
        setCampaigns(Array.isArray(dashboardData.active_campaigns) ? dashboardData.active_campaigns : []);
        setNextLaunch(dashboardData.next_launch || null);
        setEnrollmentTracker(Array.isArray(dashboardData.enrollment_tracker) ? dashboardData.enrollment_tracker : []);
        setAttentionNeeded(dashboardData.attention_needed || { overdue_count: 0, no_priority_projects: [], stalled_launching_soon: [] });
        setAtRiskProjects(Array.isArray(dashboardData.at_risk_projects) ? dashboardData.at_risk_projects : []);
        setRecentChanges(Array.isArray(activityData) ? activityData : []);

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

  const activeProjectCount = projectsRaw.filter((p) => p.status === 'active').length || projectsRaw.length;
  const dueThisWeekCount = tasks.length;
  const overdueCount = overdueTasks.length;
  const completedThisWeekCount = tasks.filter((t) => t.status === 'done').length;

  const daysOverdue = (dueDate: string) => {
    const due = new Date(dueDate + 'T00:00:00');
    const n = new Date();
    n.setHours(0, 0, 0, 0);
    return Math.floor((n.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Split overdue tasks by status category
  const overdueNotStarted = overdueTasks.filter(t => t.status === 'not_started');
  const overdueInProgress = overdueTasks.filter(t => t.status === 'in_progress');

  const groupByProject = (tasks: OverdueTask[]) => {
    const byProject = tasks.reduce<Record<string, { projectName: string; projectId: string; tasks: OverdueTask[] }>>((acc, task) => {
      if (!acc[task.project_id]) {
        acc[task.project_id] = { projectName: task.project_name, projectId: task.project_id, tasks: [] };
      }
      acc[task.project_id].tasks.push(task);
      return acc;
    }, {});
    return Object.values(byProject).sort((a, b) => b.tasks.length - a.tasks.length);
  };
  const notStartedGroups = groupByProject(overdueNotStarted);
  const inProgressGroups = groupByProject(overdueInProgress);

  // Group priorities by linked project
  const priorityGroups = (() => {
    const groups: { key: string; projectName: string; projectId: string | null; priorities: Priority[] }[] = [];
    const groupMap = new Map<string, Priority[]>();
    for (const p of priorities) {
      const key = p.project_id || '__general__';
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(p);
    }
    // Named projects first, sorted alphabetically, then General last
    const projectKeys = Array.from(groupMap.keys()).filter(k => k !== '__general__').sort((a, b) => {
      const nameA = groupMap.get(a)![0].project_name || '';
      const nameB = groupMap.get(b)![0].project_name || '';
      return nameA.localeCompare(nameB);
    });
    for (const key of projectKeys) {
      const items = groupMap.get(key)!;
      groups.push({ key, projectName: items[0].project_name || 'Unknown', projectId: key, priorities: items });
    }
    if (groupMap.has('__general__')) {
      groups.push({ key: '__general__', projectName: 'General', projectId: null, priorities: groupMap.get('__general__')! });
    }
    return groups;
  })();

  const togglePriorityGroup = (key: string) => {
    setCollapsedPriorityGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const teamMap = new Map(team.map((m) => [m.id, m]));

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

  function monthBefore(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const suggestedProjects = allProjectsList.filter(p => {
    if (p.priority_id) return false;
    if (!p.launch_date) return false;
    const ld = new Date(p.launch_date + 'T00:00:00');
    return ld >= now && ld <= in90Days;
  });

  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const ghostProjects = allProjectsList.filter(p => {
    if (p.priority_id) return false;
    if (!p.launch_date) return false;
    const ld = new Date(p.launch_date + 'T00:00:00');
    return ld >= now && ld <= in60Days;
  });

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
    setTimeout(() => {
      manualFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      manualFormRef.current?.classList.add('ring-2', 'ring-fe-blue');
      setTimeout(() => manualFormRef.current?.classList.remove('ring-2', 'ring-fe-blue'), 1500);
    }, 50);
  }

  function openGhostPriority(proj: { id: string; name: string; workflow_type: string; launch_date?: string | null }) {
    useSuggestion(proj);
    setShowAddForm(true);
  }

  // Countdown helper
  const daysUntil = (dateStr: string) => {
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Log metric handler
  const handleLogMetric = async () => {
    if (!logMetricProjectId || !logMetricValue) return;
    setLogMetricSaving(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: logMetricProjectId,
          metric_name: logMetricName,
          metric_value: parseFloat(logMetricValue),
          metric_date: todayStr,
        }),
      });
      if (res.ok) {
        // Update local tracker state
        setEnrollmentTracker(prev => prev.map(row => {
          if (row.id !== logMetricProjectId) return row;
          if (logMetricName === 'enrollments') return { ...row, enrollment_actual: parseFloat(logMetricValue) };
          if (logMetricName === 'revenue') return { ...row, revenue_actual: parseFloat(logMetricValue) };
          return row;
        }));
        setLogMetricProjectId(null);
        setLogMetricValue('');
      }
    } catch (err) {
      console.error('Failed to log metric:', err);
    } finally {
      setLogMetricSaving(false);
    }
  };

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

  const hasAttentionItems = attentionNeeded.overdue_count > 0 || attentionNeeded.no_priority_projects.length > 0 || attentionNeeded.stalled_launching_soon.length > 0;

  function getRelativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

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

      {/* ===== 1. NEXT LAUNCH COUNTDOWN ===== */}
      {nextLaunch ? (
        <div className="mb-8 bg-gradient-to-r from-fe-navy to-fe-blue rounded-xl p-6 text-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-fira uppercase tracking-widest text-white/60 mb-1">Next Launch</p>
              <h2 className="font-barlow font-extrabold text-2xl leading-tight mb-2">{nextLaunch.name}</h2>
              <div className="flex items-center gap-3 mb-4">
                <WorkflowBadge type={nextLaunch.workflow_type} />
                {nextLaunch.launch_date && (
                  <span className="text-sm font-fira text-white/80">
                    {new Date(nextLaunch.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
              {nextLaunch.priority_title ? (
                <p className="text-sm font-fira text-white/70 mb-4">
                  Priority: {nextLaunch.priority_title}
                </p>
              ) : (
                <p className="text-sm font-fira text-amber-300 mb-4">
                  &#9888;&#65039; No priority set
                </p>
              )}
              <div className="mb-2">
                <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${nextLaunch.progress}%`, backgroundColor: nextLaunch.progress >= 75 ? '#22c55e' : nextLaunch.progress >= 40 ? '#B29838' : '#ef4444' }}
                  />
                </div>
                <p className="text-xs font-fira text-white/70 mt-1">
                  {nextLaunch.done_tasks}/{nextLaunch.total_tasks} tasks complete ({nextLaunch.progress}%)
                </p>
              </div>
              <Link href={`/projects/${nextLaunch.id}`} className="inline-flex items-center gap-1 text-sm font-fira font-bold text-white hover:text-white/80 transition-colors mt-1">
                View Project &rarr;
              </Link>
            </div>
            {nextLaunch.launch_date && (
              <div className="text-center px-6 py-4 bg-white/10 rounded-xl shrink-0">
                <div className="text-5xl font-barlow font-extrabold">{daysUntil(nextLaunch.launch_date)}</div>
                <div className="text-sm font-fira text-white/70 mt-1">days until launch</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-8 bg-white border border-gray-100 rounded-xl p-6">
          <p className="text-xs font-fira uppercase tracking-widest text-fe-blue-gray mb-1">Next Launch</p>
          <p className="text-sm text-fe-blue-gray font-fira">No upcoming launches scheduled. Set a launch date on a project to see the countdown.</p>
        </div>
      )}

      {/* Overdue: Not Started (Red) */}
      {overdueNotStarted.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setOverdueNotStartedExpanded(!overdueNotStartedExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-100/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-2.99L13.73 4.01c-.77-1.33-2.69-1.33-3.46 0L3.34 16.01C2.57 17.33 3.53 19 5.07 19z" />
              </svg>
              <span className="font-barlow font-bold text-red-700 text-sm">
                {overdueNotStarted.length} task{overdueNotStarted.length !== 1 ? 's' : ''} not started and overdue
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-fira text-red-600">
              {overdueNotStartedExpanded ? 'Collapse' : 'View All'}
              <svg className={`w-4 h-4 transition-transform ${overdueNotStartedExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {overdueNotStartedExpanded && (
            <div className="px-4 pb-4">
              <div className="space-y-3 pt-2 border-t border-red-200">
                {notStartedGroups.map(group => {
                  const showAll = expandedProjects.has('ns-' + group.projectId);
                  const visible = showAll ? group.tasks : group.tasks.slice(0, 5);
                  const hasMore = group.tasks.length > 5;
                  return (
                    <div key={group.projectId}>
                      <Link href={`/projects/${group.projectId}`} className="flex items-center gap-2 mb-1.5 hover:opacity-80 transition-opacity">
                        <h3 className="text-xs font-barlow font-bold text-red-800">{group.projectName}</h3>
                        <span className="text-xs font-fira text-red-500">({group.tasks.length})</span>
                      </Link>
                      <div className="space-y-1">
                        {visible.map(task => (
                          <Link key={task.id} href={`/projects/${task.project_id}`} className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-red-100 hover:border-red-300 transition-colors group">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex -space-x-1 shrink-0">
                                {task.owner_ids?.map(oid => { const m = teamMap.get(oid); return m ? <Avatar key={oid} initials={m.initials} color={m.color} size="sm" /> : null; })}
                                {(!task.owner_ids || task.owner_ids.length === 0) && (
                                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                  </div>
                                )}
                              </div>
                              <span className="text-sm font-fira text-fe-anthracite truncate group-hover:text-fe-navy transition-colors">{task.task_name}</span>
                            </div>
                            <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-fira font-bold bg-red-100 text-red-600">{daysOverdue(task.due_date)}d</span>
                          </Link>
                        ))}
                      </div>
                      {hasMore && !showAll && (
                        <button onClick={() => toggleProjectExpanded('ns-' + group.projectId)} className="mt-1 text-xs font-fira text-red-500 hover:text-red-700 transition-colors">Show {group.tasks.length - 5} more...</button>
                      )}
                      {hasMore && showAll && (
                        <button onClick={() => toggleProjectExpanded('ns-' + group.projectId)} className="mt-1 text-xs font-fira text-red-500 hover:text-red-700 transition-colors">Show less</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overdue: In Progress (Amber) */}
      {overdueInProgress.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setOverdueInProgressExpanded(!overdueInProgressExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-barlow font-bold text-amber-700 text-sm">
                {overdueInProgress.length} task{overdueInProgress.length !== 1 ? 's' : ''} in progress past due date
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-fira text-amber-600">
              {overdueInProgressExpanded ? 'Collapse' : 'View All'}
              <svg className={`w-4 h-4 transition-transform ${overdueInProgressExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {overdueInProgressExpanded && (
            <div className="px-4 pb-4">
              <div className="space-y-3 pt-2 border-t border-amber-200">
                {inProgressGroups.map(group => {
                  const showAll = expandedProjects.has('ip-' + group.projectId);
                  const visible = showAll ? group.tasks : group.tasks.slice(0, 5);
                  const hasMore = group.tasks.length > 5;
                  return (
                    <div key={group.projectId}>
                      <Link href={`/projects/${group.projectId}`} className="flex items-center gap-2 mb-1.5 hover:opacity-80 transition-opacity">
                        <h3 className="text-xs font-barlow font-bold text-amber-800">{group.projectName}</h3>
                        <span className="text-xs font-fira text-amber-500">({group.tasks.length})</span>
                      </Link>
                      <div className="space-y-1">
                        {visible.map(task => (
                          <Link key={task.id} href={`/projects/${task.project_id}`} className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-amber-100 hover:border-amber-300 transition-colors group">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex -space-x-1 shrink-0">
                                {task.owner_ids?.map(oid => { const m = teamMap.get(oid); return m ? <Avatar key={oid} initials={m.initials} color={m.color} size="sm" /> : null; })}
                                {(!task.owner_ids || task.owner_ids.length === 0) && (
                                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                  </div>
                                )}
                              </div>
                              <span className="text-sm font-fira text-fe-anthracite truncate group-hover:text-fe-navy transition-colors">{task.task_name}</span>
                            </div>
                            <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-fira font-bold bg-amber-100 text-amber-600">{daysOverdue(task.due_date)}d</span>
                          </Link>
                        ))}
                      </div>
                      {hasMore && !showAll && (
                        <button onClick={() => toggleProjectExpanded('ip-' + group.projectId)} className="mt-1 text-xs font-fira text-amber-500 hover:text-amber-700 transition-colors">Show {group.tasks.length - 5} more...</button>
                      )}
                      {hasMore && showAll && (
                        <button onClick={() => toggleProjectExpanded('ip-' + group.projectId)} className="mt-1 text-xs font-fira text-amber-500 hover:text-amber-700 transition-colors">Show less</button>
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
          <div className="space-y-3">
            {priorityGroups.map(group => {
              const isCollapsed = collapsedPriorityGroups.has(group.key);
              const doneCount = group.priorities.filter(p => p.status === 'done').length;
              return (
                <div key={group.key} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => togglePriorityGroup(group.key)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-fe-blue-gray transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {group.projectId ? (
                        <Link href={`/projects/${group.projectId}`} onClick={e => e.stopPropagation()} className="font-barlow font-bold text-sm text-fe-navy hover:text-fe-blue transition-colors">
                          {group.projectName}
                        </Link>
                      ) : (
                        <span className="font-barlow font-bold text-sm text-fe-blue-gray">{group.projectName}</span>
                      )}
                      <span className="text-xs font-fira text-fe-blue-gray">
                        {doneCount}/{group.priorities.length} done
                      </span>
                    </div>
                  </button>
                  {/* Group Items */}
                  {!isCollapsed && (
                    <div className="space-y-2 p-3">
                      {group.priorities.map(priority => {
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

      {/* ===== AT RISK ===== */}
      <div className="mb-8 bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-barlow font-extrabold text-xl text-fe-navy mb-1">At Risk</h2>
        <p className="text-xs font-fira text-fe-blue-gray mb-4">Programs that need attention before launch</p>
        {atRiskProjects.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-100">
            <span className="text-green-500 text-sm font-bold">&#9989;</span>
            <span className="text-sm font-fira text-green-700">All programs on track</span>
          </div>
        ) : (
          <div className="space-y-3">
            {atRiskProjects.map(proj => {
              const pb = proj.phase_breakdown;
              const phases = ['Build', 'Market', 'Launch & Run'] as const;
              return (
                <div key={proj.id} className="border border-red-100 rounded-lg p-4 bg-red-50/30">
                  <div className="flex items-center justify-between mb-2">
                    <Link href={`/projects/${proj.id}`} className="font-barlow font-bold text-sm text-fe-navy hover:text-fe-blue transition-colors">
                      {proj.name}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-fira text-fe-blue-gray">
                        {new Date(proj.launch_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-xs font-fira font-bold text-fe-red">
                        {proj.days_until_launch}d away
                      </span>
                    </div>
                  </div>
                  {/* Phase breakdown bar */}
                  {proj.total_tasks > 0 && (
                    <div className="flex h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                      {phases.map(sp => {
                        const stats = pb[sp];
                        if (!stats || stats.total === 0) return null;
                        const widthPct = (stats.total / proj.total_tasks) * 100;
                        const donePct = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;
                        const color = sp === 'Build' ? '#1B365D' : sp === 'Market' ? '#0762C8' : '#046A38';
                        return (
                          <div key={sp} className="relative h-full" style={{ width: `${widthPct}%` }}>
                            <div className="absolute inset-0 opacity-20" style={{ backgroundColor: color }} />
                            <div className="absolute left-0 top-0 bottom-0" style={{ width: `${donePct}%`, backgroundColor: color }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs font-fira text-red-600">{proj.risk_reason}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== RECENT CHANGES ===== */}
      <div className="mb-8 bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-barlow font-extrabold text-xl text-fe-navy mb-1">Recent Changes</h2>
        <p className="text-xs font-fira text-fe-blue-gray mb-4">Latest project activity</p>
        {recentChanges.length === 0 ? (
          <p className="text-sm text-fe-blue-gray font-fira">No recent changes — activity will appear here as projects are updated.</p>
        ) : (
          <div className="space-y-2">
            {recentChanges.map(entry => {
              const timeAgo = getRelativeTime(entry.created_at);
              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="shrink-0 mt-0.5">
                    {entry.action === 'created' ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-bold">+</span>
                    ) : entry.action === 'launch_date_changed' ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-fe-blue text-xs font-bold">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600 text-xs font-bold">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/projects/${entry.project_id}`} className="font-fira text-sm font-bold text-fe-navy hover:text-fe-blue transition-colors truncate">
                        {entry.project_name}
                      </Link>
                      <span className="text-xs font-fira text-fe-blue-gray shrink-0">{timeAgo}</span>
                    </div>
                    <p className="text-xs font-fira text-fe-anthracite mt-0.5">{entry.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== 2. ENROLLMENT & REVENUE TRACKER ===== */}
      <div className="mb-8 bg-white border border-gray-100 rounded-xl p-5">
        <h2 className="font-barlow font-extrabold text-xl text-fe-navy mb-1">Enrollment &amp; Revenue Tracker</h2>
        <p className="text-xs font-fira text-fe-blue-gray mb-4">Course launches with enrollment or revenue goals</p>
        {enrollmentTracker.length === 0 ? (
          <p className="text-sm text-fe-blue-gray font-fira">No enrollment or revenue goals set — add them by editing a project.</p>
        ) : (
          <div className="space-y-3">
            {enrollmentTracker.map(row => {
              const enrollPct = row.enrollment_goal ? Math.min(100, Math.round((row.enrollment_actual / row.enrollment_goal) * 100)) : 0;
              const revPct = row.revenue_goal ? Math.min(100, Math.round((row.revenue_actual / row.revenue_goal) * 100)) : 0;
              return (
                <div key={row.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Link href={`/projects/${row.id}`} className="font-barlow font-bold text-sm text-fe-navy hover:text-fe-blue transition-colors">{row.name}</Link>
                    <button
                      onClick={() => { setLogMetricProjectId(row.id); setLogMetricName('enrollments'); setLogMetricValue(''); }}
                      className="px-2.5 py-1 rounded text-xs font-fira font-bold text-fe-blue border border-fe-blue/20 hover:bg-blue-50 transition-colors"
                    >
                      Log Result
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {row.enrollment_goal && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-fira text-fe-blue-gray">Enrollment</span>
                          <span className="text-xs font-fira font-bold text-fe-anthracite">{row.enrollment_actual}/{row.enrollment_goal}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${enrollPct}%`, backgroundColor: enrollPct >= 75 ? '#22c55e' : enrollPct >= 40 ? '#B29838' : '#ef4444' }} />
                        </div>
                      </div>
                    )}
                    {row.revenue_goal && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-fira text-fe-blue-gray">Revenue</span>
                          <span className="text-xs font-fira font-bold text-fe-anthracite">${row.revenue_actual.toLocaleString()}/${('$' + row.revenue_goal.toLocaleString())}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${revPct}%`, backgroundColor: revPct >= 75 ? '#22c55e' : revPct >= 40 ? '#B29838' : '#ef4444' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Metric Modal */}
      {logMetricProjectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setLogMetricProjectId(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-barlow font-bold text-lg text-fe-navy mb-4">Log Result</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Project</label>
                <p className="text-sm font-fira text-fe-navy font-bold">{enrollmentTracker.find(r => r.id === logMetricProjectId)?.name}</p>
              </div>
              <div>
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Metric</label>
                <select
                  value={logMetricName}
                  onChange={e => setLogMetricName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue bg-white"
                >
                  <option value="enrollments">Enrollments</option>
                  <option value="revenue">Revenue ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-fira text-fe-blue-gray mb-1">Value</label>
                <input
                  type="number"
                  value={logMetricValue}
                  onChange={e => setLogMetricValue(e.target.value)}
                  placeholder={logMetricName === 'revenue' ? 'e.g. 15000' : 'e.g. 30'}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-fira text-fe-anthracite focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleLogMetric}
                disabled={!logMetricValue || logMetricSaving}
                className="px-4 py-1.5 rounded-lg text-xs font-fira font-bold text-white bg-fe-blue hover:bg-fe-blue/90 transition-colors disabled:opacity-50"
              >
                {logMetricSaving ? 'Saving...' : 'Log'}
              </button>
              <button
                onClick={() => setLogMetricProjectId(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-fira font-bold text-fe-anthracite bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 3. ATTENTION NEEDED ===== */}
      {hasAttentionItems && (
        <div className="mb-8 bg-white border border-gray-100 rounded-xl p-5">
          <h2 className="font-barlow font-extrabold text-xl text-fe-navy mb-4">Attention Needed</h2>
          <div className="space-y-3">
            {attentionNeeded.overdue_count > 0 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-red-50 border border-red-100">
                <div className="flex items-center gap-2">
                  <span className="text-red-500 text-sm font-bold">&#128308;</span>
                  <span className="text-sm font-fira text-red-700">
                    <span className="font-bold">{attentionNeeded.overdue_count}</span> overdue task{attentionNeeded.overdue_count !== 1 ? 's' : ''}
                  </span>
                </div>
                <Link href="/this-week" className="text-xs font-fira font-bold text-red-600 hover:text-red-800 transition-colors">
                  View All &rarr;
                </Link>
              </div>
            )}

            {attentionNeeded.no_priority_projects.length > 0 && (
              <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-amber-500 text-sm font-bold">&#9888;&#65039;</span>
                  <span className="text-sm font-fira text-amber-700 font-bold">Projects with no priority linked</span>
                </div>
                <div className="space-y-1.5">
                  {attentionNeeded.no_priority_projects.map(proj => (
                    <div key={proj.id} className="flex items-center justify-between">
                      <Link href={`/projects/${proj.id}`} className="text-sm font-fira text-fe-anthracite hover:text-fe-navy transition-colors">{proj.name}</Link>
                      <button
                        onClick={() => {
                          const match = allProjectsList.find(p => p.id === proj.id);
                          if (match) openGhostPriority(match);
                        }}
                        className="text-xs font-fira font-bold text-amber-600 hover:text-amber-800 transition-colors"
                      >
                        + Set Priority
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attentionNeeded.stalled_launching_soon.length > 0 && (
              <div className="px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-500 text-sm font-bold">&#128993;</span>
                  <span className="text-sm font-fira text-yellow-700 font-bold">Launching within 30 days with 0% progress</span>
                </div>
                <div className="space-y-1.5">
                  {attentionNeeded.stalled_launching_soon.map(proj => (
                    <div key={proj.id} className="flex items-center justify-between">
                      <Link href={`/projects/${proj.id}`} className="text-sm font-fira text-fe-anthracite hover:text-fe-navy transition-colors">{proj.name}</Link>
                      <span className="text-xs font-fira text-yellow-600">
                        {new Date(proj.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
    </div>
  );
}
