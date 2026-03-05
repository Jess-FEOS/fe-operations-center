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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [projectsRes, teamRes, tasksRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/team'),
          fetch('/api/tasks/this-week'),
        ]);

        const projectsData = await projectsRes.json();
        const teamData = await teamRes.json();
        const tasksData = await tasksRes.json();

        setProjects(Array.isArray(projectsData) ? projectsData : []);
        setTeam(Array.isArray(teamData) ? teamData : []);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const activeProjectCount = projects.filter((p) => p.status === 'active').length || projects.length;
  const dueThisWeekCount = tasks.length;
  const overdueCount = tasks.filter(
    (t) => t.status !== 'done' && t.due_date < today
  ).length;
  const completedThisWeekCount = tasks.filter((t) => t.status === 'done').length;

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
