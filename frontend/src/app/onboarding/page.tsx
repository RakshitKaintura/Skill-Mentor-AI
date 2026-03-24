'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { ArrowRight, ArrowLeft, CheckCircle, Loader2, Upload } from 'lucide-react'

type Step = 'skill' | 'level' | 'goal' | 'time' | 'upload' | 'generating'

interface Data {
  skill: string; level: string; goal: string; hours: string; uploadedFile: string | null
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

export default function OnboardingPage() {
  const supabase = createClient()
  const toast    = useToast()

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

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/roadmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id, 
          skill: data.skill, 
          level: data.level,
          goal: data.goal, 
          hours_per_day: parseFloat(data.hours || "1"),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Backend generation failed' }));
        throw new Error(errData.detail || 'The AI architect encountered an error.');
      }

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
        window.location.assign('/dashboard');
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
        </div>

        {step !== 'generating' && (
          <div className="mb-10">
            <div className="flex justify-between text-xs mb-2" style={{ color: '#6B7A99' }}>
              <span>Setting up your learning path</span>
              <span>{stepIdx + 1} / {STEPS.length}</span>
            </div>
            <div className="h-1 rounded-full" style={{ background: '#1E2A42' }}>
              <div className="h-1 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#4FFFA0,#5B8EFF)' }} />
            </div>
          </div>
        )}

