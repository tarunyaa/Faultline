# Step 3: Thinking Persona Agents

**Date**: 2026-03-06
**Status**: Planning

---

## What This Builds

Three layered capabilities, in dependency order:

1. **Corpus RAG + Citation UI** — Agents retrieve their own past writings to ground responses. UI shows source tweets/essays as citation cards.
2. **GenMinds Runtime Wiring** — The offline belief graph becomes a live reasoning substrate: perceive → deliberate → act per turn, not free-form LLM generation.
3. **Fine-tuning Pipeline** — Optional, only if RAG + exemplars is insufficient for style fidelity.

These are independent enough to ship in phases. Phase 1 has zero architecture dependencies on Phase 2.

---

## Architecture Overview

### What Already Exists (Do Not Rebuild)

| Component | File | Status |
|---|---|---|
| Causal belief extraction | `scripts/extract-beliefs.ts` | Offline, complete |
| Worldview synthesis | `scripts/synthesize-worldviews.ts` | Offline, needs API credits |
| QBAF extraction | `lib/belief-graph/extract-qbaf-from-beliefs.ts` | Offline, complete |
| DF-QuAD strength computation | `lib/belief-graph/df-quad.ts` | Library, not wired |
| CE-QArg belief revision | `lib/belief-graph/belief-revision.ts` | Library, not wired |
| Corpus chunks table | `lib/db/schema.ts` `corpus_chunks` | Schema exists, not populated |
| Vector dimension | `corpus_chunks.embedding vector(1024)` | Already matches voyage-3-large |
| Persona contracts + voice | `lib/personas/loader.ts`, `lib/dialogue/speech-roles.ts` | Live, working |
| Dialogue orchestrator | `lib/dialogue/orchestrator.ts` | Live, working |
| Agent generation | `lib/dialogue/agent.ts` | Live, working — needs intent input |

### What Is Missing (Core Gaps)

**Gap 1 — No corpus embeddings.** `corpus_chunks` table exists but is empty. No retrieval is possible.

**Gap 2 — No perception bridge.** There is no function that takes an incoming utterance and maps it to nodes in a persona's QBAF. The graph is entirely disconnected from live dialogue.

**Gap 3 — No deliberation planner.** There is no motif library, no motif selector, no structured intent output. `agent.ts` receives free-form context and decides everything.

**Gap 4 — No constrained generation.** `agent.ts` must be extended to accept a `DeliberationIntent` that specifies what to argue, not just context to react to.

**Gap 5 — No cross-debate persistence.** Each debate is stateless. Belief revision results are discarded. The graph never evolves.

---

## Phase 1: Corpus RAG + Citation UI

**Prerequisite**: None. Builds on existing schema and Voyage AI API.
**Output**: Agents cite their own past writings during debate. UI shows source cards.

### 1.1 Corpus Embedding Pipeline

Add `VOYAGE_API_KEY` to `.env.local`.

New script: `faultline/scripts/embed-corpus.ts`

```
for each persona in data/seed/corpus/:
  for each tweet: embed whole (already short, no chunking)
  for each essay: semantic chunk at 512 tokens / 64-token overlap
  upsert into corpus_chunks with personaId, sourceType, sourceUrl, sourceDate, content, embedding
```

Embedding models:
- Tweets: `voyage-3-large` (1024d, matches schema)
- Essays: `voyage-context-3` (July 2025 model, +14% over voyage-3-large for long-form chunks)

Cost estimate: ~25,300 vectors × negligible token count = **<$0.01 total**.

Add HNSW index after seeding:
```sql
CREATE INDEX ON corpus_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 1.2 Retrieval Library

New file: `faultline/lib/retrieval/corpus.ts`

```typescript
// Query reformulation (HyDE-style) — improves embedding alignment
async function buildRetrievalQuery(
  personaName: string,
  debateTurn: string,
  topic: string,
): Promise<string>
// Returns: "[PersonaName] argument about [topic] supporting [position]"

