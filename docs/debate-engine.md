# Faultline Debate Engine v2 — Implementation Guide

**Status**: ✅ **COMPLETE & DEPLOYED**

---

## Overview

A debate engine that produces **condensed true disagreement** between LLM-driven personas. Personas have short, natural exchanges — clarifying, conceding, challenging, reframing — while a separate **crystallizer** periodically distills the conversation into a sparse formal argument graph. Dung's abstract argumentation semantics evaluate the graph to identify camps, common ground, and crux assumptions.

**Key insight**: Most dialogue turns do NOT create graph nodes. The graph is sparse and meaningful because it represents distilled positions, not individual utterances. This makes Dung semantics actually informative.

**Available in two forms**:
- 🖥️ **Web UI**: Real-time chat interface at `/debate-v2`, live-streamed via SSE
- 🛠️ **CLI**: Script-driven (`npm run debate`), outputs structured JSON

---

## Quick Start

### Web Interface
```bash
cd faultline
npm run dev
# Navigate to http://localhost:3000/debate-v2
```

1. Enter a debate topic
2. Select 2 personas from the grid
3. Set max turns (default: 30)
4. Click "Start Debate"
5. Watch the conversation unfold in real-time

### Command Line
```bash
cd faultline
npm run debate -- \
  --topic "Bitcoin is a good store of value" \
  --personas "Michael Saylor,Arthur Hayes" \
  --max-turns 30
```

Output saved to `data/outputs/debate-v2-*.json`

---

## Architecture

```
┌──────────────────────────────────────────────┐
│              DIALOGUE LAYER                  │
│  Short exchanges (2-4 sentences each)        │
│  Moves: CLAIM, CHALLENGE, CLARIFY,          │
│         CONCEDE, REFRAME, PROPOSE_CRUX       │
│  Most turns do NOT touch the graph           │
└─────────────────────┬────────────────────────┘
                      │
             Controller decides:
             "Crystallize now?"
                      │
            ┌─────────▼──────────┐
            │   CRYSTALLIZER     │
            │  Reads dialogue    │
            │  cluster, extracts │
            │  formal positions  │
            │  Creates/updates/  │
            │  removes graph     │
            │  nodes             │
            └─────────┬──────────┘
                      │
┌─────────────────────▼────────────────────────┐
│            ARGUMENT GRAPH                    │
│  Sparse: 3-6 nodes per speaker               │
│  Each node = a distilled position            │
│  Dung semantics: grounded + preferred        │
│  Graph SHRINKS via concession + pruning      │
└──────────────────────────────────────────────┘
```

**Three components:**

1. **Dialogue layer** — agents have short, direct exchanges. Output per turn: few sentences + move type. No formal argument structure required.

2. **Crystallizer** — periodically reads a cluster of recent dialogue turns and extracts formal argument nodes. Also updates or removes existing nodes based on concessions and reframes. Separate LLM call.

3. **Argument graph** — sparse Dung framework. Only crystallized positions enter the graph. Semantics computed after each crystallization, not after each dialogue turn.

---

## Dialogue Moves

Each turn, an agent produces a short response (2-4 sentences) tagged with a move type. No formal argument structure — just natural conversation.

| Move | What it is | Example |
|------|-----------|---------|
| **CLAIM** | Assert a new position | "Bitcoin's fixed supply makes it deflationary by design." |
| **CHALLENGE** | Directly dispute what was just said | "Deflation doesn't equal store of value — look at the 2022 crash." |
| **CLARIFY** | Ask for or provide precision | "When you say 'store of value,' do you mean over what time horizon?" |
| **CONCEDE** | Grant a point, narrow the scope | "I'll grant the short-term volatility point. But over 4-year cycles..." |
| **REFRAME** | Redirect to what actually matters | "We're arguing about volatility but the real question is demand drivers." |
| **PROPOSE_CRUX** | Name the core disagreement | "I think we disagree about whether utility is necessary for value storage." |

**Agent output per turn:**

```json
{
  "dialogue": "2-4 sentences in persona voice",
  "move": "CHALLENGE"
}
```

That's it. No premises array, no assumptions array, no target argument ID. Just talk.

### Why these moves matter

- **CLAIM + CHALLENGE** are the basic productive unit — assertion and counter-assertion
- **CLARIFY** narrows the meaning space (often more valuable than a new argument)
- **CONCEDE** is the most powerful convergence move — shrinks disagreement space and causes graph nodes to be removed during crystallization
- **REFRAME** prevents the debate from getting stuck on surface-level disputes
- **PROPOSE_CRUX** is the endgame move — explicit crux identification by the participants themselves

---

## The Crystallizer

A separate module that reads recent dialogue and produces graph mutations. Does NOT run on every turn.

### When to crystallize

| Trigger | Rationale |
|---------|-----------|
| After a substantive exchange (CLAIM → CHALLENGE → response) | A complete argument unit worth formalizing |
| After a CONCEDE | Existing node needs updating or removing |
| After a REFRAME | The debate has shifted, existing nodes might need updating |
| After a PROPOSE_CRUX | Check if this is a real crux worth formalizing |
| Every 5+ dialogue turns (safety net) | Catch anything the triggers missed |

