# Multi-Agent Debate Architecture
## Async, Event-Driven, Crux-Seeking System

**Design Goal**: 3-12 agents engage in parallel, short-form dialogues to rapidly surface true cruxes of disagreement.

**Status**: ⚠️ **DEPRECATED** - See `2_14_plan.md` for current plan (Feb 14, 2025)

---

## Core Principles

1. **Event-driven, not turn-based**: Agents react asynchronously to messages, no forced round-robin
2. **Parallel conversations**: Multiple threads run simultaneously on different sub-topics
3. **Attention-based**: Agents choose what to respond to based on relevance, not assignment
4. **Hierarchical crystallization**: Thread-level → cross-thread → global crux synthesis
5. **Coalition-aware**: System detects when agents align/diverge on specific issues
6. **Self-correcting**: Agents and system can challenge/refine crystallized claims

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    MESSAGE BUS                          │
│  All messages published here, tagged with threads/topics│
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┼────────┬────────┬────────┐
        ▼        ▼        ▼        ▼        ▼
    ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
    │ A₁  │  │ A₂  │  │ A₃  │  │ A₄  │  │ A₅  │  ... (N agents)
    └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘
       │        │        │        │        │
       └────────┴────────┴────────┴────────┘
                 │
    ┌────────────▼─────────────────────────────┐
    │      ATTENTION SCORER                    │
    │  Which messages are relevant to me?      │
    │  - Semantic similarity (embeddings)      │
    │  - Direct @mentions                      │
    │  - Thread participation                  │
    └────────────┬─────────────────────────────┘
                 │
    ┌────────────▼─────────────────────────────┐
    │      THREAD MANAGER                      │
    │  - Track conversation threads            │
    │  - Detect thread convergence             │
    │  - Spawn new threads on divergence       │
    └────────────┬─────────────────────────────┘
                 │
    ┌────────────▼─────────────────────────────┐
    │      AGENDA MANAGER                      │
    │  - Track 1-2 active disputes             │
    │  - Boost attention to hot disputes       │
    │  - Request agent commitments             │
    └────────────┬─────────────────────────────┘
                 │
    ┌────────────▼─────────────────────────────┐
    │      CRYSTALLIZER (Hierarchical)         │
    │  Level 1: Per-thread crux extraction     │
    │  Level 2: Cross-thread pattern matching  │
    │  Level 3: Global crux graph              │
    └────────────┬─────────────────────────────┘
                 │
    ┌────────────▼─────────────────────────────┐
    │      CRUX SYNTHESIS ENGINE               │
    │  - Binary dispute identification         │
    │  - Coalition mapping (who's on what side)│
    │  - Common ground vs irreducible cruxes   │
    └──────────────────────────────────────────┘
```

---

## Data Model

### 0. Core Enums

```typescript
// Expanded move set with crux-forcing mechanics
type DialogueMove =
  // Discovery phase
  | 'CLAIM'              // Assert a new position
  | 'CHALLENGE'          // Dispute what was said
  | 'CLARIFY'            // Ask for or provide precision
  | 'REFRAME'            // Redirect to what matters
  | 'PROPOSE_CRUX'       // Name core disagreement

  // Crux lock phase (understanding + commitment)
  | 'STEELMAN'           // Represent opponent's position
  | 'GRADE_STEELMAN'     // Opponent grades steelman attempt
  | 'COMMIT_POSITION'    // Commit to YES/NO/UNCERTAIN with confidence
  | 'DECLARE_FALSIFIER'  // State what would change mind

  // Evidence phase
  | 'PROVIDE_EVIDENCE'   // Present data tied to falsifier/criteria
  | 'CHALLENGE_EVIDENCE' // Attack measurement/causal link
  | 'UPDATE_POSITION'    // Change stance based on evidence
  | 'CONCEDE'            // Grant a point (must be specific)

// Investment horizon (explicit per agent per crux)
type Horizon = '1-3mo' | '12-18mo' | '5y' | '10y+'

// Steelman grading
type SteelmanGrade = 'PENDING' | 'ACCURATE' | 'INCOMPLETE' | 'WRONG'
```

### 1. Message
```typescript
interface Message {
  id: MessageId                     // "msg-{timestamp}-{agentId}"
  agentId: PersonaId                // Who said it
  content: string                   // 1-2 sentences (natural dialogue)
  move: DialogueMove
  threadId: ThreadId
  topics: string[]
  replyTo?: MessageId
  refs?: MessageId[]
  timestamp: number

  // Semantic indexing
  embedding?: number[]

  // Structured metadata (keeps dialogue short)
  meta?: {
    // Horizon + confidence (always present)
    horizon?: Horizon               // Required for commits
    confidence?: number             // 0-1

    // Targeting
    targets?: CruxId[]              // Which crux(es) this addresses

    // Move-specific data
    falsifier?: Falsifier           // If DECLARE_FALSIFIER
    steelmanTarget?: PersonaId      // If STEELMAN
    steelmanGrade?: SteelmanGrade   // If GRADE_STEELMAN
    evidenceLink?: string           // URL or reference

    // Position change
    priorPosition?: 'YES' | 'NO' | 'UNCERTAIN'  // If UPDATE_POSITION
    newPosition?: 'YES' | 'NO' | 'UNCERTAIN'
  }

  // Reply control (prevents cascades)
  replyCount: number
}
```

### 2. Thread (with Stage Enforcement)
```typescript
type ThreadStage = 'DISCOVERY' | 'CRUX_LOCK' | 'EVIDENCE'

interface Thread {
  id: ThreadId
  topic: string
  binaryQuestion?: string           // Required to exit DISCOVERY

  // Stage control (enforced gate between stages)
  stage: ThreadStage
  messageBudgetByStage: {
    DISCOVERY: number               // 6-10 messages to find candidate crux
    CRUX_LOCK: number               // 6-8 messages to commit + steelman
    EVIDENCE: number                // 12-16 messages for evidence debate
  }
  messagesInCurrentStage: number    // Reset on stage transition

  // Participation
  participants: Set<PersonaId>
  messages: Message[]

  // Steelman requirements (must pass before advancing)
  steelmanRequirements: Map<PersonaId, {
    mustSteelman: PersonaId[]       // Who this agent must steelman
    grades: Map<PersonaId, SteelmanGrade>  // Grades received
  }>

  // Crux lock state
  lockedCrux?: LockedCrux           // Different from ThreadCrux (see below)
  lockAttempts: number              // Track failed lock attempts

  // State
  status: ThreadStatus
  convergenceSignal?: number

  // Crystallized output (after evidence phase)
  finalCrux?: ThreadCrux
  focusDisputeId?: CruxId

  // Controls (prevent explosion)
  budget: {
    maxMessages: number             // Global cap (30-40)
    maxDurationMs: number
  }

  // Metadata
  createdAt: number
  lastActivityAt: number
  parentThreadId?: ThreadId
  messageRate: number
}

type ThreadStatus =
  | 'DISCOVERY'       // Finding candidate crux
  | 'LOCKING'         // Attempting crux lock
  | 'LOCKED'          // Crux locked, in evidence phase
  | 'CONVERGED'       // Final crux extracted
  | 'FAILED_LOCK'     // Couldn't lock, needs moderator intervention
  | 'STALE'
  | 'MERGED'
```

### 3. Crux Types

```typescript
// Structured falsifier (concrete, testable)
interface Falsifier {
  metric: string                    // "Spot BTC ETF AUM"
  threshold: string                 // ">= $100B" or "5-year correlation <0.3"
  deadline: string                  // "2027-12-31" or "next market crash"
  reasoning?: string                // Why this would change your mind (1 sentence)
}

// Agent's top-level claim (the "what we're really debating")
interface TopClaim {
  statement: string                 // 1 sentence, forced binary if possible
  side: 'YES' | 'NO' | 'NUANCED'    // Position on debate topic
  confidence: number                // 0-1
  lastUpdated: number               // Timestamp
}

// Crux during lock phase (before final crystallization)
interface LockedCrux {
  threadId: ThreadId
  question: string                  // Binary question

  // Commitments (agents must explicitly commit)
  commitments: Map<PersonaId, {
    side: 'YES' | 'NO' | 'UNCERTAIN'
    statement: string
    confidence: number
    horizon: Horizon
    falsifier: Falsifier
  }>

  // Steelman state (must pass before lock completes)
  steelmanPairs: Array<{
    from: PersonaId
    to: PersonaId                   // Steelmanning this agent's position
    attempt: string                 // The steelman statement
    grade: SteelmanGrade            // To agent's grade
  }>

  // Lock completion criteria
  lockCriteria: {
    minCommitments: number          // ≥2 agents committed
    bothSidesPresent: boolean       // YES and NO (not just UNCERTAIN)
    allSteelmansPassed: boolean     // All required steelmans graded ACCURATE
    allFalsifiersProvided: boolean  // Each committed agent has falsifier
  }

  lockedAt?: number                 // Timestamp when lock completed
}

// Final crystallized crux (after evidence phase)
interface ThreadCrux {
  threadId: ThreadId
  question: string

  // Positions (may differ from initial commitments after evidence)
  positions: Map<PersonaId, CruxPosition>

  // Evidence
  supportingMessages: MessageId[]
  evidenceProvided: Array<{
    agentId: PersonaId
    evidence: string
    targetFalsifier?: Falsifier
    timestamp: number
  }>

  // ROBUSTNESS: Required for validation
  resolutionCriteria: string[]      // Min 2, derived from falsifiers
  counterfactual: Map<PersonaId, {
    wouldFlip: boolean              // Would top-level claim flip?
    why: string
  }>
  alternativesConsidered?: string[]

  // DCG metrics (Disagreement Compression Gain)
  dcg: {
    coverage: number                // 0-1, % of agents whose TopClaim depends on this
    polarity: number                // 0-1, how evenly split YES vs NO
    impact: number                  // 0-1, avg flip confidence
    score: number                   // coverage * polarity * impact
  }

  // Horizon tracking
  horizonByAgent: Map<PersonaId, Horizon>
  dominantHorizon: Horizon          // Most common horizon for this crux

  // Quality
  confidence: number
  validated: boolean
  validationFailures?: string[]
}

interface CruxPosition {
  side: 'YES' | 'NO' | 'UNCERTAIN'
  statement: string
  confidence: number
  falsifier?: Falsifier             // May be refined during evidence phase
  concessions: string[]             // Points conceded during debate
}
```

### 4. GlobalCruxGraph
```typescript
interface GlobalCruxGraph {
  // Cruxes from all threads
  cruxes: Map<CruxId, ThreadCrux>

  // Relationships between cruxes
  dependencies: CruxDependency[]    // "Crux A depends on Crux B"
  contradictions: CruxPair[]        // "Crux A and B are incompatible"

  // Coalitions
  coalitions: Coalition[]           // Groups of agents with aligned positions

  // Summary
  irreducibleCruxes: CruxId[]      // Core disagreements that can't be resolved
  commonGround: CruxId[]           // Cruxes where all agents aligned
}

interface Coalition {
  members: PersonaId[]
  positions: Map<CruxId, 'YES' | 'NO'>
  label?: string                    // Auto-generated: "Bitcoin maximalists", "Skeptics"
}
```

---

## Crux-Forcing Mechanics

### 1. Disagreement Compression Gain (DCG)

**Purpose**: Maximize disagreement explanation, not convergence to consensus.

**The Problem**: Agents naturally drift toward polite agreement. We need an objective function that rewards finding cruxes that *explain* disagreement with minimal axes.

**DCG Score** = Coverage × Polarity × Impact

```typescript
function calculateDCG(
  crux: LockedCrux,
  agents: Map<PersonaId, AgentState>
): { coverage: number; polarity: number; impact: number; score: number } {
  const commitments = Array.from(crux.commitments.entries())

  // Coverage: % of agents whose TopClaim depends on this crux
  const totalAgents = agents.size
  const relevantAgents = commitments.filter(([agentId, commit]) => {
    const agent = agents.get(agentId)
    // Check counterfactual: would TopClaim flip if crux flipped?
    return commit.falsifier && wouldFlipTopClaim(agent, crux.question, commit.side)
  })
  const coverage = relevantAgents.length / totalAgents

  // Polarity: how evenly split are YES vs NO?
  const yesCounts = commitments.filter(([_, c]) => c.side === 'YES').length
  const noCounts = commitments.filter(([_, c]) => c.side === 'NO').length
  const total = yesCounts + noCounts
  const polarity = total > 0 ? (2 * Math.min(yesCounts, noCounts)) / total : 0

  // Impact: average "flip confidence" among agents who said wouldFlip=true
  const flipConfidences = relevantAgents.map(([_, commit]) => commit.confidence)
  const impact = flipConfidences.length > 0
    ? flipConfidences.reduce((a, b) => a + b, 0) / flipConfidences.length
    : 0

  const score = coverage * polarity * impact

  return { coverage, polarity, impact, score }
}

function wouldFlipTopClaim(
  agent: AgentState,
  cruxQuestion: string,
  agentSideOnCrux: 'YES' | 'NO' | 'UNCERTAIN'
): boolean {
  // LLM call or heuristic:
  // "Agent's TopClaim: {agent.topClaim.statement}
  //  Crux question: {cruxQuestion}
  //  Agent's position on crux: {agentSideOnCrux}
  //  Would agent's TopClaim flip if crux flipped? YES/NO"

  // Implementation: use agent's declared falsifier + topClaim comparison
  // Return true if falsifier directly affects topClaim
  return true  // Placeholder
}
```

**Usage**: When selecting which candidate crux to promote to active dispute, always choose the one with max DCG score.

---

### 2. Thread Stage Enforcement

**Purpose**: Force threads through DISCOVERY → CRUX_LOCK → EVIDENCE pipeline.

**Stage Gates**:

```typescript
function canPublishInStage(
  message: Message,
  thread: Thread,
  agent: AgentState
): { allowed: boolean; reason?: string } {
  const stage = thread.stage

  // Move restrictions by stage
  const allowedMoves: Record<ThreadStage, Set<DialogueMove>> = {
    DISCOVERY: new Set([
      'CLAIM', 'CHALLENGE', 'CLARIFY', 'REFRAME', 'PROPOSE_CRUX'
    ]),
    CRUX_LOCK: new Set([
      'STEELMAN', 'GRADE_STEELMAN', 'COMMIT_POSITION', 'DECLARE_FALSIFIER', 'CLARIFY'
    ]),
    EVIDENCE: new Set([
      'PROVIDE_EVIDENCE', 'CHALLENGE_EVIDENCE', 'UPDATE_POSITION',
      'CONCEDE', 'PROPOSE_CRUX'  // Can propose deeper crux if DCG improves
    ])
  }

  if (!allowedMoves[stage].has(message.move)) {
    return {
      allowed: false,
      reason: `Move ${message.move} not allowed in ${stage} stage`
    }
  }

  // Special rule: Can't CHALLENGE until you've steelmanned opponent
  if (message.move === 'CHALLENGE' && stage === 'EVIDENCE') {
    const opponentId = getOpponentForMessage(message, thread)
    const steelmanGrade = agent.steelmanGrades.get(thread.id)?.get(opponentId)

    if (!steelmanGrade || steelmanGrade !== 'ACCURATE') {
      return {
        allowed: false,
        reason: `Must steelman ${opponentId} (and receive ACCURATE grade) before challenging`
      }
    }
  }

  // Stage-specific budget check
  const budget = thread.messageBudgetByStage[stage]
  if (thread.messagesInCurrentStage >= budget) {
    return {
      allowed: false,
      reason: `Stage budget exhausted (${budget} messages), attempting stage transition`
    }
  }

  return { allowed: true }
}
```

**Stage Transitions**:

```typescript
function attemptStageTransition(thread: Thread): {
  success: boolean
  newStage?: ThreadStage
  failures?: string[]
} {
  switch (thread.stage) {
    case 'DISCOVERY':
      // Can advance if binary question proposed + ≥2 agents engaged
      if (!thread.binaryQuestion) {
        return { success: false, failures: ['No binary question proposed'] }
      }
      if (thread.participants.size < 2) {
        return { success: false, failures: ['Need ≥2 participants'] }
      }
      return { success: true, newStage: 'CRUX_LOCK' }

    case 'CRUX_LOCK':
      return attemptCruxLock(thread)

    case 'EVIDENCE':
      // Advance to CONVERGED when stability reached
      const stable = checkEvidenceStability(thread)
      if (stable) {
        return { success: true, newStage: 'CONVERGED' }
      }
      return { success: false, failures: ['Evidence debate still active'] }

    default:
      return { success: false }
  }
}
```

---

### 3. Crux Lock Gate

**Purpose**: Don't allow evidence debate until crux is well-formed.

```typescript
function attemptCruxLock(thread: Thread): {
  success: boolean
  newStage?: ThreadStage
  failures?: string[]
} {
  const failures: string[] = []
  const locked = thread.lockedCrux

  if (!locked) {
    return { success: false, failures: ['No LockedCrux created'] }
  }

  // Criterion 1: ≥2 agents committed
  if (locked.commitments.size < 2) {
    failures.push(`Only ${locked.commitments.size} commitments (need ≥2)`)
  }

  // Criterion 2: Both YES and NO sides present
  const sides = Array.from(locked.commitments.values()).map(c => c.side)
  const hasYES = sides.includes('YES')
  const hasNO = sides.includes('NO')
  if (!hasYES || !hasNO) {
    failures.push('Need both YES and NO positions (not just UNCERTAIN)')
  }

  // Criterion 3: All required steelmans passed
  const requiredPairs = generateSteelmanPairs(locked.commitments)
  for (const { from, to } of requiredPairs) {
    const pair = locked.steelmanPairs.find(p => p.from === from && p.to === to)
    if (!pair || pair.grade !== 'ACCURATE') {
      failures.push(`${from} must steelman ${to} (graded ACCURATE)`)
    }
  }

  // Criterion 4: All committed agents have falsifiers
  for (const [agentId, commit] of locked.commitments) {
    if (!commit.falsifier) {
      failures.push(`${agentId} has not declared falsifier`)
    }
  }

  if (failures.length > 0) {
    thread.lockAttempts++

    // After 2 failed attempts, moderator intervenes
    if (thread.lockAttempts >= 2) {
      injectModeratorCruxForcing(thread, failures)
    }

    return { success: false, failures }
  }

  // Lock succeeded!
  locked.lockedAt = Date.now()
  return { success: true, newStage: 'EVIDENCE' }
}

function generateSteelmanPairs(
  commitments: Map<PersonaId, any>
): Array<{ from: PersonaId; to: PersonaId }> {
  // For each pair of agents on opposite sides, both must steelman each other
  const agents = Array.from(commitments.keys())
  const pairs: Array<{ from: PersonaId; to: PersonaId }> = []

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const side1 = commitments.get(agents[i])!.side
      const side2 = commitments.get(agents[j])!.side

      // Only require steelman if they're on opposite sides
      if ((side1 === 'YES' && side2 === 'NO') || (side1 === 'NO' && side2 === 'YES')) {
        pairs.push({ from: agents[i], to: agents[j] })
        pairs.push({ from: agents[j], to: agents[i] })
      }
    }
  }

  return pairs
}
```

---

### 4. Steelman Protocol

**Purpose**: Ensure agents understand each other before challenging.

**Enforcement**: Agent cannot issue CHALLENGE move until they've steelmanned opponent and received ACCURATE grade.

```typescript
// Agent A wants to challenge Agent B
// Flow:
// 1. A issues STEELMAN move with meta.steelmanTarget = B
// 2. A provides: B's claim, B's strongest reason, B's falsifier
// 3. B issues GRADE_STEELMAN move with meta.steelmanGrade
// 4. If grade = ACCURATE, A can now CHALLENGE
// 5. If grade = INCOMPLETE or WRONG, A must retry

