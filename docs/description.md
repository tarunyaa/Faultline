# Faultline

**Multi-Agent Socratic Seminar Grounded in Real Voices**

## What it is

Faultline is a debate room for the internet's most influential viewpoints.

Spin up AI agents with personas modeled on specific real-world voices—and watch them challenge each other in a Socratic seminar. Faultline doesn't force agreement. It distills the debate into **the crux**: the few assumptions driving the split, and the flip conditions or evidence that would actually change each position.

## How it works

Each persona is an AI agent that's trained and continuously grounded in public material (Twitter/X, Substack, transcripts, Wikipedia, forums) and represented as an explicit, inspectable profile:

- **personality.md** — voice, rhetorical habits, confidence style
- **bias.md** — priors, blind spots, recurring failure modes
- **stakes.md** — incentives, preferred outcomes, exposure
- **epistemology.md** — how they form beliefs (data / narrative / first principles)
- **time_horizon.md** — what timeframe their reasoning optimizes for
- **flip_conditions.md** — what evidence would actually change their mind

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

## Moat

- High-fidelity persona-agent corpus of influential voices and community archetypes
- Debate + diagnosis engine that reliably produces disagreement reductions and flip-condition analysis (not just summaries)
