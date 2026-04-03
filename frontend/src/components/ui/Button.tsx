import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary'
type ButtonSize = 'md' | 'lg'

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-app-primary)] disabled:pointer-events-none disabled:opacity-60',
    size === 'md' ? 'h-10 px-4 text-sm' : 'h-12 px-6 text-base',
    variant === 'primary'
      ? 'bg-[var(--color-app-primary)] text-white hover:bg-[#1765cc]'
      : 'border border-[var(--color-app-border)] bg-[var(--color-app-surface)] text-[var(--color-app-text-primary)] hover:bg-[var(--color-app-bg)]',
    className,
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

export default function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={buttonClassName({ variant, size, className })} {...props} />
}
