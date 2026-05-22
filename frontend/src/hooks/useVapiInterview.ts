import { useState, useEffect, useRef } from 'react'
import Vapi from '@vapi-ai/web'
import type { InterviewSession } from '@/types/week4'

// Ensure we only instantiate Vapi once per client to avoid multiple audio contexts
let vapiInstance: Vapi | null = null

export type VapiCallState = 'idle' | 'loading' | 'active' | 'ended' | 'error'

export interface TranscriptMessage {
  role: 'ai' | 'user'
  text: string
  timestamp: number
}

export function useVapiInterview() {
  const [callState, setCallState] = useState<VapiCallState>('idle')
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // Track active speech status for UI animations (e.g., orb pulsing)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isUserSpeaking, setIsUserSpeaking] = useState(false)
  
  // Ref to hold the current transcript so we can access it when the call ends
  const transcriptRef = useRef<TranscriptMessage[]>([])

  useEffect(() => {
    // Only initialize Vapi if we have a public key and are on the client
    const apiKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
    if (typeof window !== 'undefined' && apiKey && !vapiInstance) {
      try {
        vapiInstance = new Vapi(apiKey)
      } catch (err) {
        console.error("Failed to initialize Vapi:", err)
      }
    }

    if (!vapiInstance) return

    // Set up event listeners
    const onCallStart = () => {
      setCallState('active')
      setIsAiSpeaking(false)
      setIsUserSpeaking(false)
    }

    const onCallEnd = () => {
      setCallState('ended')
      setIsAiSpeaking(false)
      setIsUserSpeaking(false)
    }

    const onError = (e: any) => {
      console.error('Vapi Error:', e)
      setErrorMsg(e?.message || 'An error occurred during the voice call.')
      setCallState('error')
      setIsAiSpeaking(false)
      setIsUserSpeaking(false)
    }

    const onMessage = (message: any) => {
      // Handle transcript messages from the Vapi service
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        const newMsg: TranscriptMessage = {
          role: message.role === 'assistant' ? 'ai' : 'user',
          text: message.transcript,
          timestamp: Date.now()
        }
        
        setTranscript(prev => {
          const updated = [...prev, newMsg]
          transcriptRef.current = updated
          return updated
        })
      }
      
      // Handle speech state for UI feedback
      if (message.type === 'speech-update') {
        if (message.role === 'assistant') {
          setIsAiSpeaking(message.status === 'started')
        }
      }
    }
    
    // We can also use Vapi's built in volume level events if needed
    const onVolumeLevel = (level: number) => {
      // Basic heuristic: if level > threshold, user is probably speaking
      // Vapi provides better ways, but this is a fallback if needed
      if (level > 0.05) setIsUserSpeaking(true)
      else setIsUserSpeaking(false)
    }

    vapiInstance.on('call-start', onCallStart)
    vapiInstance.on('call-end', onCallEnd)
    vapiInstance.on('error', onError)
    vapiInstance.on('message', onMessage)
    vapiInstance.on('volume-level', onVolumeLevel)

    return () => {
      if (vapiInstance) {
        vapiInstance.off('call-start', onCallStart)
        vapiInstance.off('call-end', onCallEnd)
        vapiInstance.off('error', onError)
        vapiInstance.off('message', onMessage)
        vapiInstance.off('volume-level', onVolumeLevel)
      }
    }
  }, [])

  const startCall = async (session: InterviewSession) => {
    if (!vapiInstance) {
      setErrorMsg('Voice AI is not initialized. Check your VAPI API key.')
      setCallState('error')
      return
    }

    try {
      setCallState('loading')
      setTranscript([])
      transcriptRef.current = []
      setErrorMsg(null)

      // Build the system prompt instructing the AI how to conduct the interview
      const questionsList = session.questions
        .map((q, i) => `Q${i + 1}: ${q.question}`)
        .join('\n')

      const systemPrompt = `You are a professional ${session.interview_type} interviewer conducting a mock interview for a ${session.level} ${session.skill} role. Target company context: ${session.company_target}.
      
You must conduct the interview naturally, asking the following questions one by one:
${questionsList}

RULES:
1. Start by welcoming the candidate and immediately asking Question 1.
2. Wait for the candidate to answer before moving to the next question.
3. Keep your responses short and professional. Do NOT give them the answers or evaluate their answers yet. Just acknowledge their response and move to the next question.
4. If they ask for clarification, provide a brief hint.
5. After all questions have been asked and answered, politely conclude the interview and say "We will now evaluate your results." and end the conversation.`

      // Start the Vapi call using a basic web configuration
      await vapiInstance.start({
        model: {
          provider: 'openai',
          model: 'gpt-4o', // Or whichever model you prefer
          messages: [
            {
              role: 'system',
              content: systemPrompt
            }
          ]
        },
        voice: {
          provider: '11labs',
          voiceId: 'bIHbv24MWmeRgasZH58o' // Use a professional voice ID (this is a default 11labs voice)
        }
      })
    } catch (err: any) {
      console.error('Failed to start Vapi call:', err)
      setErrorMsg(err?.message || 'Failed to start the microphone.')
      setCallState('error')
    }
  }

  const endCall = () => {
    if (vapiInstance && (callState === 'active' || callState === 'loading')) {
      vapiInstance.stop()
      setCallState('ended')
    }
  }
  
  const toggleMute = () => {
    if (vapiInstance && callState === 'active') {
      vapiInstance.setMuted(!vapiInstance.isMuted())
    }
  }

  return {
    callState,
    transcript,
    errorMsg,
    isAiSpeaking,
    isUserSpeaking,
    startCall,
    endCall,
    toggleMute,
    getTranscriptText: () => {
      // Helper to convert the transcript into a single string for evaluation
      return transcriptRef.current
        .map(msg => `${msg.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${msg.text}`)
        .join('\n')
    }
  }
}
