import type { BlackboardState, DebateOutput } from '@/lib/types'
import { completeJSON } from '@/lib/llm/client'
import { finalOutputPrompt } from '@/lib/llm/prompts'

/**
 * Final LLM pass to extract structured debate output from the blackboard.
 * Uses Haiku for cost efficiency since this is extraction, not generation.
 */
export async function extractOutput(
  blackboard: BlackboardState,
): Promise<DebateOutput> {
  const output = await completeJSON<DebateOutput>({
    messages: [
      { role: 'user', content: finalOutputPrompt(blackboard) },
    ],
    model: 'haiku',
    maxTokens: 2048,
    temperature: 0.3,
  })

  // Ensure cruxes have surfacedByTables (default to [0] for single-table V1)
  for (const crux of output.cruxes) {
    if (!crux.surfacedByTables) {
      crux.surfacedByTables = [0]
    }
  }

  return output
}
