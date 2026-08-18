'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useToast } from '@/components/ui/Toast'
import { AgenticTerminal } from '@/components/ui/AgenticTerminal'
import { ArrowRight, ArrowLeft, CheckCircle, Loader2, Upload } from 'lucide-react'
import { RoadmapService } from '@/services/roadmap.service'

type Step = 'skill' | 'level' | 'goal' | 'time' | 'upload' | 'generating'

interface Data {
  skill: string
  level: string
  goal: string
  hours: string
  days?: string
  uploadedFile: string | null
}

const POPULAR_SKILLS = [
  'JavaScript','Python','React','Node.js','TypeScript',
  'Java','C++','SQL','Machine Learning','Flutter',
  'DSA','System Design','DevOps','Rust','Go',
]

const LEVELS = [
  { value: 'beginner',     emoji: '🌱', label: 'Complete Beginner',  desc: 'Never tried this skill before'             },
  { value: 'some',         emoji: '🌿', label: 'Know the Basics',    desc: 'Know a little but feel stuck'              },
  { value: 'intermediate', emoji: '🌳', label: 'Intermediate',       desc: 'Can build simple things, want to go deeper' },
]

const GOALS = [
  { value: 'get_job',       emoji: '💼', label: 'Get a Job / Internship' },
  { value: 'freelance',     emoji: '💰', label: 'Start Freelancing'       },
  { value: 'build_project', emoji: '🚀', label: 'Build My Own Project'    },
  { value: 'exam',          emoji: '🎓', label: 'Pass University Exam'    },
  { value: 'upskill',       emoji: '📈', label: 'Upskill at Work'         },
]

const TIME_OPTIONS = [
  { value: '0.5', label: '30 min/day', desc: 'Slow & steady'   },
  { value: '1',   label: '1 hr/day',   desc: 'Balanced pace'   },
  { value: '2',   label: '2 hrs/day',  desc: 'Fast learner'    },
  { value: '4',   label: '4+ hrs/day', desc: 'Full focus mode' },
]

const STEPS: Step[] = ['skill','level','goal','time','upload']

import { Suspense } from 'react'

