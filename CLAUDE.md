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

### Active Debate Engine: Dialogue + Crux Rooms

The only active engine is the **Dialogue + Crux system** at `/dialogue`.

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

### User Flow

```
/ (lobby, invite gate)
  → /setup (Build Your Hand: deck → persona selection → topic input)
      → /dialogue?personas=...&topic=... (active debate engine)
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
