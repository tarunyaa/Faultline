'use client'

// ─── Crux Room — used in the bottom drawer ────────────────────
// Shows the live conversation as it streams.

import type { CruxMessage } from '@/lib/crux/types'

interface CruxRoomProps {
  roomId: string
  question: string
  messages: CruxMessage[]
  personaNames: Map<string, string>
  status: 'arguing' | 'complete'
}

export function CruxRoom({ question, messages, personaNames, status }: CruxRoomProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Room header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-card-border">
        <p className="text-xs font-semibold text-foreground truncate max-w-[80%]">
          {question}
        </p>
        <div className="flex items-center gap-1.5">
          {status === 'arguing' && (
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          )}
          <span className="text-xs text-muted">
            {status === 'arguing' ? 'Arguing' : 'Complete'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-muted italic">Starting crux room...</p>
        )}
        {messages.map(msg => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="text-center py-1">
                <span className="text-xs text-muted italic">{msg.content}</span>
              </div>
            )
          }
          const name = personaNames.get(msg.personaId!) ?? msg.personaId!
          return (
            <div key={msg.id}>
              <span className="text-xs font-semibold text-accent">{name}</span>
              <p className="text-sm text-foreground mt-0.5 leading-relaxed">{msg.content}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
