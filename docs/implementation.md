# Faultline — Implementation Plan

## Guiding Principles
- **Functionality over aesthetics.** Get the debate engine working before polishing UI.
- **Blitz mode first.** Classical mode comes after blitz is proven.
- **Quantitative convergence.** No vibes-based stopping — entropy, confidence mass, crux stability.
- **Auditability.** Every agent claim links back to corpus excerpts. Every stance is logged with confidence.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│  Lobby │ Cards/Decks │ Hand Builder │ Game Room      │
└────────────────────┬────────────────────────────────┘
                     │ SSE
┌────────────────────▼────────────────────────────────┐
│                  API Layer                           │
│  /api/debate (SSE)  │  /api/personas  │  /api/decks │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│              Blitz Orchestrator                      │
│  Claim Decomposer → Table Assigner → Debate Runner  │
│  → Merger → Final Table → Output Generator          │
└──────┬──────────────┬───────────────────────────────┘
       │              │
┌──────▼──────┐ ┌─────▼──────────┐
│  Retrieval  │ │  LLM Gateway   │
│  Engine     │ │  (Anthropic)   │
│  BM25 + Vec │ │  + Tool Router │
└──────┬──────┘ └────────────────┘
       │
┌──────▼──────────────────────────────────────────────┐
│              Postgres + pgvector                     │
│  personas │ corpus_chunks │ contracts │ debates      │
│  messages │ stances │ blackboards │ claims           │
└─────────────────────────────────────────────────────┘
```

---

## Phase 0: Project Foundation

### 0.1 Project Setup
- Initialize Next.js (App Router, TypeScript, Tailwind CSS)
- Dark theme base config
- Project directory structure:
  ```
  faultline/
    app/           — pages and API routes
    lib/
      db/          — database client, schema, migrations
      retrieval/   — hybrid search engine
      orchestrator/— debate engine (blitz + classical)
      personas/    — persona loading, contract generation
      llm/         — Anthropic client, prompt templates
      types/       — shared TypeScript types
    data/
      seed/        — initial persona corpus data (manual)
    scripts/       — ingestion, embedding, migration scripts
  ```

### 0.2 Database Setup
- Postgres with pgvector extension
- Schema migration system (Drizzle ORM or Prisma — decide during implementation)
- Core tables (see Phase 1)

### 0.3 Core Types
```typescript
type PersonaId = string
type DeckId = string
type Stance = 'pro' | 'con' | 'uncertain'
type DebateMode = 'blitz' | 'classical'

interface Persona {
  id: PersonaId
  name: string
  twitterHandle: string
  twitterPicture: string
  deckIds: DeckId[]
  suite: string | null        // future: card suite
  locked: boolean
}

interface PersonaContract {
  personaId: PersonaId
  version: string             // ISO timestamp of corpus build
  personality: string
  bias: string
  stakes: string
  epistemology: string
  timeHorizon: string
  flipConditions: string
  evidencePolicy: EvidencePolicy
  anchorExcerpts: AnchorExcerpt[]
}

interface EvidencePolicy {
  acceptableSources: string[]
  unacceptableSources: string[]
  weightingRules: string
  toolPullTriggers: string
}

interface Claim {
  id: string
  text: string
  debateId: string
}

interface AgentStance {
  personaId: PersonaId
  claimId: string
  stance: Stance
  confidence: number          // 0.0 – 1.0
  round: number
}

interface BlackboardState {
  topic: string
  claims: Claim[]
  cruxCandidates: Crux[]
  disputes: Dispute[]
  flipConditions: FlipCondition[]
  openQuestions: string[]
  stances: AgentStance[]
}

interface Crux {
  id: string
  proposition: string
  weight: number              // how contested
  surfacedByTables: number[]
  resolved: boolean
}

interface FlipCondition {
  personaId: PersonaId
  condition: string
  claimId: string
  triggered: boolean
}

interface Dispute {
  claimId: string
  sides: { personaId: PersonaId; stance: Stance; confidence: number }[]
}

