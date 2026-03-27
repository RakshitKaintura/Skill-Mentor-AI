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
      className={`${syne.variable} ${dmMono.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="bg-brand-bg text-brand-text font-mono antialiased selection:bg-brand-green selection:text-brand-bg">
        {/* Main Application Shell */}
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