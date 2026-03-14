# Crux-Personas: Persona Integration + Frontend Plan

**Date**: 2026-03-06
**Status**: Ready to implement

---

## Codebase Health Summary

**crux-personas is production-ready.**

- All 22 modules compile, no broken imports
- Phases 1-4 from `argora_to_crux.md` are fully implemented
- Persona injection works: `bridge.py --personas-json` passes `{name, system_prompt}` dicts through the full pipeline
- Facet decomposition works: `facet_runner.py` decomposes topics into 3-6 sub-questions (NOT MCQ options)
- Crux extraction is post-processing only, grounded in graph math (no hallucination risk)
- Zero crux cards in existing sample data is expected — requires cross-expert attacks, which only emerge with genuinely divergent personas

**No critical bugs found.**

---

## What to Build

crux-personas needs to plug into the same Faultline SSE pipeline and `/argument` frontend that argora-personas uses. The debate output is semantically richer (crux cards + expert divergence), but the page layout stays similar.

Additionally: automatic CruxBench submission after baseline runs, debate archive save, PDF export, and expert alignment graph in the sidebar.

---

## Current vs Target

| | argora-personas (current) | crux-personas (target) |
|---|---|---|
| Bridge | `crux-personas/bridge.py` (already has persona support) | Same — no changes needed |
| API route | `/api/argument/route.ts` calls argora-personas | New route or mode flag to call crux-personas |
| Hook | `useArgumentStream.ts` | Extend with crux/divergence/facet state |
| Phase display | Initializing → Experts → Arguments → Building → QBAF | Add Crux Extraction phase after QBAF |
| Results tab 1 | Verdict + QBAF tree | Verdict (2-col) + Crux Cards |
| Results tab 2 | Baselines | Crux Analysis (expert divergence + card detail) |
| Results tab 3 | Technical Analysis (verbose, low value) | Simplified: σ/τ legend + key numbers only |
| Framed topic display | Shown prominently | Hidden (confusing, removed) |
| Crux cards | Not present | New `ArgumentCruxCard` component |
| Facets | Not present | Facet nav when `mode=faceted` |
| Sidebar | Debaters list + scores | Add expert alignment polygon |
| Save to archive | Not implemented | Save after debate completes |
| Export | Not implemented | PDF export (mirrors dialogue export) |
| CruxBench | Standalone `/arena` page | Auto-submit after baseline run |

---

## Issues to Fix

### 1. Task Formation / Framed Topic Display

`use_task_extraction: True` in eval_settings.py converts the topic into a formal "main task + key elements" framing, shown on the frontend as `framedTopic` + position descriptions. This is confusing in practice.

**Fix**: Hide the framed topic and positions display entirely in the UI. Task extraction still runs internally (it guides expert prompting) but is not surfaced to the user.

### 2. Crux Cards Truncation + Format

The existing CruxCard component (dialogue-style) is the right model. crux-personas produces a different schema (`question`, `crux_type`, `importance`, `flip_mechanism`, `experts[name → {stance, reasoning}]`, `winner_critical`).

**Fix**: New `ArgumentCruxCard` component. Rules:
- `question`: Full text, never truncated. Card width auto-expands.
- `crux_type`: Colored badge (evidence / values / definition / horizon / claim / premise)
- `winner_critical`: "OUTCOME-CRITICAL" badge (`bg-accent text-white`) when true
- `importance`: Rendered as plain English — "shifts outcome by ±{val}" with σ tooltip
- `flip_mechanism`: Blockquote, `text-muted` styling, no math symbols
- `experts`: 2-column — support (left, muted-green border) vs attack (right, red border). Full reasoning text, expandable if >4 lines.
- Strip `**` and `##` before rendering all text

### 3. Verdict Placement

Currently the verdict appears inline at the bottom of the `ArgumentTimeline`. Hard to find/read.

