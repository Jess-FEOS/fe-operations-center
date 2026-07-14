import type { Metadata } from 'next'
import './globals.css'
import TopNav from '@/components/TopNav'

export const metadata: Metadata = {
  title: 'Fundamental Edge Operations Center',
  description: 'Internal operating system for Fundamental Edge',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: '#F4F5F7' }}>
        <TopNav />
        <main className="pt-16 min-h-screen">
          <div className="max-w-[1600px] mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
