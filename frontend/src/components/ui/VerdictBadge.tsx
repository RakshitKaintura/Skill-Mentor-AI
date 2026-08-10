export function VerdictBadge({ verdict }: { verdict: string }) {
  const map: Record<string, string> = {
    'Ready': 'bg-brand-green/10 text-brand-green border-brand-green/30',
    'Needs Work': 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/30',
    'Major Revisions': 'bg-brand-red/10 text-brand-red border-brand-red/30',
  }
  const cls = map[verdict] ?? 'bg-brand-blue/10 text-brand-blue border-brand-blue/30'
  return (
    <span className={`inline-block text-xs font-mono font-bold px-3 py-1 rounded-full border ${cls}`}>
      {verdict}
    </span>
  )
}
