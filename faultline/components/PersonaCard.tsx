'use client';

import { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { PersonaConfig } from '@/lib/types';

const COLOR_MAP: Record<string, { border: string; glow: string; badge: string; statBar: string; accent: string }> = {
  blue: {
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    statBar: 'bg-blue-500',
    accent: 'text-blue-400',
  },
  emerald: {
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    statBar: 'bg-emerald-500',
    accent: 'text-emerald-400',
  },
  amber: {
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/20',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    statBar: 'bg-amber-500',
    accent: 'text-amber-400',
  },
};

const STAT_LABELS: Record<string, string> = {
  aggression: 'AGG',
  evidence: 'EVI',
  timeHorizon: 'HOR',
};

interface PersonaCardProps {
  persona: PersonaConfig;
  variant?: 'full' | 'mini';
  interactive?: boolean;
  className?: string;
}

export default function PersonaCard({
  persona,
  variant = 'full',
  interactive = true,
  className = '',
}: PersonaCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shinePos, setShinePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const colors = COLOR_MAP[persona.color] || COLOR_MAP.blue;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setTilt({
      x: (y - 0.5) * -14,
      y: (x - 0.5) * 14,
    });
    setShinePos({ x: x * 100, y: y * 100 });
  }, [interactive]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  if (variant === 'mini') {
    return (
      <div className={`flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 ${className}`}>
        <span className="text-xl">{persona.avatar}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-200 truncate">{persona.name}</div>
          <div className="text-xs text-zinc-500 truncate">{persona.title}</div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX: tilt.x,
        rotateY: tilt.y,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{ perspective: 800, transformStyle: 'preserve-3d' }}
      className={`relative w-64 rounded-2xl border ${colors.border} bg-zinc-950 overflow-hidden
        ${interactive ? 'cursor-pointer' : ''}
        ${isHovered ? `shadow-lg ${colors.glow}` : 'shadow-md shadow-black/40'}
        transition-shadow duration-300
        ${className}`}
    >
      {/* Shine overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl transition-opacity duration-300"
        style={{
          opacity: isHovered ? 0.12 : 0,
          background: `radial-gradient(circle at ${shinePos.x}% ${shinePos.y}%, white 0%, transparent 60%)`,
        }}
      />

      {/* Card content */}
      <div className="relative z-0 p-5 space-y-4">
        {/* Header: avatar + name */}
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-2xl">
            {persona.avatar}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-zinc-100 leading-tight">{persona.name}</h3>
            <p className="text-xs text-zinc-500 leading-snug mt-0.5">{persona.title}</p>
          </div>
        </div>

        {/* Subtype badges */}
        <div className="flex gap-1.5">
          {persona.subtypes.map((sub) => (
            <span
              key={sub}
              className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${colors.badge}`}
            >
              {sub}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="space-y-2">
          {Object.entries(persona.stats).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-7 text-[10px] font-mono uppercase text-zinc-600">
                {STAT_LABELS[key]}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${colors.statBar} transition-all duration-500`}
                  style={{ width: `${(value / 5) * 100}%` }}
                />
              </div>
              <span className="w-3 text-[10px] font-mono text-zinc-600">{value}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800/60" />

        {/* Signature move */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Signature</p>
          <p className={`text-xs font-medium ${colors.accent} leading-snug`}>
            &ldquo;{persona.signatureMove}&rdquo;
          </p>
        </div>

        {/* Weakness */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Weakness</p>
          <p className="text-xs text-zinc-500 leading-snug">{persona.weakness}</p>
        </div>
      </div>

      {/* Bottom edge glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0.3,
          background: `linear-gradient(90deg, transparent 0%, var(--tw-shadow-color, rgba(255,255,255,0.2)) 50%, transparent 100%)`,
        }}
      />
    </motion.div>
  );
}
