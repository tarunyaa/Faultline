// ─── Core Types for Dialogue Layer ───────────────────────────

import type { DisagreementCandidate, CruxCard, CruxMessage } from '@/lib/crux/types'

export type PersonaId = string

export interface DialogueMessage {
  id: string
  personaId: PersonaId
  content: string
  replyTo?: string        // Message ID being replied to (for @mention display)
  timestamp: number
}

export interface DialogueState {
  topic: string
  messages: DialogueMessage[]
  activePersonas: PersonaId[]
  startTime: number
  lastSpeakerId?: PersonaId
}

export interface DialogueConfig {
  topic: string
  personaIds: PersonaId[]
  maxMessages?: number         // Default: 50
  maxDurationMs?: number       // Default: 5 minutes
}

// ─── Panel Debate Types ──────────────────────────────────────

export interface DebateAspect {
  id: string
  label: string
  description: string
}

export interface ContestedClaim {
  claim: string
  personas: [string, string]
  status: 'unresolved' | 'resolved'
  source: 'detection' | 'crux_card'
}

export interface RoundSummary {
  aspect: DebateAspect
  summary: string
  takes: DialogueMessage[]
  clashMessages: DialogueMessage[]
}

export interface DebateContext {
  originalTopic: string
  aspects: DebateAspect[]
  rounds: RoundSummary[]
  contestedClaims: ContestedClaim[]
  cruxCards: CruxCard[]
}

export interface PositionShift {
  personaId: string
  shifted: boolean
  summary: string
}

// SSE Events
export type DialogueEvent =
  | { type: 'dialogue_start'; topic: string; personas: PersonaId[] }
  | { type: 'debate_start'; topic: string; aspects: DebateAspect[]; personas: PersonaId[] }
  | { type: 'round_start'; aspect: DebateAspect; roundNumber: number }
  | { type: 'message_posted'; message: DialogueMessage; phase?: 'opening' | 'take' | 'clash' | 'closing' }
  | { type: 'clash_start'; personas: string[]; aspect: string }
  | { type: 'round_end'; aspect: DebateAspect }
  | { type: 'disagreement_detected'; candidate: DisagreementCandidate }
  | { type: 'crux_room_spawning'; roomId: string; question: string; label: string; personas: PersonaId[] }
  | { type: 'crux_message'; roomId: string; message: CruxMessage }
  | { type: 'crux_card_posted'; card: CruxCard }
  | { type: 'dialogue_complete'; finalState?: DialogueState; shifts?: PositionShift[] }
  | { type: 'error'; error: string }
