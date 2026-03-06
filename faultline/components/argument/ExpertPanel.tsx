'use client'

import type { QBAFStrength } from '@/lib/argument/types'

const EXPERT_COLORS = [
  'bg-accent/80',
  'bg-foreground/80',
  'bg-accent/40',
  'bg-foreground/40',
  'bg-accent/60',
]

interface ExpertPanelProps {
  experts: string[]
  taskDescription?: string[]
  strengths?: QBAFStrength[]
  phase?: string
}

export function ExpertPanel({ experts, taskDescription, strengths, phase }: ExpertPanelProps) {
  if (experts.length === 0) return null

  const activePhases = new Set(['starting', 'experts', 'arguments', 'building'])
  const isActive = phase ? activePhases.has(phase) : false

  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-4">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Expert Panel</h2>

      {taskDescription && taskDescription.length > 0 && (
        <p className="text-[10px] text-muted mb-3 leading-relaxed">{taskDescription.join(' \u2022 ')}</p>
      )}

      <div className="space-y-2.5">
        {experts.map((expert, i) => {
          const initial = expert.charAt(0).toUpperCase()
          const colorClass = EXPERT_COLORS[i % EXPERT_COLORS.length]
          const strength = strengths?.find(s => s.expert === expert)

          return (
            <div key={i} className="flex items-start gap-2.5">
              <div className="relative flex-shrink-0">
                <span className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-foreground ${colorClass}`}>
                  {initial}
                </span>
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground font-medium leading-snug block truncate">{expert}</span>
                {strength && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {strength.initial_score !== null && (
                      <span className="text-[10px] font-mono text-muted">{'\u03C4'}={strength.initial_score.toFixed(2)}</span>
                    )}
                    {strength.final_score !== null && (
                      <span className="text-[10px] font-mono text-accent">{'\u03C3'}={strength.final_score.toFixed(2)}</span>
                    )}
                    {strength.initial_score !== null && strength.final_score !== null && (
                      <span className={`text-[10px] font-mono font-semibold ${
                        strength.final_score >= strength.initial_score ? 'text-foreground' : 'text-accent'
                      }`}>
                        {strength.final_score >= strength.initial_score ? '+' : ''}
                        {(strength.final_score - strength.initial_score).toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
