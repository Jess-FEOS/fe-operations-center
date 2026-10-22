'use client'

import { useEffect, useState } from 'react'
import Avatar from '@/components/Avatar'
import StatusBadge from '@/components/StatusBadge'
import WorkflowBadge from '@/components/WorkflowBadge'
import PageHeader from '@/components/PageHeader'
import { TaskStatus } from '@/lib/types'

interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
  role: string
  role_data: { id: string; name: string; color: string } | null
}

interface Role {
  id: string
  name: string
  color: string
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
  resolved_owner_ids?: string[]
  ownership_issue?: string | null
  role_id: string | null
}

export default function ThisWeekPage() {
  const [tasks, setTasks] = useState<WeekTask[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all(['/api/tasks/this-week','/api/team','/api/roles'].map(async url=>{
      const res=await fetch(url), data=await res.json()
      if(!res.ok || !Array.isArray(data)) throw new Error('Could not load complete work data. Please retry.')
      return data
    })).then(([work,people,roles])=>{setTasks(work);setTeam(people);setRoles(roles)})
      .catch(e=>setLoadError(e.message))
      .finally(()=>setLoading(false))
  }, [])

  const teamById = team.reduce<Record<string, TeamMember>>((acc, m) => {
    acc[m.id] = m
    return acc
  }, {})

  const filteredTasks = selectedMember
    ? tasks.filter((t) => (t.resolved_owner_ids ?? t.owner_ids).includes(selectedMember))
    : tasks

  const grouped = filteredTasks.reduce<Record<string, WeekTask[]>>((acc, task) => {
    if (!acc[task.project_name]) acc[task.project_name] = []
    acc[task.project_name].push(task)
    return acc
  }, {})

  async function handleStatusChange(task: WeekTask, newStatus: TaskStatus) {
    try {
    const res=await fetch(`/api/projects/${task.project_id}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    const data=await res.json()
    if(!res.ok) throw new Error(data.error || 'Status was not saved.')
    setTasks(prev=>prev.map(t=>t.id===task.id?{...t,status:newStatus}:t).filter(t=>t.status!=='done'))
    } catch(e) { alert(e instanceof Error ? e.message : 'Status was not saved.') }
  }

  if(loadError || loading) return <div><PageHeader title="This Week" subtitle="Open tasks across active projects" />
    {loadError ? <div role="alert" className="p-4 bg-red-50 text-red-800">{loadError} <button className="underline" onClick={()=>window.location.reload()}>Retry</button></div>
    : <p className="text-fe-blue-gray">Loading open work…</p>}</div>

  return (
    <div className="font-fira">
      <PageHeader title="This Week" subtitle="Open tasks due across active projects this week" />

      <div className="space-y-6">
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
          No open tasks scheduled for this week. Completed work remains in project history.
        </div>
      ) : (
        <>
        {/* Summary stat strip (data-backed counts) */}
        <div className="fe-panel grid grid-cols-3 divide-x divide-[#E4E7EC]">
          <div className="px-5 py-4">
            <div className="text-2xl font-barlow font-extrabold leading-none text-fe-navy">{filteredTasks.length}</div>
            <div className="fe-eyebrow mt-1.5">Open This Week</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-2xl font-barlow font-extrabold leading-none text-fe-blue">{Object.keys(grouped).length}</div>
            <div className="fe-eyebrow mt-1.5">Projects</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-2xl font-barlow font-extrabold leading-none" style={{ color: '#C8350D' }}>{filteredTasks.filter(t => t.status === 'blocked').length}</div>
            <div className="fe-eyebrow mt-1.5">Blocked</div>
          </div>
        </div>

        {/* Project groups stretch to fill the full width (auto-fit) */}
        <div className="fe-cards fe-cards-wide">
          {Object.entries(grouped).map(([projectName, projectTasks]) => (
            <div key={projectName} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-barlow font-bold text-sm text-fe-navy">
                  {projectName}
                </span>
                <WorkflowBadge type={projectTasks[0].workflow_type} />
              </div>

              <div className="space-y-2">
                {projectTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white border border-gray-100 p-4 flex flex-col sm:flex-row items-start justify-between gap-4"
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
                      <div className="flex flex-wrap items-center gap-2">
                        {(task.resolved_owner_ids ?? task.owner_ids).length > 0 ? (task.resolved_owner_ids ?? task.owner_ids).map((oid) => {
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
                        }) : task.resolved_owner_ids !== undefined ? <span className="text-xs text-amber-800">Owner needed</span> : task.role_id ? (() => {
                          const role = roles.find(r => r.id === task.role_id)
                          return role ? (
                            <div className="flex items-center gap-1">
                              <div className="w-6 h-6 rounded-full border-2 border-dashed flex items-center justify-center" style={{ borderColor: role.color }}>
                                <span className="text-[8px] font-bold" style={{ color: role.color }}>?</span>
                              </div>
                              <span className="text-xs font-fira">
                                <span className="font-bold" style={{ color: role.color }}>{role.name}</span>
                                <span className="text-amber-500"> — Unassigned</span>
                              </span>
                            </div>
                          ) : null
                        })() : null}
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
        </>
      )}
      </div>
    </div>
  )
}
