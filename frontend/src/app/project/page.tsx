'use client'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import Spinner from '@/components/ui/Spinner'
import type { Project, ProjectReview } from '@/types/week4'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ProjectPage() {
  const params   = useSearchParams()
  const router   = useRouter()
  const { user } = useAuth()

  const [project, setProject]     = useState<Project | null>(null)
  const [review,  setReview]      = useState<ProjectReview | null>(null)
  const [code,    setCode]        = useState('')
  const [github,  setGithub]      = useState('')
  const [hint,    setHint]        = useState<any>(null)
  const [question, setQuestion]   = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [hinting, setHinting]     = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [tab, setTab]             = useState<'brief' | 'submit' | 'review' | 'hints'>('brief')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const loadKeyRef = useRef<string>('')

  const skill     = params.get('skill')      || ''
  const level     = params.get('level')      || 'beginner'
  const roadmapId = params.get('roadmap_id') || ''
  const projectId = params.get('project_id') || ''
  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  const hasPlaceholder = (value: string) => value.toUpperCase().includes('YOUR_')

  const normalizeProject = (raw: any): Project => ({
    project_id: raw?.project_id || raw?.id || '',
    title: raw?.title || 'Untitled Project',
    description: raw?.description || '',
    requirements: raw?.requirements || [],
    tech_stack: raw?.tech_stack || [],
    starter_hints: raw?.starter_hints || raw?.mentor_secrets || [],
    expected_outcome: raw?.expected_outcome || raw?.success_criteria || '',
    estimated_hours: raw?.estimated_hours || 0,
    level: raw?.level || level,
    skill: raw?.skill || skill,
    status: raw?.status,
  })

  const normalizeReview = (raw: any): ProjectReview => {
    const requirementsFromAudit = Array.isArray(raw?.requirement_audit)
      ? raw.requirement_audit.map((item: any) => ({
          requirement: item?.req || item?.requirement || 'Requirement',
          met: (item?.status || '').toLowerCase() === 'met' || !!item?.met,
          comment: item?.comment || '',
        }))
      : []

    const requirementsCheck = Array.isArray(raw?.requirements_check)
      ? raw.requirements_check
      : requirementsFromAudit

    const improvementFromCritique = Array.isArray(raw?.code_critique)
      ? raw.code_critique.map((item: any) => ({
          issue: item?.issue || 'Improvement area',
          where: item?.location || item?.where || 'Codebase',
          how_to_fix: item?.suggestion || item?.how_to_fix || 'Refactor and improve this part.',
        }))
      : []

    const nextSteps = Array.isArray(raw?.next_steps)
      ? raw.next_steps
      : raw?.next_milestone
        ? [raw.next_milestone]
        : []

    return {
      score: Number(raw?.score || 0),
      grade: raw?.grade || 'D',
      requirements_check: requirementsCheck,
      code_quality: raw?.code_quality || {
        readability: 0,
        structure: 0,
        best_practices: 0,
        comments: [],
      },
      what_went_well: Array.isArray(raw?.what_went_well) ? raw.what_went_well : (raw?.top_strengths || []),
      what_to_improve: Array.isArray(raw?.what_to_improve) ? raw.what_to_improve : improvementFromCritique,
      overall_feedback: raw?.overall_feedback || raw?.overall_verdict || '',
      next_steps: nextSteps,
      xp_awarded: Number(raw?.xp_awarded || 0),
    }
  }

  useEffect(() => {
    if (!user) return
    const loadKey = `${user.id}|${projectId}|${roadmapId}|${skill}|${level}`
    if (loadKeyRef.current === loadKey) return
    loadKeyRef.current = loadKey

    if (projectId) {
      fetchExisting()
    } else if (skill && roadmapId) {
      if (hasPlaceholder(skill) || hasPlaceholder(roadmapId) || !isUuid(roadmapId)) {
        setError('Invalid project URL params. Open this page from Dashboard quick actions or use a real roadmap_id UUID.')
        return
      }
      loadOrCreateProject()
    }
  }, [user, projectId, roadmapId, skill, level])

  const fetchExisting = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/projects/${projectId}`)
      const data = await res.json()
      setProject(normalizeProject(data))
      if (data.submitted_code) setCode(data.submitted_code)
      if (data.github_url)     setGithub(data.github_url)
      if (data.review)         setReview(normalizeReview(data.review))
    } finally {
      setLoading(false)
    }
  }

  const generateProject = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/projects/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user!.id, roadmap_id: roadmapId, skill, level }),
      })
      const data = await res.json()
      if (data.success) setProject(normalizeProject(data.project))
    } finally {
      setLoading(false)
    }
  }

  const loadOrCreateProject = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/projects/user/${user!.id}?roadmap_id=${roadmapId}&limit=5`)
      const data = await res.json().catch(() => ({ projects: [] }))
      const existing = (data.projects || [])[0]
      if (existing) {
        setProject(normalizeProject(existing))
        if (existing.submitted_code) setCode(existing.submitted_code)
        if (existing.github_url) setGithub(existing.github_url)
        if (existing.review) setReview(normalizeReview(existing.review))
        return
      }
    } finally {
      setLoading(false)
    }

    await generateProject()
  }

  const generateNewProject = async () => {
    if (!user || !skill || !roadmapId) return
    if (hasPlaceholder(skill) || hasPlaceholder(roadmapId) || !isUuid(roadmapId)) {
      setError('Invalid project URL params. Open this page from Dashboard quick actions or use a real roadmap_id UUID.')
      return
    }

    setRegenerating(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/projects/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, roadmap_id: roadmapId, skill, level }),
      })
      const data = await res.json()
      if (data.success) {
        setProject(normalizeProject(data.project))
        setReview(null)
        setCode('')
        setGithub('')
        setHint(null)
        setQuestion('')
        setTab('brief')
      }
    } finally {
      setRegenerating(false)
    }
  }

  const submitForReview = async () => {
    if (!project || !code.trim()) return
    setReviewing(true)
    try {
      const res  = await fetch(`${API}/api/projects/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.project_id,
          user_id: user!.id,
          submitted_code: code,
          github_url: github,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setReview(normalizeReview(data.review))
        setTab('review')
      }
    } finally {
      setReviewing(false)
    }
  }

  const askForHint = async () => {
    if (!project || !question.trim()) return
    setHinting(true)
    try {
      const res  = await fetch(`${API}/api/projects/hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.project_id,
          user_id: user!.id,
          question,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const rawHint = data.hint || {}
        setHint({
          mentor_response: rawHint.mentor_response || rawHint.guidance || '',
          concrete_next_step: rawHint.concrete_next_step || rawHint.next_step || '',
          resource_suggestion: rawHint.resource_suggestion || rawHint.link || '',
        })
        setQuestion('')
      }
    } finally {
      setHinting(false)
    }
  }

  const gradeColor = (g: string) => {
    if (g === 'A') return 'text-brand-green'
    if (g === 'B') return 'text-brand-blue'
    if (g === 'C') return 'text-brand-yellow'
    return 'text-brand-red'
  }

  if (loading) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-center">
        <Spinner />
        <p className="text-brand-muted font-mono text-sm mt-4">
          {projectId ? 'Loading project…' : 'Generating your project…'}
        </p>
      </div>
    </div>
  )

  if (!project) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <p className="text-brand-muted font-mono text-sm">{error || 'No project found. Go back to your roadmap.'}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-bg">
      <DashboardNavbar />

      {/* Header */}
      <div className="border-b border-brand-border bg-brand-surface px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-1">
              Agent 7 · Project Mentor
            </div>
            <h1 className="font-display font-black text-2xl text-brand-text">{project.title}</h1>
            <div className="text-brand-muted font-mono text-xs mt-1">
              {project.skill} · {project.level} · ~{project.estimated_hours}h
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={generateNewProject}
              disabled={regenerating || loading}
              className="border border-brand-blue/40 text-brand-blue px-3 py-2 rounded-lg font-mono text-xs hover:bg-brand-blue/5 transition-colors disabled:opacity-40"
            >
              {regenerating ? 'Generating…' : 'Generate New Project'}
            </button>
            {review && (
              <div className="text-center">
                <div className={`text-5xl font-display font-black ${gradeColor(review.grade)}`}>
                  {review.grade}
                </div>
                <div className="text-brand-muted font-mono text-xs">{review.score}/100</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-brand-border bg-brand-surface">
        <div className="max-w-5xl mx-auto flex">
          {(['brief', 'submit', 'review', 'hints'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 font-mono text-xs uppercase tracking-wider transition-colors ${
                tab === t
                  ? 'text-brand-green border-b-2 border-brand-green'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              {t === 'review' && review && (review.score >= 75 ? '✓ ' : '')}
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* BRIEF TAB */}
        {tab === 'brief' && (
          <div className="space-y-6">
            <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
              <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3">Description</div>
              <p className="text-brand-text text-sm leading-relaxed">{project.description}</p>
            </div>

            <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
              <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3">
                Requirements ({project.requirements.length})
              </div>
              <ol className="space-y-2">
                {project.requirements.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-brand-green font-mono flex-shrink-0">{i + 1}.</span>
                    <span className="text-brand-text">{r}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
                <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3">Tech Stack</div>
                <div className="flex flex-wrap gap-2">
                  {project.tech_stack.map((t, i) => (
                    <span key={i} className="text-xs font-mono bg-brand-blue/10 border border-brand-blue/30 text-brand-blue px-2 py-1 rounded">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
                <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3">Expected Outcome</div>
                <p className="text-brand-text text-sm leading-relaxed">{project.expected_outcome}</p>
              </div>
            </div>

            <button
              onClick={() => setTab('submit')}
              className="w-full bg-brand-green text-brand-bg py-4 rounded-xl font-mono font-bold text-sm hover:bg-brand-green/90 transition-colors"
            >
              Start Building →
            </button>
          </div>
        )}

        {/* SUBMIT TAB */}
        {tab === 'submit' && (
          <div className="space-y-6">
            <div>
              <label className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2 block">
                GitHub URL (optional)
              </label>
              <input
                type="url"
                value={github}
                onChange={e => setGithub(e.target.value)}
                placeholder="https://github.com/username/project"
                className="w-full bg-brand-surface border border-brand-border rounded-lg px-4 py-3 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-blue/50"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2 block">
                Paste your code (main file or key files)
              </label>
              <textarea
                ref={textareaRef}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="// Paste your project code here..."
                rows={20}
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-3 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-green/50 resize-none"
              />
            </div>

            <button
              onClick={submitForReview}
              disabled={reviewing || !code.trim()}
              className="w-full bg-brand-green text-brand-bg py-4 rounded-xl font-mono font-bold text-sm hover:bg-brand-green/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {reviewing ? 'AI is reviewing your code…' : '🔍 Submit for AI Review'}
            </button>
          </div>
        )}

        {/* REVIEW TAB */}
        {tab === 'review' && review && (
          <div className="space-y-6">
            {/* Score */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
              <div className={`text-8xl font-display font-black mb-2 ${gradeColor(review.grade)}`}>
                {review.grade}
              </div>
              <div className="text-brand-muted font-mono text-sm">
                {review.score}/100 · +{review.xp_awarded} XP
              </div>
            </div>

            {/* Overall feedback */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
              <div className="text-xs font-mono text-brand-blue uppercase tracking-widest mb-3">AI Mentor Feedback</div>
              <p className="text-brand-text text-sm leading-relaxed">{review.overall_feedback}</p>
            </div>

            {/* Requirements check */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
              <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-4">Requirements Check</div>
              <div className="space-y-3">
                {(review.requirements_check || []).map((r, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${r.met ? 'border-brand-green/30 bg-brand-green/5' : 'border-brand-red/30 bg-brand-red/5'}`}>
                    <div className="flex items-start gap-2">
                      <span className={`flex-shrink-0 text-sm ${r.met ? 'text-brand-green' : 'text-brand-red'}`}>
                        {r.met ? '✓' : '✗'}
                      </span>
                      <div>
                        <div className="text-brand-text text-sm font-mono">{r.requirement}</div>
                        <div className="text-brand-muted text-xs mt-1">{r.comment}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What went well */}
            <div className="bg-brand-surface border border-brand-green/20 rounded-xl p-6">
              <div className="text-xs font-mono text-brand-green uppercase tracking-widest mb-3">✓ What Went Well</div>
              <ul className="space-y-2">
                {(review.what_went_well || []).map((w, i) => (
                  <li key={i} className="text-brand-text text-sm flex gap-2">
                    <span className="text-brand-green">→</span> {w}
                  </li>
                ))}
              </ul>
            </div>

            {/* What to improve */}
            {(review.what_to_improve || []).length > 0 && (
              <div className="bg-brand-surface border border-brand-yellow/20 rounded-xl p-6">
                <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-4">Areas to Improve</div>
                <div className="space-y-4">
                  {(review.what_to_improve || []).map((item, i) => (
                    <div key={i} className="border border-brand-border rounded-lg p-4">
                      <div className="text-brand-text text-sm font-medium mb-1">{item.issue}</div>
                      <div className="text-brand-muted text-xs mb-2">Where: {item.where}</div>
                      <div className="text-brand-yellow text-xs">Fix: {item.how_to_fix}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next steps */}
            <div className="bg-brand-surface border border-brand-blue/20 rounded-xl p-6">
              <div className="text-xs font-mono text-brand-blue uppercase tracking-widest mb-3">Next Steps</div>
              <ol className="space-y-2">
                {(review.next_steps || []).map((s, i) => (
                  <li key={i} className="text-brand-text text-sm flex gap-3">
                    <span className="text-brand-blue font-mono flex-shrink-0">{i + 1}.</span> {s}
                  </li>
                ))}
              </ol>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-brand-green text-brand-bg py-4 rounded-xl font-mono font-bold text-sm hover:bg-brand-green/90 transition-colors"
            >
              Continue Learning →
            </button>
          </div>
        )}

        {/* HINTS TAB */}
        {tab === 'hints' && (
          <div className="space-y-6">
            {/* Starter hints */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
              <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3">Starter Hints</div>
              <div className="space-y-3">
                {project.starter_hints.map((h, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-brand-yellow font-mono flex-shrink-0">💡</span>
                    <span className="text-brand-text leading-relaxed">{h}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ask mentor */}
            <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
              <div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-3">Ask Your Mentor</div>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="What are you stuck on? Be specific..."
                rows={3}
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-3 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-yellow/50 resize-none mb-3"
              />
              <button
                onClick={askForHint}
                disabled={hinting || !question.trim()}
                className="w-full border border-brand-yellow/40 text-brand-yellow py-3 rounded-lg font-mono text-sm hover:bg-brand-yellow/5 transition-colors disabled:opacity-40"
              >
                {hinting ? 'Mentor is thinking…' : '🎓 Get Mentor Guidance'}
              </button>
            </div>

            {/* Mentor response */}
            {hint && (
              <div className="bg-brand-surface border border-brand-yellow/30 rounded-xl p-6">
                <div className="text-xs font-mono text-brand-yellow uppercase tracking-widest mb-3">Mentor Response</div>
                <div className="text-brand-text text-sm leading-relaxed whitespace-pre-wrap mb-4">
                  {hint.mentor_response}
                </div>
                <div className="border border-brand-border rounded p-3 mb-3">
                  <div className="text-brand-muted text-xs font-mono mb-1">Next step:</div>
                  <div className="text-brand-green text-sm">{hint.concrete_next_step}</div>
                </div>
                <div className="text-brand-muted text-xs">
                  📖 Read: {hint.resource_suggestion}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}