import Link from 'next/link'
import { ArrowRight, Brain, FileText, Globe, Mic, Zap } from 'lucide-react'
import Navbar from '@/components/ui/Navbar'
import Card from '@/components/ui/Card'
import SectionContainer from '@/components/ui/SectionContainer'
import { buttonClassName } from '@/components/ui/Button'

export default function HomePage() {
  const features = [
    {
      title: 'Personalized learning roadmap',
      description: 'Generate clear week-by-week learning plans aligned to your skill goals and current level.',
      Icon: Brain,
    },
    {
      title: 'Real-time voice guidance',
      description: 'Learn with spoken lessons and ask follow-up questions naturally while the lesson is running.',
      Icon: Mic,
    },
    {
      title: 'Context-aware doubt support',
      description: 'Get quick, structured explanations with examples whenever you are blocked.',
      Icon: Zap,
    },
    {
      title: 'Curriculum-grounded learning',
      description: 'Upload your learning material and get responses that stay aligned with your syllabus.',
      Icon: FileText,
    },
    {
      title: 'Always current content',
      description: 'Stay up to date with modern practices and evolving tools while learning.',
      Icon: Globe,
    },
    {
      title: 'Progress visibility',
      description: 'Track milestones and understand what to focus on next in a clear learning path.',
      Icon: ArrowRight,
    },
  ]

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-app-text-primary)]">
      <Navbar />

      <SectionContainer className="py-8 md:py-12">
        <section className="rounded-xl bg-[var(--color-app-surface)] p-6 shadow-sm ring-1 ring-[var(--color-app-border)] md:p-8">
          <p className="mb-2 text-sm text-[var(--color-app-primary)]">AI-powered skill development</p>
          <h1 className="mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Learn any skill with a clear plan and guided practice
          </h1>
          <p className="max-w-3xl text-base text-[var(--color-app-text-secondary)]">
            SkillMentor AI helps you move from confusion to confidence with structured lessons,
            personalized roadmaps, and daily practice designed for consistent progress.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href="/auth/register" className={buttonClassName({ size: 'lg' })}>
              Start learning
            </Link>
            <Link href="/auth/login" className={buttonClassName({ variant: 'secondary', size: 'lg' })}>
              Sign in
            </Link>
          </div>
        </section>
      </SectionContainer>

      <SectionContainer className="pb-8 md:pb-12">
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Platform capabilities</h2>
              <p className="mt-2 text-base text-[var(--color-app-text-secondary)]">
                Everything is organized in clean learning blocks so you can focus on outcomes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map(({ title, description, Icon }) => (
              <Card key={title}>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8f0fe] text-[var(--color-app-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-base text-[var(--color-app-text-secondary)]">{description}</p>
              </Card>
            ))}
          </div>
        </section>
      </SectionContainer>

      <SectionContainer className="pb-8 md:pb-12">
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-[var(--color-app-border)] md:p-8">
          <h2 className="text-2xl font-semibold">Ready to build momentum?</h2>
          <p className="mt-2 text-base text-[var(--color-app-text-secondary)]">
            Start your first guided roadmap and track progress from day one.
          </p>
          <div className="mt-6">
            <Link href="/auth/register" className={buttonClassName({ size: 'lg' })}>
              Create free account
            </Link>
          </div>
        </section>
      </SectionContainer>
    </main>
  )
}