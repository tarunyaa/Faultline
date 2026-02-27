// ─── Topic Decomposition ─────────────────────────────────────

import { completeJSON } from '@/lib/llm/client'
import type { DebateAspect } from './types'

export async function decomposeTopicIntoAspects(
  topic: string,
  count: number = 3,
): Promise<DebateAspect[]> {
  const result = await completeJSON<{ aspects: Array<{ label: string; description: string }> }>({
    system: 'You break debate topics into distinct debatable aspects.',
    messages: [{
      role: 'user',
      content: `Break this debate topic into ${count} distinct debatable aspects.

Topic: "${topic}"

Each aspect should be:
- A specific, arguable sub-question (not just a category)
- Different enough from other aspects that debaters won't repeat themselves
- Relevant to the wider topic

Output JSON:
{
  "aspects": [
    { "label": "short label (3-5 words)", "description": "one sentence elaboration" }
  ]
}`,
    }],
    model: 'haiku',
    maxTokens: 300,
    temperature: 0.3,
  })

  return result.aspects.map((a, i) => ({
    id: `aspect-${i + 1}`,
    label: a.label,
    description: a.description,
  }))
}
