// ─── Turn Manager (Controller Picks Reply Target + Intent) ───

import type { DialogueMessage, PersonaId } from './types'

export type TurnIntent =
  | 'AGREE'       // Support someone's point
  | 'DISAGREE'    // Challenge someone's point
  | 'ASK'         // Ask a question
  | 'CLARIFY'     // Explain your position
  | 'EVIDENCE'    // Bring data/example
  | 'REFRAME'     // Shift perspective

export interface TurnAssignment {
  personaId: PersonaId
  replyToMessageId?: string
  intent: TurnIntent
  reason: string  // Why this persona should speak now
}

/**
 * Decide who should speak next and what they should do.
 *
 * This is the "dialogue manager" - it creates natural flow by:
 * - Picking who speaks (not just round-robin)
 * - Picking what they reply to (threading)
 * - Picking their intent (ASK/CHALLENGE/etc)
 */
export function assignNextTurn(
  messages: DialogueMessage[],
  personaIds: PersonaId[],
  lastSpeakerId?: PersonaId
): TurnAssignment {
  // Get last message
  const lastMessage = messages[messages.length - 1]

  // Simple heuristic for now: next persona in rotation
  const currentIndex = lastSpeakerId ? personaIds.indexOf(lastSpeakerId) : -1
  const nextIndex = (currentIndex + 1) % personaIds.length
  const nextPersonaId = personaIds[nextIndex]

  // Determine intent based on conversation flow
  let intent: TurnIntent = 'DISAGREE' // Default to disagreement for spice

  if (messages.length < 3) {
    intent = 'CLARIFY' // Early messages = state positions
  } else if (Math.random() > 0.7) {
    intent = 'ASK' // 30% chance of asking question
  } else if (Math.random() > 0.5) {
    intent = 'EVIDENCE' // 50% chance of bringing data
  }

  return {
    personaId: nextPersonaId,
    replyToMessageId: lastMessage?.id,
    intent,
    reason: `React to ${lastSpeakerId || 'the conversation'}`
  }
}

/**
 * Get the intent instruction for the prompt
 */
export function getIntentInstruction(intent: TurnIntent): string {
  switch (intent) {
    case 'AGREE':
      return 'Support their point. One sentence.'
    case 'DISAGREE':
      return 'Challenge their point. One sentence.'
    case 'ASK':
      return 'Ask a pointed question. One sentence, ends with ?'
    case 'CLARIFY':
      return 'State your position. One sentence.'
    case 'EVIDENCE':
      return 'Bring a specific example or data point. One sentence.'
    case 'REFRAME':
      return 'Shift how they\'re thinking about it. One sentence.'
  }
}
