'use client'

import { useEffect, useState, useRef } from 'react'

export type AgentType = 'Roadmap Architect' | 'Lesson Teacher' | 'Doubt Solver'

interface Props {
  agentName: AgentType
}

const ROADMAP_LOGS = [
  "[System] Initializing Roadmap Architect Agent...",
  "[Data] Parsing user profile and skill baseline...",
  "[Search] Querying Gemini 3.1 Flash Lite knowledge base...",
  "[Analysis] Identifying cross-disciplinary dependencies...",
  "[Synthesis] Structuring optimal weekly progression...",
  "[Validation] Checking timeline constraints against syllabus...",
  "[Build] Assembling final phase modules...",
  "[Done] Roadmap blueprint finalized. Handing off to UI..."
]

const LESSON_LOGS = [
  "[System] Waking up Lesson Teacher Agent...",
  "[Context] Retrieving current phase and topic objectives...",
  "[Search] Gathering optimal analogies and code examples...",
  "[Generative] Drafting comprehensive explanation...",
  "[Formatting] Applying Markdown styles and syntax highlighting...",
  "[Quiz] Generating inline verification questions...",
  "[Done] Lesson package assembled."
]

const DOUBT_LOGS = [
  "[System] Initializing Doubt Solver Agent...",
  "[Context] Analyzing user context and previous lesson data...",
  "[Processing] Isolating the core conceptual misunderstanding...",
  "[Generative] Formulating targeted explanation...",
  "[Analogy] Crafting relatable real-world comparison...",
  "[Done] Doubt resolved. Sending payload..."
]

export function AgenticTerminal({ agentName }: Props) {
  const [logs, setLogs] = useState<string[]>([])
  const [isTyping, setIsTyping] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  const logSequence = 
    agentName === 'Roadmap Architect' ? ROADMAP_LOGS : 
    agentName === 'Lesson Teacher' ? LESSON_LOGS : 
    DOUBT_LOGS

  useEffect(() => {
    setLogs([])
    setIsTyping(true)
    let timeoutIds: NodeJS.Timeout[] = []
    let currentIdx = 0

    const streamNextLog = () => {
      if (currentIdx < logSequence.length) {
        setLogs(prev => [...prev, logSequence[currentIdx]])
        currentIdx++
        
        if (currentIdx < logSequence.length) {
          // Random delay between 400ms and 1500ms to simulate AI thinking
          const delay = Math.floor(Math.random() * 1100) + 400
          const id = setTimeout(streamNextLog, delay)
          timeoutIds.push(id)
        } else {
          setIsTyping(false)
        }
      }
    }

    // Start streaming after a tiny initial delay
    const initialId = setTimeout(streamNextLog, 300)
    timeoutIds.push(initialId)

    return () => {
      timeoutIds.forEach(clearTimeout)
    }
  }, [agentName, logSequence])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg overflow-hidden border border-[#1e2a42] bg-[#080b14] shadow-2xl text-left font-mono text-sm">
      {/* Terminal Header */}
      <div className="flex items-center px-4 py-2 bg-[#0e1420] border-b border-[#1e2a42]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        <div className="mx-auto text-xs text-[#6b7a99] uppercase tracking-widest font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#4FFFA0] animate-pulse"></span>
          {agentName}
        </div>
      </div>
      
      {/* Terminal Body */}
      <div className="p-5 h-[220px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e2a42 #080b14' }}>
        <div className="flex flex-col gap-2">
          <div className="text-[#6b7a99] mb-2">
            SkillMentor OS v4.0.0 <br/>
            Engine: Gemini 3.1 Flash Lite <br/>
            Connection: Secured
          </div>
          
          {logs.map((log, i) => {
            if (!log) return null
            const isDone = log.startsWith('[Done]')
            const tagMatch = log.match(/^\[(.*?)\]/)
            const tag = tagMatch ? tagMatch[0] : ''
            const msg = tagMatch ? log.replace(tag, '').trim() : log

            return (
              <div key={i} className="flex gap-3 animate-fade-up" style={{ animationDuration: '0.3s' }}>
                <span className="text-[#5B8EFF] shrink-0">{'>'}</span>
                <span className="break-all">
                  {tag && <span className={isDone ? "text-[#4FFFA0]" : "text-[#C77DFF]"}>{tag} </span>}
                  <span className={isDone ? "text-[#E8EDF8]" : "text-[#A0ABC0]"}>{msg}</span>
                </span>
              </div>
            )
          })}
          
          {isTyping && (
            <div className="flex gap-3 mt-1">
              <span className="text-[#5B8EFF]">{'>'}</span>
              <span className="w-2 h-4 bg-[#4FFFA0] animate-pulse"></span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  )
}
