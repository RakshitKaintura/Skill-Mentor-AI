'use client'

import { toast as sonnerToast } from 'sonner'

/**
 * SkillMentor UI Toast Wrapper
 * Leverages Sonner for performance and brand-consistent styling.
 */
export const toast = {
  success: (message: string) => {
    sonnerToast.success(message, {
      style: {
        background: 'rgba(79, 255, 160, 0.1)',
        border: '1px solid rgba(79, 255, 160, 0.3)',
        color: '#E8EDF8',
        backdropFilter: 'blur(12px)',
      },
      icon: <span className="text-brand-green">✓</span>,
    })
  },
  
  error: (message: string) => {
    sonnerToast.error(message, {
      style: {
        background: 'rgba(255, 107, 107, 0.1)',
        border: '1px solid rgba(255, 107, 107, 0.3)',
        color: '#E8EDF8',
        backdropFilter: 'blur(12px)',
      },
    })
  },

  warning: (message: string) => {
    sonnerToast.warning(message, {
      style: {
        background: 'rgba(255, 209, 102, 0.1)',
        border: '1px solid rgba(255, 209, 102, 0.3)',
        color: '#E8EDF8',
        backdropFilter: 'blur(12px)',
      },
    })
  },
}

// Export the hook for consistency with your existing code
export function useToast() {
  return toast
}