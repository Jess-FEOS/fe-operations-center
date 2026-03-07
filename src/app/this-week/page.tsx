'use client'

import { useEffect, useState } from 'react'
import Avatar from '@/components/Avatar'
import StatusBadge from '@/components/StatusBadge'
import WorkflowBadge from '@/components/WorkflowBadge'
import { TaskStatus } from '@/lib/types'

interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
  role: string
  role_data: { id: string; name: string; color: string } | null
}

interface WeekTask {
  id: string
  task_name: string
  project_id: string
  project_name: string
  workflow_type: string
  phase: string
  status: TaskStatus
  due_date: string
  owner_ids: string[]
}

export default function ThisWeekPage() {
  const [tasks, setTasks] = useState<WeekTask[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [selectedMember, setSelectedMember] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tasks/this-week')
      .then((res) => res.json())
      .then(setTasks)
    fetch('/api/team')
      .then((res) => res.json())
      .then(setTeam)
  }, [])

  const teamById = team.reduce<Record<string, TeamMember>>((acc, m) => {
    acc[m.id] = m
    return acc
  }, {})

  const filteredTasks = selectedMember
    ? tasks.filter((t) => t.owner_ids.includes(selectedMember))
    : tasks

  const grouped = filteredTasks.reduce<Record<string, WeekTask[]>>((acc, task) => {
    if (!acc[task.project_name]) acc[task.project_name] = []
    acc[task.project_name].push(task)
    return acc
  }, {})

  async function handleStatusChange(task: WeekTask, newStatus: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    )
    await fetch(`/api/projects/${task.project_id}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">
        This Week
      </h1>

      {/* Filter bar */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedMember(null)}
          className={`flex flex-col items-center gap-1 ${
            selectedMember === null ? 'ring-2 ring-fe-blue ring-offset-2 rounded-full' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-[10px] font-fira font-bold shrink-0">
            ALL
          </div>
          <span className="text-xs text-fe-navy font-fira">All</span>
        </button>
        {team.map((member) => (
          <button
            key={member.id}
            onClick={() => setSelectedMember(member.id)}
            className={`flex flex-col items-center gap-1 ${
              selectedMember === member.id
                ? 'ring-2 ring-fe-blue ring-offset-2 rounded-full'
                : ''
            }`}
          >
            <Avatar initials={member.initials} color={member.color} />
            <span className="text-xs text-fe-navy font-fira">
              {member.name.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Task list grouped by project */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-fe-blue-gray text-sm font-fira">
          No tasks scheduled for this week.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([projectName, projectTasks]) => (
            <div key={projectName} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-barlow font-bold text-sm text-fe-navy">
                  {projectName}
                </span>
                <WorkflowBadge type={projectTasks[0].workflow_type} />
              </div>

              <div className="space-y-2">
                {projectTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-gray-100 p-4 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="font-fira font-bold text-sm text-fe-navy">
                          {task.task_name}
                        </p>
                        <p className="text-fe-blue-gray text-xs">
                          {task.project_name}
                        </p>
                        <p className="text-xs text-gray-400">{task.phase}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.owner_ids.map((oid) => {
                          const member = teamById[oid]
                          return member ? (
                            <div key={oid} className="flex items-center gap-1">
                              <Avatar
                                initials={member.initials}
                                color={member.color}
                                size="sm"
                              />
                              <span className="text-xs font-fira text-fe-blue-gray">
                                {member.role_data ? (
                                  <><span className="font-bold" style={{ color: member.role_data.color }}>{member.role_data.name}</span> &middot; {member.name.split(' ')[0]}</>
                                ) : member.name.split(' ')[0]}
                              </span>
                            </div>
                          ) : null
                        })}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <StatusBadge
                        status={task.status}
                        interactive
                        onClick={(newStatus) =>
                          handleStatusChange(task, newStatus)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