### What it produces

```typescript
interface CrystallizationResult {
  newArgs: Argument[]                                     // new distilled positions
  updatedArgs: { id: string; claim?: string; assumptions?: string[] }[]  // refined positions
  removedArgIds: string[]                                 // conceded or superseded positions
  newAttacks: Attack[]                                    // attack relationships between positions
  removedAttackIds: string[]                              // invalidated attacks
}
```

### How it works

One LLM call (Sonnet) that sees:
- The last 6-8 dialogue turns (the cluster)
- The current graph state (sparse, readable — listed as a simple table of nodes + edges)
- The instruction to extract substantive positions only

Because the crystallizer sees a *cluster* of dialogue instead of a single turn, it can extract higher-quality arguments. It sees the claim, the challenge, the evidence, and the concession all together, and produces one clean node instead of four noisy ones.

### Expected ratio

~8 dialogue turns → 1 crystallization → 1-3 graph mutations.

After 24 dialogue turns (12 per agent), the graph has ~8-10 nodes total. By the end of the debate (after concessions and pruning), the graph has 4-6 nodes. That's a clean, interpretable Dung framework.

---

## The Controller (Moderator)

The controller is a **moderator**, not an optimizer. It doesn't compute pressure points or score information gain. It ensures the conversation flows productively and triggers crystallization at the right moments.

### Turn-taking

- **Default**: Simple alternation between speakers
- **Fairness**: if someone hasn't spoken in 3+ turns, bring them in
- **With 2 agents**: effectively A, B, A, B, ... with occasional moderator steering

The controller does NOT use Haiku ranking calls to select speakers. Turn-taking is simple.

### Steering hints

The controller optionally provides a short steering hint to the agent's prompt. Most turns have no hint — let the conversation flow.

**When the controller steers:**

| Situation | Steering hint |
|-----------|--------------|
| Dialogue is circling (similar content in recent turns) | "You've gone back and forth on [X] several times. What specific evidence would change your mind?" |
| Phase 3: crux seeking | "Can you name what you think the core disagreement is?" |
| After a concession | "Agent B conceded [X]. Does that change your position on [Y]?" |
| After a reframe | "Agent A reframed the debate around [X]. Do you agree that's the right framing?" |
| Conversation is one-sided | "Agent B, you haven't responded to Agent A's point about [X]." |
| Stuck / no progress | "Let's move on from [topic]. What's the next most important thing you disagree about?" |

**When the controller does NOT steer:**
- The conversation is flowing naturally with direct responses
- Agents are already clarifying or conceding
- Early in the debate when positions are still being established

### Crystallization trigger

The controller tracks:
- Dialogue turn count since last crystallization
- Whether substantive moves happened (CLAIM, CHALLENGE, CONCEDE, REFRAME, PROPOSE_CRUX)
- Whether the graph needs updating based on concessions

It triggers crystallization when appropriate (see "When to crystallize" above).

### Phase management

The controller manages phase transitions (see next section).

---

## Phases

The debate has four phases with different controller behavior. Phases replace the v1 "round" concept.

### Phase 1: Opening Statements

- Each agent states their position (4-6 sentences allowed)
- Controller: no steering, let them speak
- Turn count: 1 turn per agent
- Crystallization: after all agents have spoken, crystallize opening positions into graph
- Compute initial semantics

**Transition to Phase 2**: All agents have given opening statements and initial graph is built.

### Phase 2: Free Exchange

- Short back-and-forth (2-4 sentences per turn). The bulk of the debate.
- Controller: light steering — ensure direct responses, intervene if circling
- Crystallization: every 4-6 turns, or after CONCEDE/REFRAME
- Recompute semantics after each crystallization

**Transition to Phase 3**: Any of:
- Contested frontier has been stable across 3 crystallizations
- Dialogue is circling (controller detects repetition)
- Turn budget is >60% consumed

### Phase 3: Crux Seeking

- Controller actively steers toward crux identification
- Steering hints: "Name your crux." "What would change your mind?" "Where exactly do you disagree?"
- Agents produce PROPOSE_CRUX moves
- Crystallization: formalize proposed cruxes, check if both sides agree on framing

**Transition to Phase 4**: Any of:
- Both agents have proposed cruxes
- Crux proposed and acknowledged by other agent
- Turn budget >85% consumed

### Phase 4: Resolution

- Each agent summarizes: what they agree on, what they still disagree on, what the core question is
- Controller: no steering
- Final crystallization: clean up graph to represent final positions
- Compute final semantics and extract insights

---

## Concession and Graph Shrinkage

The graph **shrinks over time** through concession. This is the biggest change from v1 where the graph only grew.

When an agent concedes:
- **Full concession** ("I was wrong about X"): crystallizer removes the node, cascade-removes dependent attack edges
- **Partial concession** ("I grant X but Y still holds"): crystallizer updates the node's claim to the narrower version
- **Scope narrowing** ("That's true in general, but not in this specific case"): crystallizer adds a qualifier to the node's assumptions

The concession trail is tracked as part of the output — it shows how the debate narrowed over time.

