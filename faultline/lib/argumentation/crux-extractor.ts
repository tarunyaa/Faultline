import type { PersonaId, DebateOutput } from '@/lib/types'
import type {
  ArgumentationGraphState,
  GraphDebateOutput,
  GraphCamp,
  CruxAssumption,
  Argument,
} from '@/lib/types/graph'

// ─── Extract Graph Output ───────────────────────────────────

export function extractGraphOutput(state: ArgumentationGraphState): GraphDebateOutput {
  const argById = new Map(state.arguments.map(a => [a.id, a]))

  // 1. Common ground = arguments in grounded extension
  const commonGround: Argument[] = []
  for (const argId of state.groundedExtension) {
    const arg = argById.get(argId)
    if (arg) commonGround.push(arg)
  }

  // 2. Camps = arguments in each preferred extension
  const camps: GraphCamp[] = state.preferredExtensions.map((ext, idx) => {
    const argIds = [...ext]
    const speakerIds = new Set<PersonaId>()
    for (const id of argIds) {
      const arg = argById.get(id)
      if (arg) speakerIds.add(arg.speakerId)
    }
    return {
      extensionIndex: idx,
      argumentIds: argIds,
      speakerIds: [...speakerIds],
    }
  })

  // 3. Symmetric difference of top 2 preferred extensions
  const symmetricDifference: Argument[] = []
  if (state.preferredExtensions.length >= 2) {
    const ext0 = state.preferredExtensions[0]
    const ext1 = state.preferredExtensions[1]

    for (const id of ext0) {
      if (!ext1.has(id)) {
        const arg = argById.get(id)
        if (arg) symmetricDifference.push(arg)
      }
    }
    for (const id of ext1) {
      if (!ext0.has(id)) {
        const arg = argById.get(id)
        if (arg) symmetricDifference.push(arg)
      }
    }
  }

  // 4. Extract crux assumptions from disputed arguments
  const disputedArgIds = new Set(symmetricDifference.map(a => a.id))
  const assumptionMap = new Map<string, string[]>() // assumption text → dependent arg IDs

  for (const arg of symmetricDifference) {
    for (const assumption of arg.assumptions) {
      const normalized = assumption.toLowerCase().trim()
      if (!assumptionMap.has(normalized)) {
        assumptionMap.set(normalized, [])
      }
      assumptionMap.get(normalized)!.push(arg.id)
    }
  }

  // Also check non-disputed args that share assumptions with disputed ones
  for (const arg of state.arguments) {
    if (disputedArgIds.has(arg.id)) continue
    for (const assumption of arg.assumptions) {
      const normalized = assumption.toLowerCase().trim()
      if (assumptionMap.has(normalized)) {
        assumptionMap.get(normalized)!.push(arg.id)
      }
    }
  }

  // 5. Rank assumptions by dependent arg count and attack degree centrality
  const attackDegree = new Map<string, number>()
  for (const atk of state.attacks) {
    const valid = state.validationResults.find(v => v.attackId === atk.id)
    if (!valid?.valid) continue
    attackDegree.set(atk.fromArgId, (attackDegree.get(atk.fromArgId) ?? 0) + 1)
    attackDegree.set(atk.toArgId, (attackDegree.get(atk.toArgId) ?? 0) + 1)
  }

  const rankedAssumptions: CruxAssumption[] = [...assumptionMap.entries()]
    .map(([assumption, depIds]) => {
      const uniqueDepIds = [...new Set(depIds)]
      const centrality = uniqueDepIds.reduce(
        (sum, id) => sum + (attackDegree.get(id) ?? 0),
        0
      )
      return {
        assumption,
        dependentArgIds: uniqueDepIds,
        centrality,
        settlingQuestion: generateSettlingQuestion(assumption),
      }
    })
    .sort((a, b) => {
      // Sort by dependent count first, then centrality
      const countDiff = b.dependentArgIds.length - a.dependentArgIds.length
      if (countDiff !== 0) return countDiff
      return b.centrality - a.centrality
    })
    .slice(0, 3)

  return {
    commonGround,
    camps,
    cruxAssumptions: rankedAssumptions,
    symmetricDifference,
  }
}

// ─── Map to DebateOutput ────────────────────────────────────

/**
 * Convert graph-based output to the existing DebateOutput format
 * for backward compatibility with the frontend.
 */
export function mapToDebateOutput(
  graphOutput: GraphDebateOutput,
  state: ArgumentationGraphState,
  personaIds: PersonaId[],
): DebateOutput {
  const argById = new Map(state.arguments.map(a => [a.id, a]))

  // Cruxes from crux assumptions
  const cruxes = graphOutput.cruxAssumptions.map((ca, i) => ({
    id: `crux-${i + 1}`,
    proposition: ca.assumption,
    weight: Math.min(1, ca.centrality / 10),
    surfacedByTables: [0],
    resolved: false,
  }))

  // Fault lines from camps
  const faultLines = graphOutput.camps.length >= 2
    ? graphOutput.camps.slice(0, 2).map((camp, i) => {
        const campArgs = camp.argumentIds
          .map(id => argById.get(id))
          .filter(Boolean) as Argument[]
        const topClaim = campArgs[0]?.claim ?? 'Unknown position'
        return {
          category: 'assumptions' as const,
          description: `Camp ${i + 1} (${camp.speakerIds.join(', ')}): ${topClaim}`,
          relatedCruxIds: cruxes.map(c => c.id),
        }
      })
    : []

  // Flip conditions from defeated arguments
  const flipConditions = state.arguments
    .filter(arg => state.labelling.labels.get(arg.id) === 'OUT')
    .slice(0, 4)
    .map(arg => {
      // Find the attack that defeated this argument
      const defeatingAttack = state.attacks.find(
        atk => atk.toArgId === arg.id &&
          state.validationResults.some(v => v.attackId === atk.id && v.valid)
      )
      return {
        personaId: arg.speakerId,
        condition: defeatingAttack
          ? `If "${defeatingAttack.counterProposition}" were disproven`
          : `If "${arg.claim}" were re-established`,
        claimId: '',
        triggered: false,
      }
    })

  // Evidence ledger from argument evidence fields
  const evidenceLedger = personaIds.map(pid => {
    const ownArgs = state.arguments.filter(a => a.speakerId === pid)
    const accepted = ownArgs
      .filter(a => state.labelling.labels.get(a.id) !== 'OUT')
      .flatMap(a => a.evidence)
    const rejected = ownArgs
      .filter(a => state.labelling.labels.get(a.id) === 'OUT')
      .flatMap(a => a.evidence.map(e => ({
        evidence: e,
        reason: 'Argument defeated in graph',
      })))
    return { personaId: pid, accepted, rejected }
  }).filter(e => e.accepted.length > 0 || e.rejected.length > 0)

  // Resolution paths from settling questions
  const resolutionPaths = graphOutput.cruxAssumptions
    .filter(ca => ca.settlingQuestion)
    .map(ca => ({
      description: ca.settlingQuestion,
      relatedCruxIds: cruxes
        .filter(c => c.proposition === ca.assumption)
        .map(c => c.id),
    }))

  return {
    cruxes,
    faultLines,
    flipConditions,
    evidenceLedger,
    resolutionPaths,
  }
}

// ─── Helpers ────────────────────────────────────────────────

function generateSettlingQuestion(assumption: string): string {
  // Generate a question that could settle whether this assumption holds
  const cleaned = assumption.replace(/^that\s+/i, '').replace(/\.$/, '')
  return `What evidence would confirm or refute that ${cleaned}?`
}
