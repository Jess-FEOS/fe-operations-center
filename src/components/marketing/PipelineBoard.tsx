'use client'

import { useState } from 'react'
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor,
  rectIntersection, useDraggable, useDroppable, useSensor, useSensors,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import Avatar from '@/components/Avatar'
import { ContentItem, READINESS, STATUSES, STATUS_LABEL, Status, fmtLong, readinessOf } from '@/lib/marketing'

// Keyboard moves one workflow column at a time, including on stacked mobile layouts.
const columnCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.code) ? 1
    : ['ArrowLeft', 'ArrowUp'].includes(event.code) ? -1 : 0
  if (!direction) return
  event.preventDefault()
  const current = context.over?.id ?? context.active?.data.current?.status
  const index = STATUSES.findIndex(s => s.key === current)
  const target = STATUSES[index + direction]
  const rect = target && context.droppableRects.get(target.key)
  if (!rect || !context.collisionRect) return
  return {
    x: rect.left + (rect.width - context.collisionRect.width) / 2,
    y: rect.top + 55,
  }
}

interface Props {
  items: ContentItem[]
  movingId: string | null
  onMove: (item: ContentItem, status: Status) => void
  onOpen: (item: ContentItem) => void
  onAdvance: (item: ContentItem) => void
}

export default function PipelineBoard({ items, movingId, onMove, onOpen, onAdvance }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  )
  const active = items.find(item => item.id === activeId)
  return (
    <>
      <p className="mb-3 text-xs text-fe-blue-gray" id="pipeline-drag-help">
        Drag a card by its handle to change its stage. You can also open a card to edit its status.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        accessibility={{
          screenReaderInstructions: { draggable: 'Press Space to pick up this card. Use the arrow keys to choose a stage. Press Space to drop, or Escape to cancel.' },
          announcements: {
            onDragStart: ({ active }) => `Picked up ${items.find(i => i.id === active.id)?.title || 'asset'}.`,
            onDragOver: ({ over }) => over ? `Over ${STATUS_LABEL[over.id as Status]}.` : 'Outside a stage.',
            onDragEnd: ({ over }) => over ? `Dropped in ${STATUS_LABEL[over.id as Status]}. Saving status.` : 'Move cancelled.',
            onDragCancel: () => 'Move cancelled.',
          },
        }}
        onDragStart={({ active }) => setActiveId(String(active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={({ active, over }) => {
          setActiveId(null)
          const item = items.find(i => i.id === active.id)
          const status = STATUSES.find(s => s.key === over?.id)?.key
          if (item && status && item.status !== status && !movingId) onMove(item, status)
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start" data-testid="board">
          {STATUSES.map(column => (
            <Column key={column.key} column={column} count={items.filter(item => item.status === column.key).length} dragging={!!activeId}>
              {items.filter(item => item.status === column.key).map(item => (
                <Card key={item.id} item={item} disabled={!!movingId} saving={movingId === item.id} onOpen={onOpen} onAdvance={onAdvance} />
              ))}
              {!items.some(item => item.status === column.key) && (
                <p className="text-xs text-fe-blue-gray text-center py-6">{activeId ? 'Drop here' : 'Nothing here'}</p>
              )}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active && <div className="bg-white border border-fe-blue shadow-lg p-3 max-w-sm font-fira">
            <p className="text-[11px] text-fe-navy font-bold mb-2">{active.project_name || 'Not tied to a project'}</p>
            <p className="text-sm text-fe-anthracite">{active.title}</p>
          </div>}
        </DragOverlay>
      </DndContext>
    </>
  )
}

function Column({ column, count, dragging, children }: {
  column: typeof STATUSES[number]; count: number; dragging: boolean; children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key })
  return (
    <section ref={setNodeRef} aria-label={`${column.label} stage`}
      className={`border transition-colors ${isOver && dragging ? 'border-fe-blue bg-fe-blue/10 ring-2 ring-fe-blue' : 'bg-fe-offwhite border-fe-line'}`}
      data-testid={`col-${column.key}`} data-drop-active={isOver && dragging}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-fe-line bg-white">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5" style={{ backgroundColor: column.color }} />
          <h2 className="font-barlow font-bold text-sm text-fe-navy">{column.label}</h2>
        </div>
        <span className="text-xs text-fe-blue-gray" data-testid={`count-${column.key}`}>{count}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[150px]">{children}</div>
    </section>
  )
}

function Card({ item, disabled, saving, onOpen, onAdvance }: {
  item: ContentItem; disabled: boolean; saving: boolean
  onOpen: Props['onOpen']; onAdvance: Props['onAdvance']
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: item.id, data: { status: item.status }, disabled,
  })
  const readiness = READINESS[readinessOf(item)]
  return (
    <article ref={setNodeRef} aria-busy={saving}
      className={`bg-white border border-fe-line p-2.5 hover:border-fe-line-strong ${isDragging ? 'opacity-40' : ''}`}
      style={{ borderLeft: `3px solid ${readiness.color}` }} data-testid={`card-${item.id}`}
      onClick={() => { if (!disabled && !isDragging) onOpen(item) }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="bg-fe-navy/5 border border-fe-line px-1.5 py-1 text-[10px] font-bold text-fe-navy break-words min-w-0"
          data-testid={`project-${item.id}`}>{item.project_name || 'Not tied to a project'}</span>
        <button ref={setActivatorNodeRef} {...listeners} {...attributes} type="button"
          disabled={disabled} aria-label={`Drag ${item.title}`} title="Drag to another stage"
          onClick={event => event.stopPropagation()}
          className="shrink-0 p-1 -mr-1 -mt-1 text-fe-blue-gray hover:text-fe-blue touch-none cursor-grab active:cursor-grabbing disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fe-blue"
          data-testid={`drag-${item.id}`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            {[5, 10, 15].map(y => <g key={y}><circle cx="7" cy={y} r="1.4"/><circle cx="13" cy={y} r="1.4"/></g>)}
          </svg>
        </button>
      </div>
      <button type="button" disabled={disabled} onClick={event => { event.stopPropagation(); onOpen(item) }}
        className="block text-left w-full text-sm text-fe-anthracite font-medium leading-snug mb-1.5 break-words hover:text-fe-blue">
        {item.title}
      </button>
      <p className="text-[10px] mb-1.5" style={{ color: readiness.color }}>{saving ? 'Saving stage…' : readiness.label}</p>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {item.channels.map(channel => <span key={channel} className="text-[10px] px-1.5 py-0.5 bg-fe-offwhite border border-fe-line text-fe-blue-gray uppercase">{channel}</span>)}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-fe-blue-gray">{fmtLong(item.scheduled_date)}</span>
        <div className="flex items-center gap-1.5">
          {item.owner && <Avatar initials={item.owner.initials} color={item.owner.color} size="sm" title={item.owner.name} />}
          {item.status !== 'posted' && <button type="button" disabled={disabled}
            onClick={event => { event.stopPropagation(); onAdvance(item) }}
            className="text-xs text-fe-blue hover:underline disabled:opacity-40"
            data-testid={`advance-${item.id}`} aria-label={`Advance ${item.title} to next stage`} title="Move to next stage">→</button>}
        </div>
      </div>
    </article>
  )
}
