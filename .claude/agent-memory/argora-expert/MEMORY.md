# ARGORA Expert Memory

## Paper Reference
- arXiv:2601.21533 (Jan 30, 2026)
- GitHub: github.com/iJinjin/argora-public (~9.7K lines Python)
- Authors: Youngjin Jin et al. (KAIST / S2W Inc.)

## Key Architecture Details
- See `argora-details.md` for full pipeline, code mapping, and integration notes

## Integration Decisions (2026-03-05)
- Plain copy of argora-public at repo root (NOT submodule, NOT TypeScript port)
- Use GPT-4o-mini (user provides OpenAI key via OPENAI_API_ARGORA), not Anthropic
- Use ARGORA's own qsem.py, NOT Faultline's df-quad.ts
- CPU-only PyTorch (no CUDA)
- Sentence embeddings (all-MiniLM-L6-v2) are a hard dependency for orthogonality pruning
- Bridge pattern: Python stdout JSON -> TypeScript SSE -> browser

## Repo Code Location (CORRECTED 2026-03-05)
- Core pipeline (phases 0-6): `argora/` package
- Winner-critical interventions: `eval/generate_consensus_report.py` (NOT missing)
- Margin decomposition: `eval/generate_consensus_report.py` (NOT missing)
- Full Appendix F report: `eval/generate_consensus_report.py` + `eval/consensus_report/report_template.md` (NOT missing)
- Baselines: `eval_baseline/` (11 Python scripts + 10 shell wrappers)
- Dataset loaders: `eval/dataset_scripts/` (10 modules)

## Actually Missing from ARGORA Python Repo
- NRE and Correctness Margin are NOT computed in argora Python code (no batch metric functions)
- Both ARE defined in the paper (Section 5.2) with explicit formulas
- Both ARE implemented in Faultline TypeScript: `faultline/lib/argument/benchmarks/metrics.ts`

## Key Metrics
- NRE: internal metric (pre-QBAF majority -> post-QBAF winner), NOT vs external baseline
- Correctness Margin: sigma_correct - sigma_wrong, averaged over N_valid
- Also: TRR, PRR, NRR, EPR (transition rates), JSD (alignment)
- Paper baselines: Direct 1x, Direct MV3, ARGORA-like CoT 1x, ARGORA-like CoT MV3
- ARGORA env var: OPENAI_API_ARGORA (not OPENAI_API_KEY)

## Paper Results (Table 1, best dataset)
- TruthfulQA: 0.882 pre-override (vs 0.792 Direct baseline) = +9% absolute
- GPQA Diamond: 0.455 post-override (vs 0.394 Direct baseline) = +6.1% absolute
- ARGORA did best relative to baselines on TruthfulQA
