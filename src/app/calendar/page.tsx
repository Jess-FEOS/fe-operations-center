'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'

interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
}

interface CalendarTask {
  id: string
  task_name: string
  due_date: string
  status: string
  project_id: string
  project_name: string
  workflow_type: string
  owner_ids: string[]
}

interface ProjectGroup {
  projectId: string
  projectName: string
  workflowType: string
  tasks: CalendarTask[]
}

const WORKFLOW_COLORS: Record<string, string> = {
  'course-launch': '#0762C8',
  'podcast': '#437F94',
  'newsletter': '#B29838',
  'subscription': '#046A38',
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Format date as YYYY-MM-DD without UTC conversion
function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthRange(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  // Pad to Monday before first day
  let startDay = first.getDay()
  if (startDay === 0) startDay = 7
  const calStart = new Date(first)
  calStart.setDate(first.getDate() - (startDay - 1))

  // Pad to Sunday after last day
  let endDay = last.getDay()
  if (endDay === 0) endDay = 7
  const calEnd = new Date(last)
  calEnd.setDate(last.getDate() + (7 - endDay))

  return { calStart, calEnd, first, last }
}

export default function CalendarPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth())
  const [tasks, setTasks] = useState<CalendarTask[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())

  const { calStart, calEnd, first } = getMonthRange(year, month)

  useEffect(() => {
    setLoading(true)
    const from = toDateStr(calStart)
    const to = toDateStr(calEnd)
    Promise.all([
      fetch(`/api/tasks/range?from=${from}&to=${to}`).then(r => r.json()).catch(() => []),
      fetch('/api/team').then(r => r.json()).catch(() => []),
    ]).then(([tasksData, teamData]) => {
      setTasks(Array.isArray(tasksData) ? tasksData : [])
      setTeam(Array.isArray(teamData) ? teamData : [])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredTasks = selectedMembers.size === 0
    ? tasks
    : tasks.filter(t => t.owner_ids?.some(oid => selectedMembers.has(oid)))

  // Group tasks by date, then by project within each date
  const groupsByDate = new Map<string, ProjectGroup[]>()
  for (const task of filteredTasks) {
    const key = task.due_date
    if (!groupsByDate.has(key)) groupsByDate.set(key, [])
    const dateGroups = groupsByDate.get(key)!
    let group = dateGroups.find(g => g.projectId === task.project_id)
    if (!group) {
      group = { projectId: task.project_id, projectName: task.project_name, workflowType: task.workflow_type, tasks: [] }
      dateGroups.push(group)
    }
    group.tasks.push(task)
  }

  // Build calendar grid (weeks of days)
  const weeks: Date[][] = []
  const cursor = new Date(calStart)
  while (cursor <= calEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  const todayStr = toDateStr(new Date())
  const monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const goToday = () => {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  return (
    <div className="font-fira">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-fe-anthracite" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-fira text-fe-anthracite transition-colors"
          >
            Today
          </button>
          <span className="font-barlow font-bold text-lg text-fe-navy min-w-[180px] text-center">
            {monthLabel}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-fe-anthracite" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Team member filters */}
      {team.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-fe-blue-gray font-fira mr-1">Filter by:</span>
          {team.map(member => {
            const isActive = selectedMembers.has(member.id)
            return (
              <button
                key={member.id}
                onClick={() => toggleMember(member.id)}
                className={`transition-all rounded-full ${isActive ? 'ring-2 ring-fe-blue ring-offset-1' : 'opacity-50 hover:opacity-80'}`}
                title={member.name}
              >
                <Avatar initials={member.initials} color={member.color} size="sm" />
              </button>
            )
          })}
          {selectedMembers.size > 0 && (
            <button
              onClick={() => setSelectedMembers(new Set())}
              className="text-xs font-fira text-fe-blue-gray hover:text-fe-navy transition-colors ml-1"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS.map(day => (
              <div key={day} className="px-2 py-2.5 text-center text-xs font-fira font-bold text-fe-blue-gray bg-gray-50">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
              {week.map((day, di) => {
                const dateStr = toDateStr(day)
                const isCurrentMonth = day.getMonth() === month
                const isToday = dateStr === todayStr
                const dayGroups = groupsByDate.get(dateStr) || []

                return (
                  <div
                    key={di}
                    className={`min-h-[130px] border-r border-gray-50 last:border-r-0 p-2 ${
                      isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <div className={`text-xs font-fira mb-2 ${
                      isToday
                        ? 'w-6 h-6 rounded-full bg-fe-blue text-white flex items-center justify-center font-bold'
                        : isCurrentMonth ? 'text-fe-anthracite font-medium' : 'text-gray-300'
                    }`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayGroups.slice(0, 3).map(group => {
                        const color = WORKFLOW_COLORS[group.workflowType] || '#647692'
                        const tooltipText = group.tasks.map(t => `• ${t.task_name}`).join('\n')
                        return (
                          <Link
                            key={group.projectId}
                            href={`/projects/${group.projectId}`}
                            className="group/chip relative block px-2 py-1 rounded text-xs font-fira truncate hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: `${color}12`,
                              color: color,
                              borderLeft: `3px solid ${color}`,
                            }}
                            title={tooltipText}
                          >
                            <span className="truncate">{group.projectName}</span>
                            <span
                              className="ml-1 inline-flex items-center justify-center px-1 min-w-[16px] h-4 rounded-full text-white text-xs font-bold leading-none"
                              style={{ backgroundColor: color, fontSize: '10px' }}
                            >
                              {group.tasks.length}
                            </span>
                          </Link>
                        )
                      })}
                      {dayGroups.length > 3 && (
                        <div className="text-xs text-fe-blue-gray font-fira px-1">
                          +{dayGroups.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
