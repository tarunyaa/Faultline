# Step 3.1: Personality Agents in ARGORA

**Status**: Backend complete — frontend pending
**Date**: 2026-03-05
**Depends on**: Step 1-2 (ARGORA integration, complete)
**Scope**: Replace ARGORA's auto-generated domain experts with Faultline's user-selected personality agents

---

## Goal

When a user runs an `argument` debate, they select personality agents (Elon Musk, Arthur Hayes, etc.) instead of ARGORA auto-generating generic "Semiconductor Industry LLM" experts. The personas argue in-character using the same voice, personality, and style as the `dialogue` debate type — but through ARGORA's structured argumentation pipeline (QBAF, counterfactual analysis, consensus).

**Explicitly NOT in scope**: Belief graphs, worldview synthesis, QBAF-from-beliefs, GenMinds-style graph reasoning. We use only `PersonaContract` + `VoiceProfile` — the same prompt-injected personality system that powers `/dialogue`.

---

## Why This Works Naturally

ARGORA's expert lifecycle maps cleanly onto Faultline's persona system:

| ARGORA Phase | Current | After Integration |
|---|---|---|
| Expert generation | LLM invents 3-6 generic experts | User selects 2-5 personality agents |
| Expert identity | One-liner: `"You are the {name}"` | Full `buildConsolidatedPrompt()` output (~500 words) |
| Main argument | Generic domain reasoning | In-character opening statement (personality, bias, stakes shape the argument) |
| Peer review (attacks/supports) | Polite academic critique | Punchy, voice-consistent challenges ("Show me the chart" — Hayes) |
| Consensus | Labels like `"ML LLM: ..."` | Real persona names: `"Arthur Hayes: ..."` |
| QBAF scoring | Unchanged | Unchanged (expert-agnostic) |
| Counterfactual analysis | Unchanged | Unchanged (expert-agnostic) |

The entertainment value comes from personality agents producing substantive arguments in their distinctive voices through a rigorous argumentation structure — not generic LLM-speak.

---

## Architecture: What Changes

### Change Surface Analysis

ARGORA's expert identity is injected at exactly **2 points**. Everything downstream is expert-agnostic:

```
CHANGE: debate.py  → DebateSession.initialize()     — skip choose_experts(), accept persona list
CHANGE: expert.py  → Expert._prompt_system_message() — replace one-liner with consolidated prompt
CHANGE: expert.py  → Expert.add_default_system()     — accept pre-built system prompt
CHANGE: bridge.py  → accept persona data from TS     — pass names + system prompts
CHANGE: bridge.ts  → send persona data to Python     — build prompts, serialize, pass via stdin

KEEP:   expert.py  → build_round_user_content()      — topic/prompt assembly (expert-agnostic)
KEEP:   expert.py  → build_first_level_argument_prompt — peer review structure (uses name as label only)
KEEP:   expert.py  → build_graph_review_prompt        — level-2 review (name as label only)
KEEP:   expert.py  → build_targeted_rebuttal_prompt   — level-3 rebuttal (name as label only)
KEEP:   qsem.py    → QBAF scoring                    — pure graph math
KEEP:   counterfactual.py                             — pure graph math
KEEP:   scm_alignment.py                              — graph structure only
KEEP:   similarity_check.py                           — text embeddings only
KEEP:   graph_builder.py                              — Node.expert is just a string
KEEP:   orchestrator.py → extract_main_task()         — Phase 0 (topic parsing)
KEEP:   orchestrator.py → make_consensus()            — expert names as labels
KEEP:   orchestrator.py → make_graph_consensus()      — no expert names used
```

### Data Flow (Before vs After)

**Before:**
```
Topic string
  → Orchestrator.extract_main_task()         [Phase 0]
  → Orchestrator.choose_experts()            [LLM generates names]
  → Expert("Semiconductor LLM")             [auto-generated]
  → Expert._prompt_system_message()          [one-liner identity]
  → debate pipeline...
```

**After:**
```
Topic string + [{name, systemPrompt}]        [from TypeScript bridge]
  → Orchestrator.extract_main_task()         [Phase 0 — unchanged]
  → self.experts = [provided names]          [skip choose_experts()]
  → Expert("Arthur Hayes", system_prompt=consolidatedPrompt)
  → Expert.add_default_system()              [uses provided prompt]
  → debate pipeline...                       [unchanged]
```

---

## Implementation Plan

### Phase 1: Create Working Copy

1. Copy `argora/` → `argora-personas/`
2. Update `.gitignore` if needed
3. Verify the copy runs independently (`python -m argora-personas.bridge ...`)

**Rationale**: Keep vanilla ARGORA intact for benchmarking (Step 2). The personas variant is a fork.

### Phase 2: Python-Side Expert Override (3 files)

#### 2a. `expert.py` — Accept External System Prompt

**Current** (`expert.py:170-186`):
```python
def _prompt_system_message(self, name: str) -> str:
    return f"You are the {name}. As {name}, you have deep expertise in {name.split()[0].lower()}..."

def add_default_system(self) -> None:
    self._exp_system(self._prompt_system_message(self.name))
```

