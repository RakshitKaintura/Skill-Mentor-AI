'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, PhoneOff, AlertCircle } from 'lucide-react'
import type { useVapiInterview } from '@/hooks/useVapiInterview'

interface Props {
  vapiState: ReturnType<typeof useVapiInterview>
  onComplete: () => void
}

export function VocalInterviewPanel({ vapiState, onComplete }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [vapiState.transcript])

  // End call when Vapi call ends
  useEffect(() => {
    if (vapiState.callState === 'ended') {
      onComplete()
    }
  }, [vapiState.callState, onComplete])

  return (
    <div className="w-full max-w-full rounded-3xl overflow-hidden shadow-2xl bg-brand-surface border border-brand-border flex flex-col h-[600px]">
      
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-brand-border bg-brand-bg/50 backdrop-blur-md">
        <div>
          <h2 className="font-display font-black text-xl text-brand-text">Live Vocal Interview</h2>
          <p className="text-xs font-mono text-brand-muted uppercase tracking-widest mt-1">Powered by Vapi AI</p>
        </div>
        
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {vapiState.callState === 'active' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-green/10 border border-brand-green/30">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }} 
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-brand-green" 
              />
              <span className="text-xs font-mono text-brand-green font-bold">LIVE</span>
            </div>
          )}
          {vapiState.callState === 'loading' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-yellow/10 border border-brand-yellow/30">
              <div className="w-3 h-3 rounded-full border-2 border-brand-yellow border-t-transparent animate-spin" />
              <span className="text-xs font-mono text-brand-yellow font-bold">CONNECTING...</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        
        {/* Left: AI Orb & Controls */}
        <div className="md:w-1/3 p-6 flex flex-col justify-between items-center border-b md:border-b-0 md:border-r border-brand-border bg-black/20">
          
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {/* Pulsing Orb representing the AI Interviewer */}
            <div className="relative flex items-center justify-center w-32 h-32 mb-8">
              {vapiState.callState === 'active' && (
                <motion.div
                  animate={{
                    scale: vapiState.isAiSpeaking ? [1, 1.4, 1] : 1,
                    opacity: vapiState.isAiSpeaking ? [0.4, 0.8, 0.4] : 0.2
                  }}
                  transition={{ duration: vapiState.isAiSpeaking ? 1 : 0.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-brand-blue blur-xl"
                />
              )}
              <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-tr from-brand-blue/80 to-brand-green/80 flex items-center justify-center shadow-lg border border-white/10">
                <Mic className={`text-white w-8 h-8 ${vapiState.isAiSpeaking ? 'animate-pulse' : 'opacity-70'}`} />
              </div>
            </div>
            
            <p className="text-sm font-mono text-center text-brand-muted">
              {vapiState.callState === 'loading' ? 'Connecting to AI...' :
               vapiState.callState === 'active' ? (vapiState.isAiSpeaking ? 'AI is speaking...' : 'Listening...') :
               'Call ended.'}
            </p>
          </div>
          
          {/* Controls */}
          {vapiState.callState === 'active' && (
            <div className="flex gap-4 w-full justify-center mt-4">
              <button 
                onClick={vapiState.toggleMute}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-brand-surface border border-brand-border text-brand-text hover:bg-brand-border/50 transition-colors"
                title="Toggle Mute"
              >
                <MicOff className="w-5 h-5 opacity-70" />
              </button>
              
              <button 
                onClick={vapiState.endCall}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-brand-red/20 border border-brand-red/40 text-brand-red hover:bg-brand-red/30 transition-colors"
                title="End Interview"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
        
        {/* Right: Live Transcript */}
        <div className="md:w-2/3 flex flex-col h-full bg-brand-bg/30">
          <div className="px-4 py-2 border-b border-brand-border/50 bg-black/10">
            <h3 className="text-xs font-mono uppercase tracking-widest text-brand-muted font-bold">Live Transcript</h3>
          </div>
          
          <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4">
            {vapiState.transcript.length === 0 && vapiState.callState === 'active' && (
              <div className="h-full flex items-center justify-center text-brand-muted font-mono text-sm opacity-50">
                Waiting for speech...
              </div>
            )}
            
            {vapiState.transcript.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <span className="text-[10px] font-mono text-brand-muted uppercase mb-1 px-1">
                  {msg.role === 'ai' ? 'Interviewer' : 'You'}
                </span>
                <div 
                  className={`px-4 py-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-brand-blue text-white rounded-tr-sm' 
                      : 'bg-brand-surface border border-brand-border text-brand-text rounded-tl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Error Banner */}
      {vapiState.errorMsg && (
        <div className="px-6 py-3 bg-brand-red/10 border-t border-brand-red/30 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-brand-red mt-0.5 flex-shrink-0" />
          <p className="text-xs font-mono text-brand-red leading-relaxed">{vapiState.errorMsg}</p>
        </div>
      )}
    </div>
  )
}
