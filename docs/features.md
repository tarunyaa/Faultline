# Faultline - Features

Multi-Agent Socratic Seminar Grounded in Real Voices.

---

## Core Product

### What Faultline Does
Faultline is a debate room for the internet's most influential viewpoints. Users spin up AI agents with personas modeled on specific real-world voices and watch them challenge each other in a Socratic seminar. The system doesn't force agreement — it distills debate into **the crux**: the few assumptions driving the split, and the flip conditions that would actually change each position.

### The Atomic Unit of Value: The Disagreement Map
Faultline's output is a structured map of why credible perspectives diverge and what would resolve the disagreement.

- No forced consensus
- Clear sources of disagreement (time horizon, assumptions, values, identity)
- Explicit flip conditions per agent (what evidence would change each position)
- "What would settle this?" summary

---

## Persona System

### Profile Structure (7 files per persona)

1. **personality.md** — Voice, rhetorical habits, confidence style
2. **bias.md** — Priors, blind spots, recurring failure modes
3. **stakes.md** — Incentives, preferred outcomes, exposure
4. **epistemology.md** — How they form beliefs (data / narrative / first principles)
5. **time_horizon.md** — What timeframe their reasoning optimizes for
6. **flip_conditions.md** — What evidence would actually change their mind
7. **rules.md** — Debate behavior (agents try to WIN and CONVERT, not just state views)

### Grounding
Personas are continuously grounded in public material: Twitter/X, Substack, transcripts, Wikipedia, forums, SEC filings, Reddit posts. Agents are tool-connected and can pull fresh information in real time during debates.

### Piece Types (Personality Archetypes)

Each personality is assigned a chess piece type based on behavior:

| Piece | Role | Description |
|---|---|---|
| **King** | Anchor | Keeps the room coherent, stabilizes the debate |
| **Queen** | High-agency arguer | High-coverage, aggressive, wide-ranging |
| **Bishop** | Ideological thinker | First-principles, long-diagonal reasoning |
| **Knight** | Contrarian | Jumpy, unexpected attacks, lateral thinking |
| **Rook** | Operational realist | Execution-focused, concrete constraints |
| **Pawn** | Community cluster | Sentiment, crowd wisdom, reality check |

### Playable Personalities (v1)

| Personality | Piece Type |
|---|---|
| Altman-style Builder | Queen |
| Musk-style Contrarian | Knight |
| Jensen-style Infra Realist | Rook |
| Buffett-style Value Investor | Bishop |
| Reddit Skeptic Cluster | Pawn |

### The Bench (Locked / Coming Soon)

| Personality | Piece Type |
|---|---|
| Regulator / Antitrust Hawk | Rook |
| Open-source Maximalist | Bishop |
| Security Researcher | Knight |
| Macro Liquidity Trader | Queen |
| Academic ML Skeptic | Bishop |
| Consumer Product PM | Rook |
| Labor Economist | Bishop |

---

## Custom Persona Creation

Users can create their own personas by providing their own data sources. This allows anyone to build a debater grounded in specific real-world voices, communities, or viewpoints that aren't in the pre-built roster.

### Supported Data Sources

- **Reddit accounts / subreddits** — Feed a username or subreddit to capture voice, positions, and community sentiment
- **Twitter/X accounts** — Ingest public tweets to model rhetorical style and stances
- **Substack / blog URLs** — Long-form writing for deeper epistemological grounding
- **YouTube / podcast transcripts** — Capture spoken argumentation style
- **Custom text uploads** — Paste or upload documents, essays, manifestos, research papers
- **RSS feeds** — Continuous grounding from ongoing content sources

### Creation Flow

1. User names the persona and selects a piece type (King/Queen/Bishop/Knight/Rook/Pawn)
2. User provides one or more data sources (URLs, usernames, uploads)
3. System ingests and analyzes the material
4. System auto-generates the 7 profile files (personality, bias, stakes, epistemology, time_horizon, flip_conditions, rules)
5. User can review and edit each profile file before finalizing
6. Persona becomes available in the user's personal library for lineup selection

### Use Cases

- Model a specific pundit, analyst, or thought leader not in the default roster
- Create a persona from a subreddit community (e.g., r/wallstreetbets, r/machinelearning)
- Build a persona from your own writing to see how your views hold up under scrutiny
- Combine multiple sources into a synthetic voice (e.g., "crypto Twitter + macro newsletter")

---

## Debate Mechanics