function OnboardingContent() {
  const supabase = createClient()
  const toast    = useToast()
  const { track } = useAnalytics()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const isNewSkillMode = searchParams.get('mode') === 'new-skill'

  const [step, setStep]     = useState<Step>('skill')
  const [data, setData]     = useState<Data>({ skill: '', level: '', goal: '', hours: '', uploadedFile: null })
  const [uploading, setUploading] = useState(false)

  const stepIdx  = STEPS.indexOf(step as typeof STEPS[number])
  const progress = step === 'generating' ? 100 : ((stepIdx + 1) / STEPS.length) * 100

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Please upload a PDF file'); return }
    if (file.size > 50 * 1024 * 1024)   { toast.error('File too large. Max 50 MB'); return }
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const path = `${user.id}/books/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('user-books').upload(path, file)
      if (upErr) throw upErr
      await supabase.from('user_books').insert({
        user_id: user.id, file_name: file.name, file_path: path,
        skill_tag: data.skill.toLowerCase(), processing_status: 'pending',
        file_size_bytes: file.size,
      })
      setData(d => ({ ...d, uploadedFile: file.name }))
      toast.success('Book uploaded! The AI will learn from it.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }
  
  const handleFinish = async () => {
    setStep('generating');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Authentication lost. Please log in again.');

      try {
        const res = await RoadmapService.generateRoadmap({
            user_id: user.id, 
            skill: data.skill, 
            level: data.level,
            goal: data.goal, 
            hours_per_day: parseFloat(data.hours || "1"),
            days_per_week: parseFloat(data.days || "3")
        })
        if (res.roadmap_id) {
            router.push(`/dashboard?roadmap_id=${res.roadmap_id}`)
        } else {
            throw new Error(res.message || 'The AI architect encountered an error.');
        }
      } catch (errData: any) {
        throw new Error(errData.detail || errData.message || 'The AI architect encountered an error.');
      }

      void track('roadmap_generated', {
        page: '/onboarding',
        event_data: {
          skill: data.skill,
          level: data.level,
          goal: data.goal,
          hours_per_day: parseFloat(data.hours || '1'),
          used_book_upload: Boolean(data.uploadedFile),
          onboarding_mode: isNewSkillMode ? 'new_skill' : 'first_skill',
        },
      })

      const { error: profileErr } = await supabase.from('profiles')
        .update({ 
          onboarding_completed: true, 
          current_skill: data.skill 
        })
        .eq('id', user.id);

      if (profileErr) throw profileErr;

      // 1.5s delay to show the "Finalizing" animation
      setTimeout(() => {
        // Hard navigation is the ONLY way to clear that JSON sidebar error
        window.location.assign(isNewSkillMode ? '/skills' : '/dashboard');
      }, 1500);

      return; // Stop any further local state updates

    } catch (err: unknown) {
      console.error("Onboarding Error:", err);
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('upload'); 
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">

        <div className="text-center mb-8">
          <span className="font-display font-black text-xl gradient-text">SkillMentor AI</span>
          {isNewSkillMode && (
            <p className="mt-2 text-xs text-app-text-secondary">
              Add a new skill roadmap without affecting your existing skills.
            </p>
          )}
        </div>

        {step !== 'generating' && (
          <div className="mb-10">
            <div className="flex justify-between text-xs mb-2 text-app-text-secondary">
              <span>{isNewSkillMode ? 'Adding your new skill path' : 'Setting up your learning path'}</span>
              <span>{stepIdx + 1} / {STEPS.length}</span>
            </div>
            <div className="h-1 rounded-full bg-app-border">
              <div className="h-1 rounded-full transition-all duration-500 bg-app-primary"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* STEP: SKILL */}
        {step === 'skill' && (
          <div className="animate-fade-up">
            <h2 className="font-display font-black text-3xl mb-2" style={{ letterSpacing: '-1px' }}>
              {isNewSkillMode ? 'What new skill do you want to add?' : 'What do you want to learn?'}
            </h2>
            <p className="text-sm mb-8 text-app-text-secondary">
              {isNewSkillMode
                ? 'This creates a separate roadmap for your next skill.'
                : 'Type any skill — programming, design, data science, anything.'}
            </p>
            <input type="text" autoFocus value={data.skill}
              onChange={e => setData(d => ({ ...d, skill: e.target.value }))}
              placeholder="e.g. JavaScript, Python, React…"
              className="w-full px-5 py-4 text-base rounded-xl mb-5 neo-surface border-app-border text-app-text-primary focus:ring-2 focus:ring-app-primary/50 transition-all shadow-sm"
              onKeyDown={e => e.key === 'Enter' && data.skill.trim() && setStep('level')}
            />
            <div className="flex flex-wrap gap-2 mb-8">
              {POPULAR_SKILLS.map(s => (
                <button key={s} onClick={() => setData(d => ({ ...d, skill: s }))}
                  className={`px-4 py-2 rounded-full text-xs border transition-all font-medium ${
                    data.skill === s 
                      ? 'border-app-primary bg-app-primary/10 text-app-primary' 
                      : 'border-app-border bg-app-surface text-app-text-secondary hover:bg-app-border/50 hover:text-app-text-primary'
                  }`}>{s}</button>
              ))}
            </div>
            <button onClick={() => setStep('level')} disabled={!data.skill.trim()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-display font-bold text-sm bg-app-primary text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-md">
              Continue <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* STEP: LEVEL */}
        {step === 'level' && (
          <div className="animate-fade-up">
            <h2 className="font-display font-black text-3xl mb-2" style={{ letterSpacing: '-1px' }}>
              What&apos;s your current level?
            </h2>
            <p className="text-sm mb-8 text-app-text-secondary">Be honest — the AI adapts completely to where you are.</p>
            <div className="flex flex-col gap-3 mb-8">
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setData(d => ({ ...d, level: l.value }))}
                  className={`flex items-center justify-between gap-4 p-5 rounded-xl border text-left transition-all ${
                    data.level === l.value ? 'border-app-primary bg-app-primary/5' : 'border-app-border bg-app-surface hover:border-app-primary/50'
                  }`}>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{l.emoji}</span>
                    <div>
                      <div className="font-display font-bold text-sm">{l.label}</div>
                      <div className="text-xs mt-0.5 text-app-text-secondary">{l.desc}</div>
                    </div>
                  </div>
                  {data.level === l.value && <CheckCircle size={17} className="text-app-primary shrink-0" />}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('skill')}
                className="flex items-center gap-2 px-6 py-4 rounded-xl text-sm border border-app-border text-app-text-secondary hover:bg-app-surface transition-all">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={() => setStep('goal')} disabled={!data.level}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-display font-bold text-sm bg-app-primary text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-md">
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP: GOAL */}
        {step === 'goal' && (
          <div className="animate-fade-up">
            <h2 className="font-display font-black text-3xl mb-2" style={{ letterSpacing: '-1px' }}>
              What&apos;s your goal?
            </h2>
            <p className="text-sm mb-8 text-app-text-secondary">This helps the AI focus your roadmap on what matters for you.</p>
            <div className="flex flex-col gap-3 mb-8">
              {GOALS.map(g => (
                <button key={g.value} onClick={() => setData(d => ({ ...d, goal: g.value }))}
                  className={`flex items-center justify-between px-5 py-4 rounded-xl border text-left transition-all ${
                    data.goal === g.value ? 'border-app-primary bg-app-primary/5' : 'border-app-border bg-app-surface hover:border-app-primary/50'
                  }`}>
                  <span className="flex items-center gap-3 font-display font-bold text-sm">
                    <span className="text-xl">{g.emoji}</span>{g.label}
                  </span>
                  {data.goal === g.value && <CheckCircle size={16} className="text-app-primary" />}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('level')}
                className="flex items-center gap-2 px-6 py-4 rounded-xl text-sm border border-app-border text-app-text-secondary hover:bg-app-surface transition-all">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={() => setStep('time')} disabled={!data.goal}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-display font-bold text-sm bg-app-primary text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-md">
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP: TIME */}
        {step === 'time' && (
          <div className="animate-fade-up">
            <h2 className="font-display font-black text-3xl mb-2" style={{ letterSpacing: '-1px' }}>
              How much time daily?
            </h2>
            <p className="text-sm mb-8 text-app-text-secondary">The AI builds a realistic schedule around your availability.</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {TIME_OPTIONS.map(t => (
                <button key={t.value} onClick={() => setData(d => ({ ...d, hours: t.value }))}
                  className={`flex flex-col items-center py-6 rounded-xl border transition-all ${
                    data.hours === t.value ? 'border-app-primary bg-app-primary/5' : 'border-app-border bg-app-surface hover:border-app-primary/50'
                  }`}>
                  <span className="font-display font-bold text-sm mb-1">{t.label}</span>
                  <span className="text-xs text-app-text-secondary">{t.desc}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('goal')}
                className="flex items-center gap-2 px-6 py-4 rounded-xl text-sm border border-app-border text-app-text-secondary hover:bg-app-surface transition-all">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={() => setStep('upload')} disabled={!data.hours}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-display font-bold text-sm bg-app-primary text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-md">
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div className="animate-fade-up">
            <h2 className="font-display font-black text-3xl mb-2" style={{ letterSpacing: '-1px' }}>
              Upload your books{' '}
              <span className="text-[18px] font-normal text-app-text-secondary">(optional)</span>
            </h2>
            <p className="text-sm mb-8 text-app-text-secondary">
              Upload your university textbook or syllabus. The AI will teach from your exact curriculum.
            </p>
            <label className="block mb-5 cursor-pointer">
              <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
                  data.uploadedFile ? 'border-brand-green bg-brand-green/5' : uploading ? 'border-brand-blue bg-brand-blue/5' : 'border-app-border bg-app-surface hover:border-app-primary/50'
                }`}>
                {data.uploadedFile ? (
                  <><CheckCircle size={36} className="mx-auto mb-3 text-brand-green" />
                    <p className="font-display font-bold text-sm text-brand-green">✅ {data.uploadedFile}</p></>
                ) : uploading ? (
                  <><Loader2 size={36} className="animate-spin mx-auto mb-3 text-brand-blue" />
                    <p className="text-sm text-app-text-secondary">Processing your book…</p></>
                ) : (
                  <><Upload size={36} className="mx-auto mb-3 text-app-text-secondary" />
                    <p className="font-display font-bold text-sm mb-1">Drop your PDF here</p>
                    <p className="text-xs text-app-text-secondary">Textbooks · Syllabus · Max 50 MB</p></>
                )}
              </div>
              <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            <div className="flex gap-3">
              <button onClick={() => setStep('time')}
                className="flex items-center gap-2 px-6 py-4 rounded-xl text-sm border border-app-border text-app-text-secondary hover:bg-app-surface transition-all">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleFinish} disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-display font-bold text-sm bg-app-primary text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-md">
                {data.uploadedFile ? 'Generate My Roadmap 🚀' : 'Skip & Generate Roadmap'}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP: GENERATING */}
        {step === 'generating' && (
          <div className="animate-fade-up w-full py-8">
            <AgenticTerminal agentName="Roadmap Architect" />
          </div>
        )}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <OnboardingContent />
    </Suspense>
  )
}