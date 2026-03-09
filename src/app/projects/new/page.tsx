'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

interface Priority {
  id: string
  title: string
  month: string
  project_id: string | null
}

const TYPE_ICONS: Record<string, string> = {
  'course-launch': 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z',
  'podcast': 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  'newsletter': 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  'subscription': 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
}

const DEFAULT_ICON = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'

const TYPE_COLORS: Record<string, string> = {
  'course-launch': '#0762C8',
  'podcast': '#437F94',
  'newsletter': '#B29838',
  'subscription': '#046A38',
}

const TYPE_CATEGORIES: Record<string, string> = {
  'course-launch': 'Course',
  'podcast': 'Podcast',
  'newsletter': 'Newsletter',
  'subscription': 'Operations',
}

const WEEK_PHASE_LABELS: Record<number, string> = {
  8: 'Planning',
  6: 'Setup',
  4: 'Build',
  3: 'Marketing Launch',
  2: 'Pre-Launch',
  1: 'Delivery Prep',
  0: 'Launch',
  [-1]: 'Wrap Up',
}

const FILTER_OPTIONS = ['All', 'Course', 'Podcast', 'Newsletter', 'Operations']

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [selected, setSelected] = useState<ProjectTemplate | null>(null)
  const [projectName, setProjectName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showTaskPreview, setShowTaskPreview] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [selectedPriority, setSelectedPriority] = useState('')
  const [launchDate, setLaunchDate] = useState('')
  const [revenueGoal, setRevenueGoal] = useState('')
  const [enrollmentGoal, setEnrollmentGoal] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/project-templates').then(r => r.json()),
      fetch('/api/priorities').then(r => r.json()).catch(() => []),
    ]).then(([templatesData, prioritiesData]) => {
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
      const allP = Array.isArray(prioritiesData) ? prioritiesData : []
      setPriorities(allP.filter((p: Priority) => !p.project_id))
      setLoading(false)
    })
  }, [])

  const filteredTemplates = categoryFilter === 'All'
    ? templates
    : templates.filter(t => (TYPE_CATEGORIES[t.type] || 'Operations') === categoryFilter)

  const handleSelect = (template: ProjectTemplate) => {
    setSelected(template)
    setStep(2)
  }

  const handleNext = () => {
    if (!projectName.trim() || !startDate) return
    setStep(3)
  }

  const handleCreate = async () => {
    if (!selected) return
    setCreating(true)

    const res = await fetch('/api/project-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: selected.id,
        name: projectName.trim(),
        start_date: startDate,
        priority_id: selectedPriority || null,
        launch_date: launchDate || null,
        revenue_goal: revenueGoal ? parseFloat(revenueGoal) : null,
        enrollment_goal: enrollmentGoal ? parseInt(enrollmentGoal) : null,
      }),
    })
    const data = await res.json()
    if (data.id) {
      router.push(`/projects/${data.id}`)
    } else {
      setCreating(false)
    }
  }

  // Group tasks by week for preview
  const groupedTasks = selected
    ? selected.tasks.reduce<Record<number, ProjectTemplateTask[]>>((acc, task) => {
        if (!acc[task.week_number]) acc[task.week_number] = []
        acc[task.week_number].push(task)
        return acc
      }, {})
    : {}
  const sortedWeeks = Object.keys(groupedTasks).map(Number).sort((a, b) => b - a)

  const getDueDatePreview = (weekNumber: number): string => {
    if (!startDate) return ''
    const start = new Date(startDate + 'T00:00:00')
    const offset = -weekNumber * 7
    const due = new Date(start.getTime() + offset * 24 * 60 * 60 * 1000)
    return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const maxWeek = selected ? Math.max(...selected.tasks.map(t => t.week_number), 0) : 0
  const minWeek = selected ? Math.min(...selected.tasks.map(t => t.week_number), 0) : 0

  const activeColor = selected ? (TYPE_COLORS[selected.type] || '#0762C8') : '#0762C8'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-fe-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">New Project</h1>
        <Link
          href="/templates"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-fira text-fe-blue-gray hover:text-fe-blue transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Templates
        </Link>
      </div>

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
          {step === 1 ? 'Choose Template' : step === 2 ? 'Project Details' : 'Confirm'}
        </span>
      </div>

      {/* Step 1: Choose a Template */}
      {step === 1 && (
        <div>
          <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Choose a Template</h2>

          {/* Category filter */}
          <div className="flex gap-1.5 mb-5">
            {FILTER_OPTIONS.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-fira font-bold transition-colors ${
                  categoryFilter === cat
                    ? 'bg-fe-navy text-white'
                    : 'bg-gray-100 text-fe-anthracite hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template grid */}
          {filteredTemplates.length === 0 ? (
            <p className="text-sm text-fe-blue-gray font-fira py-8 text-center">No templates in this category.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredTemplates.map(template => {
                const color = TYPE_COLORS[template.type] || '#0762C8'
                const icon = TYPE_ICONS[template.type] || DEFAULT_ICON
                const category = TYPE_CATEGORIES[template.type] || 'Operations'

                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className="bg-white rounded-xl border-2 border-gray-100 p-5 text-left hover:border-fe-blue transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <svg className="w-5 h-5" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
                        </svg>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-fira font-bold bg-gray-100 text-fe-blue-gray">
                        {category}
                      </span>
                    </div>
                    <h3 className="font-barlow font-bold text-base text-fe-navy mb-1 group-hover:text-fe-blue transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-xs text-fe-blue-gray font-fira mb-3 line-clamp-2">{template.description}</p>
                    <span
                      className="inline-block px-2.5 py-1 rounded-full text-xs font-fira font-bold"
                      style={{ backgroundColor: `${color}15`, color }}
                    >
                      {template.tasks.length} tasks
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Project details */}
      {step === 2 && selected && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: activeColor }}
            />
            <span className="text-sm text-fe-blue-gray font-fira">
              {selected.name}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-fira font-bold bg-fe-blue/10 text-fe-blue">
              {selected.tasks.length} tasks
            </span>
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
              <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent"
              />
              {startDate && maxWeek > 0 && (
                <p className="text-xs text-fe-blue-gray font-fira mt-2">
                  Tasks will be scheduled relative to this date. First tasks begin{' '}
                  {getDueDatePreview(maxWeek)} ({maxWeek} weeks before start).
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Launch Date <span className="font-normal text-fe-blue-gray">(optional)</span></label>
              <input
                type="date"
                value={launchDate}
                onChange={e => setLaunchDate(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Revenue Goal <span className="font-normal text-fe-blue-gray">(optional)</span></label>
                <input
                  type="number"
                  value={revenueGoal}
                  onChange={e => setRevenueGoal(e.target.value)}
                  placeholder="e.g., 50000"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Enrollment Goal <span className="font-normal text-fe-blue-gray">(optional)</span></label>
                <input
                  type="number"
                  value={enrollmentGoal}
                  onChange={e => setEnrollmentGoal(e.target.value)}
                  placeholder="e.g., 100"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Task Preview */}
          <div className="mt-6 border-t border-gray-100 pt-4">
            <button
              onClick={() => setShowTaskPreview(!showTaskPreview)}
              className="flex items-center gap-2 text-sm font-fira font-bold text-fe-blue hover:text-fe-blue/80 transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${showTaskPreview ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Preview Tasks ({selected.tasks.length})
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
      {step === 3 && selected && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${activeColor}15` }}
            >
              <svg className="w-8 h-8" style={{ color: activeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={TYPE_ICONS[selected.type] || DEFAULT_ICON} />
              </svg>
            </div>
            <h2 className="font-barlow font-bold text-xl text-fe-navy mb-1">{projectName}</h2>
            <p className="text-sm text-fe-blue-gray font-fira">{selected.name}</p>
          </div>

          <div className="bg-fe-offwhite rounded-lg p-4 space-y-3 mb-6">
            <div className="flex justify-between text-sm font-fira">
              <span className="text-fe-blue-gray">Start Date</span>
              <span className="font-bold text-fe-navy">
                {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between text-sm font-fira">
              <span className="text-fe-blue-gray">Tasks to Generate</span>
              <span className="font-bold text-fe-navy">{selected.tasks.length} tasks</span>
            </div>
            {maxWeek > 0 && (
              <div className="flex justify-between text-sm font-fira">
                <span className="text-fe-blue-gray">First Tasks</span>
                <span className="font-bold text-fe-navy">{getDueDatePreview(maxWeek)} ({maxWeek} weeks before)</span>
              </div>
            )}
            {minWeek < 0 && (
              <div className="flex justify-between text-sm font-fira">
                <span className="text-fe-blue-gray">Wrap Up</span>
                <span className="font-bold text-fe-navy">{getDueDatePreview(minWeek)} ({Math.abs(minWeek)} week{Math.abs(minWeek) > 1 ? 's' : ''} after)</span>
              </div>
            )}
            {selectedPriority && (
              <div className="flex justify-between text-sm font-fira">
                <span className="text-fe-blue-gray">Linked Priority</span>
                <span className="font-bold text-fe-navy">{priorities.find(p => p.id === selectedPriority)?.title || 'Unknown'}</span>
              </div>
            )}
            {launchDate && (
              <div className="flex justify-between text-sm font-fira">
                <span className="text-fe-blue-gray">Launch Date</span>
                <span className="font-bold text-fe-navy">{new Date(launchDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
            )}
            {revenueGoal && (
              <div className="flex justify-between text-sm font-fira">
                <span className="text-fe-blue-gray">Revenue Goal</span>
                <span className="font-bold text-fe-navy">${parseFloat(revenueGoal).toLocaleString()}</span>
              </div>
            )}
            {enrollmentGoal && (
              <div className="flex justify-between text-sm font-fira">
                <span className="text-fe-blue-gray">Enrollment Goal</span>
                <span className="font-bold text-fe-navy">{parseInt(enrollmentGoal).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Owner breakdown */}
          <div className="bg-fe-offwhite rounded-lg p-4 mb-6">
            <h3 className="text-xs font-barlow font-bold text-fe-navy uppercase tracking-wide mb-2">Task Assignments</h3>
            <div className="space-y-1">
              {Object.entries(
                selected.tasks.reduce<Record<string, number>>((acc, t) => {
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
