'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import DebateRoom from '@/components/DebateRoom';

function DebateContent() {
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic');

  if (!topic) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <p className="text-zinc-400">No topic specified.</p>
          <a
            href="/"
            className="inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
          >
            Go back
          </a>
        </div>
      </div>
    );
  }

  return <DebateRoom topic={topic} />;
}

export default function DebatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-black">
          <p className="text-zinc-500">Loading debate...</p>
        </div>
      }
    >
      <DebateContent />
    </Suspense>
  );
}