// Convergence metrics
interface ConvergenceState {
  entropy: number
  confidenceWeightedDistance: number
  unresolvedCruxCount: number
  converged: boolean          // ≥80% confidence mass on one side + no high-weight unresolved crux
  diverged: boolean           // entropy high for N events + crux set stable
  eventCount: number
  maxEvents: number
}
```

---

## Phase 1: Persona Data Layer

### 1.1 Database Schema

**Stack**: Drizzle ORM + `postgres` driver + pgvector. Schema defined in `lib/db/schema.ts`.

**Infrastructure**: `docker-compose.yml` at repo root runs `pgvector/pgvector:pg17` on port 5432.

```bash
# Start Postgres
docker compose up -d

# Push schema to DB (no migration files, direct sync)
cd faultline && npm run db:push

# Or generate + run migrations
npm run db:generate && npm run db:migrate

# Seed DB from file-based seed data
npm run db:seed

# Browse data
npm run db:studio
```

Tables:
- **decks** — id, name, slug, locked, created_at
- **personas** — id, name, twitter_handle, twitter_picture, locked, suite, created_at
- **persona_decks** — persona_id, deck_id (composite PK, many-to-many)
- **corpus_chunks** — id, persona_id, content, source_type, source_url, source_date, embedding (vector(1024)), chunk_index, created_at
- **persona_contracts** — id, persona_id, version, contract_json (jsonb), created_at

> **Note on embedding dimension**: Using 1024 (Voyage AI `voyage-3`) since the rest of the stack is Anthropic-native. If switching to OpenAI `text-embedding-3-small`, change to `vector(1536)`. Decide before creating the table.

> **Note on `contract_json`**: Storing the full contract as a JSONB blob is fine for MVP reads. If you later need to query individual fields (e.g., "find all personas whose epistemology mentions Bayesian reasoning"), extract key fields into dedicated columns.

**Env vars** (in `.env.local`):
```
DATABASE_URL=postgresql://faultline:faultline@localhost:5432/faultline
```

### 1.2 Data Ingestion Pipeline (Automated via X API + Substack + Claude)
Script: `scripts/build-personas.ts`

The ingestion pipeline is **fully automated**. It fetches real content from X (Twitter) and/or Substack, then uses Claude to analyze the content and generate structured persona contracts.

**Content sources per persona** (either or both):
- **X API** — fetches last 100 tweets (configurable), excludes retweets, includes engagement metrics. Requires X API Basic tier ($100/mo) for user timeline access.
- **Substack RSS** — fetches up to 20 recent posts (configurable), strips HTML to plain text, truncates to ~2000 chars per post.

**Dependencies**: `twitter-api-v2`, `@anthropic-ai/sdk`, `dotenv`, `rss-parser`, `tsx` (devDep)

**Env vars** (in `.env.local`):
```
X_BEARER_TOKEN=your_twitter_bearer_token   # optional if using Substack only
ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Script flow per persona** (9 Claude calls total):
1. **Fetch profile** — X API: `GET /2/users/by/username/:handle` → name, profile_image_url
2. **Fetch content** — X: paginate user timeline (last 100 tweets). Substack: parse RSS feed.
3. **Filter** (1 Claude call) — send all content to Claude, returns indices of the ~50 most relevant/opinionated items for the deck topic. Cuts noise (shitposts, off-topic, promotional).
4. **Generate contract fields** (6 Claude calls) — one per text field (personality, bias, stakes, epistemology, timeHorizon, flipConditions). Each call gets filtered content + focused extraction instructions.
5. **Generate evidence policy** (1 Claude call) — returns JSON matching `EvidencePolicy` type.
6. **Select anchor excerpts** (1 Claude call) — picks 10-15 most representative quotes, returns `AnchorExcerpt[]` with source URLs.
7. **Write files**:
   - `data/seed/contracts/{id}.json` — full PersonaContract
   - `data/seed/corpus/{id}.json` — all fetched content as structured excerpts (for later DB import)

After all personas: writes `data/seed/personas.json` with deck + persona metadata.

**CLI interface**:
```bash
# Build all personas in the config
cd faultline && npm run build-personas

# Build only one persona (skip others)
npm run build-personas -- --only persona-a
```

