'use client'

import { useEffect, useRef, useState } from 'react'
import { useArgumentStream } from '@/lib/hooks/useArgumentStream'
import type { BridgeConfig } from '@/lib/argument/bridge'
import { ArgumentTimeline } from './ArgumentTimeline'
import { PersonasSidebar } from './PersonasSidebar'
import { ResultsSection } from './ResultsSection'
import { MethodComparison } from './MethodComparison'

interface ArgumentViewProps {
  config: BridgeConfig
  personaNames: Map<string, string>
  personaAvatars: Map<string, string>
}

export function ArgumentView({ config, personaNames, personaAvatars }: ArgumentViewProps) {
  const { state, messages, start } = useArgumentStream(config)
  const startedRef = useRef(false)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-show results when complete
  useEffect(() => {
    if (state.phase === 'complete') setShowResults(true)
  }, [state.phase])

  const isRunning = !['idle', 'complete', 'error'].includes(state.phase)
  const isComplete = state.phase === 'complete'

  if (state.phase === 'error') {
    return (
      <div className="min-h-screen bg-background px-6 py-8">
        <div className="max-w-md p-6 bg-card-bg border border-accent/40 rounded-xl text-accent">
          <h2 className="font-bold mb-2">Error</h2>
          <p className="text-sm text-muted">{state.error}</p>
        </div>
      </div>
    )
  }

  // Build expert-to-persona mapping
  // ARGORA generates expert names like "AI Safety Researcher" — we map by index to persona
  const expertNames = new Map<string, string>()
  const expertAvatars = new Map<string, string>()
  if (config.personaIds && config.personaIds.length > 0) {
    state.experts.forEach((expert, i) => {
      const personaId = config.personaIds![i]
      if (personaId) {
        const name = personaNames.get(personaId) ?? expert
        expertNames.set(expert, name)
        const avatar = personaAvatars.get(personaId)
        if (avatar) expertAvatars.set(expert, avatar)
      }
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header — minimal */}
      <div className="border-b border-card-border px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-foreground text-sm font-medium leading-snug line-clamp-1">{config.topic}</p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            {isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            )}
            {isComplete && (
              <button
                onClick={() => setShowResults(!showResults)}
                className="text-[10px] text-accent hover:text-foreground transition-colors uppercase tracking-wider"
              >
                {showResults ? 'Hide Results' : 'Show Results'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body — 2/3 + 1/3 grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left: Live debate feed (2/3) */}
          <div className="flex-1 min-w-0">
            <ArgumentTimeline
              messages={messages}
              experts={state.experts}
              expertNames={expertNames}
              expertAvatars={expertAvatars}
              task={state.task}
              phase={state.phase}
              consensus={state.consensus}
            />
          </div>

          {/* Right: Sidebar (1/3) */}
          <div className="lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
            {state.experts.length > 0 && (
              <PersonasSidebar
                experts={state.experts}
                expertNames={expertNames}
                expertAvatars={expertAvatars}
                strengths={state.qbafStrengths}
                phase={state.phase}
              />
            )}

            {/* Loading state */}
            {state.experts.length === 0 && isRunning && (
              <div className="rounded-xl border border-card-border bg-surface p-4">
                <p className="text-xs text-muted animate-pulse">Setting up debate...</p>
              </div>
            )}
          </div>
        </div>

        {/* Results Section — expandable cards after completion */}
        {showResults && isComplete && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-accent text-xs">♠</span>
              <div className="flex-1 h-px bg-card-border" />
              <span className="text-xs text-muted uppercase tracking-widest">Results</span>
              <div className="flex-1 h-px bg-card-border" />
              <span className="text-accent text-xs">♠</span>
            </div>

            <ResultsSection
              consensus={state.consensus}
              counterfactual={state.counterfactual}
              report={state.report}
              hierarchy={state.qbafHierarchy}
              strengths={state.qbafStrengths}
            />

            {/* Method Comparison with preference selection */}
            {state.baselineResults.length > 0 && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-accent text-xs">♦</span>
                  <div className="flex-1 h-px bg-card-border" />
                  <span className="text-xs text-muted uppercase tracking-widest">Method Comparison</span>
                  <div className="flex-1 h-px bg-card-border" />
                  <span className="text-accent text-xs">♦</span>
                </div>
                <MethodComparison
                  results={state.baselineResults}
                  consensus={state.consensus}
                  topic={config.topic}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