**Change**: Add optional `system_prompt` parameter to `Expert.__init__()`. If provided, `add_default_system()` uses it verbatim instead of generating from name.

```python
class Expert:
    def __init__(self, name, llm, s, bus, system_prompt=None):
        self.name = name
        self._custom_system_prompt = system_prompt
        # ... rest unchanged

    def add_default_system(self) -> None:
        if self._custom_system_prompt:
            self._exp_system(self._custom_system_prompt)
        else:
            self._exp_system(self._prompt_system_message(self.name))
```

#### 2b. `debate.py` — Skip Expert Generation

**Current** (`debate.py:312-345`): `initialize()` calls `self.orch.choose_experts(self.topic)`.

**Change**: Accept optional `persona_configs: list[dict]` parameter. If provided, skip `choose_experts()` and use the provided names + system prompts.

```python
def initialize(self, persona_configs=None):
    if persona_configs:
        self.experts = [p["name"] for p in persona_configs]
        self.s.num_experts = len(self.experts)
        # Build Expert handlers with custom system prompts
        for p in persona_configs:
            handler = Expert(p["name"], self.llm, self.s, self.bus,
                           system_prompt=p["system_prompt"])
            handler.add_default_system()
            self.expert_handlers[p["name"]] = handler
    else:
        # Original flow (auto-generate experts)
        self.experts = self.orch.choose_experts(self.topic)
        # ... original handler creation
```

#### 2c. `bridge.py` — Accept Persona Data from stdin

**Current**: Bridge receives `{topic, settings}` from TypeScript via stdin JSON.

**Change**: Also accept optional `personas` array:

```json
{
  "topic": "Should DRAM outperform NAND through 2027?",
  "settings": { ... },
  "personas": [
    { "name": "Arthur Hayes", "system_prompt": "You are Arthur Hayes (@CryptoHayes).\n\n## Identity\n..." },
    { "name": "Elon Musk", "system_prompt": "You are Elon Musk (@elonmusk).\n\n## Identity\n..." }
  ]
}
```

Bridge passes `persona_configs` to `DebateSession.initialize()`.

### Phase 3: TypeScript Bridge — Build and Send Persona Prompts

#### 3a. `lib/argument/bridge.ts` — Build Consolidated Prompts

Before spawning the Python subprocess:
1. Load selected persona contracts via `loadContract(personaId)`
2. Load persona metadata via `loadPersonas()`
3. Build system prompts via `buildConsolidatedPrompt(contract, persona)`
4. Serialize as `{name, system_prompt}` array
5. Pass to Python via stdin JSON alongside topic and settings

#### 3b. `app/api/argument/route.ts` — Accept Persona IDs

The API route currently accepts `{topic}`. Change to also accept `{topic, personaIds?: string[]}`.

When `personaIds` is provided:
- Load contracts + build prompts on the TS side
- Pass persona configs to bridge
- Bridge passes to Python

When `personaIds` is omitted:
- Fall through to vanilla ARGORA (auto-generated experts)

### Phase 4: Skip Per-Expert Prompt Generation

Per-expert prompt generation is **skipped** (Option C). The persona contracts are already 500+ words of identity — richer than anything the orchestrator would auto-generate. The `orch_prompt` parameter in `build_round_user_content()` will be passed as `None`.

### Phase 5: Frontend — Persona Selection for Argument Debates

#### 5a. Setup Flow

The `/setup` page currently only feeds into `/dialogue`. Extend it to also target `/argument`:
- User selects deck → personas → topic (existing flow)
- New: Choose debate type: "Dialogue" or "Argument"
- If "Argument": navigate to `/argument?personas=...&topic=...`

#### 5b. `/argument` Page — Display Persona Info

The argument view currently shows generic expert names. With personality agents:
- Show persona avatars + names in the argument tree
- Use persona colors/branding in the QBAF visualization nodes
- Consensus report shows persona names (automatic — names flow through the pipeline)

---

## Critical Analysis: Potential Issues

### Issue 1: Persona Count Mismatch

ARGORA defaults to 3-6 experts. Faultline decks typically have 3-5 personas. This maps well. But ARGORA's peer review assumes N experts where each reviews N-1 others — the review matrix scales quadratically. With 5 personas, that's 20 peer reviews per round.

**Mitigation**: Keep the default. 3-4 personas is the sweet spot — 6-12 peer reviews, manageable cost.

### Issue 2: System Prompt Length

ARGORA's original system prompt is ~50 words. `buildConsolidatedPrompt()` produces ~500 words. This is fine for Claude (well within context), but:
- Every LLM call for that expert includes the full system prompt
- ARGORA makes many calls per expert (main argument, peer reviews, rebuttals, graph reviews)
- Cost increases proportionally

**Mitigation**: Acceptable. The persona prompt is cached as a system message prefix. Claude's prompt caching means the marginal cost of the longer system prompt is minimal after the first call per expert.

