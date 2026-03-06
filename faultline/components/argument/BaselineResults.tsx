'use client'

import { useState } from 'react'
import type { BaselineResult } from '@/lib/argument/types'

interface BaselineResultsProps {
  results: BaselineResult[]
  argoraAnswer?: string
}

function extractFinalAnswer(text: string | null): string {
  if (!text) return '?'
  const match = text.match(/FINAL ANSWER:\s*([A-Z])/i)
  return match ? match[1].toUpperCase() : '?'
}

export function BaselineResults({ results, argoraAnswer }: BaselineResultsProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (results.length === 0) return null

  return (
    <div className="bg-card-bg border border-card-border rounded-lg p-4">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Baseline Comparison</h2>

      <div className="space-y-2">
        {/* ARGORA row */}
        {argoraAnswer && (
          <div className="flex items-center justify-between py-1.5 px-2 bg-surface rounded">
            <span className="text-xs font-medium text-foreground">ARGORA</span>
            <span className="text-xs font-mono font-bold text-accent">{argoraAnswer}</span>
          </div>
        )}

        {/* Baseline rows */}
        {results.map(r => {
          const answer = r.answer || extractFinalAnswer(r.reasoning)
          const agrees = argoraAnswer && answer === argoraAnswer
          const isExpanded = expanded === r.method

          return (
            <div key={r.method}>
              <button
                onClick={() => setExpanded(isExpanded ? null : r.method)}
                className="w-full flex items-center justify-between py-1.5 px-2 bg-surface rounded hover:bg-surface/80 transition-colors"
              >
                <span className="text-xs text-muted">{r.label}</span>
                <div className="flex items-center gap-2">
                  {r.error ? (
                    <span className="text-[10px] text-accent">error</span>
                  ) : (
                    <>
                      <span className={`text-xs font-mono font-bold ${agrees ? 'text-foreground' : 'text-accent'}`}>
                        {answer}
                      </span>
                      {agrees !== undefined && (
                        <span className={`text-[10px] ${agrees ? 'text-foreground/50' : 'text-accent'}`}>
                          {agrees ? '\u2713' : '\u2717'}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </button>
              {isExpanded && r.reasoning && (
                <div className="mt-1 px-2 py-2 text-xs text-muted leading-relaxed bg-background rounded border border-card-border max-h-40 overflow-y-auto">
                  {r.reasoning}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
