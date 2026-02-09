# Faultline — Feature Specification

## Pages & Navigation

### Lobby (`/`)
- Landing page: title, tagline
- "Enter the room" button → cards page
- Reference code gate (deferred — not implemented now)

### Cards (`/cards`)
- Browse personas organized into **decks** (topic-specific collections)
- Grid of persona cards per deck
- Each persona displays as a small card: **name, Twitter handle, Twitter picture**
- Locked cards shown grayed out
- Each persona assigned a **card suite** based on voice archetype (future feature)
- Clicking a card → expand to show one-sentence summary of each persona dimension

### Card Detail (`/cards/[id]`)
- Full persona card view
- One-sentence summaries of all 6 contract dimensions:
  - **Personality** — voice, rhetorical habits, confidence style
  - **Bias** — priors, blind spots, recurring failure modes
  - **Stakes** — incentives, preferred outcomes, exposure
  - **Epistemology** — how they form beliefs (data / narrative / first principles)
  - **Time horizon** — what timeframe their reasoning optimizes for
  - **Flip conditions** — what evidence would actually change their mind
- "Add to hand" button

### Hand Builder / Setup (`/setup`)
- Selected deck shown
- Hand of 3–8 persona cards displayed
- Add/remove cards
- Topic input field
- "Deal" button → starts debate

### Game Room (`/match/[id]`)
- Polygon visualization with each agent at a vertex
- Edges highlight when two agents communicate
- Streaming agent messages
- Sidebar: convergence metrics, crux list, flip conditions
- Final output: disagreement map display
- Vertex shading for/against over time

### Recent Public Debates (future)
- Page listing past debates with transcripts or replays

---

## Persona System

### Data Ingestion Pipeline (Automated via X API + Substack + Claude)
Script: `scripts/build-personas.ts`

The ingestion pipeline is **fully automated**. It fetches real content from X (Twitter) and/or Substack, then uses Claude to analyze the content and generate structured persona contracts.

**Content sources per persona** (either or both):
- **X API** — fetches last 100 tweets (configurable), excludes retweets, includes engagement metrics
- **Substack RSS** — fetches up to 20 recent posts (configurable), strips HTML to plain text, truncates to ~2000 chars per post

**Script flow per persona** (9 Claude calls total):
1. **Fetch profile** — X API: name, profile_image_url
2. **Fetch content** — X: paginate user timeline. Substack: parse RSS feed.
3. **Filter** (1 Claude call) — returns indices of ~50 most relevant/opinionated items for the deck topic
4. **Generate contract fields** (6 Claude calls) — one per text field (personality, bias, stakes, epistemology, timeHorizon, flipConditions)
5. **Generate evidence policy** (1 Claude call) — returns JSON matching `EvidencePolicy` type
6. **Select anchor excerpts** (1 Claude call) — picks 10-15 most representative quotes with source URLs
7. **Write files**: contract JSON + raw corpus JSON

**CLI interface**:
```bash
cd faultline && npm run build-personas
npm run build-personas -- --only persona-a
```

**Manual fallback**: If automated builder doesn't work for a persona (private account, no X/Substack presence), contracts can be created by hand by collecting 30-50 excerpts and writing each field manually.

### Persona Core Contract
JSON as source of truth, stored in `data/seed/contracts/{id}.json`.

Generated from corpus via Claude:
- Extract priors, rhetorical patterns, epistemology, flip templates
- Link each claim to supporting anchor excerpts (auditability)
- Each field is 3-5 sentences of flowing prose, specific and falsifiable

Contract fields:
- `personality` — voice, rhetorical habits, confidence style
- `bias` — priors, blind spots, recurring failure modes
- `stakes` — incentives, preferred outcomes, exposure
- `epistemology` — how they form beliefs
- `timeHorizon` — what timeframe their reasoning optimizes for
- `flipConditions` — what evidence would actually change their mind

### Evidence Policy (per persona)
- **Acceptable sources**: SEC filings, audited financials, benchmarks, primary docs
- **Unacceptable sources**: rumor, unaudited screenshots, anonymous claims
- **Weighting rules**: hard data > anecdotes
- **Tool-pull triggers**: when to demand fresh data (if factual disagreement)

### Versioning
- Each persona contract is tied to the timestamp of the corpus build (ISO timestamp)

### Seed Data Structure
```
data/seed/
  deck-config.json            — input config (user fills in)
  personas.json               — generated deck + persona metadata
  contracts/
    elon.json                 — generated full persona contract
    sam.json
    jensen.json
  corpus/                     — generated raw content (for later DB import)
    elon.json
    sam.json
    jensen.json
```

### Training from Debates (future)
- Can completed debates feed back into persona training?

---

## Retrieval Engine (deferred until after debate engine is proven)

### V1: Pure Semantic Search
- pgvector cosine similarity on embeddings (Voyage AI `voyage-3`)
- Filters: persona_id, source_type, date_range
- Return top K chunks with scores
- Sufficient for corpus sizes of hundreds of chunks per persona

### V2: Hybrid Search (add if retrieval quality is poor)
- Postgres full-text search with `tsvector`/`tsquery`
- **Reciprocal Rank Fusion**: `score = Σ 1/(k + rank_i)` with k=60
- Suggested weights: **40% keyword / 60% semantic** — persona opinions use varied vocabulary, so semantic similarity is more valuable than exact keyword match
- Normalize both result sets to the same candidate pool before fusing

