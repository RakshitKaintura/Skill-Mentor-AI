'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { buttonClassName } from '@/components/ui/Button'

interface Props {
  roadmapId: string
}

export function ShareButton({ roadmapId }: Props) {
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  const handleShare = async () => {
    try {
      const url = `${window.location.origin}/share/${roadmapId}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Public link copied to clipboard! 🔗')
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      toast.error('Failed to copy link')
    }
  }

  return (
    <button 
      onClick={handleShare}
      className={`${buttonClassName()} bg-[var(--color-app-surface)] text-[var(--color-app-text-primary)] border border-[var(--color-app-border)] hover:bg-[var(--color-app-surface-cool)] transition-all`}
    >
      {copied ? <Check size={14} className="text-[#188038]" /> : <Share2 size={14} />}
      {copied ? 'Copied Link!' : 'Share Roadmap'}
    </button>
  )
}
