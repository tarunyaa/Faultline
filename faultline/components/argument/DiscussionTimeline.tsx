'use client'

import type { MainArgument, QBAFStrength } from '@/lib/argument/types'

interface DiscussionTimelineProps {
  mainArguments: MainArgument[]
  qbafStrengths: QBAFStrength[]
  phase: string
}

function strengthFor(statement: string, strengths: QBAFStrength[]): QBAFStrength | undefined {
  return strengths.find(s => s.statement === statement)
}

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (score === null) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted">
      <span className="text-foreground font-mono">{score.toFixed(3)}</span>
      <span>{label}</span>
    </span>
  )
}

interface ArgumentRowProps {
  statement: string
  experts: string[]
  strength?: QBAFStrength
  depth: number
  isAttack?: boolean
}

function ArgumentRow({ statement, experts, strength, depth, isAttack }: ArgumentRowProps) {
  const indent = depth * 16

  const borderColor = isAttack ? 'border-accent' : 'border-card-border'
  const labelColor = isAttack ? 'text-accent' : 'text-muted'
  const labelText = depth === 0 ? 'MAIN' : isAttack ? 'ATTACK' : 'SUPPORT'

  return (
    <div style={{ paddingLeft: `${indent}px` }} className="group">
      <div className={`border-l-2 ${borderColor} pl-3 py-1.5`}>
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 text-[9px] font-bold tracking-wider ${labelColor} flex-shrink-0`}>
            {labelText}
          </span>
          <p className="text-sm text-foreground leading-snug flex-1">{statement}</p>
        </div>

        {(experts.length > 0 || strength) && (
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {experts.length > 0 && (
              <span className="text-[10px] text-muted truncate max-w-xs">{experts.join(', ')}</span>
            )}
            {strength && (
              <div className="flex gap-3">
                <ScoreBadge score={strength.initial_score} label="init" />
                {strength.final_score !== null && strength.final_score !== strength.initial_score && (
                  <ScoreBadge score={strength.final_score} label="final" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function extractExperts(arg: MainArgument): string[] {
  if (!arg.experts && !arg.expert) return []
  if (arg.expert) return [arg.expert]
  if (Array.isArray(arg.experts)) return arg.experts as string[]
  return []
}

export function DiscussionTimeline({ mainArguments, qbafStrengths, phase }: DiscussionTimelineProps) {
  const buildingPhases = new Set(['starting', 'experts', 'arguments', 'building', 'scoring', 'evaluating'])
  const isBuilding = buildingPhases.has(phase)

  if (mainArguments.length === 0) {
    return (
      <div className="bg-card-bg border border-card-border rounded-lg p-4">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Argument Tree</h2>
        {isBuilding ? (
          <p className="text-sm text-muted animate-pulse">Building argument structure...</p>
        ) : (
          <p className="text-sm text-muted">No arguments yet.</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-4">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">Argument Tree</h2>
      <div className="space-y-5">
        {mainArguments.map((arg, i) => {
          const experts = extractExperts(arg)
          const strength = strengthFor(arg.statement, qbafStrengths)
          return (
            <div key={i} className="space-y-1">
              <ArgumentRow
                statement={arg.statement}
                experts={experts}
                strength={strength}
                depth={0}
              />
            </div>
          )
        })}
      </div>
      {isBuilding && (
        <p className="mt-4 text-xs text-muted animate-pulse">Expanding argument tree...</p>
      )}
    </div>
  )
}
