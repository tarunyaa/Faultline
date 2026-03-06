# ARGORA Input Guide

**Date**: 2026-03-05
**Status**: Based on paper analysis (arXiv:2601.21533) + codebase deep dive

---

## Core Principle: ARGORA is Input-Agnostic

ARGORA does **not** require MCQ inputs. The pipeline accepts any raw string as a "topic" and processes it through:

1. **Phase 0 (Task Extraction)** — LLM extracts `main_task` + `key_elements` from the raw topic
2. **Expert Selection** — Orchestrator picks domain-relevant experts
3. **Main Argument Generation** — Each expert independently produces a standalone argument
4. **3-Level Peer Review** — Experts critique each other's arguments (agree/disagree)
5. **QBAF Evaluation** — DF-QuAD scores propagate through the argument trees
6. **Consensus** — Winner is the main argument with highest final strength

The MCQ format used in Sections 4-5 of the paper is an **evaluation convenience** (it provides ground truth for accuracy tables), not an architectural constraint. Section 6 proves this with a free-form cybersecurity scenario.

---

## Why Some Inputs Produce Degenerate Results

ARGORA has **no mechanism to force experts into competing positions**. Disagreement is entirely emergent. The level-1 peer review prompt says "critically evaluate this argument by giving a stance (agree or disagree)" — but if all experts independently reached the same conclusion, no peer will disagree.

### Inputs that produce genuine debate:
- **Hard MCQs** — discrete answer choices force experts to commit to different letters (e.g., GPQA Diamond physics questions)
- **Scenarios with conflicting evidence** — the paper's cybersecurity case study (Section 6) embedded ambiguous signals that support multiple interpretations
- **Topics with naturally competing frameworks** — questions where different domain perspectives yield different conclusions

### Inputs that produce all-agree consensus (degenerate):
- **Opinion questions with obvious consensus** — "Is climate change real?" or "Should companies be ethical?"
- **Open-ended questions without discrete positions** — "Should social media platforms be liable?" lets LLMs write balanced essays covering all sides
- **Questions where GPT-4o-mini has strong default opinions** — the model converges to the same nuanced answer regardless of expert persona

---

## The Three Input Patterns

### Pattern 1: Structured MCQ (Benchmark Style)

This is how all 9 eval datasets format their inputs. The `build_topic()` method in each dataset evaluator constructs the string.

```
You are to answer the following multiple choice question.
You should reason through the problem step-by-step and provide your detailed reasoning.
All questions have a valid answer among the choices, so you must pick a valid choice.
For the final answer, make sure to clarify your answer choice as follows:
REASONING: <your step-by-step reasoning here>
FINAL ANSWER: <single letter ONLY>
Question:
{question_text}
Choices:
A) {choice_a}
B) {choice_b}
C) {choice_c}
D) {choice_d}
```

**Why it works**: The "FINAL ANSWER: single letter ONLY" instruction forces each expert to commit to one option. With 3+ experts on a genuinely hard question, they split across different letters, creating competing main arguments. The peer review then generates attack edges because Expert-B disagrees with Expert-A's chosen answer.

**When it fails**: Easy questions where all experts pick the same letter — you get support-only trees and no meaningful debate.

### Pattern 2: Competing Positions (Decision Style)

For open-ended topics, frame the input with **explicit competing positions** that experts must choose between. This mirrors what the MCQ format does implicitly.

```
A semiconductor investor must choose between two positions.

Position A: DRAM stocks will outperform NAND stocks over the next 18 months due to
the AI-driven memory supercycle creating sustained demand growth.

Position B: NAND stocks will outperform DRAM stocks because NAND has more diversified
demand drivers and DRAM is vulnerable to cyclical overcorrection.

Evaluate which position is better supported by current market fundamentals,
supply-demand dynamics, and technology trends.

Provide your detailed reasoning and conclude with your choice:
FINAL ANSWER: Position A or Position B
```

**Why it works**: Discrete positions force commitment. Experts can't write balanced "both sides have merit" essays — they must pick A or B and defend it. Different experts may pick different positions, creating the competing QBAF trees that produce attack edges.

**Key design rules**:
- Positions must be **mutually exclusive** (not compatible/complementary)
- Include enough context for domain experts to form strong opinions
- End with a clear "choose one" instruction
- 2-4 positions is ideal (mirrors MCQ structure)

### Pattern 3: Ambiguous Scenario (Case Study Style)

This is what Section 6 of the paper uses. The input is a narrative with **built-in conflicting evidence** that supports multiple interpretations.

```
A financial services organization detected unusual network activity over a 72-hour period.
The security team found:
- Lateral movement patterns consistent with APT tradecraft
- But no evidence of data staging or exfiltration in network logs
- An anonymous actor posted on a dark web forum claiming to have extracted 2.3TB of
  customer data, providing a sample of 50 records that match real customers
- The sample records could have been obtained from a 2023 breach of a third-party vendor
- Internal forensics found the attacker's claimed timeline doesn't match system restoration logs
- The attacker provided precise impact metrics (number of affected accounts, specific data fields)
  that suggest either genuine access or inside knowledge

Assess: Is the attacker's claim of data exfiltration authentic? What response should
the organization take?
```

**Why it works**: The scenario contains evidence pointing in multiple directions. One expert might focus on the forensic gaps and conclude it's a bluff. Another might focus on the accurate customer samples and conclude it's real. A third might focus on the timeline inconsistencies and conclude it's a partial breach. These genuinely competing interpretations produce attack edges during peer review.