        {/* STEP: SKILL */}
        {step === 'skill' && (
          <div className="animate-fade-up">
            <h2 className="font-display font-black text-3xl mb-2" style={{ letterSpacing: '-1px' }}>
              What do you want to learn?
            </h2>
            <p className="text-sm mb-8" style={{ color: '#6B7A99' }}>Type any skill — programming, design, data science, anything.</p>
            <input type="text" autoFocus value={data.skill}
              onChange={e => setData(d => ({ ...d, skill: e.target.value }))}
              placeholder="e.g. JavaScript, Python, React…"
              className="w-full px-4 py-4 text-base rounded-sm mb-5"
              style={{ background: '#0E1420', borderColor: '#1E2A42', color: '#E8EDF8', fontSize: '16px' }}
              onKeyDown={e => e.key === 'Enter' && data.skill.trim() && setStep('level')}
            />
            <div className="flex flex-wrap gap-2 mb-8">
              {POPULAR_SKILLS.map(s => (
                <button key={s} onClick={() => setData(d => ({ ...d, skill: s }))}
                  className="px-3 py-1.5 rounded-sm text-xs border transition-all"
                  style={{
                    borderColor: data.skill === s ? '#4FFFA0' : '#1E2A42',
                    background:  data.skill === s ? 'rgba(79,255,160,0.1)' : '#0E1420',
                    color:       data.skill === s ? '#4FFFA0' : '#6B7A99',
                  }}>{s}</button>
              ))}
            </div>
            <button onClick={() => setStep('level')} disabled={!data.skill.trim()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-sm font-display font-bold text-sm disabled:opacity-40"
              style={{ background: '#4FFFA0', color: '#080B14' }}>
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
            <p className="text-sm mb-8" style={{ color: '#6B7A99' }}>Be honest — the AI adapts completely to where you are.</p>
            <div className="flex flex-col gap-3 mb-8">
              {LEVELS.map(l => (
                <button key={l.value} onClick={() => setData(d => ({ ...d, level: l.value }))}
                  className="flex items-center justify-between gap-4 p-5 rounded-sm border text-left transition-all"
                  style={{
                    borderColor: data.level === l.value ? '#4FFFA0' : '#1E2A42',
                    background:  data.level === l.value ? 'rgba(79,255,160,0.06)' : '#0E1420',
                  }}>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{l.emoji}</span>
                    <div>
                      <div className="font-display font-bold text-sm">{l.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#6B7A99' }}>{l.desc}</div>
                    </div>
                  </div>
                  {data.level === l.value && <CheckCircle size={17} style={{ color: '#4FFFA0', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('skill')}
                className="flex items-center gap-2 px-6 py-4 rounded-sm text-sm border"
                style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={() => setStep('goal')} disabled={!data.level}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-sm font-display font-bold text-sm disabled:opacity-40"
                style={{ background: '#4FFFA0', color: '#080B14' }}>
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
            <p className="text-sm mb-8" style={{ color: '#6B7A99' }}>This helps the AI focus your roadmap on what matters for you.</p>
            <div className="flex flex-col gap-3 mb-8">
              {GOALS.map(g => (
                <button key={g.value} onClick={() => setData(d => ({ ...d, goal: g.value }))}
                  className="flex items-center justify-between px-5 py-4 rounded-sm border text-left transition-all"
                  style={{
                    borderColor: data.goal === g.value ? '#4FFFA0' : '#1E2A42',
                    background:  data.goal === g.value ? 'rgba(79,255,160,0.06)' : '#0E1420',
                  }}>
                  <span className="flex items-center gap-3 font-display font-bold text-sm">
                    <span className="text-xl">{g.emoji}</span>{g.label}
                  </span>
                  {data.goal === g.value && <CheckCircle size={16} style={{ color: '#4FFFA0' }} />}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('level')}
                className="flex items-center gap-2 px-6 py-4 rounded-sm text-sm border"
                style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={() => setStep('time')} disabled={!data.goal}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-sm font-display font-bold text-sm disabled:opacity-40"
                style={{ background: '#4FFFA0', color: '#080B14' }}>
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
            <p className="text-sm mb-8" style={{ color: '#6B7A99' }}>The AI builds a realistic schedule around your availability.</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {TIME_OPTIONS.map(t => (
                <button key={t.value} onClick={() => setData(d => ({ ...d, hours: t.value }))}
                  className="flex flex-col items-center py-6 rounded-sm border transition-all"
                  style={{
                    borderColor: data.hours === t.value ? '#4FFFA0' : '#1E2A42',
                    background:  data.hours === t.value ? 'rgba(79,255,160,0.06)' : '#0E1420',
                  }}>
                  <span className="font-display font-bold text-sm mb-1">{t.label}</span>
                  <span className="text-xs" style={{ color: '#6B7A99' }}>{t.desc}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('goal')}
                className="flex items-center gap-2 px-6 py-4 rounded-sm text-sm border"
                style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={() => setStep('upload')} disabled={!data.hours}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-sm font-display font-bold text-sm disabled:opacity-40"
                style={{ background: '#4FFFA0', color: '#080B14' }}>
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
              <span style={{ color: '#6B7A99', fontSize: '18px', fontWeight: 400 }}>(optional)</span>
            </h2>
            <p className="text-sm mb-8" style={{ color: '#6B7A99' }}>
              Upload your university textbook or syllabus. The AI will teach from your exact curriculum.
            </p>
            <label className="block mb-5 cursor-pointer">
              <div className="border-2 border-dashed rounded-sm p-10 text-center transition-all"
                style={{
                  borderColor: data.uploadedFile ? '#4FFFA0' : uploading ? '#5B8EFF' : '#1E2A42',
                  background: '#0E1420',
                }}>
                {data.uploadedFile ? (
                  <><CheckCircle size={36} className="mx-auto mb-3" style={{ color: '#4FFFA0' }} />
                    <p className="font-display font-bold text-sm" style={{ color: '#4FFFA0' }}>✅ {data.uploadedFile}</p></>
                ) : uploading ? (
                  <><Loader2 size={36} className="animate-spin mx-auto mb-3" style={{ color: '#5B8EFF' }} />
                    <p className="text-sm" style={{ color: '#6B7A99' }}>Processing your book…</p></>
                ) : (
                  <><Upload size={36} className="mx-auto mb-3" style={{ color: '#6B7A99' }} />
                    <p className="font-display font-bold text-sm mb-1">Drop your PDF here</p>
                    <p className="text-xs" style={{ color: '#6B7A99' }}>Textbooks · Syllabus · Max 50 MB</p></>
                )}
              </div>
              <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            <div className="flex gap-3">
              <button onClick={() => setStep('time')}
                className="flex items-center gap-2 px-6 py-4 rounded-sm text-sm border"
                style={{ borderColor: '#1E2A42', color: '#6B7A99' }}>
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleFinish} disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-sm font-display font-bold text-sm disabled:opacity-40"
                style={{ background: '#4FFFA0', color: '#080B14' }}>
                {data.uploadedFile ? 'Generate My Roadmap 🚀' : 'Skip & Generate Roadmap'}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP: GENERATING */}
        {step === 'generating' && (
          <div className="animate-fade-up text-center py-12">
            <div className="relative inline-block mb-8">
              <div className="w-20 h-20 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: '#4FFFA0', background: 'rgba(79,255,160,0.08)' }}>
                <span className="text-3xl">🧠</span>
              </div>
              <div className="absolute inset-0 rounded-full border-2 animate-ping opacity-20"
                style={{ borderColor: '#4FFFA0' }} />
            </div>
            <h2 className="font-display font-black text-3xl mb-4" style={{ letterSpacing: '-1px' }}>
              Building your roadmap…
            </h2>
            <p className="text-sm mb-10" style={{ color: '#6B7A99' }}>
              Gemini 3.1 Flash Lite Preview is designing your personalized learning path
            </p>
            <div className="flex flex-col gap-3 max-w-sm mx-auto text-left">
              {[
                '🔍 Analyzing your skill level…',
                '📚 Scanning knowledge sources…',
                '🗺️  Designing your learning path…',
                '📅 Scheduling weekly milestones…',
                '✅ Finalizing your roadmap…',
              ].map((msg, i) => (
                <div key={i} className="flex items-center gap-3 text-sm"
                  style={{ color: '#6B7A99', animation: `fadeUp 0.5s ${i * 0.4}s ease both` }}>
                  <Loader2 size={13} className="animate-spin" style={{ color: '#4FFFA0' }} />
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}