import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Manrope, Sora } from 'next/font/google'
import { Toaster } from 'sonner'
import AnalyticsTracker from '@/components/AnalyticsTracker'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'SkillMentor AI - Your Personal AI Teacher',
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

export const viewport: Viewport = {
  themeColor: '#0e7490',
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
      className={`${manrope.variable} ${sora.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="bg-[var(--color-app-bg)] text-[var(--color-app-text-primary)] font-sans antialiased selection:bg-[#cdeaf7] selection:text-[var(--color-app-text-primary)]">
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>

          <main className="relative z-10 min-h-screen">
            {children}
          </main>

          <Toaster
            position="bottom-right"
            theme="system"
            richColors
            closeButton
            expand={false}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
