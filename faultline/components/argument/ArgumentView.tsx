'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useArgumentStream } from '@/lib/hooks/useArgumentStream'
import type { BridgeConfig } from '@/lib/argument/bridge'
import type { BaselineResult, QBAFHierarchyNode, StreamingArg, DivergenceMap } from '@/lib/argument/types'
import { ArgumentTimeline } from './ArgumentTimeline'
import { ResultsSection } from './ResultsSection'
import { MethodComparison } from './MethodComparison'
import { TechnicalAnalysis } from './TechnicalAnalysis'
import { ArgumentCruxCard, FlipConditionCard } from './ArgumentCruxCard'
import AgentPolygon from '@/components/AgentPolygon'

// Derive a DivergenceMap-compatible structure from ARGORA debate data
function deriveDebateDivergenceMap(
  qbafHierarchy: QBAFHierarchyNode[],
  streamingArgs: StreamingArg[],
  experts: string[],
): DivergenceMap | null {
  if (experts.length < 2) return null

  const per_expert: Record<string, { root_strength: number; support_count: number; attack_count: number }> = {}

  if (qbafHierarchy.length > 0) {
    // After completion: use final σ scores from root (depth-0) hierarchy nodes
    for (const node of qbafHierarchy) {
      if (!node.expert) continue
      if (!per_expert[node.expert]) {
        per_expert[node.expert] = { root_strength: 0.5, support_count: 0, attack_count: 0 }
      }
      if (node.final_score != null) {
        per_expert[node.expert].root_strength = Math.max(0, Math.min(1, node.final_score))
      }
      for (const child of node.supplementary_args ?? []) {
        if (child.relation === 'attack') per_expert[node.expert].attack_count++
        else per_expert[node.expert].support_count++
      }
    }
  } else {
    // During streaming: equal strength, count attack activity
    for (const expert of experts) {
      const attacks = streamingArgs.filter(a => a.expert === expert && a.type === 'attacking_argument').length
      const supports = streamingArgs.filter(a => a.expert === expert && a.type === 'supporting_argument').length
      per_expert[expert] = { root_strength: 0.5, support_count: supports, attack_count: attacks }
    }
  }

  // Detect attack relationships between experts via streamingArgs
  const attackPairs = new Set<string>()
  if (streamingArgs.length > 0) {
    const graphMaps = new Map<number, Map<number, string>>() // graph_id → node_id → expert
    for (const arg of streamingArgs) {
      const gid = arg.graph_id ?? 0
      if (!graphMaps.has(gid)) graphMaps.set(gid, new Map())
      graphMaps.get(gid)!.set(arg.id, arg.expert)
    }
    for (const arg of streamingArgs) {
      if (arg.type === 'attacking_argument' && arg.parent_id != null) {
        const gid = arg.graph_id ?? 0
        const parentExpert = graphMaps.get(gid)?.get(arg.parent_id)
        if (parentExpert && parentExpert !== arg.expert) {
          attackPairs.add([arg.expert, parentExpert].sort().join('<->'))
        }
      }
    }
  }

  const pairwise: DivergenceMap['pairwise'] = []
  for (let i = 0; i < experts.length; i++) {
    for (let j = i + 1; j < experts.length; j++) {
      const a = experts[i], b = experts[j]
      const key = [a, b].sort().join('<->')
      const sA = per_expert[a]?.root_strength ?? 0.5
      const sB = per_expert[b]?.root_strength ?? 0.5
      pairwise.push({ expert_a: a, expert_b: b, gap: Math.abs(sA - sB), is_crux: attackPairs.has(key) })
    }
  }

  return { consensus_facets: [], crux_facets: [], per_expert, pairwise }
}

interface ArgumentViewProps {
  config: BridgeConfig
  personaNames: Map<string, string>
  personaAvatars: Map<string, string>
}

type ResultTab = 'results' | 'benchmarks' | 'technical'

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim()
}

function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
}

