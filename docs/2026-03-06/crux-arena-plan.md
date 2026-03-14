# CruxArena: Implementation Plan

**Date**: 2026-03-06
**Status**: Planning

---

## What CruxArena Is

A human preference benchmark for debate engines. Users run debates on topics they care about, see outputs from multiple methods side-by-side (all producing crux cards in the same schema), and vote on which gave them the most insight and clarity. Aggregate preferences across all debates to measure system+model quality.

**Not an accuracy benchmark.** No ground truth labels, no MMLU/GPQA accuracy tables. The metric is human preference for insight, not correctness.

**Benchmarks the combined stack.** Debate engine + model backend as one unit. Not isolating model vs system.

---

## Prerequisites

CruxArena depends on the ARGORA-to-Crux transformation (see `docs/2026-03-05/argora_to_crux.md`). The ARGORA pipeline must produce crux cards before any comparison is meaningful.

---

## The Apples-to-Oranges Rule

**All methods must produce crux cards in the same schema.** If one method outputs structured crux cards and another outputs plain text, the structured output wins on format alone. The benchmark measures formatting, not insight.

Crux card schema (shared across all methods):

```typescript
interface CruxCardOutput {
  question: string                         // The disagreement framed as a question
  disagreementType: string                 // horizon|evidence|values|definition|claim|premise
  diagnosis: string                        // Why they disagree
  importance: number | null                // Counterfactual delta (ARGORA only, null for baselines)
  positions: {
    expert: string
    stance: string
    reasoning: string
    flipCondition: string | null
  }[]
}
```

Baselines that can't produce `importance` scores set them to `null`. The UI renders all cards identically.

---

## Methods

| Method | Model | Calls | What it tests |
|--------|-------|-------|---------------|
| **Direct Crux** | GPT-4o-mini | 1 | Can a single cheap call identify cruxes? Establishes floor. |
| **CoT Crux** | o3 | 1 | Does reasoning depth improve crux quality? |
| **Multi-agent Crux** | GPT-4o-mini | ~8 | Does multi-perspective help without formal argumentation? |
| **ARGORA Crux** | GPT-4o-mini | ~50 | Full pipeline: QBAF + counterfactual + crux extraction. |

### Direct Crux

Single prompt to GPT-4o-mini:
> "What are the irreducible disagreements in this topic? For each, identify: the disagreement framed as a question, the type (evidence/values/definition/horizon/claim/premise), why reasonable people disagree, each side's position and reasoning, and what would change each side's mind. Output as JSON array of crux cards."

### CoT Crux

Same prompt through o3. No system prompt, no temperature (reasoning model). The internal chain-of-thought may surface deeper cruxes than direct prompting.

### Multi-agent Crux

The critical ablation — isolates whether ARGORA's formal machinery adds value over simple multi-perspective prompting:

1. Expert generation (1 call): Generate 3 domain experts (same as ARGORA Phase 0)
2. Position generation (3 parallel calls): Each expert writes their position
3. Cross-review (3 parallel calls): Each expert reviews others' positions, states agreements/disagreements with justification
4. Crux extraction (1 call): Summarizer reads all positions + cross-reviews, extracts crux cards in standard schema

~8 calls total. Captures multi-perspective benefit without graph construction, QBAF propagation, or counterfactual analysis.

### ARGORA Crux

The full pipeline as defined in `argora_to_crux.md`. ~50 calls. Produces crux cards with counterfactual importance scores.

---

## Voting UX: Pairwise Comparison

**Blind pairwise comparison**, not "pick the best of N."

- Show two methods side-by-side (names hidden, order randomized)
- Ask: "Which gave you more insight into the key disagreements?"
- User picks A, B, or Tie
- Each debate produces N*(N-1)/2 = 6 pairwise comparisons (4 methods)
- Method names revealed after voting

Why pairwise:
- Eliminates format bias (same schema)
- Simpler cognitive task than ranking 4-5 options
- Produces clean win rates / Bradley-Terry scores
- Proven model (Chatbot Arena)

After pairwise voting, optionally show all methods with names revealed for exploration (expand reasoning, compare crux cards in detail). But the pairwise votes are the primary data.

---

## Persistence

### DB Schema

Add to `faultline/lib/db/schema.ts`:

```
arena_debates
  id            uuid PK
  topic         text
  created_at    timestamp
  methods_run   jsonb           -- ["direct_crux", "cot_crux", "multiagent_crux", "argora_crux"]

arena_outputs
  id            uuid PK
  debate_id     uuid FK → arena_debates
  method        text            -- "direct_crux" | "cot_crux" | "multiagent_crux" | "argora_crux"
  crux_cards    jsonb           -- CruxCardOutput[]
  token_usage   jsonb
  runtime_ms    integer
  model         text            -- "gpt-4o-mini" | "o3" etc.
  cost_usd      real            -- estimated cost

arena_votes
  id            uuid PK
  debate_id     uuid FK → arena_debates
  method_a      text
  method_b      text
  winner        text            -- "a" | "b" | "tie"
  session_id    text            -- browser session (no auth required)
  created_at    timestamp
```

