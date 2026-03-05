import { WORKFLOW_COLORS } from '@/lib/types'

interface WorkflowBadgeProps {
  type: string
}

const WORKFLOW_LABELS: Record<string, string> = {
  'course-launch': 'Course Launch',
  'podcast': 'Podcast',
  'newsletter': 'Newsletter',
  'subscription': 'Subscription',
}

export default function WorkflowBadge({ type }: WorkflowBadgeProps) {
  const color = WORKFLOW_COLORS[type] || '#647692'
  const label = WORKFLOW_LABELS[type] || type

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-fira font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  )
}
