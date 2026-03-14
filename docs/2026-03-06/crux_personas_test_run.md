# crux-personas Test Run

**Date**: 2026-03-06
**Topic**: Should AI models be open-sourced?
**Model**: claude-haiku-4-5-20251001
**Experts**: 2 | **Rounds**: 1 | **Semantics**: DFQuADModel

---

## Debug Notes

The pipeline hung silently on first run. Root cause: `similarity_check.py` imports `sentence_transformers` at module level, which loads PyTorch — this hangs indefinitely on this Windows/Cygwin setup. Fix: set `ARGORA_SKIP_EMBEDDINGS=1` before running. The env var is already handled in `similarity_check.py` (falls back to dummy similarity). All subsequent runs use this flag.

```bash
ARGORA_SKIP_EMBEDDINGS=1 .venv/Scripts/python.exe bridge.py \
  --topic "Should AI models be open-sourced?" \
  --model "claude-haiku-4-5-20251001" \
  --num-experts 2 \
  --rounds 1
```

---

## Phase 1 — Crux Extraction

**0 crux cards extracted.**

Reason: crux cards are built from cross-expert attack edges in the QBAF (node where `attacker.expert != parent.expert`). With 2 experts and 1 round, both experts produced only supporting arguments for their own main arguments — no cross-expert attacks were added during the review phase. The QBAF had 26 nodes and 24 edges, all support, 0 attack. No cross-expert disagreement structure existed for `extract_crux_cards()` to work with.

**Crux report** (auto-saved to `bridge_reports/`):
```
Sensitivity score: 1.000
Fragility: ROBUST
Crux Cards: 0
```

**What this means for the design**: crux cards require genuine adversarial second-level argument structure. They will appear in debates where experts actively attack each other's claims in the QBAF review phase. With only 2 experts and 1 round this rarely triggers. Try 3+ experts or enable `run_exchange_after_graph=True` to generate more cross-expert attack nodes.

---

## Phase 2 — Facet Decomposition

Not tested directly in this run (bridge.py runs `DebateSession` directly, not `facet_runner.py`). The `facet_runner.py` CLI is separately available:

```bash
ARGORA_SKIP_EMBEDDINGS=1 .venv/Scripts/python.exe -m argora.facet_runner \
  --topic "Should AI models be open-sourced?" \
  --settings '{"model": "claude-haiku-4-5-20251001", "num_experts": 2}'
```

`run_exchange_after_graph` setting confirmed present in `Settings` dataclass (default `False`).

---

## Phase 3 — Review Prompt Enrichment (DISAGREE Metadata)

New fields active in `build_graph_review_prompt()`:
- `contested_assumption` — the specific underlying assumption disputed
- `disagreement_type` — one of `evidence | values | definition | horizon | claim | premise`

In this run, both experts produced AGREE stances toward each other's supporting arguments (both argued for nuanced/graduated approaches). No DISAGREE stances were recorded, so `disagreement_list` was empty in `rounds_log["disagreements"]`. The plumbing is confirmed wired end-to-end: `_process_single_statement_debate` → `_graph_based_debate_round` → `rounds["disagreements"]`.

---

## Phase 4 — Expert Divergence Map

**Ran successfully.**

| Expert | Facet | Root Strength (σ) |
|--------|-------|-------------------|
| AI Security and Safety LLM | m_1 (Security Analysis) | 0.9997 |
| AI Ethics and Policy LLM | m_1 (Security Analysis) | 0.9691 |
| AI Security and Safety LLM | m_2 (Nuanced Analysis) | 0.9644 |
| AI Ethics and Policy LLM | m_2 (Nuanced Analysis) | 0.9997 |

**Most divergent pair**: AI Security and Safety LLM vs AI Ethics and Policy LLM
**Strength gap**: 0.0353 (direction: `both_support`)
**Crux facets**: none
**Consensus facets**: both main arguments (experts agree on both)

The divergence map correctly identifies that both experts converge toward the same position (graduated/context-dependent governance), just with different emphasis — security vs ethics lens. No crux facets because neither expert's subgraph root is substantially weaker than the other's on the same claim.

