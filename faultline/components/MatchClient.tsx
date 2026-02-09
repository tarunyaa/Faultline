'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useDebateStream } from '@/lib/hooks/useDebateStream'

interface PersonaMeta {
  id: string
  name: string
  picture: string
}

interface MatchClientProps {
  topic: string
  personaIds: string[]
  personaMetas: PersonaMeta[]
}

function stanceBadge(stance: string) {
  const colors: Record<string, string> = {
    pro: 'bg-green-900/50 text-green-400',
    con: 'bg-red-900/50 text-red-400',
    uncertain: 'bg-yellow-900/50 text-yellow-400',
  }
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${colors[stance] ?? 'bg-card-border text-muted'}`}>
      {stance}
    </span>
  )
}

export default function MatchClient({ topic, personaIds, personaMetas }: MatchClientProps) {
  const [state, { start, abort }] = useDebateStream()
  const feedRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const startedRef = useRef(false)

  const metaMap = new Map(personaMetas.map(p => [p.id, p]))

  // Auto-start the debate on mount
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      start({ topic, personaIds })
    }
    return () => { abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll feed
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [state.messages, autoScroll])

  function handleFeedScroll() {
    if (!feedRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 60
    setAutoScroll(atBottom)
  }

  const statusLabel = {
    idle: 'Idle',
    connecting: 'Connecting...',
    streaming: 'Debate in progress',
    completed: 'Debate complete',
    error: 'Error',
  }[state.status]

  const statusColor = {
    idle: 'text-muted',
    connecting: 'text-yellow-400',
    streaming: 'text-accent',
    completed: 'text-accent',
    error: 'text-danger',
  }[state.status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{topic}</h1>
          <p className={`text-sm ${statusColor}`}>
            {state.status === 'streaming' && (
              <span className="inline-block w-2 h-2 rounded-full bg-accent mr-2 animate-pulse" />
            )}
            {statusLabel}
          </p>
        </div>
        <Link href="/setup" className="text-muted hover:text-foreground text-sm shrink-0">
          &larr; Setup
        </Link>
      </div>

      {/* Claims */}
      {state.claims.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Claims Under Debate
          </h2>
          <ul className="space-y-1">
            {state.claims.map((claim) => (
              <li key={claim.id} className="text-sm text-foreground/90 flex items-start gap-2">
                <span className="text-accent mt-0.5 shrink-0">&#x2022;</span>
                {claim.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main grid: feed + sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Message feed */}
        <div className="lg:col-span-2">
          <div
            ref={feedRef}
            onScroll={handleFeedScroll}
            className="rounded-xl border border-card-border bg-card-bg p-4 space-y-4 overflow-y-auto"
            style={{ maxHeight: '60vh', minHeight: '300px' }}
          >
            {(state.status === 'connecting' || (state.status === 'streaming' && state.messages.length === 0)) && (
              <div className="flex flex-col items-center justify-center h-40 text-muted gap-3">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">{state.statusMessage ?? 'Connecting to debate engine...'}</span>
              </div>
            )}

            {state.messages.map((msg, i) => {
              const meta = metaMap.get(msg.personaId)
              return (
                <div key={i} className="flex items-start gap-3">
                  {meta?.picture ? (
                    <Image
                      src={meta.picture}
                      alt={meta.name ?? msg.personaId}
                      width={36}
                      height={36}
                      className="rounded-full shrink-0 mt-0.5"
                      unoptimized
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-card-border shrink-0 flex items-center justify-center text-muted text-sm font-bold mt-0.5">
                      {(meta?.name ?? msg.personaId).charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{meta?.name ?? msg.personaId}</span>
                      {stanceBadge(msg.stance.stance)}
                      <span className="text-xs text-muted">
                        {(msg.stance.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-foreground/85 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              )
            })}

          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Convergence */}
          <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Convergence
            </h2>
            {state.convergence ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Entropy</span>
                  <span>{state.convergence.entropy.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Confidence dist.</span>
                  <span>{state.convergence.confidenceWeightedDistance.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Unresolved cruxes</span>
                  <span>{state.convergence.unresolvedCruxCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Events</span>
                  <span>{state.convergence.eventCount} / {state.convergence.maxEvents}</span>
                </div>
                {state.convergence.converged && (
                  <p className="text-accent text-xs font-medium pt-1">Converged</p>
                )}
                {state.convergence.diverged && (
                  <p className="text-danger text-xs font-medium pt-1">Diverged</p>
                )}
              </div>
            ) : (
              <p className="text-muted text-sm">No data yet</p>
            )}
          </div>

          {/* Cruxes */}
          <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Cruxes
            </h2>
            {state.cruxes.length > 0 ? (
              <ul className="space-y-2">
                {state.cruxes.map((crux) => (
                  <li key={crux.id} className="text-sm">
                    <span className={crux.resolved ? 'line-through text-muted' : 'text-foreground/90'}>
                      {crux.proposition}
                    </span>
                    <span className="text-xs text-muted ml-2">
                      w={crux.weight.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">No cruxes surfaced</p>
            )}
          </div>

          {/* Flip Conditions */}
          <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Flip Conditions
            </h2>
            {state.flipConditions.length > 0 ? (
              <ul className="space-y-2">
                {state.flipConditions.map((fc, i) => {
                  const meta = metaMap.get(fc.personaId)
                  return (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{meta?.name ?? fc.personaId}:</span>{' '}
                      <span className={fc.triggered ? 'text-accent' : 'text-foreground/80'}>
                        {fc.condition}
                      </span>
                      {fc.triggered && (
                        <span className="text-xs text-accent ml-1">(triggered)</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-muted text-sm">None triggered</p>
            )}
          </div>
        </div>
      </div>

      {/* Error display */}
      {state.status === 'error' && state.error && (
        <div className="rounded-xl border border-danger/50 bg-danger/10 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-danger">Error</h2>
          <p className="text-sm text-foreground/80">{state.error}</p>
          <Link
            href="/setup"
            className="inline-block text-sm text-accent hover:underline"
          >
            Return to setup
          </Link>
        </div>
      )}

      {/* Output panel — shown on debate_complete */}
      {state.output && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-6 space-y-6">
          <h2 className="text-xl font-bold text-accent">Debate Results</h2>

          {/* Cruxes */}
          {state.output.cruxes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Key Cruxes</h3>
              <ul className="space-y-2">
                {state.output.cruxes.map((crux) => (
                  <li key={crux.id} className="text-sm">
                    <span className={crux.resolved ? 'text-muted' : 'text-foreground/90'}>
                      {crux.proposition}
                    </span>
                    <span className="text-xs text-muted ml-2">
                      weight: {crux.weight.toFixed(2)} {crux.resolved ? '(resolved)' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fault Lines */}
          {state.output.faultLines.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Fault Lines</h3>
              <ul className="space-y-3">
                {state.output.faultLines.map((fl, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-xs uppercase tracking-wide text-accent/70">{fl.category.replace('_', ' ')}</span>
                    <p className="text-foreground/90 mt-0.5">{fl.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence Ledger */}
          {state.output.evidenceLedger.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Evidence Ledger</h3>
              {state.output.evidenceLedger.map((entry, i) => {
                const meta = metaMap.get(entry.personaId)
                return (
                  <div key={i} className="text-sm space-y-1">
                    <p className="font-medium">{meta?.name ?? entry.personaId}</p>
                    {entry.accepted.length > 0 && (
                      <div className="pl-3">
                        <span className="text-xs text-accent">Accepted:</span>
                        <ul className="list-disc list-inside text-foreground/80">
                          {entry.accepted.map((a, j) => <li key={j}>{a}</li>)}
                        </ul>
                      </div>
                    )}
                    {entry.rejected.length > 0 && (
                      <div className="pl-3">
                        <span className="text-xs text-danger">Rejected:</span>
                        <ul className="list-disc list-inside text-foreground/80">
                          {entry.rejected.map((r, j) => (
                            <li key={j}>{r.evidence} — <span className="text-muted italic">{r.reason}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Resolution Paths */}
          {state.output.resolutionPaths.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Resolution Paths</h3>
              <ul className="space-y-2">
                {state.output.resolutionPaths.map((rp, i) => (
                  <li key={i} className="text-sm text-foreground/90">{rp.description}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