### Issue 3: Voice Consistency Through ARGORA's Structured Prompts

ARGORA's peer review prompts are highly structured ("critically evaluate this argument by giving a stance (agree or disagree)..."). The persona voice might get overridden by the rigid prompt format.

**Mitigation**: The system prompt (persona identity) takes precedence over user prompts in Claude's attention hierarchy. The voice will shape HOW the expert agrees/disagrees, even within the structured format. Test with one persona first to verify.

### Issue 4: Expert Name Canonicalization

ARGORA uses `_canonicalize_expert()` (`debate.py:370-388`) for case-insensitive name matching. Names like "Arthur Hayes" work fine — the only assumption is uniqueness.

**Mitigation**: None needed. Faultline persona IDs are unique strings.

### Issue 5: Two Argument Modes

After this change, `/argument` can run in two modes:
1. **Vanilla ARGORA** — auto-generated experts (no personas selected)
2. **Persona ARGORA** — user-selected personality agents

Both should remain available. The API route determines which mode based on whether `personaIds` is provided.

**Mitigation**: Clean conditional in bridge — no mode flags needed.

### Issue 6: Topic Framing for Open-Ended Debates

ARGORA works best with MCQ or competing-positions input (per `input_argora.md`). When personality agents debate an open topic, there's no predefined answer options.

**Mitigation**: Use Pattern 2 (Competing Positions) from `input_argora.md`. Before passing to ARGORA, use an LLM call to convert the user's topic into 2-4 mutually exclusive positions. Each persona's main argument then maps to one of these positions. This is a pre-processing step in the TS bridge, before the Python subprocess starts.

---

## File Manifest

### Python (in `argora-personas/`)

| File | Change | Description |
|---|---|---|
| `expert.py` | Modify | Add `system_prompt` param to `__init__`, conditional in `add_default_system()` |
| `debate.py` | Modify | Add `persona_configs` param to `initialize()`, skip `choose_experts()` when provided |
| `bridge.py` | Modify | Parse `personas` from stdin JSON, pass to `DebateSession.initialize()` |

### TypeScript (in `faultline/`)

| File | Change | Description |
|---|---|---|
| `lib/argument/bridge.ts` | Modify | Build persona prompts, serialize, pass to Python |
| `app/api/argument/route.ts` | Modify | Accept `personaIds` param, load contracts, pass to bridge |
| `lib/argument/types.ts` | Modify | Add `personaIds?: string[]` to request type |

### Frontend (deferred to frontend-integrator)

| File | Change | Description |
|---|---|---|
| `app/setup/page.tsx` | Modify | Add debate type selector (dialogue vs argument) |
| `components/argument/ArgumentView.tsx` | Modify | Show persona avatars instead of generic expert names |

### No Changes

| File | Why |
|---|---|
| `qsem.py` | Pure graph math — expert-agnostic |
| `counterfactual.py` | Pure graph math — expert-agnostic |
| `graph_builder.py` | `Node.expert` is just a string — works with any name |
| `scm_alignment.py` | Graph structure only |
| `similarity_check.py` | Text embeddings only |
| `orchestrator.py` (most of it) | Phase 0, consensus — expert-agnostic |
| `lib/dialogue/*` | Dialogue debate type — unaffected |
| `lib/personas/loader.ts` | Used as-is — we call `buildConsolidatedPrompt()` |
| `lib/dialogue/speech-roles.ts` | Used as-is — voice profiles read by loader |

---

## Implementation Order

1. **Copy `argora/` → `argora-personas/`** — DONE
2. **`expert.py`** — add system_prompt override — DONE
3. **`debate.py`** — add persona_configs to initialize() + run() — DONE
4. **`bridge.py`** — accept --personas-json CLI arg, pass to session.run() — DONE
5. **`lib/argument/topic-framer.ts`** — NEW: converts open topics to Pattern 2 — DONE
6. **`lib/argument/bridge.ts`** — build persona prompts, frame topic, pass to Python — DONE
7. **`lib/argument/types.ts`** — add 'status' event type — DONE
8. **`app/api/argument/route.ts`** — accept personaIds, cap at 5 — DONE
9. **Test**: Run with 2 personas on a simple topic, verify voice in arguments
10. **Frontend**: Persona selection + avatar display (via frontend-integrator agent)

---

## Decisions (Confirmed)

1. **Folder**: `argora-personas/` as a new folder. `argora/` is read-only.
2. **Per-expert prompts**: Option C — skip entirely. Persona contracts are rich enough.
3. **Topic framing**: Auto-convert open topics to Pattern 2 (Competing Positions) via LLM call. Generate 3-4 mutually exclusive positions but keep them broad/high-level — don't restrict how each personality agent can argue. The positions are framing, not scripts.
4. **Persona count**: Cap at 5.
5. **Benchmarks**: Same benchmark wrapper as vanilla ARGORA (baseline comparison). Built separately — not part of this implementation.
