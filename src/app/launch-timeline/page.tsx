'use client'

// ── Program data ────────────────────────────────────────────────────────────
interface Program {
  name: string
  launchDate: string        // ISO date
  color: string
  tentative?: boolean
}

const PROGRAMS: Program[] = [
  { name: 'Podcast',            launchDate: '2026-05-01', color: '#6B4C9A' },
  { name: 'Newsletter',         launchDate: '2026-05-01', color: '#C45C2E' },
  { name: 'Analyst Academy',    launchDate: '2026-05-11', color: '#046A38' },
  { name: 'AI Accelerator',     launchDate: '2026-06-01', color: '#0762C8' },
  { name: 'Intern Accelerator', launchDate: '2026-06-01', color: '#437F94' },
  { name: 'Modeling Academy',   launchDate: '2026-06-01', color: '#B29838' },
  { name: 'Credit Academy',     launchDate: '2026-06-01', color: '#888888', tentative: true },
]

// ── Date helpers ────────────────────────────────────────────────────────────
const TIMELINE_START = new Date('2026-04-01')
const TIMELINE_END   = new Date('2026-09-30')
const MARKETING_WINDOW_DAYS = 21 // 3 weeks before launch

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

const TOTAL_DAYS = daysBetween(TIMELINE_START, TIMELINE_END)

function pct(date: Date) {
  return Math.max(0, Math.min(100, (daysBetween(TIMELINE_START, date) / TOTAL_DAYS) * 100))
}

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// ── Build month tick marks ──────────────────────────────────────────────────
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
const MONTH_TICKS = MONTHS.map((label, i) => {
  const d = new Date(2026, 3 + i, 1) // April = month 3
  return { label, pct: pct(d) }
})

// ── Marketing-load data (by week) ──────────────────────────────────────────
function getWeeklyLoad() {
  const weeks: { start: Date; end: Date; label: string; count: number }[] = []
  // Weeks from April 1 through August 31
  const loadEnd = new Date('2026-08-31')
  let cursor = new Date(TIMELINE_START)
  while (cursor < loadEnd) {
    const weekEnd = addDays(cursor, 6)
    const mid = addDays(cursor, 3)
    const monthLabel = mid.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    let count = 0
    for (const p of PROGRAMS) {
      const launch = new Date(p.launchDate)
      const mktStart = addDays(launch, -MARKETING_WINDOW_DAYS)
      // Program is competing for attention if this week overlaps its marketing window
      if (mktStart <= weekEnd && launch >= cursor) {
        count++
      }
    }
    weeks.push({ start: new Date(cursor), end: weekEnd, label: monthLabel, count })
    cursor = addDays(cursor, 7)
  }
  return weeks
}

function loadColor(count: number) {
  if (count >= 3) return '#C8350D'   // red
  if (count === 2) return '#D4930D'  // amber
  if (count === 1) return '#046A38'  // green
  return '#D1D5DB'                   // gray
}