interface SteelmanMessage extends Message {
  move: 'STEELMAN'
  content: string  // "B argues that [claim] because [reason]. Would change mind if [falsifier]."
  meta: {
    steelmanTarget: PersonaId
    claimRepresented: string
    strongestReason: string
    falsifierRepresented: Falsifier
  }
}

interface GradeSteelmanMessage extends Message {
  move: 'GRADE_STEELMAN'
  content: string  // "Accurate" or "You missed my point about X"
  meta: {
    steelmanGrade: SteelmanGrade
    corrections?: string  // If not ACCURATE, what was missing
  }
}

// System tracks in AgentState
function recordSteelmanGrade(
  thread: Thread,
  steelmanner: PersonaId,
  target: PersonaId,
  grade: SteelmanGrade
) {
  const agent = getAgentState(steelmanner)
  if (!agent.steelmanGrades.has(thread.id)) {
    agent.steelmanGrades.set(thread.id, new Map())
  }
  agent.steelmanGrades.get(thread.id)!.set(target, grade)
}
```

---

### 5. Horizon Normalization

**Purpose**: Prevent talking-past due to time horizon differences.

**Detection**: Moderator asks agents for horizon before CRUX_LOCK.

```typescript
function detectHorizonMismatch(
  thread: Thread,
  agents: Map<PersonaId, AgentState>
): { mismatch: boolean; horizons: Map<PersonaId, Horizon> } {
  const horizons = new Map<PersonaId, Horizon>()

  for (const agentId of thread.participants) {
    const agent = agents.get(agentId)!
    const horizon = agent.horizonByThread.get(thread.id) || agent.defaultHorizon
    horizons.set(agentId, horizon)
  }

  // Check if horizons differ by >1 bucket
  const uniqueHorizons = new Set(horizons.values())
  const mismatch = uniqueHorizons.size > 1

  return { mismatch, horizons }
}

function handleHorizonMismatch(thread: Thread, horizons: Map<PersonaId, Horizon>) {
  // Option 1: Moderator forces alignment
  injectModeratorHorizonAlignment(thread, horizons)

  // Option 2: Split thread by horizon
  // Create Thread-A (1-3mo + 12-18mo agents)
  // Create Thread-B (5y + 10y+ agents)
  // Only split if >3 agents per bucket
}
```

---

### 6. Cheap Agreement Detection

**Purpose**: Prevent fake concessions that don't reflect real position change.

```typescript
interface ConcedeMessage extends Message {
  move: 'CONCEDE'
  content: string  // Natural language
  meta: {
    concededProposition: string     // REQUIRED: exact quote or arg-id
    topClaimChanged: boolean         // REQUIRED: did this flip your top claim?
    priorPosition?: 'YES' | 'NO'    // Before concession
    newPosition?: 'YES' | 'NO'      // After concession (if topClaimChanged)
  }
}

function validateConcession(message: ConcedeMessage): {
  valid: boolean
  reason?: string
} {
  // Must specify exact proposition
  if (!message.meta?.concededProposition) {
    return { valid: false, reason: 'Must name exact proposition conceded' }
  }

  // Must declare impact on top claim
  if (message.meta.topClaimChanged === undefined) {
    return { valid: false, reason: 'Must declare whether top-level claim changed' }
  }

  // If top claim changed, must provide before/after
  if (message.meta.topClaimChanged) {
    if (!message.meta.priorPosition || !message.meta.newPosition) {
      return { valid: false, reason: 'Must provide prior/new positions if claim changed' }
    }
  }

  return { valid: true }
}

// Cheap concessions are marked but don't count toward convergence
function isCheapConcession(message: ConcedeMessage): boolean {
  return !message.meta?.topClaimChanged
}
```

---

### 7. Crux Authenticity (Testable)

**Purpose**: Real cruxes must be decision-relevant.

```typescript
function validateCruxAuthenticity(
  crux: LockedCrux,
  agents: Map<PersonaId, AgentState>
): { authentic: boolean; failures: string[] } {
  const failures: string[] = []

  // Test 1: Is this a measurement question? (BAD)
  const measurementKeywords = ['will correlation', 'will volatility', 'will price']
  if (measurementKeywords.some(kw => crux.question.toLowerCase().includes(kw))) {
    failures.push('Measurement question, not identity/causal question')
  }

  // Test 2: Does flipping the crux flip ≥2 agents' TopClaims?
  const flippers = Array.from(crux.commitments.entries()).filter(([agentId, commit]) => {
    const agent = agents.get(agentId)!
    return wouldFlipTopClaim(agent, crux.question, commit.side)
  })

  if (flippers.length < 2) {
    failures.push(`Only ${flippers.length} agents would flip TopClaim (need ≥2)`)
  }

  // Test 3: Falsifiers are concrete (not vibes)
  for (const [agentId, commit] of crux.commitments) {
    if (commit.falsifier) {
      const vagueKeywords = ['probably', 'might', 'seems', 'feels', 'generally']
      if (vagueKeywords.some(kw => commit.falsifier.threshold.toLowerCase().includes(kw))) {
        failures.push(`${agentId}'s falsifier is vague: "${commit.falsifier.threshold}"`)
      }
    }
  }

  return { authentic: failures.length === 0, failures }
}
```

---

## Component Specifications

### 1. Message Bus

**Responsibilities**:
- Central pub/sub for all messages
- Tag messages with threads, topics
- Notify subscribed agents
- Maintain message history

**API**:
```typescript
interface MessageBus {
  // Publishing
  publish(message: Message): void

  // Subscribing
  subscribe(agentId: PersonaId, filter: MessageFilter): void
  unsubscribe(agentId: PersonaId, filter: MessageFilter): void

  // Querying
  getMessages(filter: MessageFilter): Message[]
  getThread(threadId: ThreadId): Message[]
}

interface MessageFilter {
  threadIds?: ThreadId[]
  topics?: string[]
  since?: number                   // Timestamp
  agentIds?: PersonaId[]
  mentionsAgent?: PersonaId        // Direct @mentions
}
```

**Implementation Notes**:
- In-memory for now (Redis for production)
- Embeddings computed on publish (async, cached)
- Max history: last 500 messages (rolling window) 

---

### 2. Attention Scorer

**Responsibilities**:
- For each agent, score how relevant each new message is
- Agents only see messages above relevance threshold
- Prevents information overload

**Relevance Factors**:
1. **Semantic similarity** (50%): Message embedding vs agent's current interests
2. **Thread participation** (25%): Agent is already in this thread
3. **Direct mention** (100%): Agent explicitly @mentioned
4. **Recency** (15%): Newer messages slightly boosted
5. **Move type** (10%): CHALLENGE/CONCEDE higher priority than CLAIM

**Scoring Function**:
```typescript
interface AttentionScorer {
  scoreMessage(message: Message, agent: AgentState): number  // 0-1

  // Agent interests are dynamic
  updateInterests(agentId: PersonaId, interests: Interest[]): void
}

interface Interest {
  topic: string                    // "volatility", "monetary policy"
  embedding: number[]              // Semantic vector
  weight: number                   // 0-1, how important to agent
}

interface AgentState {
  id: PersonaId
  interests: Interest[]

  // Top-level claim (what agent is really arguing for)
  topClaim: TopClaim

  // Thread participation
  activeThreads: Set<ThreadId>
  positions: Map<CruxId, CruxPosition>

