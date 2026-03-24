import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import Link from 'next/link'
import { BookOpen, CheckCircle, ArrowRight, Play } from 'lucide-react'

export default async function LessonsListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile?.onboarding_completed) redirect('/onboarding')

  const { data: progress } = await supabase.from('user_progress').select('*').eq('user_id', user.id).single()

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, topic, week_number, completed, completed_at, created_at, key_takeaway, sources_used')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)

  const { data: roadmap } = await supabase
    .from('roadmaps').select('skill, current_topic').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(1).single()

  const total     = lessons?.length ?? 0
  const completed = lessons?.filter((l: { completed: boolean }) => l.completed).length ?? 0

  return (
    <div className="min-h-screen">
      <DashboardNavbar userName={profile?.full_name ?? ''}
        streakDays={progress?.streak_days ?? 0} xpPoints={progress?.xp_points ?? 0} />

      <div className="max-w-5xl mx-auto px-5 py-10">

        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={16} style={{ color: '#5B8EFF' }} />
              <span className="text-xs tracking-widest uppercase" style={{ color: '#5B8EFF' }}>All Lessons</span>
            </div>
            <h1 className="font-display font-black text-4xl" style={{ letterSpacing: '-1.5px' }}>Your Lessons</h1>
            <p className="mt-2 text-sm" style={{ color: '#6B7A99' }}>{completed}/{total} completed · {roadmap?.skill}</p>
          </div>
          <Link href="/lesson/current"
            className="flex items-center gap-2 px-5 py-3 rounded-sm font-display font-bold text-sm"
            style={{ background: '#4FFFA0', color: '#080B14' }}>
            <Play size={14} /> Next Lesson
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px mb-8"
          style={{ background: '#1E2A42', border: '1px solid #1E2A42', borderRadius: '6px', overflow: 'hidden' }}>
          {[
            { label: 'Total Lessons',  value: total,     color: '#5B8EFF' },
            { label: 'Completed',      value: completed, color: '#4FFFA0' },
            { label: 'Completion Rate',value: total > 0 ? `${Math.round(completed/total*100)}%` : '0%', color: '#FFD166' },
          ].map(({ label, value, color }) => (
            <div key={label} className="py-6 text-center" style={{ background: '#0E1420' }}>
              <div className="font-display font-black text-3xl mb-1" style={{ color }}>{value}</div>
              <div className="text-xs tracking-widest uppercase" style={{ color: '#6B7A99' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* List */}
        {!lessons || lessons.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <BookOpen size={40} className="mx-auto mb-4" style={{ color: '#6B7A99' }} />
            <h3 className="font-display font-bold text-xl mb-2">No lessons yet</h3>
            <p className="text-sm mb-6" style={{ color: '#6B7A99' }}>Generate your first lesson to start learning {roadmap?.skill}</p>
            <Link href="/lesson/current"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-sm font-display font-bold text-sm"
              style={{ background: '#4FFFA0', color: '#080B14' }}>
              Start First Lesson <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {roadmap?.current_topic && (
              <Link href="/lesson/current"
                className="glass-card p-5 flex items-center justify-between gap-4 transition-all hover:-translate-y-0.5"
                style={{ borderColor: 'rgba(79,255,160,0.25)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(79,255,160,0.15)', border: '1px solid rgba(79,255,160,0.3)' }}>
                    <Play size={16} style={{ color: '#4FFFA0' }} />
                  </div>
                  <div>
                    <span className="text-xs font-bold" style={{ color: '#4FFFA0' }}>UP NEXT</span>
                    <p className="font-display font-bold text-sm">{roadmap.current_topic}</p>
                  </div>
                </div>
                <ArrowRight size={16} style={{ color: '#4FFFA0' }} />
              </Link>
            )}
            {lessons.map((lesson: {
              id: string; topic: string; week_number: number;
              completed: boolean; created_at: string; key_takeaway: string | null;
            }) => (
              <Link key={lesson.id} href={`/lesson/${lesson.id}`}
                className="glass-card p-5 flex items-center justify-between gap-4 transition-all hover:-translate-y-0.5">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: lesson.completed ? 'rgba(79,255,160,0.1)' : 'rgba(91,142,255,0.1)',
                      border:     `1px solid ${lesson.completed ? 'rgba(79,255,160,0.3)' : 'rgba(91,142,255,0.3)'}`,
                      color:      lesson.completed ? '#4FFFA0' : '#5B8EFF',
                    }}>
                    {lesson.completed ? <CheckCircle size={16} /> : <BookOpen size={14} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm truncate">{lesson.topic}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs" style={{ color: '#6B7A99' }}>Week {lesson.week_number}</span>
                      {lesson.key_takeaway && (
                        <span className="text-xs truncate" style={{ color: '#6B7A99', maxWidth: 220 }}>
                          {lesson.key_takeaway}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {lesson.completed && (
                    <span className="text-xs px-2 py-1 rounded-sm"
                      style={{ background: 'rgba(79,255,160,0.08)', color: '#4FFFA0', border: '1px solid rgba(79,255,160,0.2)' }}>
                      Done
                    </span>
                  )}
                  <ArrowRight size={14} style={{ color: '#6B7A99' }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}