### Message Store Retrieval
- Past debate messages stored with embeddings, retrievable by similarity to current crux/dispute
- Async embedding after each agent turn (fire-and-forget, available next turn)
- Self-filtering: exclude requesting agent's own messages to prevent circular reasoning
- Budget: top 3-5 retrieved messages per agent turn, ~200 tokens each

### Retrieval Caching
Skipped. Embedding lookups against pgvector are fast for corpus sizes of a few hundred chunks per persona.

---

## Debate Modes

### Blitz Mode (implement first)
Purpose: quickly generate convergence or divergence on a topic.

**Claim Decomposition**
- Convert the user's question into 2–4 specific, testable claims
- Each claim has a clear pro/con framing

**Agent Initialization**
- Load persona contracts for all agents in the hand
- For each agent × claim: generate initial stance + confidence via LLM
- Retrieve relevant corpus chunks per agent per claim

**Table Assignment (for 7+ agents)**
- For small hands (3–6 agents): single table, skip sharding
- For 7+ agents: split into tables of 4–6
- Assignment based on **crux affinity** — agents with opposing stances on the same crux sit together
- Ensure dispute coverage — every crux has at least one table

**Agent Context Window Assembly**
Each agent turn receives a custom context from five sources:
1. **Blackboard summary** (~500–1000 tokens) — current state of the debate
2. **Local neighborhood** — last N messages involving this agent
3. **Retrieved snippets** — top K messages by embedding similarity to current crux
4. **Corpus grounding** — relevant persona corpus chunks
5. **Tool outputs** — web search, financial data, etc. relevant to current dispute

Token budget: ~6–8K per turn (configurable). Budget allocation: blackboard ~1K, local neighborhood ~2K, retrieved snippets ~1.5K, corpus ~2K, tool outputs ~1K.

**Table Debate**
- V1: round-based parallelism — all agents in a table respond simultaneously based on previous round's blackboard
- Agents do NOT see each other's current-round output — they react to the last round's state
- Each agent LLM call returns structured output:
  - `response`: debate contribution text
  - `stance`: pro | con | uncertain (per claim)
  - `confidence`: 0.0–1.0 (per claim)
  - `new_cruxes`: newly identified disputed propositions
  - `flip_triggers`: any flip conditions met this round
- Round budget per table: 3–5 rounds (configurable)
- Tables run in parallel (concurrent LLM calls across tables)

**Merge Phase**
Cadence: **tables run 1 round → pause → merge → reassign → next round.** Tables do NOT run all rounds independently then merge once. Merge happens between every round so crux discoveries in one table can influence others.

Flow per merge cycle:
1. **Collect** — gather each table's blackboard
2. **Deduplicate** — identify overlapping cruxes and flip conditions (LLM-assisted semantic dedup)
3. **Rank** — score cruxes by tables that surfaced them × contestation level
4. **Synthesize** — produce merged blackboard with top cruxes and cross-table disagreement map
5. **Reassign** — optionally reshuffle agents based on updated cruxes
6. **Coverage check** — ensure every open crux has at least one table

Run 2–3 merge cycles total.

**Final Table**
After merge rounds:
- 3–5 representative agents (one per table, strongest voice)
- Receives merged blackboard as context
- V1: runs using the same blitz debate loop (single table, same structured output)
- Produces final stances and remaining disputes
- Future upgrade: run final table using Classical mode for higher-quality natural dialogue

### Classical Mode (after blitz is solid)
Purpose: capture nuanced conversational phenomena (interruptions, agreement, rebuttal, deliberate silence).

**Action Plans**
- Each turn, agents generate action plans based on dialogue history, internal reasoning, conversational context
- Plans specify: speak / interrupt / listen, urgency level, communicative intent

**Dynamic Speaker Selection**
- Next speaker determined by highest urgency score
- If all agents choose to listen → silent turn occurs

**Sentence-by-Sentence Output**
- Speech output sentence by sentence
- Agents continuously update action plans
- Enables context-sensitive interruptions

**Shared Blackboard**
- Same blackboard architecture from blitz mode
- Updated continuously rather than per-round

**Tool Access**
- Agents can pull fresh data: prices, filings, posts, world news
- RAG as selective grounding pass — when agents want to reference past statements
- Citations appear in sidebar (not inline in conversation), alongside tool calls and results

---

## Convergence & Divergence (Quantitative)

For each claim, each agent outputs:
- **Stance**: `pro | con | uncertain`
- **Confidence**: `0.0 – 1.0`

Computed metrics:
- Entropy of stances: `-Σ p(stance) * log(p(stance))`
- Confidence-weighted distance: `Σ |conf_i - conf_j|` (pairwise)
- Number of unresolved cruxes with weight above threshold

### Stop Conditions
- **Converged**: ≥80% of confidence mass on one side AND no unresolved crux with high weight
- **Diverged**: entropy stays high for N events AND crux set stabilizes (no new crux discovered)
- **Safety cap**: maximum events limit

---

## Final Outputs (Disagreement Map)

Generated by an orchestrator LLM reviewing the transcript:

1. **Cruxes** — smallest set of disputed propositions that drive divergence
2. **Fault lines** — categories of disagreement (time horizon, assumptions, identity/values)
3. **Flip conditions** — specific evidence or events that would change each agent's position
4. **Evidence ledger** — what each agent accepts as valid evidence, plus rejection reasons
5. **Resolution paths** — experiments or data that could settle this

---

## Future Features
- **Reference code gate** for lobby access
- **Card suites** based on voice archetype
- **Locked cards/decks** with gating
- **Custom user cards** — connect your own notes/profile or someone else's; app generates a card
- **Recent public debates page** with transcripts/replays
- **Debate-driven persona training** — use completed debates to improve agents
