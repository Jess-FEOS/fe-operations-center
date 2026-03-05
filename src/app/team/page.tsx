'use client';

import { useState, useEffect } from 'react';
import Avatar from '@/components/Avatar';

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

  return (
    <div className="font-fira">
      <h1 className="font-barlow font-extrabold text-2xl text-fe-navy mb-6">
        Team
      </h1>

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
