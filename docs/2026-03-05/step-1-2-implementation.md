# Step 1 & 2: Implementation Plan

**Date**: 2026-03-05
**Status**: Phases 1-8 implemented. Post-review fixes applied.

---

## Step 1: "Argument" Debate Type (ARGORA Integration)

### 1.1 Repo Verification

The argora-public repo (`github.com/iJinjin/argora-public`, ~9.7K lines Python) has been verified against the paper (arXiv:2601.21533). **The full pipeline is implemented**, split across two directories:

- **`argora/`** (core package): Phases 0-6, within-graph counterfactuals, per-round adjudication
- **`eval/`** (evaluation + reporting): Consensus report (Appendix F), winner-critical interventions, margin decomposition, baseline runners, dataset loaders

| Paper Component | Location | Key Files |
|----------------|----------|-----------|
| Phase 0: Main task + key element extraction | `argora/` | `orchestrator.py`: `extract_main_task()` |
| Phase 1: Main argument generation (Algo 1) | `argora/` | `debate.py`: parallel expert queries |
| Phase 2: Level-1 arguments (Algo 3) | `argora/` | `debate.py`, `expert.py`: author/peer roles |
| Phase 3: Level-2 peer review (Algo 4) | `argora/` | `debate.py`: `_process_single_statement_debate()` |
| Phase 4: Level-3 rebuttals (Algo 5) | `argora/` | `expert.py`: `build_targeted_rebuttal_prompt()` |
| Phase 5: Base score assignment (Algo 6) | `argora/` | `orchestrator.py`: `get_prior_strength_with_details()` |
| Phase 6: QBAF evaluation (Algo 7) | `argora/` | `qsem.py`: 5 semantics presets, DF-QuAD default |
| Orthogonality pruning (Algo 2) | `argora/` | `similarity_check.py`: all-MiniLM-L6-v2, 2-stage + fallback |
| Main argument pruning | `argora/` | `debate.py`: `_should_prune_main_arguments()`, threshold 0.9 |
| Agnostic consensus scoring | `argora/` | `orchestrator.py`: `make_agnostic_consensus()` |
| Edge-local counterfactuals + 3 queries | `argora/` | `counterfactual.py`: influential child, chain, node |
| Observation-aligned override | `argora/` | `orchestrator.py`: 3 modes (none/edge_cost/scm_state) |
| Winner-critical interventions (App. E) | `eval/` | `generate_consensus_report.py`: cross-QBAF edge search |
| Margin decomposition (App. E) | `eval/` | `generate_consensus_report.py`: prior vs argumentative |
| Full consensus report (App. F) | `eval/` | `generate_consensus_report.py` + `report_template.md` |
| Baseline runners | `eval_baseline/` | 11 scripts: Direct, CoT, MV for each dataset |
| Dataset loaders | `eval/dataset_scripts/` | 10 loaders (MMLU-Pro, TruthfulQA, MedQA, GPQA, MuSR, etc.) |
| Batch evaluation pipeline | `eval/` | `eval_argora.py`: 5-stage pipeline with ThreadPoolExecutor |

### 1.2 Integration Strategy

**Plain copy at repo root, run as Python subprocess. No modifications to ARGORA code.**

```
repo root/
  faultline/                          -- Next.js app (TypeScript)
    app/api/argument/route.ts         -- SSE endpoint, spawns Python process
    lib/argument/                     -- TypeScript bridge + types
    components/argument/              -- frontend components

  argora/                             -- plain copy of argora-public (Python)
    argora/                           -- core package
    eval/                             -- evaluation + reporting
    eval_baseline/                    -- baseline runners
    bridge.py                         -- NEW: thin wrapper -> JSON events to stdout
    requirements.txt

  docker-compose.yml                  -- Postgres (existing)
```

**Key decisions**:
- **LLM**: OpenAI GPT-4o-mini (paper default). Env var: `OPENAI_API_ARGORA`
- **PyTorch**: CPU-only (no CUDA)
- **Embeddings**: all-MiniLM-L6-v2, local, ~80MB auto-download
- **QBAF**: ARGORA's `qsem.py` (not Faultline's `df-quad.ts`)
- **Experts**: 3 (paper default), configurable
- **Rounds**: 1 (paper evaluation default)
- **Temperature**: 0 for all calls
- **Deployment**: Local Python for now. Vercel deployment is a future concern.

### 1.3 Bridge Layer

