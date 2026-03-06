# ARGORA Benchmarking System

---

## 1. Metrics

### 1.1 Accuracy (QBAF-based and Agnostic)

Two accuracy variants are computed per question:

| Metric | Formula | Measures | Requires Ground Truth |
|--------|---------|----------|-----------------------|
| **Accuracy (QBAF / baseline)** | `correct_baseline / N` | Whether the QBAF winner (highest sigma after modular semantics) maps to the correct answer | Yes |
| **Accuracy (Agnostic / observed)** | `correct_agnostic / N` | Whether the LLM-as-judge observational winner (highest confidence_score, no graph semantics) maps to the correct answer | Yes |

- **QBAF-based**: The main argument `m*` with the highest post-semantics strength `sigma(m*)` is selected. Its statement is parsed for an answer letter/value. This is the primary ARGORA accuracy.
- **Agnostic**: The main argument with the highest `confidence_score` from the QBAF-agnostic consensus (a separate LLM scoring pass that ignores the argument graph structure) is selected and parsed.
- Both are implemented in `eval/eval_argora.py` (lines ~1910-1950) as `accuracy_baseline` and `accuracy_agnostic`.

### 1.2 Net Reversal Efficiency (NRE)

```
NRE = (N_correct_from_wrong - N_wrong_from_correct) / N_disagree
```

- **What it measures**: Among questions where the pre-QBAF majority winner (based on `initial_score`) disagrees with the post-QBAF winner (based on `final_score`), how often does the QBAF evaluation flip wrong answers to correct vs. correct to wrong.
- **Intuition**: Positive NRE means the argumentation process (support/attack propagation through the QBAF tree) is a net benefit -- it fixes more answers than it breaks.
- **Range**: [-1, +1]. NRE = 1.0 means every reversal was beneficial.
- **Key detail**: This is an *internal* metric comparing pre- vs. post-QBAF within ARGORA. It does NOT compare against an external baseline like Direct prompting.
- **Not computed in ARGORA Python code**. Implemented only in Faultline TypeScript: `faultline/lib/argument/benchmarks/metrics.ts` (`computeNRE`).

### 1.3 Correctness Margin (CM)

```
CM = (1/N_valid) * SUM[ mean(sigma_correct) - mean(sigma_wrong) ]
```

- **What it measures**: For each question, computes the average QBAF final strength of main arguments mapped to the correct answer minus the average strength of those mapped to wrong answers. Then averages across all questions.
- **Intuition**: Positive CM means ARGORA assigns higher strength to correct-answer arguments on average. Measures whether the argumentation graph is *structurally biased toward truth*.
- **Range**: Theoretically [-1, +1], practically small values near 0.
- **Not computed in ARGORA Python code**. Implemented only in Faultline TypeScript: `faultline/lib/argument/benchmarks/metrics.ts` (`computeCorrectnessMargin`).

### 1.4 Jensen-Shannon Divergence (JSD)

```
JSD = JS(p_QBAF || p_obs)
```

Where:
- `p_QBAF(m) = sigma(m) / SUM sigma(m')` (normalized QBAF strengths)
- `p_obs(m) = confidence_score(m) / SUM confidence_score(m')` (normalized agnostic LLM-as-judge scores)

- **What it measures**: Divergence between the graph-based distribution and the observation-based distribution over main arguments.
- **Intuition**: Low JSD means the formal argumentation structure agrees with the LLM's holistic assessment. High JSD triggers override search.
- **Range**: [0, ln(2)] (natural log). Typically small values (0.01-0.1).
- **Computed in**: `argora/scm_alignment.py` (`jensen_shannon_from_scores`).

### 1.5 Transition Rate Metrics (from paper Section 5.2)

| Metric | Full Name | Formula | What it captures |
|--------|-----------|---------|-----------------|
| TRR | Total Reversal Rate | `N_disagree / N` | How often QBAF changes the pre-QBAF winner at all |
| PRR | Positive Reversal Rate | `N_correct_from_wrong / N` | How often QBAF fixes a wrong answer |
| NRR | Negative Reversal Rate | `N_wrong_from_correct / N` | How often QBAF breaks a correct answer |
| EPR | Equal Performance Rate | `1 - TRR` | How often QBAF agrees with the pre-QBAF majority |

These are derived from the same pre/post-QBAF comparison as NRE. None are batch-computed in the ARGORA Python repo.