// Hybrid retrieval: BM25 keyword + cosine vector, fused by RRF
export async function retrievePersonaCorpus(
  personaId: string,
  queryText: string,
  topK: number = 5,
): Promise<CorpusChunk[]>
// Filter by personaId first, then HNSW cosine + BM25, fuse with RRF
// Returns chunks with similarity score attached
```

Similarity thresholds for downstream use:
- `>= 0.85`: show full tweet embed or essay block
- `0.70 – 0.85`: show plain excerpt card
- `< 0.70`: use for grounding only, do not surface to UI

### 1.3 Inject Corpus Into Agent Generation

Modify `lib/dialogue/agent.ts` — all four generation functions (`generateOpeningMicroTurn`, `generateTake`, `generateReplyToReply`, `generateClosing`):

Before the Sonnet call, run `retrievePersonaCorpus(personaId, currentTurnContext, topic)`. Inject top-3 results into the user prompt as few-shot grounding:

```
In your past writing you said:
"[excerpt 1]" (Tweet, [date])
"[excerpt 2]" (Substack, [date])

Respond in the same register and reasoning style.
```

This is the "RAGs to Riches" pattern (arXiv:2509.12168) — ~90% of fine-tuning's style benefit at zero infrastructure cost.

Return retrieved chunks alongside the generated text so the orchestrator can emit them as SSE events.

### 1.4 SSE Citation Events

Modify `lib/dialogue/orchestrator.ts`: emit `corpus_retrieved` immediately before each `message_posted` for the same turn.

New event type in `lib/dialogue/types.ts`:
```typescript
{ type: 'corpus_retrieved'; personaId: string; chunks: RetrievedChunk[] }
// RetrievedChunk: { id, content, sourceType, sourceUrl, sourceDate, similarity }
```

Modify `lib/hooks/useDialogueStream.ts`: buffer `corpus_retrieved` events by `personaId`, attach to the next `message_posted` for that persona.

### 1.5 Citation Card UI

Install: `npm install react-tweet` (Vercel, no API key required, App Router compatible).

New component: `faultline/components/dialogue/CitationCard.tsx`

```
if sourceType === 'tweet' && similarity >= 0.85:
  render <Tweet id={extractTweetId(sourceUrl)} />
else if similarity >= 0.70:
  render styled excerpt card with date + "from [platform]" label
```

Attach to `MessageThread.tsx`: below each message bubble, render its associated `CitationCard[]` if present. Collapsed by default; expand on click.

---

## Phase 2: GenMinds Runtime Wiring

**Prerequisite**: Belief graph data must exist for the personas being debated. Run `npm run build-personas` and `npm run extract-beliefs` first.
**Output**: Agents reason from their causal belief graph per turn. Belief revision happens live. Positions evolve structurally.

### Architecture: The Cognitive Turn Loop

The current turn generation is:
```
context (text) → agent.ts → LLM → response (text)
```

The GenMinds-compliant turn is:
```
incoming utterance (text)
    → [PERCEIVE] claim-to-node mapping → activated subgraph
    → [UPDATE GRAPH] insert attack edges + DF-QuAD recompute → revised QBAF
    → [DELIBERATE] motif selection + shadow model → DeliberationIntent
    → [ACT] constrained LLM generation → response (text)
```

Steps 1–3 are new. Step 4 is `agent.ts` extended to accept intent.

### 2.1 PersonalityAgent Type

New file: `faultline/lib/agent/types.ts`

```typescript
// The live agent state carried through a debate
interface PersonalityAgent {
  // Static (loaded once per debate)
  personaId: string
  persona: Persona
  contract: PersonaContract
  voiceProfile: VoiceProfile

  // Belief state (mutable per turn)
  activeQBAF: PersonaQBAF         // topic-scoped, updated each round
  revisionHistory: RevisionEvent[]

  // Working memory (ephemeral, per turn)
  workingMemory: WorkingMemory | null
}

interface WorkingMemory {
  activatedNodes: string[]        // QBAF node IDs engaged by incoming utterance
  attackEdgesAdded: QBAFEdge[]    // new edges from this turn's attack
  shadowModel: ShadowNode[]       // inferred opponent belief nodes (Theory of Mind)
  strengthsBefore: Map<string, number>
  strengthsAfter: Map<string, number>
}