---

## QBAF Debate Output

### Task Extraction
- **Main task**: Evaluate the arguments for and against open-sourcing AI models and determine whether AI models should be made open-source.
- **Key elements**: open-source vs closed-source decision, AI model accessibility, security and safety considerations, innovation and research advancement, commercial viability, ethical implications, risk assessment, stakeholder perspectives, regulatory compliance, intellectual property concerns

### Experts Selected
1. **AI Security and Safety LLM** — security vulnerabilities, misuse scenarios, mitigation strategies
2. **AI Ethics and Policy LLM** — stakeholder impacts, ethical frameworks, governance

### QBAF Scores

| Expert | Base Score (τ) | Final Score (σ) | Argumentative Lift |
|--------|---------------|-----------------|-------------------|
| AI Security and Safety LLM | 0.653 | 1.000 | +0.347 |
| AI Ethics and Policy LLM | 0.627 | 1.000 | +0.373 |

Both arguments reach near-perfect QBAF scores after supporting argument propagation. 26 total nodes, 24 support edges, 0 attack edges.

### Winner

**AI Ethics and Policy LLM** (σ = 0.99997) — by a margin of 0.000027 over the security argument.

### Consensus Summary

> AI models should not be uniformly open-sourced or closed; instead, governance should be **context-dependent and differentiated by model capability level, safety maturity, and deployment domain**, with small capability-limited models generally open-sourced, frontier models conditionally open-sourced only after rigorous safety review, and high-stakes deployment domains requiring both transparency and deployment restrictions.

Both experts independently converged on graduated/tiered open-sourcing as the right answer:

**Security & Safety LLM position**:
- Narrow, capability-limited models → open-source with standard safeguards
- Frontier models → graduated access control (institutional verification, use-case review)
- High-stakes domains → open weights + mandatory safety enforcement at deployment
- Priority: invest in security mechanisms that make open-source safe (adversarial robustness, detectable backdoors, rapid patching infrastructure)
- Analogy: cryptography moved to open standards and became more secure — AI should follow

**Ethics & Policy LLM position**:
- Small, well-understood models → generally open-source
- Frontier models with novel capabilities → conditional release after independent safety evaluation + graduated researcher access
- Models for harmful applications → sustained closure or heavy regulatory oversight
- Stakeholder input required — public funding confers public interest claims
- IP protections should be decoupled from model access (licensing frameworks)
- Open-sourcing the code is not open-sourcing the responsibility — governance infrastructure required

---

## SSE Event Flow (all 24 events fired)

```
argument_start
progress_task_extracted
progress_experts_selected
progress_main_arguments_ready
progress_first_level_complete
progress_graph_debate_complete
progress_scoring_complete
progress_counterfactual_complete
experts_generated
main_arguments_generated
level1_complete          → graph_count=2, nodes/edges per graph
level2_complete          → included_in_graphs=True
level3_complete          → included_in_graphs=True
base_scores_assigned
qbaf_evaluated
counterfactual_complete
consensus_generated
report_generated         → available=True, argument_count=26
crux_cards_extracted     → count=0
status                   → crux report saved
divergence_computed      → subgraph_results, most_divergent_pair
status                   → consensus report saved
status                   → QBAF visualization saved
argument_complete
```

---

## What Needs More Testing

1. **Crux cards** — need 3+ experts or `run_exchange_after_graph=True` to generate cross-expert attack nodes. Cards are zero because no cross-expert DISAGREE stances emerged in the review phase.
2. **Phase 3 DISAGREE metadata** — need a topic where experts genuinely disagree at the second level (e.g. a more polarized question). The `contested_assumption`/`disagreement_type` fields are wired but untriggered here.
3. **Facet runner** — run `facet_runner.py` CLI directly to test Phase 2 decomposition into 3-6 sub-questions.
4. **`ARGORA_SKIP_EMBEDDINGS=1`** — should be set as a default in the bridge or `.env` to avoid the PyTorch hang on this machine.
