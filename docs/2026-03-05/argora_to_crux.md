# ARGORA to Crux: From Decision Engine to Insight Engine

## Design Principle

ARGORA's QBAF + counterfactual engine is a **robust quantitative disagreement detector**. The graph semantics already tell you:
- Which arguments matter most (edge-local impact)
- Which removals flip the outcome (winner-critical interventions)
- How fragile each position is (sensitivity score)

Flip conditions come from **semantics on the graph**, not from asking an LLM "what would change your mind?" If removing Expert A's node X flips the QBAF winner, node X's content IS the flip condition — grounded in counterfactual math.

---

## Current ARGORA Architecture

```
Topic
  → Phase 0: extract_main_task() → single imperative sentence + key_elements tags
  → Phase 1: _run_round() → each expert generates ONE monolithic main argument independently
  → Dedup: _select_main_arguments() → cosine similarity prunes near-duplicates → ~2-3 surviving main args
  → Phase 2: _generate_first_level_arguments() → per main arg, every expert gives agree/disagree + reasoning
       → first-level support/attack nodes added to QBAF
  → Phase 3: _graph_based_debate_round() → _process_single_statement_debate() per main arg:
       Level 2: graph review — each non-author expert reviews ALL first-level nodes from others
               → AGREE/DISAGREE/NONE + justification → second-level support/attack nodes
       Level 3: targeted rebuttals — original author rebuts attacks → third-level nodes
       → QBAF strength computation (bottom-up)
  → Phase 4: Counterfactual analysis → edge_local_impact per node, winner-critical interventions
  → Phase 5: SCM alignment → observation vs QBAF winner override
  → Phase 6: Consensus report → "the winner is X because Y"
```

**Key structural facts**:
- Mini-debate exchange ("would you change your stance?") only runs when `use_graph_based_debate=False` — NOT the default. Experts are never asked if they'd change their mind in the graph-based path.
- Every QBAF node carries an `expert` field, but this attribution is never used for per-expert analysis.
- Disagreement signal is consumed to build the graph, then discarded in favor of consensus.

---

## Structural Limits (why each phase exists)

| Limit | Addressed in |
|-------|-------------|
| Disagreement signal discarded — no crux output | **Phase 1** (post-processing existing data) |
| Monolithic main arguments suppress facet-level disagreement | **Phase 2** (facet decomposition) |
| Review never asks WHY experts disagree (only that they do) | **Phase 3** (contested assumption metadata) |
| Per-expert contributions invisible in merged QBAF | **Phase 4** (decoupled subgraph analysis) |

---

## Phase 1: Crux-Oriented Output (zero architecture changes)

**Goal**: Generate crux cards and a crux report from the existing ARGORA output. No changes to `debate.py`, `expert.py`, or any debate engine file.

**One borderline change**: Review stances (AGREE/DISAGREE + justification) are currently parsed in `_process_single_statement_debate` but not returned. Adding them to the result dict is a 1-line data passthrough — not architecture, just data preservation. Everything else is pure post-processing.

### Inputs from existing result dict

| Field | What it contains |
|-------|-----------------|
| `counterfactual_by_statement` | `edge_local_impact` per node, winner-critical interventions |
| `updated_graphs_by_main_argument` | Full QBAF with `node.expert` attribution (from `to_dict()`) |
| `graph_consensus` | Merged graph counterfactual data |
| `review_data` | AGREE/DISAGREE stances + justification per node (add 1-line passthrough) |

### Crux extraction logic (`argora/crux_extraction.py`, new)

```
For each main argument's QBAF:
  1. Find all attack edges where source.expert != target_parent.expert
     → These are cross-expert disagreements

  2. For each cross-expert attack node, look up edge_local_impact(node_id)
     → Crux importance: how much removing this attack changes the outcome

  3. Winner-critical interventions (edges whose removal flips the QBAF winner):
     → The attacked node's content = the contested claim
     → The attack node's content = why it's contested
     → The delta = how much it matters (counterfactual math, not LLM opinion)

  4. Group related attacks (multiple experts attacking same node, or same subtree)
     into crux clusters

  5. For each cluster, construct a CruxCard
```