### Flow
1. User enters a topic and selects agents (or uses Auto-balance)
2. Agents debate, streaming responses in real time
3. Each agent tries to WIN and CONVERT others to their position
4. When disagreement persists after 3 convince attempts, the system extracts the flip condition
5. Debate continues until all major flip conditions are found or max rounds reached
6. System synthesizes the Disagreement Map

### Match Modes

| Mode | Agents | Rounds | Style |
|---|---|---|---|
| **Blitz** | 3 | Fewer rounds, faster | Quick takes |
| **Classical** | 5 | More rounds, deeper | Thorough analysis |

### Debate Styles (Toggleable)
- Adversarial
- Cooperative
- Evidence-first
- First-principles
- Time-horizon split

### Flip Condition Detection
- **Explicit**: Agents use structured format (`FLIP_CONDITION: I would change my mind if...`)
- **Implicit**: After 3 failed convince attempts, orchestrator asks for minimum evidence that would change position

### Dispute Tracking

Disagreements are tracked as structured dispute objects keyed by claim and agent pair. Each dispute records convince attempts and resolves into a flip condition or stalemate.

```json
{
  "claimId": "ai_bubble_is_irrational_exuberance",
  "agents": ["musk", "huang"],
  "attempts": 2,
  "status": "open",
  "flipCondition": null
}
```

Any time either agent posts about a tracked claim, attempts increment until resolution or flip condition extraction. This works across all orchestration modes.

---

## Debate Orchestration

The orchestration system evolves across four phases, each building on the last. The system is designed so the scheduler is swappable — MVP ships with round-robin, but the debate flow upgrades without rewriting the core.

### Phase 1: Round-Robin (MVP)

Agents take turns in fixed order with a shared transcript. Deterministic, easy to debug, and reliably produces flip conditions + disagreement maps for 3-5 agents.

- All agents see the same ground truth transcript
- "3 tries → flip condition" rule is straightforward to enforce
- Streaming is simple (one agent at a time)

### Phase 2: Event-Driven Priority Queue

Replaces fixed turn order with dynamic scheduling. Every agent message becomes an **event** that can trigger replies from other agents. Generation remains sequential — one agent speaks at a time — but **who** speaks next is driven by urgency, not rotation.

**Turn candidates** enter a priority queue:

```ts
TurnCandidate = {
  agentId,
  replyToMessageId,
  reason: "OBJECTION" | "REQUEST_EVIDENCE" | "COUNTERARG" | "STEELMAN" | "CONCEDE",
  priority: number,
  expiresAt: time
}
```

When a new message arrives:
1. Lightweight classifier tags it (claim, evidence, attack, factual dispute, etc.)
2. Each other agent is asked: "Do you want to interject? Why? How urgent?" (cheap — small model / short prompt)
3. Candidates are pushed into the priority queue
4. Next speaker is popped by priority until a time/message budget is hit

This produces pile-ons, quick objections, and "wait, that's wrong" moments while staying controllable.

**Interruptions UI**: Even though generation is sequential, the UI renders it like interruptions — "Objection!" chips appear immediately when triggered, queued interjections show as pending moves, then content streams when scheduled. Feels chaotic, stays controllable.

### Phase 3: Blackboard + Retrieval (10-20 agents)

Full transcript injection breaks down at scale. With 20 agents, every agent reading the full transcript every turn costs too much, slows down generation, and degrades quality (too much noise in context). This phase replaces wholesale transcript injection with targeted context.

#### Shared Blackboard

A single structured state object that all agents can read. Updated after every message by the orchestrator.

```ts
Blackboard = {
  topic: string,
  cruxCandidates: Crux[],              // current open cruxes being debated
  disputes: Dispute[],                  // disagreement objects + attempt counters
  extractedFlipConditions: FlipCondition[], // resolved flip conditions
  toolResults: ToolResult[],            // latest tool outputs (search, financial, etc.)
  openQuestions: string[],              // unresolved questions the room is circling
  tableSummaries: TableSummary[],       // (Phase 4) summaries from parallel tables
  roundNumber: number,
  activeAgents: AgentId[]
}
```

The blackboard is the **ground truth** for the room. Agents reason from it, not from trying to parse a 50k-token transcript. The orchestrator updates it after each message: new cruxes get added, disputes get incremented, resolved flip conditions get promoted.

#### Message Store

The full transcript is persisted but **never injected wholesale** into any agent's context. It serves as a retrieval corpus.

```ts
MessageStore = {
  messages: Message[],                  // full ordered transcript
  index: EmbeddingIndex,               // vector index over message embeddings
  byAgent: Map<AgentId, Message[]>,     // messages grouped by speaker
  byDispute: Map<DisputeId, Message[]>, // messages grouped by dispute thread
  byClaim: Map<ClaimId, Message[]>      // messages referencing a specific claim
}
```