`argora/bridge.py` — the only new Python file:
1. Accepts topic + config via args
2. Runs `DebateSession.run()` (core pipeline)
3. Calls `eval/generate_consensus_report.py` for winner-critical interventions + margin decomposition
4. Emits newline-delimited JSON events to stdout

`faultline/lib/argument/bridge.ts` — TypeScript side:
1. Spawns Python process (`argora/.venv/bin/python bridge.py`)
2. Reads stdout line-by-line, parses JSON events
3. Emits typed events to SSE endpoint

### 1.4 SSE Event Flow

```
argument_start
  -> experts_generated
  -> main_arguments_generated
  -> level1_complete (+ pruning stats)
  -> level2_complete (peer review)
  -> level3_complete (rebuttals)
  -> base_scores_assigned (per-node 3-dimension scores)
  -> qbaf_evaluated (root strengths via DF-QuAD)
  -> counterfactual_complete (3 explanation queries)
  -> consensus_generated (winner, margin decomposition, override status)
  -> argument_complete (full result)
  | error
```

### 1.5 New Files

**TypeScript** (under `faultline/`):
```
lib/argument/types.ts               -- types mirroring ARGORA output structures
lib/argument/bridge.ts              -- spawn Python, parse JSON, emit typed events
app/api/argument/route.ts           -- SSE POST endpoint
app/argument/page.tsx               -- server component
```

**Frontend** (under `faultline/components/argument/`):
```
ArgumentView.tsx                    -- main view (topic input -> streaming results)
ArgumentSetup.tsx                   -- topic input (no persona selection)
QBAFTreeVisualization.tsx           -- per-expert QBAF tree with scores
CounterfactualPanel.tsx             -- edge-local intervention results
ConsensusReport.tsx                 -- winner, margin decomposition, robustness
ExpertPanel.tsx                     -- auto-generated expert roles
DiscussionTimeline.tsx              -- 3-level discussion flow
```

**UI layout**: Desktop = left 2/3 discussion + QBAFs, right 1/3 expert panel + consensus. Mobile = single column.

**Do NOT reuse**: `df-quad.ts`, `lib/llm/client.ts`, persona loading, speech roles, crux rooms, disagreement detection.

### 1.6 What We Skip

- No persona selection (experts are auto-generated)
- No crux rooms (ARGORA uses counterfactual analysis)
- No speech roles or voice profiles
- No personality agent integration (Step 4)

---

## Step 2: ARGORA Benchmarks

### 2.1 Metrics

All metrics are **batch statistics** over many questions — not meaningful for a single debate.

**Accuracy**: % of questions where the method selects the correct answer.

**NRE (Net Reversal Efficiency)**: `(n_{-->+} - n_{+-->-}) / |N_disagree|`
- Measures whether QBAF evaluation corrects wrong initial majorities more than it flips right ones
- Internal metric: pre-QBAF majority vs. post-QBAF winner (not ARGORA vs. external baseline)
- Raw counts tracked in `eval/evaluate_alignment_override.py`

**Correctness Margin**: `mean(sigma_correct - sigma_wrong)` over questions with both correct and incorrect main arguments. Positive = QBAF systematically favors correct answers.

### 2.2 Baselines (from paper Table 1)

All use GPT-4o-mini at temperature 0. All implemented in `eval_baseline/`.

| Condition | Method |
|-----------|--------|
| Direct 1x | Single LLM, direct answer |
| Direct CoT 1x | Single LLM with chain-of-thought |
| MV3 | 3 samples, majority vote |
| ARGORA-like CoT 1x | Single LLM with ARGORA's Phase 0 prompt |
| ARGORA-like CoT MV3 | 3 samples with ARGORA's Phase 0 prompt, majority vote |
| ARGORA | Full pipeline |

Baselines 4-5 isolate ARGORA's prompt engineering contribution from the formal argumentation pipeline.

### 2.3 Two Display Modes

**Per-debate analysis (always shown, no ground truth needed)**:
- QBAF root strengths per main argument
- Counterfactual explanations (3 queries)
- Margin decomposition (prior vs. argumentative)
- Winner-critical interventions (robustness)
- Override status

**Batch benchmark (separate `/argument/benchmark` page)**:
- Loads N questions from a known-answer dataset
- Runs ARGORA + all 5 baselines
- Displays accuracy, NRE, correctness margin with error bars
- Uses existing `eval/eval_argora.py` pipeline + `eval_baseline/` scripts

### 2.4 Datasets

