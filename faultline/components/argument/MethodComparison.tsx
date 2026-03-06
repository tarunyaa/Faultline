'use client'

import { useState } from 'react'
import type { BaselineResult, ConsensusData } from '@/lib/argument/types'

interface MethodEntry {
  id: string
  label: string
  answer: string
  answerLetter: string | null
  reasoning: string | null
  isArgora: boolean
}

interface MethodComparisonProps {
  results: BaselineResult[]
  consensus: ConsensusData | null
  topic: string
}

function extractFinalAnswer(text: string | null): string {
  if (!text) return '?'
  const match = text.match(/FINAL\s*ANSWER:\s*(.+?)(?:\n|$)/i)
  if (match) return match[1].trim()
  return text.length > 120 ? text.slice(0, 120) + '...' : text
}

function extractLetter(text: string | null): string | null {
  if (!text) return null
  // Try FINAL ANSWER: X pattern first
  const finalMatch = text.match(/FINAL\s*ANSWER:\s*([A-J])\b/i)
  if (finalMatch) return finalMatch[1].toUpperCase()
  // Try "X." or standalone letter at start
  const startMatch = text.match(/^([A-J])[\.\)\s]/i)
  if (startMatch) return startMatch[1].toUpperCase()
  return null
}

export function MethodComparison({ results, consensus, topic }: MethodComparisonProps) {
  const [preferred, setPreferred] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const methods: MethodEntry[] = []

  // ARGORA entry
  if (consensus) {
    const text = consensus.consensus_text || consensus.winner || ''
    methods.push({
      id: 'argora',
      label: 'ARGORA',
      answer: extractFinalAnswer(text),
      answerLetter: extractLetter(text),
      reasoning: consensus.consensus_text,
      isArgora: true,
    })
  }

  // Baseline entries
  for (const r of results) {
    if (r.error) {
      methods.push({
        id: r.method,
        label: r.label,
        answer: 'Error',
        answerLetter: null,
        reasoning: r.error,
        isArgora: false,
      })
    } else {
      methods.push({
        id: r.method,
        label: r.label,
        answer: extractFinalAnswer(r.answer),
        answerLetter: extractLetter(r.answer),
        reasoning: r.reasoning || r.answer,
        isArgora: false,
      })
    }
  }

  if (methods.length === 0) return null

  const argoraLetter = methods[0]?.answerLetter
  const allLetters = methods.map(m => m.answerLetter).filter(Boolean)
  const allAgree = allLetters.length > 1 && allLetters.every(l => l === allLetters[0])

  // Count agreements per answer letter
  const letterCounts: Record<string, number> = {}
  for (const l of allLetters) {
    if (l) letterCounts[l] = (letterCounts[l] || 0) + 1
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-card-border">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">
            Method Comparison
          </h2>
          {allAgree ? (
            <span className="text-[10px] px-2 py-0.5 rounded bg-foreground/10 text-foreground/50 font-medium">
              Unanimous
            </span>
          ) : Object.keys(letterCounts).length > 1 ? (
            <span className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent font-medium">
              Split decision
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-muted leading-snug line-clamp-1">{topic}</p>
      </div>

      {/* Answer summary bar */}
      {Object.keys(letterCounts).length > 0 && (
        <div className="px-5 py-2.5 border-b border-card-border bg-surface/30 flex items-center gap-3">
          {Object.entries(letterCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([letter, count]) => (
              <div key={letter} className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-surface border border-card-border flex items-center justify-center text-[10px] font-mono font-bold text-foreground">
                  {letter}
                </span>
                <span className="text-[10px] text-muted">
                  {count}/{methods.length}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Method cards */}
      <div className="divide-y divide-card-border/50">
        {methods.map(method => {
          const isExpanded = expandedId === method.id
          const isPreferred = preferred === method.id
          const agreesWithArgora = method.isArgora || (argoraLetter && method.answerLetter === argoraLetter)

          return (
            <div key={method.id}>
              <div className={`px-5 py-3 flex items-start gap-3 transition-colors ${
                isPreferred ? 'bg-accent/5' : ''
              }`}>
                {/* Vote radio */}
                <button
                  onClick={() => setPreferred(isPreferred ? null : method.id)}
                  className={`mt-0.5 flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all ${
                    isPreferred
                      ? 'border-accent bg-accent'
                      : 'border-card-border hover:border-foreground/30'
                  }`}
                  title={isPreferred ? 'Remove preference' : 'Mark as best'}
                >
                  {isPreferred && (
                    <div className="w-1.5 h-1.5 rounded-full bg-background" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium ${
                      method.isArgora ? 'text-accent' : 'text-foreground'
                    }`}>
                      {method.label}
                    </span>
                    {method.isArgora && (
                      <span className="text-[9px] px-1.5 py-px rounded bg-accent/10 text-accent font-medium uppercase tracking-wider">
                        Full pipeline
                      </span>
                    )}
                    {!method.isArgora && agreesWithArgora && (
                      <span className="text-[10px] text-foreground/30">agrees</span>
                    )}
                    {!method.isArgora && !agreesWithArgora && argoraLetter && method.answerLetter && (
                      <span className="text-[10px] text-accent/50">disagrees</span>
                    )}
                  </div>

                  <p className="text-sm text-foreground/80 leading-snug line-clamp-2">
                    {method.answer}
                  </p>

                  {method.reasoning && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : method.id)}
                      className="mt-1 text-[10px] text-muted hover:text-foreground transition-colors uppercase tracking-wider"
                    >
                      {isExpanded ? 'Hide reasoning' : 'Show reasoning'}
                    </button>
                  )}
                </div>

                {/* Answer letter badge */}
                {method.answerLetter && (
                  <span className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs font-bold font-mono ${
                    method.isArgora
                      ? 'bg-accent/15 text-accent border border-accent/25'
                      : 'bg-surface text-foreground/70 border border-card-border'
                  }`}>
                    {method.answerLetter}
                  </span>
                )}
              </div>

              {/* Expanded reasoning */}
              {isExpanded && method.reasoning && (
                <div className="px-5 pb-3">
                  <div className="ml-[30px] p-3 bg-background rounded border border-card-border text-xs text-muted leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                    {method.reasoning}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Preference footer */}
      <div className="px-5 py-2.5 border-t border-card-border bg-surface/30">
        {preferred ? (
          <p className="text-[10px] text-muted">
            Preferred: <span className="text-foreground font-medium">{methods.find(m => m.id === preferred)?.label}</span>
            {' \u00b7 '}
            <button onClick={() => setPreferred(null)} className="text-accent hover:underline">
              Clear
            </button>
          </p>
        ) : (
          <p className="text-[10px] text-muted">
            Which method produced the best answer? Select one.
          </p>
        )}
      </div>
    </div>
  )
}
