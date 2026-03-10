'use client'

import { useEffect, useState } from 'react'
import Avatar from '@/components/Avatar'
import StatusBadge from '@/components/StatusBadge'
import WorkflowBadge from '@/components/WorkflowBadge'
import { TaskStatus, STATUS_COLORS } from '@/lib/types'

// ----- Types -----

type Tab = 'launch' | 'content' | 'thisweek'

type ChannelStatus = 'not_started' | 'in_progress' | 'done'

const CHANNELS = ['Email', 'Twitter', 'LinkedIn', 'YouTube', 'Blog'] as const
type Channel = (typeof CHANNELS)[number]

const CONTENT_OUTPUTS = ['FE Weekly', 'Blog', 'Twitter', 'LinkedIn', 'YouTube Short'] as const
type ContentOutput = (typeof CONTENT_OUTPUTS)[number]

interface ActiveProject {
  id: string
  name: string
  workflow_type: string
  launch_date: string | null
}

interface WeekRow {
  weekNum: number
  saturdayDate: string
  topic: string
  statuses: Record<ContentOutput, ChannelStatus>
  owner: string
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
  role_id: string | null
}

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

// ----- Helpers -----

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function cycleChannelStatus(s: ChannelStatus): ChannelStatus {
  if (s === 'not_started') return 'in_progress'
  if (s === 'in_progress') return 'done'
  return 'not_started'
}

const CHANNEL_STATUS_COLORS: Record<ChannelStatus, string> = {
  not_started: '#9CA3AF',
  in_progress: '#0762C8',
  done: '#046A38',
}

const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  done: 'Done',
}

function generateWeekRows(): WeekRow[] {
  const now = new Date()
  const year = now.getFullYear()
  // Find the Saturday of the current week (week starts Sunday)
  const dayOfWeek = now.getDay()
  const saturday = new Date(now)
  saturday.setDate(now.getDate() + (6 - dayOfWeek))
  saturday.setHours(0, 0, 0, 0)

  const rows: WeekRow[] = []
  const current = new Date(saturday)

  // Calculate week number of the year for the starting Saturday
  const startOfYear = new Date(year, 0, 1)
  let weekNum = Math.ceil(((current.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24) + startOfYear.getDay() + 1) / 7)

  while (current.getFullYear() <= year && rows.length < 52) {
    const defaultStatuses = {} as Record<ContentOutput, ChannelStatus>
    for (const o of CONTENT_OUTPUTS) defaultStatuses[o] = 'not_started'

    rows.push({
      weekNum,
      saturdayDate: current.toISOString().split('T')[0],
      topic: '',
      statuses: defaultStatuses,
      owner: 'Jess',
    })

    current.setDate(current.getDate() + 7)
    weekNum++
  }

  return rows
}

