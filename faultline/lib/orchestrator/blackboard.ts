import type {
  BlackboardState,
  Claim,
  Crux,
  Dispute,
  FlipCondition,
  AgentStance,
  PersonaId,
  Stance,
} from '@/lib/types'
import { complete } from '@/lib/llm/client'
import { blackboardSummaryPrompt } from '@/lib/llm/prompts'

// ─── Create ──────────────────────────────────────────────────

export function createBlackboard(topic: string, claims: Claim[]): BlackboardState {
  return {
    topic,
    claims,
    cruxCandidates: [],
    disputes: [],
    flipConditions: [],
    openQuestions: [],
    stances: [],
  }
}

// ─── Update After Agent Turn ─────────────────────────────────

export interface TurnResult {
  personaId: PersonaId
  stances: { claimId: string; stance: Stance; confidence: number }[]
  newCruxes: string[]
  flipTriggers: string[]
  round: number
}

export function updateBlackboard(
  board: BlackboardState,
  turn: TurnResult,
): BlackboardState {
  // Deep copy to avoid mutation
  const next: BlackboardState = JSON.parse(JSON.stringify(board))

  // 1. Add new stances
  for (const s of turn.stances) {
    next.stances.push({
      personaId: turn.personaId,
      claimId: s.claimId,
      stance: s.stance,
      confidence: s.confidence,
      round: turn.round,
    })
  }

  // 2. Add new cruxes (dedup by proposition text)
  for (const cruxText of turn.newCruxes) {
    const exists = next.cruxCandidates.some(
      c => c.proposition.toLowerCase() === cruxText.toLowerCase(),
    )
    if (!exists) {
      next.cruxCandidates.push({
        id: `crux-${next.cruxCandidates.length}`,
        proposition: cruxText,
        weight: 0.5,
        surfacedByTables: [0], // single table for V1
        resolved: false,
      })
    }
  }

  // 3. Check flip triggers
  for (const trigger of turn.flipTriggers) {
    // Find matching flip condition for this persona
    const existing = next.flipConditions.find(
      fc => fc.personaId === turn.personaId && fc.condition === trigger,
    )
    if (existing) {
      existing.triggered = true
    } else {
      // Add as new flip condition
      next.flipConditions.push({
        personaId: turn.personaId,
        condition: trigger,
        claimId: turn.stances[0]?.claimId ?? '',
        triggered: true,
      })
    }
  }

  // 4. Rebuild disputes from latest stances per agent per claim
  next.disputes = buildDisputes(next.stances, next.claims)

  // 5. Update crux weights based on dispute intensity
  updateCruxWeights(next)

  return next
}

// ─── Dispute Building ────────────────────────────────────────

function buildDisputes(stances: AgentStance[], claims: Claim[]): Dispute[] {
  const disputes: Dispute[] = []

  for (const claim of claims) {
    // Get latest stance per persona for this claim
    const latestByPersona = new Map<PersonaId, AgentStance>()
    for (const s of stances) {
      if (s.claimId !== claim.id) continue
      const existing = latestByPersona.get(s.personaId)
      if (!existing || s.round > existing.round) {
        latestByPersona.set(s.personaId, s)
      }
    }

    const sides = Array.from(latestByPersona.values()).map(s => ({
      personaId: s.personaId,
      stance: s.stance,
      confidence: s.confidence,
    }))

    // Only add as dispute if there's disagreement
    const stanceSet = new Set(sides.map(s => s.stance))
    if (stanceSet.size > 1) {
      disputes.push({ claimId: claim.id, sides })
    }
  }

  return disputes
}

// ─── Crux Weight Update ──────────────────────────────────────

function updateCruxWeights(board: BlackboardState): void {
  // Weight cruxes by how many disputes they relate to
  // Simple heuristic: cruxes mentioned more recently get higher weight
  const disputeClaimIds = new Set(board.disputes.map(d => d.claimId))

  for (const crux of board.cruxCandidates) {
    if (crux.resolved) {
      crux.weight = 0
      continue
    }
    // Base weight from being active
    let weight = 0.3
    // Boost if related to active disputes
    if (disputeClaimIds.size > 0) {
      weight += 0.3
    }
    // Boost by recency (more recent = higher id number)
    const idNum = parseInt(crux.id.split('-')[1] ?? '0')
    weight += Math.min(0.3, idNum * 0.05)
    crux.weight = Math.min(1.0, weight)
  }
}

// ─── Summarize ───────────────────────────────────────────────

/**
 * Summarize blackboard state to a token budget using LLM.
 * Falls back to a simple text representation if the blackboard is small enough.
 */
export async function summarizeBlackboard(
  board: BlackboardState,
  tokenBudget: number = 800,
): Promise<string> {
  // For small boards, just do a simple text summary
  const simpleText = simpleBlackboardSummary(board)
  // Rough estimate: 1 token ≈ 4 chars
  if (simpleText.length / 4 < tokenBudget) {
    return simpleText
  }

  // Use LLM for compression
  return complete({
    messages: [
      { role: 'user', content: blackboardSummaryPrompt(board, tokenBudget) },
    ],
    model: 'haiku',
    maxTokens: Math.ceil(tokenBudget * 1.2), // slight buffer
    temperature: 0.3,
  })
}

function simpleBlackboardSummary(board: BlackboardState): string {
  const parts: string[] = [`Topic: ${board.topic}`]

  // Claims
  parts.push('\nClaims:')
  for (const c of board.claims) {
    parts.push(`  - [${c.id}] ${c.text}`)
  }

  // Latest stances per agent per claim
  const latestStances = getLatestStances(board.stances)
  if (latestStances.length > 0) {
    parts.push('\nCurrent Positions:')
    for (const s of latestStances) {
      parts.push(`  - ${s.personaId} on ${s.claimId}: ${s.stance} (${s.confidence})`)
    }
  }

  // Active disputes
  if (board.disputes.length > 0) {
    parts.push('\nActive Disputes:')
    for (const d of board.disputes) {
      const sidesStr = d.sides
        .map(s => `${s.personaId}:${s.stance}(${s.confidence})`)
        .join(' vs ')
      parts.push(`  - ${d.claimId}: ${sidesStr}`)
    }
  }

  // Cruxes
  const activeCruxes = board.cruxCandidates.filter(c => !c.resolved)
  if (activeCruxes.length > 0) {
    parts.push('\nOpen Cruxes:')
    for (const c of activeCruxes) {
      parts.push(`  - [${c.id}] ${c.proposition} (weight: ${c.weight.toFixed(2)})`)
    }
  }

  // Flip conditions
  const triggered = board.flipConditions.filter(fc => fc.triggered)
  if (triggered.length > 0) {
    parts.push('\nTriggered Flip Conditions:')
    for (const fc of triggered) {
      parts.push(`  - ${fc.personaId}: ${fc.condition}`)
    }
  }

  return parts.join('\n')
}

function getLatestStances(stances: AgentStance[]): AgentStance[] {
  const latest = new Map<string, AgentStance>()
  for (const s of stances) {
    const key = `${s.personaId}:${s.claimId}`
    const existing = latest.get(key)
    if (!existing || s.round > existing.round) {
      latest.set(key, s)
    }
  }
  return Array.from(latest.values())
}