**Fix**: Remove from debate thread. Move to Results panel tab 1 as a 2-column section:
- Left (60%): Winner's main argument (full text) + σ score with legend
- Right (40%): Consensus summary — strip markdown, break into paragraphs
- Winner badge stays on the winning argument node in the timeline

### 4. Technical Analysis Tab

Currently: raw base scores table, full QBAF strengths list, counterfactual data, JSON dump. Low value.

**Fix**: Replace with focused "Debate Strength" section:
- σ/τ legend at top: "τ = initial score before attacks/support. σ = final score. Lift = how much the debate changed each argument."
- Winner table: top 3 arguments by σ with τ, σ, lift columns only
- Expert divergence summary table: who agreed, who drove the outcome
- Remove JSON dump entirely. Everything else collapsed by default.

### 5. Text Rendering Rules (global)

- Strip `**text**` and `##` before rendering all LLM output
- Any prose block > 3 sentences: insert paragraph breaks or render as `<ul>`
- Math symbols (σ, τ, Δ) must have inline tooltip or legend on first use
- No raw JSON visible to users

---

## CruxBench Integration

### Current State

The `/arena` page is a fully-built standalone feature:
- DB tables: `arenaDebates`, `arenaOutputs`, `arenaVotes`
- `lib/arena/`: types, persistence, stats, bridge
- `components/arena/`: `PairwiseVoting`, `CruxCardDisplay`, `ArenaDashboard`
- Runs 4 methods (direct_crux, cot_crux, multiagent_crux, argora_crux) against a topic
- Users vote pairwise on which method's crux cards were better
- Currently fully disconnected from the `/argument` debate flow

### The Gap

The arena currently runs its own debate from scratch via `/api/arena/run`. There is no connection between running an argument debate (crux-personas) and contributing to the arena. Users who run argument debates + baselines generate crux cards that are never saved or compared.

### What to Build

After a crux-personas debate completes baselines, **automatically submit to the arena**:

1. The crux-personas bridge already produces `argora_crux` crux cards (same schema as arena).
2. The baseline methods (direct_crux, cot_crux, multiagent_crux) run against the same topic via `/api/argument/baselines`.
3. Both outputs need to land in `arenaOutputs` as a single `arenaDebates` record.

**Flow**:
```
User runs crux-personas debate
  → debate completes (crux_cards_extracted event fires)
  → user clicks "Run Baselines" in Results panel
  → /api/argument/baselines runs direct_crux + cot_crux + multiagent_crux
  → both the crux-personas cards AND baseline cards are saved to arena DB
  → "View in CruxBench" link appears in Results panel
  → clicking opens /arena?debateId={id} with pairwise voting pre-loaded
```

**Schema mapping**:
- crux-personas `ArgumentCruxCard` → `CruxCardOutput` (question, disagreementType=crux_type, diagnosis=flip_mechanism, importance, positions from experts dict)
- Baseline output already produces `CruxCardOutput[]` (correct schema)

**Files to change**:
```
faultline/app/api/argument/route.ts              -- save arena record after crux debate completes
faultline/app/api/argument/baselines/route.ts    -- accept debateId; save arena outputs; return debateId
faultline/lib/arena/persistence.ts               -- add upsertArenaDebate(), addArenaOutput() helpers if needed
faultline/components/argument/ResultsSection.tsx -- "Run Baselines" button → "View in CruxBench" link
faultline/app/arena/ArenaClient.tsx              -- support ?debateId query param to jump directly to pairwise vote
```

**No new DB tables needed** — `arenaDebates` + `arenaOutputs` already exist.

---

## Debate Archive

### Current State

- Dialogue debates are saved via `/api/dialogue/save` → `debates` table
- `/debates` lists all saved debates; `/debates/[id]` replays them
- The argument debate flow has **no save functionality**

### What to Build

Add save to the argument debate flow, mirroring the dialogue save pattern.

