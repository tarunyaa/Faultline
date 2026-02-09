import type { Persona, PersonaContract, Claim, AgentStance, PersonaId } from '@/lib/types'
import { loadContracts } from '@/lib/personas/loader'
import { getPersona } from '@/lib/personas/loader'
import { buildSystemPrompt } from '@/lib/personas/loader'
import { completeJSON } from '@/lib/llm/client'
import { initialStancePrompt } from '@/lib/llm/prompts'

// ─── Agent State ─────────────────────────────────────────────

export interface Agent {
  persona: Persona
  contract: PersonaContract
  systemPrompt: string
}

// ─── Initialization ──────────────────────────────────────────

/**
 * Load persona contracts and build agent state for all agents in the hand.
 */
export async function initializeAgents(
  personaIds: PersonaId[],
): Promise<Map<PersonaId, Agent>> {
  const contracts = await loadContracts(personaIds)
  const agents = new Map<PersonaId, Agent>()

  for (const personaId of personaIds) {
    const contract = contracts.get(personaId)
    if (!contract) {
      throw new Error(`Contract not found for persona: ${personaId}`)
    }

    const persona = await getPersona(personaId)
    if (!persona) {
      throw new Error(`Persona not found: ${personaId}`)
    }

    agents.set(personaId, {
      persona,
      contract,
      systemPrompt: buildSystemPrompt(contract, persona),
    })
  }

  return agents
}

// ─── Initial Stance Generation ───────────────────────────────

interface StanceResult {
  stances: {
    claimId: string
    stance: 'pro' | 'con' | 'uncertain'
    confidence: number
    reasoning: string
  }[]
}

/**
 * Generate initial stances for an agent on all claims via LLM.
 */
export async function generateInitialStances(
  agent: Agent,
  claims: Claim[],
): Promise<AgentStance[]> {
  const result = await completeJSON<StanceResult>({
    system: agent.systemPrompt,
    messages: [{ role: 'user', content: initialStancePrompt(claims) }],
    model: 'sonnet',
    maxTokens: 512,
    temperature: 0.6,
  })

  return result.stances.map(s => ({
    personaId: agent.persona.id,
    claimId: s.claimId,
    stance: s.stance,
    confidence: Math.max(0, Math.min(1, s.confidence)),
    round: 0,
  }))
}

export interface InitialStancesWithReasoning {
  stances: AgentStance[]
  reasonings: { claimId: string; reasoning: string }[]
}

/**
 * Generate initial stances and return per-claim reasoning for display.
 */
export async function generateInitialStancesWithReasoning(
  agent: Agent,
  claims: Claim[],
): Promise<InitialStancesWithReasoning> {
  const result = await completeJSON<StanceResult>({
    system: agent.systemPrompt,
    messages: [{ role: 'user', content: initialStancePrompt(claims) }],
    model: 'sonnet',
    maxTokens: 512,
    temperature: 0.6,
  })

  const stances = result.stances.map(s => ({
    personaId: agent.persona.id,
    claimId: s.claimId,
    stance: s.stance,
    confidence: Math.max(0, Math.min(1, s.confidence)),
    round: 0,
  }))

  const reasonings = result.stances.map(s => ({
    claimId: s.claimId,
    reasoning: s.reasoning,
  }))

  return { stances, reasonings }
}
