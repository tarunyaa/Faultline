'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  PersonaId,
  Message,
  FlipCondition,
  SSEEvent,
  InterjectionReason,
  DebatePhase,
  PERSONA_ORDER,
  MESSAGE_BUDGET,
} from '@/lib/types';
import HandRail from './HandRail';
import PlayStack from './PlayStack';
import MapRail from './MapRail';

interface DebateRoomProps {
  topic: string;
}

export default function DebateRoom({ topic }: DebateRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [flipConditions, setFlipConditions] = useState<FlipCondition[]>([]);
  const [streamingAgent, setStreamingAgent] = useState<PersonaId | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [phase, setPhase] = useState<DebatePhase | null>(null);
  const [pendingQueue, setPendingQueue] = useState<Array<{ agent: PersonaId; reason: InterjectionReason }>>([]);
  const [moderatorMessage, setModeratorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'running' | 'complete' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const messageCounterRef = useRef(0);

  // Track pending state in refs for SSE handler
  const pendingAgentRef = useRef<PersonaId | null>(null);
  const pendingContentRef = useRef('');
  const pendingReasonRef = useRef<InterjectionReason | undefined>(undefined);
  const pendingReplyToRef = useRef<PersonaId | undefined>(undefined);

  useEffect(() => {
    const abortController = new AbortController();

    const url = `/api/debate?topic=${encodeURIComponent(topic)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (abortController.signal.aborted) { eventSource.close(); return; }
      setStatus('running');
    };

    eventSource.onmessage = (e) => {
      if (abortController.signal.aborted) { eventSource.close(); return; }
      const event: SSEEvent = JSON.parse(e.data);

      switch (event.type) {
        case 'phase':
          setPhase(event.phase);
          break;

        case 'queue_update':
          setPendingQueue(event.queue);
          break;

        case 'moderator':
          setModeratorMessage(event.message);
          setTimeout(() => setModeratorMessage(null), 5000);
          break;

        case 'message_start':
          pendingAgentRef.current = event.agent;
          pendingContentRef.current = '';
          pendingReasonRef.current = event.reason;
          pendingReplyToRef.current = event.replyTo;
          setStreamingAgent(event.agent);
          setStreamingContent('');
          setPendingQueue([]);
          break;

        case 'message_chunk':
          pendingContentRef.current += event.chunk;
          setStreamingContent(pendingContentRef.current);
          break;

        case 'message_end': {
          const agent = pendingAgentRef.current;
          const content = pendingContentRef.current;
          const reason = pendingReasonRef.current;
          const replyTo = pendingReplyToRef.current;
          if (agent && content) {
            const messageId = `msg-${messageCounterRef.current++}`;
            setMessages((prev) => [
              ...prev,
              { id: messageId, agent, content, timestamp: Date.now(), reason, replyTo },
            ]);
          }
          pendingAgentRef.current = null;
          pendingContentRef.current = '';
          pendingReasonRef.current = undefined;
          pendingReplyToRef.current = undefined;
          setStreamingAgent(null);
          setStreamingContent('');
          break;
        }

        case 'flip_condition':
          setFlipConditions((prev) => [...prev, event.data]);
          break;

        case 'complete':
          setStatus('complete');
          eventSource.close();
          break;

        case 'error':
          setErrorMsg(event.message);
          setStatus('error');
          break;
      }
    };

    eventSource.onerror = () => {
      if (abortController.signal.aborted) return;
      if (eventSource.readyState === EventSource.CLOSED) {
        setStatus('complete');
      } else {
        setStatus('error');
        setErrorMsg('Connection lost. Please refresh and try again.');
      }
      eventSource.close();
    };

    return () => {
      abortController.abort();
      eventSource.close();
    };
  }, [topic]);

  // Per-agent message counts
  const messageCounts = PERSONA_ORDER.reduce(
    (acc, id) => {
      acc[id] = messages.filter((m) => m.agent === id).length;
      return acc;
    },
    {} as Record<PersonaId, number>,
  );

  const messageCount = messages.length + (streamingAgent ? 1 : 0);

  return (
    <div className="flex h-screen flex-col bg-black">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-4">
          <a href="/">
            <Image src="/logo.png" alt="Faultline" width={120} height={48} />
          </a>
          <div className="h-8 w-px bg-zinc-800" />
          <p className="text-sm text-zinc-400 max-w-md truncate">{topic}</p>
        </div>
        <div className="flex items-center gap-4">
          {phase && (
            <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
              {phase}
            </span>
          )}
          <span className="text-xs font-mono text-zinc-500">
            {messageCount}/{MESSAGE_BUDGET}
          </span>
          <StatusBadge status={status} />
        </div>
      </header>

      {/* Moderator banner */}
      {moderatorMessage && (
        <div className="border-b border-zinc-800 bg-zinc-900/80 px-6 py-2.5 text-center">
          <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Moderator
          </span>
          <span className="text-sm text-zinc-400">{moderatorMessage}</span>
        </div>
      )}

      {/* Main arena: HandRail + PlayStack + MapRail */}
      <div className="flex flex-1 overflow-hidden">
        <HandRail
          activeAgent={streamingAgent}
          pendingQueue={pendingQueue}
          phase={phase}
          messageCounts={messageCounts}
        />

        <div className="flex flex-1 flex-col min-w-0 border-x border-zinc-800/40">
          <PlayStack
            messages={messages}
            streamingAgent={streamingAgent}
            streamingContent={streamingContent}
            phase={phase}
          />
        </div>

        <MapRail
          flipConditions={flipConditions}
          messages={messages}
          status={status}
        />
      </div>

      {/* Error banner */}
      {status === 'error' && (
        <div className="border-t border-red-900/50 bg-red-950/50 px-6 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
      )}

      {/* Complete banner */}
      {status === 'complete' && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-6 py-3 text-center">
          <p className="text-sm text-zinc-400">
            Match complete &middot; {messages.length} plays &middot;{' '}
            {flipConditions.length} win conditions detected
          </p>
          <a
            href="/"
            className="mt-2 inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
          >
            New Match
          </a>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    connecting: { color: 'bg-yellow-500', label: 'Connecting' },
    running: { color: 'bg-green-500', label: 'Live' },
    complete: { color: 'bg-zinc-500', label: 'Complete' },
    error: { color: 'bg-red-500', label: 'Error' },
  };

  const { color, label } = config[status] || config.connecting;

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1">
      <span className={`inline-block h-2 w-2 rounded-full ${color} ${status === 'running' ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  );
}
