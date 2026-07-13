import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

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
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen" style={{ backgroundColor: '#F4F5F7' }}>
          <div className="p-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
