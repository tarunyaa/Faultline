'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import PersonaCard from '@/components/PersonaCard';
import type { PersonaConfig } from '@/lib/types';
import type { ProfileSection } from '@/lib/persona-data';

interface CardDetailClientProps {
  persona: PersonaConfig;
  sections: ProfileSection[];
}

export default function CardDetailClient({ persona, sections }: CardDetailClientProps) {
  const [activeTab, setActiveTab] = useState(sections[0]?.key || 'personality');

  const activeSection = sections.find((s) => s.key === activeTab);

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

      {/* Breadcrumb */}
      <div className="mx-auto max-w-5xl px-8 pt-8 pb-4">
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <a href="/cards" className="hover:text-zinc-400 transition-colors">Cards</a>
          <span>/</span>
          <span className="text-zinc-400">{persona.name}</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-8 pb-16">
        <div className="grid grid-cols-[280px_1fr] gap-12">
          {/* Left: Card + actions */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <PersonaCard persona={persona} />

            <a
              href={`/setup`}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
            >
              Add to hand
            </a>
          </motion.div>

          {/* Right: Tabbed content */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="min-w-0"
          >
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-zinc-800/60 mb-6">
              {sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => setActiveTab(section.key)}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === section.key
                      ? 'text-zinc-100 border-zinc-100'
                      : 'text-zinc-500 border-transparent hover:text-zinc-300'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>

            {/* Content */}
            {activeSection && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="prose prose-invert prose-sm max-w-none"
              >
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">
                    {activeSection.label}
                  </h3>
                  <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap space-y-3">
                    {activeSection.content.split('\n').map((line, i) => {
                      if (line.startsWith('##')) {
                        return (
                          <h4 key={i} className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mt-4 mb-2">
                            {line.replace(/^#+\s*/, '')}
                          </h4>
                        );
                      }
                      if (line.startsWith('- ') || line.startsWith('* ')) {
                        return (
                          <div key={i} className="flex gap-2">
                            <span className="text-zinc-600 shrink-0">-</span>
                            <span>{line.replace(/^[-*]\s*/, '')}</span>
                          </div>
                        );
                      }
                      if (line.trim() === '') return null;
                      return <p key={i} className="text-zinc-300">{line}</p>;
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
