export function ChecklistRow({ item, done, value }: { item: string; done: boolean; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-brand-border/50 last:border-0 group">
      <div className="flex items-center gap-3">
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
          done
            ? 'border-brand-green bg-brand-green shadow-[0_0_10px_#34a85355]'
            : 'border-brand-border bg-transparent'
        }`}>
          {done && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
        <span className={`font-mono text-sm ${done ? 'text-brand-text' : 'text-brand-muted'}`}>{item}</span>
      </div>
      <span className={`font-mono text-sm font-bold ${done ? 'text-brand-green' : 'text-brand-muted'}`}>{value}</span>
    </div>
  )
}