Messages are embedded on write. The store supports retrieval by semantic similarity, by agent, by dispute thread, and by claim reference.

#### Per-Agent Context Builder (RAG)

Each agent turn receives a **custom context window** assembled from three sources:

1. **Blackboard summary** — always included, ~500-1000 tokens. Gives the agent the current state of the debate without reading everything.
2. **Local neighborhood** — last N messages that are replies to/from this agent, or that directly reference this agent's claims. Keeps the agent's own thread coherent.
3. **Retrieved snippets** — top K messages from the message store, retrieved by embedding similarity to the current dispute/crux this agent is engaging with. Brings in relevant context from other parts of the debate the agent hasn't directly participated in.
4. **Tool outputs** — any tool results (web search, financial data, etc.) relevant to the current dispute.

```ts
buildAgentContext(agentId: AgentId, blackboard: Blackboard, store: MessageStore): AgentContext {
  const summary = renderBlackboard(blackboard)                    // ~500-1k tokens
  const local = store.byAgent.get(agentId).slice(-N)              // last N own-thread messages
  const dispute = getCurrentDispute(agentId, blackboard)
  const retrieved = store.index.query(dispute.embedding, K)       // top K relevant snippets
  const tools = getRelevantToolResults(dispute, blackboard)

  return { summary, local, retrieved, tools }                     // total: ~3-5k tokens
}
```

This means a 20-agent debate costs roughly the same per-turn as a 5-agent debate — each agent sees ~3-5k tokens of context instead of 50k+.

### Phase 4: Parallel Tables + Merge (Swarm)

For 20+ agents, even with blackboard + retrieval, a single room is too noisy. You don't actually want 20 agents speaking in one thread — you want **parallel sub-debates** with periodic merging.

#### Table Assignment

The orchestrator splits 20 agents into 3-5 **tables** of 4-6 agents each. Assignment is based on:

- **Crux affinity** — agents with opposing views on the same crux sit together (maximizes productive disagreement)
- **Piece type diversity** — each table gets a mix of piece types (Queen + Knight + Rook > three Bishops)
- **Dispute coverage** — ensure every open crux has at least one table working on it

```ts
Table = {
  tableId: string,
  agents: AgentId[],                    // 4-6 agents per table
  crux: Crux,                           // the sub-question this table is debating
  blackboard: Blackboard,               // table-local blackboard
  messageStore: MessageStore,           // table-local transcript
  status: "debating" | "resolved" | "merged"
}
```

#### Debate Phase

Each table runs its own debate independently (using Phase 2 or Phase 3 orchestration internally). Tables can run **in parallel** — multiple LLM calls happening concurrently across different tables.

- Each table debates its assigned crux for a fixed round budget
- Tables produce their own flip conditions, dispute resolutions, and local disagreement maps
- A table can resolve early if all disputes within it are settled

#### Merge Phase

After tables finish a round, a **merger step** reconciles findings across all tables:

1. **Collect** — gather each table's blackboard (cruxes found, flip conditions extracted, open disputes)
2. **Deduplicate** — identify overlapping cruxes and flip conditions across tables
3. **Rank** — score cruxes by how many tables surfaced them and how contested they remain
4. **Synthesize** — produce a merged blackboard with the top cruxes and a cross-table disagreement map
5. **Reassign** — optionally reshuffle agents into new tables for the next round based on updated cruxes

```ts
MergeResult = {
  mergedBlackboard: Blackboard,
  resolvedCruxes: Crux[],              // cruxes settled across all tables
  escalatedCruxes: Crux[],             // cruxes that need further debate
  nextTableAssignments: Table[],       // reshuffled tables for next round
}
```

#### Final Table

