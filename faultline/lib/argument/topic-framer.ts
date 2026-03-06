/**
 * Converts an open-ended topic into ARGORA Pattern 2 (Competing Positions)
 * format by generating mutually exclusive positions via LLM.
 *
 * Positions are kept broad/high-level so they don't restrict how each
 * personality agent argues — they're framing, not scripts.
 *
 * Returns both the ARGORA-formatted prompt (with Position A/B/C labels)
 * and a human-readable position legend for the frontend.
 */

import { completeJSON } from '@/lib/llm/client'

export interface PositionInfo {
  /** Internal label used by ARGORA: "Position A", "Position B", etc. */
  label: string
  /** Short human-readable name: "DRAM Bull", "NAND Bull", "Bear Case" */
  shortName: string
  /** One-sentence description of the position */
  description: string
}

export interface FramedTopic {
  originalTopic: string
  framedTopic: string
  positions: PositionInfo[]
}

export async function frameTopicAsCompetingPositions(
  topic: string,
  numPositions: number = 3
): Promise<FramedTopic> {
  const letters = ['A', 'B', 'C', 'D', 'E'].slice(0, numPositions)
  const positionLines = letters.map(l => `    { "label": "Position ${l}", "shortName": "...", "description": "..." }`).join(',\n')

  const prompt = `You are a debate framer. Given a topic, generate ${numPositions} mutually exclusive positions that experts could defend.

Rules:
- Positions must be genuinely competing — picking one means rejecting the others
- Keep each description to ONE sentence — broad and high-level
- Don't add excessive detail — experts will fill in their own reasoning
- For shortName: create a punchy 2-4 word label (e.g., "DRAM Bull", "Bear Case", "Status Quo")
- shortName should be immediately understandable without reading the description

Topic: "${topic}"

Respond with ONLY valid JSON:
{
  "positions": [
${positionLines}
  ]
}`

  const result = await completeJSON<{ positions: Array<{ label: string; shortName: string; description: string }> }>({
    messages: [{ role: 'user', content: prompt }],
    model: 'haiku',
    temperature: 0.3,
    maxTokens: 600,
  })

  const positions: PositionInfo[] = result.positions.map((p, i) => ({
    label: `Position ${letters[i]}`,
    shortName: p.shortName,
    description: p.description,
  }))

  // Build the ARGORA-formatted topic string
  const topicLines = positions.map(p => `${p.label}: ${p.description}`).join('\n')
  const answerOptions = positions.map(p => p.label).join(', ')
  const framedTopic = `Experts must evaluate the following competing positions on the given topic.

Topic: ${topic}

${topicLines}

Evaluate which position is best supported. Provide your detailed reasoning and conclude with your choice.
FINAL ANSWER: ${answerOptions}`

  return {
    originalTopic: topic,
    framedTopic,
    positions,
  }
}
