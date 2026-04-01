'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Avatar from '@/components/Avatar'
import StatusBadge from '@/components/StatusBadge'
import WorkflowBadge from '@/components/WorkflowBadge'
import ProgressBar from '@/components/ProgressBar'
import { TaskStatus, nextStatus, WORKFLOW_COLORS } from '@/lib/types'
import { getSimplifiedPhase, SIMPLIFIED_PHASE_ORDER, SIMPLIFIED_PHASE_COLORS, SimplifiedPhase } from '@/lib/phases'
import DuplicateProjectModal from '@/components/DuplicateProjectModal'

interface WorkflowTemplate {
  id: string
  name: string
  slug: string
  color: string
  total_weeks: number
}

const WORKFLOW_LABELS: Record<string, string> = {
  'course-launch': 'Course Launch',
  'podcast': 'Podcast',
  'newsletter': 'Newsletter',
  'subscription': 'Subscription Buildout',
}

interface ProjectTask {
  id: string
  project_id: string
  phase: string
  phase_order: number
  task_name: string
  task_order: number
  due_date: string
  week_number: number
  status: TaskStatus
  owner_ids: string[]
  role_id: string | null
  on_hold?: boolean
  follow_up_date?: string | null
}

interface TaskComment {
  id: string
  task_id: string
  team_member_id: string
  comment: string
  created_at: string
}

interface TaskLink {
  id: string
  task_id: string
  label: string
  url: string
  created_at: string
}

interface TaskDependency {
  id: string
  task_id: string
  depends_on_task_id: string
}

interface Project {
  id: string
  name: string
  workflow_type: string
  workflow_template_id: string
  start_date: string
  current_week: number
  status: string
  notes: string | null
  priority_id: string | null
  priority_title: string | null
  priority_status: string | null
  launch_date: string | null
  revenue_goal: number | null
  enrollment_goal: number | null
}

interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
  role_data: { id: string; name: string; color: string } | null
}