**Cost**: ~$0.20-0.50 per persona (Claude Sonnet). Model: `claude-sonnet-4-5-20250929`.

**Error handling**: validates env vars on startup, validates deck-config.json shape, handles Twitter/Substack API errors gracefully (continues with available sources), retries Claude calls once on transient failures.

### 1.3 Persona Contract Generation (integrated into build-personas.ts)

Contract generation is part of the automated pipeline above, not a separate script. Each contract field is generated by a dedicated Claude call with a focused prompt:

- `personality` — communication style, rhetorical patterns, how they handle disagreement
- `bias` — ideological leanings, blind spots, assumptions treated as axioms
- `stakes` — financial interests, reputation concerns, incentive structure
- `epistemology` — how they evaluate truth/evidence, data vs. intuition
- `timeHorizon` — temporal framing (quarters vs. decades), discount rates on future risk
- `flipConditions` — specific evidence types that would change their mind
- `evidencePolicy` — acceptable/unacceptable sources, weighting rules, tool pull triggers

Each prompt instructs Claude to write 3-5 sentences of flowing prose, grounded only in the fetched content. The evidence policy and anchor excerpts are returned as structured JSON.

### 1.4 Seed Data & File-Based Contracts

Until the database and ingestion pipeline exist (Steps 9–10 in the implementation sequence), **use file-based persona contracts directly**. The automated builder generates these files.

#### Directory structure
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

#### `data/seed/deck-config.json` — Builder Input
```json
{
  "deck": {
    "id": "ai-safety",
    "name": "AI Safety Debate",
    "slug": "ai-safety"
  },
  "topic": "Should AI development prioritize safety over speed of deployment?",
  "personas": [
    { "id": "elon", "twitterHandle": "elonmusk", "substackUrl": null },
    { "id": "sam", "twitterHandle": "sama", "substackUrl": null },
    { "id": "zvi", "twitterHandle": null, "substackUrl": "https://thezvi.substack.com" }
  ],
  "settings": {
    "maxTweets": 100,
    "maxSubstackPosts": 20,
    "maxAnchorExcerpts": 15
  }
}
```

- `topic` — used by Claude to filter relevant content and generate persona contracts. Separate from deck metadata so the same deck can be reused for different debates.
- Each persona can have a `twitterHandle`, a `substackUrl`, or both. Set to `null` to skip a source.

#### Generated `data/seed/personas.json` — Metadata
```json
{
  "decks": [
    {
      "id": "ai-safety",
      "name": "AI Safety Debate",
      "slug": "ai-safety",
      "personaIds": ["elon", "sam", "zvi"],
      "locked": false,
      "createdAt": "2026-02-09T..."
    }
  ],
  "personas": [
    {
      "id": "elon",
      "name": "Elon Musk",
      "twitterHandle": "@elonmusk",
      "twitterPicture": "https://pbs.twimg.com/.../photo_400x400.jpg",
      "deckIds": ["ai-safety"],
      "suite": null,
      "locked": false
    }
  ]
}
```

#### Generated `data/seed/contracts/elon.json` — Full Persona Contract
All fields are auto-generated by Claude from the fetched content. Example structure:
```json
{
  "personaId": "elon",
  "version": "2026-02-09T00:00:00Z",
  "personality": "3-5 sentences generated from tweets/posts...",
  "bias": "...",
  "stakes": "...",
  "epistemology": "...",
  "timeHorizon": "...",
  "flipConditions": "...",
  "evidencePolicy": {
    "acceptableSources": ["technical benchmarks", "SEC filings", "..."],
    "unacceptableSources": ["anonymous sources", "..."],
    "weightingRules": "Empirical > theoretical...",
    "toolPullTriggers": "When a specific financial claim is made..."
  },
  "anchorExcerpts": [
    {
      "id": "anchor-0",
      "content": "Exact quote from a tweet or Substack post",
      "source": "https://x.com/elonmusk/status/123456",
      "date": "2026-01-15T..."
    }
  ]
}
```