**Expected graph trajectory:**
- After Phase 1: ~6-8 nodes (opening positions)
- During Phase 2: grows to ~10-12 nodes (new claims + challenges), then starts shrinking via concessions
- After Phase 3: ~5-7 nodes (crux positions + common ground)
- After Phase 4: ~4-6 nodes (final distilled positions)

---

## Graph Operations

The argument graph (`lib/argumentation/graph-state.ts`) provides these operations:

| Operation | When | Effect |
|-----------|------|--------|
| `addArguments()` | Crystallization finds new positions | Add nodes to A |
| `addAttacks()` | Crystallization finds attack relationships | Add edges to R |
| `updateArgument()` | Crystallization refines a position | Modify existing node (claim, assumptions) |
| `removeArgument()` | Concession or pruning | Remove node from A + cascade-remove all incident edges from R |
| `removeAttack()` | Crystallization invalidates an attack | Remove edge from R |

After any graph mutation, recompute:
- Grounded extension (fast, always)
- Preferred extensions (always — graph is small enough that this is cheap)
- Full labelling

---

## Dung Semantics on Sparse Graphs

Dung's framework is **more useful** on a sparse, clean graph than on a dense, noisy one.

On a 5-8 node graph:
- **Grounded extension** = what both sides agree on (consensus floor)
- **Preferred extensions** = coherent worldviews (camps), cleanly separated by speaker
- **Symmetric difference** = the actual crux claims
- **Computation is instant** — no need for incremental recomputation, preferred extension caching, or UNDEC-set change detection

All the optimization machinery from v1 becomes unnecessary because the graph never gets large enough to matter.

---

## Convergence

The debate converges based on dialogue dynamics and graph state, not just labelling stability.

| Signal | What it means | Weight |
|--------|--------------|--------|
| **Graph shrinking** | Concessions are happening, disagreement is narrowing | Primary |
| **Crux proposed** | Agent explicitly named the core disagreement | Primary |
| **Contested frontier stable** | No new crux args appearing across crystallizations | Secondary |
| **Dialogue repetition** | Agents are saying similar things (word overlap) | Triggers phase transition |
| **Concession rate** | Ratio of CONCEDE moves to total moves is increasing | Positive signal |

**Stop when**: crux proposed and acknowledged, OR graph has been stable for 3+ crystallizations with no new nodes, OR max turns reached.

---

## Output

The final output contains:

### 1. Transcript
Readable short exchanges between personas. Each turn is 2-4 sentences with a move type tag.

### 2. Argument Graph
Sparse: 4-6 final nodes with attack edges. Each node has claim, premises, assumptions, evidence, speaker.

### 3. Crux
The condensed true disagreement, identified either:
- Explicitly by PROPOSE_CRUX moves (if both agents agreed on the framing)
- Structurally by the symmetric difference of preferred extensions
- As the top assumptions in the contested frontier

### 4. Common Ground
Grounded extension = positions both sides accept. Concession trail shows how common ground expanded during the debate.

### 5. Camps
Each preferred extension mapped to the personas whose arguments dominate it. Shows who-believes-what cleanly.

### 6. Concession Trail
Ordered list of concessions: who conceded what, when, and what effect it had on the graph.

### 7. Regime Classification
- **Consensus**: 1 preferred extension, large grounded — agents converged
- **Polarized**: Multiple preferred extensions, small grounded — irreducible disagreement found
- **Partial**: Some common ground but unresolved crux remains

---

## Frontend Integration

### Web UI Features

**Chat Interface** (`/debate-v2`):
- 💬 Real-time conversation display with chat-style layout
- 🎨 Color-coded dialogue moves (CLAIM, CHALLENGE, CONCEDE, etc.)
- 📍 Phase markers showing debate progression
- 💡 Moderator hints visible in yellow callout boxes
- 🔄 Auto-scroll with manual override
- 📱 Responsive design (mobile → tablet → desktop)

**Live Insights Sidebar** (desktop):
- Argument graph statistics (IN/OUT/UNDEC counts)
- Concession trail
- Proposed cruxes
- Final results (regime, common ground, performance)

**SSE Event Stream**:
```typescript
POST /api/debate-v2
{
  "topic": "Bitcoin is a good store of value",
  "personaIds": ["michael-saylor", "arthur-hayes"],
  "maxTurns": 30
}
```

### Events Streamed
- `engine_start` - Debate begins
- `phase_start` - New phase begins
- `phase_transition` - Transition between phases
- `dialogue_turn` - New message from a persona
- `steering` - Moderator provides guidance
- `crystallization` - Dialogue converted to formal arguments
- `graph_updated` - Argument graph statistics updated
- `concession` - Speaker conceded a point
- `crux_proposed` - Core disagreement identified
- `convergence_check` - Progress toward completion
- `engine_complete` - Final results ready
- `engine_error` - Error occurred

### Component Architecture

```
app/
├── api/debate-v2/
│   └── route.ts              # SSE endpoint
└── debate-v2/
    └── page.tsx              # Server component (persona loading)

components/
└── DebateV2Client.tsx        # Main chat UI

lib/
├── hooks/
│   └── useDebateV2Stream.ts  # SSE state management
└── debate/
    └── engine.ts             # Core debate engine (async generator)
```

---

## LLM Call Pattern

