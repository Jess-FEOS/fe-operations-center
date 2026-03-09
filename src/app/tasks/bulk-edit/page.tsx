'use client'

import { useState, useEffect, useCallback } from 'react'
import Avatar from '@/components/Avatar'

type Mode = 'active' | 'template'

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

interface Toast {
  message: string
  visible: boolean
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

  // Sync prompt
  const [showSyncPrompt, setShowSyncPrompt] = useState(false)
  const [pendingSyncPayload, setPendingSyncPayload] = useState<{ task_ids: string[]; role_id: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

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

  const teamById = team.reduce<Record<string, TeamMember>>((acc, m) => {
    acc[m.id] = m
    return acc
  }, {})

  const roleById = roles.reduce<Record<string, Role>>((acc, r) => {
    acc[r.id] = r
    return acc
  }, {})

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
  }

  const currentItems = mode === 'active' ? tasks : templateTasks

  async function findTasks() {
    setSearching(true)
    setSelected(new Set())
    setBulkRole('')
    setBulkOwner('')
    setShowSyncPrompt(false)
    setPendingSyncPayload(null)

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

  function toggleTask(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
        // Show sync prompt
        setPendingSyncPayload({ task_ids: Array.from(selected), role_id: bulkRole })
        setShowSyncPrompt(true)
        await findTasks()
      } else if (result.error) {
        showToast(`Error: ${result.error}`)
      }

      setApplying(false)
      return
    }

    // Active mode
    if (!bulkRole && !bulkOwner) return

    setApplying(true)

    const payload: Record<string, unknown> = {
      task_ids: Array.from(selected),
    }
    if (bulkRole) payload.role_id = bulkRole
    if (bulkOwner) payload.owner_id = bulkOwner

    const res = await fetch('/api/tasks/bulk-edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await res.json()

    if (result.updated) {
      showToast(`Updated ${result.updated} task${result.updated !== 1 ? 's' : ''} successfully`)
      await findTasks()
    } else if (result.error) {
      showToast(`Error: ${result.error}`)
    }

    setApplying(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-fe-navy font-fira text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="font-fira">
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
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-6">
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
      </div>

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

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="bg-fe-navy text-white rounded-xl px-5 py-4 mb-4 flex items-center gap-4 flex-wrap">
          <span className="text-sm font-fira font-bold shrink-0">
            {selected.size} task{selected.size !== 1 ? 's' : ''} selected
          </span>

          <div className="h-5 w-px bg-white/20" />

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

          {mode === 'active' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-fira text-white/70">Assign to Person:</label>
              <select
                value={bulkOwner}
                onChange={e => setBulkOwner(e.target.value)}
                className="px-3 py-1.5 border border-white/20 rounded-lg text-xs font-fira bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-fe-blue"
              >
                <option value="">--</option>
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
            disabled={applying || (mode === 'template' ? !bulkRole : (!bulkRole && !bulkOwner))}
            className="ml-auto px-5 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {applying ? 'Applying...' : `Apply to ${selected.size} task${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Results Table - Active Mode */}
      {searched && mode === 'active' && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-fe-blue-gray text-sm font-fira">
              No tasks match your filters. Try adjusting the criteria.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === tasks.length && tasks.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-fe-blue focus:ring-fe-blue"
                    />
                  </th>
                  <th className="text-left py-3 px-3 text-xs font-fira font-bold text-fe-navy">Task Name</th>
                  <th className="text-left py-3 px-3 text-xs font-fira font-bold text-fe-navy">Project</th>
                  <th className="text-left py-3 px-3 text-xs font-fira font-bold text-fe-navy">Role</th>
                  <th className="text-left py-3 px-3 text-xs font-fira font-bold text-fe-navy">Assignee</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => {
                  const role = task.role_id ? roleById[task.role_id] : null
                  const owners = (task.owner_ids || []).map(oid => teamById[oid]).filter(Boolean)
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
                        {task.task_name}
                      </td>
                      <td className="px-3 py-3 font-fira text-fe-blue-gray">
                        {task.project_name}
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
                      <td className="px-3 py-3">
                        {owners.length > 0 ? (
                          <div className="flex items-center gap-2">
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

          {tasks.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs font-fira text-fe-blue-gray">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>
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

      {!searched && (
        <div className="text-center py-16 text-fe-blue-gray text-sm font-fira">
          {mode === 'active'
            ? 'Use the filters above and click \u201cFind Tasks\u201d to load tasks for bulk editing.'
            : 'Use the filters above and click \u201cFind Tasks\u201d to load template tasks for bulk editing.'}
        </div>
      )}
    </div>
  )
}