  // Steelman tracking (per thread)
  steelmanGrades: Map<ThreadId, Map<PersonaId, SteelmanGrade>>

  // Horizon preferences
  defaultHorizon: Horizon           // Agent's natural investment horizon
  horizonByThread: Map<ThreadId, Horizon>

  // Behavioral state
  lastResponseTime: number
  currentCooldown: number           // Random 6-12s after each message
  messagesPosted: number
}
```

**Threshold**:
- Agent only sees messages with score ≥ 0.6
- Direct @mentions always delivered (score = 1.0)

**Example**:
```
Message: "Bitcoin's correlation with tech stocks proves it's not a hedge"
Agent: Arthur Hayes (interests: ["macro", "correlation", "institutional"])

Scores:
- Semantic: 0.85 (high overlap with "correlation", "institutional")
- Thread: 0.0 (not in thread yet)
- Mention: 0.0 (not mentioned)
- Recency: 1.0 (just posted)
- Move: 0.7 (CHALLENGE)

Final: 0.5*0.85 + 0.25*0 + 0*0 + 0.15*1.0 + 0.1*0.7 = 0.645
→ Delivered to Arthur Hayes
```

---

### 3. Agent Behavior Loop

Each agent runs an async loop:

```typescript
async function agentLoop(agent: AgentState, bus: MessageBus, scorer: AttentionScorer) {
  while (true) {
    // 1. LISTEN: Get relevant messages
    const messages = bus.getMessages({ since: agent.lastCheckTime })
    const relevant = messages.filter(m => scorer.scoreMessage(m, agent) >= 0.6)

    if (relevant.length === 0) {
      await sleep(randomDelay(2000, 5000))  // Stochastic timing
      continue
    }

    // 2. DECIDE: Which message(s) to respond to
    const target = selectResponse(relevant, agent)

    if (!target) {
      // Sometimes agents choose not to respond
      await sleep(randomDelay(5000, 10000))
      continue
    }

    // 3. SPEAK: Generate response
    const response = await generateResponse(agent, target, bus)

    // 4. PUBLISH
    bus.publish(response)

    // 5. UPDATE: Adjust interests based on what you said
    updateInterests(agent, response)

    // Stochastic delay before next check
    await sleep(randomDelay(3000, 8000))
  }
}
```

**Key decisions**:

**selectResponse()**:
- Don't always respond to highest-scoring message
- Randomness: 70% respond to top, 20% to second, 10% to third
- Prefer messages in threads you're already in (sticky threads)
- Avoid responding if ≥3 messages already in thread since last check (let others talk)

**generateResponse()**:
- LLM call with context:
  - Agent's persona/contract
  - Target message + preceding 2-3 messages in thread
  - Agent's current positions on known cruxes
  - Instruction: "200-400 chars, punchy, direct"
- Output: `{ content: string, move: DialogueMove }`

**updateInterests()**:
- Extract topics from response (simple keyword extraction or LLM)
- Boost weights on topics you engaged with
- Decay weights on topics you ignored (exponential decay)

---

### 4. Thread Manager

**Responsibilities**:
- Create threads when new topics emerge
- Detect convergence (thread has found its crux)
- Detect staleness (no activity)
- Merge duplicate threads
- Spawn child threads on divergence

**Thread Lifecycle**:

```typescript
interface ThreadManager {
  // Thread creation
  createThread(topic: string, initialMessage: Message): Thread

  // Thread state tracking
  updateThreadActivity(threadId: ThreadId, message: Message): void
  checkConvergence(threadId: ThreadId): { converged: boolean, signal: number }
  checkStaleness(threadId: ThreadId): boolean

  // Thread operations
  mergeThreads(target: ThreadId, source: ThreadId): void
  spawnChildThread(parentId: ThreadId, topic: string, triggerMessage: Message): Thread
}
```

**Convergence Detection**:

A thread converges when:
1. **Crux crystallized**: A clear binary question extracted
2. **Positions stable**: No new positions added in last 5+ messages
3. **No new participants**: Agent set hasn't changed in last 8+ messages
4. **Move pattern**: PROPOSE_CRUX followed by acknowledgment

```typescript
function checkConvergence(thread: Thread): { converged: boolean, signal: number } {
  const recentMoves = thread.messages.slice(-8).map(m => m.move)

  // Strong signal: PROPOSE_CRUX + acknowledgment
  const cruxProposed = recentMoves.includes('PROPOSE_CRUX')
  const acknowledged = recentMoves.slice(-3).includes('CONCEDE') ||
                       recentMoves.slice(-3).some(m => m === 'CLAIM' && isAcknowledgment(m))

  if (cruxProposed && acknowledged) return { converged: true, signal: 0.95 }

  // Medium signal: High CONCEDE rate
  const concessions = recentMoves.filter(m => m === 'CONCEDE').length
  if (concessions >= 3) return { converged: true, signal: 0.75 }

  // Weak signal: Participants shrinking (others lost interest)
  const recentParticipants = new Set(thread.messages.slice(-8).map(m => m.agentId))
  if (recentParticipants.size <= 2 && thread.participants.size > 2) {
    return { converged: true, signal: 0.6 }
  }

  return { converged: false, signal: 0.0 }
}
```

**Staleness Detection**:
- No messages in last 30 seconds (configurable)
- Mark as STALE, archive, agents unsubscribe

**Thread Spawning**:

Spawn child thread when:
- Agent says "But what about X?" (reframe to new sub-topic)
- Agent proposes alternative framing that others engage with
- Thread has >15 messages but no convergence (too broad, needs splitting)

```typescript
// Example trigger
Message: "You're both talking about volatility, but isn't the real question
          whether institutions will adopt it?"

→ Spawn child thread: "Will institutions adopt Bitcoin?"
→ Move agents interested in "institutions" to new thread
→ Original thread continues on "volatility"
```

---

### 5. Agenda Manager

**Responsibilities**:
- Track 1-2 "hot" disputes globally
- Boost attention to messages relevant to active disputes
- Prevent all threads from stalling simultaneously
- Periodically request agent commitment on active disputes
- Rotate disputes when one converges

**Purpose**: Async systems need light coordination to prevent fragmentation without forced turns.

**API**:
```typescript
interface AgendaManager {
  // Active disputes (max 2 at any time)
  activeDisputes: CruxId[]

  // Boost attention for messages relevant to active disputes
  boostAttention(message: Message, agent: AgentState): number  // returns +0.0 to +0.2

  // Request agents to commit to a position on an active dispute
  requestCommitment(disputeId: CruxId, agents: PersonaId[]): void

  // Rotate to new dispute when one converges
  rotateDisputes(convergedId: CruxId, candidates: CruxId[]): void

  // Select next dispute from candidates
  selectNextDispute(candidates: ThreadCrux[]): CruxId | null
}
```

**Selection Criteria** (for next dispute):
1. Most agents haven't taken a clear position (maximize information gain)
2. High variance in confidence (uncertainty indicates real disagreement)
3. Not a dependency of unresolved dispute (solve leaves before roots)

**Integration with Attention Scorer**:
```typescript
function scoreMessage(message: Message, agent: AgentState): number {
  let score = baseScore(message, agent)  // existing factors

  // Boost if message relates to active dispute
  const boost = agendaManager.boostAttention(message, agent)
  score = Math.min(1.0, score + boost)

  return score
}
```

**Example Flow**:
```
t=0s: Agenda empty, all threads equally prioritized
t=60s: Thread 1 converges to crux-1 ("Is Bitcoin volatile?")
       → Agenda adds crux-1 as active dispute
       → Messages mentioning "volatility" get +0.2 attention boost
t=90s: Thread 2 converges to crux-2 ("Institutional adoption?")
       → Agenda adds crux-2 (now 2 active disputes)
t=120s: Both disputes have stable positions from all agents
       → Agenda requests explicit commitment: "Agent A, do you agree Bitcoin volatility prevents institutional adoption?"
t=150s: Crux-1 gets consensus (all agents aligned)
       → Agenda rotates: remove crux-1, add crux-3 from Thread 3
```

---

### 6. Hierarchical Crystallizer

**Three-level crystallization**:

#### **Level 1: Per-Thread Crystallization**

Runs when thread reaches convergence or after 12+ messages.

**Input**:
- All messages in thread (typically 8-20)
- Thread topic
- Current participants

**Output**:
- ThreadCrux (binary question + positions)

**Prompt**:
```
You are crystallizing a debate thread on "{topic}".

Messages (chronological):
[list all messages with speaker, move, content]

Your task:
1. Identify the CORE BINARY QUESTION this thread is really about
2. For each participant, extract their position (YES/NO/UNCERTAIN)
3. List CONCRETE resolution criteria (observable evidence that would settle it)
4. For each participant, determine if the dispute is DECISION-RELEVANT (counterfactual test)

Rules:
- The question must be binary and specific
- If there's no real disagreement (all same side), output null
- If discussion is confused/incoherent, output NEEDS_CLARIFICATION
- Resolution criteria must be concrete, not vibes (e.g., "5-year correlation data", "policy change impact")
- Counterfactual: would agent's TOP-LEVEL CONCLUSION flip if this dispute flipped?

Output JSON:
{
  "question": "...",
  "positions": {
    "agent-1": { "side": "YES", "statement": "...", "confidence": 0.8 },
    ...
  },
  "resolutionCriteria": [
    "Observable criterion 1",
    "Observable criterion 2"
  ],
  "counterfactual": {
    "agent-1": { "wouldFlip": true, "why": "If volatility persists, adoption thesis breaks" },
    ...
  },
  "supportingMessages": ["msg-1", "msg-5", ...],
  "confidence": 0.85
}
```

**Validation**:

Cruxes must pass robustness tests before being marked as validated:

```typescript
function validateCrux(crux: ThreadCrux): { valid: boolean, failures: string[] } {
  const failures: string[] = []

  // Test 1: Real disagreement (need both YES and NO)
  const sides = Object.values(crux.positions).map(p => p.side)
  const hasYES = sides.includes('YES')
  const hasNO = sides.includes('NO')
  if (!hasYES || !hasNO) {
    failures.push("No real disagreement (need both YES and NO)")
  }

  // Test 2: Sufficient resolution criteria
  if (crux.resolutionCriteria.length < 2) {
    failures.push("Insufficient resolution criteria (need ≥2 concrete items)")
  }

  // Test 3: Decision-relevant (counterfactual test)
  const relevantFlips = Object.values(crux.counterfactual).filter(c => c.wouldFlip)
  if (relevantFlips.length < 2) {
    failures.push("Not decision-relevant (need ≥2 agents for whom flip matters)")
  }

  return { valid: failures.length === 0, failures }
}
```

**Self-Correction Loop**:
- Publish crystallized crux back to thread
- Agents can respond with CHALLENGE if misrepresented
- If challenged OR validation fails, re-crystallize with agent feedback
- Mark crux as `validated: true` only after passing all tests

#### **Level 2: Cross-Thread Pattern Matching**

Runs every 20 messages globally, looks across all CONVERGED threads.

**Input**:
- All ThreadCruxes from converged threads
- Message corpus

**Output**:
- CruxDependency[] (crux A implies crux B)
- CruxPair[] (contradictions)
- Coalition[] (agents clustering by positions)

**Pattern Detection**:

```typescript
interface CrossThreadAnalyzer {
  // Find cruxes that are actually the same question rephrased
  findDuplicates(cruxes: ThreadCrux[]): CruxPair[]

  // Find logical dependencies ("If A is YES, then B must be NO")
  findDependencies(cruxes: ThreadCrux[]): CruxDependency[]

  // Find contradictions (agent says YES to A and YES to B, but A and B contradict)
  findContradictions(cruxes: ThreadCrux[], agentPositions: Map<PersonaId, Map<CruxId, CruxPosition>>): CruxPair[]

  // Cluster agents by position similarity
  detectCoalitions(agentPositions: Map<PersonaId, Map<CruxId, CruxPosition>>): Coalition[]
}
```

**Example**:
```
Thread 1 crux: "Is Bitcoin primarily used for speculation?"
Thread 2 crux: "Will Bitcoin ever function as a medium of exchange?"

Cross-thread analysis:
→ Dependency: If Thread1=YES, then Thread2=NO (speculation precludes MoE)
→ Coalition: {Saylor, Mallers} both say Thread1=NO, Thread2=YES
```

#### **Level 3: Global Crux Synthesis**

Runs at end of debate or when all threads converge.

**Input**:
- All ThreadCruxes
- CruxDependency graph
- Coalition map

**Output**:
- GlobalCruxGraph
- Irreducible cruxes (can't be resolved further)
- Common ground (all agents agree)
- Recommended next questions (if debate continues)

**Synthesis Algorithm**:

```typescript
function synthesizeGlobalCrux(
  cruxes: ThreadCrux[],
  dependencies: CruxDependency[],
  coalitions: Coalition[]
): GlobalCruxGraph {
  // 1. Build dependency DAG
  const dag = buildDAG(cruxes, dependencies)

  // 2. Find root cruxes (no dependencies, most fundamental)
  const roots = findRoots(dag)

  // 3. For each root, trace downstream implications
  const implications = roots.map(r => traceImplications(r, dag))

  // 4. Identify irreducible (no consensus, no dependencies could resolve)
  const irreducible = roots.filter(r => {
    const positions = Object.values(r.positions)
    return hasRealSplit(positions) && !canBeResolvedByDependencies(r, dag)
  })

  // 5. Identify common ground (all agents aligned)
  const commonGround = cruxes.filter(c => {
    const positions = Object.values(c.positions).map(p => p.side)
    return positions.every(p => p === positions[0])
  })

  return {
    cruxes: new Map(cruxes.map(c => [c.threadId, c])),
    dependencies,
    coalitions,
    irreducibleCruxes: irreducible.map(c => c.threadId),
    commonGround: commonGround.map(c => c.threadId)
  }
}
```

---

### 6. Coalition Detection

Agents naturally cluster based on position alignment.

**Algorithm**:

```typescript
function detectCoalitions(
  agentPositions: Map<PersonaId, Map<CruxId, CruxPosition>>
): Coalition[] {
  // 1. Build agent similarity matrix (Jaccard similarity on positions)
  const similarity = buildSimilarityMatrix(agentPositions)

  // 2. Cluster using hierarchical clustering (threshold: 0.7)
  const clusters = hierarchicalCluster(similarity, 0.7)

  // 3. For each cluster, extract shared positions
  const coalitions = clusters.map(cluster => {
    const sharedPositions = findSharedPositions(cluster, agentPositions)
    return {
      members: cluster,
      positions: sharedPositions,
      label: generateLabel(sharedPositions)  // LLM call to name coalition
    }
  })

  return coalitions
}

