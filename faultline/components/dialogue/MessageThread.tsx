'use client'

// ─── Message Thread ───────────────────────────────────────────
// Flat list with inline @mention for replies.
// Uses project CSS vars (black/red/white theme).

import type { DialogueMessage } from '@/lib/dialogue/types'

interface MessageThreadProps {
  messages: DialogueMessage[]
  personaNames: Map<string, string>
  personaAvatars: Map<string, string>
}

export function MessageThread({ messages, personaNames, personaAvatars }: MessageThreadProps) {
  return (
    <div className="space-y-3">
      {messages.map(msg => (
        <MessageBubble
          key={msg.id}
          message={msg}
          messages={messages}
          personaNames={personaNames}
          personaAvatars={personaAvatars}
        />
      ))}
    </div>
  )
}

interface MessageBubbleProps {
  message: DialogueMessage
  messages: DialogueMessage[]
  personaNames: Map<string, string>
  personaAvatars: Map<string, string>
}

function MessageBubble({ message, messages, personaNames, personaAvatars }: MessageBubbleProps) {
  const name = personaNames.get(message.personaId) ?? message.personaId
  const avatarUrl = personaAvatars.get(message.personaId)

  // If this is a reply, find who they replied to
  const replyTarget = message.replyTo
    ? messages.find(m => m.id === message.replyTo)
    : null
  const replyTargetName = replyTarget
    ? (personaNames.get(replyTarget.personaId) ?? replyTarget.personaId)
    : null

  return (
    <div className="group flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0 pt-0.5">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-8 h-8 rounded-full object-cover border border-card-border"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-card-bg border border-card-border flex items-center justify-center">
            <span className="text-xs font-bold text-accent">{name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0 rounded-lg p-3 bg-card-bg border border-card-border hover:border-muted/40 transition-colors">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-sm font-semibold text-accent">{name}</span>
          {replyTargetName && (
            <span className="text-xs text-muted">
              → {replyTargetName}
            </span>
          )}
          <span className="text-xs text-muted opacity-50 ml-auto">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Content */}
        <p className="text-foreground text-sm leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  )
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
