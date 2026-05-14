'use client'

import { useState } from 'react'

interface Props {
  activityByDate: Record<string, number>
  className?: string
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

function intensityStyle(count: number) {
  if (count === 0) return { background: 'var(--color-app-border)', opacity: 0.4 }
  if (count === 1) return { background: '#4FFFA0', opacity: 0.35 }
  if (count === 2) return { background: '#4FFFA0', opacity: 0.6 }
  return { background: '#4FFFA0', opacity: 1.0 }
}

function toISODate(d: Date) {
  return d.toLocaleDateString('sv-SE')
}

function buildGrid(activityByDate: Record<string, number>) {
  const cells: { date: string; count: number }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = toISODate(d)
    cells.push({ date: dateStr, count: activityByDate[dateStr] ?? 0 })
  }
  return cells
}

export function StudyHeatmap({ activityByDate, className = '' }: Props) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const cells = buildGrid(activityByDate)
  const activeDays = cells.filter(c => c.count > 0).length
  const totalEvents = cells.reduce((s, c) => s + c.count, 0)

  const columns: typeof cells[] = []
  for (let col = 0; col < 12; col++) {
    columns.push(cells.slice(col * 7, col * 7 + 7))
  }

  const monthLabels: { month: string; col: number }[] = []
  let lastMonth = ''
  columns.forEach((col, i) => {
    const m = new Date(col[0]?.date ?? '').toLocaleDateString('en-US', { month: 'short' })
    if (m !== lastMonth) { monthLabels.push({ month: m, col: i }); lastMonth = m }
  })

  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}
      style={{ border: '1px solid var(--color-app-border)', background: 'var(--color-app-surface)' }}>

      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#4FFFA0' }}>
            Study Consistency
          </p>
          <p className="font-display font-black text-xl" style={{ letterSpacing: '-0.5px' }}>
            Activity Heatmap
          </p>
        </div>
        <div className="text-right">
          <p className="font-display font-black text-2xl" style={{ color: '#4FFFA0' }}>{activeDays}</p>
          <p className="text-xs" style={{ color: 'var(--color-app-text-secondary)' }}>
            active days · {totalEvents} events
          </p>
        </div>
      </div>

      <div className="px-5 pb-5 overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="flex mb-1 ml-7 gap-1">
            {columns.map((_, i) => {
              const label = monthLabels.find(l => l.col === i)
              return (
                <div key={i} className="flex-1" style={{ minWidth: 14 }}>
                  {label && (
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--color-app-text-secondary)' }}>
                      {label.month}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-1">
            {/* Day labels */}
            <div className="flex flex-col gap-1 mr-1">
              {DAY_LABELS.map((label, i) => (
                <div key={i} className="text-[10px] flex items-center justify-end"
                  style={{ height: 14, width: 24, color: 'var(--color-app-text-secondary)' }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Columns */}
            <div className="flex gap-1 flex-1">
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-1 flex-1" style={{ minWidth: 14 }}>
                  {col.map((cell, ri) => {
                    const s = intensityStyle(cell.count)
                    const isFuture = new Date(cell.date) > new Date()
                    return (
                      <div key={ri}
                        className="rounded-sm cursor-default transition-transform hover:scale-125"
                        style={{
                          height: 14,
                          background: isFuture ? 'transparent' : s.background,
                          opacity: isFuture ? 0.1 : s.opacity,
                          border: isFuture ? '1px dashed var(--color-app-border)' : 'none',
                        }}
                        onMouseEnter={e => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect()
                          const dl = new Date(cell.date).toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric'
                          })
                          setTooltip({
                            text: cell.count === 0 ? `${dl} — no activity` : `${dl} — ${cell.count} event${cell.count > 1 ? 's' : ''}`,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          })
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {tooltip && (
            <div className="fixed z-50 px-2 py-1 rounded-md text-xs pointer-events-none shadow-lg"
              style={{
                top: tooltip.y - 34, left: tooltip.x,
                background: 'var(--color-app-surface)',
                border: '1px solid var(--color-app-border)',
                color: 'var(--color-app-text-primary)',
                transform: 'translateX(-50%)', whiteSpace: 'nowrap',
              }}>
              {tooltip.text}
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-3 justify-end">
            <span className="text-[10px]" style={{ color: 'var(--color-app-text-secondary)' }}>Less</span>
            {[0, 1, 2, 3].map(l => {
              const s = intensityStyle(l)
              return <div key={l} className="rounded-sm" style={{ width: 12, height: 12, background: s.background, opacity: s.opacity }} />
            })}
            <span className="text-[10px]" style={{ color: 'var(--color-app-text-secondary)' }}>More</span>
          </div>
        </div>
      </div>
    </div>
  )
}