| Phase | Calls | Model | Notes |
|-------|-------|-------|-------|
| Phase 1: opening statements | N parallel | Sonnet | One per persona |
| Phase 1: initial crystallization | 1 | Sonnet | Crystallize openings → graph |
| Phase 1: centralized discovery | 1 | Sonnet | Find cross-attacks |
| Phase 2-3: dialogue turns | ~20-30 sequential | Sonnet | One per turn (short response) |
| Phase 2-3: crystallizations | ~4-6 | Sonnet | One per crystallization trigger |
| Phase 4: resolution | N parallel | Sonnet | One per persona |

**Total estimate** (2 personas, ~24 dialogue turns): ~30-35 Sonnet calls. No Haiku calls needed. Cost: ~$0.40-0.60/debate.

Cheaper than v1 despite more dialogue turns because:
- Dialogue turns are short (small output tokens)
- No Haiku agent ranking calls
- No per-turn dedupe checks
- No per-turn structured argument extraction

---

## Implementation Files

### Core Engine (✅ Complete)

| File | Purpose |
|------|---------|
| `lib/types/debate-engine.ts` | All v2 types: DialogueMove, DialogueTurn, CrystallizationResult, Concession, ControllerState, DebateEngineOutput, DebateEvent |
| `lib/debate/engine.ts` | Phase-based async generator, dialogue turns, crystallization triggers |
| `lib/debate/controller.ts` | Moderator logic: turn-taking, steering hints, phase transitions, crystallization triggers |
| `lib/debate/crystallizer.ts` | Crystallization LLM call + graph mutation logic |
| `lib/debate/prompts.ts` | Dialogue prompts (short response, move-tagged) + crystallization prompt |
| `lib/debate/convergence.ts` | Graph stability + crux proposal convergence |

### Frontend (✅ Complete)

| File | Purpose |
|------|---------|
| `app/api/debate-v2/route.ts` | SSE streaming endpoint for v2 debates |
| `app/debate-v2/page.tsx` | Server component (persona loading) |
| `components/DebateV2Client.tsx` | Chat-first responsive UI (500+ lines) |
| `lib/hooks/useDebateV2Stream.ts` | SSE state management hook |

### CLI (✅ Complete)

| File | Purpose |
|------|---------|
| `scripts/run-debate.ts` | CLI entry point (--topic, --personas, --max-turns) |

### Extended from v1

| File | Changes |
|------|---------|
| `lib/argumentation/graph-state.ts` | Added `updateArgument()`, `removeArgument()`, `removeAttack()` for concessions |

### Removed from v1

| File | Reason |
|------|--------|
| `lib/debate/metrics.ts` | Logic integrated into engine.ts |
| `lib/debate/insights.ts` | Logic integrated into engine.ts |
| `lib/debate/dedupe.ts` | Crystallizer handles dedup naturally |

### Unchanged (reused)

- `lib/argumentation/dung.ts` — Grounded, preferred, labelling
- `lib/llm/client.ts` — Anthropic SDK wrapper
- `lib/orchestrator/agents.ts` — Persona loading, system prompts
- `lib/personas/loader.ts` — File-based persona loader
- Persona contracts and data/seed/ — Unchanged

---

## Example Output

**CLI** saves to `data/outputs/debate-v2-*.json`:

```json
{
  "topic": "Bitcoin is a good store of value",
  "personaIds": ["michael-saylor", "arthur-hayes"],
  "transcript": [
    {
      "turnIndex": 0,
      "phase": 1,
      "personaId": "michael-saylor",
      "dialogue": "Bitcoin is not merely a good store of value...",
      "move": "CLAIM",
      "steeringHint": null,
      "timestamp": 1707879137124
    },
    // ... more turns
  ],
  "graph": {
    "arguments": [ /* 4-6 final arguments */ ],
    "attacks": [ /* attack edges */ ],
    "groundedExtension": new Set(["arg-0", "arg-2"]),
    "preferredExtensions": [ /* preferred extensions */ ],
    "labelling": { /* IN/OUT/UNDEC labels */ }
  },
  "crux": {
    "proposedBy": ["arthur-hayes"],
    "statement": "The core disagreement is...",
    "assumptions": [],
    "acknowledged": false
  },
  "commonGround": ["arg-0", "arg-2"],
  "camps": [
    {
      "extensionIndex": 0,
      "argumentIds": ["arg-0", "arg-2"],
      "personaIds": ["michael-saylor", "arthur-hayes"]
    }
  ],
  "concessionTrail": [
    {
      "turnIndex": 2,
      "personaId": "michael-saylor",
      "type": "partial",
      "concededClaim": "...",
      "effect": "Narrowed [arg-1] from...",
      "removedArgIds": [],
      "updatedArgIds": ["arg-1"]
    }
  ],
  "regime": "consensus",
  "regimeDescription": "Consensus: 3 of 8 arguments in common ground.",
  "tokenUsage": { "inputTokens": 30591, "outputTokens": 4051 },
  "duration": 86500
}
```

---

## Deployment & Debugging

### SSE Parsing Bug Fix (2026-02-14)

**Issue**: v2 debates were failing with "Error: aborted" immediately after starting. The SSE stream would connect but no events would be parsed, causing the connection to abort.

