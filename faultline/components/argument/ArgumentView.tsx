'use client'

import { useEffect, useRef, useState } from 'react'
import { useArgumentStream } from '@/lib/hooks/useArgumentStream'
import type { BridgeConfig } from '@/lib/argument/bridge'
import { ArgumentTimeline } from './ArgumentTimeline'
import { PersonasSidebar } from './PersonasSidebar'
import { ResultsSection } from './ResultsSection'
import { MethodComparison } from './MethodComparison'
import { FrameworkConfig } from './FrameworkConfig'
import { TechnicalAnalysis } from './TechnicalAnalysis'

interface ArgumentViewProps {
  config: BridgeConfig
  personaNames: Map<string, string>
  personaAvatars: Map<string, string>
}

type ResultTab = 'results' | 'benchmarks' | 'technical'

export function ArgumentView({ config, personaNames, personaAvatars }: ArgumentViewProps) {
  const { state, messages, start } = useArgumentStream(config)
  const startedRef = useRef(false)
  const [showResults, setShowResults] = useState(false)
  const [activeTab, setActiveTab] = useState<ResultTab>('results')

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state.phase === 'complete') setShowResults(true)
  }, [state.phase])

  const isRunning = !['idle', 'complete', 'error'].includes(state.phase)
  const isComplete = state.phase === 'complete'

  // Build expert-to-persona mapping
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

  const phaseLabel: Record<string, string> = {
    idle: 'Idle',
    starting: 'Initializing',
    experts: 'Selecting Experts',
    arguments: 'Generating Arguments',
    building: 'Building Graph',
    scoring: 'Scoring',
    evaluating: 'QBAF Evaluation',
    analyzing: 'Counterfactual Analysis',
    baselines: 'Running Benchmarks',
    complete: 'Complete',
  }

  const tabs: { id: ResultTab; label: string; suit: string }[] = [
    { id: 'results', label: 'Debate Results', suit: '♥' },
    { id: 'benchmarks', label: 'Benchmarks', suit: '♦' },
    { id: 'technical', label: 'Technical Analysis', suit: '♣' },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Top Bar ─── */}
      <div className="border-b border-card-border bg-surface/50">
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-4">
          {/* Topic */}
          <p className="text-foreground text-sm font-medium leading-snug line-clamp-1 flex-1 min-w-0">
            {config.topic}
          </p>

          {/* Status */}
          <div className="flex-shrink-0 flex items-center gap-3">
            {isRunning && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] text-muted uppercase tracking-wider">
                  {phaseLabel[state.phase] || state.phase}
                </span>
              </div>
            )}
            {isComplete && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-foreground/10 text-foreground/50 font-medium uppercase tracking-wider">
                Complete
              </span>
            )}

            {/* Results toggle */}
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

      {/* ─── Main Layout ─── */}
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="flex flex-col lg:flex-row gap-5">

          {/* Left: Debate Timeline */}
          <div className="flex-1 min-w-0">
            <ArgumentTimeline
              messages={messages}
              experts={state.experts}
              expertNames={expertNames}
              expertAvatars={expertAvatars}
              task={state.task}
              phase={state.phase}
              consensus={state.consensus}
              framedTopic={state.framedTopic}
              positions={state.positions}
            />
          </div>

          {/* Right: Sidebar — Alignment Graph + Config */}
          <div className="lg:w-72 flex-shrink-0 space-y-4">
            {state.experts.length > 0 && (
              <PersonasSidebar
                experts={state.experts}
                expertNames={expertNames}
                expertAvatars={expertAvatars}
                strengths={state.qbafStrengths}
                phase={state.phase}
              />
            )}

            {state.experts.length === 0 && isRunning && (
              <div className="rounded-xl border border-card-border bg-surface p-4">
                <p className="text-xs text-muted animate-pulse">Setting up debate...</p>
              </div>
            )}

            {/* Framework Config */}
            {(state.experts.length > 0 || isComplete) && (
              <FrameworkConfig
                config={config}
                experts={state.experts}
                expertNames={expertNames}
                levelInfo={state.levelInfo}
                fullResult={state.fullResult}
              />
            )}
          </div>
        </div>

        {/* ─── Results Sections (Tabbed) ─── */}
        {showResults && isComplete && (
          <div className="mt-8">
            {/* Section divider */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-accent text-xs">♠</span>
              <div className="flex-1 h-px bg-card-border" />
              <div className="flex items-center gap-1">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`text-[10px] px-3 py-1.5 rounded uppercase tracking-wider font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-accent/10 text-accent'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    <span className="mr-1">{tab.suit}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 h-px bg-card-border" />
              <span className="text-accent text-xs">♠</span>
            </div>

            {/* Tab Content */}
            {activeTab === 'results' && (
              <ResultsSection
                consensus={state.consensus}
                counterfactual={state.counterfactual}
                report={state.report}
                hierarchy={state.qbafHierarchy}
                strengths={state.qbafStrengths}
                expertNames={expertNames}
                expertAvatars={expertAvatars}
              />
            )}

            {activeTab === 'benchmarks' && (
              <div className="max-w-5xl">
                {state.baselineResults.length > 0 ? (
                  <MethodComparison
                    results={state.baselineResults}
                    consensus={state.consensus}
                    topic={config.topic}
                  />
                ) : (
                  <div className="rounded-xl border border-card-border bg-surface p-8 text-center">
                    <p className="text-xs text-muted">No benchmark baselines were run for this debate.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'technical' && (
              <TechnicalAnalysis
                baseScores={state.baseScores}
                consensus={state.consensus}
                report={state.report}
                hierarchy={state.qbafHierarchy}
                strengths={state.qbafStrengths}
                counterfactual={state.counterfactual}
                experts={state.experts}
                expertNames={expertNames}
                fullResult={state.fullResult}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