**CruxCard structure**:
```python
@dataclass
class CruxCard:
    question: str                           # The contested claim (attacked node statement)
    crux_type: str                          # evidence|values|definition|horizon|claim|premise
    importance: float                       # |delta| from edge_local_impact
    sensitivity: float                      # How fragile this position is
    flip_mechanism: str                     # Counterfactual fact: "removing node X shifts [main arg] by [delta]"
    experts: dict[str, ExpertCruxPosition]  # Per-expert stance + reasoning
    source_node_ids: list[int]              # QBAF nodes involved
    parent_main_argument: str
    winner_critical: bool

@dataclass
class ExpertCruxPosition:
    stance: str      # "support" or "attack"
    reasoning: str   # Their argument text (from graph node statement)
```

`flip_mechanism` is NOT an LLM opinion — it's the counterfactual statement: *"Removing [attack node] shifts [main argument] strength by [±delta]."* Derived from graph math.

### Disagreement classification

One batch LLM call after all crux cards are extracted. Feed the orchestrator the list of crux cards (contested claim + attack reasoning) and classify each into `evidence|values|definition|horizon|claim|premise`. This is extraction/classification on existing debate text, not generation.

### Crux report (`argora/crux_report.py`, new)

```
CRUX ANALYSIS REPORT

1. Topic
2. Expert Positions
   | Expert | Main Argument Summary | QBAF Score (sigma) |
3. Crux Cards (ranked by counterfactual importance)
   - Crux question
   - Type (evidence/values/...)
   - Contested by: [Expert B] attacking [Expert A]'s argument
   - Attack: "[attack node statement]"
   - Flip mechanism: counterfactual fact (not LLM opinion)
4. Winner-Critical Interventions
   - All edges whose removal flips the QBAF winner, with expert attribution
5. Robustness
   - Sensitivity score, fraction of winner-critical edges, fragility assessment
```

### Phase 1 summary

| Change | Where | Lines | New LLM calls |
|--------|-------|-------|---------------|
| Surface review stances in result dict | `debate.py` | 1 | 0 |
| Crux extraction module | `crux_extraction.py` (new) | ~200 | 0 |
| Disagreement classification | `crux_extraction.py` | ~30 | 1 (orchestrator batch) |
| Crux report generator | `crux_report.py` (new) | ~150 | 0 |

---

## Phase 2: Facet Decomposition + Mini-debate Exchange

**Goal**: Decompose the topic into independently debatable sub-questions, producing per-facet QBAFs. Enable the mini-debate exchange so experts are asked if they'd change their stance.

### 2.1 Mini-debate Exchange

**Change**: Add `run_exchange_after_graph: bool = False` to `settings.py`. When enabled, after graph-based debate completes, reconstruct agree/disagree participant lists from the QBAF (check which experts contributed supporting vs attacking first-level nodes), then run steps 1-2 of `_mini_debate_round` (stance explanations + exchange). Skip steps 3-4 (judge + respond to judgment — decision-oriented, not crux-oriented).

**Bug fix**: Line 2062 references undefined variable `statement` instead of `main_argument`. Fix before use.

**What this gives**: Expert responses to "would you change your stance?" — raw text showing stance flexibility, available as additional context in crux cards.

**Scope**: ~30 lines in `debate.py` + 1 new setting.

### 2.2 Facet Decomposition

**New orchestrator method** (`orchestrator.py`):
```python
def decompose_into_facets(topic: str, main_task: str, key_elements: str) -> list[str]:
    """Returns 3-6 independently debatable sub-questions covering:
       empirical claims, value judgments, definitional boundaries, time horizons."""
```

One LLM call. The existing pipeline then runs once per facet — no changes to debate engine internals.

**Implementation**: Option A (minimal) — run the full pipeline once per facet, producing independent `DebateSession` results. No internal refactoring.

**Output**: `list[FacetResult]` where each has the sub-question, QBAF, counterfactual results, and crux cards (from Phase 1 post-processing).

### 2.3 Why facet decomposition enables better flip conditions

With monolithic main arguments, a winner-critical intervention is coarse: "removing this broad supporting argument changes the outcome." With facet-level QBAFs, the same counterfactual engine operates on tighter, focused graphs. A winner-critical intervention on a facet QBAF is: "removing Expert B's specific attack about [narrow claim] on sub-question [facet] flips the outcome." The flip mechanism IS the attack node's content — but now precise and narrow.

No LLM needed. Same counterfactual engine, finer-grained data.

### Phase 2 summary