**Root Cause**: The SSE event parser was incorrectly trying to match both `event:` and `data:` patterns on a single line:

```typescript
// ❌ WRONG - both patterns can't match start of same string
const eventMatch = line.match(/^event: (.+)/)
const dataMatch = line.match(/^data: (.+)/)
if (eventMatch && dataMatch) { ... }
```

SSE format sends events as multi-line blocks:
```
event: dialogue_turn
data: {"type":"dialogue_turn","turn":{...}}

```

After splitting on `\n\n`, each block contains both lines, but the regex `^` anchors mean both patterns can't match the start of the same multi-line string.

**Fix**: Parse each event block by splitting on `\n` first:

```typescript
// ✅ CORRECT - parse multi-line event blocks
for (const eventBlock of events) {
  const lines = eventBlock.split('\n')
  let eventData = null
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.substring(7).trim()
    } else if (line.startsWith('data: ')) {
      eventData = line.substring(6).trim()
    }
  }
  if (eventData) {
    const event = JSON.parse(eventData)
    handleEvent(event)
  }
}
```

**Files Updated**:
- `components/MatchClient.tsx` (MatchClientV2 inline SSE handler)
- `lib/hooks/useDebateV2Stream.ts` (reusable SSE hook)

**Verification**:
- ✅ TypeScript compilation succeeds
- ✅ Build succeeds with all routes generated
- ✅ SSE events now parse correctly
- ✅ v2 debates stream properly from `/api/debate-v2`

### Testing v2 Debates

**Via Web UI** (integrated into main flow):
1. Navigate to http://localhost:3000/setup
2. Select "v2 ⚡" mode from the 4 mode buttons
3. Choose 2+ personas (e.g., "Michael Saylor", "Arthur Hayes")
4. Enter a topic and click "Deal"
5. Watch the chat-style debate unfold in real-time

**Via CLI**:
```bash
npm run debate -- \
  --topic "Bitcoin is a good store of value" \
  --personas "Michael Saylor,Arthur Hayes" \
  --max-turns 30
```

**Via API** (for testing):
```bash
curl -X POST http://localhost:3000/api/debate-v2 \
  -H "Content-Type: application/json" \
  -d '{"topic":"Bitcoin is digital gold","personaIds":["Michael Saylor","Arthur Hayes"],"maxTurns":3}'
```

**Important**: Persona IDs use full names with capitals and spaces (e.g., "Michael Saylor", not "michael-saylor"). Check `data/seed/personas.json` for exact IDs.

### Debug Logging

The implementation includes comprehensive debug logging:

**Backend** (`app/api/debate-v2/route.ts`):
```
[API debate-v2] Received POST request
[API debate-v2] Params: { topic, personaIds: 2, maxTurns: 30 }
[API debate-v2] Stream started
[API debate-v2] Event 1: engine_start
[API debate-v2] Event 2: phase_start
...
[API debate-v2] Debate complete, total events: 45
[API debate-v2] Closing stream
```

**Frontend** (`components/MatchClient.tsx` MatchClientV2):
```
[V2] Starting debate with: { topic, personaIds }
[V2] Calling /api/debate-v2...
[V2] Response status: 200 true
[V2] Starting SSE stream read...
[V2] Event 1: engine_start
[V2] Event 2: phase_start
...
[V2] Stream ended after 45 events
```

These logs help trace the full request lifecycle and identify any issues with persona loading, LLM calls, or event streaming.

---

## Known Limitations

1. **Crystallizer quality**: The crystallizer is an LLM call that interprets dialogue. It might miss subtle concessions or extract wrong argument structures. Mitigation: it sees a cluster of turns (not one), and it can be validated/corrected in subsequent crystallizations.

2. **Concession reluctance**: LLMs in persona tend to be stubborn. The persona prompt must explicitly allow concession ("you can and should concede points when the evidence warrants it"). The controller steers toward concession when appropriate.

3. **Circling detection is approximate**: Detecting that agents are repeating themselves uses simple word-overlap. Embedding-based similarity is a future upgrade.

4. **Phase transitions are heuristic**: The triggers for moving between phases are rules of thumb, not formal criteria. They may need tuning per topic/persona combination.

5. **2-agent assumption**: The architecture generalizes to N agents but the controller's turn-taking and steering logic is designed for 2-agent debates initially.

---

## Future Enhancements

- [ ] **N-agent debates**: Extend controller for coalition dynamics, multi-party turn-taking
- [ ] **Shared knowledge pool**: Shared corpus of facts/data that agents reference before debate begins
- [ ] **Tool-call evidence**: External data retrieval (web search, API calls) mid-debate
- [ ] **Embedding-based circling detection**: Replace word overlap with vector similarity
- [ ] **Interactive argument graph visualization**: Click nodes to see supporting dialogue
- [ ] **Export/share debates**: Markdown, PDF, shareable links
- [ ] **Debate replay**: Playback controls to step through debate history
- [ ] **Mobile-optimized insights**: Bottom sheet for graph stats on mobile

---

## Performance

