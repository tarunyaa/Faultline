// ─── Panel Debate Orchestrator ────────────────────────────────

import type {
  DialogueConfig,
  DialogueState,
  DialogueMessage,
  DialogueEvent,
  PersonaId,
  DebateContext,
  PositionShift,
} from './types'
import type { PersonaContract, Persona } from '@/lib/types'
import { loadContract, getPersona } from '@/lib/personas/loader'
import { generateOpeningMicroTurn, generateTake, generateRebuttal, generateClosing } from './agent'
import { decomposeTopicIntoAspects } from './topic-decomposer'
import { buildTurnContext, summarizeRound } from './context-builder'
import { detectDisagreements, CandidateRegistry } from './disagreement-detector'
import { runCruxRoom } from '@/lib/crux/orchestrator'
import { completeJSON } from '@/lib/llm/client'

export async function* runDialogue(
  config: DialogueConfig,
): AsyncGenerator<DialogueEvent> {
  const { topic, personaIds } = config

  const state: DialogueState = {
    topic,
    messages: [],
    activePersonas: personaIds,
    startTime: Date.now(),
  }

  // Load persona contracts and data
  const contracts = new Map<PersonaId, PersonaContract>()
  const personas = new Map<PersonaId, Persona>()
  const personaNames = new Map<PersonaId, string>()

  for (const id of personaIds) {
    const contract = await loadContract(id)
    const persona = await getPersona(id)
    if (persona) {
      contracts.set(id, contract)
      personas.set(id, persona)
      personaNames.set(id, persona.name)
    }
  }

  // ─── Topic Decomposition ────────────────────────────────────

  const aspects = await decomposeTopicIntoAspects(topic, 3)

  yield { type: 'dialogue_start', topic, personas: personaIds }
  yield { type: 'debate_start', topic, aspects, personas: personaIds }

  // Initialize debate context
  const debateContext: DebateContext = {
    originalTopic: topic,
    aspects,
    rounds: [],
    contestedClaims: [],
    cruxCards: [],
  }

  // ─── Opening Round ──────────────────────────────────────────

  const openingMessages = await Promise.all(
    personaIds.map(async (personaId) => {
      const contract = contracts.get(personaId)!
      const persona = personas.get(personaId)!
      const content = await generateOpeningMicroTurn(contract, persona, topic)
      if (!content) return null
      return {
        id: generateMessageId(personaId, state.messages.length),
        personaId,
        content,
        timestamp: Date.now(),
      } as DialogueMessage
    })
  )

  for (const msg of openingMessages) {
    if (msg) {
      state.messages.push(msg)
      yield { type: 'message_posted', message: msg, phase: 'opening' }
    }
  }

  // ─── Aspect Rounds ─────────────────────────────────────────

  const registry = new CandidateRegistry()
  const activeRoomPairs = new Set<string>()

  for (let roundIdx = 0; roundIdx < aspects.length; roundIdx++) {
    const aspect = aspects[roundIdx]

    yield { type: 'round_start', aspect, roundNumber: roundIdx + 1 }

    const roundMessages: DialogueMessage[] = []
    const clashMessages: DialogueMessage[] = []

    // ── Parallel Takes ──────────────────────────────────────

    const contextText = buildTurnContext(debateContext, [], personaNames)

    const takes = await Promise.all(
      personaIds.map(async (personaId) => {
        const contract = contracts.get(personaId)!
        const persona = personas.get(personaId)!
        const content = await generateTake(contract, persona, aspect, contextText)
        if (!content) return null
        return {
          id: generateMessageId(personaId, state.messages.length + roundMessages.length),
          personaId,
          content,
          timestamp: Date.now(),
        } as DialogueMessage
      })
    )

    for (const msg of takes) {
      if (msg) {
        state.messages.push(msg)
        roundMessages.push(msg)
        yield { type: 'message_posted', message: msg, phase: 'take' }
      }
    }

    // ── Disagreement Detection on Takes ─────────────────────

    const detected = await detectDisagreements(roundMessages, personaNames)

    if (detected) {
      yield {
        type: 'disagreement_detected',
        candidate: {
          messages: roundMessages.map(m => m.id),
          personas: detected.personas,
          topic: detected.topic,
          confidence: 1,  // Boolean decomposition replaces confidence float
        },
      }

      // ── Sequential Clash (2-4 rebuttals) ────────────────

      yield { type: 'clash_start', personas: detected.personas, aspect: aspect.label }

      const clashPair = detected.personas.slice(0, 2)
      const maxClashTurns = 4

      for (let clashTurn = 0; clashTurn < maxClashTurns; clashTurn++) {
        const speakerId = clashPair[clashTurn % 2]
        const targetId = clashPair[(clashTurn + 1) % 2]

        const speakerContract = contracts.get(speakerId)!
        const speakerPersona = personas.get(speakerId)!
        const targetName = personaNames.get(targetId) ?? targetId

        // Find latest message from opponent
        const targetMessage = [...roundMessages, ...clashMessages]
          .reverse()
          .find(m => m.personaId === targetId)

        if (!targetMessage) break

        const clashContext = buildTurnContext(debateContext, [...roundMessages, ...clashMessages], personaNames)
        const content = await generateRebuttal(
          speakerContract,
          speakerPersona,
          targetMessage,
          targetName,
          clashContext,
        )

        if (!content) break

        const msg: DialogueMessage = {
          id: generateMessageId(speakerId, state.messages.length),
          personaId: speakerId,
          content,
          replyTo: targetMessage.id,
          timestamp: Date.now(),
        }

        state.messages.push(msg)
        roundMessages.push(msg)
        clashMessages.push(msg)
        yield { type: 'message_posted', message: msg, phase: 'clash' }
      }

      // ── Check if Clash Resolved or Spawn Crux Room ──────

      const readyCandidate = registry.update(
        detected.personas,
        detected.topic,
        detected.shortLabel,
        activeRoomPairs,
      )

      if (readyCandidate) {
        const roomId = `crux-${Date.now()}-${readyCandidate.personas.join('-')}`
        const pairKey = [...readyCandidate.personas].sort().join('|')
        activeRoomPairs.add(pairKey)
        registry.recordSpawn(readyCandidate.personas)

        // Add contested claim
        debateContext.contestedClaims.push({
          claim: readyCandidate.topic,
          personas: [readyCandidate.personas[0], readyCandidate.personas[1]],
          status: 'unresolved',
          source: 'detection',
        })

        yield {
          type: 'crux_room_spawning',
          roomId,
          question: readyCandidate.topic,
          label: readyCandidate.shortLabel,
          personas: readyCandidate.personas,
        }

        for await (const cruxEvent of runCruxRoom(
          roomId,
          readyCandidate.topic,
          readyCandidate.personas,
          clashMessages.map(m => m.id),
          personaNames,
          topic,  // Pass original debate topic for wider context
        )) {
          if (cruxEvent.type === 'crux_message') {
            yield { type: 'crux_message', roomId: cruxEvent.roomId, message: cruxEvent.message }
          } else if (cruxEvent.type === 'crux_card_generated') {
            debateContext.cruxCards.push(cruxEvent.card)
            yield { type: 'crux_card_posted', card: cruxEvent.card }
          }
        }

        activeRoomPairs.delete(pairKey)
      }
    }

    // ── Round Summary ───────────────────────────────────────

    const summary = await summarizeRound(aspect.label, roundMessages, personaNames)
    debateContext.rounds.push({
      aspect,
      summary,
      takes: takes.filter(Boolean) as DialogueMessage[],
      clashMessages,
    })

    yield { type: 'round_end', aspect }
  }

  // ─── Closing Round ──────────────────────────────────────────

  const closingContext = buildTurnContext(debateContext, [], personaNames)

  const closingMessages = await Promise.all(
    personaIds.map(async (personaId) => {
      const contract = contracts.get(personaId)!
      const persona = personas.get(personaId)!
      const content = await generateClosing(contract, persona, topic, closingContext)
      if (!content) return null
      return {
        id: generateMessageId(personaId, state.messages.length),
        personaId,
        content,
        timestamp: Date.now(),
      } as DialogueMessage
    })
  )

  for (const msg of closingMessages) {
    if (msg) {
      state.messages.push(msg)
      yield { type: 'message_posted', message: msg, phase: 'closing' }
    }
  }

  // ─── Shift Detection ────────────────────────────────────────

  const shifts = await detectShifts(
    personaIds,
    openingMessages.filter(Boolean) as DialogueMessage[],
    closingMessages.filter(Boolean) as DialogueMessage[],
    personaNames,
  )

  yield { type: 'dialogue_complete', finalState: state, shifts }
}

