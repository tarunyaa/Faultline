# ARGORA Frontend Implementation Plan

**Date**: 2026-03-05
**Status**: Implementation in progress

---

## Overview

Redesign the ARGORA frontend to match the live debate experience of the Dialogue system. Experts appear as personas with avatars, main arguments are opening positions, attacks/supports show as threaded replies, and post-debate results replace the markdown report with structured interactive UI.

---

## Architecture

### Data Flow

```
bridge.py (Python) → stdout JSON events
  → bridge.ts (Node.js) → spawns Python, yields ArgumentEvent
    → route.ts (API) → SSE stream
      → useArgumentStream.ts (Browser) → ArgumentState + derived messages
        → ArgumentView.tsx → layout orchestrator
          ├── ArgumentTimeline (chat-like threaded debate)
          ├── ExpertPanel (hex avatars, scores)
          ├── PhaseProgress (7-step indicator)
          ├── BaselineResults (single-question comparison)
          └── Results section (post-completion):
              ├── ConsensusReport (winner, margin decomposition)
              ├── QBAFTreeVisualization (recursive tree with full text)
              └── CounterfactualPanel (winner-critical interventions)
```

### SSE Event → UI Phase Mapping

| Event | UI Phase | What Appears |
|-------|----------|-------------|
| `argument_start` | Starting | Topic displayed |
| `experts_generated` | Experts | Expert cards appear in sidebar |
| `main_arguments_generated` | Arguments | Opening position messages in timeline |
| `level1_complete` | Building | Level-1 replies appear as threaded messages |
| `level2_complete` | Building | Level-2 replies nest deeper |
| `level3_complete` | Building | Level-3 rebuttals complete the tree |
| `base_scores_assigned` | Scoring | Score badges appear on messages |
| `qbaf_evaluated` | Evaluating | Final scores update, tree visualization unlocked |
| `counterfactual_complete` | Analyzing | Counterfactual panel populates |
| `consensus_generated` | Complete | Winner announced, consensus section appears |
| `report_generated` | Complete | Full results section renders |
| `argument_complete` | Complete | Baselines run, full result available |

### Layout (Desktop)

```
┌──────────────────────────────────────────────────────────┐
│ ARGORA Debate                        Phase: Peer Review  │
│ "Should governments regulate LLMs?"                      │
├─────────────────────────────────┬────────────────────────┤
│                                 │                        │
│  ARGUMENT TIMELINE              │  EXPERT PANEL          │
│  (chat-like, threaded)          │  (hex avatars, scores) │
│                                 │                        │
│  ── Task Extraction ──          │  PHASE PROGRESS        │
│  Main task: "Determine..."      │  (7-step stepper)      │
│                                 │                        │
│  ── Main Arguments ──           │  BASELINE RESULTS      │
│  [E1 avatar] Expert A           │  (after completion)    │
│  "LLMs should be regulated..."  │                        │
│    ├── [-] "But this ignores"   │                        │
│    │   └── [+] "Rebuttal..."    │                        │
│    └── [+] "Evidence shows..."  │                        │
│                                 │                        │
│  [E2 avatar] Expert B           │                        │
│  "Regulation would stifle..."   │                        │
│    └── [-] "Counterpoint..."    │                        │
│                                 │                        │
├─────────────────────────────────┴────────────────────────┤
│                    RESULTS (after completion)             │
│  ┌─────────────┐ ┌──────────────────┐ ┌────────────────┐ │
│  │ CONSENSUS   │ │ QBAF TREE        │ │ COUNTERFACTUAL │ │
│  │ Winner card │ │ Full recursive   │ │ Winner-critical│ │
│  │ Margin tbl  │ │ tree with scores │ │ interventions  │ │
│  └─────────────┘ └──────────────────┘ └────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Mobile: Single column, timeline → experts → results stacked vertically.

---

## File Manifest

### New Files

| File | Purpose |
|------|---------|
| `components/argument/ArgumentTimeline.tsx` | Chat-like threaded argument display |
| `components/argument/PhaseProgress.tsx` | 7-step vertical phase indicator |
| `components/argument/BaselineResults.tsx` | Single-question baseline comparison card |

### Files to Modify

| File | Changes |
|------|---------|
| `lib/argument/types.ts` | Add `ArgumentMessage`, `QBAFHierarchyNode` types |
| `lib/hooks/useArgumentStream.ts` | Derive `messages[]` from state, handle hierarchy data |
| `components/argument/ArgumentView.tsx` | Three-column layout, results section |
| `components/argument/ExpertPanel.tsx` | Hex avatars, per-expert scores, persona-like cards |
| `components/argument/QBAFTreeVisualization.tsx` | Full recursive tree with scores and relations |
| `components/argument/CounterfactualPanel.tsx` | Add winner-critical interventions |
| `components/argument/ConsensusReport.tsx` | Prominent winner display, margin decomposition |
| `argora/bridge.py` | Add `hierarchy` to `qbaf_evaluated` event |

### Files Unchanged

- `app/api/argument/route.ts` — Generic SSE passthrough, already works
- `lib/argument/bridge.ts` — Already handles all event types
- `lib/argument/baseline-bridge.ts` — Already functional
- `lib/argument/benchmarks/*` — Already complete
- `components/argument/ArgumentSetup.tsx` — Already functional
- `components/argument/BenchmarkResults.tsx` — Benchmark page only
- `components/argument/BaselineComparison.tsx` — Benchmark page only
- `app/argument/page.tsx` — Setup/view router, already works
- `app/argument/benchmark/page.tsx` — Already functional

---

## Implementation Phases

### Phase 1: Types + Bridge Enhancement
- Add new types to `types.ts`
- Add hierarchy to `qbaf_evaluated` event in `bridge.py`

### Phase 2: Hook Enhancement
- Derive `ArgumentMessage[]` from state in `useArgumentStream.ts`
- Map hierarchy nodes to threaded messages with depth, relation, scores

### Phase 3: New Components
- `PhaseProgress.tsx` — self-contained stepper
- `ArgumentTimeline.tsx` — chat-like timeline with threaded replies

### Phase 4: Component Rewrites
- `ExpertPanel.tsx` — hex avatars, scores, persona cards
- `QBAFTreeVisualization.tsx` — recursive HTML/CSS tree (no D3)

### Phase 5: Layout + Results
- `ArgumentView.tsx` — three-column layout, results section
- `ConsensusReport.tsx` — winner card, margin table enhancements
- `CounterfactualPanel.tsx` — winner-critical interventions

### Phase 6: Baselines
- `BaselineResults.tsx` — sidebar card for single-question comparison

---

## Design Rules

- **Colors**: Black/red/white only. CSS variables from `globals.css`
- **Attacks**: `border-l-2 border-l-accent` (red left border)
- **Supports**: `border-l border-card-border/40` (subtle border)
- **Expert avatars**: Hex shape with initial letter, deterministic color from index
- **Scores**: Inline badges — `τ=0.50` `σ=0.72` with lift indicator
- **Winner**: Star badge on winning argument
- **No emojis**
- **No D3/Canvas** — pure HTML/CSS tree rendering
- **Responsive**: Desktop 2/3 + 1/3 split, mobile single column

---

## Key Decisions

1. **No ARGORA code changes** — only `bridge.py` (our wrapper) is modified
2. **Messages derived in hook** — not emitted from Python (avoids modifying ARGORA internals)
3. **HTML/CSS tree** — recursive components, no D3 dependency
4. **Baselines auto-run** — after ARGORA completes on single questions
5. **Separate benchmark page** — `/argument/benchmark` for batch dataset evaluation
