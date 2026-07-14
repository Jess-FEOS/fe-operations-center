import { ReactNode } from 'react'

interface PageHeaderProps {
  /** Small uppercase label above the title. Defaults to the app name. */
  eyebrow?: string
  /** The main page title. */
  title: string
  /** Optional supporting text shown under the title. */
  subtitle?: string
  /** Optional right-aligned content (actions, date, filters). If omitted, today's date is shown. */
  actions?: ReactNode
  /** Set false to hide the automatic date on the right when no actions are given. */
  showDate?: boolean
}

/**
 * Editorial page header band. Anchors the top of every screen with a
 * consistent eyebrow + title + right-aligned context. Uses the shared
 * `.fe-pageband` / `.fe-eyebrow` classes from globals.css.
 *
 * The negative margins pull the band flush to the top and sides of the
 * main content padding (px-8 pt-8), matching the dashboard.
 */
export default function PageHeader({
  eyebrow = 'Operations Center',
  title,
  subtitle,
  actions,
  showDate = true,
}: PageHeaderProps) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="fe-pageband -mx-6 -mt-8 mb-8 px-6 pt-7 pb-6 no-print">
      <p className="fe-eyebrow mb-1">{eyebrow}</p>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-barlow font-extrabold text-2xl text-fe-navy leading-none">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm font-fira text-fe-blue-gray">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {actions ? (
            actions
          ) : showDate ? (
            <p className="text-sm font-fira text-fe-blue-gray">{today}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