---

## 2. Datasets

### 2.1 Dataset Table

| Dataset | Domain | Format | Choices | Full Size | ARGORA Sample | Key Reasoning Skill |
|---------|--------|--------|---------|-----------|---------------|-------------------|
| TruthfulQA | General knowledge | MC or Claim | 2 (binary) | 817 | 50 | Resisting common misconceptions |
| GPQA Diamond | Graduate-level science | MC | 4 | 198 | 50 | Expert-level domain reasoning |
| MMLU | Broad academic | MC | 4 | 14,042 | 50 | General knowledge + reasoning |
| MMLU-Pro | Harder academic | MC | 10 | 12,032 | 50 | Extended multi-choice reasoning |
| MedQA | Clinical medicine | MC or Claim | 4 (MC) / 2 (claim) | 1,273 | 50 | Medical diagnostic reasoning |
| StrategyQA | Commonsense | MC or Claim | 2 (binary) | 2,290 | 50 | Multi-hop commonsense reasoning |
| GSM8K | Math word problems | Open-ended | N/A | 1,319 | 50 | Arithmetic reasoning |
| MuSR Team Allocation | Soft reasoning | MC | 4-5 | ~100 | 50 | Constraint satisfaction |
| MuSR Object Placements | Soft reasoning | MC | 4-5 | ~100 | 50 | Spatial/state tracking |
| MuSR Murder Mystery | Soft reasoning | MC | 4-5 | ~100 | 50 | Abductive reasoning |

### 2.2 Dataset Descriptions

- **TruthfulQA**: Tests whether models give truthful answers rather than repeating popular misconceptions (e.g., "What happens if you swallow gum?"). Binary true/false format in claim mode.
- **GPQA Diamond**: PhD-level questions in physics, chemistry, and biology written by domain experts. Designed to be unsearchable and require genuine expertise.
- **MMLU / MMLU-Pro**: Massive Multitask Language Understanding. MMLU-Pro extends to 10 choices and harder distractors, reducing lucky guessing.
- **MedQA**: US Medical Licensing Exam-style questions. Tests clinical reasoning and differential diagnosis.
- **StrategyQA**: Implicit multi-hop reasoning questions (e.g., "Could a llama fit through the door of a standard elevator?") requiring decomposition into sub-questions.
- **GSM8K**: Grade-school math word problems requiring multi-step arithmetic. ARGORA treats these as open-ended (no MC choices).
- **MuSR (x3)**: Multistep Soft Reasoning tasks. Each variant tests a different reasoning type: team allocation (constraint satisfaction), object placements (tracking object states across narrative), and murder mystery (abductive reasoning from clues).

### 2.3 Dual-Mode Datasets

Three datasets support both MC and claim-verification modes:

| Dataset | MC Mode | Claim Mode |
|---------|---------|------------|
| TruthfulQA | `truthfulqa_binary.json` (A/B choices) | `truthfulqa_claim.json` (True/False) |
| MedQA | `medqa_mc.json` (4-way MC) | `medqa_claim.json` (True/False) |
| StrategyQA | `strategyqa_binary.json` (Yes/No MC) | `strategyqa_claim.json` (True/False) |

Mode is controlled via `--truthful_qa_mode`, `--med_qa_mode`, `--strategy_qa_mode` CLI flags to `eval_argora.py`.

---

## 3. Per-Debate vs Batch Analysis

### 3.1 Per-Debate (Single Question) Outputs

Every single ARGORA debate produces the following without batch aggregation:

| Output | Ground Truth Needed | Source |
|--------|-------------------|--------|
| Full argument hierarchy (QBAF trees per main arg) | No | `DebateSession.run()` |
| QBAF strengths sigma(m) via modular semantics | No | `qsem.compute_strengths_single_pass()` |
| QBAF winner m* and decision margin | No | `eval_argora.py` stage 2-3 |
| Counterfactual analysis (most influential child, decisive chain, most influential node) | No | `CounterfactualEngine` (stage 3) |
| Winner-critical interventions (single-edge deletions that flip winner) | No | `generate_consensus_report.py` `compute_winner_critical_interventions()` |
| Margin decomposition (prior margin vs argumentative margin per competitor) | No | `generate_consensus_report.py` `generate_multi_competitor_interpretation()` |
| p_obs vs p_QBAF distribution comparison + JSD | No | `scm_alignment.py` |
| Override analysis (intervention search when m* != m_obs) | No | `scm_alignment.py` + stage 4 |
| Full Appendix F consensus report (7-section markdown) | No (but answer mapping benefits from it) | `generate_consensus_report()` |

