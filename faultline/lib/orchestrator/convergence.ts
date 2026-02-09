import type { BlackboardState, ConvergenceState, AgentStance, Claim } from '@/lib/types'

// ─── Configuration ───────────────────────────────────────────

const CONVERGENCE_CONFIDENCE_THRESHOLD = 0.8 // ≥80% mass on one side
const DIVERGENCE_ENTROPY_THRESHOLD = 0.95    // near-max entropy
const DIVERGENCE_STABLE_ROUNDS = 2           // entropy high for N rounds
const MAX_EVENTS = 15                        // safety cap (rounds × agents)

// ─── State Tracking ──────────────────────────────────────────

interface ConvergenceTracker {
  entropyHistory: number[]
  lastNewCruxRound: number
}

export function createConvergenceTracker(): ConvergenceTracker {
  return {
    entropyHistory: [],
    lastNewCruxRound: 0,
  }
}

// ─── Compute Convergence ─────────────────────────────────────

export function computeConvergence(
  board: BlackboardState,
  tracker: ConvergenceTracker,
  eventCount: number,
  currentRound: number,
): ConvergenceState {
  const claims = board.claims
  const stances = board.stances

  // Compute per-claim entropy and aggregate
  let totalEntropy = 0
  let totalConfidenceDistance = 0

  for (const claim of claims) {
    totalEntropy += claimEntropy(claim, stances)
    totalConfidenceDistance += claimConfidenceDistance(claim, stances)
  }

  const avgEntropy = claims.length > 0 ? totalEntropy / claims.length : 0
  const avgDistance = claims.length > 0 ? totalConfidenceDistance / claims.length : 0

  // Track entropy history
  tracker.entropyHistory.push(avgEntropy)

  // Track crux generation
  if (board.cruxCandidates.length > 0) {
    const newestCruxId = board.cruxCandidates[board.cruxCandidates.length - 1].id
    const cruxNum = parseInt(newestCruxId.split('-')[1] ?? '0')
    // Check if new cruxes appeared this round (approximate)
    if (cruxNum >= board.cruxCandidates.length - 1) {
      tracker.lastNewCruxRound = currentRound
    }
  }

  const unresolvedCruxCount = board.cruxCandidates.filter(c => !c.resolved).length

  // Check convergence: ≥80% confidence mass on one side per claim AND no unresolved cruxes
  const converged = checkConverged(claims, stances, unresolvedCruxCount)

  // Check divergence: high entropy for N rounds AND no new cruxes for M rounds
  const diverged = checkDiverged(tracker, currentRound)

  return {
    entropy: avgEntropy,
    confidenceWeightedDistance: avgDistance,
    unresolvedCruxCount,
    converged: converged || eventCount >= MAX_EVENTS,
    diverged,
    eventCount,
    maxEvents: MAX_EVENTS,
  }
}

// ─── Per-Claim Entropy ───────────────────────────────────────

/**
 * Shannon entropy over stance distribution for a claim.
 * Uses latest stance per agent. Output range: [0, log(3)] ≈ [0, 1.099]
 * Normalized to [0, 1].
 */
function claimEntropy(claim: Claim, stances: AgentStance[]): number {
  const latest = getLatestStancesForClaim(claim.id, stances)
  if (latest.length === 0) return 1 // maximum uncertainty if no stances

  const counts = { pro: 0, con: 0, uncertain: 0 }
  for (const s of latest) {
    counts[s.stance] += s.confidence
  }

  const total = counts.pro + counts.con + counts.uncertain
  if (total === 0) return 1

  const maxEntropy = Math.log(3) // log(3 possible stances)
  let entropy = 0

  for (const stance of ['pro', 'con', 'uncertain'] as const) {
    const p = counts[stance] / total
    if (p > 0) {
      entropy -= p * Math.log(p)
    }
  }

  return entropy / maxEntropy // normalize to [0, 1]
}

// ─── Confidence Distance ─────────────────────────────────────

/**
 * Average pairwise confidence-weighted distance between agents on a claim.
 * High distance = strong disagreement.
 */
function claimConfidenceDistance(claim: Claim, stances: AgentStance[]): number {
  const latest = getLatestStancesForClaim(claim.id, stances)
  if (latest.length < 2) return 0

  // Convert stance to numeric: pro=1, uncertain=0.5, con=0
  function stanceValue(s: AgentStance): number {
    const base = s.stance === 'pro' ? 1 : s.stance === 'con' ? 0 : 0.5
    // Weight by confidence
    return base * s.confidence
  }

  let totalDistance = 0
  let pairs = 0

  for (let i = 0; i < latest.length; i++) {
    for (let j = i + 1; j < latest.length; j++) {
      totalDistance += Math.abs(stanceValue(latest[i]) - stanceValue(latest[j]))
      pairs++
    }
  }

  return pairs > 0 ? totalDistance / pairs : 0
}

// ─── Stop Conditions ─────────────────────────────────────────

function checkConverged(
  claims: Claim[],
  stances: AgentStance[],
  unresolvedCruxCount: number,
): boolean {
  if (unresolvedCruxCount > 0) return false
  if (claims.length === 0) return false

  // Check each claim: ≥80% confidence mass must be on one side
  for (const claim of claims) {
    const latest = getLatestStancesForClaim(claim.id, stances)
    if (latest.length === 0) return false

    const mass = { pro: 0, con: 0, uncertain: 0 }
    let total = 0
    for (const s of latest) {
      mass[s.stance] += s.confidence
      total += s.confidence
    }

    if (total === 0) return false

    const maxMass = Math.max(mass.pro, mass.con) / total
    if (maxMass < CONVERGENCE_CONFIDENCE_THRESHOLD) return false
  }

  return true
}

function checkDiverged(tracker: ConvergenceTracker, currentRound: number): boolean {
  const history = tracker.entropyHistory
  if (history.length < DIVERGENCE_STABLE_ROUNDS) return false

  // Check if entropy has been high for last N rounds
  const recent = history.slice(-DIVERGENCE_STABLE_ROUNDS)
  const allHigh = recent.every(e => e > DIVERGENCE_ENTROPY_THRESHOLD)

  // Check if no new cruxes for a while
  const noNewCruxes = currentRound - tracker.lastNewCruxRound >= DIVERGENCE_STABLE_ROUNDS

  return allHigh && noNewCruxes
}

// ─── Helpers ─────────────────────────────────────────────────

function getLatestStancesForClaim(
  claimId: string,
  stances: AgentStance[],
): AgentStance[] {
  const latest = new Map<string, AgentStance>()
  for (const s of stances) {
    if (s.claimId !== claimId) continue
    const existing = latest.get(s.personaId)
    if (!existing || s.round > existing.round) {
      latest.set(s.personaId, s)
    }
  }
  return Array.from(latest.values())
}
