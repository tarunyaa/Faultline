'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FlipCondition, Message, PERSONAS, MESSAGE_BUDGET } from '@/lib/types';

interface MapRailProps {
  flipConditions: FlipCondition[];
  messages: Message[];
  status: 'connecting' | 'running' | 'complete' | 'error';
}

export default function MapRail({ flipConditions, messages, status }: MapRailProps) {
  // Extract crux moments: messages with high-signal reasons
  const cruxMessages = messages.filter(
    (m) => m.reason === 'OBJECTION' || m.reason === 'CONCEDE' || m.reason === 'EVIDENCE',
  );

  return (
    <div className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto py-4 pl-2 pr-4">
      {/* Match progress */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
          Match
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-zinc-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((messages.length / MESSAGE_BUDGET) * 100, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-[10px] font-mono text-zinc-600">
            {messages.length}/{MESSAGE_BUDGET}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <StatusDot status={status} />
          <span className="text-[10px] text-zinc-600 capitalize">{status}</span>
        </div>
      </div>

      {/* Win Conditions (Flip conditions) */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
          Win Conditions
        </p>
        <AnimatePresence mode="popLayout">
          {flipConditions.length === 0 ? (
            <motion.p
              key="empty"
              exit={{ opacity: 0 }}
              className="text-[11px] text-zinc-700 italic"
            >
              Waiting for flip conditions...
            </motion.p>
          ) : (
            flipConditions.map((fc) => {
              const persona = PERSONAS[fc.agent];
              return (
                <motion.div
                  key={fc.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2.5"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{persona.avatar}</span>
                    <span className="text-[10px] font-medium text-yellow-500/70">
                      {persona.name}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-yellow-300/80">
                    {fc.condition}
                  </p>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Key Lines (crux moments) */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
          Key Lines
        </p>
        {cruxMessages.length === 0 ? (
          <p className="text-[11px] text-zinc-700 italic">
            No key moments yet...
          </p>
        ) : (
          <div className="space-y-2">
            {cruxMessages.slice(-6).map((msg) => {
              const persona = PERSONAS[msg.agent];
              const preview =
                msg.content.length > 80
                  ? msg.content.slice(0, 80) + '...'
                  : msg.content;
              return (
                <div
                  key={msg.id}
                  className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-2"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">{persona.avatar}</span>
                    <span className={`text-[10px] font-medium ${
                      msg.reason === 'OBJECTION'
                        ? 'text-red-400'
                        : msg.reason === 'CONCEDE'
                        ? 'text-green-400'
                        : 'text-blue-400'
                    }`}>
                      {msg.reason}
                    </span>
                    {msg.replyTo && (
                      <span className="text-[10px] text-zinc-600">
                        → {PERSONAS[msg.replyTo].name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-snug text-zinc-400">
                    {preview}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    connecting: 'bg-yellow-500',
    running: 'bg-green-500',
    complete: 'bg-zinc-500',
    error: 'bg-red-500',
  };
  const color = colorMap[status] || colorMap.connecting;

  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${color} ${
        status === 'running' ? 'animate-pulse' : ''
      }`}
    />
  );
}
