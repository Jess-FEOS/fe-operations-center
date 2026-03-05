'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  workflow_type: string
  start_date: string
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
  const [metrics, setMetrics] = useState<CourseMetric[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formProjectId, setFormProjectId] = useState('')
  const [formEnrollment, setFormEnrollment] = useState('')
  const [formRevenue, setFormRevenue] = useState('')
  const [formOpenRate, setFormOpenRate] = useState('')
  const [formClickRate, setFormClickRate] = useState('')
  const [formNotes, setFormNotes] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/course-metrics').then(r => r.json()).catch(() => []),
      fetch('/api/projects').then(r => r.json()).catch(() => []),
    ]).then(([metricsData, projectsData]) => {
      setMetrics(Array.isArray(metricsData) ? metricsData : [])
      const allProjects = Array.isArray(projectsData) ? projectsData : []
      setProjects(allProjects.filter((p: Project) => p.workflow_type === 'course-launch'))
      setLoading(false)
    })
  }, [])

  const resetForm = () => {
    setFormProjectId('')
    setFormEnrollment('')
    setFormRevenue('')
    setFormOpenRate('')
    setFormClickRate('')
    setFormNotes('')
  }

  const submitMetrics = async () => {
    if (!formProjectId) return
    setSaving(true)
    const res = await fetch('/api/course-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: formProjectId,
        enrollment_count: parseInt(formEnrollment) || 0,
        revenue: parseFloat(formRevenue) || 0,
        email_open_rate: formOpenRate ? parseFloat(formOpenRate) : null,
        email_click_rate: formClickRate ? parseFloat(formClickRate) : null,
        notes: formNotes.trim() || null,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setMetrics(prev => [data, ...prev])
      resetForm()
      setShowForm(false)
    }
    setSaving(false)
  }

  // Projects that already have metrics logged
  const loggedProjectIds = new Set(metrics.map(m => m.project_id))
  const unloggedProjects = projects.filter(p => !loggedProjectIds.has(p.id))

  // Sort metrics by project start date for the chart
  const chartMetrics = [...metrics].sort((a, b) =>
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
          <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Log Course Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Project</label>
              <select
                value={formProjectId}
                onChange={e => setFormProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
              >
                <option value="">Select a course launch project...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Enrollment Count</label>
              <input
                type="number"
                value={formEnrollment}
                onChange={e => setFormEnrollment(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Revenue ($)</label>
              <input
                type="number"
                step="0.01"
                value={formRevenue}
                onChange={e => setFormRevenue(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Email Open Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={formOpenRate}
                onChange={e => setFormOpenRate(e.target.value)}
                placeholder="e.g. 42.5"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
              />
            </div>
            <div>
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Email Click Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={formClickRate}
                onChange={e => setFormClickRate(e.target.value)}
                placeholder="e.g. 8.2"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-fe-blue-gray font-fira mb-1">Notes</label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-fira focus:outline-none focus:ring-2 focus:ring-fe-blue resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={submitMetrics}
              disabled={!formProjectId || saving}
              className="px-4 py-2 bg-fe-blue text-white rounded-lg text-sm font-fira font-bold hover:bg-fe-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Metrics'}
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

      {/* Course Launch Metrics Cards */}
      <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Course Launch Metrics</h2>
      {metrics.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center mb-8">
          <p className="text-fe-blue-gray font-fira">No metrics logged yet. Click "Log Metrics" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {metrics.map(m => (
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
                    {m.email_open_rate !== null ? `${m.email_open_rate}%` : '—'}
                  </div>
                  <div className="text-xs text-fe-blue-gray font-fira">Email Open Rate</div>
                </div>
                <div>
                  <div className="text-2xl font-barlow font-extrabold text-fe-navy">
                    {m.email_click_rate !== null ? `${m.email_click_rate}%` : '—'}
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
