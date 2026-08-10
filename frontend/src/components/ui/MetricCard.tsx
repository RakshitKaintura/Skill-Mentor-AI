// --- Mini metric ring ---
function MiniRing({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  const size = 52
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const filled = circ * (pct / 100)
  return (
    <svg width={size} height={size} className="rotate-[-90deg] flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-app-border)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  )
}

export function MetricCard({
  label,
  value,
  sub,
  color,
  icon,
  max = 100,
}: {
  label: string
  value: number
  sub: string
  color: string
  icon: string
  max?: number
}) {
  return (
    <div className="neo-surface rounded-2xl p-5 tilt-card flex items-center gap-4">
      <div className="relative">
        <MiniRing value={value} max={max} color={color} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg" style={{ transform: 'rotate(90deg)' }}>{icon}</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="font-display font-black text-2xl leading-none" style={{ color }}>
          {value.toFixed(0)}<span className="text-sm text-brand-muted font-mono">{sub}</span>
        </div>
        <div className="text-xs font-mono text-brand-muted mt-1 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  )
}
