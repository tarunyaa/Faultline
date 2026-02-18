'use client'

// ─── Crux Card Component ─────────────────────────────────────

import type { CruxCard as CruxCardType } from '@/lib/crux/types'

interface CruxCardProps {
  card: CruxCardType
  personaNames: Map<string, string>
}

export function CruxCard({ card, personaNames }: CruxCardProps) {
  const disagreementTypeLabel: Record<string, string> = {
    horizon: 'Time Horizon',
    evidence: 'Evidence',
    values: 'Values',
    definition: 'Definition',
    claim: 'Claim',
    premise: 'Premise',
  }

  return (
    <div className="my-4 p-4 bg-purple-900/20 border border-purple-700 rounded-lg">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full" />
          <span className="text-sm font-semibold text-purple-300">
            CRUX CARD
          </span>
        </div>
        <span className="text-xs text-purple-400">
          {disagreementTypeLabel[card.disagreementType]}
        </span>
      </div>

      {/* Question */}
      <h3 className="text-lg font-bold text-purple-100 mb-3">
        {card.question}
      </h3>

      {/* Diagnosis */}
      <div className="mb-4 p-3 bg-purple-950/50 rounded">
        <div className="text-xs text-purple-400 mb-1">Root Cause</div>
        <div className="text-sm text-purple-200">{card.diagnosis}</div>
      </div>

      {/* Positions */}
      <div className="space-y-3">
        {Object.entries(card.personas).map(([personaId, data]) => {
          const name = personaNames.get(personaId) || personaId
          const positionColor = {
            YES: 'text-green-400',
            NO: 'text-red-400',
            NUANCED: 'text-yellow-400',
          }[data.position]

          return (
            <div key={personaId} className="border-l-2 border-purple-700 pl-3">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-200">
                  {name}
                </span>
                <span className={`text-xs font-bold ${positionColor}`}>
                  {data.position}
                </span>
              </div>
              <div className="text-sm text-gray-400 mb-1">
                {data.reasoning}
              </div>
              {data.falsifier && (
                <div className="text-xs text-purple-400 italic">
                  Falsifier: {data.falsifier}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Resolution */}
      {card.resolved && card.resolution && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded">
          <div className="text-xs text-green-400 mb-1">✓ Resolved</div>
          <div className="text-sm text-green-200">{card.resolution}</div>
        </div>
      )}

      {!card.resolved && (
        <div className="mt-4 text-xs text-purple-500 italic">
          Irreducible disagreement — valid perspectives diverge
        </div>
      )}
    </div>
  )
}
