export type PersonaId = 'elon' | 'sam' | 'jensen';

export type InterjectionReason =
  | 'OBJECTION'
  | 'COUNTER'
  | 'EVIDENCE'
  | 'CHALLENGE'
  | 'CONCEDE'
  | 'REDIRECT';

export type DebatePhase = 'opening' | 'debate' | 'closing';

export type CardSubtype = 'Builder' | 'Contrarian' | 'Skeptic' | 'Infra' | 'Scaling' | 'Visionary';

export interface PersonaStats {
  aggression: number;  // 1-5
  evidence: number;    // 1-5
  timeHorizon: number; // 1-5
}

export interface PersonaConfig {
  id: PersonaId;
  name: string;
  title: string;
  avatar: string;
  color: string;
  pieceType: 'king' | 'queen' | 'bishop' | 'knight' | 'rook' | 'pawn';
  subtypes: CardSubtype[];
  stats: PersonaStats;
  signatureMove: string;
  weakness: string;
}

export interface Message {
  id: string;
  agent: PersonaId;
  content: string;
  timestamp: number;
  reason?: InterjectionReason;
  replyTo?: PersonaId;
}

export interface FlipCondition {
  id: string;
  agent: PersonaId;
  condition: string;
}

export interface TurnCandidate {
  agent: PersonaId;
  reason: InterjectionReason;
  priority: number;
  replyTo: PersonaId;
}

export type SSEEvent =
  | { type: 'phase'; phase: DebatePhase }
  | { type: 'message_start'; agent: PersonaId; reason?: InterjectionReason; replyTo?: PersonaId }
  | { type: 'message_chunk'; agent: PersonaId; chunk: string }
  | { type: 'message_end'; agent: PersonaId }
  | { type: 'flip_condition'; data: FlipCondition }
  | { type: 'queue_update'; queue: Array<{ agent: PersonaId; reason: InterjectionReason }> }
  | { type: 'moderator'; message: string }
  | { type: 'complete' }
  | { type: 'error'; message: string };

export const PERSONAS: Record<PersonaId, PersonaConfig> = {
  elon: {
    id: 'elon',
    name: 'Elon Musk',
    title: 'CEO of Tesla, SpaceX, xAI',
    avatar: '⚡',
    color: 'blue',
    pieceType: 'knight',
    subtypes: ['Contrarian', 'Visionary'],
    stats: { aggression: 4, evidence: 2, timeHorizon: 5 },
    signatureMove: 'First-principles reductionism',
    weakness: 'Compresses timelines, dismisses friction',
  },
  sam: {
    id: 'sam',
    name: 'Sam Altman',
    title: 'CEO of OpenAI',
    avatar: '🔮',
    color: 'emerald',
    pieceType: 'queen',
    subtypes: ['Builder', 'Scaling'],
    stats: { aggression: 2, evidence: 4, timeHorizon: 3 },
    signatureMove: 'The scaling curves are undeniable',
    weakness: 'Horizon-shifting, unfalsifiable internal data',
  },
  jensen: {
    id: 'jensen',
    name: 'Jensen Huang',
    title: 'CEO of NVIDIA',
    avatar: '🔥',
    color: 'amber',
    pieceType: 'rook',
    subtypes: ['Infra', 'Builder'],
    stats: { aggression: 2, evidence: 5, timeHorizon: 4 },
    signatureMove: 'Customer demand is the proof',
    weakness: 'Extrapolates momentum indefinitely',
  },
};

export const PERSONA_ORDER: PersonaId[] = ['elon', 'sam', 'jensen'];
export const MESSAGE_BUDGET = 18;

// Evidence Store Types
export interface PersonaEvidence {
  id: string;
  persona: PersonaId;
  type: 'anchor_quote' | 'signature_take' | 'disallowed_move';
  text: string;
  source_url: string;
  source_type: 'twitter' | 'podcast' | 'essay' | 'interview' | 'wikipedia';
  date: string;
  topic_tags: string[];
  confidence: 'high' | 'medium' | 'low';
  context?: string;
  is_flip?: boolean;
  is_core_belief?: boolean;
  embedding?: number[];
}
