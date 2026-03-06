/**
 * Converts an open-ended topic into ARGORA Pattern 2 (Competing Positions)
 * format by generating mutually exclusive positions via LLM.
 *
 * Positions are kept broad/high-level so they don't restrict how each
 * personality agent argues — they're framing, not scripts.
 */

import { complete } from '@/lib/llm/client'

interface FramedTopic {
  originalTopic: string
  framedTopic: string
  positions: string[]
}

export async function frameTopicAsCompetingPositions(
  topic: string,
  numPositions: number = 3
): Promise<FramedTopic> {
  const prompt = `You are a debate framer. Given a topic, generate ${numPositions} mutually exclusive positions that experts could defend.

Rules:
- Positions must be genuinely competing — picking one means rejecting the others
- Keep each position to ONE sentence — broad and high-level
- Don't add excessive detail or qualifications — experts will fill in their own reasoning
- Label positions as "Position A", "Position B", etc.
- End with "FINAL ANSWER: Position A, Position B, or Position C"

Topic: "${topic}"

Respond with ONLY the formatted debate prompt, nothing else. Use this exact structure:

Experts must evaluate the following competing positions on the given topic.

Topic: [restate topic concisely]

Position A: [one-sentence position]
Position B: [one-sentence position]
Position C: [one-sentence position]

Evaluate which position is best supported. Provide your detailed reasoning and conclude with your choice.
FINAL ANSWER: Position A, Position B, or Position C`

  const result = await complete({
    messages: [{ role: 'user', content: prompt }],
    model: 'haiku',
    temperature: 0.3,
    maxTokens: 500,
  })

  // Extract positions from the response for metadata
  const positionMatches = result.match(/Position [A-Z]: .+/g) || []
  const positions = positionMatches.map(p => p.replace(/^Position [A-Z]: /, ''))

  return {
    originalTopic: topic,
    framedTopic: result.trim(),
    positions,
  }
}
