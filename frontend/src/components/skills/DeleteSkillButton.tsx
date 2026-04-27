'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { deleteSkill } from '@/app/skills/actions'

interface Props {
  roadmapId: string
  skillName: string
}

export function DeleteSkillButton({ roadmapId, skillName }: Props) {
  const [isDeleting, setIsDeleting] = useState(false)
  const toast = useToast()

  const handleDelete = async () => {
    const confirmed = window.confirm(`Are you sure you want to delete the skill "${skillName}" and all its progress? This cannot be undone.`)
    if (!confirmed) return

    setIsDeleting(true)
    const result = await deleteSkill(roadmapId)
    setIsDeleting(false)

    if (result.success) {
      toast.success(`Skill "${skillName}" deleted permanently.`)
    } else {
      toast.error(result.error || 'Failed to delete skill.')
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-1.5 rounded-md text-[var(--color-app-text-secondary)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
      title="Delete Skill"
    >
      {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
    </button>
  )
}
