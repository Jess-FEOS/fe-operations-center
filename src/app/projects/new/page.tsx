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

const WORKFLOW_ICONS: Record<string, string> = {
  'course-launch': 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z',
  'podcast': 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  'newsletter': 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  'subscription': 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
}

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [projectName, setProjectName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [taskCount, setTaskCount] = useState(0)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/workflow-templates')
      .then(r => r.json())
      .then(data => {
        setTemplates(data)
        setLoading(false)
      })
  }, [])

  const handleSelectTemplate = (template: WorkflowTemplate) => {
    setSelectedTemplate(template)
    setStep(2)
  }

  const handleNext = () => {
    if (!projectName.trim() || !startDate) return
    // Estimate task count from template
    const estimates: Record<string, number> = {
      'course-launch': 87,
      'podcast': 9,
      'newsletter': 7,
      'subscription': 10,
    }
    setTaskCount(estimates[selectedTemplate?.slug || ''] || 0)
    setStep(3)
  }

  const handleCreate = async () => {
    if (!selectedTemplate) return
    setCreating(true)
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
    router.push(`/projects/${data.id}`)
  }

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
          {step === 1 ? 'Select Workflow' : step === 2 ? 'Project Details' : 'Confirm'}
        </span>
      </div>

      {/* Step 1: Select workflow type */}
      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map(template => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
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
      )}

      {/* Step 2: Project details */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedTemplate?.color }}
            />
            <span className="text-sm text-fe-blue-gray font-fira">{selectedTemplate?.name}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-fira font-bold text-fe-navy mb-1">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="e.g., AI Accelerator — Cohort 4"
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
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep(1)}
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
              style={{ backgroundColor: `${selectedTemplate?.color}15` }}
            >
              <svg className="w-8 h-8" style={{ color: selectedTemplate?.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={WORKFLOW_ICONS[selectedTemplate?.slug || ''] || ''} />
              </svg>
            </div>
            <h2 className="font-barlow font-bold text-xl text-fe-navy mb-1">{projectName}</h2>
            <p className="text-sm text-fe-blue-gray font-fira">{selectedTemplate?.name}</p>
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
              <span className="font-bold text-fe-navy">{taskCount} tasks</span>
            </div>
            <div className="flex justify-between text-sm font-fira">
              <span className="text-fe-blue-gray">Duration</span>
              <span className="font-bold text-fe-navy">{selectedTemplate?.total_weeks} weeks</span>
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