export function ArgumentView({ config, personaNames, personaAvatars }: ArgumentViewProps) {
  const { state, messages, start } = useArgumentStream(config)
  const startedRef = useRef(false)
  const [showResults, setShowResults] = useState(false)
  const [activeTab, setActiveTab] = useState<ResultTab>('results')
  const [localBaselineResults, setLocalBaselineResults] = useState<BaselineResult[]>([])
  const [baselinesRunning, setBaselinesRunning] = useState(false)
  const [baselinesRan, setBaselinesRan] = useState(false)

  const runComparison = async () => {
    setBaselinesRunning(true)
    try {
      const res = await fetch('/api/argument/baselines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: config.topic }),
      })
      if (!res.ok) return
      const reader = res.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'baseline_result') {
              const d = event.data as {
                method: BaselineResult['method']
                label: string
                answer: string | null
                reasoning: string | null
                main_task?: string
                token_usage?: Record<string, number>
                error?: string
              }
              setLocalBaselineResults(prev => [...prev, {
                method: d.method,
                label: d.label,
                answer: d.answer,
                reasoning: d.reasoning,
                mainTask: d.main_task,
                tokenUsage: d.token_usage,
                error: d.error,
              }])
            }
          } catch { /* skip malformed lines */ }
        }
      }
      setBaselinesRan(true)
    } finally {
      setBaselinesRunning(false)
    }
  }

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

  // Alignment polygon data
  const polygonAgents = useMemo(() =>
    state.experts.map(expert => ({
      id: expert,
      name: expertNames.get(expert) ?? expert,
      picture: expertAvatars.get(expert) ?? '',
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.experts, expertNames.size],
  )
  const expertNameToPersonaId = useMemo(
    () => Object.fromEntries(state.experts.map(e => [e, e])),
    [state.experts],
  )
  const debateDivergenceMap = useMemo(
    () => deriveDebateDivergenceMap(state.qbafHierarchy, state.streamingArgs, state.experts),
    [state.qbafHierarchy, state.streamingArgs, state.experts],
  )
  const lastStreamingExpert = state.streamingArgs.length > 0
    ? state.streamingArgs[state.streamingArgs.length - 1].expert
    : null

  if (state.phase === 'error') {
    return (
      <div className="min-h-screen bg-background px-6 py-8 max-w-6xl mx-auto">
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
    { id: 'technical', label: 'Analysis', suit: '♣' },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Top Bar ─── */}
      <div className="border-b border-card-border bg-surface/50">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-4">
          {/* Status */}
          <div className="flex items-center gap-3">
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
          </div>

          <div className="flex-1" />

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

      {/* ─── Main Layout ─── */}
      <div className="max-w-6xl mx-auto px-6 py-5">

        {/* Debate Topic card */}
        <div className="rounded-xl border border-card-border bg-surface px-4 py-3 mb-4">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Debate Topic</p>
          <p className="text-sm text-foreground font-medium leading-snug">{config.topic}</p>
        </div>

        {/* Two-column: Timeline + Alignment Polygon */}
        <div className={`grid gap-4 ${polygonAgents.length >= 2 ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
          <div className={polygonAgents.length >= 2 ? 'lg:col-span-2' : ''}>
            <ArgumentTimeline
              messages={messages}
              experts={state.experts}
              expertNames={expertNames}
              expertAvatars={expertAvatars}
              phase={state.phase}
              consensus={state.consensus}
            />
          </div>

          {polygonAgents.length >= 2 && (
            <div className="lg:col-span-1 space-y-3">
              <div className="bg-card-bg border border-card-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-accent text-[10px]">♦</span>
                  <span className="text-[10px] text-muted uppercase tracking-widest">Argument Strength</span>
                </div>
                <AgentPolygon
                  agents={polygonAgents}
                  messages={[]}
                  activeSpeakerId={lastStreamingExpert}
                  divergenceMap={debateDivergenceMap ?? undefined}
                  expertNameToPersonaId={expertNameToPersonaId}
                />
              </div>
            </div>
          )}
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
              <div className="space-y-4">
                {/* 2-column verdict */}
                {state.consensus && (
                  <div className="rounded-xl border border-card-border bg-surface p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-accent text-[10px]">♥</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Verdict</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                      <div className="lg:col-span-3 space-y-1">
                        <p className="text-[10px] text-muted uppercase tracking-wider">Winning Argument</p>
                        <p className="text-sm text-foreground leading-snug">
                          {stripMarkdown(state.consensus.winner || '')}
                        </p>
                        {state.consensus.winner_score != null && (
                          <p className="text-[10px] text-muted mt-1">
                            <span className="font-mono text-foreground">&sigma; = {state.consensus.winner_score.toFixed(4)}</span>
                            <span className="ml-2 text-muted/60">(final argument strength after debate)</span>
                          </p>
                        )}
                      </div>
                      <div className="lg:col-span-2 space-y-1">
                        <p className="text-[10px] text-muted uppercase tracking-wider">Consensus</p>
                        <div className="text-[11px] text-foreground leading-relaxed space-y-1">
                          {splitIntoParagraphs(stripMarkdown(state.consensus.consensus_text || '')).map((para, i) => (
                            <p key={i}>{para}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Score legend */}
                <div className="rounded-xl border border-card-border bg-surface p-3">
                  <div className="flex flex-wrap gap-4 text-[11px] text-muted">
                    <span><span className="font-mono text-foreground">&tau;</span> &mdash; base strength before debate</span>
                    <span><span className="font-mono text-foreground">&sigma;</span> &mdash; final strength after graph propagation</span>
                    <span><span className="font-mono text-foreground">&delta;</span> &mdash; counterfactual impact of removing a node</span>
                  </div>
                </div>

                <ResultsSection
                  consensus={state.consensus}
                  counterfactual={state.counterfactual}
                  report={state.report}
                  hierarchy={state.qbafHierarchy}
                  strengths={state.qbafStrengths}
                  expertNames={expertNames}
                  expertAvatars={expertAvatars}
                />

                {/* Crux cards (LLM-enriched, from crux-personas) */}
                {state.cruxCards.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-accent text-xs">♦</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Crux Cards</span>
                      <div className="flex-1 h-px bg-card-border opacity-60" />
                      <span className="text-accent text-xs">♦</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {[...state.cruxCards]
                        .sort((a, b) => b.importance - a.importance)
                        .map((card, i) => (
                          <ArgumentCruxCard key={i} card={card} />
                        ))}
                    </div>
                  </div>
                )}

                {/* Flip conditions (math-based, from argora-personas) */}
                {state.flipConditions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-accent text-xs">♠</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Fault Lines</span>
                      <div className="flex-1 h-px bg-card-border opacity-60" />
                      <span className="text-[10px] text-muted">arguments whose removal most shifts the outcome</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {[...state.flipConditions]
                        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                        .map((cond, i) => (
                          <FlipConditionCard key={i} condition={cond} index={i} />
                        ))}
                    </div>
                  </div>
                )}

                {state.cruxCards.length === 0 && state.flipConditions.length === 0 && (
                  <div className="rounded-xl border border-card-border bg-surface p-6 text-center">
                    <p className="text-xs text-muted">No high-impact fault lines found — argument strengths are robust.</p>
                  </div>
                )}

                {/* Cross-facet analysis (faceted mode only) */}
                {state.crossFacetAnalysis && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-accent text-[10px]">♦</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Cross-Facet Analysis</span>
                    </div>
                    <div className="rounded-xl border border-card-border bg-surface p-4 space-y-4">
                      {/* Per-facet table */}
                      {state.crossFacetAnalysis.table.length > 0 && (
                        <div className="space-y-2">
                          {state.crossFacetAnalysis.table.map((row, i) => (
                            <div key={i} className="border border-card-border rounded-lg p-3 space-y-1">
                              <p className="text-[10px] text-muted leading-snug line-clamp-2">{row.facet}</p>
                              <div className="flex items-center gap-3 flex-wrap">
                                {row.winner_expert && (
                                  <span className="text-[10px] text-foreground">
                                    Winner: <span className="text-accent">{row.winner_expert}</span>
                                  </span>
                                )}
                                {row.winner_score != null && (
                                  <span className="text-[10px] font-mono text-muted">&sigma;={row.winner_score.toFixed(3)}</span>
                                )}
                                {row.top_flip_delta != null && (
                                  <span className="text-[10px] font-mono text-muted">
                                    top &delta;={row.top_flip_delta.toFixed(3)}
                                    {row.top_flip_winner_critical && (
                                      <span className="ml-1 text-accent">critical</span>
                                    )}
                                  </span>
                                )}
                              </div>
                              {row.top_flip_condition && (
                                <p className="text-[10px] text-muted/70 leading-snug line-clamp-2 italic">
                                  Fault line: {row.top_flip_condition}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Synthesis */}
                      {state.crossFacetAnalysis.synthesis && !state.crossFacetAnalysis.synthesis.error && (
                        <div className="space-y-3 pt-2 border-t border-card-border">
                          {state.crossFacetAnalysis.synthesis.convergence_facets?.length > 0 && (
                            <div>
                              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Convergence</p>
                              <ul className="space-y-1">
                                {state.crossFacetAnalysis.synthesis.convergence_facets.map((f, i) => (
                                  <li key={i} className="text-[11px] text-foreground leading-snug">{f}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {state.crossFacetAnalysis.synthesis.divergence_facets?.length > 0 && (
                            <div>
                              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Divergence</p>
                              <ul className="space-y-1">
                                {state.crossFacetAnalysis.synthesis.divergence_facets.map((f, i) => (
                                  <li key={i} className="text-[11px] text-foreground leading-snug">{f}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {state.crossFacetAnalysis.synthesis.cross_cutting_fault_lines?.length > 0 && (
                            <div>
                              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Cross-Cutting Fault Lines</p>
                              <ul className="space-y-1">
                                {state.crossFacetAnalysis.synthesis.cross_cutting_fault_lines.map((f, i) => (
                                  <li key={i} className="text-[11px] text-foreground leading-snug border-l-2 border-accent/40 pl-2">{f}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {state.crossFacetAnalysis.synthesis.most_contested_facet && (
                            <div>
                              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Most Contested</p>
                              <p className="text-[11px] text-foreground leading-snug">{state.crossFacetAnalysis.synthesis.most_contested_facet}</p>
                            </div>
                          )}
                          {state.crossFacetAnalysis.synthesis.most_fragile_position && (
                            <div>
                              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Most Fragile Position</p>
                              <p className="text-[11px] text-foreground leading-snug">{state.crossFacetAnalysis.synthesis.most_fragile_position}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'benchmarks' && (
              <div className="max-w-6xl">
                {localBaselineResults.length > 0 ? (
                  <MethodComparison
                    results={localBaselineResults}
                    consensus={state.consensus}
                    topic={config.topic}
                  />
                ) : (
                  <div className="rounded-xl border border-card-border bg-surface p-8 text-center space-y-4">
                    <p className="text-xs text-muted">
                      Run a comparison against direct prompting baselines to see how ARGORA&apos;s structured argumentation performs.
                    </p>
                    {!baselinesRan && (
                      <button
                        onClick={runComparison}
                        disabled={baselinesRunning}
                        className="text-xs border border-accent/60 text-accent hover:bg-accent hover:text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                      >
                        {baselinesRunning ? 'Running Comparison...' : 'Run Comparison'}
                      </button>
                    )}
                    {baselinesRunning && (
                      <p className="text-[10px] text-muted animate-pulse">Comparing against direct and CoT baselines&hellip;</p>
                    )}
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
