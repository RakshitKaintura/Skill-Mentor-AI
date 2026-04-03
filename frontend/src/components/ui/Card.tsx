import { cn } from '@/lib/utils'

type CardProps = {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className }: CardProps) {
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-app-surface)_94%,#fff_6%),var(--color-app-surface))] p-6 shadow-[0_3px_12px_rgba(60,64,67,0.07),0_1px_2px_rgba(60,64,67,0.09)] ring-1 ring-[color:var(--color-app-border)] before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-[linear-gradient(90deg,var(--card-accent-start),var(--card-accent-end))] before:opacity-45',
        className,
      )}
    >
      {children}
    </article>
  )
}
