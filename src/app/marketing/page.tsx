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
  in_progress: '#EAB308',
  done: '#046A38',
}

const CHANNEL_STATUS_BG: Record<ChannelStatus, string> = {
  not_started: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  done: 'bg-green-50 text-green-700 border-green-200',
}

function generateWeekRows(): WeekRow[] {
  const now = new Date()
  const year = now.getFullYear()
  const dayOfWeek = now.getDay()
  const saturday = new Date(now)
  saturday.setDate(now.getDate() + (6 - dayOfWeek))
  saturday.setHours(0, 0, 0, 0)

  const rows: WeekRow[] = []
  const current = new Date(saturday)

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
    })

    current.setDate(current.getDate() + 7)
    weekNum++
  }

  return rows
}

function isCurrentWeek(saturdayDate: string): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const sat = new Date(saturdayDate + 'T00:00:00')
  const sun = new Date(sat)
  sun.setDate(sat.getDate() - 6)
  return now >= sun && now <= sat
}

function urgencyColor(days: number | null): string {
  if (days === null) return '#9CA3AF'
  if (days <= 30) return '#DC2626'
  if (days <= 60) return '#EAB308'
  return '#046A38'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ----- Component -----

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>('launch')

  // Launch Tracker state
  const [projects, setProjects] = useState<ActiveProject[]>([])
  const [channelStatuses, setChannelStatuses] = useState<Record<string, Record<Channel, ChannelStatus>>>({})

  // Weekly Content state
  const [weekRows, setWeekRows] = useState<WeekRow[]>(() => generateWeekRows())
  const [showAllWeeks, setShowAllWeeks] = useState(false)

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

  const marketingTasks = marketingRoleId
    ? tasks.filter((t) => t.role_id === marketingRoleId)
    : []

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
          {
            key: 'thisweek' as Tab,
            label: 'This Week',
            count: marketingTasks.length,
          },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-fira flex items-center gap-2 ${
              tab === t.key
                ? 'border-b-2 border-fe-blue text-fe-blue font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
            {'count' in t && t.count > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-fe-blue text-white min-w-[20px]">
                {t.count}
              </span>
            )}
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
        <WeeklyContent
          weekRows={weekRows}
          setWeekRows={setWeekRows}
          showAll={showAllWeeks}
          onShowMore={() => setShowAllWeeks(true)}
        />
      )}
      {tab === 'thisweek' && (
        <ThisWeekMarketing
          tasks={marketingTasks}
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

  function getReadyCount(projectId: string): number {
    const statuses = channelStatuses[projectId]
    if (!statuses) return 0
    return CHANNELS.filter((ch) => statuses[ch] === 'done').length
  }

  // Sort by launch date ascending (soonest first), no-date projects at the end
  const sorted = [...projects].sort((a, b) => {
    if (!a.launch_date && !b.launch_date) return 0
    if (!a.launch_date) return 1
    if (!b.launch_date) return -1
    return new Date(a.launch_date).getTime() - new Date(b.launch_date).getTime()
  })

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 text-fe-blue-gray text-sm font-fira">
        No active projects found.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sorted.map((project) => {
        const days = project.launch_date ? daysUntil(project.launch_date) : null
        const ready = getReadyCount(project.id)
        const borderColor = urgencyColor(days)
        const isUrgent = days !== null && days >= 0 && days <= 14

        return (
          <div
            key={project.id}
            className="bg-white rounded-xl border border-gray-100 overflow-hidden flex"
          >
            {/* Urgency left border */}
            <div className="w-1.5 shrink-0" style={{ backgroundColor: borderColor }} />

            <div className="flex-1 p-5 space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-barlow font-bold text-lg text-fe-navy">{project.name}</span>
                  <WorkflowBadge type={project.workflow_type} />
                  {isUrgent && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-fira font-bold bg-red-100 text-red-600 uppercase tracking-wide">
                      Urgent
                    </span>
                  )}
                </div>
                <span className="text-xs font-fira text-fe-blue-gray">
                  {ready}/{CHANNELS.length} channels ready
                </span>
              </div>

              {/* Days countdown + launch date + channels */}
              <div className="flex items-center gap-6">
                {/* Big countdown */}
                <div className="shrink-0 text-center min-w-[80px]">
                  {days !== null ? (
                    <>
                      <p
                        className="font-barlow font-extrabold text-3xl leading-none"
                        style={{ color: borderColor }}
                      >
                        {days < 0 ? Math.abs(days) : days}
                      </p>
                      <p className="text-[10px] font-fira text-fe-blue-gray mt-1">
                        {days < 0 ? 'days overdue' : 'days to launch'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-barlow font-extrabold text-3xl leading-none text-gray-300">&mdash;</p>
                      <p className="text-[10px] font-fira text-fe-blue-gray mt-1">no date set</p>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="w-px h-12 bg-gray-200 shrink-0" />

                {/* Launch date */}
                <div className="shrink-0">
                  {project.launch_date ? (
                    <p className="text-sm font-fira text-fe-blue-gray">
                      {new Date(project.launch_date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  ) : (
                    <p className="text-sm font-fira text-gray-400 italic">No launch date</p>
                  )}
                </div>

                {/* Divider */}
                <div className="w-px h-12 bg-gray-200 shrink-0" />

                {/* Channel statuses — labeled icons */}
                <div className="flex items-center gap-5 flex-1">
                  {CHANNELS.map((ch) => {
                    const status = channelStatuses[project.id]?.[ch] || 'not_started'
                    return (
                      <button
                        key={ch}
                        onClick={() => toggleChannel(project.id, ch)}
                        className="flex flex-col items-center gap-1.5 group"
                        title={`Click to cycle status`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full transition-colors ring-2 ring-offset-1 ring-transparent group-hover:ring-gray-300"
                          style={{ backgroundColor: CHANNEL_STATUS_COLORS[status] }}
                        />
                        <span className="text-[10px] font-fira text-fe-blue-gray group-hover:text-fe-navy transition-colors leading-none">
                          {ch}
                        </span>
                      </button>
                    )
                  })}
                </div>
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
  showAll,
  onShowMore,
}: {
  weekRows: WeekRow[]
  setWeekRows: React.Dispatch<React.SetStateAction<WeekRow[]>>
  showAll: boolean
  onShowMore: () => void
}) {
  const visibleRows = showAll ? weekRows : weekRows.slice(0, 8)

  function updateTopic(idx: number, topic: string) {
    setWeekRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, topic } : row))
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

  function doneCount(row: WeekRow): number {
    return CONTENT_OUTPUTS.filter((o) => row.statuses[o] === 'done').length
  }

  return (
    <div className="space-y-3">
      {visibleRows.map((row, idx) => {
        const isCurrent = isCurrentWeek(row.saturdayDate)
        const complete = doneCount(row)

        return (
          <div
            key={row.weekNum}
            className={`rounded-xl border p-4 space-y-3 ${
              isCurrent
                ? 'bg-blue-50/50 border-fe-blue/20'
                : 'bg-white border-gray-100'
            }`}
          >
            {/* Week header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-barlow font-bold text-sm text-fe-navy">
                  Wk {row.weekNum}
                </span>
                <span className="text-xs font-fira text-fe-blue-gray">
                  {formatDate(row.saturdayDate)}
                </span>
                {isCurrent && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-fira font-bold bg-fe-blue text-white uppercase tracking-wide">
                    This Week
                  </span>
                )}
              </div>
              <span className="text-xs font-fira text-fe-blue-gray">
                {complete}/{CONTENT_OUTPUTS.length} complete
              </span>
            </div>

            {/* Topic input — prominent */}
            <input
              type="text"
              value={row.topic}
              onChange={(e) => updateTopic(idx, e.target.value)}
              placeholder="What's the topic this week?"
              className="w-full px-3 py-2.5 text-sm font-fira border border-gray-200 rounded-lg focus:outline-none focus:border-fe-blue focus:ring-1 focus:ring-fe-blue placeholder:text-gray-400"
            />

            {/* Status pills */}
            <div className="flex flex-wrap gap-2">
              {CONTENT_OUTPUTS.map((output) => {
                const status = row.statuses[output]
                return (
                  <button
                    key={output}
                    onClick={() => toggleOutputStatus(idx, output)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-fira font-bold border transition-colors ${CHANNEL_STATUS_BG[status]}`}
                    title="Click to cycle status"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: CHANNEL_STATUS_COLORS[status] }}
                    />
                    {output}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Show more */}
      {!showAll && weekRows.length > 8 && (
        <button
          onClick={onShowMore}
          className="w-full py-3 text-sm font-fira font-bold text-fe-blue hover:text-fe-blue/80 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          Show {weekRows.length - 8} more weeks
        </button>
      )}
    </div>
  )
}

// ----- Tab 3: This Week (Marketing Director) -----

function ThisWeekMarketing({
  tasks,
  teamById,
  roles,
  onStatusChange,
}: {
  tasks: WeekTask[]
  teamById: Record<string, TeamMember>
  roles: Role[]
  onStatusChange: (task: WeekTask, newStatus: TaskStatus) => void
}) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 text-fe-blue-gray text-sm font-fira">
        No Marketing Director tasks scheduled for this week.
      </div>
    )
  }

  // Group by urgency
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const todayStr = now.toISOString().split('T')[0]

  const overdue: WeekTask[] = []
  const dueToday: WeekTask[] = []
  const dueThisWeek: WeekTask[] = []

  for (const task of tasks) {
    if (task.due_date < todayStr) overdue.push(task)
    else if (task.due_date === todayStr) dueToday.push(task)
    else dueThisWeek.push(task)
  }

  const sections = [
    { label: 'Overdue', tasks: overdue, color: 'text-red-600', dotColor: 'bg-red-500' },
    { label: 'Due Today', tasks: dueToday, color: 'text-amber-600', dotColor: 'bg-amber-500' },
    { label: 'Due This Week', tasks: dueThisWeek, color: 'text-fe-navy', dotColor: 'bg-fe-blue' },
  ].filter((s) => s.tasks.length > 0)

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.label} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${section.dotColor}`} />
            <span className={`font-barlow font-bold text-sm ${section.color}`}>
              {section.label}
            </span>
            <span className="text-xs font-fira text-fe-blue-gray">
              ({section.tasks.length})
            </span>
          </div>

          <div className="space-y-2">
            {section.tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-gray-100 p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="font-barlow font-bold text-sm text-fe-navy">
                      {task.project_name}
                    </p>
                    <p className="font-fira font-bold text-sm text-fe-navy mt-0.5">
                      {task.task_name}
                    </p>
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
