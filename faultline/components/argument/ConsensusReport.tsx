'use client'

import type { ConsensusData, ReportData } from '@/lib/argument/types'

interface ConsensusReportProps {
  consensus: ConsensusData | null
  report: ReportData | null
}

export function ConsensusReport({ consensus, report }: ConsensusReportProps) {
  if (!consensus) return null

  // Extract margin details from consensus.details if present
  const details = consensus.details as Record<string, unknown>
  const priorMargin = typeof details?.prior_margin === 'number' ? details.prior_margin as number : null
  const argumentativeMargin = typeof details?.argumentative_margin === 'number' ? details.argumentative_margin as number : null
  const robustness = typeof details?.robustness === 'string' ? details.robustness as string : null
  const overridden = typeof details?.override === 'boolean' ? details.override as boolean : null

  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-4">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">Consensus Report</h2>

      {/* Winner */}
      <div className="mb-4 p-3 bg-surface rounded-lg border border-card-border">
        <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Winner</p>
        <p className="text-sm font-semibold text-foreground leading-snug">{consensus.winner}</p>
        {overridden !== null && (
          <span className={`mt-1 inline-block text-[10px] px-2 py-0.5 rounded font-medium ${
            overridden ? 'bg-accent/20 text-accent' : 'bg-surface text-muted border border-card-border'
          }`}>
            {overridden ? 'Prior overridden by arguments' : 'Prior consistent with arguments'}
          </span>
        )}
      </div>

      {/* Margin decomposition */}
      {(priorMargin !== null || argumentativeMargin !== null) && (
        <div className="mb-4">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Margin Decomposition</p>
          <div className="space-y-1.5">
            {priorMargin !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Prior</span>
                <span className="font-mono text-foreground">{priorMargin.toFixed(4)}</span>
              </div>
            )}
            {argumentativeMargin !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Argumentative</span>
                <span className={`font-mono ${argumentativeMargin >= 0 ? 'text-foreground' : 'text-accent'}`}>
                  {argumentativeMargin >= 0 ? '+' : ''}{argumentativeMargin.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Robustness */}
      {robustness && (
        <div className="mb-4">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Robustness</p>
          <span className="text-xs text-foreground">{robustness}</span>
        </div>
      )}

      {/* Consensus text */}
      {consensus.consensus_text && (
        <div className="mb-4">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Summary</p>
          <p className="text-sm text-foreground leading-relaxed">{consensus.consensus_text}</p>
        </div>
      )}

      {/* Graph consensus */}
      {consensus.graph_consensus_summary && (
        <div>
          <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Graph Consensus</p>
          <p className="text-xs text-muted leading-relaxed">{consensus.graph_consensus_summary}</p>
        </div>
      )}

      {/* Report metadata */}
      {report && (
        <div className="mt-4 pt-3 border-t border-card-border flex items-center justify-between text-[10px] text-muted">
          {report.argument_count !== undefined && (
            <span>{report.argument_count} arguments evaluated</span>
          )}
          {!report.available && report.reason && (
            <span className="text-accent">{report.reason}</span>
          )}
        </div>
      )}
    </div>
  )
}
