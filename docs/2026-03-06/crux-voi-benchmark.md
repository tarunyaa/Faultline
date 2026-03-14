# CRUX-VOI Benchmark

10 pre-annotated decision tasks for measuring structured debate quality against single-model and Deep Research baselines.

## Metrics

| Metric | Abbreviation | Description |
|--------|-------------|-------------|
| Decisive Assumption Recall | DAR | Fraction of pre-annotated decisive assumptions explicitly surfaced |
| Decision Flip Test | DFT | Does flipping the key assumption cause a correct decision pivot? |
| Adversarial Trap Detection | ATD | Does the system flag an injected factual inconsistency? |

## Tasks

| # | Domain | Title | Decisive Assumptions | Has Trap |
|---|--------|-------|---------------------|----------|
| 1 | Startup | AI Coding Assistant: Pivot or Double Down | 5 | No |
| 2 | Startup | Series A: Raise Now or Wait 12 Months | 4 | No |
| 3 | Policy | NYC Congestion Pricing: Expand or Retreat | 5 | No |
| 4 | Tech | NVIDIA: Spin Off Networking Division | 4 | No |
| 5 | Macro | Fed Rate Decision: Hold or Cut | 4 | No |
| 6 | Tech | OpenAI For-Profit Conversion | 4 | **Yes** |
| 7 | Policy | Federal vs. State AV Regulation | 4 | **Yes** |
| 8 | Healthcare | Hospital AI Diagnostic Deployment | 4 | No |
| 9 | Finance | Clean Energy: Solid-State vs. LFP | 4 | **Yes** |
| 10 | Pharma | GLP-1: Acquire or Build | 5 | No |

## Adversarial Traps (Tasks 6, 7, 9)

**Task 6 — OpenAI:** Context claims OpenAI's non-profit entity generated $1.3B in revenue — structurally impossible for a 501(c)(3) holding entity with no operating activity. Contradicts stated corporate structure.

**Task 7 — AV Regulation:** Decision question says "only 11 states have passed AV laws" but context says "31 states have enacted some form of AV legislation." Direct numerical contradiction.

**Task 9 — Battery:** Context states QuantumScape achieved 1,000 charge cycles (breakthrough), then immediately states "no solid-state battery has exceeded 400 commercially viable cycles." Direct contradiction.

## Evaluation Protocol

### Conditions
1. **Single LLM** — Single-prompt response (GPT-4o or Claude Sonnet)
2. **Deep Research** — Perplexity / ChatGPT Deep Research / Gemini Deep Research
3. **Crux** — Faultline dialogue + crux room with domain-appropriate personas

### DAR Scoring
- Assumption counts as surfaced only if explicitly named/described
- Vague references to "market conditions" do not count
- Must identify the specific variable and its decisiveness to the decision

### DFT Protocol
After each system gives its recommendation:
> "Given that [primary_flip_assumption is reversed], does your recommendation change?"

Score: **yes** if decision pivots, **no** if system hedges or holds.

### ATD Protocol
Run tasks 6, 7, 9 as-is with no hint.
Score: **yes** if system proactively flags inconsistency, **no** if it reasons through the contradiction silently.

## Expected Results (Hypothesis)

| Condition | DAR | DFT | ATD |
|-----------|-----|-----|-----|
| Single LLM | ~0.40 | ~30% | ~20% |
| Deep Research | ~0.55 | ~45% | ~35% |
| Crux | ~0.75+ | ~80%+ | ~65%+ |

Crux advantage hypothesis:
- **DAR**: Adversarial persona debate forces surface of load-bearing assumptions that single-model reasoning skips
- **DFT**: Crux cards explicitly identify decisive variables, making flip sensitivity structural not incidental
- **ATD**: Multi-persona debate creates contradiction pressure — one persona's facts get challenged by another's, surfacing internal inconsistencies

## Live Demo Moment

Pick Task 1 (startup pivot) or Task 9 (battery bet).

Run Crux live. Show the crux card naming the primary decisive assumption.

Then flip it:
> "What if enterprise sales cycles are actually 2 months for inbound leads?"

Crux pivots the recommendation. Single model hedges.

That's the moment.
