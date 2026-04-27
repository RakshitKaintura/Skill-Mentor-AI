'use client'

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts'

export interface ActivityData {
  date: string
  lessons: number
}

interface Props {
  data: ActivityData[]
}

export default function ActivityChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-[var(--color-app-text-secondary)]">
        No recent activity
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorLessons" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4FFFA0" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#4FFFA0" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-app-border)" />
        <XAxis 
          dataKey="date" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: 'var(--color-app-text-secondary)' }}
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fontSize: 12, fill: 'var(--color-app-text-secondary)' }}
          allowDecimals={false}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'var(--color-app-surface)', 
            borderColor: 'var(--color-app-border)',
            borderRadius: '8px',
            color: 'var(--color-app-text-primary)'
          }} 
          itemStyle={{ color: '#4FFFA0', fontWeight: 'bold' }}
        />
        <Area 
          type="monotone" 
          dataKey="lessons" 
          stroke="#4FFFA0" 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorLessons)" 
          activeDot={{ r: 6, fill: '#4FFFA0', stroke: '#080B14', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
