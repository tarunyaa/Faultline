'use client'

import { useState } from 'react'
import type {
  BaseScore,
  ConsensusData,
  ReportData,
  QBAFHierarchyNode,
  QBAFStrength,
  CounterfactualData,
  ArgumentCompleteData,
} from '@/lib/argument/types'

interface TechnicalAnalysisProps {
  baseScores: BaseScore[]
  consensus: ConsensusData | null
  report: ReportData | null
  hierarchy: QBAFHierarchyNode[]
  strengths: QBAFStrength[]
  counterfactual: CounterfactualData | null
  experts: string[]
  expertNames: Map<string, string>
  fullResult: ArgumentCompleteData | null
}

function Section({
  title,
  suit,
  children,
  defaultOpen = false,
}: {
  title: string
  suit: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-card-border bg-surface overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-card-bg/50 transition-colors"
      >
        <span className="text-accent text-[10px]">{suit}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted flex-1 text-left">{title}</span>
        <span className="text-[10px] text-muted/50">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-card-border/50">
          {children}
        </div>
      )}
    </div>
  )
}

function ScoreCell({ value, highlight }: { value: number | null; highlight?: boolean }) {
  if (value === null) return <td className="px-2 py-1.5 text-[10px] text-muted text-center">—</td>
  return (
    <td className={`px-2 py-1.5 text-[10px] font-mono text-center ${highlight ? 'text-accent font-semibold' : 'text-foreground'}`}>
      {value.toFixed(3)}
    </td>
  )
}

