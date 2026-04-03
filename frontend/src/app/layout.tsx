import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import AnalyticsTracker from '@/components/AnalyticsTracker'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

// 2. Metadata API (SEO Optimized)
export const metadata: Metadata = {
  title: 'SkillMentor AI — Your Personal AI Teacher',
  description: 'Any skill. Any level. Any time. Powered by Gemini 3.1 Flash.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'SkillMentor AI',
    description: 'Learn any skill with your personal AI teacher',
    type: 'website',
    url: 'https://skillmentor.ai',
    siteName: 'SkillMentor AI',
  },
}

// 3. Viewport API (Standardized separate export for 2026 Next.js)
export const viewport: Viewport = {
  themeColor: '#4FFFA0',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html 
      lang="en" 
      className={`${inter.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="bg-[var(--color-app-bg)] text-[var(--color-app-text-primary)] font-sans antialiased selection:bg-[#d2e3fc] selection:text-[var(--color-app-text-primary)]">
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>

        {/* Main Application Shell */}
        <main className="relative z-10 min-h-screen">
          {children}
        </main>

        {/* Global Notifications */}
        <Toaster 
          position="bottom-right" 
          theme="light" 
          richColors 
          closeButton
          expand={false}
        />
      </body>
    </html>
  )
}