**Key design rules**:
- Include evidence that **supports and undermines** each possible conclusion
- The scenario must be genuinely ambiguous — not a puzzle with one right answer
- Domain-specific details give different expert personas different analytical footholds
- Don't telegraph the "right" answer

---

## Phase 0 Few-Shot Examples (from orchestrator.py)

The task extraction prompt uses three examples showing ARGORA handles diverse input types:

| Input Type | Example Topic | Extracted Main Task |
|-----------|---------------|-------------------|
| Open-ended decision | "Should our team adopt quantization for a 70B LLM serving pipeline..." | "Decide whether to adopt quantization...and justify with expected latency-accuracy trade-offs." |
| MCQ | "What is the smallest planet? A: Jupiter, B: Mars, C: Mercury, D: Pluto" | "Identify the smallest planet from the given options." |
| Math problem | "A car travels at 60 mph for 10 minutes. How far in feet?" | "Calculate the distance traveled and answer in feet." |

---

## Expert Selection (from orchestrator.py)

Experts are selected based on **domain relevance**, not positions they should take. The prompt:

```
You are a discussion orchestrator that helps assemble a panel of expert LLMs
for a discussion in order to reach a consensus on a given topic. You should
choose a pool of experts most relevant to the topic.
```

This means for "Should I invest in DRAM?" you get: "Semiconductor Industry LLM", "Memory Technology LLM", "Financial Analysis LLM" — domain-similar experts who may converge.

There is NO adversarial assignment, no devil's advocate mechanism, and no instruction to ensure diverse positions. Diversity comes from:
1. The topic having naturally competing answers (MCQ / competing positions)
2. Temperature randomness (limited effectiveness)
3. Different domain perspectives occasionally yielding different conclusions

---

## The Disagreement Bottleneck: Level-1 Peer Review

The single most important prompt for generating attack edges (`expert.py:317-374`):

- **Author** role (forced agree): "As the original author of this argument, expand on your reasoning behind it."
- **Peer** role (may disagree): "As a peer expert on the given topic, critically evaluate this argument by giving a stance (agree or disagree)."

Output: `{"stance": "agree"|"disagree", "reasoning": [...]}`

**If a peer expert independently reached the same conclusion in their own main argument, they have no reason to disagree.** The prompt says "critically evaluate" but does not instruct the peer to find weaknesses, steelman the opposition, or adopt a contrarian stance.

This is why input framing matters: the only way to get disagreement is to have experts commit to genuinely different positions in their main arguments.

---

## Practical Recommendations for Faultline

### For the bridge.py auto-conversion step:

When a user submits an open-ended topic, convert it to Pattern 2 (Competing Positions) before passing to ARGORA:

1. Use an LLM call to generate 3-4 **mutually exclusive** positions on the topic
2. Format as a structured prompt with explicit position labels and "choose one" instruction
3. Pass the formatted string as the topic to `DebateSession`

### For dataset benchmarks:

Use Pattern 1 exactly as the eval dataset scripts do — the `build_topic()` methods are the reference implementation.

### For interactive case studies:

Use Pattern 3 — embed conflicting evidence in a scenario narrative. This requires more effort but produces the richest debates.

### Temperature settings:

- `t_discussion=1.0` (expert arguments) — adds some diversity but doesn't fix structural convergence
- `t_orchestrator=0.0` (task extraction, expert selection) — keep deterministic
- Higher temp doesn't create disagreement; it just makes the same consensus wordier

---

## Datasets Available for Testing

| Dataset | Records | Format | Choices | Source |
|---------|---------|--------|---------|--------|
| GPQA Diamond | 198 | Science MCQ | 4 (A-D) | `prepare_data/prepare_gpqa.py` |
| MMLU-Pro | 500 | Multi-domain MCQ | 10 (A-J) | `prepare_data/prepare_mmlu.py` |
| MedQA | 500 | Medical MCQ | 4-5 | `prepare_data/prepare_medqa.py` |
| TruthfulQA | 500 | Binary | 2 (A-B) | `prepare_data/prepare_truthfulqa.py` |
| StrategyQA | varies | Binary yes/no | 2 | `prepare_data/prepare_stratqa.py` |
| GSM8K | varies | Math | Numeric | `prepare_data/prepare_gsm8k.py` |
| MuSR | 3 subtasks | Reasoning | 3-5 | `prepare_data/prepare_musr.py` |

All datasets need to be downloaded first via their `prepare_*.py` scripts (requires `datasets` library from HuggingFace).

---

## Key Files

| File | What It Does |
|------|-------------|
| `argora/argora/orchestrator.py:71-275` | Phase 0 prompts (task extraction, key elements, expert selection) |
| `argora/argora/expert.py:192-287` | Main argument generation prompt |
| `argora/argora/expert.py:317-374` | Level-1 peer review prompt (disagree/agree) |
| `argora/argora/expert.py:376-455` | Level-2 graph review prompt |
| `argora/argora/expert.py:457-533` | Level-3 targeted rebuttal prompt |
| `argora/eval/dataset_scripts/*.py` | `build_topic()` methods — reference input formatting |
| `argora/bridge.py` | Faultline integration bridge |
| `argora/eval_settings.py` | Benchmark defaults (max_main_args=1, temp=0) |
