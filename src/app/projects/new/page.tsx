'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface WorkflowTemplate {
  id: string
  name: string
  slug: string
  color: string
  total_weeks: number
}

interface ProjectTemplateTask {
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
  tasks: ProjectTemplateTask[]
}

const WORKFLOW_ICONS: Record<string, string> = {
  'course-launch': 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z',
  'podcast': 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  'newsletter': 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  'subscription': 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
}

const WEEK_PHASE_LABELS: Record<number, string> = {
  6: 'Setup',
  4: 'Marketing Launch',
  2: 'Enrollment Push',
  1: 'Delivery Prep',
  0: 'Delivery',
  [-1]: 'Wrap Up',
}

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [selectedProjectTemplate, setSelectedProjectTemplate] = useState<ProjectTemplate | null>(null)
  const [projectName, setProjectName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [taskCount, setTaskCount] = useState(0)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showTaskPreview, setShowTaskPreview] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/workflow-templates').then(r => r.json()),
      fetch('/api/project-templates').then(r => r.json()),
    ]).then(([wfData, ptData]) => {
      setTemplates(wfData)
      setProjectTemplates(Array.isArray(ptData) ? ptData : [])
      setLoading(false)
    })
  }, [])

  const handleSelectWorkflowTemplate = (template: WorkflowTemplate) => {
    setSelectedTemplate(template)
    setSelectedProjectTemplate(null)
    setStep(2)
  }

  const handleSelectProjectTemplate = (pt: ProjectTemplate) => {
    setSelectedProjectTemplate(pt)
    setSelectedTemplate(null)
    setTaskCount(pt.tasks.length)
    setStep(2)
  }

  const handleNext = () => {
    if (!projectName.trim() || !startDate) return
    if (selectedTemplate && !selectedProjectTemplate) {
      const estimates: Record<string, number> = {
        'course-launch': 87,
        'podcast': 9,
        'newsletter': 7,
        'subscription': 10,
      }
      setTaskCount(estimates[selectedTemplate.slug] || 0)
    }
    setStep(3)
  }

  const handleCreate = async () => {
    setCreating(true)

    if (selectedProjectTemplate) {
      // Create from project template
      const res = await fetch('/api/project-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedProjectTemplate.id,
          name: projectName.trim(),
          start_date: startDate,
        }),
      })
      const data = await res.json()
      if (data.id) {
        router.push(`/projects/${data.id}`)
      } else {
        setCreating(false)
      }
    } else if (selectedTemplate) {
      // Create from workflow template (existing flow)
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          workflow_template_id: selectedTemplate.id,
          workflow_type: selectedTemplate.slug,
          start_date: startDate,
        }),
      })
      const data = await res.json()
      if (data.id) {
        router.push(`/projects/${data.id}`)
      } else {
        setCreating(false)
      }
    }
  }

  // Group project template tasks by week for preview
  const groupedTasks = selectedProjectTemplate
    ? selectedProjectTemplate.tasks.reduce<Record<number, ProjectTemplateTask[]>>((acc, task) => {
        if (!acc[task.week_number]) acc[task.week_number] = []
        acc[task.week_number].push(task)
        return acc
      }, {})
    : {}
  const sortedWeeks = Object.keys(groupedTasks).map(Number).sort((a, b) => b - a)

  // Calculate due dates for preview
  const getDueDatePreview = (weekNumber: number): string => {
    if (!startDate) return ''
    const start = new Date(startDate + 'T00:00:00')
    const offset = -weekNumber * 7
    const due = new Date(start.getTime() + offset * 24 * 60 * 60 * 1000)
    return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const activeTemplate = selectedProjectTemplate || selectedTemplate
  const activeColor = selectedProjectTemplate
    ? '#0762C8'
    : selectedTemplate?.color || '#0762C8'
  const activeSlug = selectedProjectTemplate?.type || selectedTemplate?.slug || ''

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-barlow font-extrabold text-2xl text-fe-navy mb-2">New Project</h1>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-fira font-bold ${
                s === step
                  ? 'bg-fe-blue text-white'
                  : s < step
                  ? 'bg-fe-blue/20 text-fe-blue'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s < step ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 ${s < step ? 'bg-fe-blue/30' : 'bg-gray-200'}`} />}
          </div>
        ))}
        <span className="text-sm text-fe-blue-gray font-fira ml-2">
          {step === 1 ? 'Select Template' : step === 2 ? 'Project Details' : 'Confirm'}
        </span>
      </div>

      {/* Step 1: Select template */}
      {step === 1 && (
        <div>
          {/* Project Templates */}
          {projectTemplates.length > 0 && (
            <div className="mb-8">
              <h2 className="font-barlow font-bold text-lg text-fe-navy mb-3">Project Templates</h2>
              <p className="text-sm text-fe-blue-gray font-fira mb-4">
                Pre-built templates with all tasks, owners, and timelines ready to go.
              </p>
              <div className="space-y-3">
                {projectTemplates.map(pt => (
                  <button
                    key={pt.id}
                    onClick={() => handleSelectProjectTemplate(pt)}
                    className="w-full bg-white rounded-xl border-2 border-gray-100 p-5 text-left hover:border-fe-blue transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#0762C815' }}
                        >
                          <svg className="w-6 h-6 text-fe-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-barlow font-bold text-lg text-fe-navy mb-1">{pt.name}</h3>
                          <p className="text-sm text-fe-blue-gray font-fira">{pt.description}</p>
                        </div>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-fira font-bold bg-fe-blue/10 text-fe-blue">
                        {pt.tasks.length} tasks
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Workflow Templates (existing) */}
          <div>
            <h2 className="font-barlow font-bold text-lg text-fe-navy mb-3">Workflow Types</h2>
            <p className="text-sm text-fe-blue-gray font-fira mb-4">
              Standard workflow structures with auto-generated task phases.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectWorkflowTemplate(template)}
                  className="bg-white rounded-xl border-2 border-gray-100 p-6 text-left hover:border-fe-blue transition-colors group"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${template.color}15` }}
                  >
                    <svg className="w-6 h-6" style={{ color: template.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={WORKFLOW_ICONS[template.slug] || ''} />
                    </svg>
                  </div>
                  <h3 className="font-barlow font-bold text-lg text-fe-navy mb-1">{template.name}</h3>
                  <p className="text-sm text-fe-blue-gray font-fira">{template.total_weeks}-week cycle</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Project details */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: activeColor }}
            />
            <span className="text-sm text-fe-blue-gray font-fira">
              {selectedProjectTemplate?.name || selectedTemplate?.name}
            </span>
            {selectedProjectTemplate && (
              <span className="px-2 py-0.5 rounded-full text-xs font-fira font-bold bg-fe-blue/10 text-fe-blue">
                {selectedProjectTemplate.tasks.length} tasks
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="e.g., Intern Academy - Cohort 3"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-fira font-bold text-fe-navy mb-1">
                {selectedProjectTemplate ? 'Cohort Start Date' : 'Start Date'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent"
              />
              {selectedProjectTemplate && startDate && (
                <p className="text-xs text-fe-blue-gray font-fira mt-2">
                  Tasks will be scheduled relative to this date. Setup tasks begin{' '}
                  {getDueDatePreview(6)} (6 weeks before start).
                </p>
              )}
            </div>
          </div>

          {/* Task Preview for project templates */}
          {selectedProjectTemplate && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowTaskPreview(!showTaskPreview)}
                className="flex items-center gap-2 text-sm font-fira font-bold text-fe-blue hover:text-fe-blue/80 transition-colors"
              >
                <svg className={`w-4 h-4 transition-transform ${showTaskPreview ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Preview Tasks ({selectedProjectTemplate.tasks.length})
              </button>
              {showTaskPreview && (
                <div className="mt-3 space-y-4 max-h-80 overflow-y-auto pr-2">
                  {sortedWeeks.map(week => (
                    <div key={week}>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-xs font-barlow font-bold text-fe-navy uppercase tracking-wide">
                          Week {week} - {WEEK_PHASE_LABELS[week] || `Phase ${week}`}
                        </h4>
                        {startDate && (
                          <span className="text-xs font-fira text-fe-blue-gray">
                            (Due {getDueDatePreview(week)})
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {groupedTasks[week].map(task => (
                          <div key={task.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-fe-offwhite">
                            <span className="text-xs font-fira text-fe-anthracite">{task.title}</span>
                            <span className="text-xs font-fira text-fe-blue-gray shrink-0 ml-2">{task.owner}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setStep(1); setShowTaskPreview(false) }}
              className="px-4 py-2.5 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!projectName.trim() || !startDate}
              className="px-6 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${activeColor}15` }}
            >
              {selectedProjectTemplate ? (
                <svg className="w-8 h-8 text-fe-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              ) : (
                <svg className="w-8 h-8" style={{ color: activeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={WORKFLOW_ICONS[activeSlug] || ''} />
                </svg>
              )}
            </div>
            <h2 className="font-barlow font-bold text-xl text-fe-navy mb-1">{projectName}</h2>
            <p className="text-sm text-fe-blue-gray font-fira">
              {selectedProjectTemplate?.name || selectedTemplate?.name}
            </p>
          </div>

          <div className="bg-fe-offwhite rounded-lg p-4 space-y-3 mb-6">
            <div className="flex justify-between text-sm font-fira">
              <span className="text-fe-blue-gray">
                {selectedProjectTemplate ? 'Cohort Start Date' : 'Start Date'}
              </span>
              <span className="font-bold text-fe-navy">
                {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between text-sm font-fira">
              <span className="text-fe-blue-gray">Tasks to Generate</span>
              <span className="font-bold text-fe-navy">{taskCount} tasks</span>
            </div>
            {selectedProjectTemplate && (
              <>
                <div className="flex justify-between text-sm font-fira">
                  <span className="text-fe-blue-gray">Setup Begins</span>
                  <span className="font-bold text-fe-navy">{getDueDatePreview(6)} (6 weeks before)</span>
                </div>
                <div className="flex justify-between text-sm font-fira">
                  <span className="text-fe-blue-gray">Wrap Up</span>
                  <span className="font-bold text-fe-navy">{getDueDatePreview(-1)} (1 week after)</span>
                </div>
              </>
            )}
            {selectedTemplate && (
              <div className="flex justify-between text-sm font-fira">
                <span className="text-fe-blue-gray">Duration</span>
                <span className="font-bold text-fe-navy">{selectedTemplate.total_weeks} weeks</span>
              </div>
            )}
          </div>

          {/* Owner breakdown for project templates */}
          {selectedProjectTemplate && (
            <div className="bg-fe-offwhite rounded-lg p-4 mb-6">
              <h3 className="text-xs font-barlow font-bold text-fe-navy uppercase tracking-wide mb-2">Task Assignments</h3>
              <div className="space-y-1">
                {Object.entries(
                  selectedProjectTemplate.tasks.reduce<Record<string, number>>((acc, t) => {
                    acc[t.owner] = (acc[t.owner] || 0) + 1
                    return acc
                  }, {})
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([owner, count]) => (
                    <div key={owner} className="flex justify-between text-sm font-fira">
                      <span className="text-fe-blue-gray">{owner}</span>
                      <span className="font-bold text-fe-navy">{count} tasks</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2.5 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 px-6 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-60"
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
