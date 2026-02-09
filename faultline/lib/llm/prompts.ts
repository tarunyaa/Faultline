import type { BlackboardState, Claim, AgentStance } from '@/lib/types'

// ─── Claim Decomposition ─────────────────────────────────────

export function claimDecompositionPrompt(topic: string): string {
  return `You are a debate analyst. Given a topic, decompose it into 2-4 specific, testable claims that capture the core disagreements.

Each claim should:
- Be a concrete proposition (not a question)
- Have a clear pro/con framing
- Be independently evaluable

Topic: "${topic}"

Respond with ONLY valid JSON matching this schema:
{
  "claims": [
    { "text": "claim text here" }
  ]
}

Return 2-4 claims. No commentary outside the JSON.`
}

// ─── Agent Turn ──────────────────────────────────────────────

export interface AgentTurnContext {
  blackboardSummary: string
  localNeighborhood: string
  claims: Claim[]
  currentStances: AgentStance[]
}

export function agentTurnPrompt(ctx: AgentTurnContext): string {
  const claimList = ctx.claims
    .map((c, i) => `  ${i + 1}. [${c.id}] ${c.text}`)
    .join('\n')

  const stanceList = ctx.currentStances.length > 0
    ? ctx.currentStances
        .map(s => `  - Claim ${s.claimId}: ${s.stance} (confidence: ${s.confidence})`)
        .join('\n')
    : '  (no prior stances)'

  return `You are participating in a structured debate. Respond to the current state of discussion.

## Claims Under Debate
${claimList}

## Your Previous Stances
${stanceList}

## Blackboard (Shared State)
${ctx.blackboardSummary}

## Recent Discussion
${ctx.localNeighborhood || '(opening round)'}

## Instructions
Engage with the claims directly. Reference specific evidence. Address disagreements with other participants. Update your stance if new arguments warrant it.

Respond with ONLY valid JSON matching this schema:
{
  "response": "Your debate contribution (2-4 paragraphs)",
  "stances": [
    {
      "claimId": "claim id",
      "stance": "pro" | "con" | "uncertain",
      "confidence": 0.0-1.0
    }
  ],
  "newCruxes": ["any new disputed propositions you identify"],
  "flipTriggers": ["any of your flip conditions that were triggered this round"]
}

Be specific, cite evidence, and include confidence levels. No text outside the JSON.`
}

// ─── Blackboard Summary ──────────────────────────────────────

export function blackboardSummaryPrompt(
  blackboard: BlackboardState,
  tokenBudget: number,
): string {
  const bb = JSON.stringify(blackboard, null, 2)

  return `Compress the following debate blackboard state into a concise summary of approximately ${tokenBudget} tokens. Preserve:
- All active claims and their current dispute status
- Key cruxes (especially unresolved ones)
- Current stance distribution per claim (who is pro/con/uncertain)
- Any triggered flip conditions
- Open questions

Blackboard state:
${bb}

Respond with a plain text summary. No JSON, no markdown headers.`
}

// ─── Initial Stance Generation ───────────────────────────────

export function initialStancePrompt(claims: Claim[]): string {
  const claimList = claims
    .map((c, i) => `  ${i + 1}. [${c.id}] ${c.text}`)
    .join('\n')

  return `Based on your profile, values, and epistemology, take an initial position on each of the following claims.

## Claims
${claimList}

Respond with ONLY valid JSON matching this schema:
{
  "stances": [
    {
      "claimId": "claim id",
      "stance": "pro" | "con" | "uncertain",
      "confidence": 0.0-1.0,
      "reasoning": "one sentence explaining your position"
    }
  ]
}

Stay in character. Be decisive — avoid defaulting to "uncertain" unless your profile genuinely supports ambiguity on that claim.`
}

// ─── Final Output Extraction ─────────────────────────────────

export function finalOutputPrompt(blackboard: BlackboardState): string {
  const bb = JSON.stringify(blackboard, null, 2)

  return `You are a debate analyst. Review the full blackboard from a multi-agent debate and extract a structured analysis.

## Blackboard State
${bb}

Extract the following into valid JSON:

{
  "cruxes": [
    {
      "id": "crux-N",
      "proposition": "the contested proposition",
      "weight": 0.0-1.0,
      "resolved": true/false
    }
  ],
  "faultLines": [
    {
      "category": "time_horizon" | "assumptions" | "identity_values" | "epistemology" | "stakes",
      "description": "what drives this disagreement",
      "relatedCruxIds": ["crux-N"]
    }
  ],
  "flipConditions": [
    {
      "personaId": "agent id",
      "condition": "what would change their mind",
      "claimId": "related claim",
      "triggered": true/false
    }
  ],
  "evidenceLedger": [
    {
      "personaId": "agent id",
      "accepted": ["evidence they accepted"],
      "rejected": [{ "evidence": "what was rejected", "reason": "why" }]
    }
  ],
  "resolutionPaths": [
    {
      "description": "experiment or data that could settle this",
      "relatedCruxIds": ["crux-N"]
    }
  ]
}

Be thorough but concise. Focus on the most significant disagreements and their root causes. Return ONLY valid JSON.`
}
