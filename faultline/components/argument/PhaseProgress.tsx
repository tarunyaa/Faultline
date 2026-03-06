'use client'

const PHASES = [
  { key: 'starting', label: 'Task Extraction' },
  { key: 'experts', label: 'Expert Selection' },
  { key: 'arguments', label: 'Main Arguments' },
  { key: 'building', label: 'Peer Review' },
  { key: 'scoring', label: 'Base Scoring' },
  { key: 'evaluating', label: 'QBAF Evaluation' },
  { key: 'analyzing', label: 'Counterfactual' },
] as const

type PhaseKey = typeof PHASES[number]['key']

const PHASE_ORDER: Record<string, number> = {}
PHASES.forEach((p, i) => { PHASE_ORDER[p.key] = i })

interface PhaseProgressProps {
  currentPhase: string
}

export function PhaseProgress({ currentPhase }: PhaseProgressProps) {
  const currentIdx = PHASE_ORDER[currentPhase] ?? -1
  const isComplete = currentPhase === 'complete'
  const isBaselines = currentPhase === 'baselines'

  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-4">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Pipeline</h2>
      <div className="space-y-1">
        {PHASES.map((phase, i) => {
          const isDone = isComplete || isBaselines || i < currentIdx
          const isActive = i === currentIdx && !isComplete && !isBaselines
          const isPending = !isDone && !isActive

          return (
            <div key={phase.key} className="flex items-center gap-2 py-0.5">
              <span className={`w-4 h-4 flex-shrink-0 flex items-center justify-center text-[10px] rounded-full border ${
                isDone
                  ? 'border-accent bg-accent/20 text-accent'
                  : isActive
                    ? 'border-accent text-accent animate-pulse'
                    : 'border-card-border text-muted/40'
              }`}>
                {isDone ? '\u2713' : isActive ? '\u2022' : ''}
              </span>
              <span className={`text-xs ${
                isDone ? 'text-foreground' : isActive ? 'text-accent font-medium' : 'text-muted/40'
              }`}>
                {phase.label}
              </span>
            </div>
          )
        })}
        {(isComplete || isBaselines) && (
          <div className="flex items-center gap-2 py-0.5 pt-1 mt-1 border-t border-card-border">
            <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-[10px] rounded-full border border-accent bg-accent/20 text-accent">
              {'\u2713'}
            </span>
            <span className="text-xs text-accent font-medium">Complete</span>
          </div>
        )}
      </div>
    </div>
  )
}
