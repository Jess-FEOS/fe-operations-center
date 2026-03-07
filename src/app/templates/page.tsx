'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TemplateTask {
  id: string
  template_id: string
  title: string
  description: string | null
  owner: string
  week_number: number
  order_index: number
}

interface ProjectTemplate {
  id: string
  name: string
  type: string
  description: string
  tasks: TemplateTask[]
}

const WEEK_PHASES: Record<number, string> = {
  8: 'Planning',
  6: 'Setup',
  4: 'Build',
  3: 'Marketing Launch',
  2: 'Pre-Launch',
  1: 'Delivery Prep',
  0: 'Launch',
  [-1]: 'Wrap Up',
}

const TYPE_OPTIONS = [
  { value: 'course-launch', label: 'Course Launch' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'subscription', label: 'Subscription' },
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editType, setEditType] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', owner: '', week_number: 6 })
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTask, setEditTask] = useState({ title: '', owner: '', week_number: 6 })
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateType, setNewTemplateType] = useState('course-launch')
  const [newTemplateDesc, setNewTemplateDesc] = useState('')

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    const res = await fetch('/api/project-templates')
    const data = await res.json()
    setTemplates(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const selected = templates.find(t => t.id === selectedId) || null

  // Group tasks by week
  const groupedTasks = selected
    ? selected.tasks.reduce<Record<number, TemplateTask[]>>((acc, task) => {
        if (!acc[task.week_number]) acc[task.week_number] = []
        acc[task.week_number].push(task)
        return acc
      }, {})
    : {}
  const sortedWeeks = Object.keys(groupedTasks).map(Number).sort((a, b) => b - a)

  async function handleSaveTemplate() {
    if (!selected) return
    await fetch(`/api/project-templates/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, description: editDesc, type: editType }),
    })
    setEditingName(false)
    await fetchTemplates()
  }

  async function handleDeleteTemplate() {
    if (!selected || !confirm(`Delete "${selected.name}" and all its tasks?`)) return
    await fetch(`/api/project-templates/${selected.id}`, { method: 'DELETE' })
    setSelectedId(null)
    await fetchTemplates()
  }

  async function handleAddTask() {
    if (!selected || !newTask.title.trim() || !newTask.owner.trim()) return
    await fetch(`/api/project-templates/${selected.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask),
    })
    setNewTask({ title: '', owner: '', week_number: 6 })
    setShowAddTask(false)
    await fetchTemplates()
  }

  async function handleUpdateTask(taskId: string) {
    if (!selected) return
    await fetch(`/api/project-templates/${selected.id}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, ...editTask }),
    })
    setEditingTaskId(null)
    await fetchTemplates()
  }

  async function handleDeleteTask(taskId: string) {
    if (!selected) return
    await fetch(`/api/project-templates/${selected.id}/tasks?task_id=${taskId}`, {
      method: 'DELETE',
    })
    await fetchTemplates()
  }

  async function handleCreateTemplate() {
    if (!newTemplateName.trim()) return
    await fetch('/api/project-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_template', name: newTemplateName.trim(), type: newTemplateType, description: newTemplateDesc }),
    })
    setShowNewTemplate(false)
    setNewTemplateName('')
    setNewTemplateDesc('')
    await fetchTemplates()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="font-fira">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/projects/new"
            className="flex items-center gap-1 text-sm text-fe-blue-gray hover:text-fe-navy transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            New Project
          </Link>
          <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">Edit Templates</h1>
        </div>
        <button
          onClick={() => setShowNewTemplate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </button>
      </div>

      {/* New Template Modal */}
      {showNewTemplate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Create New Template</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Name</label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="e.g., Podcast Episode Production"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Type</label>
                <select
                  value={newTemplateType}
                  onChange={e => setNewTemplateType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                >
                  {TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Description</label>
                <textarea
                  value={newTemplateDesc}
                  onChange={e => setNewTemplateDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewTemplate(false)} className="px-4 py-2 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Template List (sidebar) */}
        <div className="col-span-4">
          <div className="space-y-2">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedId(t.id)
                  setEditName(t.name)
                  setEditDesc(t.description)
                  setEditType(t.type)
                  setEditingName(false)
                  setEditingTaskId(null)
                  setShowAddTask(false)
                }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  selectedId === t.id
                    ? 'border-fe-blue bg-fe-blue/5'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className="font-barlow font-bold text-sm text-fe-navy">{t.name}</div>
                <div className="text-xs text-fe-blue-gray mt-0.5">{t.tasks.length} tasks &middot; {t.type}</div>
              </button>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-fe-blue-gray text-center py-8">No templates yet.</p>
            )}
          </div>
        </div>

        {/* Template Detail */}
        <div className="col-span-8">
          {!selected ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-fe-blue-gray text-sm">Select a template to edit</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              {/* Template Header */}
              {editingName ? (
                <div className="space-y-3 mb-6">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-barlow font-bold focus:outline-none focus:ring-2 focus:ring-fe-blue"
                  />
                  <div className="flex gap-2">
                    <select
                      value={editType}
                      onChange={e => setEditType(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                    >
                      {TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveTemplate} className="px-3 py-1.5 bg-fe-blue text-white rounded-lg text-xs font-bold hover:bg-fe-blue/90 transition-colors">Save</button>
                    <button onClick={() => setEditingName(false)} className="px-3 py-1.5 bg-gray-100 text-fe-anthracite rounded-lg text-xs hover:bg-gray-200 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="font-barlow font-bold text-xl text-fe-navy">{selected.name}</h2>
                    <p className="text-xs text-fe-blue-gray mt-1">{selected.description}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-fira font-bold bg-fe-blue/10 text-fe-blue">
                      {selected.type} &middot; {selected.tasks.length} tasks
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingName(true)}
                      className="p-2 rounded-lg text-fe-blue-gray hover:bg-gray-100 transition-colors"
                      title="Edit template"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={handleDeleteTemplate}
                      className="p-2 rounded-lg text-fe-red hover:bg-red-50 transition-colors"
                      title="Delete template"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Tasks by Week */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-barlow font-bold text-sm text-fe-navy uppercase tracking-wide">Tasks</h3>
                <button
                  onClick={() => setShowAddTask(!showAddTask)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-fe-blue/10 text-fe-blue rounded-lg text-xs font-fira font-bold hover:bg-fe-blue/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Task
                </button>
              </div>

              {/* Add Task Form */}
              {showAddTask && (
                <div className="bg-fe-offwhite rounded-lg p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={newTask.title}
                        onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="Task title"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        value={newTask.owner}
                        onChange={e => setNewTask({ ...newTask, owner: e.target.value })}
                        placeholder="Owner (e.g., Jess)"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={newTask.week_number}
                        onChange={e => setNewTask({ ...newTask, week_number: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                      >
                        {[8, 6, 4, 3, 2, 1, 0, -1].map(w => (
                          <option key={w} value={w}>Wk {w} - {WEEK_PHASES[w]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <button
                        onClick={handleAddTask}
                        disabled={!newTask.title.trim() || !newTask.owner.trim()}
                        className="px-3 py-2 bg-fe-blue text-white rounded-lg text-xs font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddTask(false)}
                        className="px-3 py-2 bg-gray-100 text-fe-anthracite rounded-lg text-xs hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Task List grouped by week */}
              <div className="space-y-5 max-h-[60vh] overflow-y-auto">
                {sortedWeeks.map(week => (
                  <div key={week}>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-xs font-barlow font-bold text-fe-navy uppercase tracking-wide">
                        Week {week} &mdash; {WEEK_PHASES[week] || `Phase ${week}`}
                      </h4>
                      <span className="text-xs text-fe-blue-gray font-fira">
                        ({groupedTasks[week].length} tasks)
                      </span>
                    </div>
                    <div className="space-y-1">
                      {groupedTasks[week].map(task => (
                        <div key={task.id}>
                          {editingTaskId === task.id ? (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fe-blue/5 border border-fe-blue/20">
                              <input
                                type="text"
                                value={editTask.title}
                                onChange={e => setEditTask({ ...editTask, title: e.target.value })}
                                className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-fira focus:outline-none focus:ring-1 focus:ring-fe-blue"
                              />
                              <input
                                type="text"
                                value={editTask.owner}
                                onChange={e => setEditTask({ ...editTask, owner: e.target.value })}
                                className="w-24 px-2 py-1 border border-gray-200 rounded text-xs font-fira focus:outline-none focus:ring-1 focus:ring-fe-blue"
                              />
                              <select
                                value={editTask.week_number}
                                onChange={e => setEditTask({ ...editTask, week_number: Number(e.target.value) })}
                                className="px-2 py-1 border border-gray-200 rounded text-xs font-fira focus:outline-none focus:ring-1 focus:ring-fe-blue"
                              >
                                {[8, 6, 4, 3, 2, 1, 0, -1].map(w => (
                                  <option key={w} value={w}>Wk {w}</option>
                                ))}
                              </select>
                              <button onClick={() => handleUpdateTask(task.id)} className="px-2 py-1 bg-fe-blue text-white rounded text-xs font-bold">Save</button>
                              <button onClick={() => setEditingTaskId(null)} className="px-2 py-1 bg-gray-100 rounded text-xs">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-fe-offwhite group hover:bg-gray-100 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xs text-fe-blue-gray w-5 shrink-0">{task.order_index}</span>
                                <span className="text-xs font-fira text-fe-anthracite truncate">{task.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-fira text-fe-blue-gray">{task.owner}</span>
                                <div className="hidden group-hover:flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingTaskId(task.id)
                                      setEditTask({ title: task.title, owner: task.owner, week_number: task.week_number })
                                    }}
                                    className="p-1 rounded text-fe-blue-gray hover:text-fe-blue hover:bg-fe-blue/10 transition-colors"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="p-1 rounded text-fe-blue-gray hover:text-fe-red hover:bg-red-50 transition-colors"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {selected.tasks.length === 0 && (
                  <p className="text-sm text-fe-blue-gray text-center py-6">No tasks yet. Click &ldquo;Add Task&rdquo; to get started.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