// Generate coalition labels
function generateLabel(positions: Map<CruxId, 'YES' | 'NO'>): string {
  // LLM prompt:
  // "These agents agree on: [list positions]. What's a 2-3 word label for this camp?"
  // Examples: "Bitcoin Maximalists", "Tech Stock Bears", "Regulation Skeptics"
}
```

**Example Output**:
```json
{
  "coalitions": [
    {
      "members": ["michael-saylor", "jack-mallers"],
      "positions": {
        "crux-1": "YES",  // "Bitcoin is digital gold"
        "crux-3": "NO",   // "Bitcoin correlation with tech stocks is problematic"
        "crux-5": "YES"   // "Institutional adoption is inevitable"
      },
      "label": "Bitcoin Fundamentalists"
    },
    {
      "members": ["arthur-hayes", "nassim-taleb"],
      "positions": {
        "crux-1": "NO",
        "crux-3": "YES",
        "crux-5": "NO"
      },
      "label": "Macro Skeptics"
    }
  ]
}
```

---

## Convergence & Stopping Conditions

**Global Convergence**:

The debate has converged when:

1. **All threads converged or stale**: No active threads remain
2. **Irreducible cruxes identified**: ≥1 crux with stable YES/NO split
3. **No new threads spawning**: Agents aren't opening new topics
4. **Coalitions stable**: Agent clusters haven't changed in last 30 messages

**Stopping Conditions**:

1. **Natural convergence**: Above criteria met
2. **Time limit**: 5 minutes elapsed (configurable)
3. **Message limit**: 200 total messages (configurable)
4. **Stagnation**: No new cruxes discovered in last 50 messages

**Partial Results**:

If stopped before full convergence, output:
- Converged threads (with cruxes)
- Active threads (work-in-progress)
- Preliminary coalition map
- "Confidence: LOW" flag

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

**Files to create**:
```
faultline/lib/multi-agent/
├── types.ts                    # Message, Thread, AgentState, etc.
├── message-bus.ts              # Pub/sub implementation
├── attention-scorer.ts         # Relevance scoring
├── thread-manager.ts           # Thread lifecycle
└── agent-loop.ts               # Agent behavior loop
```

**Tests**:
- Message bus pub/sub works
- Attention scorer produces reasonable relevance scores
- Thread manager detects convergence/staleness
- Agent loop handles async message processing

### Phase 2: Crystallization (Week 2)

**Files to create**:
```
faultline/lib/multi-agent/crystallization/
├── per-thread.ts               # Level 1 crystallization
├── cross-thread.ts             # Level 2 pattern matching
├── global-synthesis.ts         # Level 3 crux graph
└── prompts.ts                  # Crystallization prompts
```

**Tests**:
- Per-thread crystallization extracts binary questions from sample dialogues
- Cross-thread finds dependencies and contradictions
- Global synthesis identifies irreducible cruxes

### Phase 3: Coalition & Convergence (Week 2)

**Files to create**:
```
faultline/lib/multi-agent/
├── coalition-detector.ts       # Cluster agents by positions
├── convergence.ts              # Global convergence detection
└── stopping-conditions.ts      # When to end debate
```

### Phase 4: Integration & API (Week 3)

**Files to create**:
```
faultline/app/api/debate-multi/route.ts    # SSE endpoint
faultline/lib/multi-agent/orchestrator.ts  # Main entry point
faultline/scripts/run-multi-debate.ts      # CLI
```

**API**:
```typescript
POST /api/debate-multi
{
  "topic": "Bitcoin is a good store of value",
  "personaIds": ["michael-saylor", "arthur-hayes", "nassim-taleb", "jack-mallers", "peter-schiff"],
  "config": {
    "maxDuration": 300000,        // 5 minutes
    "maxMessages": 200,
    "attentionThreshold": 0.6,
    "convergenceThreshold": 0.75
  }
}

Returns: SSE stream
Events:
- message_published
- thread_created
- thread_converged
- crux_extracted
- coalition_detected
- global_convergence
- debate_complete
```

### Phase 5: Frontend (Week 4)

**UI Components**:

1. **Thread View** (main): Multiple columns, one per active thread
   - Chat-style messages
   - Thread topic at top
   - Convergence progress bar
   - Click to expand/collapse

2. **Agent Panel** (sidebar): List of agents, current thread participation
   - Avatar + name
   - Active threads (badges)
   - Coalition membership (colored border)

3. **Crux Map** (bottom): Visual graph of cruxes
   - Nodes = cruxes (binary questions)
   - Edges = dependencies
   - Colors = coalitions
   - Click node to see supporting messages

4. **Timeline** (optional): Chronological view of all messages across threads

**Files to create**:
```
faultline/app/debate-multi/page.tsx
faultline/components/multi-agent/
├── ThreadColumn.tsx           # One thread display
├── AgentPanel.tsx             # Agent list + status
├── CruxMap.tsx               # Visual crux graph
└── MultiDebateClient.tsx     # Main orchestrator
```

---

## Performance Characteristics

**Typical Debate** (5 agents, 3 threads, 80 messages, 3 minutes):

| Metric | Value |
|--------|-------|
| Total messages | 80 |
| Messages per agent | ~16 |
| Active threads | 1-3 (avg 2.2) |
| Threads created | 4 (1 merged, 1 stale) |
| Cruxes extracted | 3 |
| Coalitions | 2 |
| LLM calls | ~90 (80 dialogue + 6 crystallization + 4 coalition) |
| Tokens (input) | ~45k |
| Tokens (output) | ~8k |
| Cost | ~$0.70 |
| Convergence | PARTIAL (2/3 threads converged) |

**Scaling** (N agents):

| Agents | Threads | Messages | Duration | Cost |
|--------|---------|----------|----------|------|
| 2 | 1 | 24 | 60s | $0.40 |
| 3 | 1-2 | 40 | 90s | $0.55 |
| 5 | 2-3 | 80 | 180s | $0.70 |
| 8 | 3-5 | 140 | 300s | $1.10 |
| 12 | 4-7 | 220 | 450s | $1.80 |

**Key insight**: Cost scales sub-linearly with agents because:
- Attention mechanism filters messages (agents don't respond to everything)
- Threads partition the conversation (not everyone in every thread)
- Some agents go quiet after their crux is identified
- Reply budgets and cooldowns prevent message cascades

**Note**: With invariants enforced (reply limits, thread rate limits, cooldowns), actual message counts may be 10-20% **lower** than estimates above. Estimates are conservative (assumes near-max throughput).

---

## v0 Simplifications (Recommended for Phase 1)

**Purpose**: Get a working demo fast without the complexity of embeddings, cross-thread analysis, or live coalitions. Add sophistication incrementally.

### What to Defer

```typescript
const V0_SIMPLIFICATIONS = {
  // NO EMBEDDINGS initially
  embeddings: false,                    // Use keyword/rule-based attention scoring

  // MODERATOR-CONTROLLED thread spawning
  threadSpawning: 'MODERATOR_ONLY',     // Rule-based, not agent-triggered

  // LEVEL 1 ONLY crystallization
  crystallization: 'LEVEL_1_ONLY',      // Skip cross-thread dependencies and global synthesis

  // POST-DEBATE coalitions
  coalitions: 'POST_DEBATE',            // Compute only at end, not live during debate

  // NO AGENDA MANAGER
  agendaManager: false,                 // Add in v1 after basic flow works
}
```

---

### v0 Attention Scoring (No Embeddings)

```typescript
function scoreMessageV0(message: Message, agent: AgentState): number {
  let score = 0

  // 1. Direct mention (100%, always deliver)
  if (message.content.includes(`@${agent.id}`) || message.content.includes(agent.name)) {
    return 1.0
  }

  // 2. Same thread (50% boost)
  if (agent.activeThreads.has(message.threadId)) {
    score += 0.5
  }

  // 3. Move type priority (30%)
  const highPriorityMoves = ['CHALLENGE', 'CONCEDE', 'PROPOSE_CRUX']
  const mediumPriorityMoves = ['CLAIM', 'REFRAME']

  if (highPriorityMoves.includes(message.move)) {
    score += 0.3
  } else if (mediumPriorityMoves.includes(message.move)) {
    score += 0.2
  } else {  // CLARIFY
    score += 0.1
  }

  // 4. Recency (20%)
  const ageMs = Date.now() - message.timestamp
  if (ageMs < 10000) {        // <10s: fresh
    score += 0.2
  } else if (ageMs < 30000) { // <30s: recent
    score += 0.1
  }

  // 5. Keyword overlap (optional, 20%)
  const agentInterestKeywords = agent.interests.map(i => i.topic)
  const messageKeywords = extractKeywords(message.content)  // simple extraction
  const overlap = intersection(agentInterestKeywords, messageKeywords).length
  if (overlap > 0) {
    score += Math.min(0.2, overlap * 0.1)
  }

  return Math.min(1.0, score)
}

function extractKeywords(text: string): string[] {
  // Simple: lowercase, split, filter common words
  const stopWords = new Set(['the', 'is', 'and', 'or', 'but', 'a', 'an', 'in', 'on', 'at'])
  return text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
}
```

**Performance**: Fast (no API calls), good enough for v0.

---

### v0 Thread Spawning (Moderator-Controlled)

```typescript
// Rule-based triggers, not agent free-form
function checkThreadSpawnTriggers(messages: Message[]): ThreadProposal | null {
  // Trigger 1: ≥2 agents mention same keyword in different messages
  const keywordCounts = new Map<string, Set<PersonaId>>()
  for (const msg of messages.slice(-10)) {
    const keywords = extractKeywords(msg.content)
    for (const kw of keywords) {
      if (!keywordCounts.has(kw)) keywordCounts.set(kw, new Set())
      keywordCounts.get(kw).add(msg.agentId)
    }
  }

  for (const [keyword, agents] of keywordCounts) {
    if (agents.size >= 2 && isInterestingTopic(keyword)) {
      return {
        topic: keyword,
        binaryQuestion: generateBinaryQuestion(keyword),  // LLM call
        supporters: Array.from(agents),
        status: 'APPROVED'
      }
    }
  }

  // Trigger 2: Agent explicitly says "but what about X?"
  const reframePattern = /but what about (.+?)[?.!]/i
  for (const msg of messages.slice(-5)) {
    const match = msg.content.match(reframePattern)
    if (match) {
      return {
        topic: match[1],
        binaryQuestion: null,  // Will generate in next step
        supporters: [msg.agentId],
        status: 'PROPOSED'
      }
    }
  }

  return null
}
```

**Advantage**: Predictable, no runaway thread spawning.

---

### v0 Crystallization (Level 1 Only)

```typescript
// Per-thread crux extraction, no cross-thread analysis
async function crystallizeV0(thread: Thread): Promise<ThreadCrux | null> {
  // Standard Level 1 crystallization
  const crux = await extractThreadCrux(thread.messages, thread.topic)

  // Validate
  const { valid, failures } = validateCrux(crux)
  if (!valid) {
    console.log(`Crux validation failed: ${failures.join(', ')}`)
    return null
  }

  return crux
}