**Typical debate** (2 personas, 30 turns max, ~24 actual turns):
- Duration: ~60-90 seconds
- Tokens: ~25-35k input, ~3-5k output
- Cost: ~$0.40-0.60
- Final graph: 4-8 arguments, 6-12 attacks
- Phases: All 4 phases typically reached
- Concessions: 1-3 per debate

**Build status**: ✅ Production-ready, fully type-safe, compiles cleanly

---

## Appendix: v1 vs v2

| Aspect | v1 | v2 |
|--------|----|----|
| **Turn structure** | Formal arguments per turn | Natural dialogue (2-4 sentences) |
| **Graph building** | Every turn adds node | Periodic crystallization |
| **Graph size** | 20+ nodes after 2 rounds | 4-6 nodes final |
| **Concessions** | Not supported | Graph shrinks via concessions |
| **Agent selection** | Pressure points + Haiku ranking | Simple alternation |
| **Convergence** | Labelling stability | Crux proposals + graph stability |
| **Cost per debate** | ~$0.80-1.20 | ~$0.40-0.60 |
| **Readability** | Formal argument structures | Chat-like conversation |
| **Frontend** | Not integrated | Chat UI at /debate-v2 |

**v1 is deprecated**. All new debates should use v2.

---

## Planned Upgrade: Dispute-Centric Graph (DCG) Architecture

**Status**: 🔧 **PLANNED** (Not yet implemented)

### Problem

The current v2 implementation has a fundamental structural flaw that leads to **fake consensus**:

**Example**: A polarized Bitcoin debate between Michael Saylor (determinism) and Arthur Hayes (probabilism) reported:
```
"Consensus: 3 of 8 arguments in common ground"
```

When inspecting the grounded extension:
- `arg-2`, `arg-4` (Saylor): "Bitcoin adoption is deterministic"
- `arg-7` (Hayes): "Bitcoin success is contingent on policy mistakes"

These are contradictory positions being reported as "common ground"!

**Root Cause**: The Argument/Attack model allows **free-floating claims** that don't explicitly attack each other. The crystallizer can extract "reasonable" arguments that should conflict but don't, causing Dung semantics to label them all as IN → artificial consensus.

### Solution: Dispute-Centric Graph (DCG)

Replace the Argument/Attack model with a structure that **enforces one rule**: every formal claim must attach to an explicit binary dispute.

**DCG Structure:**
```
Dispute (binary question) → Stance (YES/NO) → Reason (supports/attacks stance)
```

**Invariants:**
1. Every Stance must reference an existing Dispute
2. Every Reason must reference an existing Stance
3. A Dispute only exists if ≥1 YES stance and ≥1 NO stance (real divergence)
4. No free-floating claims allowed

**Benefits:**
- Forces crux isolation (disputes ARE the cruxes)
- Prevents "11/16 common ground" false consensus
- Common ground = disputes where all stances align to same side
- Crux = disputes with YES/NO split
- Explicit, explainable disagreement axes

---

### DCG Implementation Plan

#### Phase 1: DCG Foundation

**New file: `lib/types/dispute-graph.ts`**

```typescript
export type DisputeId = `d-${number}`
export type StanceId = `s-${number}`
export type ReasonId = `r-${number}`

export interface Dispute {
  id: DisputeId
  question: string                  // Binary question
  horizon?: string                  // "12-18mo", "5y", "10y"
  resolutionCriteria: string[]      // Concrete evidence that would settle it
  createdFromTurns: number[]
  active: boolean                   // Controller can retire disputes
}

export interface Stance {
  id: StanceId
  disputeId: DisputeId
  speakerId: PersonaId
  side: "YES" | "NO"                // Force binary incompatibility
  statement: string                 // Short stance statement
  confidence?: number               // 0..1
  derivedFromTurns: number[]
}

export interface Reason {
  id: ReasonId
  stanceId: StanceId
  polarity: "SUPPORT" | "ATTACK"    // Support or attack the stance
  claim: string
  assumptions?: string[]
  evidence?: string[]
  derivedFromTurns: number[]
}

export interface DisputeGraphState {
  disputes: Dispute[]
  stances: Stance[]
  reasons: Reason[]
}
```

**New file: `lib/dispute/dcg-state.ts`** (state management CRUD operations)

**New file: `lib/dispute/dcg-crystallizer.ts`** (crystallize dialogue → DCG updates)

**New file: `lib/dispute/dcg-analysis.ts`** (compute cruxes, common ground, regime)

#### Phase 2: DCG Crystallization Prompt

**Add to `lib/debate/prompts.ts`:**

```typescript
export function crystallizationPromptDCG(
  topic: string,
  dialogueCluster: DialogueTurn[],
  state: DisputeGraphState,
): string {
  return `You are maintaining a DISPUTE-CENTRIC GRAPH for a debate on "${topic}".
This graph isolates TRUE CRUXES and prevents fake consensus.

## Current Dispute Graph
Disputes: [show current disputes]
Stances: [show current stances]
Reasons: [show current reasons]

## Recent Dialogue (cluster)
[dialogue turns]

## Your job
Update the dispute graph based ONLY on the dialogue cluster.