**API**: `POST /api/argument/save`
```typescript
body: {
  topic: string
  personaIds: string[]
  events: unknown[]       // full SSE event stream
  output: unknown         // argument_complete payload
}
```
Returns `{ id: string }`. The `debates` table already has a `mode` column — use `mode: 'argument'`.

**Client trigger**: After `argument_complete` event fires, auto-save (no user action required — matches dialogue behavior). Show "Saved to archive" confirmation in the Results panel header.

**Replay**: `/debates/[id]` already routes to `DebateReplay.tsx` for non-dialogue modes. Add an `ArgumentReplay.tsx` component that:
- Shows the topic, personaIds, debate thread (ArgumentTimeline)
- Shows crux cards (ArgumentCruxCard components)
- Shows verdict + expert divergence (read-only results panel)

**Files**:
```
faultline/app/api/argument/save/route.ts            -- new save endpoint
faultline/components/argument/ArgumentReplay.tsx    -- new read-only replay view
faultline/app/debates/[id]/page.tsx                 -- add 'argument' case → ArgumentReplay
faultline/components/argument/GraphDebateView.tsx   -- call save API after argument_complete
```

---

## PDF Export

### Current State

`lib/utils/export-pdf.ts` (391 lines) handles dialogue debate PDF export using html2pdf.js. It includes: topic header, persona chips, round messages, crux cards, debate summary sections. No export exists for argument debates.

### What to Build

Extend the export to support argument debates. Rather than adding to the existing dialogue export, add an `exportArgumentPDF()` function in the same file.

**Sections to include**:
1. Header: topic, debate mode ("Argument Debate"), personas/experts, date
2. Verdict: winner argument (full text), σ score, consensus summary
3. Crux Cards: each `ArgumentCruxCard` — question, type, importance (plain English), flip mechanism, expert positions
4. Debate Thread: opening positions + threaded replies (ArgumentTimeline content)
5. Expert Divergence: table of expert name / σ score / role

**Sections to exclude**: raw QBAF scores, base scores, counterfactual JSON, source_node_ids

**Trigger**: "Export PDF" button in the Results panel header, same position as in the dialogue view. Appears only when debate is complete.

**Files**:
```
faultline/lib/utils/export-pdf.ts                   -- add exportArgumentPDF() function
faultline/components/argument/ResultsSection.tsx    -- add Export PDF button
```

---

## Expert Alignment Graph

### Current State

Two polygon components already exist:
- `components/AgentPolygon.tsx` — blitz/graph debate mode. Edges colored by pairwise alignment score (green=agreement, red=opposition). Shows confidence-weighted inner radar.
- `components/dialogue/ThreeColumnLayout.tsx` — `DialoguePolygon` subcomponent. Edges reflect active/completed crux rooms.

### What to Build

Add an expert alignment graph to `GraphDebateView`'s sidebar, using `AgentPolygon.tsx` adapted for crux-personas output.

**Data source**: `divergence_computed` event provides the `DivergenceMap` with pairwise expert gaps and directions. This maps directly to `AgentPolygon`'s edge coloring logic.

**Mapping**:
- Each expert = one polygon vertex (hex avatar from persona picture)
- Pairwise edge = `DivergenceMap.pairwise[{expert_a, expert_b, gap, is_crux}]`
  - `is_crux: true` → red edge (accent color, glow): these experts drove the disagreements
  - `is_crux: false` + low gap → muted gray edge: aligned
  - `is_crux: false` + high gap → dashed gray: divergent but not crux-driving
- Inner polygon radius = expert's `root_strength` (σ score) normalized to [0.3, 0.9]

**Placement**: Below the existing debaters list in the sidebar. Appears after `divergence_computed` event fires (replaces the plain debaters list or sits beneath it). Hidden while debate is in progress.

**Label**: "Alignment Map" heading. Small legend: "Red edges = disagreement drivers. Gray = aligned."

