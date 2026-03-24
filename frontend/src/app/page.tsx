import Link from 'next/link'
import { ArrowRight, Mic, Brain, Code2, Globe, FileText, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function HomePage() {
  return (
    <main className="relative min-h-screen">
      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center overflow-hidden">
        {/* Aesthetic radial glow */}
        <div 
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[420px] rounded-full pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(ellipse, var(--color-brand-green) 0%, transparent 70%)' }} 
        />

        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-sm text-xs tracking-widest uppercase border border-brand-green/25 bg-brand-green/10 text-brand-green">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-blink" />
            AI-Powered Learning Platform · 2026
          </span>
        </div>

        <h1 
          className="font-display font-black mt-6 animate-fade-up text-brand-text tracking-tighter"
          style={{ fontSize: 'clamp(52px, 10vw, 108px)', lineHeight: '0.9' }}
        >
          <span className="block">Learn Any</span>
          <span className="block gradient-text">Skill.</span>
          <span className="block">Master It.</span>
        </h1>

        <p className="mt-8 max-w-lg text-sm leading-relaxed animate-fade-up text-brand-muted">
          Your personal AI teacher that builds a custom roadmap, teaches with real-time voice, 
          solves doubts 24/7, and learns from <em className="text-brand-text">your own textbooks</em> — 
          powered by Gemini 3.1 Flash Lite Preview.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 animate-fade-up">
          <Link 
            href="/auth/register"
            className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-sm font-display font-bold text-sm bg-brand-green text-brand-bg hover:scale-[1.02] transition-transform"
          >
            Start Learning Free <ArrowRight size={15} />
          </Link>
          <Link 
            href="/auth/login"
            className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-sm font-display font-bold text-sm border border-brand-border text-brand-text hover:bg-white/5 transition-colors"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-16 flex items-center gap-10 animate-fade-up">
          {[
            { n: '12', l: 'AI Agents', c: 'text-brand-green' },
            { n: '5+', l: 'Knowledge Sources', c: 'text-brand-blue' },
            { n: '∞', l: 'Skills to Learn', c: 'text-brand-purple' },
          ].map(s => (
            <div key={s.l} className="text-center">
              <div className={cn("font-display font-black text-4xl", s.c)}>{s.n}</div>
              <div className="text-[10px] mt-1 tracking-widest uppercase text-brand-muted font-bold">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-px bg-brand-green" />
          <span className="text-xs tracking-widest uppercase text-brand-green font-bold">Features</span>
        </div>
        
        <h2 
          className="font-display font-black mb-12 tracking-tight text-brand-text"
          style={{ fontSize: 'clamp(28px, 5vw, 48px)' }}
        >
          Everything a Real Teacher Does
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            { Icon: Brain, color: 'text-brand-green', bg: 'bg-brand-green/10', border: 'border-brand-green/20', title: 'Personalized AI Roadmap', desc: 'Tell the AI your skill and goal. It builds a week-by-week learning plan aligned to your curriculum and uploads.' },
            { Icon: Mic, color: 'text-brand-blue', bg: 'bg-brand-blue/10', border: 'border-brand-blue/20', title: 'Real-Time Voice Lessons', desc: 'Gemini Live API teaches out loud. Interrupt mid-lesson with questions — it stops, explains, then continues.' },
            { Icon: Code2, color: 'text-brand-yellow', bg: 'bg-brand-yellow/10', border: 'border-brand-yellow/20', title: 'In-Browser Code Playground', desc: 'WebContainers runs real Node.js code inside the browser. No setup, no deployment — just code and learn.' },
            { Icon: Zap, color: 'text-brand-purple', bg: 'bg-brand-purple/10', border: 'border-brand-purple/20', title: '24/7 Doubt Solver', desc: 'Ask any question at any time. Get a plain explanation + analogy + code example simultaneously.' },
            { Icon: FileText, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', title: 'Your Books as Knowledge', desc: 'Upload your university textbook or syllabus. The AI teaches from your exact curriculum — same examples your professor uses.' },
            { Icon: Globe, color: 'text-brand-green', bg: 'bg-brand-green/10', border: 'border-brand-green/20', title: 'Always Up-to-Date', desc: 'Official docs + live web search means every lesson reflects 2026 best practices automatically.' },
          ].map(({ Icon, color, bg, border, title, desc }) => (
            <div key={title} className="glass-card p-6 flex gap-4 hover:border-brand-muted/50 transition-colors">
              <div className={cn("w-10 h-10 rounded-sm flex items-center justify-center border", bg, border)}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm mb-2 text-brand-text">{title}</h3>
                <p className="text-xs leading-relaxed text-brand-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto glass-card p-12 border-brand-green/20">
          <h2 className="font-display font-black text-4xl mb-4 tracking-tighter">
            Ready to start learning?
          </h2>
          <p className="text-sm mb-8 text-brand-muted">
            Tell the AI what you want to learn. Your personal teacher will be ready in seconds.
          </p>
          <Link 
            href="/auth/register"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-sm font-display font-bold text-sm bg-brand-green text-brand-bg hover:scale-105 transition-transform"
          >
            Get Started Free <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-brand-border px-6 py-10 text-center">
        <div className="font-display font-black text-xl gradient-text mb-2">SkillMentor AI</div>
        <p className="text-[10px] tracking-widest uppercase text-brand-muted font-bold">
          Built with Gemini 3.1 Flash Lite Preview · Supabase · Next.js 16
        </p>
      </footer>
    </main>
  )
}