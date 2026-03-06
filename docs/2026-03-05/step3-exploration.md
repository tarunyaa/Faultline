# Step 3 Exploration: Personality Agent Abstraction Layer

**Status**: Research complete, pending implementation discussion
**Sources**: GenMinds paper (via genminds-expert agent), PRIME / R-Debater / agent framework research (via research-analyst)

---

## Current State Assessment

Faultline already has most of the components GenMinds calls for, but they run as **offline batch scripts** disconnected from the live dialogue engine:

| Component | Implementation | Status |
|---|---|---|
| Causal belief graph | `data/seed/beliefs/[Name].json` via `extract-beliefs.ts` | Offline only |
| Worldview synthesis | `data/seed/worldviews/[Name].json` via `synthesize-worldviews.ts` | Offline only |
| QBAF extraction | `lib/belief-graph/extract-qbaf-from-beliefs.ts` | Offline only |
| DF-QuAD strengths | `lib/belief-graph/df-quad.ts` | Library, not wired to dialogue |
| CE-QArg belief revision | `lib/belief-graph/belief-revision.ts` | Library, not wired to dialogue |
| Community graph + crux | `lib/belief-graph/community-graph.ts` | Offline only |
| Persona contracts | `data/seed/contracts/[Name].json` | Used at runtime (prose-flattened into prompt) |
| Voice profiles | `lib/dialogue/speech-roles.ts` | Used at runtime |

**The core gap is not missing components but missing wiring.** The belief graph infrastructure exists but is dead weight during actual debates. `buildConsolidatedPrompt()` flattens everything into static prose and hands it to Claude. The QBAF, belief strengths, and revision mechanics are completely disconnected from the live dialogue loop.

---

## Q1: Agent Abstraction Design

### GenMinds' Position

GenMinds proposes agents as **structured belief graph simulators**, not chat-style role-players. The LLM serves as an interface layer — it selects relevant interventions and assembles motifs, but the *reasoning* happens over the graph structure.

Key quote: "Output plausibility is not equivalent to cognitive alignment" (Section 3). Flattening everything into a prompt is exactly the failure mode GenMinds diagnoses.

### Recommended Design: Data Structure + Pure Functions

GenMinds' architecture implies a plain data structure with pure functions, because the belief graph is the primary reasoning substrate (not the prompt), and operations on it are functional transformations.

```typescript
interface PersonalityAgent {
  // Identity (static across debates)
  persona: Persona
  contract: PersonaContract
  voiceProfile: VoiceProfile

  // Belief state (mutable across debates)
  beliefGraph: BeliefGraph           // master causal graph
  worldview: PersonaWorldview        // clustered positions + assumptions
  revisionHistory: RevisionEvent[]   // when/why beliefs changed

  // Topic-scoped reasoning (ephemeral, per-debate)
  activeQBAF: PersonaQBAF | null     // current topic's argumentation framework
  activeMotifs: CausalMotif[]        // reasoning units in play
}
```

Pure functions operating on it:
- `scopeToTopic(agent, topic) -> agent with activeQBAF` — filters belief graph to topic-relevant subgraph
- `simulateIntervention(agent, intervention) -> updated belief strengths` — do-calculus style what-if
- `reviseBeliefs(agent, newEvidence) -> agent with updated graph` — CE-QArg revision
- `generateResponse(agent, context) -> string` — LLM call with graph state informing the prompt

**Key insight**: The prompt should be *derived from* the current graph state, not be a static blob. When a persona speaks, the system should trace which motifs are active, what their current belief strengths are, and generate accordingly.

### Why Not a Class?

The agent is fundamentally a data structure that gets transformed. Classes would encourage mixing state mutation with LLM I/O. Pure functions keep the graph transformations testable and the LLM calls isolated to orchestration code.

---

## Q2: Epistemic Personality Model

### GenMinds' Three Axes of Epistemic Personality

GenMinds does NOT model personality as tone/style. Their approach is entirely about how a person *reasons*:

1. **Causal structure** — What causal relationships does the person believe in? The topology of their belief graph.
2. **Confidence distribution** — How strongly are beliefs held? Two people can share structure but disagree on edge weights.
3. **Revision behavior** — How does the person update beliefs when confronted with new evidence? The *shape* of belief revision IS the epistemic personality.

### Mapping to Faultline's PersonaContract

