import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { DashboardNavbar } from '@/components/layout/DashboardNavbar'
import { Trophy, Star, Lock, CheckCircle, Flame, BookOpen, Target, Zap, Award } from 'lucide-react'
import React from 'react'

// ── Badge definitions ─────────────────────────────────────────────
const ALL_BADGES = [
  // Learning milestones
  { id: 'first_lesson',  icon: '🎯', name: 'First Step',       desc: 'Complete your very first lesson',     xp: 50,   category: 'learning',  requirement: (p: ProgressData) => p.lessonsCompleted >= 1  },
  { id: 'lessons_3',     icon: '📖', name: 'Getting Started',  desc: 'Complete 3 lessons',                  xp: 100,  category: 'learning',  requirement: (p: ProgressData) => p.lessonsCompleted >= 3  },
  { id: 'lessons_5',     icon: '📚', name: 'Avid Learner',     desc: 'Complete 5 lessons',                  xp: 150,  category: 'learning',  requirement: (p: ProgressData) => p.lessonsCompleted >= 5  },
  { id: 'lessons_10',    icon: '🏅', name: 'Dedicated',        desc: 'Complete 10 lessons',                 xp: 300,  category: 'learning',  requirement: (p: ProgressData) => p.lessonsCompleted >= 10 },
  { id: 'lessons_25',    icon: '🎓', name: 'Scholar',          desc: 'Complete 25 lessons',                 xp: 500,  category: 'learning',  requirement: (p: ProgressData) => p.lessonsCompleted >= 25 },

  // Streak badges
  { id: 'streak_3',      icon: '🔥', name: '3-Day Streak',     desc: 'Study 3 days in a row',               xp: 75,   category: 'streak',    requirement: (p: ProgressData) => p.streakDays >= 3  },
  { id: 'streak_7',      icon: '⚡', name: 'Week Warrior',     desc: 'Study 7 days in a row',               xp: 200,  category: 'streak',    requirement: (p: ProgressData) => p.streakDays >= 7  },
  { id: 'streak_14',     icon: '💪', name: 'Two Weeks Strong', desc: 'Study 14 days in a row',              xp: 400,  category: 'streak',    requirement: (p: ProgressData) => p.streakDays >= 14 },
  { id: 'streak_30',     icon: '🌟', name: 'Monthly Master',   desc: 'Study 30 days in a row',              xp: 1000, category: 'streak',    requirement: (p: ProgressData) => p.streakDays >= 30 },

  // XP milestones
  { id: 'xp_500',        icon: '⭐', name: 'Level 2',          desc: 'Reach 500 XP',                        xp: 0,    category: 'xp',        requirement: (p: ProgressData) => p.xpPoints >= 500  },
  { id: 'xp_1000',       icon: '💫', name: 'Level 3',          desc: 'Reach 1,000 XP',                      xp: 0,    category: 'xp',        requirement: (p: ProgressData) => p.xpPoints >= 1000 },
  { id: 'xp_2500',       icon: '🚀', name: 'Level 5',          desc: 'Reach 2,500 XP',                      xp: 0,    category: 'xp',        requirement: (p: ProgressData) => p.xpPoints >= 2500 },
  { id: 'xp_5000',       icon: '💎', name: 'Level 10',         desc: 'Reach 5,000 XP',                      xp: 0,    category: 'xp',        requirement: (p: ProgressData) => p.xpPoints >= 5000 },

  // Curiosity
  { id: 'doubt_1',       icon: '🤔', name: 'Curious',          desc: 'Ask your first doubt',                xp: 25,   category: 'curiosity', requirement: (p: ProgressData) => p.doubtsAsked >= 1  },
  { id: 'doubt_5',       icon: '💡', name: 'Inquisitive',      desc: 'Ask 5 doubts',                        xp: 75,   category: 'curiosity', requirement: (p: ProgressData) => p.doubtsAsked >= 5  },
  { id: 'doubt_20',      icon: '🧠', name: 'Deep Thinker',     desc: 'Ask 20 doubts',                       xp: 200,  category: 'curiosity', requirement: (p: ProgressData) => p.doubtsAsked >= 20 },

  // Time invested
  { id: 'time_1h',       icon: '⏱️', name: 'First Hour',       desc: 'Study for 1 hour total',              xp: 50,   category: 'time',      requirement: (p: ProgressData) => p.studyMinutes >= 60   },
  { id: 'time_10h',      icon: '🕐', name: 'Ten Hours',        desc: 'Study for 10 hours total',            xp: 200,  category: 'time',      requirement: (p: ProgressData) => p.studyMinutes >= 600  },
  { id: 'time_50h',      icon: '🏆', name: 'Fifty Hours',      desc: 'Study for 50 hours total',            xp: 500,  category: 'time',      requirement: (p: ProgressData) => p.studyMinutes >= 3000 },
]

const CATEGORY_META: Record<string, { label: string; color: string; Icon: React.ComponentType<{size?: number; style?: React.CSSProperties}> }> = {
  learning:  { label: 'Learning',   color: '#4FFFA0', Icon: BookOpen },
  streak:    { label: 'Streaks',    color: '#FFD166', Icon: Flame    },
  xp:        { label: 'XP Levels', color: '#C77DFF', Icon: Star     },
  curiosity: { label: 'Curiosity', color: '#5B8EFF', Icon: Target   },
  time:      { label: 'Time',      color: '#FF8C42', Icon: Zap      },
}