After 2-3 merge rounds, the system runs a **final table** with 3-5 representative agents (one per table, selected by the merger as the strongest voice for that table's position). The final table:

- Receives the merged blackboard from all rounds
- Debates the remaining escalated cruxes
- Produces the final disagreement map and flip condition set
- Runs using Phase 2 (event-driven) orchestration for maximum quality

#### Cost Model

| Phase | Agents | Context/turn | Parallelism | Cost scaling |
|---|---|---|---|---|
| Phase 1 | 3-5 | Full transcript | None | Linear with transcript length |
| Phase 2 | 3-5 | Full transcript + classifier | None | Linear + small classifier overhead |
| Phase 3 | 10-20 | ~3-5k tokens (RAG) | None | Near-constant per agent |
| Phase 4 | 20+ | ~3-5k tokens (RAG) | Tables run in parallel | Sub-linear (parallel tables) |

---

## The Roundtable (20-Agent Swarm Page)

A dedicated page for large-scale swarm debates. The visual centerpiece: a circular table with up to 20 agent avatars seated around it, debating in real time.

### Visual Layout

- **Circular table** at center of the screen, agents arranged around the perimeter as avatar nodes
- **Active speaker** is highlighted (glow, enlarged, or raised) — their response streams in a central panel or speech bubble
- **Table groups** are visually indicated — agents at the same sub-table share a color or arc segment
- **Connection lines** between agents show active disputes (thicker = more contested, red = unresolved, green = resolved)
- **Pending interjections** appear as small chips/icons next to agents who are queued to speak
- **Blackboard sidebar** shows the live shared state: current cruxes, flip conditions found, open questions

### Interaction

- User sets the topic and selects up to 20 agents from the full roster + bench + custom personas
- System auto-assigns tables based on crux affinity and piece type diversity (user can override)
- Debate runs with tables debating in parallel — the UI shows all tables simultaneously as segments of the roundtable
- User can click on any table segment to zoom into that sub-debate
- Merge phases are visualized as agents briefly "standing" and regrouping
- Final table is highlighted as the climactic phase — remaining agents move to the center

### Live State Display

The roundtable page surfaces the blackboard in real time:

- **Crux tracker** — cards for each crux, showing which tables are working on it, attempt counts, and resolution status
- **Flip condition feed** — flip conditions appear as they're extracted, attributed to the agent pair that produced them
- **Dispute graph** — a live network visualization showing which agents disagree on what, updated after each message
- **Table progress bars** — how far each table is through its round budget

### Postgame View

After the swarm debate concludes, the roundtable page transitions into a postgame view:

- The circular layout remains, but now shows the final disagreement map overlaid on the table
- Each agent's final position is summarized next to their avatar
- Resolved disputes show as green lines, unresolved as red
- The merged flip conditions are presented as the primary output
- Full transcript is available per-table, with cross-references to the merge steps

---

## Recent Public Debates

A public-facing page that showcases completed debates for discovery and replay.

- Lists recently completed debates with topic, agents involved, and key cruxes found
- Users can browse and read full debate transcripts + disagreement maps
- Acts as a landing page / social proof for new users
- Debates can be featured or sorted by engagement / quality
- Links directly into the postgame analysis report for any debate
- Roundtable swarm debates are featured prominently with a visual preview of the circular layout

---

## Tool Integration

Agents are tool-connected and can fetch real data during debates:

- **Twitter/X search** — Recent tweets by keyword or user
- **Stock / financial data** — Current prices, metrics, filings
- **Web search** — Current information and news
- **Arcade API** — Various data sources and integrations

---

## Pages

| Page | Description |
|---|---|
| **Home / Lobby** | Landing page, start a new debate or browse recent ones |
| **Room Setup** | Select topic, pick agents from roster + bench, choose match mode and style |
| **Debate Room** | Live debate view with streaming agent responses |
| **Postgame (Analysis Report)** | Disagreement map, flip conditions, full transcript |
| **Recent Public Debates** | Browse and replay completed public debates |
| **Personalities Library** | Browse all available personas and their piece types |
| **Personality Profile** | Deep dive into a single persona's 7 profile files |
| **Custom Persona Creation** | Build your own persona from data sources |
| **Account / Settings** | User preferences and configuration |

---

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), Tailwind CSS (dark theme)
- **LLM**: Anthropic Claude (via SDK, streaming)
- **APIs**: Arcade API, X Toolkit, financial APIs
- **State**: In-memory (MVP), Redis/DB (production)
- **Deployment**: Localhost (MVP), Vercel (production)

---

## Roadmap

### MVP (ship first)
1. Home / Lobby
2. Room Setup (with Bench)
3. Debate Room (Phase 1 round-robin orchestration)
4. Postgame (Analysis Report)

### Near-term
5. Personalities Library
6. Personality Profile
7. Recent Public Debates

### Post-MVP
8. Custom Persona Creation
9. Phase 2 orchestration (event-driven priority queue + interruptions UI)
10. Account / Settings
11. Persistent storage + user accounts
12. Real tool integrations (Arcade, X API, financial APIs)
13. Advanced visualizations (hexagon charts, network graphs)
14. Export (PDF/Markdown)

### Long-term
15. Phase 3 orchestration (blackboard + retrieval for 10-20 agents)
16. Phase 4 orchestration (parallel tables + merge for swarm)
17. Real-time collaboration (multiple users watch/influence)
18. Analytics (common flip conditions, successful arguments)