// ── Page component ──────────────────────────────────────────────────────────
export default function LaunchTimeline() {
  const weeks = getWeeklyLoad()
  const maxCount = Math.max(...weeks.map(w => w.count), 1)

  // Detect launch-date collisions for marker stacking
  const launchGroups: Record<string, Program[]> = {}
  for (const p of PROGRAMS) {
    ;(launchGroups[p.launchDate] ??= []).push(p)
  }

  return (
    <div>
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <h1 className="font-barlow font-extrabold text-2xl text-fe-navy mb-6">
        Launch Timeline
      </h1>

      {/* ── Warning callout ──────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 mb-8">
        <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h18.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
        </svg>
        <p className="font-fira text-sm text-amber-900 leading-relaxed">
          <span className="font-bold">3 programs share a June 1 launch date.</span>{' '}
          Marketing windows overlap starting May 11.
        </p>
      </div>

      {/* ── Marketing Load bar chart ─────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
        <h2 className="font-barlow font-bold text-lg text-fe-navy mb-4">Marketing Load by Week</h2>
        <div className="flex items-end gap-[3px] h-40">
          {weeks.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              {/* Tooltip */}
              <div className="absolute -top-8 hidden group-hover:flex bg-fe-navy text-white text-xs font-fira rounded px-2 py-1 whitespace-nowrap z-10">
                {w.label}: {w.count} program{w.count !== 1 ? 's' : ''}
              </div>
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${(w.count / maxCount) * 100}%`,
                  minHeight: w.count > 0 ? 4 : 2,
                  backgroundColor: loadColor(w.count),
                }}
              />
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-5 mt-4 text-xs font-fira text-fe-anthracite">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#C8350D' }} /> 3+ programs (overloaded)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#D4930D' }} /> 2 programs</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#046A38' }} /> 1 program</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#D1D5DB' }} /> None</span>
        </div>
      </section>

      {/* ── Swimlane timeline ────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-barlow font-bold text-lg text-fe-navy mb-6">Program Swimlanes</h2>

        {/* Month axis */}
        <div className="relative h-6 mb-2 ml-44">
          {MONTH_TICKS.map((m) => (
            <span
              key={m.label}
              className="absolute text-xs font-fira text-fe-blue-gray -translate-x-1/2"
              style={{ left: `${m.pct}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {PROGRAMS.map((prog) => {
            const launch = new Date(prog.launchDate)
            const mktStart = addDays(launch, -MARKETING_WINDOW_DAYS)
            const barLeft = pct(mktStart)
            const barRight = pct(launch)
            const barWidth = barRight - barLeft
            const launchPct = pct(launch)
            const group = launchGroups[prog.launchDate]
            const isCollision = group.length > 1
            const collisionIdx = group.indexOf(prog)

            return (
              <div key={prog.name} className="flex items-center gap-0">
                {/* Label */}
                <div className="w-44 shrink-0 pr-4 text-right">
                  <span className="font-fira text-sm font-bold text-fe-anthracite">
                    {prog.name}
                  </span>
                  {prog.tentative && (
                    <span className="ml-1.5 text-[10px] font-fira text-gray-400 uppercase tracking-wide">
                      tentative
                    </span>
                  )}
                </div>

                {/* Track */}
                <div className="flex-1 relative h-10">
                  {/* Grid lines for months */}
                  {MONTH_TICKS.map((m) => (
                    <div
                      key={m.label}
                      className="absolute top-0 bottom-0 w-px bg-gray-100"
                      style={{ left: `${m.pct}%` }}
                    />
                  ))}

                  {/* Background track */}
                  <div className="absolute inset-0 rounded bg-gray-50" />

                  {/* Marketing window bar */}
                  <div
                    className="absolute top-1.5 bottom-1.5 rounded"
                    style={{
                      left: `${barLeft}%`,
                      width: `${barWidth}%`,
                      backgroundColor: prog.color,
                      opacity: 0.25,
                      border: prog.tentative ? `2px dashed ${prog.color}` : undefined,
                    }}
                  />

                  {/* Launch marker */}
                  <div
                    className="absolute top-0 bottom-0 flex flex-col items-center"
                    style={{ left: `${launchPct}%`, transform: 'translateX(-50%)' }}
                  >
                    {/* Vertical line */}
                    <div
                      className="w-0.5 flex-1"
                      style={{
                        backgroundColor: prog.color,
                        border: prog.tentative ? undefined : undefined,
                      }}
                    />
                    {/* Pin head */}
                    <div
                      className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md shrink-0 absolute top-1/2 -translate-y-1/2"
                      style={{
                        backgroundColor: prog.color,
                        border: prog.tentative ? `2px dashed ${prog.color}` : '2px solid white',
                        // Offset stacked markers so collisions are visible
                        marginLeft: isCollision ? `${(collisionIdx - (group.length - 1) / 2) * 14}px` : undefined,
                      }}
                    />
                  </div>

                  {/* Collision highlight stripe */}
                  {isCollision && collisionIdx === 0 && (
                    <div
                      className="absolute top-0 bottom-0 rounded pointer-events-none"
                      style={{
                        left: `${launchPct - 0.6}%`,
                        width: '1.2%',
                        minWidth: 6,
                        backgroundColor: '#C8350D',
                        opacity: 0.12,
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Collision callout for June 1 */}
        <div className="mt-6 flex flex-wrap gap-3">
          {Object.entries(launchGroups)
            .filter(([, progs]) => progs.length > 1)
            .map(([date, progs]) => (
              <div
                key={date}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2"
              >
                <svg className="w-4 h-4 text-fe-red shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                </svg>
                <span className="text-xs font-fira text-fe-anthracite">
                  <span className="font-bold">{progs.length} launches on {new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}:</span>{' '}
                  {progs.map(p => p.name).join(', ')}
                </span>
              </div>
            ))}
        </div>

        {/* Color legend */}
        <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-100">
          {PROGRAMS.map((p) => (
            <span key={p.name} className="flex items-center gap-1.5 text-xs font-fira text-fe-anthracite">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{
                  backgroundColor: p.color,
                  border: p.tentative ? `1.5px dashed ${p.color}` : undefined,
                  opacity: p.tentative ? 0.6 : 1,
                }}
              />
              {p.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