interface ProjectMetric {
  id: string
  metric_name: string
  metric_value: number
  metric_date: string
  notes: string | null
  campaign_name: string | null
  priority_title: string | null
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editLaunchDate, setEditLaunchDate] = useState('')
  const [editWorkflowType, setEditWorkflowType] = useState('')
  const [editRevenueGoal, setEditRevenueGoal] = useState('')
  const [editEnrollmentGoal, setEditEnrollmentGoal] = useState('')
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([])
  const [showWorkflowDropdown, setShowWorkflowDropdown] = useState(false)
  const [pendingWorkflow, setPendingWorkflow] = useState<WorkflowTemplate | null>(null)
  const [switchingWorkflow, setSwitchingWorkflow] = useState(false)
  const [bulkMenuPhase, setBulkMenuPhase] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskName, setEditingTaskName] = useState('')
  const [editingTaskStatus, setEditingTaskStatus] = useState<TaskStatus>('not_started')
  const [editingTaskDueDate, setEditingTaskDueDate] = useState('')
  const [editingTaskOnHold, setEditingTaskOnHold] = useState(false)
  const [editingTaskFollowUp, setEditingTaskFollowUp] = useState('')
  const [savingTask, setSavingTask] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [addingToPhase, setAddingToPhase] = useState<string | null>(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskOwner, setNewTaskOwner] = useState('')
  const [newTaskRole, setNewTaskRole] = useState('')
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [roles, setRoles] = useState<{ id: string; name: string; color: string }[]>([])
  const [notes, setNotes] = useState('')
  const notesRef = useRef<string>('')
  const [expandedComments, setExpandedComments] = useState<string | null>(null)
  const [taskComments, setTaskComments] = useState<Record<string, TaskComment[]>>({})
  const [newComment, setNewComment] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('')
  const [showCommentAuthorDropdown, setShowCommentAuthorDropdown] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [taskLinks, setTaskLinks] = useState<Record<string, TaskLink[]>>({})
  const [addingLinkToTask, setAddingLinkToTask] = useState<string | null>(null)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [dependencies, setDependencies] = useState<TaskDependency[]>([])
  const [addingDepToTask, setAddingDepToTask] = useState<string | null>(null)
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetric[]>([])
  const commentAuthorRef = useRef<HTMLDivElement>(null)
  const bulkMenuRef = useRef<HTMLDivElement>(null)
  const workflowDropdownRef = useRef<HTMLDivElement>(null)
  const ownerDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) {
        setBulkMenuPhase(null)
      }
      if (workflowDropdownRef.current && !workflowDropdownRef.current.contains(e.target as Node)) {
        setShowWorkflowDropdown(false)
      }
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target as Node)) {
        setShowOwnerDropdown(false)
      }
      if (commentAuthorRef.current && !commentAuthorRef.current.contains(e.target as Node)) {
        setShowCommentAuthorDropdown(false)
      }
    }
    if (bulkMenuPhase || showWorkflowDropdown || showOwnerDropdown || showCommentAuthorDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [bulkMenuPhase, showWorkflowDropdown, showOwnerDropdown, showCommentAuthorDropdown])

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${params.id}`).then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
      fetch('/api/workflow-templates').then(r => r.json()),
      fetch('/api/roles').then(r => r.json()),
      fetch(`/api/metrics?project_id=${params.id}`).then(r => r.json()).catch(() => []),
    ]).then(([projectData, teamData, templates, rolesData, metricsData]) => {
      setProject(projectData.project)
      setTasks(projectData.tasks || [])
      setTeam(teamData)
      // Group links by task_id
      const linksMap: Record<string, TaskLink[]> = {}
      for (const link of (projectData.links || [])) {
        if (!linksMap[link.task_id]) linksMap[link.task_id] = []
        linksMap[link.task_id].push(link)
      }
      setTaskLinks(linksMap)
      setDependencies(projectData.dependencies || [])
      setEditName(projectData.project?.name || '')
      setEditDate(projectData.project?.start_date || '')
      setEditLaunchDate(projectData.project?.launch_date || '')
      setEditWorkflowType(projectData.project?.workflow_type || '')
      setEditRevenueGoal(projectData.project?.revenue_goal != null ? String(projectData.project.revenue_goal) : '')
      setEditEnrollmentGoal(projectData.project?.enrollment_goal != null ? String(projectData.project.enrollment_goal) : '')
      const initialNotes = projectData.project?.notes || ''
      setNotes(initialNotes)
      notesRef.current = initialNotes
      setWorkflowTemplates(templates)
      setRoles(Array.isArray(rolesData) ? rolesData : [])
      setProjectMetrics(Array.isArray(metricsData) ? metricsData : [])
      // Expand all phases by default
      const phases = new Set<string>((projectData.tasks || []).map((t: ProjectTask) => t.phase))
      setExpandedPhases(phases)
      setLoading(false)
    })
  }, [params.id])

  const teamMap = new Map(team.map(m => [m.id, m]))

  const togglePhase = (phase: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phase)) next.delete(phase)
      else next.add(phase)
      return next
    })
  }

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    await fetch(`/api/projects/${params.id}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  const bulkUpdatePhase = async (phase: string, newStatus: TaskStatus) => {
    const phaseTasks = tasks.filter(t => getSimplifiedPhase(t.phase) === phase)
    await Promise.all(
      phaseTasks.map(t =>
        fetch(`/api/projects/${params.id}/tasks/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      )
    )
    setTasks(prev => prev.map(t => t.phase === phase ? { ...t, status: newStatus } : t))
    setBulkMenuPhase(null)
  }

  const confirmWorkflowSwitch = async () => {
    if (!pendingWorkflow) return
    setSwitchingWorkflow(true)
    const res = await fetch(`/api/projects/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_type: pendingWorkflow.slug,
        workflow_template_id: pendingWorkflow.id,
      }),
    })
    const data = await res.json()
    setProject(data.project)
    setTasks(data.tasks || [])
    const phases = new Set<string>((data.tasks || []).map((t: ProjectTask) => t.phase))
    setExpandedPhases(phases)
    setSwitchingWorkflow(false)
    setPendingWorkflow(null)
  }

  const deleteProject = async () => {
    setDeleting(true)
    await fetch(`/api/projects/${params.id}`, { method: 'DELETE' })
    router.push('/projects')
  }

  const openEditPanel = (task: ProjectTask) => {
    setEditingTaskId(task.id)
    setEditingTaskName(task.task_name)
    setEditingTaskStatus(task.status)
    setEditingTaskDueDate(task.due_date || '')
    setEditingTaskOnHold(task.on_hold || false)
    setEditingTaskFollowUp(task.follow_up_date || '')
    setSavingTask(false)
  }

  const saveTaskEdit = async (taskId: string) => {
    if (!editingTaskName.trim()) return
    setSavingTask(true)
    const body: Record<string, unknown> = {
      task_name: editingTaskName.trim(),
      status: editingTaskStatus,
      due_date: editingTaskDueDate || undefined,
      on_hold: editingTaskOnHold,
      follow_up_date: editingTaskFollowUp || null,
    }
    try {
      await fetch(`/api/projects/${params.id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        task_name: editingTaskName.trim(),
        status: editingTaskStatus,
        due_date: editingTaskDueDate || t.due_date,
        on_hold: editingTaskOnHold,
        follow_up_date: editingTaskFollowUp || null,
      } : t))
      setEditingTaskId(null)
    } finally {
      setSavingTask(false)
    }
  }

  const deleteTask = async (taskId: string) => {
    await fetch(`/api/projects/${params.id}/tasks/${taskId}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setDeletingTaskId(null)
  }

  const addTask = async (phase: string, phaseOrder: number) => {
    if (!newTaskName.trim() || !newTaskRole) return
    const res = await fetch(`/api/projects/${params.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_name: newTaskName.trim(),
        phase,
        phase_order: phaseOrder,
        owner_ids: newTaskOwner ? [newTaskOwner] : [],
        role_id: newTaskRole,
      }),
    })
    const newTask = await res.json()
    if (res.ok) {
      setTasks(prev => [...prev, newTask])
      setNewTaskName('')
      setNewTaskOwner('')
      setNewTaskRole('')
      setAddingToPhase(null)
    }
  }

  const saveNotes = async (value: string) => {
    if (value === notesRef.current) return
    notesRef.current = value
    await fetch(`/api/projects/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: value }),
    })
    setProject(prev => prev ? { ...prev, notes: value } : prev)
  }

  const toggleComments = async (taskId: string) => {
    if (expandedComments === taskId) {
      setExpandedComments(null)
      return
    }
    setExpandedComments(taskId)
    setLoadingComments(true)
    const fetches: Promise<void>[] = []
    if (!taskComments[taskId]) {
      fetches.push(
        fetch(`/api/projects/${params.id}/tasks/${taskId}/comments`)
          .then(r => r.json())
          .then(data => setTaskComments(prev => ({ ...prev, [taskId]: data })))
      )
    }
    if (!taskLinks[taskId]) {
      fetches.push(
        fetch(`/api/projects/${params.id}/tasks/${taskId}/links`)
          .then(r => r.json())
          .then(data => setTaskLinks(prev => ({ ...prev, [taskId]: data })))
      )
    }
    await Promise.all(fetches)
    setLoadingComments(false)
    setNewComment('')
  }

  const fetchLinks = async (taskId: string) => {
    const res = await fetch(`/api/projects/${params.id}/tasks/${taskId}/links`)
    const data = await res.json()
    setTaskLinks(prev => ({ ...prev, [taskId]: data }))
  }

  const addLink = async (taskId: string) => {
    if (!linkLabel.trim() || !linkUrl.trim()) return
    const res = await fetch(`/api/projects/${params.id}/tasks/${taskId}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: linkLabel.trim(), url: linkUrl.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setTaskLinks(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []), data] }))
      setLinkLabel('')
      setLinkUrl('')
      setAddingLinkToTask(null)
    }
  }

  const removeLink = async (taskId: string, linkId: string) => {
    await fetch(`/api/projects/${params.id}/tasks/${taskId}/links/${linkId}`, { method: 'DELETE' })
    setTaskLinks(prev => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter(l => l.id !== linkId),
    }))
  }

  const submitComment = async (taskId: string) => {
    if (!newComment.trim() || !commentAuthor) return
    const res = await fetch(`/api/projects/${params.id}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_member_id: commentAuthor, comment: newComment.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setTaskComments(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []), data] }))
      setNewComment('')
    }
  }

  const addDependency = async (taskId: string, dependsOnId: string) => {
    const res = await fetch(`/api/projects/${params.id}/tasks/${taskId}/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ depends_on_task_id: dependsOnId }),
    })
    const data = await res.json()
    if (res.ok) {
      setDependencies(prev => [...prev, data])
    }
    setAddingDepToTask(null)
  }

  const removeDependency = async (taskId: string, dependsOnId: string) => {
    await fetch(`/api/projects/${params.id}/tasks/${taskId}/dependencies?depends_on_task_id=${dependsOnId}`, {
      method: 'DELETE',
    })
    setDependencies(prev => prev.filter(d => !(d.task_id === taskId && d.depends_on_task_id === dependsOnId)))
  }

  const saveEdits = async () => {
    const updates: Record<string, unknown> = {
      name: editName,
      start_date: editDate,
      launch_date: editLaunchDate || null,
      workflow_type: editWorkflowType,
      revenue_goal: editRevenueGoal ? parseFloat(editRevenueGoal) : null,
      enrollment_goal: editEnrollmentGoal ? parseInt(editEnrollmentGoal) : null,
    }
    const res = await fetch(`/api/projects/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const data = await res.json()
      const updated = data.project || data
      setProject(prev => prev ? { ...prev, ...updated } : prev)
    }
    setEditing(false)
  }

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  // Group tasks by simplified phase (Build, Market, Launch & Run)
  const phaseGroups: Record<SimplifiedPhase, ProjectTask[]> = {
    'Build': [],
    'Market': [],
    'Launch & Run': [],
  }
  for (const task of tasks) {
    phaseGroups[getSimplifiedPhase(task.phase)].push(task)
  }

  const phases = SIMPLIFIED_PHASE_ORDER.map(sp => ({
    phase: sp,
    phase_order: SIMPLIFIED_PHASE_ORDER.indexOf(sp),
    tasks: phaseGroups[sp].sort((a, b) => a.phase_order - b.phase_order || a.task_order - b.task_order),
  })).filter(p => p.tasks.length > 0)

  // Build dependency map: task_id → depends_on_task_ids[]
  const depsMap = new Map<string, string[]>()
  for (const dep of dependencies) {
    if (!depsMap.has(dep.task_id)) depsMap.set(dep.task_id, [])
    depsMap.get(dep.task_id)!.push(dep.depends_on_task_id)
  }

  const taskMap = new Map(tasks.map(t => [t.id, t]))

  const isBlocked = (taskId: string) => {
    const deps = depsMap.get(taskId)
    if (!deps || deps.length === 0) return false
    return deps.some(depId => {
      const depTask = taskMap.get(depId)
      return depTask && depTask.status !== 'done'
    })
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-fe-blue-gray hover:text-fe-navy font-fira mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {editing ? (
              <div className="space-y-3">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={saveEdits}
                    className="px-4 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditName(project.name); setEditDate(project.start_date); setEditLaunchDate(project.launch_date || ''); setEditWorkflowType(project.workflow_type); setEditRevenueGoal(project.revenue_goal != null ? String(project.revenue_goal) : ''); setEditEnrollmentGoal(project.enrollment_goal != null ? String(project.enrollment_goal) : ''); }}
                    className="px-4 py-2 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
                <div>
                  <label className="block text-xs text-fe-blue-gray font-fira mb-1">Project Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs text-fe-blue-gray font-fira mb-1">Workflow Type</label>
                  <select
                    value={editWorkflowType}
                    onChange={e => setEditWorkflowType(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white"
                  >
                    <option value="course-launch">Course Launch</option>
                    <option value="podcast">Podcast</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="subscription">Subscription Buildout</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-fe-blue-gray font-fira mb-1">Start Date</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-fe-blue-gray font-fira mb-1">Launch Date</label>
                    <input
                      type="date"
                      value={editLaunchDate}
                      onChange={e => setEditLaunchDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-fe-blue-gray font-fira mb-1">Revenue Goal</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-fira text-fe-blue-gray">$</span>
                      <input
                        type="number"
                        value={editRevenueGoal}
                        onChange={e => setEditRevenueGoal(e.target.value)}
                        placeholder="e.g. 50000"
                        className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-fe-blue-gray font-fira mb-1">Enrollment Goal</label>
                    <input
                      type="number"
                      value={editEnrollmentGoal}
                      onChange={e => setEditEnrollmentGoal(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">{project.name}</h1>
                  <div className="relative" ref={workflowDropdownRef}>
                    <button
                      onClick={() => setShowWorkflowDropdown(!showWorkflowDropdown)}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-fira font-bold text-white cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: WORKFLOW_COLORS[project.workflow_type] || '#647692' }}
                    >
                      {WORKFLOW_LABELS[project.workflow_type] || project.workflow_type}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showWorkflowDropdown && (
                      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[180px]">
                        {workflowTemplates.map(tmpl => (
                          <button
                            key={tmpl.id}
                            disabled={tmpl.slug === project.workflow_type}
                            onClick={() => {
                              setShowWorkflowDropdown(false)
                              setPendingWorkflow(tmpl)
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2 disabled:opacity-40 disabled:cursor-default"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: tmpl.color }}
                            />
                            {WORKFLOW_LABELS[tmpl.slug] || tmpl.name}
                            {tmpl.slug === project.workflow_type && (
                              <svg className="w-3 h-3 ml-auto text-fe-blue-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-fe-blue-gray font-fira">
                  Started {new Date(project.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                {/* Priority chip */}
                <div className="flex items-center gap-2 mt-1">
                  {project.priority_id && project.priority_title ? (
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-fira font-bold bg-fe-blue/10 text-fe-blue hover:bg-fe-blue/20 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.priority_status === 'done' ? '#046A38' : project.priority_status === 'in_progress' ? '#0762C8' : '#647692' }} />
                      {project.priority_title}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-fira font-bold bg-gray-100 text-gray-400">
                      No priority linked
                    </span>
                  )}
                </div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={e => saveNotes(e.target.value)}
                  placeholder="Add project brief, goals, or links..."
                  rows={2}
                  className="mt-3 w-full px-3 py-2 text-sm font-fira text-fe-anthracite bg-transparent border border-transparent rounded-lg hover:border-gray-200 focus:border-gray-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fe-blue resize-y placeholder:text-gray-300 transition-colors"
                />
                {/* Info row: launch_date, revenue_goal, enrollment_goal */}
                {(project.launch_date || project.revenue_goal || project.enrollment_goal) && (
                  <div className="flex flex-wrap gap-4 mt-3">
                    {project.launch_date && (
                      <div className="flex items-center gap-1.5 text-xs font-fira text-fe-anthracite">
                        <svg className="w-3.5 h-3.5 text-fe-blue-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Launch: {new Date(project.launch_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                    {project.revenue_goal && (
                      <div className="text-xs font-fira text-fe-anthracite">
                        Revenue Goal: <span className="font-bold">${Number(project.revenue_goal).toLocaleString()}</span>
                      </div>
                    )}
                    {project.enrollment_goal && (
                      <div className="text-xs font-fira text-fe-anthracite">
                        Enrollment Goal: <span className="font-bold">{Number(project.enrollment_goal).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {!editing && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-600 border border-gray-200 rounded-lg font-fira hover:bg-red-50 hover:border-red-200 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDuplicate(true)}
                className="px-3 py-1.5 text-sm text-fe-blue-gray hover:text-fe-navy border border-gray-200 rounded-lg font-fira hover:bg-gray-50 transition-colors"
              >
                Duplicate
              </button>
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 text-sm text-fe-blue-gray hover:text-fe-navy border border-gray-200 rounded-lg font-fira hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-fira text-fe-blue-gray">Overall Progress</span>
            <span className="text-sm font-fira font-bold text-fe-navy">{progress}%</span>
          </div>
          <ProgressBar percent={progress} size="md" />
          <p className="text-xs text-fe-blue-gray font-fira mt-1">
            {doneTasks} of {totalTasks} tasks complete
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {phases.map(phase => {
          const phaseDone = phase.tasks.filter(t => t.status === 'done').length
          const phaseTotal = phase.tasks.length
          const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0
          const phaseColor = SIMPLIFIED_PHASE_COLORS[phase.phase as SimplifiedPhase] ?? '#1B365D'
          const isExpanded = expandedPhases.has(phase.phase)

          return (
            <div key={phase.phase} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <button
                  onClick={() => togglePhase(phase.phase)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <svg
                    className={`w-4 h-4 text-fe-blue-gray transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: phaseColor }} />
                  <h3 className="font-barlow font-bold text-sm text-fe-navy">{phase.phase}</h3>
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-32">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${phasePct}%`, backgroundColor: phaseColor }} />
                    </div>
                    <span className="text-xs text-fe-blue-gray font-fira whitespace-nowrap">
                      {phaseDone}/{phaseTotal}
                    </span>
                  </div>
                  <div className="relative" ref={bulkMenuPhase === phase.phase ? bulkMenuRef : undefined}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setBulkMenuPhase(bulkMenuPhase === phase.phase ? null : phase.phase)
                      }}
                      className="px-2 py-1 text-xs font-fira text-fe-blue-gray border border-gray-200 rounded-md hover:bg-gray-100 hover:text-fe-navy transition-colors"
                    >
                      Set All ▾
                    </button>
                    {bulkMenuPhase === phase.phase && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                        <button
                          onClick={() => bulkUpdatePhase(phase.phase, 'done')}
                          className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-[#046A38]" />
                          Done
                        </button>
                        <button
                          onClick={() => bulkUpdatePhase(phase.phase, 'in_progress')}
                          className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-[#0762C8]" />
                          In Progress
                        </button>
                        <button
                          onClick={() => bulkUpdatePhase(phase.phase, 'not_started')}
                          className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-[#9CA3AF]" />
                          Not Started
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-50">
                  {phase.tasks.map(task => {
                    const commentsForTask = taskComments[task.id] || []
                    const linksForTask = taskLinks[task.id] || []
                    const isCommentsOpen = expandedComments === task.id

                    return (
                      <div key={task.id} className="border-b border-gray-50 last:border-b-0">
                        {editingTaskId === task.id ? (
                          /* ── Edit Panel (replaces entire row) ── */
                          <div className="px-4 py-3">
                            <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                              <div>
                                <label className="block text-[10px] font-fira font-bold text-fe-blue-gray uppercase tracking-wide mb-1">Task Name</label>
                                <input type="text" value={editingTaskName} onChange={e => setEditingTaskName(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-fira text-fe-anthracite focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent bg-white" autoFocus onKeyDown={e => { if (e.key === 'Escape') setEditingTaskId(null) }} />
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <label className="block text-[10px] font-fira font-bold text-fe-blue-gray uppercase tracking-wide mb-1">Status</label>
                                  <select value={editingTaskStatus} onChange={e => setEditingTaskStatus(e.target.value as TaskStatus)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-fira text-fe-anthracite focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent bg-white">
                                    <option value="not_started">Not Started</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="done">Done</option>
                                    <option value="blocked">Blocked</option>
                                  </select>
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[10px] font-fira font-bold text-fe-blue-gray uppercase tracking-wide mb-1">Due Date</label>
                                  <input type="date" value={editingTaskDueDate} onChange={e => setEditingTaskDueDate(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-fira text-fe-anthracite focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent bg-white" />
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <label className="block text-[10px] font-fira font-bold text-fe-blue-gray uppercase tracking-wide mb-1">On Hold</label>
                                  <button type="button" onClick={() => setEditingTaskOnHold(!editingTaskOnHold)} className={`flex items-center gap-2 w-full px-2.5 py-1.5 border rounded-lg text-sm font-fira transition-colors ${editingTaskOnHold ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-fe-anthracite'}`}>
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${editingTaskOnHold ? 'bg-amber-500 border-amber-500' : 'border-gray-300'}`}>
                                      {editingTaskOnHold && (<svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>)}
                                    </div>
                                    {editingTaskOnHold ? 'On Hold' : 'Not on hold'}
                                  </button>
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[10px] font-fira font-bold text-fe-blue-gray uppercase tracking-wide mb-1">Follow-up Date</label>
                                  <input type="date" value={editingTaskFollowUp} onChange={e => setEditingTaskFollowUp(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-fira text-fe-anthracite focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent bg-white" />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button onClick={() => saveTaskEdit(task.id)} disabled={savingTask} className="px-3 py-1.5 bg-fe-blue text-white text-xs font-fira font-bold rounded-lg hover:bg-fe-blue/90 transition-colors disabled:opacity-50">{savingTask ? 'Saving...' : 'Save'}</button>
                                <button onClick={() => setEditingTaskId(null)} className="px-3 py-1.5 text-xs font-fira font-bold text-fe-blue-gray hover:text-fe-anthracite transition-colors">Cancel</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                        <>
                        <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 group/task">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {task.owner_ids.length > 0 ? task.owner_ids.map(oid => {
                                const member = teamMap.get(oid)
                                return member ? (
                                  <div key={oid} className="flex items-center gap-1" title={member.role_data ? `${member.role_data.name} · ${member.name}` : member.name}>
                                    <Avatar initials={member.initials} color={member.color} size="sm" />
                                    <span className="text-xs font-fira text-fe-blue-gray">
                                      {member.role_data ? (
                                        <><span className="font-bold" style={{ color: member.role_data.color }}>{member.role_data.name}</span> &middot; {member.name.split(' ')[0]}</>
                                      ) : member.name.split(' ')[0]}
                                    </span>
                                  </div>
                                ) : null
                              }) : task.role_id ? (
                                <div className="flex items-center gap-1">
                                  {(() => {
                                    const role = roles.find(r => r.id === task.role_id)
                                    return role ? (
                                      <>
                                        <div className="w-6 h-6 rounded-full border-2 border-dashed flex items-center justify-center" style={{ borderColor: role.color }}>
                                          <span className="text-[8px] font-bold" style={{ color: role.color }}>?</span>
                                        </div>
                                        <span className="text-xs font-fira">
                                          <span className="font-bold" style={{ color: role.color }}>{role.name}</span>
                                          <span className="text-amber-500"> — Unassigned</span>
                                        </span>
                                      </>
                                    ) : null
                                  })()}
                                </div>
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => toggleComments(task.id)}
                                    className="text-sm font-fira text-fe-anthracite truncate hover:text-fe-blue transition-colors text-left"
                                  >
                                    {task.task_name}
                                  </button>
                                  {task.on_hold && (
                                    <span className="shrink-0 text-[9px] font-fira font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 uppercase tracking-wide">
                                      On Hold
                                    </span>
                                  )}
                                  {task.follow_up_date && (
                                    <span className="shrink-0 text-[9px] font-fira text-fe-blue-gray" title={`Follow-up: ${task.follow_up_date}`}>
                                      F/U {new Date(task.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => toggleComments(task.id)}
                                    className={`shrink-0 transition-colors ${isCommentsOpen ? 'text-fe-blue' : 'text-gray-300 opacity-0 group-hover/task:opacity-100 hover:text-fe-blue'}`}
                                    title="Comments"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => openEditPanel(task)}
                                    className="opacity-0 group-hover/task:opacity-100 text-gray-400 hover:text-fe-navy transition-opacity shrink-0"
                                    title="Edit task"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setDeletingTaskId(task.id)}
                                    className="opacity-0 group-hover/task:opacity-100 text-gray-400 hover:text-red-500 transition-opacity shrink-0"
                                    title="Delete task"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setAddingDepToTask(prev => prev === task.id ? null : task.id)
                                    }}
                                    className={`shrink-0 transition-opacity ${addingDepToTask === task.id ? 'opacity-100 text-fe-blue' : 'opacity-0 group-hover/task:opacity-100 text-gray-400 hover:text-fe-blue'}`}
                                    title="Add dependency"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                  </button>
                                </div>
                                  <p className="text-xs text-gray-400 font-fira">
                                    Week {task.week_number} &middot; Due {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </p>
                                  {linksForTask.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {linksForTask.map(link => (
                                        <span key={link.id} className="inline-flex items-center gap-1 group/link">
                                          <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-fe-blue/10 text-fe-blue rounded text-xs font-fira hover:bg-fe-blue/20 transition-colors"
                                            onClick={e => e.stopPropagation()}
                                          >
                                            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                            </svg>
                                            {link.label}
                                          </a>
                                          <button
                                            onClick={e => { e.stopPropagation(); removeLink(task.id, link.id) }}
                                            className="opacity-0 group-hover/link:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                                            title="Remove link"
                                          >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {addingLinkToTask === task.id ? (
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <input
                                        type="text"
                                        value={linkLabel}
                                        onChange={e => setLinkLabel(e.target.value)}
                                        placeholder="Label"
                                        className="w-32 px-2 py-1 border border-gray-200 rounded text-xs font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                                        autoFocus
                                        onKeyDown={e => {
                                          if (e.key === 'Escape') { setAddingLinkToTask(null); setLinkLabel(''); setLinkUrl('') }
                                        }}
                                      />
                                      <input
                                        type="url"
                                        value={linkUrl}
                                        onChange={e => setLinkUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                                        onKeyDown={e => {
                                          if (e.key === 'Enter' && linkLabel.trim() && linkUrl.trim()) addLink(task.id)
                                          if (e.key === 'Escape') { setAddingLinkToTask(null); setLinkLabel(''); setLinkUrl('') }
                                        }}
                                      />
                                      <button
                                        onClick={() => addLink(task.id)}
                                        disabled={!linkLabel.trim() || !linkUrl.trim()}
                                        className="px-2 py-1 bg-fe-blue text-white rounded text-xs font-fira font-bold hover:bg-fe-blue/90 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        Add
                                      </button>
                                      <button
                                        onClick={() => { setAddingLinkToTask(null); setLinkLabel(''); setLinkUrl('') }}
                                        className="text-gray-400 hover:text-gray-600"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation()
                                        setAddingLinkToTask(task.id)
                                        setLinkLabel('')
                                        setLinkUrl('')
                                        if (!taskLinks[task.id]) fetchLinks(task.id)
                                      }}
                                      className="opacity-0 group-hover/task:opacity-100 mt-1 inline-flex items-center gap-1 text-xs font-fira text-gray-400 hover:text-fe-blue transition-all"
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                      </svg>
                                      Add Link
                                    </button>
                                  )}
                                  {/* Dependency chips */}
                                  {(depsMap.get(task.id) || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {(depsMap.get(task.id) || []).map(depId => {
                                        const depTask = taskMap.get(depId)
                                        if (!depTask) return null
                                        const done = depTask.status === 'done'
                                        return (
                                          <span key={depId} className="inline-flex items-center gap-1 group/dep">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-fira ${done ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-700'}`}>
                                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                              </svg>
                                              {depTask.task_name}
                                            </span>
                                            <button
                                              onClick={e => { e.stopPropagation(); removeDependency(task.id, depId) }}
                                              className="opacity-0 group-hover/dep:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                                              title="Remove dependency"
                                            >
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                  {/* Dependency selector dropdown */}
                                  {addingDepToTask === task.id && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <select
                                        className="px-2 py-1 border border-gray-200 rounded text-xs font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                                        value=""
                                        onChange={e => {
                                          if (e.target.value) addDependency(task.id, e.target.value)
                                        }}
                                      >
                                        <option value="" disabled>Select a task...</option>
                                        {tasks
                                          .filter(t => t.id !== task.id && !(depsMap.get(task.id) || []).includes(t.id))
                                          .map(t => (
                                            <option key={t.id} value={t.id}>{t.task_name} (Week {t.week_number} - {t.phase})</option>
                                          ))}
                                      </select>
                                      <button
                                        onClick={() => setAddingDepToTask(null)}
                                        className="text-gray-400 hover:text-gray-600"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  )}
                            </div>
                          </div>
                            <div className="flex items-center gap-2">
                              {isBlocked(task.id) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-fira font-bold bg-red-50 text-red-600 border border-red-100">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-2.99L13.73 4.01c-.77-1.33-2.69-1.33-3.46 0L3.34 16.01C2.57 17.33 3.53 19 5.07 19z" />
                                  </svg>
                                  Blocked
                                </span>
                              )}
                              <StatusBadge
                                status={task.status}
                                onClick={(newStatus) => updateTaskStatus(task.id, newStatus)}
                              />
                            </div>
                        </div>

                        {isCommentsOpen && (
                          <div className="bg-gray-50/80 px-4 py-3 ml-10 mr-4 mb-3 rounded-lg border border-gray-100">
                            {loadingComments && commentsForTask.length === 0 ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="w-5 h-5 border-2 border-fe-blue border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : (
                              <>
                                {commentsForTask.length === 0 && (
                                  <p className="text-xs text-gray-400 font-fira py-2 text-center">No comments yet</p>
                                )}
                                <div className="space-y-3">
                                  {commentsForTask.map(c => {
                                    const author = teamMap.get(c.team_member_id)
                                    return (
                                      <div key={c.id} className="flex gap-2.5">
                                        <Avatar
                                          initials={author?.initials || '?'}
                                          color={author?.color || '#999'}
                                          size="sm"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-fira font-bold text-fe-navy">{author?.name || 'Unknown'}</span>
                                            <span className="text-xs text-gray-400 font-fira">
                                              {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                              {' '}
                                              {new Date(c.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                            </span>
                                          </div>
                                          <p className="text-sm font-fira text-fe-anthracite mt-0.5">{c.comment}</p>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <div className="relative" ref={showCommentAuthorDropdown ? commentAuthorRef : undefined}>
                                    <button
                                      onClick={() => setShowCommentAuthorDropdown(!showCommentAuthorDropdown)}
                                      className="shrink-0"
                                      title="Select commenter"
                                    >
                                      {commentAuthor ? (
                                        <Avatar
                                          initials={teamMap.get(commentAuthor)?.initials || '?'}
                                          color={teamMap.get(commentAuthor)?.color || '#999'}
                                          size="sm"
                                        />
                                      ) : (
                                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                          </svg>
                                        </div>
                                      )}
                                    </button>
                                    {showCommentAuthorDropdown && (
                                      <div className="absolute left-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
                                        {team.map(m => (
                                          <button
                                            key={m.id}
                                            onClick={() => { setCommentAuthor(m.id); setShowCommentAuthorDropdown(false) }}
                                            className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2"
                                          >
                                            <Avatar initials={m.initials} color={m.color} size="sm" />
                                            {m.name}
                                            {commentAuthor === m.id && (
                                              <svg className="w-3 h-3 ml-auto text-fe-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <input
                                    type="text"
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    placeholder={commentAuthor ? 'Add a comment...' : 'Select who you are, then comment...'}
                                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white"
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && newComment.trim() && commentAuthor) submitComment(task.id)
                                    }}
                                  />
                                  <button
                                    onClick={() => submitComment(task.id)}
                                    disabled={!newComment.trim() || !commentAuthor}
                                    className="shrink-0 px-3 py-1.5 bg-fe-blue text-white rounded-lg text-xs font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    Send
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        </>
                        )}
                      </div>
                    )
                  })}

                  {addingToPhase === phase.phase ? (
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newTaskName}
                          onChange={e => setNewTaskName(e.target.value)}
                          placeholder="Task name"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Escape') { setAddingToPhase(null); setNewTaskName(''); setNewTaskOwner(''); setNewTaskRole('') }
                            if (e.key === 'Enter' && newTaskName.trim() && newTaskRole) addTask(phase.phase, phase.phase_order)
                          }}
                        />
                        <select
                          value={newTaskRole}
                          onChange={e => setNewTaskRole(e.target.value)}
                          className={`px-3 py-2 border rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white shrink-0 ${
                            newTaskRole ? 'border-gray-200' : 'border-amber-300 bg-amber-50'
                          }`}
                        >
                          <option value="">Role *</option>
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        <div className="relative" ref={showOwnerDropdown ? ownerDropdownRef : undefined}>
                          <button
                            onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira text-fe-blue-gray hover:bg-gray-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            {newTaskOwner ? (
                              <Avatar initials={teamMap.get(newTaskOwner)?.initials || '?'} color={teamMap.get(newTaskOwner)?.color || '#999'} size="sm" />
                            ) : 'Person'}
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {showOwnerDropdown && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
                              <button
                                onClick={() => { setNewTaskOwner(''); setShowOwnerDropdown(false) }}
                                className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-gray-400"
                              >
                                No person (role only)
                              </button>
                              {team.map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => { setNewTaskOwner(m.id); setShowOwnerDropdown(false) }}
                                  className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2"
                                >
                                  <Avatar initials={m.initials} color={m.color} size="sm" />
                                  {m.role_data ? <><span className="font-bold" style={{ color: m.role_data.color }}>{m.role_data.name}</span> &middot; {m.name}</> : m.name}
                                  {newTaskOwner === m.id && (
                                    <svg className="w-3 h-3 ml-auto text-fe-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {!newTaskRole && roles.length === 0 && (
                        <p className="text-xs text-amber-600 font-fira mt-1.5">No roles exist yet. <a href="/team" className="underline hover:text-amber-800">Create a role first</a>.</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => addTask(phase.phase, phase.phase_order)}
                          disabled={!newTaskName.trim() || !newTaskRole}
                          className="px-3 py-1.5 bg-fe-blue text-white rounded-lg text-xs font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Add Task
                        </button>
                        <button
                          onClick={() => { setAddingToPhase(null); setNewTaskName(''); setNewTaskOwner(''); setNewTaskRole(''); setShowOwnerDropdown(false) }}
                          className="px-3 py-1.5 bg-gray-100 text-fe-anthracite rounded-lg text-xs font-fira hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingToPhase(phase.phase); setNewTaskName(''); setNewTaskOwner(''); setNewTaskRole('') }}
                      className="w-full px-4 py-2.5 text-xs font-fira text-fe-blue-gray hover:text-fe-navy hover:bg-gray-50 transition-colors flex items-center gap-1.5 border-t border-gray-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Task
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Metrics Section */}
      <div className="mt-6 bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-barlow font-extrabold text-lg text-fe-navy mb-4">Metrics</h2>
        {projectMetrics.length === 0 ? (
          <p className="text-sm text-fe-blue-gray font-fira">No metrics logged yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectMetrics.map(metric => (
              <div key={metric.id} className="border border-gray-100 rounded-lg p-4">
                <div className="text-2xl font-barlow font-extrabold text-fe-navy">
                  {typeof metric.metric_value === 'number' ? metric.metric_value.toLocaleString() : metric.metric_value}
                </div>
                <div className="text-xs font-fira text-fe-blue-gray mt-1">{metric.metric_name}</div>
                <div className="text-xs font-fira text-gray-400 mt-0.5">
                  {new Date(metric.metric_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                {metric.notes && (
                  <p className="text-xs font-fira text-fe-anthracite mt-2">{metric.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showDuplicate && project && (
        <DuplicateProjectModal
          sourceName={project.name}
          workflowType={project.workflow_type}
          workflowTemplateId={project.workflow_template_id}
          onClose={() => setShowDuplicate(false)}
          onCreated={(newProject) => {
            setShowDuplicate(false)
            router.push(`/projects/${newProject.id}`)
          }}
        />
      )}

      {showDeleteConfirm && project && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div
            className="bg-white rounded-xl border border-gray-100 shadow-xl w-full max-w-md mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-barlow font-bold text-lg text-fe-navy mb-3">Delete Project</h2>
            <p className="text-sm text-fe-anthracite font-fira mb-6">
              Are you sure you want to delete <span className="font-bold">{project.name}</span>? This will permanently delete all tasks associated with this project.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteProject}
                disabled={deleting}
                className="flex-1 px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-fira font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingWorkflow && project && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setPendingWorkflow(null)}>
          <div
            className="bg-white rounded-xl border border-gray-100 shadow-xl w-full max-w-md mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-barlow font-bold text-lg text-fe-navy mb-3">Change Workflow Type</h2>
            <p className="text-sm text-fe-anthracite font-fira mb-2">
              Switch from <span className="font-bold">{WORKFLOW_LABELS[project.workflow_type] || project.workflow_type}</span> to <span className="font-bold">{WORKFLOW_LABELS[pendingWorkflow.slug] || pendingWorkflow.name}</span>?
            </p>
            <p className="text-sm text-red-600 font-fira mb-6">
              All current tasks will be deleted and replaced with the new workflow&apos;s tasks. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingWorkflow(null)}
                className="px-4 py-2.5 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmWorkflowSwitch}
                disabled={switchingWorkflow}
                className="flex-1 px-6 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-60"
              >
                {switchingWorkflow ? 'Switching...' : 'Switch Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingTaskId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeletingTaskId(null)}>
          <div
            className="bg-white rounded-xl border border-gray-100 shadow-xl w-full max-w-sm mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-barlow font-bold text-lg text-fe-navy mb-3">Delete Task</h2>
            <p className="text-sm text-fe-anthracite font-fira mb-6">
              Are you sure you want to delete <span className="font-bold">{tasks.find(t => t.id === deletingTaskId)?.task_name}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingTaskId(null)}
                className="px-4 py-2.5 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTask(deletingTaskId)}
                className="flex-1 px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-fira font-bold hover:bg-red-700 transition-colors"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
