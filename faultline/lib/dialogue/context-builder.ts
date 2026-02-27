// ─── Context Builder ─────────────────────────────────────────

import type { DebateContext, DialogueMessage } from './types'
import { completeJSON } from '@/lib/llm/client'

export function buildTurnContext(
  context: DebateContext,
  currentRoundMessages: DialogueMessage[],
  personaNames: Map<string, string>,
): string {
  const parts: string[] = []

  parts.push(`Debate on: "${context.originalTopic}"`)

  if (context.rounds.length > 0) {
    parts.push('Previous rounds:')
    for (const round of context.rounds) {
      parts.push(`- ${round.aspect.label}: ${round.summary}`)
    }
  }

  if (context.contestedClaims.length > 0) {
    parts.push('Open disagreements:')
    for (const claim of context.contestedClaims) {
      const names = claim.personas.map(p => personaNames.get(p) ?? p)
      parts.push(`- ${names.join(' vs ')}: ${claim.claim}`)
    }
  }

  if (context.cruxCards.length > 0) {
    parts.push('Crux cards produced:')
    for (const card of context.cruxCards) {
      parts.push(`- ${card.question} [${card.disagreementType}] ${card.resolved ? '(resolved)' : '(unresolved)'}`)
    }
  }

  if (currentRoundMessages.length > 0) {
    parts.push('This round:')
    for (const msg of currentRoundMessages) {
      parts.push(`${personaNames.get(msg.personaId) ?? msg.personaId}: "${msg.content}"`)
    }
  }

  return parts.join('\n\n')
}

export async function summarizeRound(
  aspectLabel: string,
  messages: DialogueMessage[],
  personaNames: Map<string, string>,
): Promise<string> {
  const text = messages
    .map(m => `${personaNames.get(m.personaId) ?? m.personaId}: ${m.content}`)
    .join('\n')

  const result = await completeJSON<{ summary: string }>({
    system: 'Summarize debate rounds concisely.',
    messages: [{
      role: 'user',
      content: `Summarize this round about "${aspectLabel}" in 1-2 sentences. What positions were taken? What was contested?\n\n${text}\n\nOutput JSON:\n{ "summary": "..." }`,
    }],
    model: 'haiku',
    maxTokens: 100,
    temperature: 0.2,
  })

  return result.summary
}
