'use client'

import { useState } from 'react'
import type { ArgumentCruxCard as ArgumentCruxCardType, FlipCondition } from '@/lib/argument/types'

const SUITS = ['♠', '♥', '♦', '♣'] as const
const SUIT_COLORS = ['text-foreground', 'text-accent', 'text-accent', 'text-foreground'] as const

const CRUX_TYPE_SUIT: Record<string, number> = {
  evidence: 1, values: 2, claim: 1, premise: 2, definition: 0, horizon: 3,
}
const CRUX_TYPE_LABEL: Record<string, string> = {
  evidence: 'Evidence', values: 'Values', definition: 'Definition',
  horizon: 'Time Horizon', claim: 'Claim', premise: 'Premise',
}

function stripMd(text: string): string {
  return text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim()
}

// ─── ArgumentCruxCard — playing card style ────────────────────
interface ArgumentCruxCardProps {
  card: ArgumentCruxCardType
}

export function ArgumentCruxCard({ card }: ArgumentCruxCardProps) {
  const [expanded, setExpanded] = useState(false)
  const suitIdx = CRUX_TYPE_SUIT[card.crux_type] ?? 0
  const suit = SUITS[suitIdx]
  const suitColor = SUIT_COLORS[suitIdx]
  const typeLabel = CRUX_TYPE_LABEL[card.crux_type] ?? card.crux_type

  if (expanded) {
    return (
      <div
        className="rounded-lg border border-accent bg-card-bg p-3 shadow-[0_0_12px_rgba(220,38,38,0.15)] cursor-pointer w-72 flex-shrink-0"
        onClick={() => setExpanded(false)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm ${suitColor}`}>{suit}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{typeLabel}</span>
            {card.winner_critical && <span className="text-[9px] font-bold text-accent">●</span>}
          </div>
          <span className="text-[10px] text-muted">collapse ↑</span>
        </div>

        <h3 className="text-xs font-bold text-foreground mb-2 leading-snug">{stripMd(card.question)}</h3>

        <div className="bg-surface rounded p-2 mb-2 border border-card-border">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">How It Flips the Outcome</div>
          <p className="text-[11px] text-foreground leading-snug">{stripMd(card.flip_mechanism)}</p>
        </div>

        <div className="flex items-center justify-between text-[10px]">
          {card.expert && <span className="text-muted">via {card.expert}</span>}
          <span className={`font-mono font-semibold ml-auto ${card.delta >= 0 ? 'text-foreground' : 'text-accent'}`}>
            δ {card.delta >= 0 ? '+' : ''}{card.delta.toFixed(4)}
          </span>
        </div>

        {card.winner_critical && (
          <div className="mt-2 text-[9px] font-bold text-accent uppercase tracking-wider">Outcome-Critical</div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => setExpanded(true)}
      className="relative flex-shrink-0 rounded-lg border border-card-border bg-card-bg cursor-pointer hover:border-accent hover:shadow-[0_0_14px_rgba(220,38,38,0.2)] transition-all overflow-hidden select-none w-40"
      style={{ aspectRatio: '5/7' }}
    >
      <div className="absolute inset-[5px] rounded border border-card-border/25 pointer-events-none" />

      <div className="absolute top-2 left-2.5 flex flex-col items-center leading-none gap-[2px]">
        <span className={`text-sm font-bold leading-none ${suitColor}`}>{suit}</span>
        <span className="text-[7px] text-muted uppercase tracking-wide leading-none">{typeLabel.charAt(0)}</span>
      </div>

      <div className="absolute bottom-2 right-2.5 flex flex-col items-center leading-none gap-[2px] rotate-180">
        <span className={`text-sm font-bold leading-none ${suitColor}`}>{suit}</span>
        <span className="text-[7px] text-muted uppercase tracking-wide leading-none">{typeLabel.charAt(0)}</span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`text-7xl ${suitColor} opacity-[0.04] leading-none`}>{suit}</span>
      </div>

      {card.winner_critical && (
        <div className="absolute top-2 right-2.5">
          <span className="text-[9px] text-accent font-bold">●</span>
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[9px] font-medium text-foreground leading-snug line-clamp-5">{stripMd(card.question)}</p>
      </div>

      <div className="absolute bottom-7 left-3 right-3 border-t border-card-border/30 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted leading-none">{typeLabel}</span>
          <span className={`text-[9px] font-mono leading-none ${card.delta >= 0 ? 'text-foreground' : 'text-accent'}`}>
            {card.delta >= 0 ? '+' : ''}{card.delta.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── FlipConditionCard — playing card style for raw flip conditions ──
interface FlipConditionCardProps {
  condition: FlipCondition
  index: number
}

export function FlipConditionCard({ condition, index }: FlipConditionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const suitIdx = condition.winner_critical ? (index % 2 === 0 ? 1 : 2) : (index % 2 === 0 ? 0 : 3)
  const suit = SUITS[suitIdx]
  const suitColor = SUIT_COLORS[suitIdx]

  if (expanded) {
    return (
      <div
        className="rounded-lg border border-accent bg-card-bg p-3 shadow-[0_0_12px_rgba(220,38,38,0.15)] cursor-pointer w-72 flex-shrink-0"
        onClick={() => setExpanded(false)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm ${suitColor}`}>{suit}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Fault Line</span>
            {condition.winner_critical && <span className="text-[9px] font-bold text-accent">●</span>}
          </div>
          <span className="text-[10px] text-muted">collapse ↑</span>
        </div>

        <p className="text-xs font-semibold text-foreground mb-2 leading-snug">{condition.statement}</p>

        <div className="bg-surface rounded p-2 mb-2 border border-card-border">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">Parent Argument</div>
          <p className="text-[11px] text-muted leading-snug">{condition.main_argument}</p>
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted">via {condition.expert}</span>
          <span className={`font-mono font-semibold ${condition.delta >= 0 ? 'text-foreground' : 'text-accent'}`}>
            δ {condition.delta >= 0 ? '+' : ''}{condition.delta.toFixed(4)}
          </span>
        </div>

        {condition.winner_critical && (
          <div className="mt-2 text-[9px] font-bold text-accent uppercase tracking-wider">Outcome-Critical</div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => setExpanded(true)}
      className="relative flex-shrink-0 rounded-lg border border-card-border bg-card-bg cursor-pointer hover:border-accent hover:shadow-[0_0_14px_rgba(220,38,38,0.2)] transition-all overflow-hidden select-none w-40"
      style={{ aspectRatio: '5/7' }}
    >
      <div className="absolute inset-[5px] rounded border border-card-border/25 pointer-events-none" />

      <div className="absolute top-2 left-2.5 flex flex-col items-center leading-none gap-[2px]">
        <span className={`text-sm font-bold leading-none ${suitColor}`}>{suit}</span>
        <span className="text-[7px] text-muted uppercase tracking-wide leading-none">FL</span>
      </div>

      <div className="absolute bottom-2 right-2.5 flex flex-col items-center leading-none gap-[2px] rotate-180">
        <span className={`text-sm font-bold leading-none ${suitColor}`}>{suit}</span>
        <span className="text-[7px] text-muted uppercase tracking-wide leading-none">FL</span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`text-7xl ${suitColor} opacity-[0.04] leading-none`}>{suit}</span>
      </div>

      {condition.winner_critical && (
        <div className="absolute top-2 right-2.5">
          <span className="text-[9px] text-accent font-bold">●</span>
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-[9px] font-medium text-foreground leading-snug line-clamp-5">{condition.statement}</p>
      </div>

      <div className="absolute bottom-7 left-3 right-3 border-t border-card-border/30 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted leading-none">{condition.expert.split(' ')[0]}</span>
          <span className={`text-[9px] font-mono leading-none ${condition.delta >= 0 ? 'text-foreground' : 'text-accent'}`}>
            {condition.delta >= 0 ? '+' : ''}{condition.delta.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  )
}
