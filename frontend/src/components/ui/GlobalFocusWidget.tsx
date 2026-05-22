'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { FocusTimer } from '@/components/ui/FocusTimer'
import { usePomodoro } from '@/hooks/usePomodoro'

export function GlobalFocusWidget() {
  const pomodoro = usePomodoro()
  const isActive = pomodoro.phase !== 'idle'
  const shouldShow = pomodoro.isWidgetOpen || isActive

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div 
          drag
          dragMomentum={false}
          className={`fixed z-[100] ${pomodoro.isWidgetMinimized ? '' : 'w-[320px] shadow-[0_20px_40px_rgba(0,0,0,0.2)] rounded-2xl'}`}
          style={{ top: 80, right: 24 }}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          <FocusTimer 
            isMinimized={pomodoro.isWidgetMinimized}
            onToggleMinimize={() => pomodoro.toggleMinimize()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
