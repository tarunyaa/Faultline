# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

All commands run from the `faultline/` subdirectory:

```bash
cd faultline

npm run dev           # Start Next.js dev server
npm run build         # Production build (run to verify no TS errors)
npm run lint          # ESLint

# Database
npm run db:push       # Push schema changes to Postgres (no migration file)
npm run db:generate   # Generate migration files
npm run db:migrate    # Run migrations
npm run db:seed       # Seed DB from file-based seed data
npm run db:studio     # Open Drizzle Studio

# Persona building
npm run build-personas  # Scrape X/Substack + generate contracts via Claude
```

**Required env vars** (in `faultline/.env.local`):
- `ANTHROPIC_API_KEY`
- `DATABASE_URL` (Postgres with pgvector)
- `X_BEARER_TOKEN` (optional, only for build-personas)

**Start Postgres**: `docker compose up -d` from repo root.

---

## Architecture

### Repository Layout

The Next.js app lives in `faultline/` — **not** the repo root. The repo root contains `docker-compose.yml` and `CLAUDE.md`. `docs/past_implementation.md` has history of all past debate engine attempts.

### Data Flow: Personas

Personas are loaded from **files**, not the database. The DB schema exists but the app reads from `data/seed/`:

```
data/seed/personas.json         — persona list (id, name, handle, picture, deckIds)
data/seed/deck-config.json      — deck definitions
data/seed/contracts/[Name].json — PersonaContract per persona (personality, bias, stakes, etc.)
data/seed/corpus/[Name].json    — raw scraped text (tweets, essays)
```

`lib/personas/loader.ts` is the only entry point for persona data at runtime. `scripts/build-personas.ts` regenerates contracts from scratch using X API + Substack RSS + Claude.

### Active Debate Engine 1: Dialogue + Crux Rooms

The primary TypeScript-native engine is the **Dialogue + Crux system** at `/dialogue`.

```
app/api/dialogue/route.ts              — SSE endpoint (POST)
lib/dialogue/orchestrator.ts           — async generator: runDialogue()
lib/dialogue/agent.ts                  — per-persona LLM calls (opening, take, closing)
lib/dialogue/disagreement-detector.ts  — Haiku call; detects opposition from parallel takes
lib/dialogue/topic-decomposer.ts       — breaks topic into 3 debatable aspects
lib/dialogue/context-builder.ts        — assembles turn context + round summaries
lib/dialogue/summarizer.ts             — post-debate structured extraction
lib/dialogue/speech-roles.ts           — per-persona voice profiles (patterns, vocabulary, forbidden phrases)
lib/crux/orchestrator.ts               — runCruxRoom(): 3-phase crux room (position → exchange → card)
lib/crux/prompts.ts                    — all crux room prompt templates
```

**SSE event flow**: `dialogue_start` → `debate_start` → `round_start` → `message_posted` (per take) → `disagreement_detected` → `crux_room_spawning` → `crux_message` (repeated) → `crux_card_posted` → `round_end` → `dialogue_complete`

**Frontend**: `components/dialogue/DialogueView.tsx` consumes `lib/hooks/useDialogueStream.ts`. Crux cards rendered by `components/crux/CruxCard.tsx`.

### LLM Client

All LLM calls go through `lib/llm/client.ts`:
- `complete(opts)` — returns raw text
- `completeJSON<T>(opts)` — returns parsed JSON, handles markdown fences + truncation repair
- Two model tiers: `'sonnet'` (claude-sonnet-4-5) and `'haiku'` (claude-haiku-4-5). Haiku for cheap extraction/detection, Sonnet for generation.
- Auto-retry on 429/500/529 with exponential backoff.

### Argument Debate Engine: ARGORA (Python + TypeScript Bridge)

The `/argument` route runs debates through the **ARGORA** Quantitative Bipolar Argumentation Framework (QBAF) — a Python system separate from the Next.js app.

**Python directories** (at repo root, not inside `faultline/`):

| Directory | What it is |
|-----------|-----------|
| `argora/` | Canonical ARGORA — auto-generates domain expert personas |
| `argora-personas/` | ARGORA variant accepting Faultline persona system prompts |
| `crux-personas/` | ARGORA + crux extraction (Phases 1–4 from `docs/2026-03-05/argora_to_crux.md`) |

Each Python directory has its own `.venv` and `bridge.py` entry point. **`ARGORA_SKIP_EMBEDDINGS=1`** must be set on Windows/Cygwin (sentence-transformers hangs PyTorch).

