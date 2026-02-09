'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';

const STARTER_DECKS = [
  {
    name: 'Builder Deck',
    description: 'Optimists who ship. Scaling, infrastructure, product velocity.',
    personas: ['sam', 'jensen'],
    icon: '///',
  },
  {
    name: 'Skeptic Deck',
    description: 'Contrarians who stress-test. First principles, timelines, risk.',
    personas: ['elon'],
    icon: '<!>',
  },
  {
    name: 'Infra Deck',
    description: 'Hardware and compute. Demand curves, Huang\'s Law, capex.',
    personas: ['jensen', 'elon'],
    icon: '[ ]',
  },
  {
    name: 'Markets Deck',
    description: 'Valuation, TAM, bubble risk, long-term value creation.',
    personas: ['elon', 'sam', 'jensen'],
    icon: '~$~',
  },
];

const RECENT_MATCHES = [
  {
    topic: 'Will AGI arrive before 2030?',
    cruxes: 4,
    flipConditions: 3,
    plays: 18,
  },
  {
    topic: 'Is the current AI infrastructure buildout justified?',
    cruxes: 3,
    flipConditions: 2,
    plays: 15,
  },
];

export default function LobbyPage() {
  const [topic, setTopic] = useState('');
  const router = useRouter();

  const startMatch = () => {
    const t = topic.trim();
    if (!t) return;
    router.push(`/setup?topic=${encodeURIComponent(t)}`);
  };

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
          <a href="/lobby" className="text-sm text-zinc-300 font-medium">
            Lobby
          </a>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-8 py-16 space-y-16">
        {/* New match input */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          <h1 className="text-2xl font-semibold text-zinc-100">New match</h1>
          <div className="flex gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startMatch()}
              placeholder="What question are we debating?"
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-3.5 text-base text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:border-zinc-600"
            />
            <button
              onClick={startMatch}
              disabled={!topic.trim()}
              className="rounded-xl bg-zinc-100 px-8 py-3.5 text-base font-semibold text-zinc-900 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Start
            </button>
          </div>
        </motion.div>

        {/* Starter decks */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-200">Starter decks</h2>
            <span className="text-xs text-zinc-600 uppercase tracking-wider">Templates</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {STARTER_DECKS.map((deck) => (
              <button
                key={deck.name}
                onClick={() => setTopic('')}
                className="group rounded-xl border border-zinc-800/60 bg-zinc-950 p-5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-xs font-mono text-zinc-500 border border-zinc-800/60 group-hover:text-zinc-400 transition-colors">
                    {deck.icon}
                  </span>
                  <span className="text-sm font-medium text-zinc-200">{deck.name}</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{deck.description}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Recent matches */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-200">Recent matches</h2>
            <span className="text-xs text-zinc-600 uppercase tracking-wider">History</span>
          </div>
          <div className="space-y-2">
            {RECENT_MATCHES.map((match) => (
              <div
                key={match.topic}
                className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-950 px-5 py-4 transition-colors hover:border-zinc-700"
              >
                <p className="text-sm text-zinc-300">{match.topic}</p>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <span className="text-[11px] text-zinc-600">
                    {match.cruxes} cruxes
                  </span>
                  <span className="text-[11px] text-zinc-600">
                    {match.flipConditions} flips
                  </span>
                  <span className="text-[11px] text-zinc-600">
                    {match.plays} plays
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
