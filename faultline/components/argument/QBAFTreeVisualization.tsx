'use client'

import { useState } from 'react'
import type { QBAFHierarchyNode, QBAFStrength } from '@/lib/argument/types'

interface QBAFTreeVisualizationProps {
  hierarchy: QBAFHierarchyNode[]
  strengths: QBAFStrength[]
}

function TreeNode({ node, depth, isWinner }: { node: QBAFHierarchyNode; depth: number; isWinner?: boolean }) {
  const [collapsed, setCollapsed] = useState(depth > 1)
  const children = node.supplementary_args ?? []
  const hasChildren = children.length > 0

  const isRoot = depth === 0
  const isAttack = node.relation === 'attack'
  const isSupport = node.relation === 'support'

  const borderClass = isAttack
    ? 'border-l-accent'
    : isSupport
      ? 'border-l-card-border/60'
      : 'border-l-foreground/30'

  const initial = node.initial_score
  const final = node.final_score
  const lift = initial !== null && final !== null ? final - initial : null

  // Count support/attack edges in subtree
  const countEdges = (n: QBAFHierarchyNode): { s: number; a: number } => {
    let s = 0, a = 0
    for (const child of n.supplementary_args ?? []) {
      if (child.relation === 'support') s++
      else if (child.relation === 'attack') a++
      const sub = countEdges(child)
      s += sub.s
      a += sub.a
    }
    return { s, a }
  }

  const edges = isRoot ? countEdges(node) : null

  return (
    <div className={depth > 0 ? `ml-4 border-l-2 ${borderClass}` : ''}>
      <div
        className={`${depth > 0 ? 'pl-3' : ''} py-1.5 ${hasChildren ? 'cursor-pointer' : ''}`}
        onClick={() => hasChildren && setCollapsed(!collapsed)}
      >
        {/* Header row */}
        <div className="flex items-start gap-2">
          {/* Relation badge */}
          {isAttack && <span className="text-[9px] font-bold text-accent mt-0.5 flex-shrink-0">[-]</span>}
          {isSupport && <span className="text-[9px] font-bold text-muted mt-0.5 flex-shrink-0">[+]</span>}

          <div className="flex-1 min-w-0">
            {/* Root header */}
            {isRoot && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-foreground">{node.expert}</span>
                {isWinner && (
                  <span className="text-[9px] font-bold tracking-wider text-accent border border-accent/40 px-1.5 py-0.5 rounded">
                    WINNER
                  </span>
                )}
                {edges && (
                  <span className="text-[10px] text-muted">
                    {edges.s}+ {edges.a}-
                  </span>
                )}
                {hasChildren && (
                  <span className="text-[10px] text-muted/50">{collapsed ? '\u25B6' : '\u25BC'}</span>
                )}
              </div>
            )}

            {/* Statement */}
            <p className={`text-sm leading-relaxed ${isRoot ? 'text-foreground' : 'text-foreground/80'} ${
              collapsed && !isRoot ? 'line-clamp-2' : ''
            }`}>
              {node.statement}
            </p>

            {/* Scores */}
            <div className="flex items-center gap-2 mt-0.5">
              {initial !== null && (
                <span className="text-[10px] font-mono text-muted">{'\u03C4'}={initial.toFixed(2)}</span>
              )}
              {final !== null && (
                <span className="text-[10px] font-mono text-foreground">{'\u03C3'}={final.toFixed(2)}</span>
              )}
              {lift !== null && (
                <span className={`text-[10px] font-mono font-semibold ${lift >= 0 ? 'text-foreground' : 'text-accent'}`}>
                  {lift >= 0 ? '+' : ''}{lift.toFixed(2)}
                </span>
              )}
              {!isRoot && hasChildren && (
                <span className="text-[10px] text-muted/50">{collapsed ? '\u25B6' : '\u25BC'} {children.length}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Children */}
      {!collapsed && children.map((child, i) => (
        <TreeNode key={child.node_id ?? i} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function QBAFTreeVisualization({ hierarchy, strengths }: QBAFTreeVisualizationProps) {
  if (hierarchy.length === 0 && strengths.length === 0) return null

  // Find winner (highest final_score among main arguments)
  const mainArgs = hierarchy.filter(n => n.type === 'main_argument')
  let winnerNodeId: number | null = null
  let maxScore = -Infinity
  for (const arg of mainArgs) {
    if (arg.final_score !== null && arg.final_score > maxScore) {
      maxScore = arg.final_score
      winnerNodeId = arg.node_id
    }
  }

  // Fallback to flat strengths if no hierarchy
  if (hierarchy.length === 0) {
    return (
      <div className="bg-card-bg border border-card-border rounded-lg p-4">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">QBAF Strengths</h2>
        <div className="space-y-3">
          {strengths.map((s, i) => (
            <div key={i} className="border-l-2 border-l-foreground/30 pl-3 py-1">
              <span className="text-xs font-medium text-foreground">{s.expert}</span>
              <p className="text-sm text-foreground/80 line-clamp-3 mt-0.5">{s.statement}</p>
              <div className="flex gap-2 mt-0.5">
                {s.initial_score !== null && <span className="text-[10px] font-mono text-muted">{'\u03C4'}={s.initial_score.toFixed(2)}</span>}
                {s.final_score !== null && <span className="text-[10px] font-mono text-accent">{'\u03C3'}={s.final_score.toFixed(2)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-4">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">QBAF Argument Trees</h2>
      <div className="space-y-5">
        {mainArgs.map((node, i) => (
          <div key={node.node_id ?? i} className="border border-card-border rounded-lg p-3">
            <TreeNode
              node={node}
              depth={0}
              isWinner={node.node_id === winnerNodeId}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
