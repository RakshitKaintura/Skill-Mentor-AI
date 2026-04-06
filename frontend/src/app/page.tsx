import Link from 'next/link'
import { ArrowRight, Brain, FileText, Globe, Mic, Sparkles, Zap } from 'lucide-react'
import Navbar from '@/components/ui/Navbar'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'
import { buttonClassName } from '@/components/ui/Button'
import StaggerReveal from '@/components/ui/StaggerReveal'

export default function HomePage() {
  const features = [
    {
      title: 'Personalized learning roadmap',
      description: 'Generate week-by-week plans that adapt to your level and goals so every study session has purpose.',
      Icon: Brain,
      tone: 'from-[#4285f4] to-[#1a73e8]',
    },
    {
      title: 'Real-time voice guidance',
      description: 'Learn in conversation mode with spoken explanations and natural follow-up questions.',
      Icon: Mic,
      tone: 'from-[#34a853] to-[#188038]',
    },
    {
      title: 'Context-aware doubt support',
      description: 'Get structured explanations, examples, and next steps exactly when you are stuck.',
      Icon: Zap,
      tone: 'from-[#fbbc04] to-[#ea8600]',
    },
    {
      title: 'Curriculum-grounded learning',
      description: 'Upload your material and keep responses aligned with your syllabus and exam direction.',
      Icon: FileText,
      tone: 'from-[#ea4335] to-[#c5221f]',
    },
    {
      title: 'Always current content',
      description: 'Practice with up-to-date tools, patterns, and techniques used in modern projects.',
      Icon: Globe,
      tone: 'from-[#a142f4] to-[#7b1fa2]',
    },
    {
      title: 'Progress visibility',
      description: 'Track milestones and confidence growth with clear daily momentum indicators.',
      Icon: ArrowRight,
      tone: 'from-[#34a853] to-[#1a73e8]',
    },
  ]

  return (
    <main className="min-h-screen page-tone-cool text-[var(--color-app-text-primary)]">
      <Navbar />

      <SectionContainer className="py-8 md:py-12">
        <section className="neo-surface holo-border mesh-bg relative grid gap-8 rounded-3xl p-6 md:grid-cols-[1.1fr_0.9fr] md:p-10">
          <div className="shape-layer left-[-22px] top-[-22px]"><div className="shape-circle shape-blue h-20 w-20" /></div>
          <div className="shape-layer right-[20%] top-[-10px]"><div className="shape-triangle" /></div>
          <div className="shape-layer bottom-[-30px] left-[12%]"><div className="shape-flower" /></div>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-app-border)] bg-[var(--color-app-surface-cool)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-app-primary)]">
              <Sparkles className="h-3.5 w-3.5" />
              AI-powered skill growth
            </div>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Learn faster with a
              {' '}
              <span className="gradient-text">visual roadmap</span>,
              {' '}voice coaching,
              {' '}and daily momentum.
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-[var(--color-app-text-secondary)] md:text-lg">
              SkillMentor AI transforms big learning goals into focused weekly execution.
              Build confidence with guided lessons, adaptive practice, and clear progress loops.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link href="/auth/register" className={buttonClassName({ size: 'lg' })}>
                Start learning
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/auth/login" className={buttonClassName({ variant: 'secondary', size: 'lg' })}>
                Sign in
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { label: 'Active Learners', value: '10k+', tone: 'bg-[var(--color-app-surface-cool)]' },
                { label: 'Guided Sessions', value: '120k+', tone: 'bg-[var(--color-app-surface-mint)]' },
                { label: 'Weekly Retention', value: '92%', tone: 'bg-[var(--color-app-surface-lavender)]' },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border border-[var(--color-app-border)] p-3 text-center ${item.tone}`}>
                  <p className="text-xl font-bold text-[var(--color-app-text-primary)] md:text-2xl">{item.value}</p>
                  <p className="text-xs font-medium text-[var(--color-app-text-secondary)]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="neo-surface relative min-h-[280px] overflow-hidden rounded-3xl p-6 md:min-h-[420px] md:p-8">
            <div className="shape-layer right-[-20px] top-[-18px]"><div className="shape-diamond" /></div>
            <div className="shape-layer left-[8%] bottom-[16%]"><div className="shape-circle shape-yellow h-11 w-11" /></div>
            <div className="shape-layer right-[18%] bottom-[12%]"><div className="shape-circle shape-green h-10 w-10" /></div>

            <div className="prism-sphere absolute left-1/2 top-[46%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 md:h-64 md:w-64" />

            <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-[var(--color-app-border)] bg-[var(--color-app-surface)] p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-app-primary)]">Learning pulse</p>
              <h3 className="mt-1 text-lg font-semibold">Week-by-week clarity</h3>
              <p className="mt-1 text-sm text-[var(--color-app-text-secondary)]">Visual progress plus voice coaching keeps your study loop focused and motivating.</p>
              <div className="shine-line mt-3 h-1.5 w-full rounded-full" />
            </div>
          </div>
        </section>
      </SectionContainer>

      <SectionContainer className="pb-8 md:pb-12">
        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Platform capabilities</h2>
              <p className="mt-2 max-w-2xl text-base text-[var(--color-app-text-secondary)]">
                Every feature is designed to reduce overwhelm and keep your next action obvious.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map(({ title, description, Icon, tone }, index) => (
              <StaggerReveal key={title} delayMs={index * 90}>
                <Card>
                  <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-[0_10px_20px_rgba(32,33,36,0.2)] ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                  <p className="text-base text-[var(--color-app-text-secondary)]">{description}</p>
                </Card>
              </StaggerReveal>
            ))}
          </div>
        </section>
      </SectionContainer>

      <SectionContainer className="pb-10 md:pb-14">
        <section className="neo-surface holo-border mesh-bg rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Ready to build learning momentum?</h2>
              <p className="mt-2 max-w-2xl text-base text-[var(--color-app-text-secondary)]">
                Create your account and begin with a roadmap that adapts to your pace from day one.
              </p>
            </div>
            <div className="shape-circle shape-purple h-14 w-14" />
          </div>
          <div className="mt-6">
            <Link href="/auth/register" className={buttonClassName({ size: 'lg' })}>
              Create free account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </SectionContainer>
    </main>
  )
}
