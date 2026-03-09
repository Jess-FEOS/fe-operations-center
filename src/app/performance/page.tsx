'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  workflow_type: string
  start_date: string
}

interface Campaign {
  id: string
  name: string
  project_id: string | null
}

interface Metric {
  id: string
  project_id: string | null
  campaign_id: string | null
  priority_id: string | null
  metric_name: string
  metric_value: number
  metric_date: string
  notes: string | null
  project_name: string | null
  campaign_name: string | null
  priority_title: string | null
}

interface CourseMetric {
  id: string
  project_id: string
  project_name: string
  project_start_date: string
  enrollment_count: number
  revenue: number
  email_open_rate: number | null
  email_click_rate: number | null
  notes: string | null
  created_at: string
}

export default function PerformancePage() {
  const [courseMetrics, setCourseMetrics] = useState<CourseMetric[]>([])
  const [generalMetrics, setGeneralMetrics] = useState<Metric[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formProjectId, setFormProjectId] = useState('')
  const [formCampaignId, setFormCampaignId] = useState('')
  const [formMetricName, setFormMetricName] = useState('')
  const [formMetricValue, setFormMetricValue] = useState('')
  const [formMetricDate, setFormMetricDate] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const fetchMetrics = async () => {
    const [courseData, metricsData, projectsData, allProjectsData, campaignsData] = await Promise.all([
      fetch('/api/course-metrics').then(r => r.json()).catch(() => []),
      fetch('/api/metrics').then(r => r.json()).catch(() => []),
      fetch('/api/projects').then(r => r.json()).catch(() => []),
      fetch('/api/projects').then(r => r.json()).catch(() => []),
      fetch('/api/campaigns').then(r => r.json()).catch(() => []),
    ])
    setCourseMetrics(Array.isArray(courseData) ? courseData : [])
    setGeneralMetrics(Array.isArray(metricsData) ? metricsData : [])
    const ap = Array.isArray(allProjectsData) ? allProjectsData : []
    setAllProjects(ap)
    setProjects(ap.filter((p: Project) => p.workflow_type === 'course-launch'))
    setCampaigns(Array.isArray(campaignsData) ? campaignsData : [])
  }

  useEffect(() => {
    fetchMetrics().then(() => setLoading(false))
  }, [])

  // Filter campaigns by selected project
  useEffect(() => {
    if (formProjectId) {
      setFilteredCampaigns(campaigns.filter(c => c.project_id === formProjectId))
    } else {
      setFilteredCampaigns(campaigns)
    }
    setFormCampaignId('')
  }, [formProjectId, campaigns])

  const resetForm = () => {
    setFormProjectId('')
    setFormCampaignId('')
    setFormMetricName('')
    setFormMetricValue('')
    setFormMetricDate('')
    setFormNotes('')
  }

  const submitMetric = async () => {
    if (!formMetricName.trim() || !formMetricValue || !formMetricDate) return
    setSaving(true)
    const res = await fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: formProjectId || null,
        campaign_id: formCampaignId || null,
        metric_name: formMetricName.trim(),
        metric_value: parseFloat(formMetricValue),
        metric_date: formMetricDate,
        notes: formNotes.trim() || null,
      }),
    })
    if (res.ok) {
      await fetchMetrics()
      resetForm()
      setShowForm(false)
    }
    setSaving(false)
  }

  // Group general metrics by project name
  const metricsByProject = generalMetrics.reduce<Record<string, Metric[]>>((acc, m) => {
    const key = m.project_name || 'Unlinked'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  // Course metrics chart data
  const chartMetrics = [...courseMetrics].sort((a, b) =>
    (a.project_start_date || '').localeCompare(b.project_start_date || '')
  )
  const maxEnrollment = Math.max(...chartMetrics.map(m => m.enrollment_count), 1)
  const maxRevenue = Math.max(...chartMetrics.map(m => Number(m.revenue)), 1)

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
        <h1 className="font-barlow font-extrabold text-2xl text-fe-navy">Performance</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Metrics
          </button>
        )}
      </div>

      {/* Log Metrics Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Log Metric</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Project <span className="text-gray-400">(optional)</span></label>
              <select
                value={formProjectId}
                onChange={e => setFormProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white"
              >
                <option value="">No project</option>
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Campaign <span className="text-gray-400">(optional)</span></label>
              <select
                value={formCampaignId}
                onChange={e => setFormCampaignId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue bg-white"
              >
                <option value="">No campaign</option>
                {filteredCampaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Metric Name</label>
              <input
                type="text"
                value={formMetricName}
                onChange={e => setFormMetricName(e.target.value)}
                placeholder="e.g., Enrollment Count, Revenue, CTR"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Value</label>
              <input
                type="number"
                step="any"
                value={formMetricValue}
                onChange={e => setFormMetricValue(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Date</label>
              <input
                type="date"
                value={formMetricDate}
                onChange={e => setFormMetricDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Notes <span className="text-gray-400">(optional)</span></label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={1}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={submitMetric}
              disabled={!formMetricName.trim() || !formMetricValue || !formMetricDate || saving}
              className="px-4 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Metric'}
            </button>
            <button
              onClick={() => { resetForm(); setShowForm(false) }}
              className="px-4 py-2 bg-gray-100 text-fe-anthracite rounded-lg text-sm font-fira hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* General Metrics by Project */}
      <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Metrics</h2>
      {generalMetrics.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center mb-8">
          <p className="text-fe-blue-gray font-fira">No metrics logged yet. Click &quot;Log Metrics&quot; to get started.</p>
        </div>
      ) : (
        <div className="space-y-6 mb-8">
          {Object.entries(metricsByProject).map(([projectName, projectMetrics]) => (
            <div key={projectName}>
              <h3 className="font-barlow font-bold text-sm text-fe-navy mb-3">{projectName}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {projectMetrics.map(m => (
                  <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="text-2xl font-barlow font-extrabold text-fe-navy">
                      {typeof m.metric_value === 'number' ? m.metric_value.toLocaleString() : m.metric_value}
                    </div>
                    <div className="text-xs text-fe-blue-gray font-fira mt-1">{m.metric_name}</div>
                    <div className="text-xs font-fira text-gray-400 mt-0.5">
                      {new Date(m.metric_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    {m.notes && (
                      <p className="text-xs font-fira text-fe-anthracite mt-2">{m.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Course Launch Metrics Cards */}
      {courseMetrics.length > 0 && (
        <>
          <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Course Launch Metrics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {courseMetrics.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Link
                      href={`/projects/${m.project_id}`}
                      className="font-barlow font-bold text-lg text-fe-navy hover:text-fe-blue transition-colors"
                    >
                      {m.project_name}
                    </Link>
                    <p className="text-xs text-fe-blue-gray font-fira mt-0.5">
                      Logged {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-xs font-fira font-bold text-white" style={{ backgroundColor: '#0762C8' }}>
                    Course Launch
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-barlow font-extrabold text-fe-navy">
                      {m.enrollment_count.toLocaleString()}
                    </div>
                    <div className="text-xs text-fe-blue-gray font-fira">Enrollments</div>
                  </div>
                  <div>
                    <div className="text-2xl font-barlow font-extrabold text-fe-navy">
                      ${Number(m.revenue).toLocaleString()}
                    </div>
                    <div className="text-xs text-fe-blue-gray font-fira">Revenue</div>
                  </div>
                  <div>
                    <div className="text-2xl font-barlow font-extrabold text-fe-navy">
                      {m.email_open_rate !== null ? `${m.email_open_rate}%` : '\u2014'}
                    </div>
                    <div className="text-xs text-fe-blue-gray font-fira">Email Open Rate</div>
                  </div>
                  <div>
                    <div className="text-2xl font-barlow font-extrabold text-fe-navy">
                      {m.email_click_rate !== null ? `${m.email_click_rate}%` : '\u2014'}
                    </div>
                    <div className="text-xs text-fe-blue-gray font-fira">Email Click Rate</div>
                  </div>
                </div>
                {m.notes && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-sm text-fe-anthracite font-fira">{m.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Trends Chart */}
      {chartMetrics.length >= 2 && (
        <>
          <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Trends</h2>
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            {/* Enrollment Chart */}
            <h3 className="text-sm font-fira font-bold text-fe-anthracite mb-3">Enrollment</h3>
            <div className="flex items-end gap-3 h-40 mb-6">
              {chartMetrics.map(m => {
                const height = maxEnrollment > 0 ? (m.enrollment_count / maxEnrollment) * 100 : 0
                return (
                  <div key={m.id} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-fira font-bold text-fe-navy">
                      {m.enrollment_count.toLocaleString()}
                    </span>
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${Math.max(height, 4)}%`,
                        backgroundColor: '#0762C8',
                        minHeight: '4px',
                      }}
                    />
                    <span className="text-xs font-fira text-fe-blue-gray text-center truncate w-full" title={m.project_name}>
                      {m.project_name.length > 15 ? m.project_name.slice(0, 15) + '...' : m.project_name}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Revenue Chart */}
            <h3 className="text-sm font-fira font-bold text-fe-anthracite mb-3">Revenue</h3>
            <div className="flex items-end gap-3 h-40">
              {chartMetrics.map(m => {
                const rev = Number(m.revenue)
                const height = maxRevenue > 0 ? (rev / maxRevenue) * 100 : 0
                return (
                  <div key={m.id} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-fira font-bold text-fe-navy">
                      ${rev.toLocaleString()}
                    </span>
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${Math.max(height, 4)}%`,
                        backgroundColor: '#046A38',
                        minHeight: '4px',
                      }}
                    />
                    <span className="text-xs font-fira text-fe-blue-gray text-center truncate w-full" title={m.project_name}>
                      {m.project_name.length > 15 ? m.project_name.slice(0, 15) + '...' : m.project_name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