The consensus report is generated per-debate via `bridge.py` -> `run_consensus_report()` -> `generate_consensus_report()`. It requires zero additional LLM calls beyond the debate itself.

### 3.2 Batch-Aggregated Metrics

These require running N questions and aggregating:

| Metric | Ground Truth Needed | Computed In |
|--------|-------------------|-------------|
| Accuracy (QBAF-based) | Yes | `eval_argora.py` (Python) |
| Accuracy (Agnostic) | Yes | `eval_argora.py` (Python) |
| NRE | Yes | `faultline/lib/argument/benchmarks/metrics.ts` (TypeScript only) |
| Correctness Margin | Yes | `faultline/lib/argument/benchmarks/metrics.ts` (TypeScript only) |
| TRR, PRR, NRR, EPR | Yes | Not batch-computed in either codebase |
| Override rate per cost_type per lambda | No | `eval_argora.py` (override statistics) |

---

## 4. Baselines

### 4.1 Baseline Conditions

| Condition | Prompt Strategy | Trials | Aggregation | Temperature | What It Isolates |
|-----------|----------------|--------|-------------|-------------|-----------------|
| **Direct 1x (Vanilla)** | Direct answer, no reasoning | 1 | None | 0.0 | Raw model knowledge, no scaffolding |
| **Direct CoT 1x** | "Think step-by-step" + answer | 1 | None | 0.0 | Value of chain-of-thought alone |
| **Direct MV3 (Vanilla)** | Direct answer, no reasoning | 3 | Majority vote | 0.0 | Value of self-consistency without CoT |
| **Direct CoT MV3** | "Think step-by-step" + answer | 3 | Majority vote | 0.0 | Combined CoT + self-consistency |
| **ARGORA-like CoT 1x** | CoT with ARGORA-style prompt framing | 1 | None | 0.0 | ARGORA's prompt quality minus its graph structure |
| **ARGORA-like CoT MV3** | CoT with ARGORA-style prompt framing | 3 | Majority vote | 0.0 | Full non-structural benefit of ARGORA's approach |

- All baselines use the same model as ARGORA (default: `gpt-4o-mini`).
- MV3 ties are broken by an LLM judge call.
- Each baseline has a dedicated script in `eval_baseline/` (10 Python scripts + 10 shell wrappers). They are **not** run automatically by `eval_argora.py`.

### 4.2 Baseline File Layout

```
eval_baseline/
  eval_truthfulqa_baseline.py     run_truthfulqa_baseline.sh
  eval_gpqa_baseline.py           run_gpqa_baseline.sh
  eval_mmlu_baseline.py           run_mmlu_baseline.sh
  eval_mmlu_pro_baseline.py       run_mmlu_pro_baseline.sh
  eval_medqa_baseline.py          run_medqa_baseline.sh
  eval_strategyqa_baseline.py     run_strategyqa_baseline.sh
  eval_gsm8k_baseline.py          run_gsm8k_baseline.sh
  eval_musr_team_allocation_baseline.py    run_musr_team_allocation_baseline.sh
  eval_musr_object_placements_baseline.py  run_musr_object_placements_baseline.sh
  eval_musr_murder_mystery_baseline.py     run_musr_murder_mystery_baseline.sh
```

---

## 5. Results (Paper Table 1)

### 5.1 Accuracy Results

| Dataset | Direct 1x | Direct CoT 1x | MV3 | CoT MV3 | ARGORA pre-override | ARGORA post-override | Delta (ARGORA pre vs Direct 1x) |
|---------|-----------|---------------|-----|---------|---------------------|---------------------|---------------------------------|
| TruthfulQA | 0.792 | 0.792 | 0.746 | 0.786 | **0.882** | 0.882 | **+9.0pp** |
| GPQA Diamond | 0.394 | 0.394 | 0.386 | 0.411 | 0.424 | **0.455** | +6.1pp |
| MMLU-Pro | 0.576 | 0.616 | 0.576 | 0.596 | **0.636** | 0.636 | +6.0pp |
| MedQA | 0.660 | 0.680 | 0.680 | 0.660 | 0.660 | **0.700** | +4.0pp |
| MuSR Team | 0.480 | 0.420 | 0.440 | 0.400 | **0.520** | 0.520 | +4.0pp |
| MuSR Murder | 0.500 | 0.460 | 0.460 | 0.440 | **0.540** | 0.540 | +4.0pp |
| StrategyQA | 0.740 | 0.740 | 0.740 | 0.760 | **0.780** | 0.780 | +4.0pp |
| GSM8K | 0.860 | 0.880 | 0.880 | 0.880 | **0.880** | 0.880 | +2.0pp |
| MuSR Object | 0.380 | 0.340 | 0.400 | 0.360 | 0.380 | 0.380 | 0.0pp |
| MMLU | 0.740 | 0.780 | 0.780 | 0.760 | **0.780** | 0.780 | +4.0pp |

