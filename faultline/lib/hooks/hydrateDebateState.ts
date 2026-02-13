import type {
  SSEEvent,
  Claim,
  ConvergenceState,
  Crux,
  FlipCondition,
  DebateOutput,
  AgentMessage,
  InitialStanceEntry,
} from '@/lib/types'
import type { Argument, Attack, ValidationResult, Labelling } from '@/lib/types/graph'

export interface HydratedGraphState {
  arguments: Argument[]
  attacks: Attack[]
  validationResults: ValidationResult[]
  labelling: Labelling | null
  groundedSize: number
  preferredCount: number
  graphConverged: boolean
}

export interface HydratedDebateState {
  debateId: string | null
  claims: Claim[]
  messages: AgentMessage[]
  convergence: ConvergenceState | null
  cruxes: Crux[]
  flipConditions: FlipCondition[]
  output: DebateOutput | null
  error: string | null
  tables: Record<number, string[]>
  initialStances: InitialStanceEntry[]
  graph: HydratedGraphState | null
}

/**
 * Replay stored SSE events into the same state shape MatchClient renders.
 * Pure function — safe to call on the server.
 */
export function hydrateDebateState(events: SSEEvent[]): HydratedDebateState {
  const state: HydratedDebateState = {
    debateId: null,
    claims: [],
    messages: [],
    convergence: null,
    cruxes: [],
    flipConditions: [],
    output: null,
    error: null,
    tables: {},
    initialStances: [],
    graph: null,
  }

  for (const event of events) {
    switch (event.type) {
      case 'debate_start':
        state.debateId = event.debateId
        state.claims = event.claims
        break

      case 'table_assigned':
        state.tables[event.tableId] = event.personaIds
        break

      case 'initial_stance':
        state.initialStances.push({
          personaId: event.personaId,
          stances: event.stances,
          reasonings: event.reasonings,
        })
        break

      case 'agent_turn':
        state.messages.push({
          personaId: event.personaId,
          tableId: event.tableId,
          content: event.content,
          stance: event.stance,
          stances: event.stances,
          round: event.round,
          timestamp: 0,
        })
        break

      case 'convergence_update':
        state.convergence = event.metrics
        break

      case 'merge_complete':
        state.cruxes = event.mergedCruxes
        break

      case 'debate_complete':
        state.output = event.output
        state.cruxes = event.output.cruxes
        state.flipConditions = event.output.flipConditions
        break

      case 'arguments_submitted': {
        if (!state.graph) state.graph = { arguments: [], attacks: [], validationResults: [], labelling: null, groundedSize: 0, preferredCount: 0, graphConverged: false }
        state.graph.arguments.push(...event.arguments)
        break
      }

      case 'attacks_generated': {
        if (!state.graph) state.graph = { arguments: [], attacks: [], validationResults: [], labelling: null, groundedSize: 0, preferredCount: 0, graphConverged: false }
        state.graph.attacks.push(...event.attacks)
        break
      }

      case 'validation_complete': {
        if (!state.graph) state.graph = { arguments: [], attacks: [], validationResults: [], labelling: null, groundedSize: 0, preferredCount: 0, graphConverged: false }
        state.graph.validationResults.push(...event.results)
        break
      }

      case 'graph_update': {
        if (!state.graph) state.graph = { arguments: [], attacks: [], validationResults: [], labelling: null, groundedSize: 0, preferredCount: 0, graphConverged: false }
        state.graph.labelling = event.labelling
        state.graph.groundedSize = event.groundedSize
        state.graph.preferredCount = event.preferredCount
        break
      }

      case 'graph_convergence': {
        if (!state.graph) state.graph = { arguments: [], attacks: [], validationResults: [], labelling: null, groundedSize: 0, preferredCount: 0, graphConverged: false }
        state.graph.graphConverged = event.stable
        break
      }

      case 'error':
        state.error = event.message
        break
    }
  }

  return state
}
