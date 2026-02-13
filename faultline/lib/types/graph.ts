import type { PersonaId } from './index'

// ─── Core Graph Nodes ───────────────────────────────────────

export interface Argument {
  id: string
  speakerId: PersonaId
  claim: string
  premises: string[]
  assumptions: string[]
  evidence: string[]
  round: number
}

export type AttackType = 'rebut' | 'undermine' | 'undercut'

export interface AttackTarget {
  argId: string
  component: 'claim' | 'premise' | 'assumption'
  index: number
}

export interface Attack {
  id: string
  fromArgId: string
  toArgId: string
  type: AttackType
  target: AttackTarget
  counterProposition: string
  rationale: string
  evidence: string[]
  confidence: number
  speakerId: PersonaId
  round: number
}

// ─── Validation ─────────────────────────────────────────────

export interface ValidationResult {
  attackId: string
  valid: boolean
  attackStrength: number // 0.0–1.0
  corrections: string | null
}

// ─── Dung Framework ─────────────────────────────────────────

export interface DungFramework {
  arguments: Set<string>
  attacks: Map<string, Set<string>>       // argId → set of targets it attacks
  attackedBy: Map<string, Set<string>>    // argId → set of args that attack it
}

export type Label = 'IN' | 'OUT' | 'UNDEC'

export interface Labelling {
  labels: Map<string, Label>
}

// ─── Graph State ────────────────────────────────────────────

export interface ArgumentationGraphState {
  topic: string
  arguments: Argument[]
  attacks: Attack[]
  validationResults: ValidationResult[]
  groundedExtension: Set<string>
  preferredExtensions: Set<string>[]
  labelling: Labelling
  round: number
}

// ─── Crux Output ────────────────────────────────────────────

export interface CruxAssumption {
  assumption: string
  dependentArgIds: string[]
  centrality: number
  settlingQuestion: string
}

export interface GraphCamp {
  extensionIndex: number
  argumentIds: string[]
  speakerIds: PersonaId[]
}

export interface GraphDebateOutput {
  commonGround: Argument[]
  camps: GraphCamp[]
  cruxAssumptions: CruxAssumption[]
  symmetricDifference: Argument[]
}
