'use client'

// ─── Crux Card (Playing Card Style) ──────────────────────────
// Black/red/white theme matching the rest of the app.
// Compact sidebar format. Click to expand details.

import { useState } from 'react'
import type { CruxCard as CruxCardType } from '@/lib/crux/types'

// Suit symbols cycle through the 4 suits by index
const SUITS = ['♠', '♥', '♦', '♣'] as const
const SUIT_COLORS = ['text-foreground', 'text-accent', 'text-accent', 'text-foreground'] as const

const DISAGREEMENT_LABEL: Record<string, string> = {
  horizon: 'Time Horizon',
  evidence: 'Evidence',
  values: 'Values',
  definition: 'Definition',
  claim: 'Claim',
  premise: 'Premise',
}

// Assign a stable suit to a card based on its id
function getSuit(cardId: string): { symbol: string; color: string } {
  const idx = cardId.charCodeAt(cardId.length - 1) % 4
  return { symbol: SUITS[idx], color: SUIT_COLORS[idx] }
}

interface PlayingCardProps {
  card: CruxCardType
  personaNames: Map<string, string>
  index?: number
}

export function PlayingCard({ card, personaNames, index = 0 }: PlayingCardProps) {
  const [expanded, setExpanded] = useState(false)
  const suit = getSuit(card.id)
  const personas = Object.entries(card.personas)
  const rank = DISAGREEMENT_LABEL[card.disagreementType] ?? card.disagreementType

  if (expanded) {
    return (
      <div
        className="rounded-xl border border-accent bg-card-bg p-4 cursor-pointer shadow-[0_0_12px_rgba(220,38,38,0.15)] transition-all"
        onClick={() => setExpanded(false)}
      >
        {/* Expanded header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-lg ${suit.color}`}>{suit.symbol}</span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">{rank}</div>
              {card.resolved && (
                <div className="text-xs text-accent font-semibold">✓ Resolved</div>
              )}
            </div>
          </div>
          <button className="text-xs text-muted hover:text-foreground">collapse ↑</button>
        </div>

        {/* Question */}
        <h3 className="text-sm font-bold text-foreground mb-3 leading-tight">
          {card.question}
        </h3>

        {/* Diagnosis */}
        <div className="bg-surface rounded-lg p-3 mb-3 border border-card-border">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Root Cause</div>
          <p className="text-sm text-foreground">{card.diagnosis}</p>
        </div>

        {/* Personas */}
        <div className="space-y-2">
          {personas.map(([personaId, data]) => {
            const name = personaNames.get(personaId) ?? personaId
            const positionColor =
              data.position === 'YES' ? 'text-green-400 border-green-600' :
              data.position === 'NO' ? 'text-accent border-accent' :
              'text-muted border-muted'

            return (
              <div key={personaId} className={`rounded-lg p-2.5 border-l-2 bg-surface ${positionColor}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{name}</span>
                  <span className={`text-xs font-bold ${positionColor.split(' ')[0]}`}>
                    {data.position}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{data.reasoning}</p>
                {data.falsifier && (
                  <p className="text-xs text-muted italic mt-1.5 border-t border-card-border pt-1.5">
                    Changes mind if: {data.falsifier}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {card.resolution && (
          <div className="mt-3 p-2.5 rounded-lg bg-surface border border-card-border">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Resolution</div>
            <p className="text-xs text-foreground">{card.resolution}</p>
          </div>
        )}
      </div>
    )
  }

  // ─── Compact card (sidebar view) ──────────────────────────
  return (
    <div
      className="relative rounded-xl border border-card-border bg-card-bg cursor-pointer hover:border-accent transition-all hover:shadow-[0_0_8px_rgba(220,38,38,0.2)] select-none"
      onClick={() => setExpanded(true)}
    >
      {/* Card body */}
      <div className="p-3">
        {/* Top corner */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className={`text-base font-bold ${suit.color}`}>{suit.symbol}</span>
            <div className="text-xs text-muted uppercase tracking-wider mt-0.5">{rank}</div>
          </div>
          {card.resolved && (
            <span className="text-xs text-accent font-semibold">✓</span>
          )}
        </div>

        {/* Question */}
        <p className="text-xs font-semibold text-foreground leading-tight mb-2.5 line-clamp-3">
          {card.question}
        </p>

        {/* Persona positions */}
        <div className="space-y-1">
          {personas.map(([personaId, data]) => {
            const name = personaNames.get(personaId) ?? personaId
            const posColor =
              data.position === 'YES' ? 'text-green-400' :
              data.position === 'NO' ? 'text-accent' :
              'text-muted'
            return (
              <div key={personaId} className="flex items-center justify-between">
                <span className="text-xs text-muted truncate max-w-[70%]">{name}</span>
                <span className={`text-xs font-bold ${posColor}`}>{data.position}</span>
              </div>
            )
          })}
        </div>

        {/* Bottom corner (flipped suit symbol like a real card) */}
        <div className="flex justify-end mt-2">
          <span className={`text-xs font-bold ${suit.color} rotate-180 inline-block`}>{suit.symbol}</span>
        </div>
      </div>
    </div>
  )
}
