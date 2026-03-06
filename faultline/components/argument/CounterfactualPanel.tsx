'use client'

import type { CounterfactualData, ReportData } from '@/lib/argument/types'

interface CounterfactualPanelProps {
  counterfactual: CounterfactualData | null
  report: ReportData | null
}

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta >= 0
  return (
    <span className={`text-xs font-mono font-semibold ${positive ? 'text-foreground' : 'text-accent'}`}>
      {positive ? '+' : ''}{delta.toFixed(4)}
    </span>
  )
}

export function CounterfactualPanel({ counterfactual, report }: CounterfactualPanelProps) {
  if (!counterfactual && !report) return null

  const entries = counterfactual ? Object.entries(counterfactual) : []

  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-4">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">Counterfactual Analysis</h2>

      {entries.length > 0 ? (
        <div className="space-y-5">
          {entries.map(([statement, data]) => (
            <div key={statement}>
              <p className="text-xs text-foreground leading-snug mb-3 line-clamp-3">{statement}</p>

              <div className="space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2 p-2 bg-surface rounded">
                  <span className="text-muted leading-snug flex-1">
                    Baseline root strength
                  </span>
                  <span className="font-mono text-foreground flex-shrink-0">{data.baseline_root.toFixed(4)}</span>
                </div>

                {data.most_influential_direct_child && (
                  <div className="p-2 bg-surface rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted">Most influential child</span>
                      <DeltaBadge delta={data.most_influential_direct_child.delta} />
                    </div>
                    {data.most_influential_direct_child.statement && (
                      <p className="text-muted leading-snug line-clamp-2">
                        {data.most_influential_direct_child.statement}
                      </p>
                    )}
                    <span className="text-[10px] text-muted uppercase">{data.most_influential_direct_child.edge_type}</span>
                  </div>
                )}

                {data.most_decisive_chain && (
                  <div className="p-2 bg-surface rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted">Most decisive chain</span>
                      <DeltaBadge delta={data.most_decisive_chain.delta_chain} />
                    </div>
                    {data.most_decisive_chain.chain_statements.length > 0 && (
                      <p className="text-muted leading-snug line-clamp-2">
                        {data.most_decisive_chain.chain_statements[0]}
                      </p>
                    )}
                  </div>
                )}

                {data.most_influential_node && (
                  <div className="p-2 bg-surface rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted">Most influential node</span>
                      <DeltaBadge delta={data.most_influential_node.delta} />
                    </div>
                    {data.most_influential_node.statement && (
                      <p className="text-muted leading-snug line-clamp-2">
                        {data.most_influential_node.statement}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No counterfactual data yet.</p>
      )}

      {report?.winner_critical_interventions && Object.keys(report.winner_critical_interventions).length > 0 && (
        <div className="mt-5 pt-4 border-t border-card-border">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Winner-Critical Interventions</p>
          <div className="space-y-2">
            {Object.entries(report.winner_critical_interventions).map(([key, val]) => (
              <div key={key} className="text-xs text-muted p-2 bg-surface rounded">
                <span className="font-mono text-foreground">{key}:</span>{' '}
                {typeof val === 'string' ? val : JSON.stringify(val)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
