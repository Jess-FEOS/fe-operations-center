'use client';

import { useState, useEffect } from 'react';
import Avatar from '@/components/Avatar';
import { STATUS_COLORS, STATUS_LABELS, TaskStatus } from '@/lib/types';

interface TeamMember {
  id: string;
  name: string;
  role: string;
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
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDigest, setShowDigest] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [teamRes, tasksRes] = await Promise.all([
          fetch('/api/team'),
          fetch('/api/tasks/this-week'),
        ]);

        const teamData = await teamRes.json();
        const tasksData = await tasksRes.json();

        setTeam(Array.isArray(teamData) ? teamData : []);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      } catch (error) {
        console.error('Failed to fetch team data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  function getTasksForMember(memberId: string) {
    return tasks.filter((t) => t.owner_ids?.includes(memberId));
  }

  function getCompletedForMember(memberId: string) {
    return tasks.filter(
      (t) => t.owner_ids?.includes(memberId) && t.status === 'done'
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-fe-navy font-fira text-lg">Loading team...</div>
      </div>
    );
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  if (showDigest) {
    return (
      <div className="font-fira">
        <div className="flex items-center justify-between mb-6 no-print">
          <button
            onClick={() => setShowDigest(false)}
            className="flex items-center gap-1 text-sm text-fe-blue-gray hover:text-fe-navy font-fira transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Team
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-fe-navy text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-navy/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>

        <div className="mb-6">
          <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">Weekly Digest</h1>
          <p className="text-sm text-fe-blue-gray mt-1">{weekLabel}</p>
        </div>

        <div className="space-y-6">
          {team.map(member => {
            const memberTasks = getTasksForMember(member.id);
            if (memberTasks.length === 0) return null;

            return (
              <div key={member.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar initials={member.initials} color={member.color} size="md" />
                  <div>
                    <div className="font-barlow font-bold text-lg text-fe-navy">{member.name}</div>
                    <div className="text-xs text-fe-blue-gray">{member.role} &middot; {memberTasks.length} task{memberTasks.length !== 1 ? 's' : ''} this week</div>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-xs text-fe-blue-gray font-fira font-normal">Task</th>
                      <th className="text-left py-2 text-xs text-fe-blue-gray font-fira font-normal">Project</th>
                      <th className="text-left py-2 text-xs text-fe-blue-gray font-fira font-normal">Due</th>
                      <th className="text-right py-2 text-xs text-fe-blue-gray font-fira font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberTasks.map(task => (
                      <tr key={task.id} className="border-b border-gray-50 last:border-b-0">
                        <td className="py-2 font-fira text-fe-anthracite">{task.task_name}</td>
                        <td className="py-2 font-fira text-fe-blue-gray">{task.project_name}</td>
                        <td className="py-2 font-fira text-fe-blue-gray">
                          {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-fira font-bold"
                            style={{
                              backgroundColor: `${STATUS_COLORS[task.status as TaskStatus] || '#9CA3AF'}15`,
                              color: STATUS_COLORS[task.status as TaskStatus] || '#9CA3AF',
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[task.status as TaskStatus] || '#9CA3AF' }}
                            />
                            {STATUS_LABELS[task.status as TaskStatus] || task.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {team.every(m => getTasksForMember(m.id).length === 0) && (
            <p className="text-center text-fe-blue-gray py-8">No tasks due this week.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="font-fira">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">
          Team
        </h1>
        <button
          onClick={() => setShowDigest(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Weekly Digest
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {team.map((member) => {
          const memberTasks = getTasksForMember(member.id);
          const completedTasks = getCompletedForMember(member.id);
          const totalThisWeek = memberTasks.length;
          const completedThisWeek = completedTasks.length;
          const completionRate =
            totalThisWeek > 0
              ? Math.round((completedThisWeek / totalThisWeek) * 100)
              : null;

          return (
            <div
              key={member.id}
              className="bg-white rounded-xl border border-gray-100 p-6"
            >
              <div className="flex justify-center mb-3">
                <Avatar
                  initials={member.initials}
                  color={member.color}
                  size="lg"
                />
              </div>

              <div className="font-barlow font-bold text-lg text-center text-fe-navy">
                {member.name}
              </div>
              <div className="font-fira text-sm text-fe-blue-gray text-center">
                {member.role}
              </div>

              <div className="border-t border-gray-100 my-4" />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-fe-blue-gray">
                    Tasks This Week
                  </span>
                  <span className="font-bold">{totalThisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-fe-blue-gray">
                    Completed This Week
                  </span>
                  <span className="font-bold">{completedThisWeek}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-fe-blue-gray">
                    Completion Rate
                  </span>
                  <span className="font-bold">
                    {completionRate !== null ? `${completionRate}%` : 'N/A'}
                  </span>
                </div>
              </div>

              {totalThisWeek > 8 && (
                <div className="bg-amber-50 text-amber-700 rounded-lg p-2 text-xs mt-4 text-center">
                  Heavy workload this week
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