#### Generated `data/seed/corpus/elon.json` — Raw Content
Contains all fetched tweets and Substack posts with metadata:
```json
[
  {
    "id": "tweet-123456",
    "content": "The tweet text...",
    "source": "https://x.com/elonmusk/status/123456",
    "date": "2026-01-15T...",
    "platform": "twitter",
    "metrics": { "likes": 5000, "retweets": 1200, "replies": 300 }
  },
  {
    "id": "substack-0",
    "content": "The post text (truncated to ~2000 chars)...",
    "source": "https://example.substack.com/p/post-slug",
    "date": "2026-01-10T...",
    "platform": "substack"
  }
]
```

#### How to create a contract manually (fallback)
If the automated builder doesn't work for a persona (private account, no X/Substack presence), create contracts by hand:
1. **Collect 30-50 excerpts** — search Twitter/X, YouTube transcripts, Substack, interviews. Focus on the persona's opinions on topics in your deck.
2. **Read everything** — get a feel for how they argue, what they care about, what they dismiss.
3. **Write each field by hand** — use the excerpts as evidence. Each field should be 2-5 sentences, specific and falsifiable. Avoid vague statements like "tends to be optimistic" — instead say "frames AI risk as an engineering problem solvable within a decade, dismisses alignment-as-philosophy arguments."
4. **Pick 10-20 anchor excerpts** — the most representative quotes that ground the contract.
5. **Cross-check**: could someone read this contract and predict how this person would respond to a new topic? If not, it's too vague.

#### Loading contracts at runtime
File: `lib/personas/loader.ts`

Reads from `data/seed/` at runtime. Provides `getDecks()`, `getPersonas()`, `loadContract(personaId)`, and `buildSystemPrompt(contract, persona)`. The orchestrator doesn't care whether contracts were auto-generated or hand-written — it just calls `loadContract(personaId)`.

This loader is swapped out for a database-backed version in Step 9 when retrieval comes online.

---

## Phase 2: Retrieval Engine

> **V1 skip**: Phase 2 is deferred until Step 9 in the implementation sequence. The orchestrator initially uses full persona contracts (with anchor excerpts) as agent context. Add retrieval only after the debate engine is proven.

### 2.1 Semantic Search (V1) → Hybrid Search (V2)
File: `lib/retrieval/search.ts`

```
query(personaId, text, filters) → ranked chunks
```

**V1: Pure semantic search**
- pgvector cosine similarity on embeddings
- Filters: persona_id, source_type, date_range
- Return top K chunks with scores
- Sufficient for the corpus sizes we're working with (hundreds of chunks per persona)

**V2: Add keyword matching if retrieval quality is poor**
- Postgres full-text search with `tsvector`/`tsquery` (note: this is TF-IDF-based ranking via `ts_rank`, not true BM25 — for real BM25 use ParadeDB `pg_bm25`)
- **Reciprocal Rank Fusion** to merge keyword and semantic results: `score = Σ 1/(k + rank_i)` with k=60
- Suggested starting weights: **40% keyword / 60% semantic** — persona opinions use varied vocabulary for the same concepts, so semantic similarity is more valuable than exact keyword match here. Tune based on retrieval quality.
- Normalize both result sets to the same candidate pool before fusing

### ~~2.2 Retrieval Cache~~
Skipped. Embedding lookups against pgvector are fast for corpus sizes of a few hundred chunks per persona. Add caching only if profiling shows retrieval is a bottleneck.

### 2.3 Message Store Retrieval
During debates, past messages are also retrievable — this directly affects debate quality by keeping agent context relevant to the live discussion.

- **Storage**: Messages stored with embeddings in `messages` table (same embedding model as corpus: Voyage `voyage-3`)
- **Embedding timing**: Async after each agent turn — fire-and-forget embedding call, don't block the debate loop. Messages are available for retrieval starting from the *next* turn.
- **Retrieval**: By embedding similarity to current crux/dispute text
- **Self-filtering**: Exclude the requesting agent's own messages from retrieval results to prevent circular reasoning. An agent should retrieve *other* agents' messages to understand opposing arguments, not reinforce its own.
- **Budget**: Top 3-5 retrieved messages per agent turn, ~200 tokens each
- Used for assembling agent context windows in blitz mode (see Phase 3.5)

