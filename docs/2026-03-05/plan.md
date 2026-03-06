# Faultline Roadmap — 2026-03-05

**Status**: Planning (no implementation yet)

---

## Overview

Six steps to evolve Faultline from a dialogue/graph debate platform into a full argumentation + benchmarking + personalized agent system. Each step builds on the previous but is independently scoped.

**Existing debate types**: `dialogue` (natural group chat + crux rooms), `graph` (belief graph + QBAF + community graph)
**New debate type**: `argument` (ARGORA-based structured argumentation)

---

## Step 1: "Argument" Debate Type (ARGORA Integration)

**Goal**: Implement a new `argument` debate type that follows the ARGORA paper's argumentation-discussion framework exactly.

**Key constraints**:
- No personality agents (Jukan, Elon, etc.) — ARGORA auto-spins its own domain experts
- Do NOT inherit dialogue/graph patterns by default — only adopt features explicitly chosen
- First pass: clone argora-public repo, verify completeness against paper, integrate into frontend
- Use the `argora-expert` agent to direct implementation

**What this IS**: A faithful reproduction of ARGORA's 3-level structured discussion protocol, QBAF construction, DF-QuAD evaluation, SCM-based counterfactual explanations, and observation-aligned override.

**What this is NOT**: A personality-driven debate. No persona contracts, no speech roles, no crux rooms. The experts are generic LLM instances with role-conditioned prompts per ARGORA's design.

**Deliverables**:
- `/argument` route with topic input
- ARGORA pipeline execution with SSE streaming
- QBAF visualization with counterfactual explanation UI
- Consensus report display (winner, margin decomposition, robustness indicators)

---

## Step 2: ARGORA Benchmarks (Per-Debate Quantitative Evaluation)

**Goal**: After each `argument` debate, run ARGORA's quantitative benchmarks and display results in the frontend.

**Benchmarks to implement** (from paper Section 5):
- **Accuracy** — did ARGORA select the correct answer?
- **NRE (Net Reversal Efficiency)** — when experts disagree, does ARGORA correct toward the right answer more than it introduces errors?
- **Correctness Margin** — do QBAF strengths systematically favor correct-label arguments?
- Comparison baselines: direct prompting, majority vote, CoT, multi-agent CoT

**NOT implementing**: The qualitative cybersecurity case study benchmark.

**Deliverables**:
- Benchmark runner that executes all baselines for the same topic
- Results panel in the debate results section showing ARGORA vs baselines
- Per-debate benchmark data persisted for later aggregation (Step 5)

**Open question**: Spin up a critique agent to evaluate whether per-debate benchmarking is the right approach (vs. batch evaluation, statistical significance, etc.).

---

## Step 3: Personality Agent Abstraction Layer (GenMinds-Inspired)

**Goal**: Create a proper abstraction for personality agents — objects with memory, belief graphs, and personalized reasoning processes that produce arguments in the dialogue layer.

**Inspired by**: GenMinds paper (epistemic personality modeling), PRIME (cognitive dual-memory), R-Debater (semantic/episodic/argumentative memory)

**Current state**: Partially implemented (persona contracts, belief graphs, speech roles exist but aren't unified into a coherent agent abstraction). Needs assessment before implementation.

**Planned work**:
1. **Agent abstraction**: Unified object combining persona contract + belief graph + memory + reasoning process
2. **Persona creation page**: Users feed corpus data; Crux interviews user to extract personality; generates belief graph for review
3. **Memory system**: RAG-based (not pretraining). Inspired by:
   - PRIME's cognitive dual-memory (semantic + episodic)
   - R-Debater's argumentative memory
   - Must be retrieval-based, not baked into weights
4. **Future**: Prompt baking and finetuning for personality agents (deferred)

**Process**: Run `genminds-expert` agent first to understand the paper's approach. Assess current codebase state before scoping implementation. User wants to discuss approach before coding begins.

---

## Step 4: Personality Agents in "Argument" Layer (Integration)

**Goal**: Re-integrate personality agents (from Step 3) back into the `argument` debate layer.

**Key idea**: When personality agents participate in ARGORA-style structured argumentation, their belief revision occurs by editing edges of their belief graph. This shows up in the QBAF as:
- Edge deletion (removing a belief)
- Counterfactual intervention (what-if analysis on beliefs)

**Status**: Exploratory. The exact integration design depends on how Steps 1-3 play out. This step will be scoped when Steps 1-3 are complete.

---

## Step 5: CruxBench (Aggregate Benchmark Platform)

**Goal**: A dedicated `/cruxbench` page that aggregates benchmark performance across all debates and enables human evaluation.

**Long-pole idea — needs refinement. Spin up a critique agent.**

**Planned features**:
1. **Aggregate dashboard**: How Crux/ARGORA performed vs. direct, majority vote, CoT, multi-agent CoT across all debates run
2. **Human labeling interface**: Blind comparison of cruxes across models — which crux is better?
3. **Debate database**: Eventually, a public database of debates that others can use to benchmark their own debate engines
4. **Moltbook comparison**: Integrate Moltbook as a baseline to show comparative performance (needs critique — is this a good idea or unnecessarily antagonistic?)

**Open questions**:
- Statistical rigor: how many debates needed for meaningful aggregate claims?
- Human labeling: inter-annotator agreement? Annotation guidelines?
- Public database: what format? What metadata? Privacy concerns?
- Moltbook: is this fair comparison or apples-to-oranges?

---

## Step 6: PersonaBench (Personality Agent Benchmark)

**Goal**: A dedicated `/personabench` page implementing GenMinds' RECAP benchmark for epistemic personality modeling.

**Long-pole idea — needs refinement. Spin up `genminds-expert` agent.**

**Core question**: Do personality agents actually "think" in character, or are they just surface-level role-playing?

**Planned features**:
1. **RECAP benchmark implementation**: Measures whether agents exhibit genuine epistemic personality traits
2. **Open benchmark**: Others can benchmark their own personality agents against RECAP
3. **Integration with Step 3**: Personality agents created in Faultline are automatically benchmarkable

**Open questions**:
- What subset of RECAP is tractable to implement?
- How to adapt RECAP from GenMinds' context to Faultline's argumentation context?
- What does "genuine epistemic personality" mean in a debate setting vs. general conversation?

---

## Dependencies

```
Step 1 (ARGORA)
    │
    ├──→ Step 2 (Benchmarks) ──→ Step 5 (CruxBench)
    │
Step 3 (Agent Abstraction) ──→ Step 4 (Integration) ──→ Step 6 (PersonaBench)
```

Steps 1-2 and Step 3 can be worked on in parallel. Steps 4-6 depend on earlier steps.