export function TechnicalAnalysis({
  baseScores,
  consensus,
  report,
  hierarchy,
  strengths,
  counterfactual,
  experts,
  expertNames,
  fullResult,
}: TechnicalAnalysisProps) {
  const details = consensus?.details as Record<string, unknown> | undefined
  const agnostic = consensus?.agnostic_consensus as Record<string, unknown> | undefined

  // Main arguments for margin decomposition
  const mainArgs = hierarchy.filter(n => n.type === 'main_argument')

  // Winner info
  let winnerIdx = -1
  let maxScore = -Infinity
  for (let i = 0; i < mainArgs.length; i++) {
    if (mainArgs[i].final_score !== null && mainArgs[i].final_score! > maxScore) {
      maxScore = mainArgs[i].final_score!
      winnerIdx = i
    }
  }
  const winnerArg = winnerIdx >= 0 ? mainArgs[winnerIdx] : null

  // Winner-critical interventions
  const interventions = report?.winner_critical_interventions as Record<string, unknown> | undefined

  return (
    <div className="space-y-4 max-w-5xl">

      {/* ─── Base Scores (3-criteria scoring table) ─── */}
      {baseScores.length > 0 && (
        <Section title="Base Score Evaluation" suit="♠" defaultOpen>
          <div className="pt-3 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-card-border/50">
                  <th className="px-2 py-1.5 text-[9px] text-muted uppercase tracking-wider font-semibold">Node</th>
                  <th className="px-2 py-1.5 text-[9px] text-muted uppercase tracking-wider font-semibold text-center">Relevance</th>
                  <th className="px-2 py-1.5 text-[9px] text-muted uppercase tracking-wider font-semibold text-center">Evidence</th>
                  <th className="px-2 py-1.5 text-[9px] text-muted uppercase tracking-wider font-semibold text-center">Logic</th>
                  <th className="px-2 py-1.5 text-[9px] text-muted uppercase tracking-wider font-semibold text-center">Base Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border/30">
                {baseScores.map((score, i) => (
                  <tr key={i} className="hover:bg-card-bg/30">
                    <td className="px-2 py-1.5 text-[10px] text-foreground max-w-[200px] truncate">
                      {score.node}
                    </td>
                    <ScoreCell value={score.task_relevance} />
                    <ScoreCell value={score.evidence_support} />
                    <ScoreCell value={score.logical_soundness} />
                    <ScoreCell value={score.base_score} highlight />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ─── QBAF Final Strengths ─── */}
      {strengths.length > 0 && (
        <Section title="QBAF Final Strengths" suit="♥">
          <div className="pt-3 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-card-border/50">
                  <th className="px-2 py-1.5 text-[9px] text-muted uppercase tracking-wider font-semibold">Expert</th>
                  <th className="px-2 py-1.5 text-[9px] text-muted uppercase tracking-wider font-semibold">Statement</th>
                  <th className="px-2 py-1.5 text-[9px] text-muted uppercase tracking-wider font-semibold text-center">Initial</th>
                  <th className="px-2 py-1.5 text-[9px] text-muted uppercase tracking-wider font-semibold text-center">Final</th>
                  <th className="px-2 py-1.5 text-[9px] text-muted uppercase tracking-wider font-semibold text-center">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border/30">
                {strengths.map((s, i) => {
                  const delta = (s.final_score !== null && s.initial_score !== null)
                    ? s.final_score - s.initial_score
                    : null
                  const isWinner = winnerArg && s.statement === winnerArg.statement
                  return (
                    <tr key={i} className={`hover:bg-card-bg/30 ${isWinner ? 'bg-accent/5' : ''}`}>
                      <td className="px-2 py-1.5 text-[10px] text-accent font-medium whitespace-nowrap">
                        {expertNames.get(s.expert || '') ?? s.expert}
                      </td>
                      <td className="px-2 py-1.5 text-[10px] text-foreground max-w-[250px] truncate">
                        {s.statement}
                      </td>
                      <ScoreCell value={s.initial_score} />
                      <ScoreCell value={s.final_score} highlight={!!isWinner} />
                      <td className="px-2 py-1.5 text-[10px] font-mono text-center">
                        {delta !== null ? (
                          <span className={delta >= 0 ? 'text-foreground' : 'text-accent'}>
                            {delta >= 0 ? '+' : ''}{delta.toFixed(3)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ─── Margin Decomposition ─── */}
      {mainArgs.length > 1 && winnerArg && (
        <Section title="Winner Margin Decomposition" suit="♦">
          <div className="pt-3 space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-card-bg border border-card-border">
              <span className="text-[9px] text-muted uppercase tracking-wider">Winner</span>
              <span className="text-xs text-accent font-semibold">
                {expertNames.get(winnerArg.expert) ?? winnerArg.expert}
              </span>
              <span className="text-[10px] font-mono text-foreground ml-auto">
                {winnerArg.final_score?.toFixed(4)}
              </span>
            </div>

            {/* Margins vs each competitor */}
            <div className="space-y-1.5">
              {mainArgs
                .filter(a => a.node_id !== winnerArg.node_id)
                .map((competitor, i) => {
                  const margin = (winnerArg.final_score ?? 0) - (competitor.final_score ?? 0)
                  const classification = margin < 0.01 ? 'RAZOR-THIN' : margin < 0.05 ? 'NARROW' : 'DECISIVE'
                  return (
                    <div key={i} className="flex items-center gap-3 p-2 rounded border border-card-border/50 bg-surface">
                      <span className="text-[10px] text-foreground font-medium flex-1 min-w-0 truncate">
                        vs {expertNames.get(competitor.expert) ?? competitor.expert}
                      </span>
                      <span className="text-[10px] font-mono text-foreground">
                        {competitor.final_score?.toFixed(4)}
                      </span>
                      <span className={`text-[9px] font-mono font-semibold ${margin > 0 ? 'text-foreground' : 'text-accent'}`}>
                        Δ {margin >= 0 ? '+' : ''}{margin.toFixed(4)}
                      </span>
                      <span className={`text-[8px] px-1.5 py-px rounded uppercase tracking-wider font-medium ${
                        classification === 'DECISIVE' ? 'bg-foreground/10 text-foreground/60'
                        : classification === 'NARROW' ? 'bg-accent/10 text-accent'
                        : 'bg-accent/20 text-accent font-bold'
                      }`}>
                        {classification}
                      </span>
                    </div>
                  )
                })}
            </div>

            {/* Consensus details if available */}
            {details && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {details.prior_margin != null && (
                  <MetricBox label="Prior Margin" value={String((details.prior_margin as number).toFixed(4))} />
                )}
                {details.argumentative_margin != null && (
                  <MetricBox label="Argumentative Margin" value={String((details.argumentative_margin as number).toFixed(4))} />
                )}
                {details.robustness != null && (
                  <MetricBox label="Robustness" value={String(details.robustness)} accent />
                )}
                {details.override != null && (
                  <MetricBox label="Override" value={details.override ? 'Yes' : 'No'} accent={!!details.override} />
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ─── Observational Override Analysis ─── */}
      {agnostic && Object.keys(agnostic).length > 0 && (
        <Section title="Observational Override Analysis" suit="♣">
          <div className="pt-3 space-y-2 max-w-2xl">
            <p className="text-[10px] text-muted mb-2">
              LLM-as-judge evaluation independent of the argumentation framework.
            </p>
            {typeof agnostic.llm_winner === 'string' && (
              <div className="flex items-center gap-2 p-2 rounded bg-card-bg border border-card-border">
                <span className="text-[10px] text-muted">LLM Winner</span>
                <span className="text-xs text-foreground font-medium">{agnostic.llm_winner}</span>
              </div>
            )}
            {typeof agnostic.js_divergence === 'number' && (
              <MetricBox label="JS Divergence" value={(agnostic.js_divergence as number).toFixed(4)} />
            )}
            {typeof agnostic.override_recommended === 'boolean' && (
              <MetricBox
                label="Override Recommended"
                value={agnostic.override_recommended ? 'Yes' : 'No'}
                accent={agnostic.override_recommended as boolean}
              />
            )}
            {/* Per-expert LLM scores */}
            {agnostic.scores != null && typeof agnostic.scores === 'object' && (
              <div className="space-y-1 mt-2">
                <div className="text-[9px] text-muted uppercase tracking-wider font-semibold">LLM-as-Judge Scores</div>
                {Object.entries(agnostic.scores as Record<string, number>).map(([expert, score]) => (
                  <div key={expert} className="flex items-center justify-between p-1.5 rounded bg-card-bg/50">
                    <span className="text-[10px] text-foreground">
                      {expertNames.get(expert) ?? expert}
                    </span>
                    <span className="text-[10px] font-mono text-foreground">{typeof score === 'number' ? score.toFixed(3) : String(score)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Decision */}
            {consensus && consensus.override_decision !== consensus.original_decision && (
              <div className="mt-2 p-2 rounded border border-accent/30 bg-accent/5">
                <span className="text-[10px] text-accent font-semibold">
                  Decision overridden: {consensus.original_decision} → {consensus.override_decision}
                </span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ─── Winner-Critical Interventions ─── */}
      {interventions && Object.keys(interventions).length > 0 && (
        <Section title="Winner-Critical Interventions" suit="♠">
          <div className="pt-3 space-y-2 max-w-2xl">
            <p className="text-[10px] text-muted mb-2">
              Single-edge removals that would flip the winner. Fewer = more brittle victory.
            </p>
            {Object.entries(interventions).map(([key, value]) => {
              const intervention = value as Record<string, unknown>
              return (
                <div key={key} className="p-2 rounded border border-card-border bg-card-bg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-accent">{key}</span>
                    {intervention.cost != null && (
                      <span className="text-[10px] font-mono text-foreground">
                        cost: {typeof intervention.cost === 'number' ? (intervention.cost as number).toFixed(4) : String(intervention.cost)}
                      </span>
                    )}
                  </div>
                  {typeof intervention.statement === 'string' && (
                    <p className="text-[10px] text-muted leading-snug line-clamp-2">{intervention.statement}</p>
                  )}
                  {typeof intervention.flips_winner_to === 'string' && (
                    <span className="text-[9px] text-accent uppercase tracking-wider">
                      Flips to: {intervention.flips_winner_to}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Empty state */}
      {baseScores.length === 0 && strengths.length === 0 && !details && !agnostic && (
        <div className="rounded-xl border border-card-border bg-surface p-8 text-center">
          <p className="text-xs text-muted">No technical data available for this debate.</p>
        </div>
      )}
    </div>
  )
}

function MetricBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-2 rounded bg-card-bg border border-card-border">
      <div className="text-[9px] text-muted uppercase tracking-wider mb-0.5">{label}</div>
      <span className={`text-xs font-mono ${accent ? 'text-accent font-semibold' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}
