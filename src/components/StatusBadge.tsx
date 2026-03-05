'use client'

import { TaskStatus, STATUS_COLORS, STATUS_LABELS, nextStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: TaskStatus
  onClick?: (newStatus: TaskStatus) => void
  interactive?: boolean
}

export default function StatusBadge({ status, onClick, interactive = true }: StatusBadgeProps) {
  const color = STATUS_COLORS[status]
  const label = STATUS_LABELS[status]

  return (
    <button
      onClick={() => interactive && onClick?.(nextStatus(status))}
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
  )
}
