# ARGORA: Full Paper Explanation

**Paper**: ARGORA: Orchestrated Argumentation for Causally Grounded LLM Reasoning and Decision Making
**Authors**: Youngjin Jin, Hanna Kim, Kwanwoo Kim, Chanhee Lee, Seungwon Shin (KAIST / S2W Inc.)
**Date**: January 30, 2026 (arXiv:2601.21533)
**Code**: github.com/iJinjin/argora-public (~9.7K lines Python)

---

## The Problem ARGORA Solves

Multi-expert LLM systems (multi-agent debate, mixture-of-agents, self-consistency) generate diverse perspectives but combine them through **opaque aggregation** — majority voting, judge models, or layered synthesis. The result is a decision, but you can't answer:

- **Which** arguments were actually decisive?
- **Would** the decision change if you removed a specific argument?
- **Why** did argument A beat argument B?

The reasoning is buried in unstructured conversation transcripts. Even systems that DO build argument graphs (ArgLLM, ArgRAG) use them as scoring interfaces — the graph tells you the verdict, but can't tell you which edges are causally necessary for that verdict.

---

## ARGORA's Key Idea

**Compile multi-expert discussions into explicit argumentation graphs (QBAFs), then cast those graphs as structural causal models (SCMs) to enable counterfactual diagnosis.**

This means you can literally ask: "What if I removed this one argument? Would the winner change?" — and get a deterministic, mathematically grounded answer. No LLM call needed for the diagnosis itself.

---

## The Three Layers

### Layer 1: Discussion -> QBAF Construction

Multiple LLM "experts" discuss a topic through a **structured 3-level protocol**. Their discussion is mechanically compiled into tree-structured QBAFs. No LLM interprets or summarizes the discussion — the structure IS the discussion.

### Layer 2: QBAF -> SCM Evaluation

Each QBAF is evaluated deterministically using modular quantitative semantics (DF-QuAD). The math is fixed — given a QBAF, the root strength is uniquely determined. This evaluation is then cast as a structural causal model (SCM), where each argument node is an endogenous variable and base scores are exogenous inputs.

### Layer 3: SCM -> Counterfactual Explanations

Because the QBAF is an SCM, you can perform **edge-local interventions** — remove a single argument's edge and recompute. This tells you the causal impact of every argument on the final decision. You can identify: the most influential direct child, the most decisive argument chain, the most influential node overall.

---

## The Full Pipeline (What Actually Happens)

### Phase 0: Pre-Discussion Initialization (2 LLM calls)

Given a user topic `t`:

1. **Main task extraction**: Orchestrator LLM converts the open topic into a single imperative sentence. E.g., "Should we adopt quantization for 70B LLM serving?" becomes "Decide whether to adopt quantization for the 70B LLM serving pipeline and justify with expected latency-accuracy trade-offs."

2. **Key element extraction**: Orchestrator identifies the salient factors/entities/constraints. E.g., `["70B model family", "target latency budget", "throughput", "accuracy metric"]`. These serve as coverage targets — experts should ground their arguments in these dimensions.

These two anchors ensure all experts are solving the **same** decision problem, not talking past each other.

### Phase 1: Main Argument Generation (Algorithm 1)

Each expert is queried **in parallel** with a role-conditioned prompt built from (topic, main task, key elements). Each expert produces a single main argument — their top-level answer/claim.

Key design choice: **independence first**. Experts don't see each other's responses. This maximizes diversity (wisdom of crowds), avoids premature convergence, and prevents anchoring effects. Main arguments become QBAF roots.

Dedup: exact string matching only. No semantic merging at root level. The paper found that aggressively collapsing similar main arguments reduces downstream discussion diversity. Root-level variation is preserved intentionally.

### Phase 2: First-Level Arguments — Level 1 (Algorithm 3)

For each main argument `m`, ALL experts are queried in parallel:
- The expert who proposed `m` gets an **author** role
- All other experts get a **peer** role
- Each expert returns: a stance (agree/disagree) + a list of reasoning statements

Each reasoning statement becomes a candidate depth-1 node. Agree -> support edge to root. Disagree -> attack edge to root.

**Contextual orthogonality pruning** (Algorithm 2) then filters candidates:
- **Stage 1 (parent-level)**: Remove candidates too similar to the root/parent context (cosine similarity > threshold using all-MiniLM-L6-v2 embeddings)
- **Stage 2 (sibling-level)**: Among survivors, greedily select to avoid multiple similar arguments under the same parent
- **Fallback**: If ALL candidates get pruned, keep the least-similar one

This is critical for QBAF quality — without pruning, you get "strength saturation" (many near-identical supports push strength to 1.0) and "weak counterfactual signals" (removing one of many redundant nodes barely changes anything).

### Phase 3: Second-Level Arguments — Level 2 (Algorithm 4)

Cross-expert **peer review**. For each expert, they review first-level arguments they did NOT author. The author/non-author constraint prevents self-review — you can't validate your own claims.

