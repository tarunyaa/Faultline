# Faultline

**Automated Insight Generation through Multi-Agent Socratic Seminar Grounded in Real Voices**

## The Problem

The internet has more information than ever—but almost none of it turns into insight. If you want to truly understand a complex topic, you still have to do the hard part yourself: track the best voices across platforms, compare competing arguments, separate signal from vibes, and figure out what would actually change anyone's mind. There's no system that reliably converts fragmented discourse into a clear, testable takeaway.

## What it is

Faultline is a debate room for the internet's most influential viewpoints.

Spin up AI agents with personas modeled on specific real-world voices—and watch them challenge each other in a Socratic seminar. Faultline doesn't force agreement. It distills the debate into **the crux**: the few assumptions driving the split, and the flip conditions or evidence that would actually change each position.

## How it works

Faultline is built on a **three-layer grounding system**:

### Layer 1: Identity (style + stance)
Each persona is an AI agent represented as an explicit, inspectable profile:

- **personality.md** — voice, rhetorical habits, confidence style
- **bias.md** — priors, blind spots, recurring failure modes
- **stakes.md** — incentives, preferred outcomes, exposure
- **epistemology.md** — how they form beliefs (data / narrative / first principles)
- **time_horizon.md** — what timeframe their reasoning optimizes for
- **flip_conditions.md** — what evidence would actually change their mind
- **rules.md** — debate behavior (agents try to WIN and CONVERT, not just state views)

### Layer 2: Grounding (receipts)
A searchable **evidence store** of attributable excerpts (tweets, essays, transcripts) that:
- Prevents hallucination ("what X would say")
- Enables citations and receipts
- Grounds arguments in real public material
- Each excerpt includes: text, source URL, date, topic tags, confidence level

### Layer 3: Update (freshness + tools)
Agents are tool-connected, so the room can pull fresh information in real time: fetch filings, query price data, run calculations, inspect code, and source new posts. That means the debate can actually update—if new evidence hits an agent's flip conditions, you'll see them change their stance.

Users enter a topic (e.g., "Is IREN overvalued?") and pick the voices they want—or let Faultline auto-select a balanced room. Then the personas debate in a structured Socratic format with toggleable styles (adversarial, cooperative, evidence-first, first-principles, time-horizon split) until the system can produce a clear reduction: the crux and the flip conditions.

## The atomic unit of value: the Disagreement Map

Faultline's output is not "the best answer." It's a **structured map of why credible perspectives diverge**—and what would resolve the disagreement.

### System output:

- No forced consensus
- Clear sources of disagreement
- Explicit flip conditions (what evidence would change each position)

### Example sources of disagreement

- Time horizon (short-term vs long-term)
- Assumptions about monetary debasement
- Identity or values attachment

### Flip conditions

- Agent A changes view if CPI stays below X for Y months
- Agent B changes view only if the USD regime shifts
- Agent C does not change view because the stance is identity-based

**That's insight you cannot get from a single model**—because it requires multiple epistemologies and incentives interacting, plus a structured diagnosis of what would change each stance.

## Simple UI, high signal

No heavy dashboard. A roundtable view showing who responded to whom, plus optional visuals:

- A wisdom/skill hexagon per agent
- An overlay of shared beliefs vs fault lines
- A compact "What would settle this?" section (flip-conditions summary)

## Who it's for

People who want to understand complex topics in depth—**investors, builders, researchers**—who currently have to manually synthesize perspectives across platforms.

## Technical Architecture

This is NOT a "magical clone" system. It's a **persona corpus + grounding system** with three layers:

1. **Identity Layer** - Structured persona profiles (`.md` files) generated from evidence
2. **Grounding Layer** - Evidence store with embeddings for retrieval
3. **Update Layer** - Tool integration for live data

**Key innovation**: Agents must cite their sources or explicitly label extrapolation. This prevents hallucinated positions and ensures arguments are grounded in real public material.

## Moat

- High-fidelity persona-agent corpus grounded in real public material with citations
- Evidence store + retrieval system (not just RAG, but structured for debate)
- Debate + diagnosis engine that reliably produces testable flip conditions (not just summaries)
- Citation enforcement prevents "creative writing" debates

## Getting Started

See [`MVP.md`](./MVP.md) for the 2-hour build plan and [`implement.md`](./implement.md) for the full implementation roadmap.