*Values from paper Table 1. All evaluated on N=50 samples per dataset with gpt-4o-mini.*

### 5.2 Key Insights

- **Best relative gain**: TruthfulQA (+9pp). ARGORA's structured argumentation helps resist misconceptions that the base model confidently believes.
- **MV3 can hurt**: On TruthfulQA, MV3 (0.746) is *worse* than Direct 1x (0.792). Majority voting amplifies systematic misconceptions when the model is consistently wrong. ARGORA avoids this because strength is determined by argument structure, not vote counting.
- **Worst case**: MuSR Object Placements (0pp gain). Spatial state tracking is poorly suited to natural-language argumentation.
- **Override helps selectively**: Post-override accuracy exceeds pre-override only on GPQA (+3.1pp) and MedQA (+4.0pp), where the LLM-as-judge observational assessment catches errors the QBAF structure misses.

---

## 6. How Arguments Work (NOT Answer-Differentiated)

A critical design property of ARGORA that distinguishes it from ensemble/voting approaches:

- **Main arguments are free-form**, not assigned to MCQ option letters. Each expert generates arguments for the topic, and each argument contains a `statement` field that may (but need not) contain "FINAL ANSWER: X".
- **Winner = single main argument with highest sigma**, not an aggregation by answer letter. If three main arguments all support answer "B" but with different reasoning, they compete as separate QBAF trees with independent strengths. Their sigmas are never combined.
- **Answer letter extraction happens post-hoc** in the eval harness only. The `parse_final_answer()` function uses regex to extract "FINAL ANSWER: X" from the winning argument's statement. This mapping is for evaluation purposes only and does not influence the QBAF computation.
- **Multiple arguments can support the same answer** with different strengths. The ARGORA framework does not know or care which answer letter an argument maps to during the debate or graph evaluation.

This means ARGORA's accuracy depends entirely on the *single strongest argument* being correct, not on a plurality of arguments agreeing.

---

## 7. Evaluation Pipeline

### 7.1 `eval_argora.py` Pipeline Stages

For each question, 5 stages execute sequentially:

| Stage | Name | What It Does | Key Functions |
|-------|------|-------------|---------------|
| 1 | Generate Graph | Run full ARGORA debate: expert selection, argument generation (multi-round), QBAF construction, agnostic scoring | `stage_1_generate_graph()` -> `DebateSession.run()` |
| 2 | Calculate Semantics | Compute `sigma(m)` for all nodes via bottom-up modular semantics propagation | `stage_2_calculate_semantics()` -> `compute_strengths_single_pass()` |
| 3 | Counterfactual | Edge-local interventions on winning QBAF: most influential child, decisive chain, most influential node | `stage_3_calculate_counterfactual()` -> `CounterfactualEngine` |
| 4 | Override | If QBAF winner != observational winner, search for minimum-cost single-edge intervention that aligns them. Grid search over lambda values and 4 cost types. | `stage_4_calculate_override()` -> `build_alignment_inputs_from_graph()` |
| 5 | Consensus | Generate graph-based consensus text via orchestrator (for JSON output) | `stage_5_generate_consensus()` -> `Orchestrator.make_graph_consensus()` |

### 7.2 Parallelism

- **Data-point parallelism**: Controlled by `num_datapoints_parallel` in `eval_settings.py` (default: 5). Uses `ThreadPoolExecutor`.
- **Semantics parallelism**: When `--test_all_semantics` is set, all 5 semantics types are processed in parallel per data point.
- **Baseline parallelism**: MV3 trials run in parallel within each baseline script (up to 10 workers).

