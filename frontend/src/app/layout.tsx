import type { Metadata, Viewport } from 'next'
import { Syne, DM_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

// 1. Optimized font loading
const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
  weight: ['300', '400', '500'],
})

// 2. Metadata API (Streaming-ready)
export const metadata: Metadata = {
  title: 'SkillMentor AI — Your Personal AI Teacher',
  description: 'Master any skill from zero to job-ready with personalized agentic roadmaps and 24/7 AI tutoring.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  icons: {
    icon: '/favicon.ico',
  },
}

// 3. Viewport API (Standardized separate export for 2026)
export const viewport: Viewport = {
  themeColor: '#080B14',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html 
      lang="en" 
      className={`${syne.variable} ${dmMono.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="bg-brand-bg text-brand-text font-mono antialiased selection:bg-brand-green selection:text-brand-bg">
        {/* Main Application Shell */}
        {/* 'min-h-screen' fixed from 'min-height-screen' */}
        <main className="relative z-10 min-h-screen">
          {children}
        </main>

        {/* Global Notifications */}
        <Toaster 
          position="bottom-right" 
          theme="dark" 
          richColors 
          closeButton
          expand={false}
        />
      </body>
    </html>
  )
}