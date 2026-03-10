'use client'

import { useState, useEffect, useCallback } from 'react'
import Avatar from '@/components/Avatar'

type Mode = 'active' | 'template' | 'reschedule'

interface Role {
  id: string
  name: string
  color: string
}

interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
  role_data: { id: string; name: string; color: string } | null
}

interface Project {
  id: string
  name: string
}

interface Template {
  id: string
  name: string
  type: string
}

interface BulkTask {
  id: string
  task_name: string
  project_id: string
  project_name: string
  owner_ids: string[]
  role_id: string | null
  status: string
}

interface TemplateBulkTask {
  id: string
  title: string
  template_id: string
  template_name: string
  owner: string
  week_number: number
  order_index: number
  role_id: string | null
}

interface RescheduleTask {
  id: string
  task_name: string
  due_date: string | null
  week_number: number | null
  status: string
  new_due_date?: string
}

interface RescheduleProject {
  id: string
  name: string
  start_date: string
}

interface Toast {
  message: string
  visible: boolean
}

interface RoleGroup {
  role_id: string | null
  role_name: string
  role_color: string
  tasks: BulkTask[]
}

export default function BulkEditPage() {
  const [mode, setMode] = useState<Mode>('active')
  const [roles, setRoles] = useState<Role[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterRole, setFilterRole] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterTemplate, setFilterTemplate] = useState('')
  const [filterKeyword, setFilterKeyword] = useState('')
  const [filterUnassignedOnly, setFilterUnassignedOnly] = useState(true)

  // Results - active
  const [tasks, setTasks] = useState<BulkTask[]>([])
  // Results - template
  const [templateTasks, setTemplateTasks] = useState<TemplateBulkTask[]>([])

  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Bulk action
  const [bulkRole, setBulkRole] = useState('')
  const [bulkOwner, setBulkOwner] = useState('')
  const [applying, setApplying] = useState(false)

  // Quick assign by role
  const [quickAssignMap, setQuickAssignMap] = useState<Record<string, string>>({})
  const [quickAssigning, setQuickAssigning] = useState<string | null>(null)

  // Sync prompt
  const [showSyncPrompt, setShowSyncPrompt] = useState(false)
  const [pendingSyncPayload, setPendingSyncPayload] = useState<{ task_ids: string[]; role_id: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  // Collapsed role groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Reschedule state
  const [rescheduleProjectId, setRescheduleProjectId] = useState('')
  const [rescheduleProject, setRescheduleProject] = useState<RescheduleProject | null>(null)
  const [rescheduleTasks, setRescheduleTasks] = useState<RescheduleTask[]>([])
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [rescheduleOption, setRescheduleOption] = useState<'start_date' | 'shift'>('start_date')
  const [newStartDate, setNewStartDate] = useState('')
  const [shiftDays, setShiftDays] = useState('')
  const [reschedulePreview, setReschedulePreview] = useState<RescheduleTask[]>([])
  const [rescheduleApplying, setRescheduleApplying] = useState(false)
  const [rescheduleSuccess, setRescheduleSuccess] = useState('')

  // Toast
  const [toast, setToast] = useState<Toast>({ message: '', visible: false })

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true })
    setTimeout(() => setToast({ message: '', visible: false }), 3500)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/roles').then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/project-templates').then(r => r.json()),
    ]).then(([rolesData, teamData, projectsData, templatesData]) => {
      setRoles(Array.isArray(rolesData) ? rolesData : [])
      setTeam(Array.isArray(teamData) ? teamData : [])
      setProjects(Array.isArray(projectsData) ? projectsData : [])
      setTemplates(Array.isArray(templatesData) ? templatesData.map((t: any) => ({ id: t.id, name: t.name, type: t.type })) : [])
      setLoading(false)
    })
  }, [])

  // Auto-search on first load for active mode with unassigned filter
  useEffect(() => {
    if (!loading && !searched) {
      findTasks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const teamById = team.reduce<Record<string, TeamMember>>((acc, m) => {
    acc[m.id] = m
    return acc
  }, {})

  const roleById = roles.reduce<Record<string, Role>>((acc, r) => {
    acc[r.id] = r
    return acc
  }, {})

  // Get visible tasks (with unassigned filter applied client-side)
  const visibleTasks = filterUnassignedOnly && mode === 'active'
    ? tasks.filter(t => !t.owner_ids || t.owner_ids.length === 0)
    : tasks

  // Group tasks by role
  const roleGroups: RoleGroup[] = (() => {
    const groupMap = new Map<string, RoleGroup>()
    for (const task of visibleTasks) {
      const key = task.role_id || '__none__'
      if (!groupMap.has(key)) {
        const role = task.role_id ? roleById[task.role_id] : null
        groupMap.set(key, {
          role_id: task.role_id,
          role_name: role?.name || 'No Role Assigned',
          role_color: role?.color || '#9CA3AF',
          tasks: [],
        })
      }
      groupMap.get(key)!.tasks.push(task)
    }
    // Sort groups by role name
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.role_id === null) return 1
      if (b.role_id === null) return -1
      return a.role_name.localeCompare(b.role_name)
    })
  })()

  function switchMode(newMode: Mode) {
    setMode(newMode)
    setSearched(false)
    setTasks([])
    setTemplateTasks([])
    setSelected(new Set())
    setBulkRole('')
    setBulkOwner('')
    setFilterRole('')
    setFilterProject('')
    setFilterTemplate('')
    setFilterKeyword('')
    setShowSyncPrompt(false)
    setPendingSyncPayload(null)
    setCollapsedGroups(new Set())
    // Reset reschedule state
    setRescheduleProjectId('')
    setRescheduleProject(null)
    setRescheduleTasks([])
    setReschedulePreview([])
    setRescheduleSuccess('')
    setNewStartDate('')
    setShiftDays('')
  }

  const currentItems = mode === 'active' ? visibleTasks : templateTasks

  async function findTasks() {
    setSearching(true)
    setSelected(new Set())
    setBulkRole('')
    setBulkOwner('')
    setShowSyncPrompt(false)
    setPendingSyncPayload(null)
    setCollapsedGroups(new Set())

    const params = new URLSearchParams()

    if (mode === 'template') {
      params.set('mode', 'template')
      if (filterTemplate) params.set('template_id', filterTemplate)
      if (filterRole) params.set('role_id', filterRole)
      if (filterKeyword.trim()) params.set('keyword', filterKeyword.trim())

      const res = await fetch(`/api/tasks/bulk-edit?${params.toString()}`)
      const data = await res.json()
      setTemplateTasks(Array.isArray(data) ? data : [])
    } else {
      if (filterRole) params.set('role_id', filterRole)
      if (filterProject) params.set('project_id', filterProject)
      if (filterKeyword.trim()) params.set('keyword', filterKeyword.trim())

      const res = await fetch(`/api/tasks/bulk-edit?${params.toString()}`)
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    }

    setSearched(true)
    setSearching(false)
  }

  function toggleAll() {
    if (selected.size === currentItems.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(currentItems.map(t => t.id)))
    }
  }

  function toggleGroupAll(group: RoleGroup) {
    const groupIds = group.tasks.map(t => t.id)
    const allSelected = groupIds.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) {
        groupIds.forEach(id => next.delete(id))
      } else {
        groupIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  function toggleTask(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroupCollapse(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function applyBulk() {
    if (selected.size === 0) return

    if (mode === 'template') {
      if (!bulkRole) return
      setApplying(true)

      const payload = {
        task_ids: Array.from(selected),
        role_id: bulkRole,
        mode: 'template',
        sync_to_projects: false,
      }

      const res = await fetch('/api/tasks/bulk-edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await res.json()

      if (result.updated) {
        showToast(`Updated ${result.updated} template task${result.updated !== 1 ? 's' : ''}`)
        setPendingSyncPayload({ task_ids: Array.from(selected), role_id: bulkRole })
        setShowSyncPrompt(true)
        await findTasks()
      } else if (result.error) {
        showToast(`Error: ${result.error}`)
      }

      setApplying(false)
      return
    }

    // Active mode — assign person
    if (!bulkOwner) return

    setApplying(true)

    const selectedTasks = visibleTasks.filter(t => selected.has(t.id))
    const assigneeName = teamById[bulkOwner]?.name || 'team member'

    // Group by project_id and PATCH each
    const byProject = selectedTasks.reduce<Record<string, string[]>>((acc, t) => {
      if (!acc[t.project_id]) acc[t.project_id] = []
      acc[t.project_id].push(t.id)
      return acc
    }, {})

    let totalUpdated = 0

    for (const [projectId, taskIds] of Object.entries(byProject)) {
      await Promise.all(taskIds.map(taskId =>
        fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner_ids: [bulkOwner] }),
        })
      ))
      totalUpdated += taskIds.length
    }

    showToast(`${totalUpdated} tasks assigned to ${assigneeName}`)
    await findTasks()
    setApplying(false)
  }

  async function quickAssignRole(roleId: string) {
    const memberId = quickAssignMap[roleId]
    if (!memberId) return

    setQuickAssigning(roleId)

    // Find all unassigned tasks for this role across all projects
    const unassignedForRole = tasks.filter(t =>
      t.role_id === roleId && (!t.owner_ids || t.owner_ids.length === 0)
    )

    if (unassignedForRole.length === 0) {
      showToast('No unassigned tasks for this role')
      setQuickAssigning(null)
      return
    }

    const byProject = unassignedForRole.reduce<Record<string, string[]>>((acc, t) => {
      if (!acc[t.project_id]) acc[t.project_id] = []
      acc[t.project_id].push(t.id)
      return acc
    }, {})

    let totalUpdated = 0

    for (const [projectId, taskIds] of Object.entries(byProject)) {
      await Promise.all(taskIds.map(taskId =>
        fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner_ids: [memberId] }),
        })
      ))
      totalUpdated += taskIds.length
    }

    const memberName = teamById[memberId]?.name || 'team member'
    const roleName = roleById[roleId]?.name || 'role'
    showToast(`${totalUpdated} ${roleName} tasks assigned to ${memberName}`)
    await findTasks()
    setQuickAssigning(null)
  }

  async function handleSync() {
    if (!pendingSyncPayload) return
    setSyncing(true)

    const res = await fetch('/api/tasks/bulk-edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...pendingSyncPayload,
        mode: 'template',
        sync_to_projects: true,
      }),
    })

    const result = await res.json()

    if (result.synced !== undefined) {
      showToast(`Synced role changes to ${result.synced} active project task${result.synced !== 1 ? 's' : ''}`)
    } else if (result.error) {
      showToast(`Error: ${result.error}`)
    }

    setSyncing(false)
    setShowSyncPrompt(false)
    setPendingSyncPayload(null)
  }

  function dismissSync() {
    setShowSyncPrompt(false)
    setPendingSyncPayload(null)
  }

  // --- Reschedule functions ---
  async function loadRescheduleTasks(projectId: string) {
    if (!projectId) {
      setRescheduleTasks([])
      setRescheduleProject(null)
      setReschedulePreview([])
      setRescheduleSuccess('')
      return
    }
    setRescheduleLoading(true)
    setReschedulePreview([])
    setRescheduleSuccess('')
    try {
      const res = await fetch(`/api/tasks/bulk-edit?mode=reschedule&project_id=${projectId}`)
      const data = await res.json()
      setRescheduleProject(data.project || null)
      setRescheduleTasks(Array.isArray(data.tasks) ? data.tasks : [])
      if (data.project?.start_date) {
        setNewStartDate(data.project.start_date)
      }
    } catch {
      setRescheduleTasks([])
    } finally {
      setRescheduleLoading(false)
    }
  }

  function computePreview() {
    if (rescheduleOption === 'start_date' && newStartDate) {
      const start = new Date(newStartDate + 'T00:00:00')
      const preview = rescheduleTasks.map(t => {
        const weekNum = t.week_number ?? 1
        const newDate = new Date(start)
        newDate.setDate(start.getDate() + weekNum * 7)
        return { ...t, new_due_date: newDate.toISOString().split('T')[0] }
      })
      setReschedulePreview(preview)
    } else if (rescheduleOption === 'shift' && shiftDays) {
      const days = parseInt(shiftDays)
      if (isNaN(days)) return
      const preview = rescheduleTasks.map(t => {
        if (!t.due_date) return { ...t, new_due_date: undefined }
        const d = new Date(t.due_date + 'T00:00:00')
        d.setDate(d.getDate() + days)
        return { ...t, new_due_date: d.toISOString().split('T')[0] }
      })
      setReschedulePreview(preview)
    }
  }

  async function applyReschedule() {
    if (reschedulePreview.length === 0) return
    setRescheduleApplying(true)
    setRescheduleSuccess('')
    try {
      const updates = reschedulePreview
        .filter(t => t.new_due_date)
        .map(t => ({ task_id: t.id, new_due_date: t.new_due_date }))

      const res = await fetch('/api/tasks/bulk-edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', updates }),
      })

      const result = await res.json()
      if (result.updated) {
        setRescheduleSuccess(`${result.updated} tasks rescheduled successfully`)
        showToast(`${result.updated} tasks rescheduled`)
        // Refresh tasks
        await loadRescheduleTasks(rescheduleProjectId)
      }
    } catch {
      showToast('Error rescheduling tasks')
    } finally {
      setRescheduleApplying(false)
    }
  }

  // Group reschedule tasks by week_number
  const rescheduleByWeek = rescheduleTasks.reduce<Record<number, RescheduleTask[]>>((acc, t) => {
    const week = t.week_number ?? 0
    if (!acc[week]) acc[week] = []
    acc[week].push(t)
    return acc
  }, {})
  const rescheduleWeeks = Object.keys(rescheduleByWeek).map(Number).sort((a, b) => a - b)

  // Count unassigned tasks per role (from full tasks list, not filtered)
  const unassignedByRole = tasks.reduce<Record<string, number>>((acc, t) => {
    if (!t.owner_ids || t.owner_ids.length === 0) {
      const key = t.role_id || '__none__'
      acc[key] = (acc[key] || 0) + 1
    }
    return acc
  }, {})

  // Roles that have unassigned tasks (for quick assign section)
  const rolesWithUnassigned = roles.filter(r => (unassignedByRole[r.id] || 0) > 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-fe-navy font-fira text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="font-fira pb-24">
      {/* Toast */}
      {toast.visible && (
        <div className="fixed top-6 right-6 z-[60] animate-in slide-in-from-top-2">
          <div className="bg-fe-navy text-white px-5 py-3 rounded-lg shadow-lg text-sm font-fira flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {toast.message}
          </div>
        </div>
      )}

      <h1 className="font-barlow font-extrabold text-2xl text-fe-navy mb-4">
        Bulk Task Editor
      </h1>

      {/* Mode Toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => switchMode('active')}
          className={`px-4 py-2 rounded-md text-sm font-fira font-bold transition-colors ${
            mode === 'active'
              ? 'bg-white text-fe-navy shadow-sm'
              : 'text-fe-blue-gray hover:text-fe-navy'
          }`}
        >
          Active Projects
        </button>
        <button
          onClick={() => switchMode('template')}
          className={`px-4 py-2 rounded-md text-sm font-fira font-bold transition-colors ${
            mode === 'template'
              ? 'bg-white text-fe-navy shadow-sm'
              : 'text-fe-blue-gray hover:text-fe-navy'
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => switchMode('reschedule')}
          className={`px-4 py-2 rounded-md text-sm font-fira font-bold transition-colors ${
            mode === 'reschedule'
              ? 'bg-white text-fe-navy shadow-sm'
              : 'text-fe-blue-gray hover:text-fe-navy'
          }`}
        >
          Reschedule
        </button>
      </div>

      {/* Quick Assign by Role — only in active mode when we have data */}
      {mode === 'active' && searched && rolesWithUnassigned.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
          <h2 className="font-barlow font-bold text-sm text-fe-navy mb-3">Quick Assign by Role</h2>
          <p className="text-xs font-fira text-fe-blue-gray mb-4">Assign all unassigned tasks for a role to one person in one click.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rolesWithUnassigned.map(role => {
              const count = unassignedByRole[role.id] || 0
              return (
                <div key={role.id} className="flex items-center gap-2 p-3 rounded-lg border border-gray-100">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-fira font-bold text-fe-navy truncate">{role.name}</p>
                    <p className="text-xs font-fira text-fe-blue-gray">{count} unassigned</p>
                  </div>
                  <select
                    value={quickAssignMap[role.id] || ''}
                    onChange={e => setQuickAssignMap(prev => ({ ...prev, [role.id]: e.target.value }))}
                    className="px-2 py-1 border border-gray-200 rounded text-xs font-fira bg-white focus:outline-none focus:ring-1 focus:ring-fe-blue min-w-[120px]"
                  >
                    <option value="">Pick person...</option>
                    {/* Show matching role members first, then others */}
                    {team
                      .sort((a, b) => {
                        const aMatch = a.role_data?.id === role.id ? 0 : 1
                        const bMatch = b.role_data?.id === role.id ? 0 : 1
                        return aMatch - bMatch
                      })
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.role_data?.id === role.id ? `★ ${m.name}` : m.name}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => quickAssignRole(role.id)}
                    disabled={!quickAssignMap[role.id] || quickAssigning === role.id}
                    className="px-3 py-1 bg-fe-blue text-white rounded text-xs font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {quickAssigning === role.id ? '...' : 'Assign All'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter Bar — hidden in reschedule mode */}
      {mode !== 'reschedule' && <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          {mode === 'template' ? (
            <div className="min-w-[200px]">
              <label className="block text-xs font-fira font-bold text-fe-navy mb-1">Template</label>
              <select
                value={filterTemplate}
                onChange={e => setFilterTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white"
              >
                <option value="">All Templates</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="min-w-[200px]">
              <label className="block text-xs font-fira font-bold text-fe-navy mb-1">Project</label>
              <select
                value={filterProject}
                onChange={e => setFilterProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white"
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-[180px]">
            <label className="block text-xs font-fira font-bold text-fe-navy mb-1">Role</label>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white"
            >
              <option value="">All Roles</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-fira font-bold text-fe-navy mb-1">Keyword</label>
            <input
              type="text"
              value={filterKeyword}
              onChange={e => setFilterKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') findTasks() }}
              placeholder="Search task names..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
            />
          </div>

          <button
            onClick={findTasks}
            disabled={searching}
            className="px-5 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-50 shrink-0"
          >
            {searching ? 'Searching...' : 'Find Tasks'}
          </button>
        </div>

        {/* Unassigned Only Toggle */}
        {mode === 'active' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterUnassignedOnly}
                onChange={e => { setFilterUnassignedOnly(e.target.checked); setSelected(new Set()) }}
                className="w-4 h-4 rounded border-gray-300 text-fe-blue focus:ring-fe-blue"
              />
              <span className="text-sm font-fira text-fe-navy font-bold">Show unassigned only</span>
              {searched && (
                <span className="text-xs font-fira text-fe-blue-gray">
                  ({visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''})
                </span>
              )}
            </label>
          </div>
        )}
      </div>}

      {/* Sync Prompt */}
      {showSyncPrompt && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-4 flex items-center gap-4 flex-wrap">
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-sm font-fira text-fe-navy flex-1">
            Apply these role changes to <span className="font-bold">active projects</span> using these templates?
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Yes, sync to active projects'}
          </button>
          <button
            onClick={dismissSync}
            className="px-4 py-2 bg-white border border-gray-200 text-fe-navy rounded-lg text-sm font-fira hover:bg-gray-50 transition-colors"
          >
            No, skip
          </button>
        </div>
      )}

      {/* Selected count + master select all */}
      {searched && mode === 'active' && visibleTasks.length > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === visibleTasks.length && visibleTasks.length > 0}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-gray-300 text-fe-blue focus:ring-fe-blue"
            />
            <span className="text-sm font-fira font-bold text-fe-navy">Select All</span>
          </label>
          {selected.size > 0 && (
            <span className="text-sm font-fira text-fe-blue-gray">
              {selected.size} task{selected.size !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
      )}

      {/* Results - Active Mode (Grouped by Role) */}
      {searched && mode === 'active' && (
        <>
          {visibleTasks.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl text-center py-12 text-fe-blue-gray text-sm font-fira">
              {filterUnassignedOnly ? 'No unassigned tasks found. All tasks have owners!' : 'No tasks match your filters. Try adjusting the criteria.'}
            </div>
          ) : (
            <div className="space-y-3">
              {roleGroups.map(group => {
                const groupKey = group.role_id || '__none__'
                const isCollapsed = collapsedGroups.has(groupKey)
                const groupAllSelected = group.tasks.every(t => selected.has(t.id))
                const groupSomeSelected = group.tasks.some(t => selected.has(t.id))
                const unassignedCount = group.tasks.filter(t => !t.owner_ids || t.owner_ids.length === 0).length

                return (
                  <div key={groupKey} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                    {/* Group Header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <input
                        type="checkbox"
                        checked={groupAllSelected}
                        ref={el => { if (el) el.indeterminate = groupSomeSelected && !groupAllSelected }}
                        onChange={() => toggleGroupAll(group)}
                        className="w-4 h-4 rounded border-gray-300 text-fe-blue focus:ring-fe-blue"
                      />
                      <button
                        onClick={() => toggleGroupCollapse(groupKey)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <svg
                          className={`w-4 h-4 text-fe-blue-gray transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.role_color }} />
                        <span className="text-sm font-fira font-bold text-fe-navy">{group.role_name}</span>
                        <span className="text-xs font-fira text-fe-blue-gray">
                          — {unassignedCount} unassigned of {group.tasks.length} total
                        </span>
                      </button>
                    </div>

                    {/* Group Tasks */}
                    {!isCollapsed && (
                      <table className="w-full text-sm">
                        <tbody>
                          {group.tasks.map(task => {
                            const owners = (task.owner_ids || []).map(oid => teamById[oid]).filter(Boolean)
                            const isSelected = selected.has(task.id)

                            return (
                              <tr
                                key={task.id}
                                className={`border-b border-gray-50 last:border-b-0 transition-colors ${
                                  isSelected ? 'bg-fe-blue/5' : 'hover:bg-gray-50/50'
                                }`}
                              >
                                <td className="w-10 px-4 py-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleTask(task.id)}
                                    className="w-4 h-4 rounded border-gray-300 text-fe-blue focus:ring-fe-blue"
                                  />
                                </td>
                                <td className="px-3 py-2.5 font-fira text-fe-anthracite">
                                  {task.task_name}
                                </td>
                                <td className="px-3 py-2.5 font-fira text-fe-blue-gray text-xs">
                                  {task.project_name}
                                </td>
                                <td className="px-3 py-2.5 w-40">
                                  {owners.length > 0 ? (
                                    <div className="flex items-center gap-1.5">
                                      {owners.map(m => (
                                        <div key={m.id} className="flex items-center gap-1">
                                          <Avatar initials={m.initials} color={m.color} size="sm" />
                                          <span className="text-xs font-fira text-fe-anthracite">{m.name.split(' ')[0]}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs font-fira text-gray-300">Unassigned</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {visibleTasks.length > 0 && (
            <div className="mt-3 text-xs font-fira text-fe-blue-gray">
              {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''} across {roleGroups.length} role{roleGroups.length !== 1 ? 's' : ''}
            </div>
          )}
        </>
      )}

      {/* Results Table - Template Mode */}
      {searched && mode === 'template' && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {templateTasks.length === 0 ? (
            <div className="text-center py-12 text-fe-blue-gray text-sm font-fira">
              No template tasks match your filters. Try adjusting the criteria.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === templateTasks.length && templateTasks.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-fe-blue focus:ring-fe-blue"
                    />
                  </th>
                  <th className="text-left py-3 px-3 text-xs font-fira font-bold text-fe-navy">Task Name</th>
                  <th className="text-left py-3 px-3 text-xs font-fira font-bold text-fe-navy">Template</th>
                  <th className="text-left py-3 px-3 text-xs font-fira font-bold text-fe-navy">Week</th>
                  <th className="text-left py-3 px-3 text-xs font-fira font-bold text-fe-navy">Role</th>
                  <th className="text-left py-3 px-3 text-xs font-fira font-bold text-fe-navy">Owner</th>
                </tr>
              </thead>
              <tbody>
                {templateTasks.map(task => {
                  const role = task.role_id ? roleById[task.role_id] : null
                  const isSelected = selected.has(task.id)

                  return (
                    <tr
                      key={task.id}
                      className={`border-b border-gray-50 last:border-b-0 transition-colors ${
                        isSelected ? 'bg-fe-blue/5' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTask(task.id)}
                          className="w-4 h-4 rounded border-gray-300 text-fe-blue focus:ring-fe-blue"
                        />
                      </td>
                      <td className="px-3 py-3 font-fira text-fe-anthracite">
                        {task.title}
                      </td>
                      <td className="px-3 py-3 font-fira text-fe-blue-gray text-xs">
                        {task.template_name}
                      </td>
                      <td className="px-3 py-3 font-fira text-fe-blue-gray text-xs">
                        {task.week_number > 0 ? `W-${task.week_number}` : task.week_number === 0 ? 'Launch' : `W+${Math.abs(task.week_number)}`}
                      </td>
                      <td className="px-3 py-3">
                        {role ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-fira font-bold" style={{ color: role.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }} />
                            {role.name}
                          </span>
                        ) : (
                          <span className="text-xs font-fira text-gray-300">None</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-fira text-fe-blue-gray text-xs">
                        {task.owner}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {templateTasks.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs font-fira text-fe-blue-gray">
              {templateTasks.length} template task{templateTasks.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>
      )}

      {/* Reschedule Tab */}
      {mode === 'reschedule' && (
        <div className="space-y-6">
          {/* Project Selector */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h2 className="font-barlow font-bold text-sm text-fe-navy mb-3">Select Project to Reschedule</h2>
            <select
              value={rescheduleProjectId}
              onChange={e => { setRescheduleProjectId(e.target.value); loadRescheduleTasks(e.target.value) }}
              className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white"
            >
              <option value="">Choose a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {rescheduleLoading && (
            <div className="text-center py-8 text-fe-blue-gray text-sm font-fira">Loading tasks...</div>
          )}

          {!rescheduleLoading && rescheduleProjectId && rescheduleTasks.length > 0 && (
            <>
              {/* Current Tasks by Week */}
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h2 className="font-barlow font-bold text-sm text-fe-navy mb-1">
                  {rescheduleProject?.name} — {rescheduleTasks.length} tasks
                </h2>
                <p className="text-xs font-fira text-fe-blue-gray mb-4">
                  Current start date: {rescheduleProject?.start_date ? new Date(rescheduleProject.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                </p>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {rescheduleWeeks.map(week => (
                    <div key={week}>
                      <h3 className="text-xs font-barlow font-bold text-fe-navy uppercase tracking-wide mb-1.5">
                        {week > 0 ? `Week ${week}` : week === 0 ? 'Launch Week' : `Post-Launch Week ${Math.abs(week)}`}
                        <span className="text-fe-blue-gray font-normal ml-2">({rescheduleByWeek[week].length} tasks)</span>
                      </h3>
                      <div className="space-y-1">
                        {rescheduleByWeek[week].map(task => (
                          <div key={task.id} className="flex items-center justify-between px-3 py-1.5 rounded border border-gray-50 bg-gray-50/50 text-xs font-fira">
                            <span className="text-fe-anthracite truncate mr-3">{task.task_name}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                task.status === 'done' ? 'bg-green-100 text-green-700' :
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                task.status === 'blocked' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{task.status === 'not_started' ? 'Not Started' : task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'Blocked'}</span>
                              <span className="text-fe-blue-gray w-20 text-right">
                                {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rescheduling Options */}
              <div className="bg-white border border-gray-100 rounded-xl p-5">
                <h2 className="font-barlow font-bold text-sm text-fe-navy mb-4">Reschedule Options</h2>
                <div className="flex gap-3 mb-5">
                  <button
                    onClick={() => { setRescheduleOption('start_date'); setReschedulePreview([]); setRescheduleSuccess('') }}
                    className={`px-4 py-2 rounded-lg text-sm font-fira font-bold transition-colors ${
                      rescheduleOption === 'start_date'
                        ? 'bg-fe-navy text-white'
                        : 'bg-gray-100 text-fe-anthracite hover:bg-gray-200'
                    }`}
                  >
                    Shift from new start date
                  </button>
                  <button
                    onClick={() => { setRescheduleOption('shift'); setReschedulePreview([]); setRescheduleSuccess('') }}
                    className={`px-4 py-2 rounded-lg text-sm font-fira font-bold transition-colors ${
                      rescheduleOption === 'shift'
                        ? 'bg-fe-navy text-white'
                        : 'bg-gray-100 text-fe-anthracite hover:bg-gray-200'
                    }`}
                  >
                    Shift all dates by N days
                  </button>
                </div>

                {rescheduleOption === 'start_date' && (
                  <div className="space-y-3">
                    <p className="text-xs font-fira text-fe-blue-gray">
                      Pick a new project start date. All task due dates will be recalculated based on their week number relative to this date.
                    </p>
                    <div className="flex items-end gap-3">
                      <div>
                        <label className="block text-xs font-fira font-bold text-fe-navy mb-1">New Start Date</label>
                        <input
                          type="date"
                          value={newStartDate}
                          onChange={e => { setNewStartDate(e.target.value); setReschedulePreview([]); setRescheduleSuccess('') }}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                        />
                      </div>
                      <button
                        onClick={computePreview}
                        disabled={!newStartDate}
                        className="px-5 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40"
                      >
                        Preview Changes
                      </button>
                    </div>
                  </div>
                )}

                {rescheduleOption === 'shift' && (
                  <div className="space-y-3">
                    <p className="text-xs font-fira text-fe-blue-gray">
                      Move all due dates forward (or backward) by a fixed number of days.
                    </p>
                    <div className="flex items-end gap-3">
                      <div>
                        <label className="block text-xs font-fira font-bold text-fe-navy mb-1">Days to Shift</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={shiftDays}
                            onChange={e => { setShiftDays(e.target.value); setReschedulePreview([]); setRescheduleSuccess('') }}
                            placeholder="e.g. 14"
                            className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                          />
                          <span className="text-xs font-fira text-fe-blue-gray">days forward (negative to shift back)</span>
                        </div>
                      </div>
                      <button
                        onClick={computePreview}
                        disabled={!shiftDays || isNaN(parseInt(shiftDays))}
                        className="px-5 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40"
                      >
                        Preview Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Table */}
              {reschedulePreview.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-barlow font-bold text-sm text-fe-navy">
                      Preview — {reschedulePreview.length} tasks will be updated
                    </h2>
                    <button
                      onClick={applyReschedule}
                      disabled={rescheduleApplying}
                      className="px-5 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-50"
                    >
                      {rescheduleApplying ? 'Applying...' : rescheduleOption === 'start_date' ? 'Apply to all tasks' : 'Apply shift'}
                    </button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left py-3 px-4 text-xs font-fira font-bold text-fe-navy">Task</th>
                        <th className="text-left py-3 px-4 text-xs font-fira font-bold text-fe-navy w-20">Week</th>
                        <th className="text-left py-3 px-4 text-xs font-fira font-bold text-fe-navy w-32">Current Due Date</th>
                        <th className="text-left py-3 px-4 text-xs font-fira font-bold text-fe-navy w-8"></th>
                        <th className="text-left py-3 px-4 text-xs font-fira font-bold text-fe-blue w-32">New Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reschedulePreview.map(task => {
                        const changed = task.due_date !== task.new_due_date
                        return (
                          <tr key={task.id} className={`border-b border-gray-50 last:border-b-0 ${changed ? '' : 'opacity-50'}`}>
                            <td className="px-4 py-2.5 font-fira text-fe-anthracite">{task.task_name}</td>
                            <td className="px-4 py-2.5 font-fira text-fe-blue-gray text-xs">W{task.week_number}</td>
                            <td className="px-4 py-2.5 font-fira text-fe-blue-gray text-xs">
                              {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </td>
                            <td className="px-2 py-2.5 text-fe-blue-gray">&rarr;</td>
                            <td className={`px-4 py-2.5 font-fira text-xs font-bold ${changed ? 'text-fe-blue' : 'text-fe-blue-gray'}`}>
                              {task.new_due_date ? new Date(task.new_due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Success message */}
              {rescheduleSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-fira text-green-700 font-bold">{rescheduleSuccess}</span>
                </div>
              )}
            </>
          )}

          {!rescheduleLoading && rescheduleProjectId && rescheduleTasks.length === 0 && (
            <div className="text-center py-12 text-fe-blue-gray text-sm font-fira">
              No tasks found for this project.
            </div>
          )}

          {!rescheduleProjectId && (
            <div className="text-center py-16 text-fe-blue-gray text-sm font-fira">
              Select a project above to load its tasks for rescheduling.
            </div>
          )}
        </div>
      )}

      {!searched && mode !== 'reschedule' && (
        <div className="text-center py-16 text-fe-blue-gray text-sm font-fira">
          {mode === 'active'
            ? 'Loading tasks...'
            : 'Use the filters above and click \u201cFind Tasks\u201d to load template tasks for bulk editing.'}
        </div>
      )}

      {/* Sticky Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="max-w-5xl mx-auto px-4 pb-4">
            <div className="bg-fe-navy text-white rounded-xl px-5 py-4 flex items-center gap-4 flex-wrap shadow-2xl">
              <span className="text-sm font-fira font-bold shrink-0">
                {selected.size} task{selected.size !== 1 ? 's' : ''} selected
              </span>

              <div className="h-5 w-px bg-white/20" />

              {mode === 'template' ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-fira text-white/70">Assign to Role:</label>
                  <select
                    value={bulkRole}
                    onChange={e => setBulkRole(e.target.value)}
                    className="px-3 py-1.5 border border-white/20 rounded-lg text-xs font-fira bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-fe-blue"
                  >
                    <option value="">--</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-fira text-white/70">Assign to:</label>
                  <select
                    value={bulkOwner}
                    onChange={e => setBulkOwner(e.target.value)}
                    className="px-3 py-1.5 border border-white/20 rounded-lg text-xs font-fira bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-fe-blue"
                  >
                    <option value="">Pick a person...</option>
                    {team.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.role_data ? `${m.role_data.name} · ${m.name}` : m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={applyBulk}
                disabled={applying || (mode === 'template' ? !bulkRole : !bulkOwner)}
                className="ml-auto px-5 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {applying ? 'Assigning...' : `Assign ${selected.size} task${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
