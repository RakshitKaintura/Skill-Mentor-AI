import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'
import {
  NotebookPen, ArrowRight,
} from 'lucide-react'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Card             from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'
import { NotesLibraryClient } from '@/components/notes/NotesLibraryClient'

// ── Server page — fetches all user notes ─────────────────────

export const metadata = {
  title:       'My Notes — Skill Mentor AI',
  description: 'Search, review, and export all your study notes across every skill.',
}

export default async function NotesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, onboarding_completed')
    .eq('id', user.id).single()
  if (!profile?.onboarding_completed) redirect('/onboarding')

  const { data: progress } = await supabase
    .from('user_progress').select('xp_points, streak_days')
    .eq('user_id', user.id).single()

  // Fetch all notes
  const { data: notes } = await supabase
    .from('user_notes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const noteList = (notes ?? []) as Array<{
    id: string; lesson_id: string | null; roadmap_id: string | null
    skill: string; topic: string; step_index: number | null; step_title: string | null
    content: string; ai_summary: string | null; tags: string[]
    created_at: string; updated_at: string
  }>

  // Derive unique skills + tags for filter UI
  const allSkills = [...new Set(noteList.map(n => n.skill))].sort()
  const allTags   = [...new Set(noteList.flatMap(n => n.tags))].sort()

  return (
    <div className="min-h-screen page-tone-cool">
      <DashboardNavbar
        userName={profile?.full_name ?? ''}
        streakDays={progress?.streak_days ?? 0}
        xpPoints={progress?.xp_points ?? 0}
      />

      <SectionContainer className="py-8 md:py-10 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--color-app-primary)' }}>
            <NotebookPen size={14} />
            Notes Library
          </div>
          <h1 className="font-display font-black text-4xl" style={{ letterSpacing: '-1.5px' }}>
            My Study Notes
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-app-text-secondary)' }}>
            {noteList.length === 0
              ? 'Start a lesson and use the 📝 Notes panel to capture your thoughts.'
              : `${noteList.length} note${noteList.length !== 1 ? 's' : ''} across ${allSkills.length} skill${allSkills.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {noteList.length === 0 ? (
          <Card className="text-center py-12">
            <span className="text-4xl block mb-3">📓</span>
            <h2 className="font-display font-bold text-lg mb-2">No notes yet</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--color-app-text-secondary)' }}>
              Open any lesson, click the 📝 Notes button, and start capturing insights.
            </p>
            <Link href="/lesson/current"
              className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
              style={{ background: 'var(--color-app-primary)', color: '#fff' }}>
              Go to Lesson <ArrowRight size={14} />
            </Link>
          </Card>
        ) : (
          <NotesLibraryClient
            initialNotes={noteList}
            allSkills={allSkills}
            allTags={allTags}
            userId={user.id}
          />
        )}
      </SectionContainer>
    </div>
  )
}