// Output of deliberation — what gets passed to agent.ts
interface DeliberationIntent {
  moveType: 'attack' | 'defend' | 'concede' | 'introduce_evidence' | 'undercut'
  targetClaim: string             // the claim being addressed
  targetStrength: number          // dialectical strength of target node
  myClaim: string                 // the specific claim/evidence being deployed
  myClaimStrength: number         // dialectical strength of my claim node
  rhetoricalGoal: string          // what this achieves in the overall argument
}

// A revision event logged for persistence
interface RevisionEvent {
  turn: number
  trigger: string                 // what argument triggered revision
  nodeId: string
  strengthBefore: number
  strengthAfter: number
  R: number                       // revision resistance applied
}
```

### 2.2 Perception Bridge

New file: `faultline/lib/agent/perception.ts`

```typescript
// Maps an incoming utterance to nodes in the agent's QBAF
// Returns: which nodes are under attack, which are supported, which are novel
export async function perceiveUtterance(
  utterance: string,
  speakerName: string,
  agent: PersonalityAgent,
): Promise<{
  activatedNodes: string[]
  attackEdges: Array<{ targetNodeId: string; weight: number; claim: string }>
  novelClaims: string[]
}>
```

Implementation: one Haiku call. Passes the utterance text alongside the agent's QBAF node list (claims only, no graph structure). The model identifies which of the agent's beliefs are engaged, whether each is attacked or supported, and any claims not represented in the graph.

Key design: the Haiku call receives **node claims as a list**, not the full graph structure. The graph topology is not needed for semantic matching.

### 2.3 Motif Library

New file: `faultline/lib/agent/motifs.ts`

Five core motifs (sufficient for debate; paper identifies 5-7):

```typescript
type MotifType =
  | 'rebuttal'         // direct attack on opponent's stated claim
  | 'undercut'         // attack the support relationship, not the claim
  | 'evidence_ground'  // introduce new leaf node supporting an attacked node
  | 'concede_pivot'    // accept peripheral attack, pivot to stronger support path
  | 'shadow_probe'     // target an inferred opponent assumption, not their stated claim

// Check structural applicability given current graph state + activated nodes
function applicableMotifs(
  agent: PersonalityAgent,
  activatedNodes: string[],
  shadowModel: ShadowNode[],
): MotifType[]

// Score each motif by estimated delta to root dialectical strength
// Returns sorted list with scores
function scoreMotifs(
  agent: PersonalityAgent,
  motifs: MotifType[],
  contract: PersonaContract,
): Array<{ motif: MotifType; score: number }>

