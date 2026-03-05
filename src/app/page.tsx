'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import WorkflowBadge from '@/components/WorkflowBadge';
import ProgressBar from '@/components/ProgressBar';

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
}

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  color: string;
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
  const [loading, setLoading] = useState(true);
  const [overdueExpanded, setOverdueExpanded] = useState(false);
  const [overdueThisWeekOnly, setOverdueThisWeekOnly] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      try {
        const [projectsRes, teamRes, tasksRes, overdueRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/team'),
          fetch('/api/tasks/this-week'),
          fetch('/api/tasks/overdue').catch(() => null),
        ]);

        const projectsData = await projectsRes.json();
        const teamData = await teamRes.json();
        const tasksData = await tasksRes.json();
        const overdueData = overdueRes ? await overdueRes.json() : [];

        setProjects(Array.isArray(projectsData) ? projectsData : []);
        setTeam(Array.isArray(teamData) ? teamData : []);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setOverdueTasks(Array.isArray(overdueData) ? overdueData : []);
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
