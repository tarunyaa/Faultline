'use client';

import { FlipCondition, PERSONAS } from '@/lib/types';

interface FlipConditionTrackerProps {
  flipConditions: FlipCondition[];
}

export default function FlipConditionTracker({ flipConditions }: FlipConditionTrackerProps) {
  if (flipConditions.length === 0) {
    return (
      <div className="border-t border-zinc-800 bg-zinc-950 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-700" />
          Waiting for flip conditions to emerge...
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-6 py-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Flip Conditions Detected
      </h3>
      <div className="flex flex-col gap-2">
        {flipConditions.map((fc) => {
          const persona = PERSONAS[fc.agent];
          return (
            <div
              key={fc.id}
              className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
            >
              <span className="mt-0.5 text-lg">{persona.avatar}</span>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-zinc-400">
                  {persona.name}
                </span>
                <p className="mt-0.5 text-sm text-zinc-200">{fc.condition}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
