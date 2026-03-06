'use client'

import { useState } from 'react'
import type { BridgeConfig } from '@/lib/argument/bridge'
import type { LevelCompleteData, ArgumentCompleteData } from '@/lib/argument/types'

interface FrameworkConfigProps {
  config: BridgeConfig
  experts: string[]
  expertNames: Map<string, string>
  levelInfo: LevelCompleteData | null
  fullResult: ArgumentCompleteData | null
}

export function FrameworkConfig({ config, experts, expertNames, levelInfo, fullResult }: FrameworkConfigProps) {
  const [open, setOpen] = useState(false)

  // Execution stats from graph_stats
  const graphStats = levelInfo?.graph_stats
  let totalNodes = 0
  let totalEdges = 0
  if (graphStats) {
    for (const key of Object.keys(graphStats)) {
      totalNodes += graphStats[key].nodes || 0
      totalEdges += graphStats[key].edges || 0
    }
  }

  // Runtime info
  const runtime = fullResult?.runtime as Record<string, number> | undefined
  const tokenUsage = fullResult?.token_usage as Record<string, number> | undefined

  return (
    <div className="rounded-xl border border-card-border bg-surface overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-card-bg/50 transition-colors"
      >
        <span className="text-accent text-[10px]">♣</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted flex-1 text-left">
          Framework Config
        </span>
        <span className="text-[10px] text-muted/50">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 border-t border-card-border/50 pt-2.5 space-y-2">
          <Row label="Experts" value={`${experts.length}`} />
          <Row label="Model" value={config.model || 'gpt-4o-mini'} />
          <Row label="Q-Sem" value={config.qsemType || 'DFQuADModel'} />
          <Row label="Rounds" value={`${config.rounds || 1}`} />

          {/* Execution Summary */}
          {(totalNodes > 0 || totalEdges > 0) && (
            <>
              <div className="h-px bg-card-border/30 my-1" />
              <div className="text-[9px] text-muted uppercase tracking-wider font-semibold">Execution</div>
              {totalNodes > 0 && <Row label="Total nodes" value={`${totalNodes}`} />}
              {totalEdges > 0 && <Row label="Total edges" value={`${totalEdges}`} />}
              {fullResult?.main_arguments && (
                <Row label="Main args" value={`${fullResult.main_arguments.length}`} />
              )}
            </>
          )}

          {/* Token Usage */}
          {tokenUsage && (
            <>
              <div className="h-px bg-card-border/30 my-1" />
              <div className="text-[9px] text-muted uppercase tracking-wider font-semibold">Tokens</div>
              {tokenUsage.total_input != null && (
                <Row label="Input" value={tokenUsage.total_input.toLocaleString()} />
              )}
              {tokenUsage.total_output != null && (
                <Row label="Output" value={tokenUsage.total_output.toLocaleString()} />
              )}
            </>
          )}

          {/* Runtime */}
          {runtime?.total_seconds != null && (
            <>
              <div className="h-px bg-card-border/30 my-1" />
              <Row label="Runtime" value={`${runtime.total_seconds.toFixed(1)}s`} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted">{label}</span>
      <span className="text-[10px] font-mono text-foreground">{value}</span>
    </div>
  )
}
