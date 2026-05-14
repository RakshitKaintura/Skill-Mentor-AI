'use client'

// ── NotesLibraryClient ────────────────────────────────────────
// Client component that owns search + filter state for the /notes page.

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Search, X, Download, Sparkles, Trash2, Loader2, Tag, ExternalLink } from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import type { Note } from '@/hooks/useNotes'

// ── Props ────────────────────────────────────────────────────

interface Props {
  initialNotes: Note[]
  allSkills:    string[]
  allTags:      string[]
  userId:       string
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 100)
}

const SKILL_COLORS = ['#4FFFA0', '#5B8EFF', '#C77DFF', '#FFD166', '#FF6B6B', '#4ECDC4']

// ── NoteLibraryCard ───────────────────────────────────────────

function NoteLibraryCard({
  note, onDelete, onSummarize, isSummarizing, skillColor,
}: {
  note: Note
  onDelete: () => void
  onSummarize: () => void
  isSummarizing: boolean
  skillColor: string
}) {
  const [showSummary, setShowSummary] = useState(false)

  return (
    <div className="rounded-xl overflow-hidden transition-all hover:-translate-y-0.5"
      style={{
        border: '1px solid var(--color-app-border)',
        background: 'var(--color-app-surface)',
        borderLeft: `3px solid ${skillColor}`,
      }}>

      <div className="p-4">
        {/* Topic + step */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-xs font-bold truncate" style={{ color: skillColor }}>
              {note.topic}
            </p>
            {note.step_title && (
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-app-text-secondary)' }}>
                {note.step_title}
              </p>
            )}
          </div>
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--color-app-text-secondary)' }}>
            {formatDate(note.created_at)}
          </span>
        </div>

        {/* Content */}
        <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--color-app-text-primary)' }}>
          {note.content}
        </p>

        {/* AI Summary */}
        {note.ai_summary && (
          <div className="mt-2">
            <button onClick={() => setShowSummary(s => !s)}
              className="flex items-center gap-1 text-[10px] font-bold"
              style={{ color: '#C77DFF' }}>
              <Sparkles size={9} />
              {showSummary ? 'Hide' : 'Show'} AI Summary
            </button>
            {showSummary && (
              <div className="mt-1.5 rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap"
                style={{ background: '#C77DFF10', color: 'var(--color-app-text-secondary)', border: '1px solid #C77DFF25' }}>
                {note.ai_summary}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 pb-3">
        {note.lesson_id && (
          <Link href={`/lesson/current?lesson_id=${note.lesson_id}`}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
            style={{ background: `${skillColor}15`, color: skillColor, border: `1px solid ${skillColor}30` }}>
            <ExternalLink size={9} /> Open Lesson
          </Link>
        )}
        {!note.ai_summary && (
          <button onClick={onSummarize} disabled={isSummarizing}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg transition-all hover:opacity-80 disabled:opacity-40"
            style={{ background: '#C77DFF15', color: '#C77DFF', border: '1px solid #C77DFF30' }}>
            {isSummarizing ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
            Summarize
          </button>
        )}
        <button onClick={onDelete}
          className="ml-auto p-1.5 rounded-lg transition-all hover:bg-red-500/10 hover:text-red-500"
          style={{ color: 'var(--color-app-text-secondary)' }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export function NotesLibraryClient({ initialNotes, allSkills, allTags }: Props) {
  const { notes: hookNotes, summarizing, remove, summarize, exportMd } = useNotes()

  // Use hook notes if available (after mutations), else fall back to server-fetched
  const [localNotes, setLocalNotes] = useState<Note[]>(initialNotes)
  const notes = hookNotes.length > 0 ? hookNotes : localNotes

  const [search,      setSearch]      = useState('')
  const [activeSkill, setActiveSkill] = useState<string | null>(null)
  const [activeTag,   setActiveTag]   = useState<string | null>(null)

  // ── Client-side filter ───────────────────────────────────────
  const filtered = useMemo(() => {
    let result = notes
    if (activeSkill) result = result.filter(n => n.skill === activeSkill)
    if (activeTag)   result = result.filter(n => n.tags.includes(activeTag))
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(n =>
        n.content.toLowerCase().includes(q) ||
        n.topic.toLowerCase().includes(q) ||
        n.tags.some(t => t.includes(q))
      )
    }
    return result
  }, [notes, activeSkill, activeTag, search])

  // ── Group by skill ───────────────────────────────────────────
  const grouped = useMemo(() => {
    const map: Record<string, Note[]> = {}
    for (const n of filtered) {
      ;(map[n.skill] ??= []).push(n)
    }
    return map
  }, [filtered])

  const handleExportAll = useCallback(() => {
    const md = exportMd()
    if (!md) return
    downloadFile(md, `skill-mentor-notes-${new Date().toISOString().slice(0, 10)}.md`)
  }, [exportMd])

  const handleDelete = useCallback(async (id: string) => {
    await remove(id)
    setLocalNotes(prev => prev.filter(n => n.id !== id))
  }, [remove])

  return (
    <div>
      {/* Search + Export */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-app-text-secondary)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs outline-none"
            style={{
              background: 'var(--color-app-surface)',
              border: '1px solid var(--color-app-border)',
              color: 'var(--color-app-text-primary)',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100">
              <X size={12} />
            </button>
          )}
        </div>

        <button onClick={handleExportAll}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
          style={{ background: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
          <Download size={12} /> Export All
        </button>
      </div>

      {/* Skill filter chips */}
      {allSkills.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => setActiveSkill(null)}
            className="text-[11px] px-3 py-1 rounded-full font-semibold transition-all"
            style={{
              background: !activeSkill ? 'var(--color-app-primary)' : 'var(--color-app-border)',
              color:      !activeSkill ? '#fff' : 'var(--color-app-text-secondary)',
            }}>
            All skills
          </button>
          {allSkills.map((sk, i) => (
            <button key={sk} onClick={() => setActiveSkill(sk === activeSkill ? null : sk)}
              className="text-[11px] px-3 py-1 rounded-full font-semibold transition-all"
              style={{
                background: activeSkill === sk ? SKILL_COLORS[i % SKILL_COLORS.length] : 'var(--color-app-border)',
                color:      activeSkill === sk ? '#fff' : 'var(--color-app-text-secondary)',
              }}>
              {sk}
            </button>
          ))}
        </div>
      )}

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <span className="text-[10px] self-center" style={{ color: 'var(--color-app-text-secondary)' }}>
            <Tag size={10} className="inline mr-0.5" />Tags:
          </span>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setActiveTag(tag === activeTag ? null : tag)}
              className="text-[10px] px-2 py-0.5 rounded-full transition-all"
              style={{
                background: activeTag === tag ? '#5B8EFF20' : 'var(--color-app-border)',
                color:      activeTag === tag ? '#5B8EFF'   : 'var(--color-app-text-secondary)',
                border:     activeTag === tag ? '1px solid #5B8EFF40' : '1px solid transparent',
              }}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-12 rounded-2xl"
          style={{ border: '1px dashed var(--color-app-border)' }}>
          <p className="text-2xl mb-2">🔍</p>
          <p className="text-sm font-bold">No notes match your filters</p>
          <button onClick={() => { setSearch(''); setActiveSkill(null); setActiveTag(null) }}
            className="mt-3 text-xs underline" style={{ color: 'var(--color-app-primary)' }}>
            Clear filters
          </button>
        </div>
      )}

      {/* Notes grouped by skill */}
      {Object.entries(grouped).map(([skill, skillNotes]) => {
        const color = SKILL_COLORS[allSkills.indexOf(skill) % SKILL_COLORS.length]
        return (
          <div key={skill} className="mb-8">
            {/* Skill group header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <h2 className="font-display font-black text-base" style={{ color }}>
                  {skill}
                </h2>
                <span className="text-[11px]" style={{ color: 'var(--color-app-text-secondary)' }}>
                  {skillNotes.length} note{skillNotes.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {skillNotes.map(note => (
                <NoteLibraryCard
                  key={note.id}
                  note={note}
                  skillColor={color}
                  onDelete={() => handleDelete(note.id)}
                  onSummarize={() => summarize([note.id])}
                  isSummarizing={summarizing}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
