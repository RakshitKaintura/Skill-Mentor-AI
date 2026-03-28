// Week 5 — Audio, Daily Challenges, Study Buddy, Notifications

export interface TtsSegment {
  id:           number
  type:         'intro' | 'concept' | 'example' | 'tip' | 'summary' | 'transition'
  text:         string
  duration_secs: number
  emphasis:     boolean
}

export interface VoiceConfig {
  lang:              string
  rate:              number
  pitch:             number
  volume:            number
  preferred_voices:  string[]
}

export interface Language {
  code: string
  name: string
}

export interface DailyChallenge {
  challenge_id:       string
  title:              string
  description:        string
  type:               'quiz' | 'code' | 'theory' | 'review'
  xp_reward:          number
  estimated_minutes:  number
  content:            Record<string, unknown>
  completed:          boolean
  challenge_date:     string
}

export interface Notification {
  id:         string
  type:       'streak' | 'reminder' | 'achievement' | 'report' | 'challenge' | 'buddy'
  title:      string
  message:    string
  read:       boolean
  action_url: string
  created_at: string
}

export interface StudyBuddySession {
  id:             string
  host_user_id:   string
  guest_user_id:  string | null
  skill:          string
  session_code:   string
  status:         'waiting' | 'active' | 'completed'
  host_score:     number | null
  guest_score:    number | null
  started_at:     string | null
}