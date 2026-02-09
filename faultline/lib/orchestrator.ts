import {
  PersonaId,
  Message,
  FlipCondition,
  SSEEvent,
  TurnCandidate,
  InterjectionReason,
  PERSONA_ORDER,
  PERSONAS,
  MESSAGE_BUDGET,
} from './types';
import {
  buildSystemPrompt,
  buildOpeningMessage,
  buildDebateTurnMessage,
  buildClosingMessage,
} from './personas';
import { streamMessage } from './anthropic';
import { getEvidenceStore } from './evidence-store';

// --- Domain keywords for priority scoring ---
const DOMAIN_KEYWORDS: Record<PersonaId, string[]> = {
  elon: [
    'mars', 'space', 'spacex', 'tesla', 'ev', 'electric', 'open source',
    'open-source', 'twitter', 'existential', 'multiplanetary', 'first principles',
    'physics', 'rocket', 'neuralink', 'xai', 'grok', 'boring company',
  ],
  sam: [
    'openai', 'gpt', 'chatgpt', 'scaling', 'alignment', 'safety', 'agi',
    'deployment', 'regulation', 'regulate', 'nonprofit', 'superintelligence',
    'frontier', 'llm', 'closed source', 'closed-source',
  ],
  jensen: [
    'gpu', 'nvidia', 'cuda', 'compute', 'data center', 'datacenter',
    'training', 'inference', 'chip', 'hardware', 'accelerat', 'blackwell',
    'hopper', 'silicon', 'semiconductor', 'h100', 'b200',
  ],
};

// --- Name aliases for detecting direct address ---
const NAME_ALIASES: Record<PersonaId, string[]> = {
  elon: ['elon', 'musk', 'tesla', 'spacex'],
  sam: ['sam', 'altman', 'openai'],
  jensen: ['jensen', 'huang', 'nvidia'],
};

// --- Flip condition extraction (with dedup) ---
function extractFlipConditions(
  text: string,
  agent: PersonaId,
  existing: FlipCondition[]
): FlipCondition[] {
  const conditions: FlipCondition[] = [];
  const regex = /FLIP_CONDITION:\s*(.+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const condition = match[1].trim();
    // Deduplicate: skip if this agent already has a similar flip condition
    const isDuplicate = existing.some(
      (fc) =>
        fc.agent === agent &&
        (fc.condition === condition ||
          fc.condition.toLowerCase().includes(condition.toLowerCase().slice(0, 40)) ||
          condition.toLowerCase().includes(fc.condition.toLowerCase().slice(0, 40)))
    );
    if (!isDuplicate) {
      conditions.push({
        id: `${agent}-fc-${Date.now()}-${conditions.length}`,
        agent,
        condition,
      });
    }
  }
  return conditions;
}

// --- Priority scoring ---
function isInDomain(text: string, agent: PersonaId): boolean {
  const lower = text.toLowerCase();
  return DOMAIN_KEYWORDS[agent].some((kw) => lower.includes(kw));
}

function mentionsAgent(text: string, agent: PersonaId): boolean {
  const lower = text.toLowerCase();
  return NAME_ALIASES[agent].some((alias) => lower.includes(alias));
}

function scoreAgents(
  lastMessage: Message,
  allMessages: Message[]
): TurnCandidate[] {
  const otherAgents = PERSONA_ORDER.filter((a) => a !== lastMessage.agent);

  const candidates: TurnCandidate[] = otherAgents.map((agent) => {
    let priority = 0;
    let reason: InterjectionReason = 'COUNTER';
    const content = lastMessage.content;

    // Direct address — highest priority
    if (mentionsAgent(content, agent)) {
      priority += 10;
      reason = 'OBJECTION';
    }

    // Domain relevance
    if (isInDomain(content, agent)) {
      priority += 7;
      if (reason === 'COUNTER') reason = 'EVIDENCE';
    }

    // Question directed broadly
    if (content.includes('?')) {
      priority += 3;
      if (reason === 'COUNTER') reason = 'CHALLENGE';
    }

    // Recency: penalize agents who just spoke
    const last3 = allMessages.slice(-3);
    const recentCount = last3.filter((m) => m.agent === agent).length;
    priority -= recentCount * 5;

    // Silence bonus: reward agents who haven't spoken in a while
    let turnsSinceSpoke = 0;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].agent === agent) break;
      turnsSinceSpoke++;
    }
    priority += Math.min(turnsSinceSpoke * 2, 8);

    // Random jitter for variety
    priority += Math.random() * 3;

    return { agent, reason, priority, replyTo: lastMessage.agent };
  });

  return candidates.sort((a, b) => b.priority - a.priority);
}

// --- Moderator interjections ---
function generateModeratorInterjection(
  messages: Message[],
  flipConditions: FlipCondition[]
): string | null {
  const count = messages.length;

  // Push for flip conditions if none found yet
  if (flipConditions.length === 0 && count > 8) {
    return "You've been going back and forth — what specific, testable evidence would actually change your position?";
  }

  // Check if one agent is being left out
  const last5 = messages.slice(-5);
  const activeAgents = new Set(last5.map((m) => m.agent));
  if (activeAgents.size < 3) {
    const missing = PERSONA_ORDER.find((a) => !activeAgents.has(a));
    if (missing) {
      return `${PERSONAS[missing].name} has been quiet — what's your take on this exchange?`;
    }
  }

  // Push for depth
  if (count > 12 && flipConditions.length < 2) {
    return "Steel-man the other side. What's the strongest argument against your own position?";
  }

  return null;
}