// Convert selected motif to DeliberationIntent
function motifToIntent(
  agent: PersonalityAgent,
  motif: MotifType,
  activatedNodes: string[],
): DeliberationIntent
```

Persona cognitive style preference (from contract fields):
- High `stakes` → prefer `concede_pivot` and `evidence_ground` (defensive)
- Low `epistemicOpenness` → prefer `rebuttal` and `undercut` (offensive)
- Concrete `flipConditions` → allow `concede_pivot` more readily

### 2.4 Deliberation Orchestrator

New file: `faultline/lib/agent/deliberation.ts`

```typescript
export async function deliberate(
  agent: PersonalityAgent,
  incomingUtterance: string,
  speakerName: string,
): Promise<{
  intent: DeliberationIntent
  updatedAgent: PersonalityAgent   // QBAF revised, working memory set
}>
```

Sequence:
1. `perceiveUtterance()` → activated nodes + attack edges
2. Build shadow model: one lightweight Haiku call — "Given [speaker] said [utterance], what beliefs are they likely relying on?" → `ShadowNode[]`
3. Insert new attack edges into QBAF
4. `computeStrengths(qbaf)` (DF-QuAD, algorithmic, no LLM)
5. `determineTargetStrength()` → apply CE-QArg revision resistance
6. `reviseBeliefs()` → update base scores
7. `applicableMotifs()` + `scoreMotifs()` → pick top motif
8. `motifToIntent()` → structured intent
9. Return intent + updated agent with new QBAF + revision history entry

### 2.5 Constrained Generation

Modify `lib/dialogue/agent.ts`: add `intent?: DeliberationIntent` parameter to `generateTake` and `generateReplyToReply`.

When intent is provided, the user prompt becomes:
```
You are arguing that: "[myClaim]" (your confidence: [myClaimStrength])
You are responding to: "[targetClaim]"
Your rhetorical move: [moveType] — [rhetoricalGoal]
Say it in your voice. 1-3 sentences.
```

When no intent (opening, closing, or belief graph unavailable): fall back to current free-form generation.

### 2.6 Orchestrator Integration

Modify `lib/dialogue/orchestrator.ts`:

At debate start: for each persona, call `scopeQBAFToTopic(personaId, topic)` to load/extract a topic-scoped QBAF. Store as `agents: Map<PersonaId, PersonalityAgent>`.

For each miniround take generation (currently `generateTake()`):
```
// Before the current agent.ts call:
if (agents.has(personaId) && lastMiniroundTakes.length > 0) {
  const opponentTakes = lastMiniroundTakes.filter(m => m.personaId !== personaId)
  for (const opponentTake of opponentTakes) {
    const { intent, updatedAgent } = await deliberate(agent, opponentTake.content, ...)
    agents.set(personaId, updatedAgent)
    // Pass intent to generateTake()
  }
}
```

After each round: post-round belief state snapshot stored in agent's revision history.

### 2.7 QBAF Scoping

New function in `lib/belief-graph/extract-qbaf-from-beliefs.ts` or a thin wrapper:
```typescript
// Load pre-extracted QBAF from data/seed/ or run extraction on-demand
async function scopeQBAFToTopic(
  personaId: string,
  topic: string,
): Promise<PersonaQBAF | null>
```

Graceful degradation: if no belief graph exists for a persona, skip the deliberation layer and use current free-form generation. The agent still works — it just doesn't have graph-grounded reasoning.

---

## Phase 3: Cross-Debate Persistence

**Prerequisite**: Phase 2 complete.
**Output**: Belief graphs evolve across debates. Personas remember what moved them.

### 3.1 Post-Debate Revision Persistence

After `dialogue_complete`, serialize each agent's `revisionHistory` and final QBAF state.

New DB table (or extend existing debates table):
```
persona_belief_states
  persona_id        text
  debate_id         uuid FK
  qbaf_snapshot     jsonb     -- PersonaQBAF at end of debate
  revision_history  jsonb     -- RevisionEvent[]
  created_at        timestamp