**Files**:
```
faultline/components/AgentPolygon.tsx               -- minor: accept DivergenceMap as prop variant
faultline/components/argument/GraphDebateView.tsx   -- render AgentPolygon in sidebar when divergenceMap present
faultline/lib/argument/types.ts                     -- DivergenceMap type already being added
```

---

## Files to Change (Full List)

### Python (crux-personas) — no changes required

### TypeScript (faultline/)

**New files:**
```
faultline/lib/argument/crux-bridge.ts
faultline/components/argument/ArgumentCruxCard.tsx
faultline/components/argument/ArgumentReplay.tsx
faultline/app/api/argument/save/route.ts
```

**Modified files:**
```
faultline/lib/argument/types.ts
faultline/lib/hooks/useArgumentStream.ts
faultline/lib/utils/export-pdf.ts
faultline/app/api/argument/route.ts
faultline/app/api/argument/baselines/route.ts
faultline/app/debates/[id]/page.tsx
faultline/components/argument/GraphDebateView.tsx
faultline/components/argument/ArgumentView.tsx
faultline/components/argument/ResultsSection.tsx
faultline/components/argument/ArgumentTimeline.tsx
faultline/components/AgentPolygon.tsx
faultline/app/arena/ArenaClient.tsx
faultline/lib/arena/persistence.ts
```

---

## Implementation Phases

### Phase 1: Backend Wire-up

1. Create `faultline/lib/argument/crux-bridge.ts` — mirror bridge.ts pointing to crux-personas/bridge.py
2. Extend `/api/argument/route.ts` — `useCrux` flag, default true for persona debates, forward new SSE events
3. Create `/api/argument/save/route.ts` — save to debates table with `mode: 'argument'`

### Phase 2: Hook + Types

1. Add `ArgumentCruxCard`, `DivergenceMap`, `FacetInfo` types to `lib/argument/types.ts`
2. Extend `useArgumentStream.ts` — `cruxCards`, `divergenceMap`, `facets` state; `'crux_extraction'` phase; all new event handlers
3. Auto-call save API after `argument_complete` fires

### Phase 3: New Components

1. `ArgumentCruxCard.tsx` — non-truncating crux card for ARGORA schema
2. `ArgumentReplay.tsx` — read-only replay view for `/debates/[id]`

### Phase 4: Frontend Restructure

1. `GraphDebateView.tsx` — hide framedTopic/positions, add alignment polygon to sidebar, add phase indicator step
2. `ResultsSection.tsx` — 2-col verdict, crux cards tab, simplified analysis tab, Export PDF button, "View in CruxBench" link
3. `ArgumentTimeline.tsx` — remove inline verdict block
4. `ArgumentView.tsx` — same framing/verdict fixes for auto-expert mode

### Phase 5: CruxBench Auto-Submit

1. After debate save, create arena record (`arenaDebates` row) with `argora_crux` output
2. After baselines run (`/api/argument/baselines`), save remaining method outputs to `arenaOutputs`
3. `ArenaClient.tsx` — support `?debateId=` query param to open directly to pairwise voting

### Phase 6: PDF Export + Archive Replay

1. `export-pdf.ts` — add `exportArgumentPDF()` with verdict, crux cards, thread, divergence sections
2. `app/debates/[id]/page.tsx` — add `'argument'` mode branch → render `ArgumentReplay`

---

## Faceted Mode UI

When `facets_decomposed` fires, show horizontal tab nav above the debate thread:
```
[ Facet 1: "Does X..." ] [ Facet 2: "Is Y..." ] [ Facet 3: "Will Z..." ]
```
- Active facet: shows debate thread + phase indicator for that sub-debate
- Completed facets: checkmark + crux card count badge
- Crux cards in Results grouped by facet with the facet question as section header
- Single-mode debates unaffected

---

## Out of Scope

- Changes to crux-personas Python engine
- Changing expert_divergence thresholds or QBAF semantics
- CruxArena standalone run flow (already works at `/arena`)
- `/argument/benchmark` accuracy evaluation page