// --- Main debate generator ---
export async function* runDebate(topic: string): AsyncGenerator<SSEEvent> {
  const messages: Message[] = [];
  const flipConditions: FlipCondition[] = [];
  const evidenceStore = getEvidenceStore();
  let messageIndex = 0;
  let moderatorNote: string | undefined;

  // === PHASE 1: OPENING ===
  yield { type: 'phase', phase: 'opening' };

  for (const agent of PERSONA_ORDER) {
    yield { type: 'message_start', agent };

    const relevantEvidence = evidenceStore.retrieve(agent, topic, 5);
    const systemPrompt = buildSystemPrompt(agent, topic, relevantEvidence);
    const userMessage = buildOpeningMessage(topic);
    let fullText = '';

    try {
      const stream = await streamMessage(systemPrompt, [
        { role: 'user', content: userMessage },
      ]);
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          fullText += event.delta.text;
          yield { type: 'message_chunk', agent, chunk: event.delta.text };
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', message: `Error from ${PERSONAS[agent].name}: ${errMsg}` };
      fullText = `[Error: ${errMsg}]`;
    }

    yield { type: 'message_end', agent };

    const flips = extractFlipConditions(fullText, agent, flipConditions);
    for (const flip of flips) {
      flipConditions.push(flip);
      yield { type: 'flip_condition', data: flip };
    }

    messages.push({
      id: `msg-${messageIndex++}`,
      agent,
      content: fullText,
      timestamp: Date.now(),
    });
  }

  // === PHASE 2: DYNAMIC DEBATE ===
  yield { type: 'phase', phase: 'debate' };

  const closingSlots = PERSONA_ORDER.length;
  const debateBudget = MESSAGE_BUDGET - messages.length - closingSlots;

  for (let turn = 0; turn < debateBudget; turn++) {
    const lastMessage = messages[messages.length - 1];

    // Score who should respond next
    const candidates = scoreAgents(lastMessage, messages);
    yield {
      type: 'queue_update',
      queue: candidates.map((c) => ({ agent: c.agent, reason: c.reason })),
    };

    const next = candidates[0];
    yield {
      type: 'message_start',
      agent: next.agent,
      reason: next.reason,
      replyTo: next.replyTo,
    };

    // Retrieve relevant evidence based on conversation context
    const context = `${topic}\n${lastMessage.content}`;
    const relevantEvidence = evidenceStore.retrieve(next.agent, context, 3);
    const systemPrompt = buildSystemPrompt(next.agent, topic, relevantEvidence);
    const userMessage = buildDebateTurnMessage(
      next.reason,
      lastMessage,
      messages,
      moderatorNote
    );
    moderatorNote = undefined;

    let fullText = '';
    try {
      const stream = await streamMessage(systemPrompt, [
        { role: 'user', content: userMessage },
      ]);
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          fullText += event.delta.text;
          yield { type: 'message_chunk', agent: next.agent, chunk: event.delta.text };
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', message: `Error from ${PERSONAS[next.agent].name}: ${errMsg}` };
      fullText = `[Error: ${errMsg}]`;
    }

    yield { type: 'message_end', agent: next.agent };

    const flips = extractFlipConditions(fullText, next.agent, flipConditions);
    for (const flip of flips) {
      flipConditions.push(flip);
      yield { type: 'flip_condition', data: flip };
    }

    messages.push({
      id: `msg-${messageIndex++}`,
      agent: next.agent,
      content: fullText,
      timestamp: Date.now(),
      reason: next.reason,
      replyTo: next.replyTo,
    });

    // Moderator interjection every ~6 debate messages
    if ((turn + 1) % 6 === 0) {
      const mod = generateModeratorInterjection(messages, flipConditions);
      if (mod) {
        yield { type: 'moderator', message: mod };
        moderatorNote = mod;
      }
    }
  }

  // === PHASE 3: CLOSING ===
  yield { type: 'phase', phase: 'closing' };

  for (const agent of PERSONA_ORDER) {
    yield { type: 'message_start', agent };

    const relevantEvidence = evidenceStore.retrieve(agent, topic, 3);
    const systemPrompt = buildSystemPrompt(agent, topic, relevantEvidence);
    const userMessage = buildClosingMessage(messages, flipConditions.length);
    let fullText = '';

    try {
      const stream = await streamMessage(systemPrompt, [
        { role: 'user', content: userMessage },
      ]);
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          fullText += event.delta.text;
          yield { type: 'message_chunk', agent, chunk: event.delta.text };
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', message: `Error from ${PERSONAS[agent].name}: ${errMsg}` };
      fullText = `[Error: ${errMsg}]`;
    }

    yield { type: 'message_end', agent };

    const flips = extractFlipConditions(fullText, agent, flipConditions);
    for (const flip of flips) {
      flipConditions.push(flip);
      yield { type: 'flip_condition', data: flip };
    }

    messages.push({
      id: `msg-${messageIndex++}`,
      agent,
      content: fullText,
      timestamp: Date.now(),
    });
  }

  yield { type: 'complete' };
}
