# Multi-Agent Debate: Pragmatic Implementation Plan

**Status**: ⚠️ **DEPRECATED** - See `2_14_plan.md` for current plan (Feb 14, 2025)

**Strategy**: Start simple (1 thread, 2 agents, mock LLM), prove core mechanics work, then scale up.

---

## What We're Building (v0)

A **single-threaded debate system** where 2 agents go through a **3-stage pipeline** to find authentic cruxes:

1. **DISCOVERY**: Explore topic → propose binary question (6-10 messages)
2. **CRUX_LOCK**: Commit positions + steelman each other + declare falsifiers (6-8 messages)
3. **EVIDENCE**: Debate with data tied to falsifiers (12-16 messages)

**Key Innovation**: Hard gates between stages ensure cruxes are real, not polite consensus.

---

## What We Cut from Original Spec (v0 Simplifications)

| Feature | Why Cut | Add Later? |
|---------|---------|------------|
| **Multi-threading** | Prove single-thread pipeline first | ✅ v1 (Week 7+) |
| **Attention scorer** | Everyone in same thread sees everything | ✅ v1 (keyword-based) |
| **Agenda Manager** | No value with 1 thread | ✅ v1 (when multi-thread) |
| **DCG calculation** | Only needed to compare multiple cruxes | ✅ v1 (when multi-thread) |
| **Coalition detection** | Analytics, not core mechanics | ⚠️ Maybe (low ROI) |
| **Async agent loops** | Simpler to debug with pseudo-turns | ✅ v1 (true async) |
| **Cross-thread analysis** | No multiple threads in v0 | ❌ No (complex) |
| **Embeddings** | Keyword matching sufficient | ⚠️ Maybe (if needed) |
| **Horizon per thread** | One horizon per debate simpler | ✅ v1 |
| **Dynamic interests** | Agents' personas are static | ❌ No (not needed) |

---

## Core Mechanics (What We Keep)

### 1. Stage Pipeline

```
DISCOVERY → CRUX_LOCK → EVIDENCE → CONVERGED
```

Each stage has:
- **Allowed moves** (other moves blocked)
- **Message budget** (forces advancement)
- **Gate criteria** (must pass to advance)

### 2. Steelman Protocol

**Rule**: Can't CHALLENGE until you've steelmanned opponent and received ACCURATE grade.

**Flow**:
1. Agent A issues STEELMAN targeting Agent B
2. Agent B grades it: ACCURATE | INCOMPLETE | WRONG
3. If INCOMPLETE/WRONG → Agent A must retry
4. If ACCURATE → Agent A can now CHALLENGE

**Result**: Forces genuine understanding before debate.

### 3. Crux Lock Gate

**4 Criteria** (all must pass):
- ✅ ≥2 agents committed (YES/NO/UNCERTAIN)
- ✅ Both YES and NO present (not all UNCERTAIN)
- ✅ All steelmans graded ACCURATE
- ✅ All committed agents have structured falsifiers

**If fails**: Moderator intervenes with clarifying prompts.

### 4. Structured Falsifiers

```typescript
interface Falsifier {
  metric: string      // "Spot BTC ETF AUM"
  threshold: string   // ">= $100B"
  deadline: string    // "2027-12-31"
  reasoning?: string  // Why this would change your mind
}
```

**Examples**:
- ✅ "Drops >50% when SPY drops >30%" (concrete)
- ❌ "Probably correlated" (vague)

### 5. TopClaim Tracking

