// ─── Crux Card Generation ────────────────────────────────────

import type { CruxCard, CruxRoom, PersonaId, Position, DisagreementType } from './types'

/**
 * Generate a crux card from a completed crux room
 */
export function generateCruxCard(
  room: CruxRoom,
  positions: Map<PersonaId, {
    position: Position
    reasoning: string
    falsifier?: string
  }>,
  disagreementType: DisagreementType,
  diagnosis: string,
  resolved: boolean,
  resolution?: string
): CruxCard {
  // Build personas object for card
  const personasObj: CruxCard['personas'] = {}

  for (const [personaId, data] of positions.entries()) {
    personasObj[personaId] = {
      position: data.position,
      reasoning: data.reasoning,
      falsifier: data.falsifier,
    }
  }

  return {
    id: `card-${room.id}`,
    question: room.question,
    personas: personasObj,
    disagreementType,
    diagnosis,
    resolved,
    resolution,
    sourceMessages: room.sourceMessages,
    cruxRoomId: room.id,
    timestamp: Date.now(),
  }
}

/**
 * Infer position (YES/NO/NUANCED) from reasoning text
 */
export function inferPosition(reasoning: string, question: string): Position {
  const lower = reasoning.toLowerCase()

  // For questions starting with "Is" or "Does" or "Will"
  const isYesNoQuestion = /^(is|does|will|can|should|would)/i.test(question)

  if (isYesNoQuestion) {
    // Look for strong affirmative signals
    if (
      (lower.includes(' yes') || lower.includes('absolutely') || lower.includes('definitely')) &&
      !lower.includes('no') &&
      !lower.includes('but')
    ) {
      return 'YES'
    }

    // Look for strong negative signals
    if (
      (lower.includes(' no') || lower.includes('not') || lower.includes("isn't") || lower.includes("won't")) &&
      !lower.includes('yes')
    ) {
      return 'NO'
    }
  }

  // Default to nuanced for complex or conditional positions
  return 'NUANCED'
}
