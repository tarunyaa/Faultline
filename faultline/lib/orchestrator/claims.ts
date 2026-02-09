import { completeJSON } from '@/lib/llm/client'
import { claimDecompositionPrompt } from '@/lib/llm/prompts'
import type { Claim } from '@/lib/types'

interface ClaimDecompositionResult {
  claims: { text: string }[]
}

/**
 * Decompose a topic into 2-4 testable claims via LLM.
 */
export async function decomposeClaims(
  topic: string,
  debateId: string,
): Promise<Claim[]> {
  const result = await completeJSON<ClaimDecompositionResult>({
    messages: [{ role: 'user', content: claimDecompositionPrompt(topic) }],
    model: 'sonnet',
    temperature: 0.5,
  })

  return result.claims.map((c, i) => ({
    id: `claim-${i}`,
    text: c.text,
    debateId,
  }))
}
