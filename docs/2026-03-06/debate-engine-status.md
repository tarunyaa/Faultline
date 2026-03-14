# crux-personas: Debate Engine Status

**Date**: 2026-03-06
**Location**: `crux-personas/` (Python, standalone from the Next.js app)

---

## What It Does

Runs a structured multi-expert debate on a topic using the ARGORA framework (Quantitative Bipolar Argumentation Framework). Produces quantitative output about *where* experts disagree and *how structurally critical* those disagreements are.

Entry point: `bridge.py`. Emits newline-delimited JSON events to stdout.

---

## Two Run Modes

### Single mode (default)
```
bridge.py --topic "..." --num-experts 3
```
One debate on the full topic. One QBAF.

### Faceted mode
```
bridge.py --topic "..." --num-experts 3 --use-facets
```
Decomposes topic into exactly 3 independently debatable sub-questions, runs one full debate per facet, then synthesizes cross-facet patterns.

---

## Two Expert Modes

### Domain expert mode (default)
ARGORA auto-generates N domain expert personas from the topic (e.g. "AI Safety and Security LLM"). Experts are topic-specific and ephemeral.

### Personality agent mode
When `--personas-json` is passed (a list of `{name, system_prompt}` objects), the system prompt of each Faultline persona (Jukan, etc.) is injected into ARGORA's expert slots. The ARGORA debate then runs with real persona identities instead of generated domain experts.

In the TypeScript layer (`crux-bridge.ts`): persona IDs → `loadContract` + `getPersona` → `buildConsolidatedPrompt` → temp JSON file → `--personas-json` flag.

---

## Pipeline Phases (per debate / per facet)

### Phase 0: Task extraction + expert generation
- Extracts `main_task` and `key_elements` from the topic
- In domain expert mode: generates N expert personas
- In personality agent mode: uses injected persona system prompts

### Phase 1: Main argument generation
- Each expert independently writes their core position (2-3 sentences max)

### Phase 2: First-level arguments (QBAF depth 1)
- Each expert gives a stance (agree/disagree) + 1-2 sentence reasoning on every other expert's main argument
- Creates support/attack edges into the QBAF

### Phase 3: Graph-based debate (QBAF depth 2-3)
- **Level 2**: Each expert reviews first-level nodes from other experts → AGREE/DISAGREE/NONE
  - DISAGREE responses include: `contested_assumption` + `disagreement_type` (evidence/values/definition/horizon/claim/premise)
- **Level 3**: Original authors rebut attacks on their arguments (1-2 sentences)

### Phase 4: QBAF strength computation
- Bottom-up strength propagation using DFQuAD semantics
- Each node gets `τ` (base score from LLM prior) and `σ` (final score after propagation)
- Winner = main argument with highest `σ`

### Phase 5: Counterfactual analysis
- For each node: `edge_local_impact` (delta) = how much the winner's σ changes if that node is removed
- `winner_critical`: removal flips the outcome (|delta| > 0.5 × baseline)
- `sensitivity_score`: overall fragility of the winning position
- **Flip conditions** = top-N nodes by |delta| — these are the fault lines, always populated

### Phase 6: Output generation
- Consensus report (winner, margin, winner-critical interventions)
- Crux cards derived from flip conditions (always populated)

---

## Output Metrics

### Per debate / per facet

| Metric | What it means | Source |
|--------|--------------|--------|
| `σ` (sigma) | Final QBAF strength of an argument (0-1) | Propagation over graph |
| `τ` (tau) | Base strength before propagation (LLM prior) | Prior scoring |
| `argumentative_lift` | σ - τ: how much supporting args boosted the position | Derived |
| `edge_local_impact` (delta) | Outcome shift if a node is removed | Counterfactual engine |
| `sensitivity_score` | How fragile the winner is (0=robust, 1=very sensitive) | Counterfactual engine |
| `winner_critical` | True if removing this node flips the winner | |delta| > 0.5 × baseline |
| `attack_count` | Number of cross-expert attack edges in the QBAF | Graph structure |
| `disagreement_type` | Why experts disagree: evidence/values/definition/horizon/claim/premise | LLM classification |
| `contested_assumption` | The specific underlying assumption disputed | LLM (in review prompt) |