**TypeScript bridge** (`lib/argument/bridge.ts`): spawns the Python subprocess, reads newline-delimited JSON from stdout, yields `ArgumentEvent` objects as an async generator. The API route (`app/api/argument/route.ts`) converts these to SSE.

```
lib/argument/
  bridge.ts           — spawn Python, pipe JSON events → AsyncGenerator<ArgumentEvent>
  crux-bridge.ts      — crux-personas variant (richer crux card output)
  baseline-bridge.ts  — run baseline methods (Direct/CoT/Multi-agent Crux)
  topic-framer.ts     — reframe topic as formal task (used internally, hidden from UI)
  types.ts            — ArgumentEvent union type

app/api/argument/
  route.ts            — SSE endpoint; selects argora vs crux-personas vs baselines
  baselines/route.ts  — baseline-only endpoint
  benchmark/route.ts  — benchmark run endpoint

app/argument/
  page.tsx            — argument debate UI
  benchmark/page.tsx  — benchmark UI
```

**ARGORA pipeline phases** (per debate/facet):
1. Task extraction — topic → `main_task` + `key_elements`
2. Expert generation — N domain experts (or injected persona system prompts)
3. Main arguments — each expert independently writes their position
4. First-level arguments — each expert stances (agree/disagree) on others' positions → QBAF depth 1
5. Graph-based debate — review (depth 2) + rebuttals (depth 3)
6. QBAF strength computation — DFQuAD bottom-up propagation; `τ` (base) and `σ` (final) per node
7. Counterfactual analysis — `edge_local_impact` (delta) per node; `winner_critical` flag
8. Crux extraction (crux-personas only) — flip conditions → crux cards grounded in graph math
9. Cross-facet synthesis (faceted mode only) — LLM synthesizes across 3 sub-questions

**Two run modes**: single (default) or faceted (`--use-facets` → 3 sub-questions, 3× the calls).

**Persona injection**: `crux-bridge.ts` loads Faultline persona contracts via `buildConsolidatedPrompt`, writes a temp JSON file, passes `--personas-json` to `bridge.py`. This uses `argora-personas/` or `crux-personas/` (not plain `argora/`).

**SSE event flow (single mode)**:
`argument_start` → `experts_generated` → `main_arguments_generated` → `level1_complete` → `level2_complete` → `level3_complete` → `qbaf_evaluated` → `counterfactual_complete` → `flip_conditions` → `consensus_generated` → `report_generated` → `crux_cards_extracted` → `argument_complete`

**Faceted mode** adds: `facets_decomposed` → per-facet events prefixed `facetN_*` → `cross_facet_analysis`

**Key metric**: `σ` (sigma) = final QBAF strength after propagation (0–1). Always show a legend when displaying σ/τ in the UI. `edge_local_impact` (delta) = how much the outcome shifts if a node is removed — this IS the flip condition, derived from graph math (not LLM opinion).

**Zero crux cards** is expected when experts never form cross-expert attack edges (QBAF converges). Not a bug.

### CruxArena (`/arena`)

Human preference benchmark comparing debate methods side-by-side. All methods must output `CruxCardOutput[]` in the same schema (see `lib/arena/types.ts`). Blind pairwise voting — users pick which method gave more insight.

```
lib/arena/
  types.ts            — CruxCardOutput, ArenaDebate, ArenaOutput, ArenaVote
  persistence.ts      — save/load debates + votes (arena_debates, arena_outputs, arena_votes tables)
  stats.ts            — aggregate win rates, CIs

app/arena/
  page.tsx            — CruxArena dashboard
  ArenaClient.tsx     — pairwise voting UI + results reveal

app/api/arena/
  vote/route.ts       — POST pairwise vote
  stats/route.ts      — GET aggregate stats
```

**Methods**: Direct Crux (GPT-4o-mini, 1 call) | CoT Crux (o3, 1 call) | Multi-agent Crux (~8 calls) | ARGORA Crux (~50 calls). Baselines live in `crux-personas/bridge_baselines.py`.

### User Flow

```
/ (lobby, invite gate)
  → /setup (Build Your Hand: deck → persona selection → topic input)
      → /dialogue?personas=...&topic=... (Dialogue + Crux engine)
  → /argument (ARGORA QBAF engine — domain experts or persona injection)
  → /arena (CruxArena benchmark — pairwise voting on debate method quality)
  → /cards (browse decks + persona contracts)
      → /cards/[id] (persona contract detail)
  → /debates (archive of old blitz/graph debates from DB)
      → /debates/[id] (replay viewer via DebateReplay.tsx)
  → /setup/create (create a new deck)
```

