// ─── Dialogue Agent ────────────────────────────────────────────

import type { DialogueMessage, DebateAspect } from './types'
import { completeJSON } from '@/lib/llm/client'
import { buildVoiceConstraints, getChatStyleHint } from './speech-roles'
import type { PersonaContract, Persona } from '@/lib/types'
import { buildSystemPrompt } from '@/lib/personas/loader'

// ─── Shared Utilities ─────────────────────────────────────────

const hardBanned = [
  /^(that'?s a (great|good|interesting|valid|fair) (point|question|observation))/i,
  /\bas an AI\b/i,
  /^(firstly|secondly|thirdly)[,\s]/i,
  /\bin (summary|conclusion)[,\s]/i,
  /\blet'?s break this down\b/i,
]

function checkBanned(utterance: string, personaName: string): string | null {
  for (const pattern of hardBanned) {
    if (pattern.test(utterance)) {
      console.warn(`[${personaName}] Banned pattern detected, rejecting`)
      return null
    }
  }
  return utterance
}

function buildFullSystemPrompt(contract: PersonaContract, persona: Persona): string {
  return buildSystemPrompt(contract, persona) + buildVoiceConstraints(persona.name)
}

// ─── Opening (existing) ───────────────────────────────────────

/**
 * Opening message — persona's first take on the topic.
 */
export async function generateOpeningMicroTurn(
  contract: PersonaContract,
  persona: Persona,
  topic: string,
): Promise<string | null> {
  const systemPrompt = buildFullSystemPrompt(contract, persona)
  const chatStyleHint = getChatStyleHint(persona.name)

  const prompt = `Group chat starting: "${topic}"

Your style: ${chatStyleHint}

Drop your take in 2-4 sentences. Establish your actual position — not a summary, your view.

BANNED:
- "I think" / "In my view" / "Here's my take"
- Any preamble or throat-clearing
- Vague statements that don't commit to a position

Output ONLY JSON:
{
  "utterance": "your opening take"
}`

  try {
    const response = await completeJSON<{ utterance: string }>({
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      model: 'haiku',
      maxTokens: 200,
      temperature: 0.85,
    })

    if (!response.utterance || response.utterance.trim().length === 0) return null
    return checkBanned(response.utterance, persona.name)
  } catch (error) {
    console.error(`[${persona.name}] Error generating opening:`, error)
    return null
  }
}

// ─── Panel Debate: Take ───────────────────────────────────────

/**
 * Generate a take on a specific debate aspect (parallel round).
 */
export async function generateTake(
  contract: PersonaContract,
  persona: Persona,
  aspect: DebateAspect,
  contextText: string,
): Promise<string | null> {
  const systemPrompt = buildFullSystemPrompt(contract, persona)

  const prompt = `Round: ${aspect.label}
${aspect.description}

${contextText}

What's your specific view on this aspect? Argue from YOUR angle.
Length: 2-4 sentences.

Output ONLY JSON:
{ "utterance": "your take" }`

  try {
    const response = await completeJSON<{ utterance: string }>({
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      model: 'haiku',
      maxTokens: 200,
      temperature: 0.85,
    })

    if (!response.utterance || response.utterance.trim().length === 0) return null
    return checkBanned(response.utterance, persona.name)
  } catch (error) {
    console.error(`[${persona.name}] Error generating take:`, error)
    return null
  }
}

// ─── Panel Debate: Rebuttal ──────────────────────────────────

/**
 * Generate a rebuttal to a specific agent's message (sequential clash).
 */
export async function generateRebuttal(
  contract: PersonaContract,
  persona: Persona,
  targetMessage: DialogueMessage,
  targetName: string,
  contextText: string,
): Promise<string | null> {
  const systemPrompt = buildFullSystemPrompt(contract, persona)

  const prompt = `${contextText}

${targetName} said: "${targetMessage.content}"

Push back on the weakest part of their argument.
Length: 2-3 sentences.

Output ONLY JSON:
{ "utterance": "your rebuttal" }`

  try {
    const response = await completeJSON<{ utterance: string }>({
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      model: 'haiku',
      maxTokens: 200,
      temperature: 0.85,
    })

    if (!response.utterance || response.utterance.trim().length === 0) return null
    return checkBanned(response.utterance, persona.name)
  } catch (error) {
    console.error(`[${persona.name}] Error generating rebuttal:`, error)
    return null
  }
}

// ─── Panel Debate: Closing ───────────────────────────────────

/**
 * Generate closing statement after full debate.
 */
export async function generateClosing(
  contract: PersonaContract,
  persona: Persona,
  topic: string,
  contextText: string,
): Promise<string | null> {
  const systemPrompt = buildFullSystemPrompt(contract, persona)

  const prompt = `The debate on "${topic}" is concluding.

${contextText}

Final position. If you've updated from your opening, say how. If not, say why.
Length: 3-5 sentences.

Output ONLY JSON:
{ "utterance": "your closing statement" }`

  try {
    const response = await completeJSON<{ utterance: string }>({
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      model: 'haiku',
      maxTokens: 200,
      temperature: 0.85,
    })

    if (!response.utterance || response.utterance.trim().length === 0) return null
    return checkBanned(response.utterance, persona.name)
  } catch (error) {
    console.error(`[${persona.name}] Error generating closing:`, error)
    return null
  }
}