```

### 3.2 Belief State Loading

Modify `scopeQBAFToTopic()`: if a `persona_belief_states` record exists for this persona, start from the most recent QBAF snapshot rather than the static file-based extraction. This gives agents "memory" of past debates — their belief graph reflects accumulated revision.

### 3.3 Revision Log UI

Minor addition to the debate summary view: for each persona, show a "belief movement" log — which claims shifted and by how much during this debate. Uses the `revisionHistory` already captured.

---

## Phase 4: Fine-Tuning (Optional)

**Trigger**: Only pursue if Phase 1 RAG+exemplars is clearly insufficient for style fidelity after running 10+ debates.

**Target personas**: Saylor first (most distinctive voice, largest corpus).

### 4.1 Training Data Preparation

New script: `scripts/prepare-finetune.ts`

For each tweet in `data/seed/corpus/[Name].json`:
1. Haiku call: "Generate a debate question that would elicit this tweet as a response." (~$0.50 total for 2,000 tweets)
2. Format as chat: `{ role: 'user', content: question }`, `{ role: 'assistant', content: tweet }`
3. Include essay chunks similarly

Output: JSONL file per persona in chat format, ready for trl/axolotl.

### 4.2 Training Configuration

Infrastructure: `g5.xlarge` on AWS ($1.01/hr on-demand) or RunPod A100 ($1.50/hr).

Stack: `trl` + `peft` + `bitsandbytes` (QLoRA, 4-bit).
Base model: `meta-llama/Meta-Llama-3.1-8B-Instruct`.
Training: 3 epochs, batch size 4, 2,200 examples → ~4 hours → ~$5–10/persona.

### 4.3 Serving

Fine-tuned adapters cannot use the Anthropic API. Requires:
- `vllm` on `g4dn.xlarge` ($0.53/hr) for serving
- New model tier in `lib/llm/client.ts`: `'persona-[name]'` → routes to self-hosted endpoint
- Graceful fallback to Sonnet if endpoint is down

### 4.4 Evaluation

Before/after comparison using:
- **ALM perplexity**: fine-tune a small LM on real corpus; measure perplexity of generated debate turns under it. Lower = more author-like. Target: <15% regression vs. held-out tweets.
- **Stance consistency**: does the model take the correct positions on held-out topics?
- **Human eval (5-10 debates)**: blind comparison — can raters distinguish fine-tuned from RAG+exemplars?

**Decision rule**: If ALM perplexity improvement is <10% vs. RAG+exemplars, and human eval shows no significant preference, do not build serving infrastructure. The operational overhead is not worth marginal style gain.

---

## File Plan

### Phase 1

```
faultline/scripts/embed-corpus.ts          -- embed corpus → corpus_chunks
faultline/lib/retrieval/corpus.ts          -- retrievePersonaCorpus(), buildRetrievalQuery()
faultline/components/dialogue/CitationCard.tsx  -- tweet embed + excerpt card
```

Modify:
```
faultline/lib/dialogue/agent.ts            -- inject retrieved chunks as few-shot demos
faultline/lib/dialogue/orchestrator.ts     -- emit corpus_retrieved events
faultline/lib/dialogue/types.ts            -- add corpus_retrieved event type
faultline/lib/hooks/useDialogueStream.ts   -- buffer corpus_retrieved by personaId
faultline/components/dialogue/MessageThread.tsx  -- render CitationCard per message
```

### Phase 2

```
faultline/lib/agent/types.ts               -- PersonalityAgent, WorkingMemory, DeliberationIntent
faultline/lib/agent/perception.ts          -- perceiveUtterance()
faultline/lib/agent/motifs.ts              -- motif library, applicability, scoring, intent translation
faultline/lib/agent/deliberation.ts        -- deliberate() orchestrator
```

Modify:
```
faultline/lib/dialogue/agent.ts            -- accept DeliberationIntent, constrained generation
faultline/lib/dialogue/orchestrator.ts     -- load QBAFs at start, call deliberate() before each take
faultline/lib/belief-graph/extract-qbaf-from-beliefs.ts  -- add scopeQBAFToTopic()
```

### Phase 3

```
faultline/lib/db/schema.ts                 -- add persona_belief_states table
```

Modify:
```
faultline/lib/dialogue/orchestrator.ts     -- persist QBAF snapshots post-debate
faultline/lib/belief-graph/extract-qbaf-from-beliefs.ts  -- load from DB if snapshot exists
```

---

## Open Questions

1. **Worldview synthesis data**: `synthesize-worldviews.ts` hasn't run due to API credits. Phase 2 can proceed with raw belief graphs; worldview positions would make the QBAF scoping more accurate.
2. **QBAF coverage**: Not all 11 personas have belief graph data (`extract-beliefs.ts` must have run for them). Phase 2 degrades gracefully to free-form for personas without graphs.
3. **Deliberation latency**: Adding perceive + deliberate before each turn adds 1-2 Haiku calls per take. At 3 personas × 3 minirounds, that's ~18 additional Haiku calls per debate round. Acceptable at ~$0.003 per debate.
4. **Shadow model accuracy**: The Theory of Mind inference is speculative. A poorly inferred shadow model could cause the agent to target non-existent assumptions. Mitigation: use shadow model only for `shadow_probe` motif; other motifs operate only on the agent's own confirmed graph.

---

## Sources

- GenMinds paper (via genminds-expert agent, full Q&A in task transcript)
- step3-exploration.md (prior research, Feb 2025)
- RAG + fine-tuning research (via research-analyst agent, full report in task transcript)
- Key papers: PRIME (arXiv:2507.04607), R-Debater (arXiv:2512.24684), ID-RAG (arXiv:2509.25299), RAGs to Riches (arXiv:2509.12168), voyage-context-3 announcement