// Skip Level 2 (cross-thread) and Level 3 (global synthesis) in v0
// Just collect all thread cruxes in a flat list
```

---

### v0 Coalition Detection (Post-Debate Only)

```typescript
// Don't compute coalitions live during debate
// At end of debate, cluster agents by positions
async function detectCoalitionsV0(cruxes: ThreadCrux[]): Promise<Coalition[]> {
  if (cruxes.length < 3) {
    return []  // Not enough data
  }

  const agentPositions = buildPositionMap(cruxes)
  const similarity = buildSimilarityMatrix(agentPositions, cruxes)
  const clusters = hierarchicalCluster(similarity, 0.7)

  const coalitions: Coalition[] = []
  for (const cluster of clusters) {
    if (cluster.length < 2) continue  // Singleton, not a coalition

    const sharedPositions = findSharedPositions(cluster, agentPositions)
    const label = await generateCoalitionLabel(sharedPositions)  // LLM call

    coalitions.push({
      members: cluster,
      positions: sharedPositions,
      label
    })
  }

  return coalitions
}
```

---

### v0 Implementation Sequence

1. **Week 1**: Message bus + agent loop (keyword-based attention)
   - 2-3 agents, 1 thread, no crystallization yet
   - Prove async message flow works
   - Tune reply budgets and cooldowns

2. **Week 2**: Add Level 1 crystallization + validation
   - After 12+ messages, crystallize thread
   - Test crux robustness (counterfactual, resolution criteria)
   - Agents can challenge crux

3. **Week 3**: Multi-thread + moderator-controlled spawning
   - 2-3 threads, rule-based spawning
   - Test thread rate limits, orthogonality checks

4. **Week 4**: Post-debate coalition detection + basic UI
   - Coalition clustering after debate ends
   - Multi-column thread view (basic)

**Then add in v1**:
- Embeddings for attention scoring
- Agent-triggered thread spawning
- Cross-thread analysis (Level 2)
- Live coalition tracking
- Agenda Manager
- Global synthesis (Level 3)

---

## Comparison: v2 vs Multi-Agent

| Aspect | v2 (Current) | Multi-Agent (Proposed) |
|--------|--------------|------------------------|
| **Agents** | 2 (hardcoded) | 3-12 (N-agent) |
| **Conversations** | 1 sequential dialogue | 2-4 parallel threads |
| **Turn-taking** | Round-robin | Attention-based (async) |
| **Response time** | Forced turns | Stochastic (3-8s delay) |
| **Crux discovery** | Single crystallization path | Hierarchical (per-thread → global) |
| **Coalitions** | N/A (only 2 agents) | Automatic detection + labeling |
| **Correctness** | Fake consensus bug | Binary disputes + coalition-based |
| **Scalability** | Doesn't scale beyond 2 | Scales to 12 agents |
| **UI** | Single chat column | Multi-column threads + crux map |
| **Cost (5 agents)** | N/A | ~$0.70 |

---

## System Invariants

**Purpose**: Hard constraints that prevent message floods, thread explosion, and shallow cruxes. These are NOT tunable parameters—they are structural requirements for system robustness.

---

### Reply Controls (Prevent Cascades)

```typescript
// Each message can receive at most K direct replies
const MAX_REPLIES_PER_MESSAGE = 2

// Agent must wait after responding (random delay)
const AGENT_COOLDOWN_MS = {
  min: 6000,   // 6 seconds minimum
  max: 12000   // 12 seconds maximum
}

// Thread rate limit (hard stop)
const THREAD_RATE_LIMIT = {
  messages: 12,      // Max messages
  windowMs: 30000    // Per 30 seconds
}
```

**Enforcement**:
```typescript
function canPublish(message: Message, bus: MessageBus): { allowed: boolean, reason?: string } {
  // Check 1: Reply limit on target message
  if (message.replyTo) {
    const target = bus.getMessage(message.replyTo)
    if (target.replyCount >= MAX_REPLIES_PER_MESSAGE) {
      return { allowed: false, reason: "Target message has max replies" }
    }
  }

  // Check 2: Thread rate limit
  const thread = bus.getThread(message.threadId)
  const recentMessages = thread.messages.filter(m =>
    Date.now() - m.timestamp < THREAD_RATE_LIMIT.windowMs
  )
  if (recentMessages.length >= THREAD_RATE_LIMIT.messages) {
    return { allowed: false, reason: "Thread rate limit exceeded, forcing crystallization" }
  }

  // Check 3: Agent cooldown
  const agent = getAgentState(message.agentId)
  if (agent.lastResponseTime && Date.now() - agent.lastResponseTime < agent.currentCooldown) {
    return { allowed: false, reason: "Agent in cooldown" }
  }

  return { allowed: true }
}
```

---

### Thread Controls (Prevent Explosion)

```typescript
// Max concurrent active threads
const MAX_ACTIVE_THREADS = 4

// Thread spawning requires consensus
const THREAD_SPAWN_MIN_AGENTS = 2        // ≥2 agents must "bite"
const THREAD_SPAWN_MIN_MENTIONS = 2      // Topic mentioned in ≥2 messages

// Orthogonality threshold (embedding distance from existing threads)
const THREAD_ORTHOGONALITY_THRESHOLD = 0.3  // cosine distance ≥0.3 from all active threads
```

**Thread Spawning Protocol** (expensive by design):

```typescript
interface ThreadProposal {
  proposedBy: PersonaId
  topic: string
  binaryQuestion: string | null    // Required before spawn
  supporters: PersonaId[]
  mentionCount: number
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED'
}

function proposeThreadSpawn(message: Message, candidateTopic: string): ThreadProposal {
  return {
    proposedBy: message.agentId,
    topic: candidateTopic,
    binaryQuestion: null,
    supporters: [message.agentId],
    mentionCount: 1,
    status: 'PROPOSED'
  }
}

function attemptThreadSpawn(proposal: ThreadProposal, bus: MessageBus): Thread | null {
  // Gate 1: Max threads not exceeded
  if (bus.getActiveThreads().length >= MAX_ACTIVE_THREADS) {
    proposal.status = 'REJECTED'
    return null
  }

  // Gate 2: Second agent must bite
  if (proposal.supporters.length < THREAD_SPAWN_MIN_AGENTS) {
    return null  // Still waiting
  }

  // Gate 3: Binary question required
  if (!proposal.binaryQuestion) {
    return null  // Agent must propose explicit binary question
  }

  // Gate 4: Orthogonality check (not too similar to existing threads)
  const activeThreads = bus.getActiveThreads()
  const proposalEmbedding = getEmbedding(proposal.binaryQuestion)
  for (const thread of activeThreads) {
    const threadEmbedding = getEmbedding(thread.binaryQuestion || thread.topic)
    if (cosineSimilarity(proposalEmbedding, threadEmbedding) > (1 - THREAD_ORTHOGONALITY_THRESHOLD)) {
      proposal.status = 'REJECTED'
      return null  // Too similar to existing thread, merge instead
    }
  }

  // All gates passed → spawn thread
  proposal.status = 'APPROVED'
  return createThread(proposal)
}
```

**Example Flow**:
```
t=10s: Agent A says "But what about adoption timelines?"
       → Create ThreadProposal { topic: "adoption timelines", supporters: [A] }

t=15s: Agent B responds: "Good point, regulatory clarity is the bottleneck"
       → Add B to supporters, but still no binary question

t=20s: Agent B proposes: "Will institutional adoption happen within 5 years?"
       → Set binaryQuestion
       → Check gates: max threads OK, 2 supporters ✓, binary question ✓, orthogonality ✓
       → Spawn Thread 3: "Will institutional adoption happen within 5 years?"
```

---

### Crux Validation (Prevent Shallow Cruxes)

```typescript
// Minimum requirements for a valid crux
const CRUX_MIN_DISAGREEMENT = 2           // ≥2 agents on opposite sides (YES vs NO)
const CRUX_MIN_RESOLUTION_CRITERIA = 2    // ≥2 concrete evidence items
const CRUX_REQUIRES_COUNTERFACTUAL = true // Must pass decision-relevance test
```

**Validation Function** (enforced before marking `validated: true`):

```typescript
function validateCrux(crux: ThreadCrux): { valid: boolean, failures: string[] } {
  const failures: string[] = []

  // Test 1: Real disagreement
  const sides = Object.values(crux.positions).map(p => p.side).filter(s => s !== 'UNCERTAIN')
  const hasYES = sides.includes('YES')
  const hasNO = sides.includes('NO')
  if (!hasYES || !hasNO) {
    failures.push("No real disagreement (need both YES and NO, not just UNCERTAIN)")
  }
  if (sides.filter(s => s === 'YES').length < 1 || sides.filter(s => s === 'NO').length < 1) {
    failures.push("Need at least 1 agent firmly on each side")
  }

  // Test 2: Resolution criteria are concrete
  if (crux.resolutionCriteria.length < CRUX_MIN_RESOLUTION_CRITERIA) {
    failures.push(`Insufficient resolution criteria (need ≥${CRUX_MIN_RESOLUTION_CRITERIA})`)
  }
  // Check criteria are concrete (not vibes)
  const vagueKeywords = ['probably', 'might', 'seems', 'feels', 'generally']
  for (const criterion of crux.resolutionCriteria) {
    if (vagueKeywords.some(kw => criterion.toLowerCase().includes(kw))) {
      failures.push(`Resolution criterion too vague: "${criterion}"`)
    }
  }

  // Test 3: Decision-relevant (counterfactual test)
  const relevantFlips = Object.values(crux.counterfactual).filter(c => c.wouldFlip)
  if (relevantFlips.length < 2) {
    failures.push("Not decision-relevant (need ≥2 agents whose conclusion would flip)")
  }

  return { valid: failures.length === 0, failures }
}
```

**Bad Crux Example**:
```json
{
  "question": "Is Bitcoin volatile?",
  "positions": {
    "saylor": { "side": "YES", "confidence": 0.9 },
    "hayes": { "side": "YES", "confidence": 0.8 }
  },
  "resolutionCriteria": ["Price movements", "Market sentiment"],
  "counterfactual": {
    "saylor": { "wouldFlip": false, "why": "Volatility doesn't affect my thesis" }
  }
}

Validation result:
✗ No real disagreement (both YES)
✗ Resolution criteria too vague ("Market sentiment")
✗ Not decision-relevant (only 0 agents would flip)
→ REJECTED
```

**Good Crux Example**:
```json
{
  "question": "Will Bitcoin's volatility prevent institutional adoption within 5 years?",
  "positions": {
    "saylor": { "side": "NO", "confidence": 0.9 },
    "hayes": { "side": "YES", "confidence": 0.8 }
  },
  "resolutionCriteria": [
    "SEC approval of spot Bitcoin ETF",
    "Sovereign wealth fund allocation >$1B",
    "30-day rolling volatility <20% for 6 consecutive months"
  ],
  "counterfactual": {
    "saylor": { "wouldFlip": true, "why": "If volatility persists, my adoption thesis breaks" },
    "hayes": { "wouldFlip": true, "why": "If volatility drops, institutions will allocate" }
  }
}

Validation result:
✓ Real disagreement (NO vs YES)
✓ 3 concrete resolution criteria
✓ Decision-relevant (2 agents would flip)
→ ACCEPTED
```

---

### Coalition Detection (Prevent Noise)

```typescript
// Wait for sufficient data before clustering
const COALITION_MIN_CRUXES = 3           // ≥3 converged cruxes before detecting coalitions
const COALITION_MIN_POSITIONS = 3        // Agent must have ≥3 positions to be included
const COALITION_SIMILARITY_THRESHOLD = 0.7  // Jaccard similarity threshold for clustering
```

**Weighted Similarity** (not raw Jaccard):

```typescript
function computeCoalitionSimilarity(
  agent1Positions: Map<CruxId, CruxPosition>,
  agent2Positions: Map<CruxId, CruxPosition>,
  cruxes: Map<CruxId, ThreadCrux>
): number {
  let totalWeight = 0
  let agreementWeight = 0

  for (const [cruxId, pos1] of agent1Positions) {
    const pos2 = agent2Positions.get(cruxId)
    if (!pos2) continue  // Not both agents have position on this crux

    const crux = cruxes.get(cruxId)
    const cruxWeight = crux.confidence  // Weight by crux quality

    totalWeight += cruxWeight

    // Agreement score (YES=YES or NO=NO scores 1.0, UNCERTAIN=anything scores 0.5)
    if (pos1.side === pos2.side && pos1.side !== 'UNCERTAIN') {
      agreementWeight += cruxWeight
    } else if (pos1.side === 'UNCERTAIN' || pos2.side === 'UNCERTAIN') {
      agreementWeight += cruxWeight * 0.5
    }
    // else: disagreement scores 0
  }

  return totalWeight > 0 ? agreementWeight / totalWeight : 0
}
```

---

### Cross-Thread Dependencies (Conservative)

**Problem**: "If Crux A is YES, then Crux B must be NO" is hard to infer reliably.

**Solution**: Only add dependency if:

```typescript
const DEPENDENCY_MIN_CONFIDENCE = 0.8     // LLM must be ≥80% confident
const DEPENDENCY_REQUIRES_ENTAILMENT = true  // Must provide formal logic sketch
const DEPENDENCY_REQUIRES_VALIDATION = true  // Second model or agent must agree
```

**Dependency Extraction**:

```typescript
interface CruxDependency {
  fromCrux: CruxId
  toCrux: CruxId
  type: 'ENTAILS' | 'CONTRADICTS' | 'SUPPORTS'
  entailmentSketch: string          // 1-2 step formal reasoning
  confidence: number                // 0-1
  validated: boolean                // Second model/agent confirmed
}

function extractDependency(crux1: ThreadCrux, crux2: ThreadCrux): CruxDependency | null {
  // LLM call asking for formal entailment
  const result = await llmExtractDependency(crux1, crux2)

  if (result.confidence < DEPENDENCY_MIN_CONFIDENCE) {
    return null  // Too uncertain
  }

  if (!result.entailmentSketch || result.entailmentSketch.length < 20) {
    return null  // No formal reasoning provided
  }

  // Validation: second model check
  const validation = await llmValidateDependency(crux1, crux2, result.entailmentSketch)
  if (!validation.agrees) {
    return null  // Second model disagrees
  }

  return {
    ...result,
    validated: true
  }
}
```

---

### Moderator Crux Protocol (Convergence Forcing)

**Problem**: Threads don't naturally converge in 12 messages. Agents orbit without committing.

**Solution**: Moderator detects orbiting and injects explicit crux-forcing prompts.

```typescript
// Detect when thread is orbiting (not converging)
function isThreadOrbiting(thread: Thread): boolean {
  const recentMoves = thread.messages.slice(-8).map(m => m.move)

  // Sign 1: No CONCEDE or PROPOSE_CRUX in last 8 messages
  if (!recentMoves.includes('CONCEDE') && !recentMoves.includes('PROPOSE_CRUX')) {
    // Sign 2: High repetition (same keywords appearing repeatedly)
    const keywords = thread.messages.slice(-8).flatMap(m => extractKeywords(m.content))
    const uniqueKeywords = new Set(keywords)
    const repetitionRatio = keywords.length / uniqueKeywords.size

    if (repetitionRatio > 2.0) {  // Same keywords recycled
      return true
    }
  }

  return false
}