### Hard rules (must follow)
1) You may add at most 2 new disputes per call.
2) DO NOT create free-floating claims: every stance must be tied to a dispute.
3) A dispute should exist ONLY if there is real divergence in the dialogue.
4) Every stance/reason MUST include derivedFromTurns.
5) If a speaker concedes, UPDATE their stance; do NOT create duplicates.
6) Resolution criteria must be concrete observable evidence, not vibes.

Output JSON: {newDisputes, updatedDisputes, upsertStances, newReasons, removedReasonIds, notes}`
}
```

**Key difference from current crystallization**: Forces extraction to be organized into binary dispute axes, not free-floating arguments.

#### Phase 3: Crux/Common Ground Computation

**In `lib/dispute/dcg-analysis.ts`:**

```typescript
// Crux = disputes with ≥1 YES and ≥1 NO stance
export function computeCruxes(state: DisputeGraphState): DCGCrux[] {
  const cruxes: DCGCrux[] = []
  for (const dispute of state.disputes) {
    const stances = state.stances.filter(s => s.disputeId === dispute.id)
    const yesSide = stances.filter(s => s.side === 'YES')
    const noSide = stances.filter(s => s.side === 'NO')

    if (yesSide.length > 0 && noSide.length > 0) {
      cruxes.push({ disputeId: dispute.id, question: dispute.question, yesSide, noSide })
    }
  }
  return cruxes
}

// Common ground = disputes where all stances align to same side
export function computeCommonGround(state: DisputeGraphState): DCGCommonGround[] {
  const common: DCGCommonGround[] = []
  for (const dispute of state.disputes) {
    const stances = state.stances.filter(s => s.disputeId === dispute.id)
    const yesSide = stances.filter(s => s.side === 'YES')
    const noSide = stances.filter(s => s.side === 'NO')

    // All stances align to YES
    if (yesSide.length > 0 && noSide.length === 0) {
      common.push({ disputeId: dispute.id, question: dispute.question, agreedSide: 'YES' })
    }
    // All stances align to NO
    else if (noSide.length > 0 && yesSide.length === 0) {
      common.push({ disputeId: dispute.id, question: dispute.question, agreedSide: 'NO' })
    }
  }
  return common
}

// Regime classification
export function classifyRegime(
  cruxes: DCGCrux[],
  commonGround: DCGCommonGround[],
  activeDisputes: number
): { regime: string; regimeDescription: string } {
  // Consensus: all active disputes are aligned
  if (cruxes.length === 0 && commonGround.length > 0) {
    return {
      regime: 'consensus',
      regimeDescription: `Consensus: Both speakers agree on ${commonGround.length} dispute(s).`
    }
  }

  // Polarized: ≥1 high-crux dispute remains split
  if (cruxes.length > 0 && commonGround.length === 0) {
    return {
      regime: 'polarized',
      regimeDescription: `Polarized: ${cruxes.length} unresolved dispute(s), no common ground.`
    }
  }

  // Partial: mix of aligned and split
  return {
    regime: 'partial',
    regimeDescription: `Partial: ${commonGround.length} aligned, ${cruxes.length} split.`
  }
}
```

**Correctness guarantee**: Cannot report fake consensus because:
- Contradictory stances (YES vs NO) on same dispute → crux, not common ground
- Common ground requires ALL stances on a dispute to align to same side
- No grounded extension confusion

#### Phase 4: Engine Integration

**Changes to `lib/debate/engine.ts`:**

1. Initialize DCG state alongside old graph:
   ```typescript
   let dcgState = createDCGState()
   const disputeCounter = { value: 0 }
   const stanceCounter = { value: 0 }
   const reasonCounter = { value: 0 }
   ```

2. Replace crystallization calls:
   ```typescript
   dcgState = await crystallizeDCG(
     dialogueSinceLastCrystallization,
     dcgState,
     topic,
     disputeCounter,
     stanceCounter,
     reasonCounter,
   )
   ```

3. Replace regime computation:
   ```typescript
   const cruxes = computeCruxes(dcgState)
   const commonGround = computeCommonGround(dcgState)
   const activeDisputes = dcgState.disputes.filter(d => d.active).length
   const { regime, regimeDescription } = classifyDCGRegime(cruxes, commonGround, activeDisputes)
   ```

4. Emit DCG events:
   ```typescript
   yield { type: 'dcg_update', dcgState, cruxes, commonGround, regime }
   ```

#### Phase 5: Frontend Integration

**Update `components/DebateV2Client.tsx`** to display DCG insights sidebar:

```tsx
{/* DCG Insights Panel */}
<div className="space-y-4">
  <div>
    <h4>Active Disputes</h4>
    <div className="text-2xl">{dcgState?.disputes.filter(d => d.active).length ?? 0}</div>
  </div>

  <div>
    <h4>Crux Disputes</h4>
    {cruxes.map(c => (
      <div key={c.disputeId}>
        <div className="font-medium">{c.question}</div>
        <div className="text-xs">
          YES: {c.yesSide.map(s => s.speakerId).join(', ')}<br/>
          NO: {c.noSide.map(s => s.speakerId).join(', ')}
        </div>
      </div>
    ))}
  </div>

  <div>
    <h4>Common Ground</h4>
    {commonGround.map(cg => (
      <div key={cg.disputeId}>{cg.question} ({cg.agreedSide})</div>
    ))}
  </div>
</div>
```