// ─── Helpers ──────────────────────────────────────────────────

function generateMessageId(personaId: string, index: number): string {
  return `msg-${Date.now()}-${personaId}-${index}`
}

async function detectShifts(
  personaIds: PersonaId[],
  openings: DialogueMessage[],
  closings: DialogueMessage[],
  personaNames: Map<string, string>,
): Promise<PositionShift[]> {
  const pairs: string[] = []
  for (const id of personaIds) {
    const opening = openings.find(m => m.personaId === id)
    const closing = closings.find(m => m.personaId === id)
    if (opening && closing) {
      const name = personaNames.get(id) ?? id
      pairs.push(`${name}:\n  Opening: "${opening.content}"\n  Closing: "${closing.content}"`)
    }
  }

  if (pairs.length === 0) return []

  try {
    const result = await completeJSON<{ shifts: Array<{ name: string; shifted: boolean; summary: string }> }>({
      system: 'You detect position shifts in debate participants by comparing their opening and closing statements.',
      messages: [{
        role: 'user',
        content: `Compare each participant's opening and closing statements. Did they shift their position?

${pairs.join('\n\n')}

Output JSON:
{
  "shifts": [
    { "name": "participant name", "shifted": true/false, "summary": "1 sentence describing shift or lack thereof" }
  ]
}`,
      }],
      model: 'haiku',
      maxTokens: 300,
      temperature: 0.2,
    })

    return result.shifts.map(s => {
      // Map name back to ID
      let personaId = s.name
      for (const [id, name] of personaNames.entries()) {
        if (name === s.name) { personaId = id; break }
      }
      return { personaId, shifted: s.shifted, summary: s.summary }
    })
  } catch (error) {
    console.error('[shifts] Error detecting shifts:', error)
    return []
  }
}
