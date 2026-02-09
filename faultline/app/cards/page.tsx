'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import PersonaCard from '@/components/PersonaCard';
import { PERSONAS, PERSONA_ORDER, CardSubtype } from '@/lib/types';

const ALL_SUBTYPES: CardSubtype[] = ['Builder', 'Contrarian', 'Skeptic', 'Infra', 'Scaling', 'Visionary'];

export default function CardsPage() {
  const [activeFilter, setActiveFilter] = useState<CardSubtype | null>(null);
  const [tab, setTab] = useState<'playable' | 'locked'>('playable');

  const filteredPersonas = PERSONA_ORDER.filter((id) => {
    if (!activeFilter) return true;
    return PERSONAS[id].subtypes.includes(activeFilter);
  });

  return (
    <div className="min-h-screen bg-black">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-zinc-800/60 px-8 py-4">
        <a href="/">
          <Image src="/logo.png" alt="Faultline" width={120} height={48} priority />
        </a>
        <div className="flex items-center gap-6">
          <a href="/cards" className="text-sm text-zinc-300 font-medium">
            Cards
          </a>
          <a href="/lobby" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Lobby
          </a>
          <a href="/setup" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Setup
          </a>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-8 py-12 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-semibold text-zinc-100">Card Library</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Browse personas. Inspect their reasoning. Build your hand.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-zinc-800/60 pb-px">
          <button
            onClick={() => setTab('playable')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              tab === 'playable'
                ? 'text-zinc-100 border-zinc-100'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            Playable
            <span className="ml-1.5 text-[10px] text-zinc-600">{PERSONA_ORDER.length}</span>
          </button>
          <button
            onClick={() => setTab('locked')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              tab === 'locked'
                ? 'text-zinc-100 border-zinc-100'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            Locked
            <span className="ml-1.5 text-[10px] text-zinc-600">3</span>
          </button>
        </div>

        {/* Filters */}
        {tab === 'playable' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <span className="text-[10px] uppercase tracking-wider text-zinc-600 mr-2">
              Filter
            </span>
            <button
              onClick={() => setActiveFilter(null)}
              className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                !activeFilter
                  ? 'border-zinc-600 bg-zinc-800 text-zinc-200'
                  : 'border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
              }`}
            >
              All
            </button>
            {ALL_SUBTYPES.map((sub) => (
              <button
                key={sub}
                onClick={() => setActiveFilter(activeFilter === sub ? null : sub)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  activeFilter === sub
                    ? 'border-zinc-600 bg-zinc-800 text-zinc-200'
                    : 'border-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {sub}
              </button>
            ))}
          </motion.div>
        )}

        {/* Card grid */}
        {tab === 'playable' && (
          <div className="grid grid-cols-3 gap-6">
            {filteredPersonas.map((id, i) => (
              <motion.a
                key={id}
                href={`/cards/${id}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="block"
              >
                <PersonaCard persona={PERSONAS[id]} />
              </motion.a>
            ))}
            {filteredPersonas.length === 0 && (
              <p className="col-span-3 text-center text-sm text-zinc-600 py-12">
                No cards match this filter.
              </p>
            )}
          </div>
        )}

        {/* Locked cards */}
        {tab === 'locked' && (
          <div className="grid grid-cols-3 gap-6">
            {[
              { name: 'Marc Andreessen', title: 'General Partner, a16z', avatar: '🦁' },
              { name: 'Dario Amodei', title: 'CEO of Anthropic', avatar: '🔬' },
              { name: 'Satya Nadella', title: 'CEO of Microsoft', avatar: '☁️' },
            ].map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-zinc-800/40 bg-zinc-950/50 p-5 opacity-60"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-2xl grayscale border border-zinc-800/60">
                    {p.avatar}
                  </div>
                  <div>
                    <p className="text-base font-medium text-zinc-400">{p.name}</p>
                    <p className="text-xs text-zinc-600">{p.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-700">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className="text-xs text-zinc-700">Coming soon</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
