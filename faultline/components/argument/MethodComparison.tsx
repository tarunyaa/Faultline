'use client'

import { useState } from 'react'
import type { BaselineResult, ConsensusData } from '@/lib/argument/types'
import { formatArgumentText } from '@/lib/utils/format-argument-text'

const SUITS = ['♠', '♥', '♦', '♣'] as const
const SUIT_COLORS = ['text-foreground', 'text-accent', 'text-accent', 'text-foreground'] as const

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
  const finalMatch = text.match(/FINAL\s*ANSWER:\s*([A-J])\b/i)
  if (finalMatch) return finalMatch[1].toUpperCase()
  const startMatch = text.match(/^([A-J])[\.)\s]/i)
  if (startMatch) return startMatch[1].toUpperCase()
  return null
}

function MethodCard({
  method,
  index,
  argoraLetter,
  preferred,
  onPrefer,
}: {
  method: MethodEntry
  index: number
  argoraLetter: string | null
  preferred: boolean
  onPrefer: () => void
}) {
  const [showReasoning, setShowReasoning] = useState(false)
  const suitIdx = index % 4
  const suit = SUITS[suitIdx]
  const suitColor = SUIT_COLORS[suitIdx]
  const isRed = suit === '♥' || suit === '♦'
  const agreesWithArgora = method.isArgora || (argoraLetter && method.answerLetter === argoraLetter)

  return (
    <div className={`flex-1 min-w-[220px] max-w-[320px] rounded-xl border bg-card-bg overflow-hidden transition-all ${
      preferred
        ? 'border-accent shadow-[0_0_12px_rgba(220,38,38,0.2)]'
        : 'border-card-border hover:border-muted'
    }`}>
      {/* Card header with suit */}
      <div className="px-4 py-2.5 border-b border-card-border/50 flex items-center gap-2">
        <span className={`text-sm ${suitColor}`}>{suit}</span>
        <span className={`text-xs font-semibold flex-1 ${method.isArgora ? 'text-accent' : 'text-foreground'}`}>
          {method.label}
        </span>
        {method.isArgora && (
          <span className="text-[8px] px-1.5 py-px rounded bg-accent/10 text-accent font-medium uppercase tracking-wider">
            Structured
          </span>
        )}
        {!method.isArgora && agreesWithArgora && (
          <span className="text-[9px] text-foreground/30">agrees</span>
        )}
        {!method.isArgora && !agreesWithArgora && argoraLetter && method.answerLetter && (
          <span className="text-[9px] text-accent/50">disagrees</span>
        )}
      </div>

      {/* Answer */}
      <div className="px-4 py-3 relative">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span className={`text-8xl ${isRed ? 'text-accent' : 'text-foreground'} opacity-[0.03] leading-none`}>{suit}</span>
        </div>

        <div className="relative">
          {/* Answer letter badge */}
          {method.answerLetter && (
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold font-mono ${
                method.isArgora
                  ? 'bg-accent/15 text-accent border border-accent/25'
                  : 'bg-surface text-foreground/70 border border-card-border'
              }`}>
                {method.answerLetter}
              </span>
              <span className="text-[10px] text-muted uppercase tracking-wider">Answer</span>
            </div>
          )}

          {/* Answer text */}
          <p className="text-sm text-foreground leading-snug line-clamp-3 font-medium">
            {method.answer}
          </p>
        </div>
      </div>

      {/* Footer with actions */}
      <div className="px-4 py-2 border-t border-card-border/30 flex items-center justify-between">
        <button
          onClick={onPrefer}
          className={`text-[10px] uppercase tracking-wider transition-colors ${
            preferred ? 'text-accent font-semibold' : 'text-muted hover:text-foreground'
          }`}
        >
          {preferred ? '★ Preferred' : 'Prefer'}
        </button>

        {method.reasoning && (
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="text-[10px] text-muted hover:text-foreground transition-colors uppercase tracking-wider"
          >
            {showReasoning ? 'Hide' : 'Reasoning'}
          </button>
        )}
      </div>

      {/* Expanded reasoning */}
      {showReasoning && method.reasoning && (
        <div className="px-4 pb-3 border-t border-card-border/30">
          <div className="p-3 bg-background rounded border border-card-border text-xs text-foreground leading-relaxed max-h-60 overflow-y-auto mt-2">
            {formatArgumentText(method.reasoning)}
          </div>
        </div>
      )}
    </div>
  )
}

export function MethodComparison({ results, consensus, topic }: MethodComparisonProps) {
  const [preferred, setPreferred] = useState<string | null>(null)

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
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-accent text-xs">♦</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Method Comparison</span>

        {/* Answer summary */}
        {Object.keys(letterCounts).length > 0 && (
          <div className="flex items-center gap-2 ml-2">
            {Object.entries(letterCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([letter, count]) => (
                <div key={letter} className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-surface border border-card-border flex items-center justify-center text-[10px] font-mono font-bold text-foreground">
                    {letter}
                  </span>
                  <span className="text-[10px] text-muted">{count}/{methods.length}</span>
                </div>
              ))}
          </div>
        )}

        <div className="flex-1 h-px bg-card-border opacity-60" />

        {allAgree ? (
          <span className="text-[10px] px-2 py-0.5 rounded bg-foreground/10 text-foreground/50 font-medium">Unanimous</span>
        ) : Object.keys(letterCounts).length > 1 ? (
          <span className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent font-medium">Split</span>
        ) : null}
      </div>

      {/* Side-by-side cards */}
      <div className="flex flex-wrap gap-4">
        {methods.map((method, i) => (
          <MethodCard
            key={method.id}
            method={method}
            index={i}
            argoraLetter={argoraLetter}
            preferred={preferred === method.id}
            onPrefer={() => setPreferred(preferred === method.id ? null : method.id)}
          />
        ))}
      </div>
    </div>
  )
}
