'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Message, PersonaId, DebatePhase, PERSONAS } from '@/lib/types';
import PlayCard from './PlayCard';

interface PlayStackProps {
  messages: Message[];
  streamingAgent: PersonaId | null;
  streamingContent: string;
  phase: DebatePhase | null;
}

const PHASE_LABELS: Record<DebatePhase, { title: string; sub: string }> = {
  opening: { title: 'Opening Statements', sub: 'Each agent states their position' },
  debate: { title: 'Open Debate', sub: 'Agents challenge, counter, and provide evidence' },
  closing: { title: 'Closing Statements', sub: 'Final positions and flip conditions' },
};

function PhaseBanner({ phase }: { phase: DebatePhase }) {
  const label = PHASE_LABELS[phase];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-4 py-4"
    >
      <div className="flex-1 h-px bg-zinc-800" />
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {label.title}
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{label.sub}</p>
      </div>
      <div className="flex-1 h-px bg-zinc-800" />
    </motion.div>
  );
}

function TypingIndicator({ agent }: { agent: PersonaId }) {
  const persona = PERSONAS[agent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2.5 px-4 py-3"
    >
      <span className="text-lg">{persona.avatar}</span>
      <div className="flex items-center gap-1">
        <span
          className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </motion.div>
  );
}

export default function PlayStack({
  messages,
  streamingAgent,
  streamingContent,
  phase,
}: PlayStackProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  // Auto-scroll on new messages only (not every chunk)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Throttled scroll for streaming — use rAF so we scroll at most once per frame
  useEffect(() => {
    if (!streamingContent) return;
    if (scrollRafRef.current) return; // already queued
    scrollRafRef.current = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      scrollRafRef.current = null;
    });
  }, [streamingContent]);

  // Track which phases we've already shown banners for
  const shownPhases = new Set<DebatePhase>();
  const elements: React.ReactNode[] = [];

  // Build interleaved phase banners + messages
  for (const msg of messages) {
    // Determine phase from message position
    const msgPhase = getMessagePhase(msg, messages);
    if (msgPhase && !shownPhases.has(msgPhase)) {
      shownPhases.add(msgPhase);
      elements.push(
        <PhaseBanner key={`phase-${msgPhase}`} phase={msgPhase} />,
      );
    }

    elements.push(
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.35,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <PlayCard
          agent={msg.agent}
          content={msg.content}
          reason={msg.reason}
          replyTo={msg.replyTo}
        />
      </motion.div>,
    );
  }

  // Show current phase banner if no messages in this phase yet
  if (phase && !shownPhases.has(phase)) {
    elements.push(
      <PhaseBanner key={`phase-${phase}`} phase={phase} />,
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-2 py-4 space-y-3"
    >
      {elements}

      {/* Streaming card — outside AnimatePresence to avoid relayout on every chunk */}
      {streamingAgent && streamingContent && (
        <div key="streaming">
          <PlayCard
            agent={streamingAgent}
            content={streamingContent}
            isStreaming
          />
        </div>
      )}

      {/* Typing indicator */}
      <AnimatePresence>
        {streamingAgent && !streamingContent && (
          <TypingIndicator key="typing" agent={streamingAgent} />
        )}
      </AnimatePresence>

      <div ref={bottomRef} />
    </div>
  );
}

// Heuristic: first 3 messages = opening, last 3 = closing, rest = debate
function getMessagePhase(msg: Message, allMessages: Message[]): DebatePhase | null {
  const idx = allMessages.indexOf(msg);
  if (idx < 3) return 'opening';
  if (idx === 3) return 'debate';
  // We get closing phase from the SSE event, but as a fallback:
  // last 3 messages of a completed debate are closing
  if (allMessages.length >= 9 && idx === allMessages.length - 3) return 'closing';
  return null;
}
