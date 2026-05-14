import Link from 'next/link'
import { notFound } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface VerifiedCertificate {
  full_name: string
  skill: string
  level: string
  issued_at: string
  xp_at_issue?: number
  lessons_count?: number
  projects_count?: number
  verify_code: string
}

export default async function VerifyCertPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params
  let cert: VerifiedCertificate | null = null
  try {
    const res  = await fetch(`${API}/api/career/certificate/verify/${resolvedParams.code}`, { cache: 'no-store' })
    const data = await res.json() as { valid?: boolean; certificate?: VerifiedCertificate }
    if (data.valid && data.certificate) cert = data.certificate
  } catch { /* not found */ }

  if (!cert) return notFound()

  const issueDate = new Date(cert.issued_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="text-xs font-mono text-brand-green uppercase tracking-widest mb-2">
            ✓ Certificate Verified
          </div>
          <div className="text-brand-text font-mono text-sm">
            This is a genuine SkillMentor AI certificate
          </div>
        </div>

        <div className="bg-brand-surface border border-brand-green/30 rounded-2xl p-8 text-center">
          <div className="text-brand-muted font-mono text-xs uppercase tracking-widest mb-4">Certificate of Completion</div>
          <div className="font-display font-black text-4xl text-brand-text mb-2">{cert.full_name}</div>
          <div className="text-brand-muted font-mono text-sm mb-4">has successfully completed</div>
          <div className="font-display font-bold text-2xl text-brand-green mb-2">
            {cert.skill} — {cert.level}
          </div>
          <div className="text-brand-muted font-mono text-xs mb-6">Issued: {issueDate}</div>

          <div className="grid grid-cols-3 gap-4 border border-brand-border rounded-lg p-4 mb-6">
            {[
              { label: 'XP Earned',  value: cert.xp_at_issue?.toLocaleString() ?? '0' },
              { label: 'Lessons',    value: cert.lessons_count ?? 0 },
              { label: 'Projects',   value: cert.projects_count ?? 0 },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="font-display font-black text-xl text-brand-green">{s.value}</div>
                <div className="text-brand-muted font-mono text-xs">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="text-brand-muted font-mono text-xs">
            Certificate ID: {cert.verify_code}
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-brand-blue font-mono text-sm hover:underline">
            ← Go to SkillMentor AI
          </Link>
        </div>
      </div>
    </div>
  )
}