import { cn } from '@/lib/utils'

type SectionContainerProps = {
  children: React.ReactNode
  className?: string
}

export default function SectionContainer({ children, className }: SectionContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-full px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  )
}
