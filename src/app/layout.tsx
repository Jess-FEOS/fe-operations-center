import type { Metadata } from 'next'
import './globals.css'
import TopNav from '@/components/TopNav'
import { isReadOnly } from '@/lib/access-policy'

export const metadata: Metadata = {
  title: 'Fundamental Edge Operations Center',
  description: 'Internal operating system for Fundamental Edge',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const readOnly = isReadOnly(process.env)
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: '#F4F5F7' }}>
        <TopNav />
        <main className="pt-16 min-h-screen">
            {readOnly && <div role="status" className="border-b border-blue-200 bg-blue-50 px-6 py-3 text-sm text-fe-navy">
              <strong>Foundation review · Read-only.</strong> Existing data is visible. Schedule and checklist reviews are available; live saves are blocked.
            </div>}
          <div className="max-w-[1600px] mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
