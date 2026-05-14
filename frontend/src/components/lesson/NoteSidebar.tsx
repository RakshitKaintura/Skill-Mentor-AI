'use client'

// ── NoteSidebar ───────────────────────────────────────────────
// Slide-over panel for in-lesson note taking.
// Fixed right overlay — doesn't shift lesson layout.

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X, Plus, Download, Sparkles, Trash2,
  Tag, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useNotes, type Note } from '@/hooks/useNotes'

// ── Props ────────────────────────────────────────────────────

interface Props {
  open:       boolean
  onClose:    () => void
  lessonId:   string | null
  roadmapId:  string
  skill:      string
  topic:      string
  stepIndex:  number        // currently active step
  stepTitle:  string        // currently active step title
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a); a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 100)
}

// ── NoteCard ──────────────────────────────────────────────────

function NoteCard({
  note, onDelete, onSummarize, isSummarizing,
}: {
  note: Note
  onDelete: () => void
  onSummarize: () => void
  isSummarizing: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const stepColor = note.step_index !== null ? '#5B8EFF' : '#C77DFF'

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-app-border)', background: 'var(--color-app-surface)' }}>

      {/* Step badge */}
      {note.step_title && (
        <div className="px-3 pt-2.5 pb-0">
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: `${stepColor}15`, color: stepColor, border: `1px solid ${stepColor}30` }}>
            {note.step_title}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="px-3 pt-2 pb-0">
        <p className="text-xs leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--color-app-text-primary)' }}>
          {note.content.length > 120 && !expanded
            ? note.content.slice(0, 120) + '…'
            : note.content}
        </p>
        {note.content.length > 120 && (
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-0.5 mt-1 text-[10px] opacity-60 hover:opacity-100"
            style={{ color: 'var(--color-app-primary)' }}>
            {expanded ? <><ChevronUp size={10} />Less</> : <><ChevronDown size={10} />More</>}
          </button>
        )}
      </div>

      {/* AI Summary */}
      {note.ai_summary && (
        <div className="mx-3 mt-2 rounded-lg px-3 py-2"
          style={{ background: 'color-mix(in oklab, #C77DFF 8%, var(--color-app-surface))', border: '1px solid #C77DFF30' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#C77DFF' }}>
            ✨ AI Summary
          </p>
          <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-app-text-secondary)' }}>
            {note.ai_summary}
          </p>
        </div>
      )}

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 mt-2">
          {note.tags.map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 mt-1">
        <span className="text-[10px]" style={{ color: 'var(--color-app-text-secondary)' }}>
          {formatDate(note.created_at)}
        </span>
        <div className="flex items-center gap-1.5">
          {!note.ai_summary && (
            <button onClick={onSummarize} disabled={isSummarizing}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-all hover:opacity-80 disabled:opacity-40"
              style={{ background: '#C77DFF15', color: '#C77DFF', border: '1px solid #C77DFF30' }}>
              {isSummarizing ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
              {isSummarizing ? 'Summarizing…' : 'Summarize'}
            </button>
          )}
          <button onClick={onDelete}
            className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 hover:text-red-500"
            style={{ color: 'var(--color-app-text-secondary)' }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function NoteSidebar({
  open, onClose, lessonId, roadmapId, skill, topic, stepIndex, stepTitle,
}: Props) {
  const { notes, loading, saving, summarizing, fetchNotes, create, remove, summarize, exportMd } = useNotes()

  const [content,  setContent]  = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags,     setTags]     = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch lesson notes when sidebar opens
  useEffect(() => {
    if (open && lessonId) {
      fetchNotes({ lessonId })
    }
  }, [open, lessonId, fetchNotes])

  // Focus textarea when open
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 200)
  }, [open])

  const handleAddTag = useCallback(() => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags(prev => [...prev, t])
      setTagInput('')
    }
  }, [tagInput, tags])

  const handleSave = useCallback(async () => {
    if (!content.trim()) return
    await create({
      lesson_id:  lessonId,
      roadmap_id: roadmapId,
      skill, topic,
      step_index: stepIndex,
      step_title: stepTitle || undefined,
      content:    content.trim(),
      tags,
    })
    setContent(''); setTags([])
  }, [content, create, lessonId, roadmapId, skill, topic, stepIndex, stepTitle, tags])

  const handleExport = useCallback(() => {
    const md = exportMd()
    if (!md) return
    const filename = `${topic.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-notes.md`
    downloadFile(md, filename)
  }, [exportMd, topic])

  const handleSummarizeAll = useCallback(async () => {
    if (notes.length === 0) return
    await summarize(notes.map(n => n.id))
  }, [notes, summarize])

  const lessonNotes = notes.filter(n => !lessonId || n.lesson_id === lessonId)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(8,11,20,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-hidden transition-transform duration-300"
        style={{
          width: 360,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          background: 'var(--color-app-surface)',
          borderLeft: '1px solid var(--color-app-border)',
          boxShadow: open ? '-8px 0 40px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-app-border)' }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#5B8EFF' }}>
              📝 Notes
            </p>
            <p className="font-display font-black text-sm truncate" style={{ letterSpacing: '-0.3px' }}>
              {topic}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {lessonNotes.length > 0 && (
              <button onClick={handleExport}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
                style={{ background: 'var(--color-app-border)', color: 'var(--color-app-text-secondary)' }}>
                <Download size={10} /> Export .md
              </button>
            )}
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:opacity-70 transition-all"
              style={{ color: 'var(--color-app-text-secondary)' }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Active step context */}
        {stepTitle && (
          <div className="px-4 py-2 flex-shrink-0"
            style={{ background: 'color-mix(in oklab, var(--color-app-surface-cool) 50%, var(--color-app-surface) 50%)' }}>
            <span className="text-[10px]" style={{ color: 'var(--color-app-text-secondary)' }}>
              Currently on: </span>
            <span className="text-[10px] font-bold" style={{ color: '#5B8EFF' }}>{stepTitle}</span>
          </div>
        )}

        {/* Compose area */}
        <div className="px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-app-border)' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
            }}
            placeholder="Type your note here… (Ctrl+Enter to save)"
            rows={4}
            className="w-full text-xs rounded-xl px-3 py-2.5 resize-none outline-none transition-colors"
            style={{
              background: 'var(--color-app-bg)',
              border: '1px solid var(--color-app-border)',
              color: 'var(--color-app-text-primary)',
            }}
          />

          {/* Tag input */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {tags.map(t => (
              <span key={t}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full cursor-pointer hover:opacity-70"
                style={{ background: '#5B8EFF18', color: '#5B8EFF', border: '1px solid #5B8EFF30' }}
                onClick={() => setTags(prev => prev.filter(x => x !== t))}>
                #{t} ×
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Tag size={10} style={{ color: 'var(--color-app-text-secondary)' }} />
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleAddTag() } }}
                placeholder="add tag…"
                className="text-[11px] outline-none bg-transparent"
                style={{ color: 'var(--color-app-text-secondary)', width: 70 }}
              />
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!content.trim() || saving}
            className="flex items-center gap-1.5 w-full justify-center mt-3 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--color-app-primary)', color: '#fff' }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-app-text-secondary)' }} />
            </div>
          )}

          {!loading && lessonNotes.length === 0 && (
            <div className="text-center py-10">
              <p className="text-2xl mb-2">📓</p>
              <p className="text-xs font-bold">No notes yet</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--color-app-text-secondary)' }}>
                Start typing above to capture your thoughts
              </p>
            </div>
          )}

          {!loading && lessonNotes.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--color-app-text-secondary)' }}>
                  {lessonNotes.length} note{lessonNotes.length !== 1 ? 's' : ''}
                </p>
                {lessonNotes.length >= 2 && (
                  <button onClick={handleSummarizeAll} disabled={summarizing}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg transition-all hover:opacity-80 disabled:opacity-40"
                    style={{ background: '#C77DFF15', color: '#C77DFF', border: '1px solid #C77DFF30' }}>
                    {summarizing ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
                    {summarizing ? 'Summarizing…' : 'Summarize All'}
                  </button>
                )}
              </div>

              {lessonNotes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onDelete={() => remove(note.id)}
                  onSummarize={() => summarize([note.id])}
                  isSummarizing={summarizing}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}
