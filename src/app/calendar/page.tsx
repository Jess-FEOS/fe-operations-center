import { Suspense } from 'react'
import CalendarWorkspace from '@/components/calendar/CalendarWorkspace'

export default function CalendarPage() {
  return <Suspense fallback={<p className="py-12 text-fe-blue-gray">Loading calendar…</p>}><CalendarWorkspace /></Suspense>
}
