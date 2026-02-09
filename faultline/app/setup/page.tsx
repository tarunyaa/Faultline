'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import PersonaCard from '@/components/PersonaCard';
import { PERSONAS, PERSONA_ORDER, PersonaId } from '@/lib/types';

const HAND_SIZE = 3;

// Locked placeholder personas (coming soon)
const LOCKED_PERSONAS = [
  { name: 'Marc Andreessen', title: 'General Partner, a16z', avatar: '🦁', subtypes: ['Builder', 'Contrarian'] },
  { name: 'Dario Amodei', title: 'CEO of Anthropic', avatar: '🔬', subtypes: ['Skeptic', 'Scaling'] },
  { name: 'Satya Nadella', title: 'CEO of Microsoft', avatar: '☁️', subtypes: ['Infra', 'Builder'] },
];

function SetupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTopic = searchParams.get('topic') || '';

  const [topic, setTopic] = useState(initialTopic);
  const [hand, setHand] = useState<PersonaId[]>([]);

  const toggleCard = (id: PersonaId) => {
    setHand((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= HAND_SIZE) return prev;
      return [...prev, id];
    });
  };

  const startMatch = () => {
    const t = topic.trim();
    if (!t || hand.length === 0) return;
    router.push(`/debate?topic=${encodeURIComponent(t)}&personas=${hand.join(',')}`);
  };

  const isReady = topic.trim() && hand.length > 0;

  return (
    <div className="min-h-screen bg-black">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-zinc-800/60 px-8 py-4">
        <a href="/">
          <Image src="/logo.png" alt="Faultline" width={120} height={48} priority />
        </a>
        <div className="flex items-center gap-6">
          <a href="/cards" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Cards
          </a>
          <a href="/lobby" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Lobby
          </a>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-8 py-10">
        {/* Topic bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 space-y-3"
        >
          <h1 className="text-xl font-semibold text-zinc-100">Build your hand</h1>
          <div className="flex gap-3 max-w-2xl">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What question are we debating?"
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:border-zinc-600"
            />
          </div>
        </motion.div>

        {/* 3-column layout */}
        <div className="grid grid-cols-[1fr_340px_240px] gap-8">
          {/* Left: Card Library */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Card Library
              </h2>
              <span className="text-[10px] text-zinc-600">
                {PERSONA_ORDER.length} playable
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {PERSONA_ORDER.map((id) => {
                const selected = hand.includes(id);
                return (
                  <motion.div
                    key={id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleCard(id)}
                    className="cursor-pointer"
                  >
                    <div className={`rounded-2xl transition-all duration-200 ${
                      selected
                        ? 'ring-2 ring-red-500/40 ring-offset-2 ring-offset-black'
                        : ''
                    }`}>
                      <PersonaCard persona={PERSONAS[id]} interactive={!selected} />
                    </div>
                    {selected && (
                      <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wider text-red-400">
                        In hand
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Center: Your Hand */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Your Hand
              </h2>
              <span className="text-[10px] text-zinc-600">
                {hand.length}/{HAND_SIZE}
              </span>
            </div>

            {/* Hand slots */}
            <div className="space-y-3">
              {Array.from({ length: HAND_SIZE }).map((_, i) => {
                const personaId = hand[i];
                return (
                  <div key={i} className="h-20">
                    <AnimatePresence mode="wait">
                      {personaId ? (
                        <motion.div
                          key={personaId}
                          initial={{ opacity: 0, scale: 0.9, x: -20 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.9, x: 20 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => toggleCard(personaId)}
                          className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 cursor-pointer hover:border-zinc-700 transition-colors h-full"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-xl border border-zinc-800/60">
                            {PERSONAS[personaId].avatar}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-200">
                              {PERSONAS[personaId].name}
                            </p>
                            <p className="text-[10px] text-zinc-600">
                              {PERSONAS[personaId].subtypes.join(' / ')}
                            </p>
                          </div>
                          <span className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors">
                            remove
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={`empty-${i}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center justify-center rounded-xl border border-dashed border-zinc-800/60 h-full"
                        >
                          <span className="text-xs text-zinc-700">
                            Slot {i + 1}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Start match button */}
            <motion.button
              onClick={startMatch}
              disabled={!isReady}
              whileHover={isReady ? { scale: 1.01 } : {}}
              whileTap={isReady ? { scale: 0.98 } : {}}
              className={`w-full rounded-xl py-4 text-base font-semibold transition-all mt-4 ${
                isReady
                  ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
                  : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
              }`}
            >
              {isReady ? 'Start Match' : hand.length === 0 ? 'Select cards to begin' : 'Enter a topic'}
            </motion.button>
          </motion.div>

          {/* Right: Bench (Locked) */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Bench
              </h2>
              <span className="text-[10px] text-zinc-600">Locked</span>
            </div>

            <div className="space-y-2">
              {LOCKED_PERSONAS.map((p) => (
                <div
                  key={p.name}
                  className="rounded-xl border border-zinc-800/40 bg-zinc-950/50 p-3 opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-lg grayscale">
                      {p.avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-400 font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-zinc-700 truncate">{p.title}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {p.subtypes.map((sub) => (
                      <span
                        key={sub}
                        className="rounded px-1.5 py-px text-[9px] uppercase tracking-wider text-zinc-700 border border-zinc-800/40"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-700">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span className="text-[10px] text-zinc-700">Coming soon</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-black">
          <p className="text-zinc-500">Loading...</p>
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  );
}
