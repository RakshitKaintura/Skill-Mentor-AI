export function ActionButton({
  icon,
  title,
  desc,
  onClick,
  accentClass,
}: {
  icon: string
  title: string
  desc: string
  onClick: () => void
  accentClass: string
}) {
  return (
    <button
      onClick={onClick}
      className={`neo-surface tilt-card rounded-2xl p-6 text-left w-full group transition-all border-2 border-transparent hover:border-current ${accentClass}`}
    >
      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">{icon}</div>
      <div className="font-display font-bold text-base mb-1 text-brand-text">{title}</div>
      <div className="text-xs font-mono text-brand-muted leading-relaxed">{desc}</div>
    </button>
  )
}
