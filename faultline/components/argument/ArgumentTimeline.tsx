'use client'

import { useRef, useEffect } from 'react'
import type { ArgumentMessage, TaskInfo } from '@/lib/argument/types'

// Deterministic expert colors within black/red/white palette
const EXPERT_COLORS = [
  'bg-accent/80 text-foreground',
  'bg-foreground/80 text-background',
  'bg-accent/40 text-foreground',
  'bg-foreground/40 text-foreground',
  'bg-accent/60 text-foreground',
]

function ExpertAvatar({ name, index }: { name: string; index: number }) {
  const initial = name.charAt(0).toUpperCase()
  const colorClass = EXPERT_COLORS[Math.abs(index) % EXPERT_COLORS.length]
  return (
    <span className={`w-7 h-7 flex-shrink-0 rounded-md flex items-center justify-center text-xs font-bold ${colorClass}`}>
      {initial}
    </span>
  )
}

function ScoreBadges({ initial, final }: { initial: number | null; final: number | null }) {
  if (initial === null && final === null) return null
  const lift = initial !== null && final !== null ? final - initial : null
  return (
    <span className="inline-flex items-center gap-2 text-[10px] text-muted">
      {initial !== null && <span className="font-mono">{'\u03C4'}={initial.toFixed(2)}</span>}
      {final !== null && <span className="font-mono text-foreground">{'\u03C3'}={final.toFixed(2)}</span>}
      {lift !== null && (
        <span className={`font-mono font-semibold ${lift >= 0 ? 'text-foreground' : 'text-accent'}`}>
          {lift >= 0 ? '+' : ''}{lift.toFixed(2)}
        </span>
      )}
    </span>
  )
}

function TypeBadge({ type }: { type: ArgumentMessage['type'] }) {
  if (type === 'main_argument') {
    return <span className="text-[9px] font-bold tracking-wider text-muted uppercase">main</span>
  }
  if (type === 'attack') {
    return <span className="text-[9px] font-bold tracking-wider text-accent uppercase">attack</span>
  }
  return <span className="text-[9px] font-bold tracking-wider text-muted/60 uppercase">support</span>
}

interface MessageRowProps {
  message: ArgumentMessage
  isWinner?: boolean
}

function MessageRow({ message, isWinner }: MessageRowProps) {
  const borderClass = message.type === 'attack'
    ? 'border-l-accent'
    : message.type === 'support'
      ? 'border-l-card-border/40'
      : 'border-l-foreground/30'

  return (
    <div style={{ paddingLeft: `${message.depth * 20}px` }}>
      <div className={`border-l-2 ${borderClass} pl-3 py-2`}>
        <div className="flex items-start gap-2">
          {message.depth === 0 && (
            <ExpertAvatar name={message.expertName} index={message.expertIndex} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-foreground truncate">{message.expertName}</span>
              <TypeBadge type={message.type} />
              {isWinner && (
                <span className="text-[9px] font-bold tracking-wider text-accent border border-accent/40 px-1.5 py-0.5 rounded">
                  WINNER
                </span>
              )}
              {message.scores && (
                <ScoreBadges initial={message.scores.initial} final={message.scores.final} />
              )}
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhaseDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-card-border" />
      <span className="text-[10px] text-muted uppercase tracking-widest flex-shrink-0">{label}</span>
      <div className="flex-1 h-px bg-card-border" />
    </div>
  )
}

interface ArgumentTimelineProps {
  messages: ArgumentMessage[]
  task: TaskInfo | null
  phase: string
  winnerStatement?: string
}

export function ArgumentTimeline({ messages, task, phase, winnerStatement }: ArgumentTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isBuilding = !['idle', 'complete', 'error', 'baselines'].includes(phase)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  // Group messages: main arguments at depth 0, sub-arguments nested below
  const mainArgs = messages.filter(m => m.depth === 0)
  const subArgs = messages.filter(m => m.depth > 0)

  // Build a map of parentId -> children for threading
  const childrenByParent = new Map<string, ArgumentMessage[]>()
  for (const msg of subArgs) {
    if (!msg.parentId) continue
    const children = childrenByParent.get(msg.parentId) ?? []
    children.push(msg)
    childrenByParent.set(msg.parentId, children)
  }

  function renderThread(msg: ArgumentMessage) {
    const children = childrenByParent.get(msg.id) ?? []
    const isWinner = winnerStatement ? msg.content === winnerStatement : false
    return (
      <div key={msg.id}>
        <MessageRow message={msg} isWinner={isWinner} />
        {children.map(child => renderThread(child))}
      </div>
    )
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-lg flex flex-col h-full">
      <div className="px-4 py-3 border-b border-card-border">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Debate</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1 max-h-[70vh]">
        {task && (
          <>
            <PhaseDivider label="Task" />
            <div className="px-3 py-2 text-xs text-muted leading-relaxed">
              <span className="font-medium text-foreground">{task.main_task}</span>
              {task.key_elements.length > 0 && (
                <p className="mt-1 text-[10px]">{task.key_elements.join(' \u2022 ')}</p>
              )}
            </div>
          </>
        )}

        {mainArgs.length > 0 && (
          <>
            <PhaseDivider label="Arguments" />
            <div className="space-y-3">
              {mainArgs.map(msg => renderThread(msg))}
            </div>
          </>
        )}

        {mainArgs.length === 0 && isBuilding && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted animate-pulse">Generating arguments...</p>
          </div>
        )}

        {isBuilding && mainArgs.length > 0 && subArgs.length === 0 && (
          <div className="py-3 text-center">
            <p className="text-xs text-muted animate-pulse">Building argument tree...</p>
          </div>
        )}
      </div>
    </div>
  )
}
