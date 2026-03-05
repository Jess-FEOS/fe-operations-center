'use client'

import { useState, useRef, useEffect } from 'react'
import { TaskStatus, STATUS_COLORS, STATUS_LABELS } from '@/lib/types'

const ALL_STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'done', 'blocked']

interface StatusBadgeProps {
  status: TaskStatus
  onClick?: (newStatus: TaskStatus) => void
  interactive?: boolean
}

export default function StatusBadge({ status, onClick, interactive = true }: StatusBadgeProps) {
  const color = STATUS_COLORS[status]
  const label = STATUS_LABELS[status]
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => interactive && setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-fira font-bold transition-all ${
          interactive ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
        }`}
        style={{
          backgroundColor: `${color}15`,
          color: color,
          border: `1px solid ${color}30`,
        }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => {
                if (s !== status) onClick?.(s)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-xs font-fira hover:bg-gray-50 text-fe-anthracite flex items-center gap-2"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[s] }}
              />
              {STATUS_LABELS[s]}
              {s === status && (
                <svg className="w-3 h-3 ml-auto text-fe-blue-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
