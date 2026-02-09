'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import PersonaCard from '@/components/PersonaCard';
import { PERSONAS, PERSONA_ORDER } from '@/lib/types';

const SUGGESTED_TOPICS = [
  'Is open-source AI safer than closed-source AI?',
  'Will AGI arrive before 2030?',
  'Should AI companies be regulated like utilities?',
  'Is the current AI infrastructure buildout justified?',
  'Will AI replace more jobs than it creates in the next 5 years?',
];

const CARD_ROTATIONS = [-18, 0, 18];
const CARD_OFFSETS_Y = [12, -8, 12];

export default function Home() {
  const [topic, setTopic] = useState('');
  const router = useRouter();

  const startDebate = () => {
    const t = topic.trim();
    if (!t) return;
    router.push(`/setup?topic=${encodeURIComponent(t)}`);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-black px-4 overflow-hidden">
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.07]"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-3xl space-y-16">
        {/* Logo & tagline */}
        <div className="flex flex-col items-center space-y-3">
          <Image
            src="/logo.png"
            alt="Faultline"
            width={340}
            height={136}
            priority
          />
          <p className="text-base text-zinc-500 tracking-wide">
            Multi-agent Socratic debate. Real positions. Real stakes.
          </p>
        </div>

        {/* Card fan */}
        <div className="flex justify-center items-end gap-[-16px]" style={{ perspective: '1200px' }}>
          {PERSONA_ORDER.map((id, i) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 60, rotateZ: CARD_ROTATIONS[i] * 1.5 }}
              animate={{
                opacity: 1,
                y: CARD_OFFSETS_Y[i],
                rotateZ: CARD_ROTATIONS[i],
              }}
              transition={{
                duration: 0.7,
                delay: 0.15 + i * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                marginLeft: i === 0 ? 0 : -20,
                zIndex: i === 1 ? 10 : 5,
                transformOrigin: 'bottom center',
              }}
            >
              <PersonaCard persona={PERSONAS[id]} />
            </motion.div>
          ))}
        </div>

        {/* Topic input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="space-y-4 max-w-xl mx-auto"
        >
          <div className="relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startDebate()}
              placeholder="What question are we debating?"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-5 py-4 text-lg text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:border-zinc-600 focus:bg-zinc-900"
            />
          </div>
          <button
            onClick={startDebate}
            disabled={!topic.trim()}
            className="w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Start Match
          </button>
        </motion.div>

        {/* Suggested topics */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="space-y-3"
        >
          <p className="text-center text-xs uppercase tracking-wider text-zinc-600">
            Or try a topic
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTED_TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
              >
                {t}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