// Moderator intervention types
enum ModeratorIntervention {
  HORIZON_ALIGNMENT = 'horizon',     // "10-year horizon, not next quarter"
  COMMIT_REQUEST = 'commit',         // "YES or NO, no hedging"
  FALSIFIER_REQUEST = 'falsifier',   // "What would change your mind?"
  BINARY_FRAMING = 'binary',         // "The real question is X vs Y"
}

function injectModeratorPrompt(thread: Thread, intervention: ModeratorIntervention): Message {
  const prompts = {
    horizon: `Let's align on time horizon. We're talking ${getThreadHorizon(thread)} horizon, not short-term noise. Does that change your position?`,

    commit: `Time to commit. ${thread.binaryQuestion || thread.topic} - YES or NO? One sentence why, and one falsifier (what evidence would prove you wrong).`,

    falsifier: `What specific evidence would change your mind on this? Be concrete.`,

    binary: `I think the core question is: ${generateBinaryQuestion(thread)}. Do you agree that's the real crux?`
  }

  return {
    id: `moderator-${Date.now()}`,
    agentId: 'MODERATOR',
    content: prompts[intervention],
    move: 'CLARIFY',
    threadId: thread.id,
    timestamp: Date.now()
  }
}
```

**Intervention Triggers**:

| Condition | Intervention | Timing |
|-----------|-------------|--------|
| Thread ≥12 messages, no convergence signal | HORIZON_ALIGNMENT | After 12 messages |
| Thread orbiting (repetition ratio >2.0) | COMMIT_REQUEST | After detecting orbit |
| Agents have committed but no falsifiers | FALSIFIER_REQUEST | After commit |
| Thread ≥20 messages, still no crux | BINARY_FRAMING | After 20 messages |

**Example Sequence**:

```
t=40s: Thread has 12 messages, agents discussing correlation
       Moderator detects: no CONCEDE, high keyword repetition ("correlation" appears 8 times)
       → Inject HORIZON_ALIGNMENT

Moderator: "Let's align on time horizon. We're talking 10-year horizon, not quarterly noise.
            Does that change your position?"

t=45s: Agents respond with adjusted positions
       Moderator injects COMMIT_REQUEST

Moderator: "10-year horizon. Is Bitcoin a risk asset (YES) or safe haven (NO)?
            One reason + one falsifier."

t=52-58s: Agents commit with falsifiers

t=60s: Crystallization runs, extracts crux with counterfactuals
       Crux validates ✓ (has YES/NO split, concrete falsifiers)
       Thread converges
```

**Why This Works**:

- **Horizon alignment** eliminates talking-past (one agent thinking years, another thinking months)
- **Commit request** forces binary choice, not hedging
- **Falsifier request** provides counterfactual automatically (what would flip you?)
- **Binary framing** reframes confused discussion into crisp dispute

**Implementation Note**: This is NOT turn-based control. Moderator only injects when thread is stuck. Most of the time, agents drive conversation naturally.

---

### Design Decisions (Resolved)

**Q: When do agents stop responding?**
**A**: Cooldown (6-12s random) + position-based decay (reduce engagement after position crystallized).

**Q: How to handle 3-way disagreements?**
**A**: Split into 2 binary threads. Real cruxes are binary.

**Q: What if no cruxes emerge?**
**A**: Early detection (first 20 messages, check for CHALLENGE moves) → inject devil's advocate agent.

**Q: Embedding model?**
**A**: v0 uses no embeddings (keyword matching only). v1+ uses Voyage-3 (already integrated).

**Q: Visualize crux graph?**
**A**: Table view (v0), then hierarchical tree (v1).

---

## Next Steps

To implement this architecture:

1. **Validate design**: Review this spec, identify gaps
2. **Prototype core loop**: Build message bus + agent loop for 2 agents (prove async works)
3. **Add 3rd agent**: Test attention scoring and thread partitioning
4. **Implement Level 1 crystallization**: Per-thread crux extraction
5. **Build basic UI**: Multi-column thread view
6. **Scale to 5+ agents**: Test coalition detection and global synthesis
7. **Polish**: Add crux map visualization, improve prompts

**Estimated timeline**: 3-4 weeks for full implementation.

**Critical path**: Message bus → agent loop → attention scorer → thread manager → crystallization

---

## Success Criteria

✅ **Multi-agent conversations**: 5+ agents engage simultaneously without forced turns

✅ **Parallel threads**: ≥2 threads active concurrently on different sub-topics

✅ **Attention-based**: Agents only respond to relevant messages (≥60% of responses have attention score ≥0.7)

✅ **Crux discovery**: Irreducible cruxes identified in <5 minutes

✅ **Coalition formation**: Agent clusters correctly identified (validated by human review)

✅ **No fake consensus**: Polarized debates report as "polarized", not "consensus"

✅ **Scalability**: System handles 8-12 agents without performance degradation

✅ **Cost-effective**: <$2 per multi-agent debate

✅ **Self-correcting**: Agents can challenge crystallized cruxes, system re-extracts

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Attention scoring too permissive** | All agents respond to everything, message flood | Tune threshold up, add cooldown periods |
| **Attention scoring too strict** | Agents miss relevant messages, threads die | Lower threshold, boost thread participation weight |
| **Threads fragment too much** | 10+ threads, none converge | Limit max concurrent threads (e.g., 4), force merges |
| **Agents don't concede** | No convergence, circular arguments | Stronger persona prompts, explicit concession rewards |
| **Crystallizer misses cruxes** | Poor quality output | Validation loop (agents review), multi-model verification |
| **Coalition detection fails** | Wrong clusters | Manual review mode, human-in-the-loop for coalition naming |
| **Cost explosion with many agents** | >$5 per debate | Message limits per agent, Haiku for dialogue (Sonnet for crystallization) |

---

## Appendix: Sample Run (With Stage Gates & DCG)

**Topic**: "Bitcoin is a good store of value"

**Agents**: Michael Saylor, Arthur Hayes, Nassim Taleb, Peter Schiff, Jack Mallers (5 agents)

**Timeline** (with stage enforcement + DCG-based crux selection):

```
═══════════════════════════════════════════════════════════════════════════════
PHASE 1: DISCOVERY (Thread 1)
Goal: Find candidate binary crux
Budget: 8 messages
═══════════════════════════════════════════════════════════════════════════════

t=0s: Debate starts
      Thread 1 created: "Is Bitcoin a store of value?"
      Status: DISCOVERY stage (8 message budget)

t=2s: Saylor (CLAIM, Thread 1)
  "Bitcoin is superior to gold. Fixed supply, decentralized, unseizable."
  meta: { horizon: '10y+', confidence: 0.95 }

t=5s: Hayes (CHALLENGE, Thread 1)
  "Nasdaq correlation destroys that. It's a levered tech trade."
  meta: { horizon: '12-18mo', confidence: 0.8 }

t=8s: Schiff (CHALLENGE, Thread 1)
  "Neither. No intrinsic value means it's pure speculation."
  meta: { horizon: '10y+', confidence: 0.9 }

t=11s: Moderator detects horizon mismatch (Hayes 12-18mo vs others 10y+)
  Injects: "Let's align horizons. We're debating 10-year behavior, not quarterly trades."

t=14s: Hayes (CLARIFY)
  "Fair. Over 10 years, I still think it behaves like duration/tech."

t=17s: Taleb (REFRAME)
  "The real question: is this a risk asset or an anti-fragile hedge?"

t=20s: Mallers (PROPOSE_CRUX)
  "Binary question: Is Bitcoin's long-term behavior more like a risk asset (YES) or
   safe haven/hedge (NO)?"
  meta: { horizon: '10y+' }

t=23s: Thread 1 DISCOVERY complete (7 messages)
      Binary question proposed: "Risk asset vs safe haven?"
      Participants: Saylor, Hayes, Taleb, Mallers (4 agents)
      → Stage transition to CRUX_LOCK

═══════════════════════════════════════════════════════════════════════════════
PHASE 2: CRUX_LOCK (Thread 1) - FIRST ATTEMPT (FAILS)
Goal: Get commitments + steelmans + falsifiers
Budget: 6 messages
═══════════════════════════════════════════════════════════════════════════════

t=25s: Moderator injects CRUX_LOCK prompt
  "Crux: Is Bitcoin a risk asset (YES) or hedge (NO)? Commit with falsifier."

t=28s: Saylor (COMMIT_POSITION)
  "NO. It's anti-fragile."
  meta: {
    side: 'NO',
    confidence: 0.9,
    horizon: '10y+',
    falsifier: {
      metric: 'Performance during equity crash',
      threshold: 'Drops >50% when SPY drops >30%',
      deadline: 'Next market crash (2025-2030)',
      reasoning: 'Would prove it's correlated risk asset'
    }
  }

t=31s: Hayes (COMMIT_POSITION)
  "YES. It's a duration trade."
  meta: {
    side: 'YES',
    confidence: 0.85,
    horizon: '10y+',
    falsifier: {
      metric: '10-year correlation with Nasdaq',
      threshold: 'Correlation drops below 0.3',
      deadline: '2034-12-31',
      reasoning: 'Would show true decorrelation'
    }
  }

t=34s: System checks lock criteria
  ✓ ≥2 commitments (Saylor, Hayes)
  ✓ Both sides present (YES, NO)
  ✗ Steelman pairs not completed (Hayes must steelman Saylor, Saylor must steelman Hayes)
  ✗ Taleb & Mallers haven't committed
  → Lock FAILED (attempt 1/2)

t=36s: Moderator injects steelman request
  "Before continuing: Saylor, steelman Hayes's position. Hayes, steelman Saylor's."

t=39s: Saylor (STEELMAN, targeting Hayes)
  "Hayes argues Bitcoin is a duration asset like tech stocks, falsified by decorrelation."
  meta: {
    steelmanTarget: 'hayes',
    claimRepresented: 'Bitcoin is a duration/risk asset',
    strongestReason: 'High correlation with Nasdaq 2020-2024',
    falsifierRepresented: { metric: '10y correlation', threshold: '<0.3', deadline: '2034' }
  }

t=42s: Hayes (GRADE_STEELMAN)
  "Accurate."
  meta: { steelmanGrade: 'ACCURATE' }
  → Saylor can now CHALLENGE Hayes

t=45s: Hayes (STEELMAN, targeting Saylor)
  "Saylor says Bitcoin is digital gold, safe haven, falsified if it crashes with equities."
  meta: { steelmanTarget: 'saylor', ... }

t=48s: Saylor (GRADE_STEELMAN)
  "Incomplete. My point is about systemic collapse, not just equity drawdowns."
  meta: { steelmanGrade: 'INCOMPLETE', corrections: 'Emphasis on sovereign debt crisis' }
  → Hayes must retry

t=51s: Budget exhausted (6 messages in CRUX_LOCK)
       Lock FAILED (attempt 2/2)
       Moderator forces binary framing

═══════════════════════════════════════════════════════════════════════════════
PHASE 3: CRUX_LOCK (Thread 1) - SECOND ATTEMPT (SUCCEEDS)
Extended budget: +4 messages
═══════════════════════════════════════════════════════════════════════════════

t=54s: Hayes (STEELMAN retry, targeting Saylor)
  "Saylor: Bitcoin is anti-fragile store of value. Thrives in sovereign debt crisis.
   Falsified if it sells off during that scenario."
  meta: { steelmanTarget: 'saylor', ... }

t=57s: Saylor (GRADE_STEELMAN)
  "Accurate."
  meta: { steelmanGrade: 'ACCURATE' }
  → Hayes can now CHALLENGE Saylor

t=60s: Taleb (COMMIT_POSITION)
  "UNCERTAIN. Need more crises to know."
  meta: { side: 'UNCERTAIN', confidence: 0.6, horizon: '10y+', falsifier: null }

t=63s: Mallers (COMMIT_POSITION)
  "NO, same as Saylor. Bitcoin is non-sovereign money."
  meta: { side: 'NO', confidence: 0.85, ... }

t=66s: System checks lock criteria
  ✓ ≥2 commitments (4 total)
  ✓ Both sides present (Saylor+Mallers=NO, Hayes=YES, Taleb=UNCERTAIN)
  ✓ Required steelmans passed (Saylor ↔ Hayes both ACCURATE)
  ✓ All non-UNCERTAIN agents have falsifiers
  → Lock SUCCEEDED!
  → LockedCrux created, stage transition to EVIDENCE

═══════════════════════════════════════════════════════════════════════════════
PHASE 4: EVIDENCE (Thread 1)
Goal: Test falsifiers with data
Budget: 14 messages
═══════════════════════════════════════════════════════════════════════════════

t=70s: Hayes (PROVIDE_EVIDENCE)
  "2020-2023: BTC/Nasdaq correlation was 0.78. Clear risk-on behavior."
  meta: {
    evidenceLink: 'https://tradingview.com/btc-ndx-corr',
    targetFalsifier: { agentId: 'saylor', ... }
  }

t=74s: Saylor (CHALLENGE_EVIDENCE)
  "That's a bull market. What about March 2020 crash? BTC bottomed first, equities followed."
  → steelman already passed, challenge allowed