Each agent has a **TopClaim** (what they're really arguing):

```typescript
interface TopClaim {
  statement: string   // "Bitcoin is a store of value"
  side: 'YES' | 'NO' | 'NUANCED'
  confidence: number  // 0-1
}
```

Cruxes are authentic only if ≥2 agents' TopClaims would flip if crux flipped.

---

## Implementation Milestones

### **Milestone 1: Single-Thread Stage Pipeline** (Week 1)

**Goal**: Get 2 agents through DISCOVERY → CRUX_LOCK → EVIDENCE.

**Scope**:
- 1 thread, 2 agents (mock responses, not LLM yet)
- Stage transitions based on message count + binary question check
- No steelman enforcement yet (allow all moves)
- Prove: stages advance correctly

**Files to create**:
```
faultline/lib/multi-agent/
├── types.ts              # Message, Thread, ThreadStage, DialogueMove
├── message-bus.ts        # Simple in-memory message array
├── thread.ts             # Thread state machine (stage tracking)
└── test-harness.ts       # Mock agents, inject messages, verify stages
```

**Test case**: "Bitcoin is digital gold" with Saylor vs Hayes (hardcoded messages).

**Success criteria**:
- ✅ Thread starts in DISCOVERY
- ✅ After 8 messages with binary question → advances to CRUX_LOCK
- ✅ After 6 messages in CRUX_LOCK → advances to EVIDENCE
- ✅ Stage budgets enforced (excess messages blocked)

**Output**: Console log showing stage transitions.

---

### **Milestone 2: Steelman Protocol** (Week 2)

**Goal**: Add steelman-before-challenge enforcement.

**Scope**:
- Add `steelmanRequirements` tracking to Thread
- Add STEELMAN and GRADE_STEELMAN moves
- Block CHALLENGE in EVIDENCE if steelman not ACCURATE
- Track steelman pairs (A ↔ B)

**Files to create**:
```
faultline/lib/multi-agent/
├── steelman-tracker.ts   # Track pairs, grades, check completion
├── stage-gates.ts        # canPublishInStage() enforcement
└── moderator.ts          # Detect failures, inject prompts
```

**Test case**: Agent A tries to CHALLENGE before steelmanning → blocked.

**Success criteria**:
- ✅ STEELMAN graded INCOMPLETE → CHALLENGE blocked
- ✅ STEELMAN graded ACCURATE → CHALLENGE allowed
- ✅ System tracks mutual steelmans (both A→B and B→A)
- ✅ Moderator detects missing steelman, prompts agent

**Output**: Log showing CHALLENGE blocked until steelman passes.

---

### **Milestone 3: Crux Lock Gate** (Week 3)

**Goal**: Implement 4-criteria lock gate.

**Scope**:
- Create `LockedCrux` during CRUX_LOCK stage
- Check 4 criteria before advancing to EVIDENCE
- Block advancement if criteria not met
- Moderator injects prompts after 2 failed attempts

**Files to create**:
```
faultline/lib/multi-agent/
├── crux-lock.ts          # attemptCruxLock(), check criteria
├── falsifier-validator.ts # Validate falsifiers are concrete
└── moderator-prompts.ts  # Templates for interventions
```

**Test cases**:
- Lock fails: missing commitments
- Lock fails: no YES+NO split (all UNCERTAIN)
- Lock fails: steelman not graded ACCURATE
- Lock fails: missing falsifiers
- Lock succeeds: all 4 criteria met

**Success criteria**:
- ✅ Lock fails → moderator injects clarifying prompt
- ✅ Lock succeeds → thread advances to EVIDENCE
- ✅ Falsifiers validated (no vague keywords like "probably")
- ✅ After 2 failed attempts, moderator forces binary framing

**Output**: LockedCrux JSON with commitments, steelmans, falsifiers.

---

### **Milestone 4: LLM Integration** (Week 4)

**Goal**: Replace mock agents with real LLM calls.

**Scope**:
- Agent prompts for each move type
- Stage-aware context (show allowed moves, requirements)
- Moderator prompts (commit request, falsifier request, steelman retry)
- Use existing `lib/llm/client.ts`

**Files to create**:
```
faultline/lib/multi-agent/
├── agent-prompts.ts      # Prompt templates per move
├── agent-runner.ts       # LLM call wrapper + retry logic
└── moderator-runner.ts   # Moderator prompt injection
```

**Prompts needed**:
- **DISCOVERY**: "Explore this topic, propose a binary question"
- **COMMIT_POSITION**: "Commit YES/NO/UNCERTAIN with confidence"
- **STEELMAN**: "Represent opponent's position accurately"
- **GRADE_STEELMAN**: "Is this steelman ACCURATE/INCOMPLETE/WRONG?"
- **DECLARE_FALSIFIER**: "What evidence would change your mind? (metric/threshold/deadline)"
- **PROVIDE_EVIDENCE**: "Present data tied to your falsifier"
- **Moderator**: "Agents, commit to YES or NO. Provide one falsifier each."

**Test case**: 2 real agents (Saylor vs Hayes) complete full pipeline.

**Success criteria**:
- ✅ Agents generate appropriate moves per stage
- ✅ Steelmans are graded (not all ACCURATE on first try)
- ✅ Falsifiers are structured (not vague)
- ✅ Debate completes with locked crux
- ✅ Cost < $0.50 per debate

**Output**: Full debate transcript + LockedCrux JSON.

---

### **Milestone 5: Crystallization & Output** (Week 5)

**Goal**: Extract final ThreadCrux, validate, output JSON.

**Scope**:
- After EVIDENCE phase, crystallize final positions
- Validate: real disagreement, concrete falsifiers, decision-relevant
- Check counterfactual (would TopClaims flip if crux flipped?)
- Output format matches spec

**Files to create**:
```
faultline/lib/multi-agent/
├── crystallizer.ts       # Extract ThreadCrux from evidence
├── validator.ts          # Validate authenticity
└── output-formatter.ts   # Format final JSON
```

**Validation checks**:
- ✅ Real disagreement (has both YES and NO)
- ✅ Concrete falsifiers (no vague keywords)
- ✅ Decision-relevant (≥2 agents would flip TopClaim)
- ✅ Resolution criteria present (derived from falsifiers)

**Test case**: Output from M4 debate → validate → format JSON.

**Success criteria**:
- ✅ ThreadCrux has positions (YES+NO split)
- ✅ Falsifiers are concrete
- ✅ Counterfactual shows TopClaim linkage
- ✅ Output JSON matches spec format
- ✅ Validation failures logged (if any)

**Output**:
```json
{
  "crux": {
    "question": "Is Bitcoin's behavior more like a risk asset or hedge?",
    "positions": { "saylor": { "side": "NO", ... }, "hayes": { "side": "YES", ... } },
    "falsifiers": [...],
    "counterfactual": {...},
    "validated": true
  }
}
```

---

### **Milestone 6: API + Basic UI** (Week 6)

**Goal**: SSE endpoint + minimal frontend.

**Scope**:
- POST /api/debate-multi-v0 with topic + 2 persona IDs
- SSE events for real-time progress
- Frontend: single column thread view, stage indicator, steelman status
- Final crux display

**Files to create**:
```
faultline/app/api/debate-multi-v0/route.ts
faultline/components/multi-agent/
├── StageIndicator.tsx    # Badge showing current stage
├── SteelmanStatus.tsx    # Show steelman pairs + grades
├── MessageList.tsx       # Chat-style message display
└── CruxDisplay.tsx       # Show final crux with positions
```

**SSE events** (9 types):
- `message_posted` - New message in thread
- `stage_transition` - DISCOVERY → CRUX_LOCK → EVIDENCE
- `steelman_attempt` - Agent tries to steelman opponent
- `steelman_graded` - Opponent grades steelman
- `commitment_made` - Agent commits YES/NO/UNCERTAIN
- `falsifier_declared` - Agent declares falsifier
- `lock_attempted` - System checks lock criteria
- `lock_succeeded` / `lock_failed` - Result of lock attempt
- `debate_complete` - Final crux ready

**UI components**:
- **Stage indicator**: Badge (green = current, gray = future)
- **Message list**: Chat bubbles with move badges (CLAIM, CHALLENGE, etc.)
- **Steelman status**: Table showing pairs + grades
- **Crux display**: Final question + positions + falsifiers

**Test case**: Start debate via UI, watch stages progress, view final crux.

**Success criteria**:
- ✅ API returns SSE stream
- ✅ Frontend shows stage transitions in real-time
- ✅ Steelman status visible (pending/accurate/incomplete)
- ✅ Messages tagged with move type
- ✅ Final crux displayed with structured falsifiers
- ✅ Mobile-responsive (single column)

**Output**: Working UI at `/debate-multi-v0`.

---

## v0 Deliverables (6 Weeks)

After M6, you have:

✅ **Working debate system**:
- 2 agents complete DISCOVERY → CRUX_LOCK → EVIDENCE
- Stage gates enforce move restrictions
- Steelman protocol blocks challenges until understanding proven
- Crux lock gate ensures quality (4 criteria)
- Final output has concrete falsifiers + TopClaim linkage

✅ **API + UI**:
- SSE endpoint for real-time progress
- Basic frontend showing stages, steelmans, messages, crux

✅ **Quality guarantees**:
- No shallow cruxes (lock gate blocks them)
- No fake agreement (steelman protocol + falsifier structure)
- No measurement questions (validator checks)

---

## v1 Upgrade Path (Weeks 7+)

**What v1 adds**:

1. **Multi-threading** (2-4 concurrent threads)
   - Attention scorer (keyword-based initially)
   - Thread spawning ("second bite" protocol)
   - Thread merging (duplicate detection)

2. **DCG Calculation** (Disagreement Compression Gain)
   - Coverage × Polarity × Impact
   - Crux promotion (highest DCG becomes primary)

3. **Agenda Manager**
   - Track 1-2 active disputes
   - Boost attention to hot topics

4. **Moderator Enhancements**
   - Horizon normalization (detect mismatches, force alignment)
   - Orbiting detection (keyword repetition >2.0)
   - Binary framing (rewrite confused questions)

5. **Scale to 3-5 agents**
   - Coalition detection (post-debate)
   - Common ground extraction

**Effort**: 4 weeks (cumulative: 10 weeks)

---

## What We're NOT Building

❌ **Cross-thread dependencies** (Level 2/3 crystallization)
- Too complex, unclear ROI
- Single-thread crux discovery is valuable enough

❌ **Embeddings** for attention scoring
- Keyword matching is good enough
- Avoids API calls, latency, complexity

❌ **Dynamic interest tracking**
- Agents' personas are static
- No need to update interests during debate

❌ **True async agent loops** (in v0)
- Pseudo-turns (round-robin respecting stage gates) is simpler
- Easier to debug and reason about
- Add true async in v1 if needed

❌ **Coalition detection** (maybe in v1)
- Analytics, not core to crux discovery
- Low ROI compared to effort

---

## Success Metrics (v0)

After 6 weeks, system should:

✅ **Complete debates**: 2 agents finish DISCOVERY → CRUX_LOCK → EVIDENCE
✅ **Stage enforcement**: Moves blocked when not allowed in stage
✅ **Steelman works**: Can't challenge until graded ACCURATE
✅ **Lock gate works**: Fails without falsifiers, succeeds when criteria met
✅ **Quality output**: Crux has YES+NO, concrete falsifiers, TopClaim linkage
✅ **No fake agreement**: Cheap concessions detected (topClaimChanged=false)
✅ **Moderator helps**: Failed locks trigger clarifying prompts
✅ **UI shows progress**: Stage transitions, steelman status visible in real-time
✅ **Cost-effective**: <$0.50 per debate
✅ **Fast**: Completes in <2 minutes

---

## File Structure (v0)

```
faultline/
├── lib/
│   └── multi-agent/
│       ├── types.ts                  # All core types
│       ├── message-bus.ts            # In-memory message store
│       ├── thread.ts                 # Thread state machine
│       ├── stage-gates.ts            # Move restrictions per stage
│       ├── steelman-tracker.ts       # Track pairs + grades
│       ├── crux-lock.ts              # 4-criteria lock gate
│       ├── falsifier-validator.ts    # Check concrete vs vague
│       ├── moderator.ts              # Intervention logic
│       ├── moderator-prompts.ts      # Prompt templates
│       ├── agent-prompts.ts          # Per-move prompts
│       ├── agent-runner.ts           # LLM wrapper
│       ├── crystallizer.ts           # Extract final crux
│       ├── validator.ts              # Authenticity checks
│       └── output-formatter.ts       # JSON output
├── app/
│   └── api/
│       └── debate-multi-v0/
│           └── route.ts              # SSE endpoint
├── components/
│   └── multi-agent/
│       ├── StageIndicator.tsx
│       ├── SteelmanStatus.tsx
│       ├── MessageList.tsx
│       └── CruxDisplay.tsx
└── scripts/
    └── test-debate.ts                # CLI test harness
```

**Total**: ~15 files, ~2000 LOC

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Steelmans always graded ACCURATE** | No retries, shallow understanding | Prompt agents to be critical; if >90% ACCURATE, tighten grading prompt |
| **Falsifiers too vague** | Weak cruxes | Validator rejects vague keywords; moderator requests retry |
| **Agents don't commit (all UNCERTAIN)** | Lock fails | Moderator forces binary framing after 2 failures |
| **LLM costs too high** | >$1 per debate | Use Haiku for dialogue, Sonnet only for crystallization |
| **Debates take >5 min** | Poor UX | Reduce message budgets (6/6/12 instead of 10/8/16) |
| **Lock never succeeds** | Stuck in CRUX_LOCK | After 3 attempts, moderator auto-generates falsifiers from dialogue |

---

## Next Step

**Start Milestone 1** (Week 1):
- Create `lib/multi-agent/types.ts` with core types
- Implement simple message bus (in-memory array)
- Build thread state machine (stage tracking)
- Write test harness with 2 mock agents
- Prove: stages advance correctly

**Deliverable**: Console output showing stage transitions for hardcoded debate.

**Ready to begin?**