### Flip conditions (fault lines)
Top-N nodes by |delta|. Removing any of these shifts the outcome the most.
- `winner_critical=true` means removal flips which expert wins
- Derived from graph math, not LLM opinion
- **Always populated** (as long as counterfactual engine finds non-zero deltas)

### Crux cards
Generated from flip conditions via one batch LLM call to classify `crux_type`.
- `importance`: |delta| — how much this argument matters to the outcome
- `flip_mechanism`: "Removing X shifts [main arg] by ±delta"
- `crux_type`: evidence / values / definition / horizon / claim / premise
- Will be empty only if all `edge_local_impact` values are zero (perfectly convergent QBAF)

---

## Cross-Facet Analysis (faceted mode only)

After all facets complete, one LLM call synthesizes across all 3 sub-questions:

| Output | What it is |
|--------|-----------|
| `table` | Per-facet: winner expert, σ score, margin, attack count, top flip condition + delta |
| `convergence_facets` | Sub-questions where experts broadly agreed |
| `divergence_facets` | Sub-questions where experts genuinely disagreed |
| `cross_cutting_fault_lines` | Shared assumptions/tensions appearing across multiple facets |
| `most_contested_facet` | Sharpest disagreement facet + why (grounded in flip_conditions) |
| `most_fragile_position` | Position most vulnerable across all facets |

Synthesis is grounded in flip conditions (structural math), not LLM-generated opinions about the debate.

---

## SSE Event Flow

### Single mode
```
argument_start
experts_generated
main_arguments_generated
level1_complete / level2_complete / level3_complete
qbaf_evaluated
counterfactual_complete
flip_conditions          ← fault lines from counterfactual math
consensus_generated
report_generated
crux_cards_extracted
argument_complete
```

### Faceted mode
```
argument_start
facets_decomposed        ← exactly 3 sub-questions
[per facet:]
  facet_start
  facetN_experts_generated
  facetN_main_arguments_generated
  facetN_level1/2/3_complete
  facetN_qbaf_evaluated
  facetN_counterfactual_complete
  facetN_flip_conditions
  facetN_consensus_generated
  facetN_crux_cards_extracted
  facet_complete         ← includes attack_count, flip_conditions summary, crux_card_count
crux_cards_extracted     ← aggregated across all facets
cross_facet_analysis     ← table + LLM synthesis
argument_complete
```

---

## Output Files (bridge_reports/)

Per debate/facet:
- `*.md` — consensus report: winner, margin decomposition, winner-critical interventions
- `*_qbaf.md` — full argument tree with τ/σ scores, support/attack edges

Faceted only:
- `*_cross_facet.json` — cross-facet analysis table + synthesis

---

## Known Limitations

- **Zero crux cards when QBAF fully converges**: If all `edge_local_impact` values are 0 (experts never meaningfully challenge each other), flip conditions are empty → crux cards are empty. Happens with non-adversarial topics or very similar expert positions.
- **ARGORA_SKIP_EMBEDDINGS=1** required on this machine (sentence-transformers hangs PyTorch on Windows/Cygwin). Embedding similarity falls back to dummy similarity.
- **Faceted mode is slow**: 3 facets × 3 experts ≈ 3× the API calls of single mode.
- **Per-facet experts are independent**: Each facet generates its own expert set. Cross-facet analysis synthesizes positions across independently-run debates, not the same experts tracked across facets.
- **ARGORA is a convergence engine**: The review phase tends toward AGREE stances (LLM politeness bias). Cross-expert attack edges rarely form. Crux cards come from flip conditions (counterfactual math) rather than explicit disagreement detection.