Each expert sees the first-level arguments from other experts and returns: stance (agree/disagree) + justification for each. These become depth-2 nodes supporting or attacking the depth-1 nodes.

Same orthogonality pruning applied.

### Phase 4: Third-Level Arguments — Level 3 (Algorithm 5)

**Author rebuttals**. The original author of each first-level argument gets to respond to second-level attacks against their argument. These rebuttals are always attack-typed (they attack the critique).

This creates a natural 3-level dialogue:
- Level 1: "Here's my argument"
- Level 2: "I disagree with your argument because..."
- Level 3: "Your critique is wrong because..."

Same orthogonality pruning applied.

### Phase 5: Base Score Assignment (Algorithm 6)

The **Orchestrator** (not the experts) evaluates every argument node on 3 dimensions:
1. **Task relevance**: Does it address the topic, main task, and key elements?
2. **Evidence support**: Does it provide reasoning, mechanisms, or evidence?
3. **Logical soundness**: Is it internally coherent and follows reasonable inference?

Each dimension scored in (0, 1). Final base score = arithmetic mean. Scores are calibrated to center around 0.5, with most in [0.30, 0.70].

Why not [0, 1]? Because LLMs have a strong bias toward extreme scores (0 and 1) and inflated scores (everything gets 0.8+). The open interval (0, 1) and the calibration instructions fight these tendencies.

Why orchestrator and not self-assessment? Because experts would inflate their own arguments. Neutral evaluation preserves integrity.

### Phase 6: QBAF Evaluation (Algorithm 7, Phase 6)

Apply the chosen modular semantics (default: DF-QuAD) bottom-up on each QBAF tree. Leaf nodes get sigma = base score. Internal nodes get sigma from the combination function:

```
attackAgg  = 1 - product(1 - sigma(attacker_i))   // "at least one attacker effective"
supportAgg = 1 - product(1 - sigma(supporter_i))   // "at least one supporter effective"

if attackAgg > supportAgg:
  sigma(node) = baseScore - baseScore * (attackAgg - supportAgg)       // pulled toward 0
if supportAgg > attackAgg:
  sigma(node) = baseScore + (1 - baseScore) * (supportAgg - attackAgg) // pulled toward 1
if equal:
  sigma(node) = baseScore
```

The root sigma of each main argument is its final "verdict strength." The main argument with the highest sigma wins.

The paper also supports alternative semantics: REB (Euler-based), QE (Quadratic Energy), SD-DF-QuAD, EBT. DF-QuAD is default; others sometimes outperform on specific benchmarks.

---

## Counterfactual Explanations (Section 4.3)

Because the QBAF evaluation is a deterministic function (base scores -> sigma via fixed equations), it's literally an SCM. Each node is an endogenous variable. Base scores are exogenous inputs. The structural equations are the modular update rules.

**Edge-local intervention** (Def. 4.2): Remove the edge from node `x` to its parent. Recompute all strengths. The difference in root strength is the causal impact:

```
delta_edge(x; root) = sigma(root) - sigma_without_x(root)
```

- Positive delta = `x` was net supporting the root
- Negative delta = `x` was net attacking the root
- |delta| = influence magnitude

Three explanation queries (Def. 4.4):
1. **Most influential direct child**: Which immediate child of the root matters most?
2. **Most decisive argument chain**: Which leaf-to-root path has the largest impact?
3. **Most influential node overall**: Which single node's removal changes the root the most?

These are computed with zero LLM calls — pure math over the QBAF structure.

---

## Observation-Aligned Override (Section 4.4)

ARGORA constructs a second, **structurally independent** consensus by reusing the Orchestrator as an LLM-as-a-judge. The judge sees only the main arguments and a compressed transcript — no QBAF scores, no graph structure. It outputs confidence scores for each main argument.

This creates two distributions:
- `p_QBAF(m)` = QBAF-based consensus (from formal evaluation)
- `p_obs(m)` = observational consensus (from LLM judge)

When they agree, no override. When they disagree:

```
J(I) = JS(p_QBAF_intervened || p_obs) + lambda * C(I)
```

Where `C(I)` is the perturbation cost (how much the internal state changes). The system searches for a minimal single-edge intervention that aligns the QBAF winner with the observational winner.

A **winner-confidence gate** prevents over-correction: override only happens if the observational winner's confidence exceeds the QBAF winner's. This stops the system from second-guessing itself when the QBAF consensus is already reliable.

---

## Extended Explanations (Appendix E)

### Winner-Critical Interventions

Beyond within-graph explanations, ARGORA asks: "Which single edge removal, across ALL QBAFs, would flip which main argument wins?" A singleton intervention `(m, x)` removes one edge in one QBAF. If the winner changes, that edge was winner-critical.

If NO winner-critical intervention exists, the decision is **structurally robust** — no single argument removal can flip the outcome.