t=78s: Taleb (PROVIDE_EVIDENCE)
  "March 2020 isn't a sovereign debt crisis. It's a liquidity event. Different tail."

t=82s: Mallers (PROVIDE_EVIDENCE)
  "El Salvador, Swiss pension funds—adoption happening. Long-term view matters."

t=86s: Hayes (UPDATE_POSITION)
  "Concede March 2020 point, but doesn't flip me. Still say it's duration trade."
  meta: {
    priorPosition: 'YES',
    newPosition: 'YES',  // No flip
    topClaimChanged: false,
    concededProposition: 'BTC bottomed before equities in March 2020'
  }

t=90-110s: (Evidence debate continues, 6 more messages)

t=114s: Evidence phase budget exhausted (14 messages)
        No position flips occurred
        System crystallizes final crux

═══════════════════════════════════════════════════════════════════════════════
PHASE 5: CRYSTALLIZATION (Thread 1)
═══════════════════════════════════════════════════════════════════════════════

t=118s: Thread 1 crystallization runs

  Final Crux: "Is Bitcoin's long-run behavior more like a risk asset or hedge?"

  Positions (after evidence):
    Saylor: NO (0.9) - "Anti-fragile, sovereign crisis hedge"
      Falsifier: { metric: 'Performance in equity crash', threshold: 'Drops >50% w/ SPY' }
      Concessions: ["March 2020 was liquidity event, not debt crisis"]

    Hayes: YES (0.85) - "Duration trade correlated with tech"
      Falsifier: { metric: '10y Nasdaq correlation', threshold: '<0.3' }
      Concessions: ["BTC bottomed before equities in March 2020"]

    Taleb: UNCERTAIN (0.6) - "Need more tail events"
    Mallers: NO (0.85) - "Non-sovereign money, hedge by design"

  Resolution criteria:
    - Performance during next equity drawdown >30%
    - 10-year rolling correlation with Nasdaq (2024-2034)
    - Behavior during sovereign debt crisis

  Counterfactual (who would flip TopClaim?):
    Saylor: YES (confidence 0.9) - "If risk asset, store-of-value thesis fails"
    Hayes: YES (confidence 0.85) - "If hedge, my macro framework is wrong"
    Taleb: NO (needs more data)
    Mallers: YES (confidence 0.8) - "If pure risk asset, adoption narrative breaks"

  DCG Calculation:
    Coverage: 3/5 agents would flip TopClaim = 0.60
    Polarity: 2 YES vs 2 NO = 2*min(2,2)/4 = 1.0 (perfect split!)
    Impact: avg(0.9, 0.85, 0.8) = 0.85
    **DCG Score: 0.60 × 1.0 × 0.85 = 0.51**

  ✓ Validation PASSED
  → Crux promoted to global dispute queue (DCG=0.51)

═══════════════════════════════════════════════════════════════════════════════
PARALLEL: Thread 2 Spawns (Institutional Adoption)
═══════════════════════════════════════════════════════════════════════════════

t=30s: During Thread 1 DISCOVERY, Mallers mentions adoption
  "Institutions need regulatory clarity"
  → Candidate thread created, pending second bite

t=45s: Schiff bites
  "Institutions won't touch it without government approval, which defeats the point"
  → Thread 2 spawned: "Will institutions adopt Bitcoin within 5 years?"

t=50-90s: Thread 2 goes through DISCOVERY → CRUX_LOCK → EVIDENCE

t=95s: Thread 2 crystallizes

  Final Crux: "Will institutions allocate >1% AUM to Bitcoin by 2029?"

  Positions:
    Saylor: YES (0.95), Mallers: YES (0.8), Hayes: NO (0.7), Schiff: NO (0.9)

  DCG Calculation:
    Coverage: 2/5 agents (only Mallers & Hayes would flip TopClaim) = 0.40
    Polarity: 2 YES vs 2 NO = 1.0
    Impact: avg(0.8, 0.7) = 0.75
    **DCG Score: 0.40 × 1.0 × 0.75 = 0.30**

  ✓ Validation PASSED
  → Crux added to queue (DCG=0.30, lower than Thread 1)

═══════════════════════════════════════════════════════════════════════════════
CRUX SELECTION: DCG-Based Promotion
═══════════════════════════════════════════════════════════════════════════════

t=120s: Agenda Manager selects active dispute

  Candidate cruxes:
    - Thread 1: "Risk asset vs hedge?" — DCG=0.51 ← SELECTED (max DCG)
    - Thread 2: "Institutional adoption?" — DCG=0.30

  → Thread 1 crux promoted to active dispute
  → Attention boost: messages about "risk asset", "hedge", "correlation" get +0.2 score

═══════════════════════════════════════════════════════════════════════════════
GLOBAL SYNTHESIS
═══════════════════════════════════════════════════════════════════════════════

t=125s: All threads converged

  Common ground:
    - "Bitcoin supply capped at 21M" (all: YES)
    - "High correlation with tech 2020-2023" (all: YES)

  Irreducible cruxes (ranked by DCG):
    1. Asset identity (risk vs hedge) — DCG=0.51 ★ PRIMARY CRUX
    2. Institutional adoption timeline — DCG=0.30

  Coalitions:
    - {Saylor, Mallers}: "Bitcoin Fundamentalists"
      Shared: NO on risk asset, YES on adoption
    - {Hayes}: "Macro Bear" (YES on risk asset)
    - {Schiff}: "Gold Standard Advocate" (rejects entire premise)
    - {Taleb}: Uncommitted (UNCERTAIN across both cruxes)

  Regime: POLARIZED
    2 irreducible cruxes, 2 common ground facts
    Deep disagreement on asset identity (primary crux)

