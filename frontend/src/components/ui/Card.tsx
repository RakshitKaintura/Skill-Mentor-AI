import { cn } from '@/lib/utils'

type CardProps = {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className }: CardProps) {
  return (
    <article
      className={cn(
        'tilt-card neo-surface relative overflow-hidden rounded-2xl p-6 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[linear-gradient(90deg,#1a73e8,#34a853,#fbbc04,#ea4335)] before:opacity-85',
        className,
      )}
    >
      {children}
    </article>
  )
}