### Margin Decomposition

For each competitor `m_j` vs. winner `m*`:

```
final_margin = prior_margin + argumentative_margin
```

Where:
- prior_margin = w(m*) - w(m_j) — who started with better base scores
- argumentative_margin = delta_lift(m*) - delta_lift(m_j) — who benefited more from the argument structure
- delta_lift(m) = sigma(m) - w(m) — net effect of argumentation on a main argument

This classifies each pairwise victory:
- **Prior-dominated**: Winner led in base scores and argumentation maintained it
- **Argumentation-reversed**: Winner OVERCAME a base-score deficit through stronger supporting arguments
- **Argumentation-eroded**: Winner's base-score lead was narrowed by attacks

This tells you whether the decision was won by "starting strong" or by "arguing well."

---

## Multi-Round Support (Appendix D.10)

ARGORA implements multi-round discussions but found them **not worth the cost**. All paper experiments use single-round.

In multi-round mode:
- Round r's artifacts (main arguments, QBAFs, strengths) are collected
- Expert prompts for round r+1 condition on the task only (no explicit history summary)
- Instead, each expert maintains a **persistent conversation history** — they remember their own past responses and the orchestrator's prompts
- The orchestrator does NOT summarize or inject round-r results; experts carry context through their conversation windows

Limitations: context window saturation dilutes critical information; marginal accuracy gains don't justify linear cost scaling.

---

## Evaluation Results

Tested on: MMLU-Pro, MedQA, TruthfulQA, GPQA Diamond, MuSR (3 subtasks). All using GPT-4o-mini with 3 experts.

Key findings:
- ARGORA improves accuracy over direct prompting AND majority vote on most benchmarks
- **Net Reversal Efficiency (NRE)** is positive on almost all benchmarks — when experts disagree, ARGORA corrects toward the right answer more often than it introduces errors
- **Correctness Margins** are positive — QBAF strengths systematically favor correct-label arguments
- **TruthfulQA**: 88.2% vs. 79.2% direct (biggest gain — formal structure helps resist misconception-inducing prompts)
- **MedQA**: Competitive but majority vote is already strong here
- Override mechanism helps on some benchmarks (MMLU-Pro, GPQA), neutral on others

Also tested with gpt-5-mini backbone: similar patterns persist (Appendix G).

### Use Case: Cybersecurity Incident Analysis

3 Qwen-3-14B experts correctly identified a fabricated ransomware report as fake. Both GPT-OSS 120B and Gemini 2.5 Pro classified it as real. The multi-expert structure surfaced cross-dimensional anomalies (OPSEC violations, timeline inconsistencies, missing forensic artifacts, TTP mismatches) that single models missed because they evaluated dimensions in isolation.

---

## The Consensus Report (Appendix F)

ARGORA automatically generates a Markdown report with:
- Configuration and metadata
- All main arguments with source experts
- QBAF structures with base scores and criteria
- Final strengths and consensus distributions
- Winner margin decomposition and victory types
- Counterfactual analysis (most influential child, chain, node)
- Winner-critical interventions
- Observational override analysis
- Final decision with robustness indicators

All quantities computed from internal data — no additional LLM calls for the report. Every entry traces to a formal definition.

---

## What Makes ARGORA Different from Other Multi-Agent Systems

| Property | Self-Consistency | Multi-Agent Debate | ARGORA |
|----------|-----------------|-------------------|--------|
| **Structure** | Flat samples | Conversation transcript | Typed argument tree (QBAF) |
| **Aggregation** | Majority vote | Judge/synthesis | Formal semantics (deterministic math) |
| **Redundancy control** | None (linear cost scaling) | Organic (debate dynamics) | Contextual orthogonality pruning |
| **Explainability** | None | Transcript review | Edge-local counterfactual interventions |
| **Corrective mechanism** | None | Judge-mediated | Observation-aligned counterfactual override |
| **Causal diagnosis** | No | No | Yes (SCM casting, winner-critical interventions, margin decomposition) |

The core contribution isn't accuracy — it's that the reasoning structure is a **persistent, queryable, formally grounded object** rather than a transient text artifact. You can inspect it, intervene on it, and get deterministic answers about what drove the decision.

---

## Hyperparameters

| Parameter | Value | Meaning |
|-----------|-------|---------|
| Experts | 3 | Number of expert LLM instances |
| Rounds | 1 | Discussion rounds (multi-round exists but not used) |
| Tree depth | 3 | Levels of argument generation |
| rho_sim | Empirical default | Contextual orthogonality threshold |
| lambda | Tuned per setting | Override cost-alignment tradeoff |
| tau | Tuned per setting | Winner-confidence gate threshold |
| Temperature | 0 | All LLM calls deterministic |
| Semantics | DF-QuAD (default) | Also tested: REB, QE, SD-DF-QuAD, EBT |
| Embeddings | all-MiniLM-L6-v2 | For orthogonality pruning similarity |
