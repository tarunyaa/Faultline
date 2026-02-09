'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { PersonaId, InterjectionReason, PERSONAS } from '@/lib/types';

export type MoveType = 'Attack' | 'Rebut' | 'Evidence' | 'Concede' | 'Statement';

const REASON_TO_MOVE: Record<InterjectionReason, MoveType> = {
  OBJECTION: 'Attack',
  COUNTER: 'Rebut',
  EVIDENCE: 'Evidence',
  CHALLENGE: 'Attack',
  CONCEDE: 'Concede',
  REDIRECT: 'Rebut',
};

const MOVE_STYLES: Record<MoveType, { border: string; badge: string; icon: string }> = {
  Attack: {
    border: 'border-red-500/20',
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    icon: '///',
  },
  Rebut: {
    border: 'border-orange-500/20',
    badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    icon: '<>',
  },
  Evidence: {
    border: 'border-blue-500/20',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    icon: '[ ]',
  },
  Concede: {
    border: 'border-green-500/20',
    badge: 'bg-green-500/15 text-green-400 border-green-500/30',
    icon: '~',
  },
  Statement: {
    border: 'border-zinc-700/40',
    badge: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    icon: '—',
  },
};

const PERSONA_COLORS: Record<string, { accent: string; glow: string }> = {
  blue: { accent: 'text-blue-400', glow: 'shadow-blue-500/10' },
  emerald: { accent: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
  amber: { accent: 'text-amber-400', glow: 'shadow-amber-500/10' },
};

interface PlayCardProps {
  agent: PersonaId;
  content: string;
  reason?: InterjectionReason;
  replyTo?: PersonaId;
  isStreaming?: boolean;
}

function formatContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('FLIP_CONDITION:')) {
      const condition = line.replace('FLIP_CONDITION:', '').trim();
      return (
        <div
          key={i}
          className="mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/8 px-3 py-2"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-yellow-500/70">
            Win Condition
          </span>
          <p className="mt-0.5 text-xs text-yellow-300">{condition}</p>
        </div>
      );
    }
    if (line.trim() === '') return null;
    return <p key={i}>{line}</p>;
  });
}

const PlayCard = forwardRef<HTMLDivElement, PlayCardProps>(function PlayCard(
  { agent, content, reason, replyTo, isStreaming },
  ref,
) {
  const persona = PERSONAS[agent];
  const move: MoveType = reason ? REASON_TO_MOVE[reason] : 'Statement';
  const moveStyle = MOVE_STYLES[move];
  const personaColor = PERSONA_COLORS[persona.color] || PERSONA_COLORS.blue;

  return (
    <div
      ref={ref}
      className={`rounded-xl border ${moveStyle.border} bg-zinc-950/80 backdrop-blur-sm overflow-hidden
        ${isStreaming ? `shadow-lg ${personaColor.glow}` : ''}`}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50">
        {/* Speaker */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{persona.avatar}</span>
          <span className={`text-sm font-medium ${personaColor.accent}`}>
            {persona.name}
          </span>
        </div>

        {/* Target arrow */}
        {replyTo && (
          <div className="flex items-center gap-1.5 text-zinc-600">
            <svg width="16" height="8" viewBox="0 0 16 8" fill="none" className="opacity-50">
              <path d="M0 4H14M14 4L10 1M14 4L10 7" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-xs">{PERSONAS[replyTo].name}</span>
          </div>
        )}

        {/* Move type badge */}
        <div className="ml-auto">
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${moveStyle.badge}`}>
            {move}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 text-sm leading-relaxed text-zinc-300 space-y-1">
        {formatContent(content)}
        {isStreaming && (
          <span className="inline-block h-4 w-0.5 animate-pulse bg-zinc-400 ml-0.5" />
        )}
      </div>
    </div>
  );
});

export default PlayCard;

export const MotionPlayCard = motion.create(PlayCard);
