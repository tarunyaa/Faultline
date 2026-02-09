import type { BlackboardState, Claim, AgentStance, PersonaId } from '@/lib/types'
import { summarizeBlackboard } from './blackboard'

// ─── Turn Message Log ────────────────────────────────────────

export interface TurnMessage {
  personaId: PersonaId
  round: number
  content: string
}

// ─── Context Assembly ────────────────────────────────────────

export interface AssembledContext {
  blackboardSummary: string
  localNeighborhood: string
  claims: Claim[]
  currentStances: AgentStance[]
}

/**
 * Assemble per-turn context for an agent from blackboard + message history.
 * V1: No retrieval — uses full blackboard summary + local neighborhood.
 */
export async function assembleContext(
  personaId: PersonaId,
  board: BlackboardState,
  messages: TurnMessage[],
  round: number,
): Promise<AssembledContext> {
  // 1. Blackboard summary
  const blackboardSummary = await summarizeBlackboard(board, 800)

  // 2. Local neighborhood: last N messages (all agents, last 2 rounds)
  const recentMessages = messages
    .filter(m => m.round >= round - 2)
    .slice(-10)

  const localNeighborhood = recentMessages.length > 0
    ? recentMessages
        .map(m => `[Round ${m.round}] ${m.personaId}: ${m.content}`)
        .join('\n\n')
    : ''

  // 3. Current stances for this agent (most recent per claim)
  const currentStances = getLatestStancesForAgent(personaId, board.stances)

  return {
    blackboardSummary,
    localNeighborhood,
    claims: board.claims,
    currentStances,
  }
}

function getLatestStancesForAgent(
  personaId: PersonaId,
  stances: AgentStance[],
): AgentStance[] {
  const latest = new Map<string, AgentStance>()
  for (const s of stances) {
    if (s.personaId !== personaId) continue
    const existing = latest.get(s.claimId)
    if (!existing || s.round > existing.round) {
      latest.set(s.claimId, s)
    }
  }
  return Array.from(latest.values())
}