### 7.3 Configuration (`eval_settings.py`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `model` | `gpt-4o-mini` | LLM for debate and consensus |
| `parse_model` | `gpt-4o-mini` | LLM for answer extraction |
| `rounds` | 1 | Debate rounds |
| `num_experts` | 3 | Domain experts generated per debate |
| `max_main_args` | 1 | Main arguments per expert |
| `max_args_per_exp` | 3 | Supporting/attacking arguments per expert |
| `max_level_limit` | 3 | Max depth of argument tree |
| `strength_init` | `prior_v2` | Base score initialization method |
| `argprune_lambda` | 0.7 | Orthogonality pruning threshold (sentence embedding cosine) |
| `alignment_lambda_grid` | 17 values from 1e-7 to 1.0 | Override cost-divergence tradeoff sweep |
| `num_datapoints_parallel` | 5 | Concurrent question processing |
| `universal_temperature` | 0.0 | LLM temperature for all debate calls |

### 7.4 Ablation Controls

- `--test_all_semantics`: Run all 5 QBAF semantics (QuadraticEnergy, SquaredDFQuAD, EulerBasedTop, EulerBased, DFQuAD)
- `--test_all_priors`: Test both `prior` and `neutral` (0.5) base score initialization
- `--random_experts`: Replace topic-relevant expert selection with random selection
- `--main_arg_pruning`: Enable/disable semantic similarity pruning of main arguments
- `--single_model_run`: Skip debate entirely, use single model completion as a baseline

---

## 8. Consensus Report Structure

### 8.1 Report Sections (Appendix F Format)

The per-debate consensus report (`generate_consensus_report()`) produces a 7-section markdown document. No additional LLM calls are required.

| Section | Title | Content |
|---------|-------|---------|
| 0 | Configuration and Metadata | Topic, expert identities, framework settings, execution summary, evaluation summary (QBAF winner, obs winner, answer mapping) |
| 1 | Main Argument Enumeration | Full text of all main arguments, source expert, round, parsed answers |
| 2 | QBAF Evaluation | Base scores w(m) with 3-criterion breakdown (task relevance, evidence support, logical soundness), QBAF tree structure visualization, final strengths sigma(m), QBAF consensus distribution p_QBAF, **margin decomposition** |
| 3 | Counterfactual Analysis | Most influential direct child, most decisive argument chain, most influential overall node, **winner-critical interventions** |
| 4 | Observational Override Analysis | p_obs distribution, distribution comparison (p_QBAF vs p_obs), JSD, override decision and details |
| 5 | Aggregation Method Comparison | Side-by-side comparison of QBAF vs LLM-as-judge winners |
| 6 | Final Decision Summary | Winner, answer, final score, decision margin, override status, stability assessment, key supporting evidence |

### 8.2 Winner-Critical Interventions (Section 3.4)

- **Definition**: A single-edge deletion from any QBAF tree that causes the global winner to change.
- **Scope**: All edges across all main argument QBAFs. For each non-root node x with parent p, computes `sigma^{-x}(m*)` by removing edge (x -> p) and recomputing.
- **Output**: List of `WinnerCriticalCandidate` objects with: which QBAF, which edge, edge type (SUPPORT/ATTACK), pre/post intervention strengths, new winner identity, cost.
- **Robustness classification**: STRUCTURALLY_STABLE (0 critical), MOSTLY_STABLE (<5%), MODERATELY_BRITTLE (5-20%), HIGHLY_BRITTLE (>20%).
- **Code**: `compute_winner_critical_interventions()` in `eval/generate_consensus_report.py`.

### 8.3 Margin Decomposition (Section 2.6)

For the winner m* vs each competitor m_j:

```
Prior Margin     = w(m*) - w(m_j)           (base score advantage)
Arg. Margin      = Delta_lift(m*) - Delta_lift(m_j)  (argumentation contribution)
Final Margin     = sigma(m*) - sigma(m_j)   (total advantage)

where Delta_lift(m) = sigma(m) - w(m)
```

Victory types per competitor:
- **PRIOR-DOMINATED**: Prior >= 0, Arg >= 0 -- m* led and argumentation reinforced
- **ARG-REVERSED**: Prior < 0, Final > 0 -- m* overcame a prior deficit via argumentation
- **ARG-ERODED**: Prior > 0, Arg < 0, Final > 0 -- m* won on prior but argumentation narrowed lead