---

## Phase 3: Blitz Mode Orchestrator (CORE)

This is the heart of the product. Build and test this thoroughly.

### 3.1 Claim Decomposition
File: `lib/orchestrator/claims.ts`
- Input: user's topic/question
- LLM call to decompose into 2–4 specific, testable claims
- Each claim has a clear pro/con framing
- Output: `Claim[]`

### 3.2 Agent Initialization
File: `lib/orchestrator/agents.ts`
- Load persona contracts for all agents in the hand
- For each agent × claim: generate initial stance + confidence via LLM
- Retrieve relevant corpus chunks per agent per claim
- Output: initial `AgentStance[]` and loaded context

### 3.3 Table Assignment
File: `lib/orchestrator/tables.ts`
- For small hands (3–6 agents): single table, skip sharding
- For 7+ agents: split into tables of 4–6
- Assignment algorithm:
  1. Group claims into crux clusters
  2. For each table, pick agents with opposing stances on the same crux
  3. Ensure dispute coverage — every crux has at least one table

### 3.4 Blackboard
File: `lib/orchestrator/blackboard.ts`
- Maintains `BlackboardState` per table and global
- Updated after each agent turn
- Summarized to ~500–1000 tokens for agent context injection
- Tracks: cruxes, disputes, flip conditions, open questions, stances

### 3.5 Agent Context Assembly
File: `lib/orchestrator/context.ts`
- Per agent turn, assemble context window from:
  1. **Blackboard summary** — always included (~500-1000 tokens)
  2. **Local neighborhood** — last N messages involving this agent
  3. **Retrieved snippets** — top K messages by embedding similarity to current crux
  4. **Corpus grounding** — relevant persona corpus chunks
  5. **Tool outputs** — any pending tool results
- Manage total token budget (configurable, default ~6–8K per turn)
  - Blackboard alone is 500–1000 tokens; 4K is too tight once corpus grounding and retrieved snippets are included
  - Budget allocation guide: blackboard ~1K, local neighborhood ~2K, retrieved snippets ~1.5K, corpus ~2K, tool outputs ~1K