| Faultline Field | GenMinds Equivalent | Gap |
|---|---|---|
| `personality` | Not modeled (GenMinds ignores tone) | None — Faultline keeps this for voice |
| `bias` | Causal structure + confidence weighting | Faultline's bias is prose, not graph structure |
| `stakes` | Revision resistance per-node | Should modulate CE-QArg's R parameter per-node |
| `epistemology` | Evidence weighting rules + valid causal connection topology | Prose in Faultline; GenMinds wants graph constraints |
| `flipConditions` | Counterfactual intervention sensitivity | Already well-aligned |
| `evidencePolicy` | Acceptable motif sources | Already structured |

**Critical gap**: Faultline represents epistemic personality as natural language strings. GenMinds wants it as **graph structure** — the shape of your causal graph IS your epistemic personality. The worldview synthesis pipeline is halfway there (clusters beliefs, extracts positions with implicit assumptions). The missing step is making these the *operative* epistemic personality rather than supplementary data.

### Cognitive Motifs

GenMinds introduces "cognitive motifs" — minimal causal reasoning units (e.g., "Surveillance -> Crime Rate -> Public Safety"). These are reusable reasoning fragments that compose into larger networks.

Faultline's `extract-beliefs.ts` already produces causal triples (essentially motifs). The worldview synthesis clusters them. What GenMinds adds: motifs are **shared across individuals** with different confidence scores, enabling identification of structural agreement with confidence disagreement — which is exactly what Faultline calls a "crux."

---

## Q3: Memory Architecture

### GenMinds' Position: The Graph IS Memory

GenMinds is thin on explicit memory architecture. Their position: the belief graph itself IS persistent structured memory. If a persona changed their mind in a past debate, that should be reflected in the revised belief graph, not stored as a narrative memory.

Key claims:
- Beliefs must persist across prompts (not reset per conversation)
- Revision history must be traceable (when/why beliefs changed)
- Uncertainty must be visible (weakly supported or isolated nodes)

### Comparison with PRIME and R-Debater

| System | Memory Type | What It Stores | Retrieval |
|---|---|---|---|
| GenMinds | Structural (belief graph) | Causal reasoning structures | Graph traversal + motif matching |
| PRIME | Dual (semantic + episodic) | Facts + experiences | Embedding similarity |
| R-Debater | Argumentative | Past arguments + counterarguments | Argument-structure matching |

GenMinds argues that a well-structured causal graph with revision history *subsumes* both semantic and episodic memory for reasoning purposes. You don't need "what happened in past debates" as a narrative — the graph captures the accumulated result.

### Recommended Three-Layer Architecture for Faultline

1. **Structural memory (belief graph + worldview)** — The primary reasoning substrate. Already exists. Answers: "What does this persona believe and why?"

2. **Revision memory (debate-scoped)** — Log of how beliefs changed during/after debates. CE-QArg already produces `RevisionResult` objects. Store these for traceability. Answers: "How did beliefs change and what triggered it?"

3. **Retrieval memory (corpus-backed)** — Raw grounding material. Already exists in `corpus/[Name].json` and `anchorExcerpts`. Closest to PRIME's semantic memory. Answers: "What specific evidence does this persona draw on?"

**What is NOT needed**: General-purpose episodic memory of "what happened in conversation." If belief revision works properly, the graph state captures the meaningful outcome. Narrative recall is what LLMs already do well without infrastructure.

### PRIME's Dual-Memory (Deeper Analysis)

**Source**: arXiv:2507.04607, EMNLP 2025.

PRIME separates:
- **Semantic memory**: A textual profile summary of the user's preferences, beliefs, and patterns (API-compatible form). Built once, updated periodically, treated as stable context. Maps to Faultline's `PersonaContract`.
- **Episodic memory**: Raw chronological interaction records. Retrieval is deterministic — the N most recent interactions (N=3-4). No semantic similarity scoring. Maps to past debate transcripts.

**Critical ablation result**:

| Component | Performance |
|---|---|
| Episodic alone | Weakest single component |
| Semantic alone | **Strongest single component** — more stable than episodic |
| Dual (both, no arbitration) | **Regresses below semantic-alone** — active memory interference |
| PRIME (dual + personalized thinking) | Beats all by 2-5 points |

**The key finding**: Naive combination of episodic and semantic memory *hurts* unless a reasoning step arbitrates between them. PRIME's "personalized thought process" generates persona-shaped intermediate reasoning ("how would this person think about this?") before generating the final response. For an API-only system, this is a lightweight Haiku call before the main Sonnet generation.

