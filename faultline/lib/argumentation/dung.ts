import type {
  DungFramework,
  Labelling,
  Label,
  Attack,
  ValidationResult,
} from '@/lib/types/graph'

// ─── Build Framework ────────────────────────────────────────

/**
 * Build a Dung abstract argumentation framework from validated attacks.
 * Filters to only attacks that passed validation.
 */
export function buildFramework(
  argumentIds: string[],
  attacks: Attack[],
  validationResults: ValidationResult[],
): DungFramework {
  const validAttackIds = new Set(
    validationResults.filter(v => v.valid).map(v => v.attackId)
  )

  const fw: DungFramework = {
    arguments: new Set(argumentIds),
    attacks: new Map(),
    attackedBy: new Map(),
  }

  // Initialize adjacency maps
  for (const id of argumentIds) {
    fw.attacks.set(id, new Set())
    fw.attackedBy.set(id, new Set())
  }

  for (const atk of attacks) {
    if (!validAttackIds.has(atk.id)) continue
    if (!fw.arguments.has(atk.fromArgId) || !fw.arguments.has(atk.toArgId)) continue

    fw.attacks.get(atk.fromArgId)!.add(atk.toArgId)
    fw.attackedBy.get(atk.toArgId)!.add(atk.fromArgId)
  }

  return fw
}

// ─── Grounded Extension (Fixed-Point) ───────────────────────

/**
 * Compute the grounded extension via iterative fixed-point.
 * Start with unattacked arguments (IN), mark their targets OUT, repeat.
 */
export function computeGroundedExtension(fw: DungFramework): Set<string> {
  const labels = new Map<string, Label>()

  // All start as UNDEC
  for (const arg of fw.arguments) {
    labels.set(arg, 'UNDEC')
  }

  let changed = true
  while (changed) {
    changed = false

    for (const arg of fw.arguments) {
      if (labels.get(arg) !== 'UNDEC') continue

      const attackers = fw.attackedBy.get(arg) ?? new Set()

      // If all attackers are OUT, this arg is IN
      const allAttackersOut = attackers.size === 0 ||
        [...attackers].every(a => labels.get(a) === 'OUT')

      if (allAttackersOut) {
        labels.set(arg, 'IN')
        changed = true

        // Mark all targets of this arg as OUT
        const targets = fw.attacks.get(arg) ?? new Set()
        for (const t of targets) {
          if (labels.get(t) === 'UNDEC') {
            labels.set(t, 'OUT')
            changed = true
          }
        }
      }
    }
  }

  const grounded = new Set<string>()
  for (const [arg, label] of labels) {
    if (label === 'IN') grounded.add(arg)
  }
  return grounded
}

// ─── Labelling ──────────────────────────────────────────────

/**
 * Compute a complete labelling (IN/OUT/UNDEC) using the grounded semantics.
 */
export function computeLabelling(fw: DungFramework): Labelling {
  const labels = new Map<string, Label>()

  for (const arg of fw.arguments) {
    labels.set(arg, 'UNDEC')
  }

  let changed = true
  while (changed) {
    changed = false

    for (const arg of fw.arguments) {
      if (labels.get(arg) !== 'UNDEC') continue

      const attackers = fw.attackedBy.get(arg) ?? new Set()

      const allAttackersOut = attackers.size === 0 ||
        [...attackers].every(a => labels.get(a) === 'OUT')

      if (allAttackersOut) {
        labels.set(arg, 'IN')
        changed = true

        const targets = fw.attacks.get(arg) ?? new Set()
        for (const t of targets) {
          if (labels.get(t) === 'UNDEC') {
            labels.set(t, 'OUT')
            changed = true
          }
        }
      }
    }
  }

  return { labels }
}

// ─── Preferred Extensions ───────────────────────────────────

/**
 * Compute preferred extensions (maximal admissible sets).
 * Optimized: start from grounded extension, backtrack over UNDEC args only.
 */
export function computePreferredExtensions(fw: DungFramework): Set<string>[] {
  const labelling = computeLabelling(fw)
  const grounded = new Set<string>()
  const undecArgs: string[] = []

  for (const [arg, label] of labelling.labels) {
    if (label === 'IN') grounded.add(arg)
    if (label === 'UNDEC') undecArgs.push(arg)
  }

  // If no UNDEC args, grounded = only preferred extension
  if (undecArgs.length === 0) {
    return [grounded]
  }

  // Find all maximal admissible supersets of grounded within UNDEC args
  const preferred: Set<string>[] = []

  function isAdmissible(ext: Set<string>): boolean {
    // Conflict-free: no arg in ext attacks another arg in ext
    for (const a of ext) {
      const targets = fw.attacks.get(a) ?? new Set()
      for (const t of targets) {
        if (ext.has(t)) return false
      }
    }
    // Every arg in ext is defended by ext
    for (const a of ext) {
      const attackers = fw.attackedBy.get(a) ?? new Set()
      for (const attacker of attackers) {
        if (ext.has(attacker)) return false // conflict-free already checked
        // Check if some arg in ext attacks this attacker
        const defenderFound = [...ext].some(d => {
          const dTargets = fw.attacks.get(d) ?? new Set()
          return dTargets.has(attacker)
        })
        if (!defenderFound) return false
      }
    }
    return true
  }

  // Enumerate subsets of UNDEC args (with pruning)
  // Cap at 2^16 to prevent explosion — UNDEC count should be small in practice
  const maxSubsets = Math.min(1 << undecArgs.length, 65536)

  const admissibleSets: Set<string>[] = []

  for (let mask = 0; mask < maxSubsets; mask++) {
    const candidate = new Set(grounded)
    for (let i = 0; i < undecArgs.length; i++) {
      if (mask & (1 << i)) {
        candidate.add(undecArgs[i])
      }
    }
    if (isAdmissible(candidate)) {
      admissibleSets.push(candidate)
    }
  }

  // Keep only maximal sets
  for (const s of admissibleSets) {
    const isSubset = admissibleSets.some(other => {
      if (other === s) return false
      if (other.size <= s.size) return false
      for (const a of s) {
        if (!other.has(a)) return false
      }
      return true
    })
    if (!isSubset) {
      preferred.push(s)
    }
  }

  return preferred.length > 0 ? preferred : [grounded]
}
