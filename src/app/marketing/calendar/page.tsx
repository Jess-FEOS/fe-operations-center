import { redirect } from 'next/navigation'

export default async function LegacyMarketingCalendar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const source = await searchParams
  const params = new URLSearchParams({ view: 'marketing' })
  for (const key of ['date', 'program', 'owner', 'asset', 'new']) {
    const value = source[key]
    if (typeof value === 'string') params.set(key, value)
  }
  redirect(`/calendar?${params}`)
}