### Debate Archive (Read-Only)

`/debates` and `/debates/[id]` display historical debates stored in the `debates` DB table. The table stores the full SSE event stream as JSONB. `lib/hooks/hydrateDebateState.ts` replays those events into UI state. `components/DebateReplay.tsx` renders the result. These components exist solely to view old data — no new debates are written to the DB currently.

### Styling

Custom CSS variables are defined in `app/globals.css`. **Always use these instead of raw Tailwind colors**:
- `bg-background`, `bg-card-bg`, `bg-surface` — backgrounds (darkest to lightest)
- `border-card-border` — standard border
- `text-foreground`, `text-muted` — text
- `text-accent`, `bg-accent` — red (#dc2626 range)
- `text-danger` — error red

Never use `gray-*`, `blue-*`, or `purple-*` classes. Palette is black/red/white only.

### Frontend Text & Readability Rules

These apply to all frontend work, including the frontend engineer subagent:

- **No markdown in rendered UI** — never render `**bold**`, `##`, or other markdown syntax as raw text. If the source is LLM output, strip or parse it before display.
- **No text walls** — any block of text longer than 2–3 sentences must be broken into paragraphs or bullet points. Never dump raw LLM output directly into a component.
- **Math/symbol legends** — whenever a math symbol or formula is shown on the frontend (e.g. σ, QBAF scores, probability notation), add a small legend or tooltip nearby explaining what it means in plain language.
- **Compartmentalize, don't dump** — long results belong in collapsible sections, tabs, or cards. Default to collapsed for secondary information.

### Argument Debate Layout Convention

The Graph (ARGORA) debate type organizes content as:
- Main arguments (opening positions, depth 0) rendered first under an "Opening Positions" divider
- Replies threaded directly under the argument they respond to, indented by depth (depth 1 = Round 1 reply, depth 2 = deeper reply, etc.)
- Playing card suits (♠♥♦♣) used as visual dividers: ♠ for Opening Positions, ♥/♦/♣ for reply depth markers
- Red suits (♥, ♦) use `text-accent`; black suits (♠, ♣) use `text-foreground/30`

---

## Core Principles

### Structural Understanding Over Ad-Hoc Fixes
- **Never apply ad-hoc patches or band-aid fixes.** Before changing anything, understand the full architectural context — how the component fits into the system, what flows through it, and what depends on it.
- Diagnose root causes, not symptoms. If something is broken, understand WHY before writing a fix.
- Fixes must be structurally sound — they should respect and reinforce the existing architecture, not work around it.
- Be critical and intelligent about every change. Question assumptions, trace data flow, and verify that the fix addresses the actual problem rather than masking it.

### Avoid Overengineering
- Prefer the simplest solution that solves the problem
- Don't add abstractions, helpers, or utilities for one-time operations
- Don't design for hypothetical future requirements
- Three similar lines of code is better than a premature abstraction

### Feature Development Process
When implementing new features, ALWAYS follow this process:

1. **Understand First** — Ask clarifying questions. Identify ambiguities and edge cases.
2. **Critique & Analyze** — Identify multiple approaches. Evaluate complexity vs. benefit, integration with existing architecture, failure modes, maintenance burden.
3. **Propose Minimal Solution** — Present the most robust, minimal implementation. Explain tradeoffs. Identify what is NOT being built and why.
4. **Plan Before Implementing** — Use EnterPlanMode for non-trivial features. Get user sign-off before writing code.
5. **Implement** — Only after approval. Stick to scope. No surprise additions.

### Implementation Plan Hygiene

Implementation plans (`docs/` markdown files) must be **living documents that reflect current state only**:

- **No process history** — Don't record "we initially thought X but then discovered Y." Just state Y.
- **No contradictions** — If a decision changes, update ALL references. Don't leave old information alongside corrections.
- **No redundancy** — Each fact appears once. Don't repeat setup instructions, architecture diagrams, or decisions in multiple sections.
- **Prune aggressively** — Remove completed phases, resolved questions, and rejected alternatives. The plan should always answer "what's left to do" not "what happened."
- **A documentation subagent must update the plan at each milestone** — removing completed work, correcting anything that changed during implementation, and keeping the document concise.
- **Concise by default** — Prefer tables over prose. Prefer file lists over explanations of what files do. If it can be said in 1 line, don't use 5.

## Prompt Engineering Rules

The LLM prompt architecture is **layered and intentional**. Before modifying any prompt-related code, understand the full stack:

### Prompt Architecture

```
System Prompt Layer (per-persona identity)
├── buildConsolidatedPrompt()  — lib/personas/loader.ts
│   Merges: personality + bias + stakes + epistemology + voice profile + forbidden phrases
│   Used by: lib/dialogue/agent.ts AND lib/crux/orchestrator.ts
│
└── Voice data source: lib/dialogue/speech-roles.ts
    VOICE_PROFILES constant → consumed by buildConsolidatedPrompt()

User Prompt Layer (per-call instructions)
├── lib/dialogue/agent.ts          — 4 generation functions (opening, take, replyToReply, closing)
├── lib/crux/prompts.ts            — 7 prompt functions (position, early/late exchange, exit check, convergence, extraction)
├── lib/dialogue/disagreement-detector.ts — 2 detection functions (sequential window, parallel takes)
├── lib/dialogue/summarizer.ts     — post-debate extraction
├── lib/dialogue/topic-decomposer.ts — topic → 3 aspects
└── lib/dialogue/context-builder.ts — round summarization + context assembly
```

### Known Issues (Do NOT add to these)
- 3 system prompts in crux/orchestrator.ts are inline strings instead of being in crux/prompts.ts

### Rules When Touching Prompts
1. **Never add new inline system prompts** — put them in the appropriate prompts file
2. **Never duplicate prompt logic** — if a prompt already does something similar, modify the existing one
3. **Always use `buildConsolidatedPrompt`** for new persona-voiced LLM calls (not `buildSystemPrompt`)
4. **Understand the full prompt stack before changing anything** — read the system prompt, user prompt, and post-processing together
5. **Don't add ad-hoc prompt patches** — if detection/generation isn't working well, understand WHY before adding more prompt text
6. **Keep prompt functions pure** — they return strings, they don't make LLM calls (orchestrators do that)
7. **Temperature conventions**: generation = 0.85, analysis/detection = 0.2, crux exchange = 0.75

## "Argument" Debate Type Rules

The `argument` debate type is a **Python-first implementation** (ARGORA). When building it:
- Do NOT copy patterns from `dialogue` or `graph` just because they exist there
- Do NOT add speech roles, crux rooms, or other dialogue-specific features unless explicitly requested
- The Python bridge is the source of truth — TypeScript is a thin SSE wrapper
- Default mode: ARGORA auto-generates domain experts. Persona mode: `buildConsolidatedPrompt` injects Faultline persona system prompts into ARGORA expert slots (via `argora-personas/` or `crux-personas/`)
- Crux cards in argument mode come from QBAF counterfactual math, NOT from the TypeScript crux room system
- Follow the ARGORA paper's design and `docs/2026-03-05/argora_to_crux.md` for crux extraction

## Documentation Rule

All docs must be created as `.md` files inside `docs/YYYY-MM-DD/` using today's date. Never place docs in the repo root or other locations.

## What NOT to Do

- ❌ Don't implement features without discussing approach first
- ❌ Don't add "nice to have" features beyond scope
- ❌ Don't create abstractions before they're clearly needed
- ❌ Don't use colors outside the black/red/white palette
- ❌ Don't add extensive error handling for impossible scenarios
- ❌ Don't create utilities/helpers for one-off operations

## Debate Integrity: No LLM Hallucinations

This project demands **real, substantive debate** — not LLM theater. Every aspect of debate generation, moderation, and results must be grounded in actual reasoning:

- **No fabricated claims or citations** — Personas must argue from their established positions (contracts, bias, stakes). Never invent facts, studies, or quotes that aren't grounded in the persona's loaded context.
- **No hallucinated disagreements** — Disagreement detection must reflect genuine opposition in what personas actually said, not manufactured conflict.
- **No hallucinated moderation/results** — Crux cards, summaries, and debate outcomes must be faithfully derived from the actual exchange. Don't fabricate consensus, concessions, or crux points that didn't emerge from the conversation.
- **No sycophantic hedging** — Personas should hold their ground when their position warrants it. Don't let LLM politeness override genuine disagreement.
- **Prompt design must enforce grounding** — All prompts for detection, extraction, and summarization should instruct the model to cite or reference specific messages/claims from the debate transcript, not generate from imagination.