### 3.6 Debate Loop
File: `lib/orchestrator/blitz.ts`
- Async generator that yields SSE events
- **V1: round-based parallelism.** All agents in a table respond simultaneously based on the previous round's blackboard. Agents do NOT see each other's current-round output — they react to the last round's state. This is simpler and faster; sub-round streaming (where agents see partial outputs mid-round) is a future upgrade.
- Per round per table:
  1. For each agent (parallel within table):
     - Assemble context (from previous round's blackboard + neighborhood + retrieval)
     - LLM call with structured output schema requiring:
       - `response`: the agent's debate contribution (text)
       - `stance`: pro | con | uncertain (per claim)
       - `confidence`: 0.0–1.0 (per claim)
       - `new_cruxes`: any new disputed propositions the agent identifies (string[])
       - `flip_triggers`: any flip conditions met this round (string[])
     - Parse and validate structured output
  2. Update blackboard: merge new stances, add discovered cruxes, update disputes, check flip triggers
  3. Compute convergence metrics
  4. Check stop conditions
  5. If not stopped → next round (agents now see updated blackboard)
- Tables run in parallel (concurrent LLM calls across tables)
- Round budget per table: 3–5 rounds (configurable)

### 3.7 Convergence Detection
File: `lib/orchestrator/convergence.ts`

Per claim:
```
entropy = -Σ p(stance) * log(p(stance))    // over pro/con/uncertain
confidenceDistance = Σ |conf_i - conf_j|    // pairwise
unresolvedCruxes = count(cruxes where !resolved && weight > threshold)
```

Stop conditions:
- **Converged**: ≥80% confidence mass on one side AND unresolvedCruxes === 0
- **Diverged**: entropy > threshold for last N events AND no new crux for last M events
- **Safety cap**: eventCount >= maxEvents

### 3.8 Merge Phase
File: `lib/orchestrator/merger.ts`
- **Cadence: tables run 1 round → pause → merge → reassign → next round.** Tables do NOT run all their rounds independently then merge once. The merge happens between every round so that crux discoveries in one table can influence other tables.
- Flow per merge cycle:
  1. All tables run 1 round of debate (in parallel)
  2. All tables pause
  3. **Collect** each table's blackboard
  4. **Deduplicate** cruxes and flip conditions (LLM-assisted semantic dedup)
  5. **Rank** cruxes by: tables that surfaced them × contestation level
  6. **Synthesize** merged blackboard with top cruxes and cross-table disagreement map
  7. **Reassign** agents to new tables if crux landscape shifted
  8. **Coverage check** — ensure every open crux has a table
  9. Distribute merged blackboard back to tables → next round
- Run 2–3 merge cycles total

### 3.9 Final Table
- Select 3–5 representative agents (one per table, strongest voice)
- Feed merged blackboard as context
- **V1: runs using the same blitz debate loop** (single table, same structured output schema)
- Produces final stances and remaining disputes
- **Future upgrade**: run final table using Classical mode orchestration for higher-quality natural dialogue (requires Classical mode to be built first — Phase 7)

### 3.10 Structured Output Extraction
File: `lib/orchestrator/output.ts`
- Orchestrator LLM reviews full transcript (or blackboard history)
- Extracts:
  1. **Cruxes** — smallest set of disputed propositions driving divergence
  2. **Fault lines** — categories (time horizon, assumptions, identity/values)
  3. **Flip conditions** — per agent, specific and testable
  4. **Evidence ledger** — what each agent accepts + rejection reasons
  5. **Resolution paths** — experiments or data that could settle it

---

## Phase 4: LLM Gateway & Tool Router

### 4.1 LLM Client
File: `lib/llm/client.ts`
- Anthropic SDK wrapper (Claude Sonnet for debate, Claude Haiku for extraction/summarization)
- Structured output parsing (JSON mode)
- Retry logic, rate limiting, error handling
- Token budget tracking

### 4.2 Prompt Templates
File: `lib/llm/prompts.ts`
- `CLAIM_DECOMPOSITION` — break topic into claims
- `AGENT_TURN` — generate response given context (includes system prompt from persona contract). Must return structured output: response text, stance per claim, confidence per claim, new cruxes discovered, flip conditions triggered. Single LLM call, no separate extraction step.
- `BLACKBOARD_SUMMARY` — compress blackboard to token budget
- `MERGE_CRUXES` — deduplicate and rank cruxes across tables
- `FINAL_OUTPUT` — extract cruxes, fault lines, flip conditions, evidence ledger, resolution paths

### 4.3 Tool Router (defer most tools to later)
- Start with: no external tools (agents debate using corpus only)
- Later add: web search, financial data, filing access
- Architecture: tool definitions passed to Claude, results injected into context

---

## Phase 5: API Layer

### 5.1 Endpoints
- `POST /api/debate` — start a debate (topic, persona IDs, mode)
  - Returns: debate ID + SSE stream
- `GET /api/debate/[id]` — get debate status and results
- `GET /api/decks` — list all decks
- `GET /api/decks/[slug]` — get deck with persona cards
- `GET /api/personas/[id]` — get persona card + contract summary

### 5.2 SSE Event Types
```typescript
type SSEEvent =
  | { type: 'debate_start'; debateId: string; claims: Claim[] }
  | { type: 'table_assigned'; tableId: number; personaIds: PersonaId[] }
  | { type: 'agent_turn'; personaId: PersonaId; tableId: number; content: string; stance: AgentStance }
  | { type: 'blackboard_update'; tableId: number; summary: string }
  | { type: 'convergence_update'; metrics: ConvergenceState }
  | { type: 'merge_start'; round: number }
  | { type: 'merge_complete'; mergedCruxes: Crux[] }
  | { type: 'final_table_start'; personaIds: PersonaId[] }
  | { type: 'debate_complete'; output: DebateOutput }
  | { type: 'error'; message: string }
```

---

## Phase 6: Minimal Frontend

Functionality-first. Poker/cards visual language.

### 6.1 Lobby (`/`)
- Title, tagline
- "Enter the room" button → cards page
- Reference code input (disabled/placeholder for now)

### 6.2 Cards (`/cards`)
- Deck selector (tabs or dropdown)
- Grid of persona cards per deck
- Card: name, Twitter handle, Twitter picture
- Locked cards shown grayed out
- Click card → expand to show one-sentence contract summaries

### 6.3 Card Detail (`/cards/[id]`)
- Full persona card view
- One-sentence summaries of all 6 contract dimensions
- "Add to hand" button

### 6.4 Hand Builder / Setup (`/setup`)
- Selected deck shown
- Hand of 3–8 cards displayed
- Add/remove cards
- Topic input field
- "Deal" button → starts debate

### 6.5 Game Room (`/match/[id]`)
- Polygon visualization with agents at vertices
- Edges highlight on agent communication
- Streaming agent messages
- Sidebar: convergence metrics, crux list, flip conditions
- Final output: disagreement map display
- Vertex shading for/against over time

---

## Phase 7: Classical Mode (after blitz is solid)

### 7.1 Action Plan Generation
- Each agent generates: speak/interrupt/listen + urgency + intent
- Structured LLM output

### 7.2 Dynamic Speaker Selection
- Rank by urgency score
- Handle silent turns (all agents listen)

### 7.3 Sentence-by-Sentence Streaming
- Output chunked at sentence boundaries
- Other agents can update plans mid-speech
- Interruption mechanics

### 7.4 Shared Blackboard (replaces full transcript injection)
- Same blackboard architecture from blitz mode
- Updated continuously rather than per-round

---

## Implementation Sequence

Priority order — each step depends on the previous:

```
Step 1: Project Foundation (Phase 0)
  ↓
Step 2: Database Schema + Migrations (Phase 1.1) ✅
  ↓
Step 3: Build Persona Seed Data (Phase 1.2–1.4) ✅
  ↓  Automated: `npm run build-personas` fetches X + Substack content, Claude generates contracts
Step 4: LLM Client + Prompt Templates (Phase 4.1, 4.2) ✅
  ↓
Step 5: Blitz Orchestrator Core (Phase 3.1–3.7) ✅
  ↓  Claim decomposition → Agent init → Debate loop → Convergence
  ↓  Single table, all agents parallel per round, full contracts as context
Step 6: Output Generation (Phase 3.10) ✅
  ↓
Step 7: SSE API (Phase 5) ✅
  ↓
Step 8: Minimal Frontend (Phase 6)
  ↓
Step 9: Retrieval Engine (Phase 2)
  ↓  Add hybrid search, swap out full-contract injection for RAG
Step 10: DB-backed Ingestion (Phase 1.2 DB migration)
  ↓  Migrate file-based seed data into Postgres; build-personas already generates the files
Step 11: Table Sharding + Merge (Phase 3.3, 3.8, 3.9)
  ↓  Scale to 7+ agents
Step 12: Classical Mode (Phase 7)
  ↓
Step 13: Tool Integration (Phase 4.3)
```

### Why this order?
- **Steps 1–5** get a working debate with 3 agents as fast as possible. No DB needed yet — use file-based persona contracts and in-memory state.
- **Step 6** produces the actual value (disagreement maps).
- **Steps 7–8** make it usable.
- **Steps 9–11** add scale and quality (retrieval, ingestion, multi-table).
- **Steps 12–13** are feature expansions.

### Shortcuts for Speed
- Steps 1–6 use **file-based persona contracts** (JSON files) generated by `build-personas.ts`. No DB needed until Step 9.
- Persona data is auto-generated from X tweets + Substack posts via Claude — no manual curation required. Edit `deck-config.json`, run `npm run build-personas`, done.
- Skip embeddings until Step 9. Use full persona contracts as agent context initially.
- Single table only until Step 11. Blitz mode works fine with 3–6 agents in one table.
