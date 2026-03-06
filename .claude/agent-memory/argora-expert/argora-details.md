# ARGORA Detailed Notes

## Pipeline Phases (Paper -> Code Mapping)
- Phase 0: `orchestrator.py` extract_main_task() - 2 LLM calls
- Phase 1: `debate.py` - parallel expert main argument generation
- Phase 2 (L1): `debate.py` _generate_first_level_arguments() + `expert.py` author/peer prompts
- Phase 3 (L2): `debate.py` _process_single_statement_debate() + build_graph_review_prompt()
- Phase 4 (L3): `expert.py` build_targeted_rebuttal_prompt()
- Phase 5: `orchestrator.py` get_prior_strength_with_details() - 3 dimensions
- Phase 6: `qsem.py` - 5 presets (DFQuADModel default), topological + iterative
- Pruning: `similarity_check.py` calculate_co_pruning() - all-MiniLM-L6-v2
- Counterfactual (within-graph): `counterfactual.py` - edge_local_impact, 3 explanation queries
- Winner-critical (cross-QBAF): `eval/generate_consensus_report.py` compute_winner_critical_interventions()
- Margin decomposition: `eval/generate_consensus_report.py` section 2.6
- Override: `orchestrator.py` make_graph_consensus() - scm_alignment_override_mode
- Per-round summary: `summary.py` - adjudication summary (outcome, chain, nodes, robustness)
- Full report: `eval/generate_consensus_report.py` - 7-section Markdown (Appendix F)
- Graph: `graph_builder.py` - Node/Edge/RoundGraph dataclasses

## Repo Structure (Two Key Directories)
- `argora/` core package: debate pipeline, counterfactual engine (within-graph), summary
- `eval/` evaluation scripts: consensus report gen, override analysis, dataset scripts
- `eval_baseline/` baseline implementations: Direct + CoT + MV for each dataset
- `prepare_data/` dataset preparation scripts
- bridge.py must import from BOTH argora/ and eval/

## eval/generate_consensus_report.py Functions
- generate_consensus_report() - main orchestrator, assembles all sections
- generate_section_0() through generate_section_6() - 7 report sections
- build_node_id_mapping() - internal ID -> hierarchical label
- compute_winner_critical_interventions() - cross-QBAF winner-change search
- generate_winner_critical_summary() - robustness classification
- generate_winner_critical_explanation() - mechanism narrative

## eval/eval_argora.py 5-Stage Pipeline
- stage_1_generate_graph() - DebateSession.run()
- stage_2_calculate_semantics() - all qsem presets
- stage_3_calculate_counterfactual() - CounterfactualEngine
- stage_4_calculate_override() - alignment grid search
- stage_5_generate_consensus() - narrative summary
- Parallelized via ThreadPoolExecutor

## eval_baseline/ Structure
- 11 Python scripts (one per dataset)
- Each implements Direct + CoT, optional --majority_vote + --num_trials
- LLM-as-judge tiebreaker for MV ties
- 10 shell wrapper scripts

## QBAF Semantics Presets (qsem.py)
- DFQuADModel: product_signed aggregation + linear influence
- QuadraticEnergyModel: sum_signed + pmax
- SquaredDFQuADModel: product_signed + pmax
- EulerBasedTopModel: top_signed + euler
- EulerBasedModel: sum_signed + euler

## Settings Defaults (settings.py)
- model: gpt-4o-mini
- temperature: 0 (all calls)
- rounds: 2 (but paper evaluates with 1)
- max_level_limit: 3
- argprune_lambda: 0.5
- main_arg_pruning: enabled (threshold 0.9)
- graph_style: "dag" or "tree"
- strength_init: "neutral" or "prior" (also "prior_v2")
- observation_alignment_lambda: 0.5
- scm_alignment_override_mode: "none"/"edge_cost"/"scm_state"
- ENV VAR: OPENAI_API_ARGORA (loaded via python-dotenv)

## DF-QuAD Implementation Difference
- ARGORA qsem.py: product_signed = product(1-attackers) - product(1-supporters) -> single signed value -> linear influence
- Faultline df-quad.ts: separate aggregation of attacks and supports -> combine function
- Both produce equivalent results for linear influence, but internal representation differs
- Faultline df-quad.ts also multiplies by edge.weight (not in standard DF-QuAD / ARGORA)
- Decision: use qsem.py, NOT df-quad.ts

## Estimated LLM Calls Per Debate (3 experts, 1 round)
- ~50-75 GPT-4o-mini calls total
- Base scoring alone can be 20-40 calls (1 per node)
- Baselines: 9 additional calls (1+1+3+1+3)

## Python Dependencies
- 79 packages in requirements.txt
- Key: torch (CPU-only), sentence-transformers, openai, pandas, numpy, scipy
- CPU torch: pip install torch --index-url https://download.pytorch.org/whl/cpu
- ~80MB model download for all-MiniLM-L6-v2

## NRE Formula (From Paper Section 5.2)
NRE = (n_{-->+} - n_{+-->-}) / |N_disagree|
- Measures pre-QBAF majority -> post-QBAF winner transition
- NOT comparison against external majority vote baseline
- DEFINED IN PAPER: Yes (Section 5.2, explicit formula)
- NOT in ARGORA Python repo (no batch metric code)
- Implemented in Faultline: faultline/lib/argument/benchmarks/metrics.ts

## Correctness Margin (From Paper Section 5.2)
Delta_correct = mean(sigma_correct - sigma_wrong) over N_valid
- DEFINED IN PAPER: Yes (Section 5.2, explicit formula)
- NOT in ARGORA Python repo (no batch metric code)
- Implemented in Faultline: faultline/lib/argument/benchmarks/metrics.ts

## Additional Paper Metrics (Section 5.2)
- TRR (Truth Retention Rate): correct->correct transitions
- PRR (Positive Reversal Rate): incorrect->correct transitions
- NRR (Negative Reversal Rate): correct->incorrect transitions
- EPR (Error Persistence Rate): incorrect->incorrect transitions
- JSD (Jensen-Shannon Divergence): QBAF vs observational alignment

## Paper Baselines (Table 1)
1. Direct 1x - single model, no reasoning
2. Direct CoT 1x - single model with CoT
3. MV3 - 3 samples, majority vote, LLM-as-judge ties
4. ARGORA-like CoT 1x - uses Phase 0 prompt, single model
5. ARGORA-like CoT MV3 - uses Phase 0 prompt, 3 samples + MV