#### Phase 6: Additional Improvements

**Dialogue Quality** (same improvements as before):
1. **Shorter prompts**: "1-2 sentences MAXIMUM. Be punchy."
2. **Remove post-concession steering**: Stop asking "does your position change?"
3. **More adversarial framing**: "You are in a DEBATE. Find disagreement, question assumptions."
4. **Sonnet model for dialogue**: Haiku ignores length constraints
5. **Reduce maxTokens to 150**: Force brevity
6. **Increase temperature to 0.9**: More varied, punchy responses

---

### Expected Output (DCG)

**Before (current Argument/Attack model):**
```json
{
  "arguments": [
    {"id": "arg-2", "speakerId": "michael-saylor", "claim": "Bitcoin volatility is a feature"},
    {"id": "arg-4", "speakerId": "michael-saylor", "claim": "Bitcoin correlation is short-term"},
    {"id": "arg-7", "speakerId": "arthur-hayes", "claim": "Bitcoin is probabilistic"}
  ],
  "groundedExtension": ["arg-2", "arg-4", "arg-7"],
  "regime": "consensus",
  "regimeDescription": "Consensus: 3 of 8 arguments in common ground."
}
```

**After (DCG model):**
```json
{
  "disputes": [
    {
      "id": "d-0",
      "question": "Is Bitcoin adoption deterministic or contingent on policy?",
      "active": true,
      "resolutionCriteria": ["5-year correlation data", "Policy change impact"]
    }
  ],
  "stances": [
    {
      "id": "s-0",
      "disputeId": "d-0",
      "speakerId": "michael-saylor",
      "side": "YES",
      "statement": "Bitcoin adoption is deterministic"
    },
    {
      "id": "s-1",
      "disputeId": "d-0",
      "speakerId": "arthur-hayes",
      "side": "NO",
      "statement": "Bitcoin adoption depends on continued policy mistakes"
    }
  ],
  "cruxes": [
    {
      "disputeId": "d-0",
      "question": "Is Bitcoin adoption deterministic or contingent?",
      "yesSide": [{"speakerId": "michael-saylor", "statement": "..."}],
      "noSide": [{"speakerId": "arthur-hayes", "statement": "..."}]
    }
  ],
  "commonGround": [],
  "regime": "polarized",
  "regimeDescription": "Polarized: 1 unresolved dispute(s), no common ground."
}
```

**Correctness**: The same polarized debate now correctly reports as "polarized" with 0 common ground, not "consensus" with 3 common ground.

---

### Migration Strategy

1. **Phase 1-3**: Implement DCG types, state, crystallizer, analysis (new files)
2. **Phase 4**: Integrate DCG into engine alongside old graph (parallel operation)
3. **Phase 5**: Update frontend to display DCG insights
4. **Phase 6**: Dialogue improvements (shorter, adversarial)
5. **Verification**: Run same debates, compare DCG vs old graph outputs
6. **Cleanup**: Remove old ArgumentationGraphState, Dung global semantics, centralized discovery

**Total estimated time**: ~2.5 hours

**Backward compatibility**: Keep old graph initially for comparison, remove after DCG verification.

---

### Success Criteria

✅ **DCG enforces structure**: Every stance attaches to a dispute, no free-floating claims
✅ **Crux isolation**: Binary disputes represent true disagreement axes
✅ **No false consensus**: Polarized debates correctly classified as "polarized"
✅ **Common ground accuracy**: Only disputes where all stances align are reported as common ground
✅ **Dialogue quality**: 200-400 char turns, adversarial framing, fewer artificial concessions
✅ **Frontend visualization**: DCG insights sidebar shows disputes, cruxes, common ground

---

### Files to Create/Modify

**New files:**
1. `faultline/lib/types/dispute-graph.ts` - DCG types
2. `faultline/lib/dispute/dcg-state.ts` - State management
3. `faultline/lib/dispute/dcg-crystallizer.ts` - Crystallization logic
4. `faultline/lib/dispute/dcg-analysis.ts` - Crux/common ground computation

**Modified files:**
1. `faultline/lib/debate/prompts.ts` - Add `crystallizationPromptDCG`, shorten dialogue prompts
2. `faultline/lib/debate/controller.ts` - Remove agreement steering
3. `faultline/lib/debate/engine.ts` - Integrate DCG, dialogue model changes
4. `faultline/lib/types/debate-engine.ts` - Add `dcg_update` event
5. `faultline/lib/hooks/useDebateV2Stream.ts` - Handle DCG events
6. `faultline/components/DebateV2Client.tsx` - Display DCG insights

**Optional cleanup (after DCG verification):**
- Remove `lib/argumentation/` folder (Dung semantics, graph-state, crux-extractor)
- Remove centralized discovery logic
- Simplify to DCG-only architecture

---

### Optional: Dung Within DCG

If Dung semantics are still desired, they can be applied **within a single dispute** at the Reason layer:
- Reasons can attack other Reasons
- Compute grounded/preferred extensions within one dispute
- Use to identify strongest reasons on each side

But **do NOT use Dung for global consensus detection** - that's what caused the bug.