interface ProgressData {
  lessonsCompleted: number
  streakDays:       number
  xpPoints:         number
  doubtsAsked:      number
  studyMinutes:     number
}

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profile?.onboarding_completed) redirect('/onboarding')

  const { data: progress } = await supabase
    .from('user_progress').select('*').eq('user_id', user.id).single()

  const { count: doubtsAsked } = await supabase
    .from('doubts').select('*', { count: 'exact', head: true }).eq('user_id', user.id)

  const progressData: ProgressData = {
    lessonsCompleted: progress?.lessons_completed    ?? 0,
    streakDays:       progress?.streak_days          ?? 0,
    xpPoints:         progress?.xp_points            ?? 0,
    doubtsAsked:      doubtsAsked                    ?? 0,
    studyMinutes:     progress?.total_study_minutes  ?? 0,
  }

  const badges   = ALL_BADGES.map(b => ({ ...b, unlocked: b.requirement(progressData) }))
  const unlocked = badges.filter(b => b.unlocked).length
  const total    = badges.length
  const categories = [...new Set(ALL_BADGES.map(b => b.category))]

  return (
    <div className="min-h-screen">
      <DashboardNavbar
        userName={profile?.full_name ?? ''}
        streakDays={progressData.streakDays}
        xpPoints={progressData.xpPoints}
      />

      <div className="max-w-5xl mx-auto px-5 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={16} style={{ color: '#FFD166' }} />
              <span className="text-xs tracking-widest uppercase" style={{ color: '#FFD166' }}>Achievements</span>
            </div>
            <h1 className="font-display font-black text-4xl" style={{ letterSpacing: '-1.5px' }}>
              Your Badges
            </h1>
            <p className="mt-2 text-sm" style={{ color: '#6B7A99' }}>
              {unlocked} of {total} unlocked · Keep learning to earn more
            </p>
          </div>
          <div className="text-right">
            <div className="font-display font-black text-4xl" style={{ color: '#FFD166' }}>
              {Math.round((unlocked / total) * 100)}%
            </div>
            <div className="text-xs" style={{ color: '#6B7A99' }}>completion</div>
          </div>
        </div>

        {/* Overall progress */}
        <div className="glass-card p-5 mb-8">
          <div className="flex justify-between text-xs mb-2" style={{ color: '#6B7A99' }}>
            <span>Badge progress</span>
            <span style={{ color: '#FFD166' }}>{unlocked}/{total}</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: '#1E2A42' }}>
            <div className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${Math.round((unlocked / total) * 100)}%`,
                background: 'linear-gradient(90deg,#FFD166,#FF8C42)',
              }} />
          </div>
        </div>

        {/* Badges by category */}
        {categories.map(cat => {
          const meta        = CATEGORY_META[cat]
          const catBadges   = badges.filter(b => b.category === cat)
          const catUnlocked = catBadges.filter(b => b.unlocked).length
          const Icon        = meta.Icon

          return (
            <div key={cat} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Icon size={14} style={{ color: meta.color }} />
                <h2 className="font-display font-bold text-base">{meta.label}</h2>
                <span className="text-xs px-2 py-0.5 rounded-sm"
                  style={{ background: meta.color + '15', color: meta.color }}>
                  {catUnlocked}/{catBadges.length}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {catBadges.map(badge => (
                  <div key={badge.id}
                    className="glass-card p-5 flex flex-col items-center gap-3 text-center transition-all duration-200"
                    style={{
                      borderColor: badge.unlocked ? meta.color + '35' : '#1E2A42',
                      background:  badge.unlocked ? meta.color + '06' : '#0E1420',
                      opacity:     badge.unlocked ? 1 : 0.45,
                    }}>

                    <div className="relative">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl"
                        style={{
                          background: badge.unlocked ? meta.color + '18' : '#141B2D',
                          border:     `2px solid ${badge.unlocked ? meta.color + '40' : '#1E2A42'}`,
                        }}>
                        {badge.unlocked ? badge.icon : <Lock size={20} style={{ color: '#6B7A99' }} />}
                      </div>
                      {badge.unlocked && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: '#4FFFA0' }}>
                          <CheckCircle size={12} style={{ color: '#080B14' }} />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="font-display font-bold text-xs mb-1"
                        style={{ color: badge.unlocked ? meta.color : '#6B7A99' }}>
                        {badge.name}
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: '#6B7A99' }}>
                        {badge.desc}
                      </p>
                    </div>

                    {badge.xp > 0 && (
                      <div className="flex items-center gap-1 text-xs"
                        style={{ color: badge.unlocked ? '#C77DFF' : '#3A4A6A' }}>
                        <Star size={10} />
                        +{badge.xp} XP
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Next badge hint */}
        {(() => {
          const next = badges.find(b => !b.unlocked)
          if (!next) return null
          return (
            <div className="glass-card p-5 flex items-center gap-4"
              style={{ borderColor: 'rgba(79,255,160,0.2)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(79,255,160,0.1)', border: '1px solid rgba(79,255,160,0.3)' }}>
                <Award size={18} style={{ color: '#4FFFA0' }} />
              </div>
              <div>
                <p className="font-display font-bold text-sm mb-0.5">
                  Next up: <span style={{ color: '#4FFFA0' }}>{next.name}</span>
                </p>
                <p className="text-xs" style={{ color: '#6B7A99' }}>{next.desc}</p>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