### Aggregate Stats

- **Win rate per method** (pairwise) with 95% CI
- **Win rate by topic type** (factual vs normative vs strategic — auto-classified)
- **Cost per method** alongside preference (cost-adjusted win rate)
- **Inter-rater agreement** on same debates (if multiple users vote)
- **N debates, N votes, N unique sessions** (credibility metrics)

---

## File Plan

### Python (under `argora/`)

```
bridge_baselines.py             -- REWRITE: produce crux cards, not answers. Add multi-agent crux.
```

### TypeScript (under `faultline/`)

```
lib/arena/types.ts              -- CruxCardOutput, ArenaDebate, ArenaOutput, ArenaVote, ArenaMethod
lib/arena/persistence.ts        -- save/load debates, outputs, votes to DB
lib/arena/stats.ts              -- aggregate win rates, CIs, cost-adjusted metrics

app/api/arena/vote/route.ts     -- POST: save pairwise vote
app/api/arena/stats/route.ts    -- GET: aggregate stats for dashboard

app/arena/page.tsx              -- CruxArena dashboard (aggregate stats + debate list)

components/arena/
  PairwiseVoting.tsx            -- blind pairwise comparison UI
  ArenaResults.tsx              -- post-voting reveal: all methods with names
  ArenaDashboard.tsx            -- win rates, charts, debate history
  CruxCardDisplay.tsx           -- render a single crux card (shared renderer for all methods)
```

### Integration with existing debate flow

After a debate completes and crux cards are extracted:
1. `bridge.ts` runs all baseline methods (rewritten to produce crux cards)
2. All outputs saved to `arena_outputs`
3. User redirected to pairwise voting flow
4. Votes saved to `arena_votes`
5. CruxArena dashboard updates

---

## Phases

### Phase 1: Crux-Producing Baselines

Rewrite `bridge_baselines.py` so all methods output `CruxCardOutput[]`:
- Direct Crux: single prompt → crux cards
- CoT Crux: o3 prompt → crux cards
- Multi-agent Crux: 3 experts + cross-review + extraction → crux cards
- Shared JSON schema enforced in the prompt

**Depends on**: argora_to_crux.md Phase 2 (so ARGORA also outputs crux cards)

### Phase 2: Persistence Layer

- Add DB tables (`arena_debates`, `arena_outputs`, `arena_votes`)
- `lib/arena/persistence.ts`: save debate + outputs after each run
- `app/api/arena/vote/route.ts`: POST endpoint for pairwise votes

### Phase 3: Pairwise Voting UI

- `CruxCardDisplay.tsx`: shared renderer for crux cards (identical for all methods)
- `PairwiseVoting.tsx`: blind side-by-side, pick A/B/Tie, 6 pairs per debate
- Wire to vote API endpoint
- Show method names after all pairs voted

### Phase 4: CruxArena Dashboard

- `ArenaDashboard.tsx`: win rates per method, cost comparison, debate history
- `lib/arena/stats.ts`: aggregate from `arena_votes` table
- `app/arena/page.tsx`: the CruxArena page

### Phase 5: Public Dataset Export

- API endpoint or static export: JSON-lines (topic + all method crux cards + all votes)
- Metadata: topic domain, models used, token counts, costs, timestamps

---

## Moltbook

**Defer.** Only integrate if:
1. Moltbook can produce crux cards in the same schema (apples-to-apples)
2. CruxArena is stable with 4 internal methods first
3. The comparison is fair (same topic, comparable cost, no format advantage)

If Moltbook's output is a different format, it has the same apples-to-oranges problem. Don't integrate it just to show it performs poorly — that's marketing, not engineering.

---

## Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Format bias (structured vs plain text) | Critical | All methods produce same crux card schema |
| Small sample size (N<50 debates) | High | Report CIs, don't overclaim, accumulate over time |
| Self-selection bias (users prefer structured debate) | High | Acknowledge in methodology, collect user expertise self-report |
| Cost asymmetry (ARGORA 40x more expensive) | Medium | Report cost alongside preference, show cost-adjusted win rate |
| Crux quality hard to judge | Medium | Users may not distinguish genuine disagreement from dressed-up trivial differences |
| Latency (running 4 methods = minutes of waiting) | Medium | Run baselines in parallel where possible, show results incrementally |
