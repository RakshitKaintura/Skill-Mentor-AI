'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNavbar from '@/components/layout/DashboardNavbar'
import SectionContainer from '@/components/ui/SectionContainer'
import Spinner from '@/components/ui/Spinner'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type ResumeReviewResponse = {
	ats_score?: number
	verdict?: string
	missing_keywords?: string[]
	critique?: Array<{ section?: string; issue?: string; fix?: string }>
	top_improvement?: string
}

function ResumePageContent() {
	const params = useSearchParams()
	const { user, loading } = useAuth()

	const [targetRole, setTargetRole] = useState('Software Engineer')
	const [resumeText, setResumeText] = useState('')
	const [reviewing, setReviewing] = useState(false)
	const [review, setReview] = useState<ResumeReviewResponse | null>(null)

	const skill = params.get('skill') || ''
	const level = params.get('level') || 'beginner'
	const roadmapId = params.get('roadmap_id') || ''

	const submitResume = async () => {
		if (!user || !roadmapId || !skill || !resumeText.trim()) return

		setReviewing(true)
		try {
			const res = await fetch(`${API}/api/career/resume/review`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user_id: user.id,
					roadmap_id: roadmapId,
					skill,
					target_role: targetRole,
					resume_text: resumeText,
				}),
			})

			const data = await res.json()
			if (data.success) {
				setReview(data.review)
			}
		} finally {
			setReviewing(false)
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen page-tone-cool flex items-center justify-center">
				<Spinner />
			</div>
		)
	}

	return (
		<div className="min-h-screen page-tone-cool">
			<DashboardNavbar />

			<SectionContainer className="py-10 max-w-4xl">
				<div className="mb-8">
					<div className="text-xs font-mono text-brand-blue uppercase tracking-widest mb-2">
						Agent 8 · Resume ATS Score
					</div>
					<h1 className="font-display font-black text-4xl text-brand-text">Resume ATS Score</h1>
					<p className="text-brand-muted font-mono text-sm mt-2">
						{skill || 'Skill'} · {level} · AI ATS Review
					</p>
				</div>

				{!roadmapId || !skill ? (
					<div className="bg-brand-surface border border-brand-border rounded-xl p-6 text-brand-muted font-mono text-sm">
						Open this page with roadmap context, for example from Career Hub or Dashboard quick actions.
					</div>
				) : (
					<div className="grid md:grid-cols-2 gap-6">
						<div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-4">
							<div>
								<label className="block text-xs font-mono text-brand-muted uppercase tracking-widest mb-2">
									Target Role
								</label>
								<input
									value={targetRole}
									onChange={(e) => setTargetRole(e.target.value)}
									className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-3 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-blue/50"
								/>
							</div>

							<div>
								<label className="block text-xs font-mono text-brand-muted uppercase tracking-widest mb-2">
									Resume Text
								</label>
								<textarea
									value={resumeText}
									onChange={(e) => setResumeText(e.target.value)}
									rows={14}
									placeholder="Paste your resume content here..."
									className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-3 text-brand-text font-mono text-sm focus:outline-none focus:border-brand-blue/50"
								/>
							</div>

							<button
								onClick={submitResume}
								disabled={reviewing || !resumeText.trim()}
								className="w-full bg-brand-blue text-brand-bg py-3 rounded-lg font-mono text-sm font-bold hover:bg-brand-blue/90 transition-colors disabled:opacity-50"
							>
								{reviewing ? 'Reviewing…' : 'Run AI Resume Review'}
							</button>
						</div>

						<div className="bg-brand-surface border border-brand-border rounded-xl p-6">
							{!review ? (
								<div className="text-brand-muted font-mono text-sm">No review yet. Submit your resume to get feedback.</div>
							) : (
								<div className="space-y-5">
									<div>
										<div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2">ATS Score</div>
										<div className="font-display font-black text-5xl text-brand-green">{review.ats_score ?? 0}</div>
										<div className="text-brand-text font-mono text-sm mt-1">{review.verdict || 'Needs Work'}</div>
									</div>

									<div>
										<div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2">Top Improvement</div>
										<p className="text-brand-text text-sm leading-relaxed">{review.top_improvement || 'No suggestion available yet.'}</p>
									</div>

									<div>
										<div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2">Missing Keywords</div>
										<div className="flex flex-wrap gap-2">
											{(review.missing_keywords || []).map((kw, idx) => (
												<span key={idx} className="text-xs font-mono bg-brand-yellow/10 border border-brand-yellow/30 text-brand-yellow px-2 py-1 rounded">
													{kw}
												</span>
											))}
										</div>
									</div>

									<div>
										<div className="text-xs font-mono text-brand-muted uppercase tracking-widest mb-2">Critique</div>
										<div className="space-y-3">
											{(review.critique || []).map((item, idx) => (
												<div key={idx} className="bg-brand-bg border border-brand-border rounded-lg p-3">
													<div className="text-brand-blue font-mono text-xs mb-1">{item.section || 'General'}</div>
													<p className="text-brand-text text-sm mb-2">{item.issue || ''}</p>
													<p className="text-brand-muted text-xs">Fix: {item.fix || ''}</p>
												</div>
											))}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</SectionContainer>
		</div>
	)
}

export default function ResumePage() {
	return (
		<Suspense fallback={<div className="min-h-screen page-tone-cool flex items-center justify-center"><Spinner /></div>}>
			<ResumePageContent />
		</Suspense>
	)
}