| Change | Where | Lines | New LLM calls |
|--------|-------|-------|---------------|
| Mini-debate exchange toggle | `debate.py`, `settings.py` | ~30 | Exchange calls (reuses existing prompt) |
| Bug fix (L2062) | `debate.py` | 1 | 0 |
| Facet decomposition | `orchestrator.py` | ~40 | 1 (orchestrator) |
| Per-facet pipeline wrapper | New script or `debate.py` wrapper | ~80 | N × existing pipeline |
| Cross-facet crux report extension | `crux_report.py` | ~80 | 0 |

---

## Phase 3: Crux-Oriented Review Prompt

**Goal**: Enrich the graph review to capture WHY experts disagree — the contested assumption — without asking for LLM-generated flip conditions.

**Files**:
- `argora/expert.py` — modify `build_graph_review_prompt()` (L382-460)
- `argora/debate.py` — modify review response parsing (L2260-2316)

**Two new fields** added to the review JSON response (only when `stance == "DISAGREE"`):
- `contested_assumption` (string): "What specific assumption or claim in this argument do you reject?"
- `disagreement_type` (string): `evidence|values|definition|horizon|claim|premise`

**NOT included**: `flip_condition` — this is LLM hallucination territory. Flip conditions are derived from counterfactual semantics on the QBAF (Phases 1-2), not from asking experts.

These fields are **metadata only** — they do NOT become QBAF graph nodes. The `justification` still becomes an attack node as before. Graph-building pipeline is unchanged.

**New dataclass**:
```python
@dataclass
class CrossExpertDisagreement:
    facet: str
    original_node_id: int
    original_statement: str
    original_author: str
    contesting_expert: str
    justification: str           # Also becomes an attack node
    attack_node_id: int | None
    contested_assumption: str    # The specific assumption rejected
    disagreement_type: str       # evidence|values|definition|horizon|claim|premise
```

### Phase 3 summary

| Change | Where | Lines | New LLM calls |
|--------|-------|-------|---------------|
| Review prompt enrichment | `expert.py` | ~20 | 0 (added to existing call) |
| Review parsing + CrossExpertDisagreement storage | `debate.py` | ~30 | 0 |
| Crux card enrichment with contested assumptions | `crux_extraction.py` | ~40 | 0 |

---

## Phase 4: Per-Expert Subgraph Analysis (decoupled)

**Goal**: Compare how different experts' contributions shape the QBAF outcome. Completely decoupled from the debate engine — reads the finished result dict only.

**File**: `argora/expert_divergence.py` (new)

**Logic**:
1. From `updated_graphs_by_main_argument`, reconstruct the full `RoundGraph` per main argument
2. For each expert, extract their subgraph: keep the main argument node + all nodes where `node.expert == target_expert`, keep edges between remaining nodes
3. Run `compute_strengths_single_pass` on each expert's subgraph
4. Compare root strengths across experts → divergence map: `{(expert_A, expert_B, main_argument): strength_gap}`

**Combined with Phase 2 (facet decomposition)**: "On facet F, Expert A's contributions support the position (sigma=0.8) while Expert B's undermine it (sigma=0.3). The gap is driven by node X, whose removal shifts the facet outcome by [delta]." Pure graph semantics, no LLM.

### Phase 4 summary

| Change | Where | Lines | New LLM calls |
|--------|-------|-------|---------------|
| Per-expert subgraph analysis | `expert_divergence.py` (new) | ~150 | 0 |
| Cross-facet divergence in crux report | `crux_report.py` | ~60 | 0 |

---

## Implementation Order

| Phase | Depends on | What it enables |
|-------|-----------|-----------------|
| 1: Crux output (zero arch changes) | nothing | Crux cards + report from existing data |
| 2: Facet decomp + exchange | nothing | Per-facet QBAFs, precise flip conditions, stance flexibility data |
| 3: Review prompt enrichment | nothing | Contested assumptions in crux cards |
| 4: Per-expert subgraph | Phase 2 | Quantitative expert divergence map |

Phases 1, 2, and 3 are independent and can be built in parallel.

## What This Does NOT Do

- Does NOT ask experts "what would change your mind?" (LLM hallucination)
- Does NOT add flip conditions to the review prompt
- Does NOT change QBAF computation, counterfactual engine, or strength propagation
- Does NOT modify graph-building pipeline
- Does NOT fabricate flip conditions — derives them from counterfactual math on facet QBAFs
