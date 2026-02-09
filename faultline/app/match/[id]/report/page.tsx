'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { PERSONAS, PERSONA_ORDER } from '@/lib/types';

// Placeholder postgame report — will be wired to real match data once persistence is added
export default function ReportPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-zinc-800/60 px-8 py-4">
        <a href="/">
          <Image src="/logo.png" alt="Faultline" width={120} height={48} priority />
        </a>
        <div className="flex items-center gap-6">
          <a href="/lobby" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Lobby
          </a>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-8 py-12 space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Match Report
          </span>
          <h1 className="text-2xl font-semibold text-zinc-100">
            Will AGI arrive before 2030?
          </h1>
          <p className="text-sm text-zinc-500">18 plays / 4 cruxes / 3 win conditions</p>
        </motion.div>

        {/* Lineup */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-3"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Lineup
          </h2>
          <div className="flex gap-3">
            {PERSONA_ORDER.map((id) => {
              const p = PERSONAS[id];
              return (
                <div
                  key={id}
                  className="flex items-center gap-2.5 rounded-xl border border-zinc-800/60 bg-zinc-950 px-4 py-3 flex-1"
                >
                  <span className="text-xl">{p.avatar}</span>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{p.name}</p>
                    <p className="text-[10px] text-zinc-600">{p.subtypes.join(' / ')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Disagreement Map */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Disagreement Map
          </h2>

          {/* Cruxes */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Cruxes
            </h3>
            {[
              'Whether current scaling laws will continue or hit diminishing returns',
              'Definition of AGI — task-specific excellence vs. general reasoning',
              'Role of embodiment and real-world grounding in achieving AGI',
              'Whether compute availability is the binding constraint or algorithmic insight',
            ].map((crux, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-zinc-800/60 bg-zinc-950 px-4 py-3"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-mono text-zinc-500">
                  {i + 1}
                </span>
                <p className="text-sm text-zinc-300">{crux}</p>
              </div>
            ))}
          </div>

          {/* Fault lines */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Fault Lines
            </h3>
            <div className="flex flex-wrap gap-2">
              {['Time horizon', 'Definition dispute', 'Evidence standard', 'Incentive alignment', 'Compute scaling'].map(
                (tag) => (
                  <span
                    key={tag}
                    className="rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400"
                  >
                    {tag}
                  </span>
                ),
              )}
            </div>
          </div>
        </motion.div>

        {/* Win Conditions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-3"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Win Conditions
          </h2>
          {[
            { agent: 'elon' as const, condition: 'Show me a single AGI benchmark that plateaus despite 10x more compute — then I\'ll believe scaling isn\'t enough.' },
            { agent: 'sam' as const, condition: 'If GPT-5 class models fail to show meaningful reasoning improvement over GPT-4, I\'d reconsider the timeline.' },
            { agent: 'jensen' as const, condition: 'If enterprise AI adoption revenue declines for two consecutive quarters, the infrastructure thesis needs revision.' },
          ].map((fc) => {
            const persona = PERSONAS[fc.agent];
            return (
              <div
                key={fc.agent}
                className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm">{persona.avatar}</span>
                  <span className="text-xs font-medium text-yellow-500/70">{persona.name}</span>
                </div>
                <p className="text-sm text-yellow-300/80 leading-relaxed">{fc.condition}</p>
              </div>
            );
          })}
        </motion.div>

        {/* What would settle this */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            What would settle this?
          </h2>
          <div className="space-y-2">
            {[
              'Track GPT-5 benchmark results against GPT-4 on ARC-AGI and MMLU',
              'Monitor NVIDIA datacenter revenue QoQ for demand signal',
              'Compare 2026 AGI predictions against actual capability milestones',
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-950 px-4 py-3"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                  <span className="text-[10px] text-zinc-600">?</span>
                </div>
                <p className="text-sm text-zinc-300">{item}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Export bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex items-center justify-center gap-3 pt-4 border-t border-zinc-800/60"
        >
          <button className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors">
            Copy summary
          </button>
          <button className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors">
            Share link
          </button>
          <a
            href="/"
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white transition-colors"
          >
            New Match
          </a>
        </motion.div>
      </div>
    </div>
  );
}