### 8.4 Counterfactual Queries (Section 3.1-3.3)

Three counterfactual questions are answered for the winning QBAF:

1. **Most influential direct child**: Which immediate child of m* has the largest `|Delta_edge|` when removed? Identifies the single most important first-level support or attack.
2. **Most decisive argument chain**: Which leaf node's removal causes the largest root strength change? Identifies the deepest reasoning chain that most affects the outcome.
3. **Most influential overall node**: Which non-root node anywhere in the QBAF tree has the largest `|Delta_edge|` when removed? May be an intermediate node (not a leaf or direct child).

---

## 9. Cost

### 9.1 LLM Calls Per ARGORA Debate

| Phase | Approximate Calls | Notes |
|-------|-------------------|-------|
| Task extraction | 1 | Extract main_task and key_elements from topic |
| Expert selection | 1 | Select N domain experts |
| Per-expert prompts | N (3) | Generate custom prompts per expert |
| Argument generation | N (3) | Each expert generates main + supporting/attacking args |
| Prior strength scoring | 1 | Score all main arguments on 3 criteria |
| Orthogonality pruning | 0 | Uses sentence embeddings (all-MiniLM-L6-v2), no LLM |
| QBAF-agnostic consensus | 1 | LLM-as-judge scoring of arguments without graph |
| Graph consensus | 1 | LLM summarizes graph-based winner |
| Answer parsing | 2-3 | Parse answers from winner statements (baseline + agnostic) |
| **Total per question** | **~12-15** | With N=3 experts, 1 round |

With N=5 experts (as shown in some configurations): ~18-22 calls per question.

The paper states approximately 50-75 GPT-4o-mini calls per debate for the full pipeline including multi-round configurations.

### 9.2 Baseline Costs

| Condition | LLM Calls Per Question | Notes |
|-----------|----------------------|-------|
| Direct 1x | 1 (+ 1 parse) | Single completion |
| Direct CoT 1x | 1 (+ 1 parse) | Single completion with reasoning |
| MV3 | 3 (+ 3 parse + possible 1 tiebreak) | 3 trials + parsing + possible judge |
| CoT MV3 | 3 (+ 3 parse + possible 1 tiebreak) | Same structure with CoT |

### 9.3 Approximate Dollar Costs (GPT-4o-mini pricing)

- GPT-4o-mini: ~$0.15/1M input, ~$0.60/1M output tokens
- **Single ARGORA debate**: ~$0.01-0.03 (depending on argument depth and token counts)
- **50-question eval run**: ~$0.50-1.50 for ARGORA, ~$0.05-0.10 for Direct baselines
- **Full benchmark suite** (10 datasets x 50 questions): ~$5-15 for ARGORA, ~$0.50-1.00 for all baselines combined
- ARGORA is roughly 10-15x more expensive than a Direct 1x baseline per question

---

## Key File Paths

| File | Purpose |
|------|---------|
| `argora/eval/eval_argora.py` | Main evaluation pipeline (stages 1-5, batch stats) |
| `argora/eval_settings.py` | Default configuration (model, experts, rounds, lambda grid) |
| `argora/eval/generate_consensus_report.py` | Per-debate report generation (7 sections, winner-critical, margin decomposition) |
| `argora/eval/consensus_report/report_template.md` | Appendix F report template |
| `argora/eval/dataset_scripts/__init__.py` | Dataset evaluator registry, `GraphConsensusInfo`, `DatasetResult` |
| `argora/eval/dataset_scripts/*.py` | Per-dataset evaluators (10 modules) |
| `argora/eval_baseline/*.py` | Baseline evaluation scripts (10 scripts) |
| `argora/eval_baseline/*.sh` | Baseline shell wrappers (10 scripts) |
| `argora/argora/qsem.py` | QBAF semantics (5 presets: DFQuAD, SquaredDFQuAD, QuadraticEnergy, EulerBased, EulerBasedTop) |
| `argora/argora/scm_alignment.py` | p_obs/p_QBAF extraction, JSD computation, override search |
| `argora/argora/counterfactual.py` | `CounterfactualEngine` (edge-local impact, decisive chains) |
| `argora/bridge.py` | `run_consensus_report()` -- bridge from DebateSession output to report |
| `faultline/lib/argument/benchmarks/metrics.ts` | NRE + Correctness Margin (TypeScript, not in ARGORA Python) |
