'use client';

import { PersonaId, PERSONAS, Message, InterjectionReason } from '@/lib/types';

interface PersonaColumnProps {
  personaId: PersonaId;
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  pendingReason?: InterjectionReason;
}

const COLOR_MAP: Record<string, { border: string; bg: string; text: string }> = {
  blue: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
  },
  emerald: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
  },
  amber: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
  },
};

const REASON_STYLES: Record<InterjectionReason, { bg: string; text: string; label: string }> = {
  OBJECTION: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'OBJECTION' },
  COUNTER: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'COUNTER' },
  EVIDENCE: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'EVIDENCE' },
  CHALLENGE: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'CHALLENGE' },
  CONCEDE: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'CONCEDE' },
  REDIRECT: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'REDIRECT' },
};

function InterjectionChip({ reason, replyTo }: { reason: InterjectionReason; replyTo?: PersonaId }) {
  const style = REASON_STYLES[reason];
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
        {style.label}
      </span>
      {replyTo && (
        <span className="text-[10px] text-zinc-600">
          → {PERSONAS[replyTo].name}
        </span>
      )}
    </div>
  );
}

function formatContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('FLIP_CONDITION:')) {
      return (
        <p key={i} className="mt-1 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-300">
          {line}
        </p>
      );
    }
    if (line.trim() === '') return null;
    return <p key={i}>{line}</p>;
  });
}

export default function PersonaColumn({
  personaId,
  messages,
  streamingContent,
  isStreaming,
  pendingReason,
}: PersonaColumnProps) {
  const persona = PERSONAS[personaId];
  const colors = COLOR_MAP[persona.color] || COLOR_MAP.blue;

  return (
    <div className={`flex flex-col rounded-xl border ${colors.border} bg-zinc-900/50 overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center gap-3 border-b ${colors.border} px-4 py-3`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.bg} text-xl`}>
          {persona.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className={`font-semibold ${colors.text}`}>{persona.name}</h3>
          <p className="text-xs text-zinc-500">{persona.title}</p>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 animate-pulse rounded-full ${colors.bg} ${colors.text}`} />
            <span className="text-xs text-zinc-500">speaking</span>
          </div>
        )}
        {!isStreaming && pendingReason && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
            <span className="text-[10px] text-zinc-500">queued</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm leading-relaxed text-zinc-300">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.reason && (
              <InterjectionChip reason={msg.reason} replyTo={msg.replyTo} />
            )}
            <div className="space-y-1">{formatContent(msg.content)}</div>
          </div>
        ))}

        {/* Streaming content */}
        {isStreaming && streamingContent && (
          <div>
            <div className="space-y-1">
              {formatContent(streamingContent)}
              <span className="inline-block h-4 w-0.5 animate-pulse bg-zinc-400" />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isStreaming && !streamingContent && (
          <div className="flex items-center gap-1.5 py-2">
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '0ms' }} />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '150ms' }} />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}