// ----- Component -----

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>('launch')

  // Launch Tracker state
  const [projects, setProjects] = useState<ActiveProject[]>([])
  const [channelStatuses, setChannelStatuses] = useState<Record<string, Record<Channel, ChannelStatus>>>({})

  // Weekly Content state
  const [weekRows, setWeekRows] = useState<WeekRow[]>(() => generateWeekRows())

  // This Week state
  const [tasks, setTasks] = useState<WeekTask[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [marketingRoleId, setMarketingRoleId] = useState<string | null>(null)

  // Fetch projects for Launch Tracker
  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        const active = (data || []).filter((p: any) => p.status === 'active')
        setProjects(active)
        // Initialize channel statuses
        const statuses: Record<string, Record<Channel, ChannelStatus>> = {}
        for (const p of active) {
          statuses[p.id] = {} as Record<Channel, ChannelStatus>
          for (const ch of CHANNELS) statuses[p.id][ch] = 'not_started'
        }
        setChannelStatuses(statuses)
      })
  }, [])

  // Fetch tasks, team, roles for This Week tab
  useEffect(() => {
    fetch('/api/tasks/this-week')
      .then((res) => res.json())
      .then(setTasks)
    fetch('/api/team')
      .then((res) => res.json())
      .then(setTeam)
    fetch('/api/roles')
      .then((res) => res.json())
      .then((data) => {
        const rolesArr = Array.isArray(data) ? data : []
        setRoles(rolesArr)
        const mktRole = rolesArr.find(
          (r: Role) => r.name.toLowerCase().includes('marketing director')
        )
        if (mktRole) setMarketingRoleId(mktRole.id)
      })
  }, [])

  const teamById = team.reduce<Record<string, TeamMember>>((acc, m) => {
    acc[m.id] = m
    return acc
  }, {})

  // Filter tasks for Marketing Director role
  const marketingTasks = marketingRoleId
    ? tasks.filter((t) => t.role_id === marketingRoleId)
    : []

  const groupedTasks = marketingTasks.reduce<Record<string, WeekTask[]>>((acc, task) => {
    if (!acc[task.project_name]) acc[task.project_name] = []
    acc[task.project_name].push(task)
    return acc
  }, {})

  async function handleTaskStatusChange(task: WeekTask, newStatus: TaskStatus) {
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
      <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">Marketing</h1>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-200">
        {([
          { key: 'launch' as Tab, label: 'Launch Tracker' },
          { key: 'content' as Tab, label: 'Weekly Content' },
          { key: 'thisweek' as Tab, label: 'This Week' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-fira ${
              tab === t.key
                ? 'border-b-2 border-fe-blue text-fe-blue font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'launch' && (
        <LaunchTracker
          projects={projects}
          channelStatuses={channelStatuses}
          setChannelStatuses={setChannelStatuses}
        />
      )}
      {tab === 'content' && (
        <WeeklyContent weekRows={weekRows} setWeekRows={setWeekRows} />
      )}
      {tab === 'thisweek' && (
        <ThisWeekMarketing
          groupedTasks={groupedTasks}
          teamById={teamById}
          roles={roles}
          onStatusChange={handleTaskStatusChange}
        />
      )}
    </div>
  )
}

// ----- Tab 1: Launch Tracker -----

function LaunchTracker({
  projects,
  channelStatuses,
  setChannelStatuses,
}: {
  projects: ActiveProject[]
  channelStatuses: Record<string, Record<Channel, ChannelStatus>>
  setChannelStatuses: React.Dispatch<React.SetStateAction<Record<string, Record<Channel, ChannelStatus>>>>
}) {
  function toggleChannel(projectId: string, channel: Channel) {
    setChannelStatuses((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        [channel]: cycleChannelStatus(prev[projectId]?.[channel] || 'not_started'),
      },
    }))
  }

  function getProgress(projectId: string): number {
    const statuses = channelStatuses[projectId]
    if (!statuses) return 0
    const done = CHANNELS.filter((ch) => statuses[ch] === 'done').length
    return Math.round((done / CHANNELS.length) * 100)
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-16 text-fe-blue-gray text-sm font-fira">
        No active projects found.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => {
        const progress = getProgress(project.id)
        const days = project.launch_date ? daysUntil(project.launch_date) : null

        return (
          <div
            key={project.id}
            className="bg-white rounded-xl border border-gray-100 p-5 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-barlow font-bold text-fe-navy">{project.name}</span>
                <WorkflowBadge type={project.workflow_type} />
              </div>
              <div className="flex items-center gap-4 text-sm font-fira">
                {project.launch_date && (
                  <>
                    <span className="text-fe-blue-gray">
                      Launch: {new Date(project.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span
                      className={`font-bold ${
                        days !== null && days < 0
                          ? 'text-red-500'
                          : days !== null && days <= 7
                          ? 'text-amber-500'
                          : 'text-fe-navy'
                      }`}
                    >
                      {days !== null && days < 0
                        ? `${Math.abs(days)}d overdue`
                        : days !== null
                        ? `${days}d until launch`
                        : ''}
                    </span>
                  </>
                )}
                {!project.launch_date && (
                  <span className="text-fe-blue-gray italic">No launch date</span>
                )}
              </div>
            </div>

            {/* Channel statuses */}
            <div className="flex items-center gap-6">
              {CHANNELS.map((ch) => {
                const status = channelStatuses[project.id]?.[ch] || 'not_started'
                return (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(project.id, ch)}
                    className="flex items-center gap-2 group"
                    title={`${ch}: ${CHANNEL_STATUS_LABELS[status]} (click to cycle)`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full transition-colors"
                      style={{ backgroundColor: CHANNEL_STATUS_COLORS[status] }}
                    />
                    <span className="text-xs font-fira text-fe-blue-gray group-hover:text-fe-navy transition-colors">
                      {ch}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-fira text-fe-blue-gray">Marketing Progress</span>
                <span className="text-xs font-fira font-bold text-fe-navy">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-fe-blue rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ----- Tab 2: Weekly Content -----

function WeeklyContent({
  weekRows,
  setWeekRows,
}: {
  weekRows: WeekRow[]
  setWeekRows: React.Dispatch<React.SetStateAction<WeekRow[]>>
}) {
  function updateTopic(idx: number, topic: string) {
    setWeekRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, topic } : row))
    )
  }

  function updateOwner(idx: number, owner: string) {
    setWeekRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, owner } : row))
    )
  }

  function toggleOutputStatus(idx: number, output: ContentOutput) {
    setWeekRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              statuses: {
                ...row.statuses,
                [output]: cycleChannelStatus(row.statuses[output]),
              },
            }
          : row
      )
    )
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-2 font-fira font-bold text-fe-navy text-xs">Week</th>
            <th className="text-left py-3 px-2 font-fira font-bold text-fe-navy text-xs">Date</th>
            <th className="text-left py-3 px-2 font-fira font-bold text-fe-navy text-xs min-w-[200px]">Topic</th>
            {CONTENT_OUTPUTS.map((output) => (
              <th key={output} className="text-center py-3 px-2 font-fira font-bold text-fe-navy text-xs whitespace-nowrap">
                {output}
              </th>
            ))}
            <th className="text-left py-3 px-2 font-fira font-bold text-fe-navy text-xs">Owner</th>
          </tr>
        </thead>
        <tbody>
          {weekRows.map((row, idx) => (
            <tr key={row.weekNum} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-2 font-fira text-fe-blue-gray text-xs whitespace-nowrap">
                Wk {row.weekNum}
              </td>
              <td className="py-2 px-2 font-fira text-fe-blue-gray text-xs whitespace-nowrap">
                {formatDate(row.saturdayDate)}
              </td>
              <td className="py-2 px-2">
                <input
                  type="text"
                  value={row.topic}
                  onChange={(e) => updateTopic(idx, e.target.value)}
                  placeholder="Enter topic..."
                  className="w-full px-2 py-1 text-xs font-fira border border-gray-200 rounded focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue"
                />
              </td>
              {CONTENT_OUTPUTS.map((output) => (
                <td key={output} className="py-2 px-2 text-center">
                  <button
                    onClick={() => toggleOutputStatus(idx, output)}
                    className="mx-auto flex items-center justify-center"
                    title={`${output}: ${CHANNEL_STATUS_LABELS[row.statuses[output]]} (click to cycle)`}
                  >
                    <span
                      className="w-3 h-3 rounded-full transition-colors"
                      style={{ backgroundColor: CHANNEL_STATUS_COLORS[row.statuses[output]] }}
                    />
                  </button>
                </td>
              ))}
              <td className="py-2 px-2">
                <input
                  type="text"
                  value={row.owner}
                  onChange={(e) => updateOwner(idx, e.target.value)}
                  className="w-20 px-2 py-1 text-xs font-fira border border-gray-200 rounded focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ----- Tab 3: This Week (Marketing Director) -----

function ThisWeekMarketing({
  groupedTasks,
  teamById,
  roles,
  onStatusChange,
}: {
  groupedTasks: Record<string, WeekTask[]>
  teamById: Record<string, TeamMember>
  roles: Role[]
  onStatusChange: (task: WeekTask, newStatus: TaskStatus) => void
}) {
  if (Object.keys(groupedTasks).length === 0) {
    return (
      <div className="text-center py-16 text-fe-blue-gray text-sm font-fira">
        No Marketing Director tasks scheduled for this week.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
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
                    <p className="text-fe-blue-gray text-xs">{task.project_name}</p>
                    <p className="text-xs text-gray-400">{task.phase}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.owner_ids.length > 0
                      ? task.owner_ids.map((oid) => {
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
                                  <>
                                    <span className="font-bold" style={{ color: member.role_data.color }}>
                                      {member.role_data.name}
                                    </span>{' '}
                                    &middot; {member.name.split(' ')[0]}
                                  </>
                                ) : (
                                  member.name.split(' ')[0]
                                )}
                              </span>
                            </div>
                          ) : null
                        })
                      : task.role_id
                      ? (() => {
                          const role = roles.find((r) => r.id === task.role_id)
                          return role ? (
                            <div className="flex items-center gap-1">
                              <div
                                className="w-6 h-6 rounded-full border-2 border-dashed flex items-center justify-center"
                                style={{ borderColor: role.color }}
                              >
                                <span className="text-[8px] font-bold" style={{ color: role.color }}>
                                  ?
                                </span>
                              </div>
                              <span className="text-xs font-fira">
                                <span className="font-bold" style={{ color: role.color }}>
                                  {role.name}
                                </span>
                                <span className="text-amber-500"> — Unassigned</span>
                              </span>
                            </div>
                          ) : null
                        })()
                      : null}
                  </div>
                </div>

                <div className="shrink-0">
                  <StatusBadge
                    status={task.status}
                    interactive
                    onClick={(newStatus) => onStatusChange(task, newStatus)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
