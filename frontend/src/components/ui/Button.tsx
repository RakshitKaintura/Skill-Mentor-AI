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
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-app-primary)] disabled:pointer-events-none disabled:opacity-60',
    size === 'md' ? 'h-10 px-4 text-sm' : 'h-12 px-6 text-base',
    variant === 'primary'
      ? 'border border-[#1558ba] bg-gradient-to-r from-[#1a73e8] via-[#4285f4] to-[#34a853] text-[#0f172a] shadow-[0_12px_24px_rgba(26,115,232,0.28)] hover:-translate-y-0.5 hover:brightness-105'
      : 'border border-[var(--color-app-border)] bg-[color-mix(in_oklab,var(--color-app-surface-cool)_76%,var(--color-app-surface)_24%)] text-[var(--color-app-text-primary)] shadow-[0_8px_14px_rgba(20,24,35,0.06)] hover:-translate-y-0.5 hover:bg-[color-mix(in_oklab,var(--color-app-surface-cool)_88%,var(--color-app-surface)_12%)]',
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