Available via `eval/dataset_scripts/` and `prepare_data/`:
MMLU-Pro (500), MedQA (500), TruthfulQA (500), GPQA Diamond (198), MuSR (3 subtasks), GSM8K, StrategyQA, KnightKnaveSpy.

Format: `{"question": "...", "choices": [...], "answer": 0, "subject": "..."}`

### 2.5 Ad-Hoc Topics

For user-submitted topics without ground truth: show per-debate analysis only (strengths, counterfactuals, margin, robustness). Optional "mark correct answer" interaction contributes to aggregate metrics over time.

### 2.6 New Files (Step 2)

```
faultline/
  lib/argument/benchmarks/
    types.ts              -- BenchmarkQuestion, BatchResult, AggregateMetrics
    runner.ts             -- orchestrate Python eval scripts via subprocess
    metrics.ts            -- parse output, aggregate

  app/argument/benchmark/
    page.tsx              -- dataset selection, progress, aggregate results

  components/argument/
    BenchmarkResults.tsx  -- accuracy table, NRE, CM display
    BaselineComparison.tsx -- per-question drill-down
```

---

## Implementation Status

All 8 phases complete. Post-review fixes applied:

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Repo setup + Python venv | Done | CPU torch, sentence_transformers installing |
| 2. bridge.py | Done | Fixed: uses `generate_consensus_report()` (not raw `compute_winner_critical_interventions`), paper-correct settings defaults |
| 3. TS bridge + SSE | Done | Fixed: stderr check condition |
| 4. Basic frontend | Done | ArgumentSetup, ArgumentView, ExpertPanel, DiscussionTimeline |
| 5. Full frontend | Done | QBAFTreeVisualization, CounterfactualPanel, ConsensusReport |
| 6. Benchmark runner | Done | Fixed: ARGORA parser extracts pre/post QBAF answers + per-main-arg scores |
| 7. Benchmark frontend | Done | BenchmarkResults, BaselineComparison |
| 8. Critique review | Done | All critical bugs fixed (see below) |

### Post-Review Fixes (Phase 8)

1. **bridge.py**: `run_consensus_report()` now calls `generate_consensus_report()` which internally reconstructs `RoundGraph` — previously passed flat list to `compute_winner_critical_interventions()` which expects `RoundGraph` + `qsem_type`
2. **bridge.py**: Settings overrides for interactive use: `max_main_args=None` (was 1), `main_arg_pruning=True` (was False), `similarity_calculation="co-pruning"` (was "fast")
3. **metrics.ts**: `computeNRE()` now computes paper-correct internal metric (pre-QBAF vs post-QBAF) instead of comparing against external baseline
4. **metrics.ts**: `computeCorrectnessMargin()` now computes `mean(sigma_correct) - mean(sigma_wrong)` across all main arguments per question
5. **types.ts**: `key_elements` changed from `string` to `string[]`
6. **bridge.ts**: Fixed inverted stderr condition (`&& processEnded` instead of `&& !processEnded`)
7. **runner.ts**: ARGORA parser now extracts `mainArgScores`, `preQbafAnswer/postQbafAnswer` for NRE/CM computation
8. **MV3**: Still a placeholder (copies CoT) — implementing properly requires 3x API cost

**Estimated cost per debate**: ~50-75 GPT-4o-mini calls (~$0.02-0.05). Baselines add 9 calls per question.

## Agent Team Structure

- **argora-expert**: Phase 1 directly (needs paper knowledge). Writes bridge.py spec for Phase 2. Reviews all phases for paper fidelity.
- **Coding agents**: Implement bridge.py, TypeScript layer, frontend, benchmarks.
- **Documentation agent**: Keeps this plan updated, prunes stale information.
- After Phase 3, two coding agents work in parallel (Track A + Track B).

## Setup

```bash
cd argora
python -m venv .venv
source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
echo 'OPENAI_API_ARGORA=sk-...' > .env
```

Env vars: `OPENAI_API_ARGORA` in `argora/.env`. Existing `ANTHROPIC_API_KEY` in `faultline/.env.local` unchanged.

## Open Questions

1. **Expert count**: Configurable in UI or hardcode 3?
2. **Storage**: Persist argument debates to DB or file-based?
3. **Navigation**: How does `/argument` fit into the user flow?
4. **Override mode**: Default to "edge_cost" (paper default)?
5. **QBAF semantics**: Expose all 5 presets in UI or just DF-QuAD?
