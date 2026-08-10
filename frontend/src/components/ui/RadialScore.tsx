export function RadialScore({
  score,
  size = 180,
  label,
  color,
}: {
  score: number
  size?: number
  label?: string
  color: string
}) {
  const r = (size - 18) / 2
  const circ = 2 * Math.PI * r
  const filled = circ * (score / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg] absolute inset-0">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-app-border)" strokeWidth={12} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={12}
            strokeDasharray={`${filled} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 8px ${color}55)` }}
          />
        </svg>
        <div className="flex flex-col items-center justify-center z-10">
          <span className="font-display font-black text-5xl leading-none" style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-brand-muted font-mono">/ 100</span>
        </div>
      </div>
      {label && <span className="text-xs font-mono text-brand-muted uppercase tracking-widest">{label}</span>}
    </div>
  )
}