**Implication for Faultline**: `PersonaContract` is already the semantic memory and it's architecturally correct. Don't naively combine it with transcript history. If adding episodic memory, add an intermediate "how would [persona] reason about this?" Haiku call as an arbitrator — no architecture change needed, just a prompt engineering addition.

### ID-RAG: Identity-Separated Retrieval

**Source**: arXiv:2509.25299, MIT Media Lab, ECAI LLAIS 2025.

Core finding: **identity content must be structurally separated from interaction history in retrieval**. When core beliefs compete in the same retrieval pool as recent events, recency bias displaces them.

ID-RAG uses a "Chronicle" — a directed knowledge graph where nodes = beliefs, traits, values, preferences, goals; edges = temporal, causal, attributive relationships. Retrieved through a dedicated path, always wins over conversation history.

Faultline's `PersonaContract` already approximates a Chronicle. The `flipConditions` field contains implicit belief boundaries — the highest-quality grounded source. At current scale (11 personas), the flat-string approach works. At 50+ personas with large contracts, structured retrieval becomes necessary.

### R-Debater's Argumentative Memory

**Source**: arXiv:2512.24684, AAMAS 2026. Human eval: 76.32% win rate vs. baselines.

R-Debater stores each argument with:
- **Utterance text** + dense embedding
- **Argumentation scheme label** — 7 types from Walton's taxonomy: causal, value-based, expert opinion, analogical, consequence-based, example-based, positive/negative consequence
- **Per-scheme quality scores** — 4 levels (poor/general/good/excellent), labeled by LLM judges (inter-annotator: Jaccard=0.74, Cohen's kappa=0.72)

**Two-stage retrieval**: (1) keyword matching narrows candidates, (2) cosine similarity selects top-k, filtering out anything below "general" quality. Two parallel signals: a Logic Agent converts opponent utterances into pseudo-first-order predicates to identify logical flaws, and a Keyword Agent extracts terms for coarse retrieval.

**Iterative verification loop**: After generation, a Judgment Agent checks stance fidelity + scheme compliance + relevance (binary accept/reject). This prevents sycophantic drift — the agent rejects outputs that abandon the required stance.

**Key insight for Faultline**: The argumentation scheme taxonomy maps directly to Faultline's `DisagreementType`. When a persona makes a claim in a crux room, classify it by scheme type via Haiku. Use **scheme-type shifts mid-debate** as a sycophancy signal (e.g., switching from empirical to value-based when the empirical case is losing).

The QBAF structure already captures the Toulmin argument format (claim = root, grounds = support, rebuttal = attack). R-Debater adds: store *successful* argument sub-trees for reuse across debates on related topics.

---

## Q4: Persona Creation Flow

### GenMinds' Approach: Semi-Structured Causal Interviews

GenMinds prescribes (Section 5.1):

1. **Interview**: LLM asks causal-explanatory questions ("Why do you support X?" "What does Y influence?"). These elicit *causal reasoning*, not opinions.
2. **Parse into DAG**: Responses become directed acyclic graph nodes and edges with confidence/polarity.
3. **Motif extraction**: Responses decomposed into reusable causal motifs.
4. **User review**: Human validates/corrects the generated graph.

### Recommended Faultline Persona Creation Flow

**For corpus-based personas (existing, e.g., real public figures):**

1. Corpus intake (existing: scrape Twitter/Substack)
2. Causal motif extraction (existing: `extract-beliefs.ts`)
3. Worldview synthesis (existing: `synthesize-worldviews.ts`)
4. Gap-filling interview (NEW): Where corpus doesn't cover a topic, LLM conducts simulated interview based on existing graph to extend coverage
5. User review (NEW): Present graph for human validation

**For user-created personas (new):**

1. Interactive interview: LLM asks causal-explanatory questions about the user's worldview
2. Real-time graph building: Each answer adds nodes/edges to a visible belief graph
3. Iterative refinement: User can correct edges, adjust confidence, add missing connections
4. Contract generation: Derive personality/bias/stakes/epistemology from the graph (reverse of current flow)

### Minimal Data for a Viable Persona

From GenMinds:
1. **A causal belief graph** on at least one domain: 10-20 nodes with causal edges, confidence scores, and source grounding
2. **Confidence distribution**: How strongly each belief is held
3. **Revision parameters**: How resistant to updating (maps to CE-QArg's R)

NOT minimally needed: full corpus of writings (helps voice but not reasoning), detailed personality prose, voice profiles (pure style layer).

---

## Q5: RECAP Benchmark

### What RECAP Is

RECAP (REconstructing CAusal Paths) is a **benchmark framework**, not a dataset. GenMinds Section 5.2: "RECAP is not a static dataset but a replicable schema for structured reasoning evaluation."

### Three Evaluation Dimensions

1. **Motif Alignment** — Structural similarity between human-derived and model-generated belief graphs. Does the agent's internal reasoning match real human reasoning patterns?

2. **Belief Coherence** — Internal consistency of reasoning traces across turns and debates. Does the agent contradict itself? Do stated beliefs follow from its causal graph?

3. **Counterfactual Robustness** — Sensible belief updates under `do()` interventions. When you intervene on the belief graph, do downstream beliefs update causally, or does the agent paraphrase its original stance?

### What "Genuine Epistemic Personality" Means

Current persona agents have **stylistic personality** (voice, tone) without **reasoning personality** (causal structure, revision behavior). "Genuine" means:
- The agent can trace WHY it believes X through a causal chain
- Belief updates follow from the graph, not from the LLM's training distribution
- Different agents with different graphs produce genuinely different reasoning paths, not just different-sounding outputs

### Practical RECAP Subset for Faultline

1. **Motif Alignment Test**: Present two personas with known belief graphs a new topic. Extract their QBAFs. Compare QBAF structure against source belief graph — does topic-scoped reasoning faithfully reflect the persona's broader worldview?

2. **Belief Coherence Test**: Run the same persona through 3 debates on related topics. Check whether positions in debate 3 are consistent with (or traceably revised from) debates 1 and 2, given the underlying graph.

3. **Counterfactual Robustness Test**: Take a persona's QBAF. Apply `do()` interventions corresponding to their `flipConditions`. Verify that (a) belief strengths update via DF-QuAD as expected, and (b) generated text reflects updated strengths rather than the original position.

Faultline already has infrastructure for all three (belief graphs, QBAF extraction, DF-QuAD, CE-QArg). Missing: the evaluation harness that runs these tests systematically.

---

## Q6: Gap Analysis — What to Build

### Priority-Ordered Gaps

**Gap 1: Runtime Integration Layer (CRITICAL)**

All belief graph infrastructure runs as batch scripts. The dialogue engine does NOT use the belief graph at runtime. This is the single highest-leverage change.

Build: An orchestration layer that:
- Scopes belief graph to debate topic at dialogue start
- Maintains live QBAF state throughout debate
- Feeds current belief strengths into prompt for each turn
- Applies belief revision after each round

**Gap 2: Intervention Simulation (MEDIUM)**

No function takes a persona's graph + hypothetical change and returns updated belief state. Needed for counterfactual reasoning.

Build: `simulateIntervention(agent, {nodeId, newValue}) -> RevisedState` that traces downstream effects through QBAF.

**Gap 3: Cross-Debate Persistence (MEDIUM)**

Each debate is stateless. Belief graph is never modified by debate outcomes. GenMinds requires beliefs to evolve across scenarios.

Build: Post-debate belief revision that applies outcomes to master belief graph with revision history.

**Gap 4: Motif Transfer for New Topics (MEDIUM)**

When a topic has no relevant beliefs, the system falls back entirely on the LLM. No mechanism for transferring reasoning patterns from known domains to new ones.

Build: Motif extraction that identifies reusable causal patterns and applies them by analogy.

**Gap 5: Evaluation Harness (LOW)**

No RECAP-style evaluation exists. No automated verification that debate output is consistent with belief graph.

Build: Test suite running personas through scenarios, checking motif alignment + belief coherence + counterfactual robustness.

**Gap 6: Interview-Based Persona Creation (LOW)**

Current pipeline is corpus-first. GenMinds proposes interview-first for custom personas.

Build: Interactive interview flow with real-time graph building and user review.

### What to Reuse As-Is

- `PersonaContract` — voice/style layer (GenMinds doesn't address this, Faultline needs it)
- `VoiceProfile` / `speech-roles.ts` — presentation layer, orthogonal to reasoning
- `BeliefGraph` extraction pipeline — already produces the causal graphs GenMinds wants
- `PersonaWorldview` + `AssumptionConflict` — motif aggregation and conflict identification
- `PersonaQBAF` + `df-quad.ts` + `belief-revision.ts` — core reasoning engine
- `community-graph.ts` — multi-agent graph analysis
- `buildConsolidatedPrompt()` — keep but augment with live belief state

---

## Empirical Findings: Belief Revision Failure Modes

Research surfaced two distinct failure modes that directly affect Faultline's crux rooms.

### Failure Mode A: Anti-Bayesian Confidence Escalation

**Source**: arXiv:2505.19184.

| Condition | Opening Confidence | Closing Confidence | Delta |
|---|---|---|---|
| Cross-model debate | 72.9% | 83.3% | +10.3% |
| Self-debate (identical copy) | 64.1% | 75.2% | +11.1% |
| Explicit 50% anchor given | 50.0% | 57.1% | +7.1% |

In 61.7% of cross-model debates, both sides simultaneously claimed 75%+ win probability — mathematically impossible. Mechanism: RLHF rewards confident-sounding responses; debate context activates "defend my position" mode; the model generates more persuasive versions of its initial position rather than updating on counter-arguments.

**Most effective mitigation**: Self red-teaming prompt — "before responding, explicitly consider why your opponent could win." Reduced escalation from 10.34% to 3.05%. One sentence in the prompt, ~70% reduction.

### Failure Mode B: Sycophantic Drift

**Source**: CONSENSAGENT (ACL 2025 Findings), arXiv:2509.23055.

Sycophancy is **round-progressive**: lowest in round 1, accumulates with each subsequent exchange. Correlation between abandoning correct positions and sycophancy score: **Pearson r = 0.902**. Almost entirely explained by sycophancy, not genuine persuasion.

Mixed configurations (some "troublemakers" who resist consensus, some "peacemakers" who seek it) outperform homogeneous setups by up to 5.9 percentage points on accuracy.

**Implications for crux rooms**: Current 16-turn maximum is too permissive. Sycophancy damage concentrates after round 3 per persona. A cap of 6-8 total turns (3-4 per persona) before forced convergence check is better calibrated. Faultline's bounded exchange structure in `runCruxRoom()` already supports this — it's a constant change.

---

## Quick Wins (Zero Architecture Change)

These recommendations require only prompt engineering or constant changes, ordered by implementation cost:

### 1. Self Red-Teaming in Crux Exchange Prompts

In `lib/crux/prompts.ts`, add to `earlyExchangePrompt` and `lateExchangePrompt`: "Before responding, identify the strongest version of [opponent]'s position and articulate one point where they could be correct." Cost: one sentence. Impact: ~70% reduction in confidence escalation.

### 2. Position-Change Justification in Convergence Check

When a persona's stated position at convergence differs from Phase 1, `convergenceCheckPrompt` should require them to cite the specific argument that moved them. Makes sycophantic drift detectable and improves crux card quality.

### 3. Tighten Crux Room Round Cap

Reduce from 16 to 6-8 total turns before forced convergence check. One constant change in `orchestrator.ts`.

### 4. Intermediate Persona Reasoning Step

Before each crux exchange Sonnet call, make one Haiku call: "Given that [persona] holds [relevant contract snippet], how would they frame their position on [crux question]?" Feed this into the main generation. This is PRIME's personalized thought process adapted for API use (~$0.001 per turn).

### 5. Argumentation Scheme Tagging

Classify each crux room claim by scheme type (causal, value, empirical, analogical, definitional) via lightweight Haiku call. Store alongside positions. Use scheme-type shifts as a sycophancy signal. R-Debater's core insight adapted as post-processing.

---

## Architectural Decision: Where Does Reasoning Happen?

GenMinds poses a fundamental question: **Is the LLM the reasoner, or is the graph the reasoner?**

### Option A: LLM-Primary (Current Faultline)
The LLM generates all reasoning. The belief graph is supplementary context fed into the prompt. Simple to implement, but GenMinds argues this produces "locally plausible but globally incoherent" output.

### Option B: Graph-Primary (Pure GenMinds)
The graph drives all reasoning. The LLM is just a language interface that translates graph operations into natural language. Maximally consistent, but may produce stilted/mechanical output since the LLM can't freely reason.

### Option C: Hybrid (Recommended)
The graph provides **constraints and priors** that the LLM must respect. The LLM generates freely within those constraints. Specifically:
- Graph determines the persona's position (which side of each claim they land on, and how strongly)
- Graph provides the reasoning structure (which causal chains to invoke)
- LLM generates natural language that faithfully expresses the graph-derived position
- Post-generation validation checks that output is consistent with graph state

This preserves Faultline's natural dialogue quality while adding GenMinds' structural grounding. The prompt evolves from static prose to **graph-informed dynamic context**.

---

## Refined Agent Type (Synthesizing GenMinds + PRIME + R-Debater + ID-RAG)

Applying CoALA's four-way memory taxonomy (working/episodic/semantic/procedural) to Faultline:

```typescript
interface PersonalityAgent {
  // STATIC LAYER — never changes during debate (semantic + procedural memory)
  identity: {
    persona: Persona
    contract: PersonaContract          // semantic: values, biases, epistemology
    voiceProfile: VoiceProfile         // procedural: speech patterns, forbidden phrases
    beliefGraph: BeliefGraph           // structural: master causal graph
    worldview: PersonaWorldview        // structural: clustered positions + assumptions
  }

  // VOLATILE LAYER — updated per round (episodic memory)
  episodic: {
    roundSummaries: RoundSummary[]     // compressed, not raw transcript
    revisionHistory: RevisionEvent[]   // when/why beliefs changed, with citing argument
  }

  // POSITION STATE — updated per crux exchange (working memory)
  positions: Map<string, {
    stance: number                     // confidence in [-1, 1]
    justification: string             // argument that last moved this
    schemeType: ArgumentScheme        // causal, value, empirical, etc.
    history: PositionDelta[]          // full audit trail
  }>

  // TOPIC-SCOPED — ephemeral, per-debate
  activeQBAF: PersonaQBAF | null
  activeMotifs: CausalMotif[]
}
```

Three independent retrieval paths (per ID-RAG):
1. **Identity retrieval**: Always included at full fidelity, prepended to system prompt — never truncated, never displaced by recency
2. **Episodic retrieval**: Bounded recency window (last 4 exchanges + round summaries) — may be compressed
3. **Position retrieval**: Full audit trail for claims under discussion in the active crux room

---

## Open Research Gaps (No Paper Addresses These)

1. **Multi-persona memory interference in group dialogue (3+ personas)**: All studies are single-agent or pairwise. One persona's arguments appearing in another's retrieval context is unstudied.
2. **Real-person persona fidelity under adversarial pressure**: ID-RAG studies use constructed identities. Real public intellectuals have nuanced/contradictory positions that a static Chronicle can't fully capture.
3. **Genuine vs. performative belief revision**: No paper cleanly separates "the model genuinely updated" from "the model produced a position change for rhetorical effect." Core epistemic integrity problem for crux cards.
4. **Embedding reasoning patterns**: Literature covers embedding beliefs (content) and style (voice). Embedding *how a persona argues* — characteristic inferential moves — is largely unexplored. R-Debater's scheme taxonomy is the closest but operates at utterance level, not persona level.

---

## Next Steps

1. **Implement Quick Wins 1-3** — zero architecture change, immediate crux room quality improvement
2. **Design the `PersonalityAgent` type** and pure function signatures
3. **Wire belief graphs into the dialogue loop** (Gap 1 — the critical path)
4. **Implement intervention simulation** (Gap 2 — enables counterfactual reasoning in crux rooms)
5. **Add cross-debate persistence** (Gap 3 — makes agents stateful)
6. **Build RECAP evaluation harness** (Gap 5 — validates the system works)
7. **Design persona creation interview flow** (Gap 6 — user-facing feature)

---

## Sources

- GenMinds paper (analyzed via genminds-expert agent)
- [PRIME: LLM Personalization with Cognitive Dual-Memory, EMNLP 2025](https://arxiv.org/abs/2507.04607)
- [R-Debater: Retrieval-Augmented Debate via Argumentative Memory, AAMAS 2026](https://arxiv.org/abs/2512.24684)
- [ID-RAG: Identity RAG for Long-Horizon Persona Coherence, ECAI LLAIS 2025](https://arxiv.org/abs/2509.25299)
- [When Two LLMs Debate, Both Think They'll Win](https://arxiv.org/abs/2505.19184)
- [CONSENSAGENT: Sycophancy Mitigation in Multi-Agent LLM, ACL 2025 Findings](https://aclanthology.org/2025.findings-acl.1141/)
- [Peacemaker or Troublemaker: Sycophancy in Multi-Agent Debate](https://arxiv.org/abs/2509.23055)
- [The Geometry of Persona: Disentangling Personality from Reasoning](https://arxiv.org/abs/2512.07092)
- [CoALA: Cognitive Architectures for Language Agents](https://arxiv.org/abs/2309.02427)
