'use client';

import { motion } from 'framer-motion';
import {
  PersonaId,
  InterjectionReason,
  DebatePhase,
  PERSONAS,
  PERSONA_ORDER,
} from '@/lib/types';

const COLOR_MAP: Record<string, { ring: string; bg: string; text: string; glow: string }> = {
  blue: {
    ring: 'ring-blue-500/50',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/20',
  },
  emerald: {
    ring: 'ring-emerald-500/50',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
  amber: {
    ring: 'ring-amber-500/50',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
};

interface HandRailProps {
  activeAgent: PersonaId | null;
  pendingQueue: Array<{ agent: PersonaId; reason: InterjectionReason }>;
  phase: DebatePhase | null;
  messageCounts: Record<PersonaId, number>;
}

export default function HandRail({
  activeAgent,
  pendingQueue,
  phase,
  messageCounts,
}: HandRailProps) {
  return (
    <div className="flex w-56 shrink-0 flex-col gap-2 py-4 pl-4 pr-2">
      {/* Phase label */}
      {phase && (
        <div className="mb-2 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            {phase}
          </span>
        </div>
      )}

      {/* Persona cards */}
      {PERSONA_ORDER.map((id) => {
        const persona = PERSONAS[id];
        const isActive = activeAgent === id;
        const queueEntry = pendingQueue.find((q) => q.agent === id);
        const colors = COLOR_MAP[persona.color] || COLOR_MAP.blue;
        const count = messageCounts[id] || 0;

        return (
          <motion.div
            key={id}
            animate={{
              y: isActive ? -2 : 0,
              scale: isActive ? 1.02 : 1,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`relative rounded-xl border bg-zinc-950 p-3 transition-all duration-300
              ${isActive
                ? `${colors.ring} ring-1 border-transparent shadow-lg ${colors.glow}`
                : 'border-zinc-800/60'}`}
          >
            {/* Avatar + name row */}
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg
                  ${isActive ? colors.bg : 'bg-zinc-900'}`}
              >
                {persona.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${isActive ? colors.text : 'text-zinc-300'}`}>
                  {persona.name}
                </p>
                <p className="text-[10px] text-zinc-600 truncate">{persona.title}</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-zinc-600">
                {count} {count === 1 ? 'play' : 'plays'}
              </span>

              {/* Status indicator */}
              {isActive && (
                <div className="flex items-center gap-1">
                  <span className={`inline-block h-1.5 w-1.5 animate-pulse rounded-full ${colors.text}`}
                    style={{ backgroundColor: 'currentColor' }}
                  />
                  <span className="text-[10px] text-zinc-500">speaking</span>
                </div>
              )}
              {!isActive && queueEntry && (
                <div className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" />
                  <span className="text-[10px] text-zinc-600">queued</span>
                </div>
              )}
            </div>

            {/* Subtypes */}
            <div className="mt-2 flex gap-1">
              {persona.subtypes.map((sub) => (
                <span
                  key={sub}
                  className="rounded px-1.5 py-px text-[9px] font-medium uppercase tracking-wider bg-zinc-900 text-zinc-600 border border-zinc-800/60"
                >
                  {sub}
                </span>
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Legend */}
      <div className="space-y-1.5 px-1 mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700">
          Move types
        </p>
        {[
          { label: 'Attack', color: 'bg-red-500' },
          { label: 'Rebut', color: 'bg-orange-500' },
          { label: 'Evidence', color: 'bg-blue-500' },
          { label: 'Concede', color: 'bg-green-500' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${color} opacity-60`} />
            <span className="text-[10px] text-zinc-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