t=130s: Debate complete
```

**Final Output**:
```json
{
  "topic": "Bitcoin is a good store of value",
  "duration": 130000,
  "totalMessages": 52,
  "threads": [
    {
      "id": "thread-1",
      "topic": "Asset identity: risk vs hedge",
      "stages": {
        "discovery": { "messages": 7, "duration": 23000 },
        "cruxLock": { "messages": 12, "duration": 43000, "lockAttempts": 2 },
        "evidence": { "messages": 14, "duration": 44000 }
      },
      "participants": ["michael-saylor", "arthur-hayes", "nassim-taleb", "jack-mallers"],
      "crux": {
        "question": "Is Bitcoin's long-run behavior more like a risk asset (YES) or hedge (NO)?",
        "positions": {
          "michael-saylor": {
            "side": "NO",
            "confidence": 0.9,
            "statement": "Anti-fragile sovereign crisis hedge",
            "falsifier": {
              "metric": "Performance during equity crash",
              "threshold": "Drops >50% when SPY drops >30%",
              "deadline": "Next market crash (2025-2030)"
            },
            "concessions": ["March 2020 was liquidity event, not debt crisis"]
          },
          "arthur-hayes": {
            "side": "YES",
            "confidence": 0.85,
            "statement": "Duration trade correlated with tech",
            "falsifier": {
              "metric": "10-year Nasdaq correlation",
              "threshold": "Correlation drops below 0.3",
              "deadline": "2034-12-31"
            },
            "concessions": ["BTC bottomed before equities in March 2020"]
          },
          "nassim-taleb": {
            "side": "UNCERTAIN",
            "confidence": 0.6,
            "statement": "Need more tail events to determine"
          },
          "jack-mallers": {
            "side": "NO",
            "confidence": 0.85,
            "statement": "Non-sovereign money, hedge by design"
          }
        },
        "resolutionCriteria": [
          "Performance during next equity drawdown >30%",
          "10-year rolling correlation with Nasdaq (2024-2034)",
          "Behavior during sovereign debt crisis"
        ],
        "counterfactual": {
          "michael-saylor": { "wouldFlip": true, "why": "If risk asset, store-of-value thesis fails" },
          "arthur-hayes": { "wouldFlip": true, "why": "If hedge, my macro framework is wrong" },
          "nassim-taleb": { "wouldFlip": false, "why": "Need more data regardless" },
          "jack-mallers": { "wouldFlip": true, "why": "If pure risk asset, adoption narrative breaks" }
        },
        "dcg": {
          "coverage": 0.60,
          "polarity": 1.0,
          "impact": 0.85,
          "score": 0.51
        },
        "horizonByAgent": {
          "michael-saylor": "10y+",
          "arthur-hayes": "10y+",
          "nassim-taleb": "10y+",
          "jack-mallers": "10y+"
        },
        "dominantHorizon": "10y+",
        "steelmanPairs": [
          {
            "from": "michael-saylor",
            "to": "arthur-hayes",
            "grade": "ACCURATE",
            "attempts": 1
          },
          {
            "from": "arthur-hayes",
            "to": "michael-saylor",
            "grade": "ACCURATE",
            "attempts": 2
          }
        ],
        "validated": true
      }
    },
    {
      "id": "thread-2",
      "topic": "Institutional adoption timeline",
      "stages": {
        "discovery": { "messages": 6, "duration": 18000 },
        "cruxLock": { "messages": 8, "duration": 25000, "lockAttempts": 1 },
        "evidence": { "messages": 10, "duration": 32000 }
      },
      "participants": ["michael-saylor", "jack-mallers", "arthur-hayes", "peter-schiff"],
      "crux": {
        "question": "Will institutions allocate >1% of AUM to Bitcoin by 2029?",
        "positions": {
          "michael-saylor": { "side": "YES", "confidence": 0.95 },
          "jack-mallers": { "side": "YES", "confidence": 0.8 },
          "arthur-hayes": { "side": "NO", "confidence": 0.7 },
          "peter-schiff": { "side": "NO", "confidence": 0.9 }
        },
        "resolutionCriteria": [
          "Spot ETF AUM reaches $100B by 2029",
          "Sovereign wealth fund allocation >$1B",
          ">5 Fortune 500 companies disclose BTC treasury"
        ],
        "counterfactual": {
          "jack-mallers": { "wouldFlip": true, "why": "If institutions don't adopt, Bitcoin stays niche" },
          "arthur-hayes": { "wouldFlip": true, "why": "If institutions pile in, macro narrative changes" }
        },
        "dcg": {
          "coverage": 0.40,
          "polarity": 1.0,
          "impact": 0.75,
          "score": 0.30
        },
        "validated": true
      }
    }
  ],
  "commonGround": [
    {
      "statement": "Bitcoin's supply is algorithmically capped at 21 million",
      "agreement": "all",
      "type": "factual"
    },
    {
      "statement": "Bitcoin exhibited high correlation with tech stocks during 2020-2023 period",
      "agreement": "all",
      "type": "empirical"
    }
  ],
  "coalitions": [
    {
      "members": ["michael-saylor", "jack-mallers"],
      "label": "Bitcoin Fundamentalists",
      "positions": {
        "thread-1": "NO",
        "thread-3": "YES"
      },
      "sharedBeliefs": [
        "Network effects replace intrinsic value",
        "Institutional adoption is inevitable"
      ]
    },
    {
      "members": ["arthur-hayes", "nassim-taleb"],
      "label": "Macro Skeptics",
      "positions": {
        "thread-1": "YES/UNCERTAIN",
        "thread-2": "YES/UNCERTAIN"
      },
      "sharedBeliefs": [
        "Bitcoin behaves like a risk asset currently",
        "Skeptical of deterministic adoption narratives"
      ]
    },
    {
      "members": ["peter-schiff"],
      "label": "Gold Standard Advocate",
      "positions": {
        "thread-1": "YES"
      },
      "sharedBeliefs": [
        "Commodity backing required for sound money"
      ]
    }
  ],
  "regime": "polarized",
  "regimeDescription": "3 irreducible cruxes, 2 common ground facts, deep disagreement on fundamentals",
  "irreducibleCruxes": ["thread-1", "thread-2", "thread-3"],
  "primaryCrux": "thread-1",
  "primaryCruxReason": "Highest DCG score (0.51), explains most disagreement",
  "cost": 0.52,
  "systemMetrics": {
    "messagesBlocked": 4,
    "reasonsBlocked": {
      "stageRestriction": 2,
      "steelmanRequired": 1,
      "agentCooldown": 1
    },
    "cruxLockAttempts": 3,
    "cruxLockSuccesses": 2,
    "cruxLockFailures": 1,
    "failureReasons": {
      "steelmanNotPassed": 1
    },
    "steelmanAttempts": 4,
    "steelmanRetries": 1,
    "steelmanAccuracyRate": 0.75,
    "dcgPromotions": 1,
    "horizonMismatches": 1,
    "horizonAlignments": 1
  }
}
```

**Key Crux-Forcing Behaviors Demonstrated**:

### 1. **Stage-Based Pipeline (DISCOVERY → CRUX_LOCK → EVIDENCE)**
   - **t=0-23s**: DISCOVERY phase - agents explore topic, propose binary question
   - **t=25-66s**: CRUX_LOCK phase - commitments, steelmans, falsifiers required
   - **t=70-114s**: EVIDENCE phase - data/arguments tied to falsifiers
   - **Result**: Structured convergence, not free-form drift

### 2. **Crux Lock Gate with Hard Requirements**
   - **First attempt fails (t=34s)**: Missing steelmans, incomplete commitments
   - **Second attempt fails (t=51s)**: Steelman graded INCOMPLETE, Hayes must retry
   - **Third attempt succeeds (t=66s)**: All criteria met (commitments, steelmans, falsifiers)
   - **Result**: No shallow cruxes allowed through

### 3. **Steelman-Before-Challenge Protocol**
   - **t=39-42s**: Saylor steelmans Hayes → graded ACCURATE → can now challenge
   - **t=45-48s**: Hayes steelmans Saylor → graded INCOMPLETE → must retry
   - **t=54-57s**: Hayes retry → graded ACCURATE → unlocks challenges
   - **Result**: Forces genuine understanding before debate

### 4. **Structured Falsifiers (Concrete, Testable)**
   - Saylor: "Drops >50% when SPY drops >30%" (not "probably correlated")
   - Hayes: "10-year correlation <0.3 by 2034" (not "will decorrelate")
   - **Result**: Falsifiers are measurable, not vibes

### 5. **DCG-Based Crux Selection (Maximize Disagreement)**
   - Thread 1 DCG: **0.51** (coverage=0.60, polarity=1.0, impact=0.85)
   - Thread 2 DCG: **0.30** (coverage=0.40, polarity=1.0, impact=0.75)
   - **Thread 1 promoted** to primary crux (explains most disagreement)
   - **Result**: System optimizes for compression, not convergence

### 6. **Horizon Normalization (Prevents Talking Past)**
   - **t=11s**: Moderator detects Hayes at 12-18mo, others at 10y+
   - **t=14s**: Hayes aligns to 10y+ horizon
   - **Result**: Agents debate same timeframe, not different games

### 7. **Concession Tracking (No Fake Agreement)**
   - **t=86s**: Hayes concedes "March 2020 was liquidity event"
   - But **topClaimChanged=false** (doesn't flip his YES position)
   - **Result**: System tracks what actually moved vs cheap agreement

### 8. **Position Updates with Evidence**
   - Saylor and Hayes both concede points during evidence phase
   - But neither flips position (confidence adjusts, not side)
   - **Result**: Evidence refined understanding, didn't resolve crux (authentic polarization)

### 9. **System Metrics Prove Enforcement**
   - 2 messages blocked for stage restrictions
   - 1 message blocked for missing steelman
   - 3 crux lock attempts (1 success after 2 failures)
   - 75% steelman accuracy rate (1 retry needed)
   - **Result**: Mechanics are enforced, not aspirational

---

## Comparison: Original vs Crux-Forcing Architecture

| Aspect | Original Spec | Crux-Forcing Spec |
|--------|---------------|-------------------|
| **Thread flow** | Free-form → crystallization | DISCOVERY → CRUX_LOCK → EVIDENCE (staged) |
| **Crux quality** | LLM extracts after 12+ messages | Hard gates: steelman + falsifiers + DCG validation |
| **Understanding check** | Assumed from dialogue | Steelman protocol (must pass ACCURATE before challenge) |
| **Crux authenticity** | Counterfactual check (post-hoc) | Requires TopClaim linkage + structured falsifiers |
| **Disagreement goal** | Find cruxes | **Maximize DCG** (compress disagreement, not eliminate) |
| **Horizon handling** | Optional metadata | Forced alignment or thread split |
| **Concessions** | Natural dialogue | Structured (must name proposition + TopClaim impact) |
| **Crux selection** | First extracted | **Highest DCG** promoted to active dispute |
| **Lock failures** | N/A | Explicit (moderator intervenes after 2 failures) |
| **Evidence structure** | Free-form | Tied to falsifiers (PROVIDE_EVIDENCE targets specific falsifier) |

**Key Insight**: Original spec would drift to polite consensus because agents naturally avoid confrontation and LLMs hedge. Crux-forcing spec mechanically prevents this by:
1. Requiring explicit disagreement (YES vs NO, not all UNCERTAIN)
2. Forcing understanding (steelman graded ACCURATE)
3. Demanding testable claims (structured falsifiers)
4. Optimizing for disagreement compression (DCG), not convergence

---

## Summary: What Makes This Robust

This spec solves **three core problems** that cause multi-agent debates to fail:

---

### Problem 1: **Maximize Disagreement** (Don't drift to polite consensus)

**Solution**: DCG (Disagreement Compression Gain) as optimization target

✅ **Coverage**: % of agents whose TopClaim depends on crux
✅ **Polarity**: How evenly split YES vs NO (perfect split = 1.0)
✅ **Impact**: Average flip confidence among agents who would flip
✅ **DCG Score** = Coverage × Polarity × Impact

**Crux promotion**: Always select crux with max DCG (explains most disagreement)

**Result**: System rewards finding cruxes that *compress* disagreement into minimal axes, not eliminating it.

---

### Problem 2: **Keep Threads on Actual Cruxes** (Not interesting subtopics or measurement trivia)

**Solution**: Thread stages with CRUX_LOCK gate

✅ **DISCOVERY** (6-10 msgs): Find candidate binary crux
✅ **CRUX_LOCK** (6-8 msgs): Commit + steelman + falsifiers (hard gate)
✅ **EVIDENCE** (12-16 msgs): Debate tied to falsifiers

**Lock criteria**:
- ≥2 agents committed
- Both YES and NO present (not all UNCERTAIN)
- All steelmans graded ACCURATE
- All committed agents have structured falsifiers

**Result**: Cruxes are identity/causal questions (not "will correlation persist?"), with testable falsifiers.

---

### Problem 3: **Ensure Real Understanding** (No fake agreement or talking past)

**Solution**: Steelman protocol + cheap agreement detection

✅ **Steelman-before-challenge**: Can't CHALLENGE until you steelman opponent and receive ACCURATE grade
✅ **Structured concessions**: Must name exact proposition + declare TopClaim impact
✅ **Horizon normalization**: Align timeframes or split thread

**Result**: Agents demonstrate understanding before debating. No "I agree" without substance.

---

### Additional Robustness (Original Spec)

**Message flood prevention**:
- Max 2 replies per message
- 6-12s random cooldown per agent
- 12 messages per 30s thread rate limit

**Thread explosion prevention**:
- Max 4 concurrent threads
- Expensive spawning (2+ agents + binary Q + orthogonality)
- Moderator-controlled in v0

**Crux validation**:
- Counterfactual test (≥2 agents would flip TopClaim)
- Concrete resolution criteria (no vague keywords)
- Self-correction loop (agents can challenge extracted cruxes)

### Additional Robustness Features
- **Agenda Manager**: Light coordination without forced turns, prevents all-threads-stalled
- **Weighted coalition similarity**: Wait for ≥3 cruxes before clustering, ignore UNCERTAIN
- **Conservative dependency extraction**: Require formal entailment + second model validation
- **v0 simplification path**: Get working system fast, add sophistication incrementally

---

## Critical Differences from Original Spec

| Aspect | Original Spec | Hardened Spec |
|--------|--------------|---------------|
| **Reply control** | None | Max 2 per message + cooldowns |
| **Thread spawning** | "But what about X?" triggers spawn | Requires 2 agents + binary Q + orthogonality |
| **Crux validation** | LLM extracts binary question | Must pass 3 robustness tests |
| **Coalition detection** | Jaccard on positions | Weighted similarity, min 3 cruxes |
| **Dependencies** | LLM infers | Conservative: requires entailment sketch + validation |
| **Coordination** | Pure async | Agenda Manager for light coordination |
| **v0 strategy** | Build everything | Defer embeddings, cross-thread, live coalitions |

---

## Implementation Roadmap (Crux-Forcing Architecture)

### Phase 1: Core Infrastructure + Stage Pipeline (Week 1-2)

**Goal**: Get DISCOVERY → CRUX_LOCK → EVIDENCE flow working with 2-3 agents, 1 thread.

**Files to create**:
```
faultline/lib/multi-agent/
├── types.ts                    # All types from this spec
├── message-bus.ts              # Pub/sub + filtering
├── stage-manager.ts            # Thread stage enforcement
├── steelman-tracker.ts         # Track steelman attempts + grades
└── agent-loop.ts               # Agent behavior (keyword attention for v0)
```

**Deliverables**:
- Thread transitions through 3 stages
- Stage gates enforce move restrictions
- Steelman protocol blocks challenges until ACCURATE grade
- Mock 2-3 agents can complete full pipeline

**Test case**: "Bitcoin is digital gold" with 2 opposing agents
- DISCOVERY: 6 messages → binary question proposed
- CRUX_LOCK: 8 messages → commitments, steelmans (1 retry), falsifiers → locked
- EVIDENCE: 12 messages → data debate → converge
- Verify: crux has structured falsifiers, steelman passed, positions recorded

---

### Phase 2: DCG Calculation + Crux Selection (Week 2-3)

**Goal**: Multi-thread with DCG-based crux promotion.

**Files to create**:
```
faultline/lib/multi-agent/
├── dcg-calculator.ts           # Coverage × Polarity × Impact
├── crux-validator.ts           # Authenticity checks (TopClaim linkage)
├── agenda-manager.ts           # Track active disputes, boost attention
└── thread-spawner.ts           # "Second bite" protocol
```

**Deliverables**:
- 2-3 threads run concurrently
- Each thread calculates DCG after CRUX_LOCK
- Highest DCG crux promoted to active dispute
- Attention boost (+0.2) for messages relevant to active dispute

**Test case**: Bitcoin debate with 4 agents, 2 threads
- Thread 1: "Risk asset vs hedge?" → DCG=0.51
- Thread 2: "Institutional adoption?" → DCG=0.30
- Verify: Thread 1 promoted, attention boosted for "risk", "hedge", "correlation" keywords

---

### Phase 3: Level 1 Crystallization + Validation (Week 3-4)

**Goal**: Extract final ThreadCrux from locked crux + evidence phase.

**Files to create**:
```
faultline/lib/multi-agent/crystallization/
├── per-thread.ts               # Level 1 only (defer Level 2/3)
├── prompts.ts                  # Crystallization prompts
└── validation.ts               # Robustness tests (DCG, counterfactual, falsifiers)
```

**Deliverables**:
- After EVIDENCE phase, crystallize final crux
- Validate: real disagreement, concrete falsifiers, DCG ≥ threshold
- Output includes: positions, falsifiers, concessions, DCG breakdown

**Test case**: Verify output matches sample JSON from this spec

---

### Phase 4: Moderator Interventions (Week 4)

**Goal**: Handle failed locks, orbiting threads, horizon mismatches.

**Files to create**:
```
faultline/lib/multi-agent/
├── moderator.ts                # Intervention triggers + prompts
├── horizon-normalizer.ts       # Detect + align horizons
└── lock-failure-handler.ts     # Retry logic, force binary framing
```

**Deliverables**:
- Detect failed locks → moderator injects clarifying prompts
- Detect horizon mismatch → align or split thread
- Detect orbiting (repetition >2.0) → inject commit request

**Test case**: Intentionally create failed lock (steelman not graded) → verify moderator intervention → successful lock on retry

---

### Phase 5: API + Basic UI (Week 5)

**Goal**: SSE endpoint + simple frontend.

**Files to create**:
```
faultline/app/api/debate-multi-v2/route.ts       # SSE endpoint
faultline/components/multi-agent/
├── StageIndicator.tsx          # Show current stage per thread
├── SteelmanStatus.tsx          # Show steelman pairs + grades
├── CruxCard.tsx               # Display locked crux + DCG
└── MultiDebateClient.tsx       # Main orchestrator
```

**SSE events** (new):
- `stage_transition` (DISCOVERY → CRUX_LOCK → EVIDENCE)
- `steelman_attempt` + `steelman_graded`
- `crux_lock_failed` + `crux_locked`
- `dcg_calculated` + `crux_promoted`
- `moderator_intervention`

**UI**:
- Multi-column thread view (one column per thread)
- Stage badges (DISCOVERY / LOCKING / EVIDENCE)
- Steelman pairs table (show grades)
- DCG scores + primary crux indicator

---

### Phase 6: Polish + v1 Enhancements (Week 6+)

**Defer to v1**:
- Embeddings for attention scoring (use Voyage-3)
- Agent-triggered thread spawning (not moderator-only)
- Cross-thread analysis (Level 2 crystallization)
- Live coalition detection (not just post-debate)
- Global synthesis (Level 3)
- Crux map visualization

**v0 → v1 upgrade path**:
- v0: Keyword attention, moderator threads, Level 1 crux, post-debate coalitions
- v1: Embedding attention, agent threads, Level 2/3 crux, live coalitions, crux graph

---

## Estimated Effort

| Phase | Deliverable | Effort | Cumulative |
|-------|-------------|--------|------------|
| 1 | Stage pipeline working | 1.5 weeks | 1.5 weeks |
| 2 | DCG + multi-thread | 1 week | 2.5 weeks |
| 3 | Crystallization + validation | 1 week | 3.5 weeks |
| 4 | Moderator interventions | 0.5 weeks | 4 weeks |
| 5 | API + basic UI | 1 week | 5 weeks |
| 6 | v1 enhancements | 3 weeks | 8 weeks |

**v0 ready**: 5 weeks
**v1 complete**: 8 weeks

---

## Success Criteria (v0)

✅ **Stage enforcement works**: Messages blocked when move not allowed in current stage
✅ **Crux lock gate works**: Lock fails if steelmans not ACCURATE, succeeds when all criteria met
✅ **Steelman protocol works**: Can't challenge until steelman graded ACCURATE
✅ **DCG calculation works**: Correct coverage, polarity, impact scores
✅ **Crux promotion works**: Highest DCG crux becomes active dispute
✅ **Moderator interventions work**: Failed locks trigger clarifying prompts
✅ **Output quality**: Cruxes are identity/causal (not measurement), falsifiers concrete
✅ **No fake agreement**: Concessions must name proposition + TopClaim impact
✅ **Polarized debates stay polarized**: System reports disagreement, not forced consensus

---

**Ready to implement? Start with Phase 1: Core Infrastructure + Stage Pipeline.**
