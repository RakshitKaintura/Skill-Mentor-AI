import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: number
  className?: string
}

/**
 * Optimized brand spinner using Tailwind v4 color variables.
 */
export function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <Loader2 
      size={size} 
      className={cn(
        "animate-spin text-brand-green", 
        className
      )} 
    />
  )
}

/**
 * Full-page loading state for Skill Mentor route transitions.
 */
export function PageLoader({ message = 'Loading mentor data...' }: { message?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 animate-fade-up">
      <div className="relative">
        <Spinner size={40} />
        {/* Subtle glow effect using brand green */}
        <div className="absolute inset-0 blur-xl bg-brand-green/20 -z-10" />
      </div>
      
      <p className="text-sm font-mono tracking-widest uppercase text-brand-muted animate-blink">
        {message}
      </p>
    </div>
  )
}

export default Spinner