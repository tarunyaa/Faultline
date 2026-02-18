# Multi-Persona Debate Engine
## February 14, 2025 - Clean Slate Design

**Status**: 🎯 **ACTIVE PLAN**

**Vision**: Natural group chat between personas that spawns focused "crux rooms" when disagreements emerge.

---

## Core Concept

Think of it like **Discord/Slack with AI personas**:

1. **Main Channel** (Dialogue Layer): Group chat where all personas talk naturally
2. **Crux Threads** (Crux Layer): Private rooms that spawn when disagreements detected
3. **Crux Cards**: Insights from crux rooms that get posted back to main channel

**Key Principle**: Let personas self-organize. No forced structure, no artificial moderator.

---

## Layer 1: Dialogue Layer (Main Channel)

### What It Is

A natural group conversation between 3-5 personas.

**Not this** (artificial):
```
Saylor: "Bitcoin represents the apex property of the human race,
a manifestation of digital scarcity that transcends traditional
monetary frameworks..." [verbose opening statement]
```

**This** (natural):
```
Saylor: "Bitcoin is digital property. Scarcest asset ever created."

Hayes: "Until the correlation breaks. It's just a levered Nasdaq trade right now."

Schiff: "You're both wrong. No intrinsic value = not an asset."

Saylor: "@Hayes - zoom out. 4-year cycles matter, not quarterly noise."
```

### Rules

1. **Short messages**: 1-2 sentences max
2. **Natural tone**: Personas speak like they do in real life (no AI politeness)
3. **Threading**: Can reply to specific messages (like Discord/Slack)
4. **Sequential**: Not everyone responds to everything
5. **No forced turns**: Personas choose when to speak (based on attention/relevance)

### UI Structure

```
Main Channel: "Bitcoin as Store of Value"

┌─────────────────────────────────────────┐
│ Saylor: Bitcoin is digital property.    │
│                                         │
│   ├─ Hayes: Until correlation breaks.  │
│   │                                     │
│   └─ Saylor: Zoom out. 4-year cycles.  │
│                                         │
│ Schiff: No intrinsic value = not asset.│
│                                         │
│   └─ Mallers: Value is network effects. │
│                                         │
│ [CRUX CARD: Risk Asset vs Hedge]       │ ← Crux revealed
│                                         │
│ Taleb: @CruxCard - I challenge this... │
└─────────────────────────────────────────┘
```

### Technical Implementation

```typescript
interface DialogueMessage {
  id: string
  personaId: string
  content: string                    // 1-2 sentences
  replyTo?: string                   // Message ID being replied to
  timestamp: number

  // No "move" classification needed here
  // No structured metadata
  // Just natural dialogue
}

interface DialogueState {
  topic: string
  messages: DialogueMessage[]
  activePersonas: string[]

  // Disagreement detection (lightweight)
  disagreementCandidates: DisagreementCandidate[]
}

interface DisagreementCandidate {
  messages: string[]                 // Message IDs involved
  personas: string[]                 // Who's disagreeing
  topic: string                      // "correlation" or "intrinsic value"
  confidence: number                 // 0-1, how clear is the disagreement
}
```

### How Personas Decide When to Speak

**v0 (Simple)**: Pseudo-random round-robin with attention filter
- Each persona gets a "turn" to optionally respond
- Can choose to respond to recent message or skip
- LLM decides: "respond or skip?"

**v1 (Smarter)**: Attention-based
- Score each message for relevance to persona
- Respond if score > threshold
- Cooldown period after speaking

---

## Layer 2: Crux Layer (Crux Rooms)

### When Crux Rooms Spawn

**Trigger**: Disagreement detection system notices:
- Two personas taking opposite stances on same topic
- Pattern: "A says X, B says not-X, A responds defending X"
- Confidence threshold reached

**Example**:
```
Hayes: "It's a levered tech trade"
Saylor: "No, it's digital gold"
Hayes: "The correlation proves it"
→ Disagreement detected: "risk asset vs hedge"
→ Spawn crux room with Hayes + Saylor
```

### What Happens in Crux Room

**Goal**: Fully explore WHY they disagree. No escape until it's clear.

**Protocol**:
1. **Entry**: "You disagree on X. Let's figure out why."
2. **Steelman phase**: Each must accurately represent other's position
3. **Diagnosis phase**: Is this about...
   - Different time horizons? (1-year vs 10-year)
   - Different evidence? (what data are you using?)
   - Different values? (what matters to you?)
   - Different definitions? (what does "store of value" mean?)
   - Claim vs premise? (disputing conclusion or assumption?)
4. **Resolution attempt**: Can this be resolved? Or is it irreducible?
5. **Output**: Crux card

**No cheap exits**:
- Can't agree without explaining what changed
- Can't disagree without explaining root cause
- Must pass steelman check (opponent confirms understanding)

### Crux Card Format

```typescript
interface CruxCard {
  id: string
  question: string                   // "Is Bitcoin a risk asset or hedge?"

  // Who's involved
  personas: {
    [personaId: string]: {
      position: 'YES' | 'NO' | 'NUANCED'
      reasoning: string              // 1-2 sentences
      falsifier?: string             // What would change mind
    }
  }

  // Root cause analysis
  disagreementType: 'horizon' | 'evidence' | 'values' | 'definition' | 'claim' | 'premise'
  diagnosis: string                  // "Hayes optimizes 12-18mo, Saylor optimizes 10y+"

  // Resolution
  resolved: boolean
  resolution?: string                // If resolved, what changed

  // Metadata
  sourceMessages: string[]           // Original dialogue that spawned this
  cruxRoomTranscript: string[]       // Full crux room conversation
}
```

### Crux Room UI

```
Crux Room: "Risk Asset vs Hedge?"
Participants: Saylor, Hayes

┌──────────────────────────────────────────────────┐
│ System: You disagree on Bitcoin's asset type.   │
│         Steelman each other first.              │
│                                                  │
│ Saylor: Hayes thinks Bitcoin is correlated with │
│         tech stocks and behaves like duration.  │
│                                                  │
│ Hayes: ✓ Accurate                               │
│                                                  │
│ Hayes: Saylor thinks Bitcoin is digital gold,   │
│        anti-fragile in sovereign debt crisis.   │
│                                                  │
│ Saylor: ✓ Accurate                              │
│                                                  │
│ System: Why do you disagree?                    │
│                                                  │
│ Saylor: Different horizons. I'm 10-year.        │
│                                                  │
│ Hayes: I'm 12-18 months. Fair point.            │
│                                                  │
│ System: Same horizon (10-year). Still disagree? │
│                                                  │
│ Hayes: Yes. 10-year correlation will stay high. │
│        Falsifier: drops below 0.3 by 2034.      │
│                                                  │
│ Saylor: No. Decorrelates during crisis.         │
│         Falsifier: drops >50% in next crash.    │
│                                                  │
│ System: Crux identified. Returning to main...   │
│                                                  │
│ [Crux Card Generated]                           │
└──────────────────────────────────────────────────┘
```

---

## Disagreement Detection (The Spawner)

### How It Works

**Lightweight listener** watching dialogue layer for patterns:

```typescript
interface DisagreementDetector {
  // Analyze recent messages for disagreement patterns
  detectDisagreements(messages: DialogueMessage[]): DisagreementCandidate[]

  // Decide if candidate is strong enough to spawn crux room
  shouldSpawnCruxRoom(candidate: DisagreementCandidate): boolean
}
```

**Detection heuristics**:
1. **Direct opposition**: "I disagree" or "No, actually..."
2. **Claim contradiction**: LLM detects A says X, B says not-X
3. **Repeated engagement**: Same 2-3 personas keep responding to each other on topic
4. **Escalation**: Responses getting more specific/detailed

**Spawn criteria**:
- ≥2 personas clearly on opposite sides
- ≥3 message exchanges on topic
- Confidence > 0.7 (LLM judges disagreement is real)

**Example**:
```typescript
// Watching dialogue:
Message 1: Hayes: "It's a tech trade"
Message 2: Saylor: "It's digital gold"
Message 3: Hayes: "Correlation proves it"
Message 4: Saylor: "Zoom out"

// Detector analyzes:
{
  messages: [1, 2, 3, 4],
  personas: ["hayes", "saylor"],
  topic: "asset classification",
  confidence: 0.85,  // Clear disagreement
  shouldSpawn: true
}

// Action: Spawn crux room
```

---

## Parallel Crux Rooms

**Multiple can run simultaneously**:

```
Main Channel
├─ Crux Room 1: "Risk vs Hedge" (Saylor, Hayes)
├─ Crux Room 2: "Intrinsic Value" (Schiff, Mallers)
└─ Crux Room 3: "Adoption Timeline" (Saylor, Hayes, Schiff)
```

**When crux rooms complete**:
- Crux card posted to main channel
- Personas return to main channel
- Other personas can challenge/comment on crux card

---

## Crux Card Challenges

**What happens when crux card posted**:

```
Main Channel:

[CRUX CARD: Risk Asset vs Hedge]
Saylor (NO) vs Hayes (YES)
Root cause: Different time horizons (10y vs 18mo)

Taleb: "@CruxCard - I challenge this. You're both wrong.
        It's neither. Jury's still out, need more tail events."

→ System detects challenge
→ New crux room spawns: "Is Bitcoin risk/hedge/TBD?"
   with Saylor, Hayes, Taleb
```

---

## What We're NOT Building (Yet)

❌ **Argument graph** - Dung semantics, attacks, IN/OUT/UNDEC
- Too complex for MVP
- Focus on dialogue + crux extraction first
- Can add later if needed

❌ **Moderator** - Forced turn-taking, topic rotation
- Let personas self-organize
- Only intervention: spawn crux rooms when disagreement detected

❌ **Coalition detection** - Clustering agents by positions
- Interesting but not core
- Defer to v2

❌ **Cross-crux dependencies** - "If A then B" logic
- Complex, unclear value
- Maybe future: crux graph

❌ **Multi-threading** (in dialogue layer)
- One main channel for MVP
- Crux rooms are the parallelism we need

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│          DIALOGUE ORCHESTRATOR                  │
│  - Run dialogue loop                            │
│  - Manage persona turns                         │
│  - Emit SSE events                              │
└─────────────┬───────────────────────────────────┘
              │
    ┌─────────┼─────────┬─────────────┐
    ▼         ▼         ▼             ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Persona │ │Persona │ │Persona │ │Disagremt│
│ Agent  │ │ Agent  │ │ Agent  │ │Detector│
└────────┘ └────────┘ └────────┘ └───┬────┘
                                      │
                                      ▼
                           ┌─────────────────┐
                           │ CRUX ROOM       │
                           │ ORCHESTRATOR    │
                           │ - Run crux room │
                           │ - Steelman      │
                           │ - Diagnosis     │
                           │ - Generate card │
                           └─────────────────┘
```

---

## Implementation Plan

### Phase 1: Dialogue Layer (Week 1)

**Goal**: Get 3 personas chatting naturally in one channel.

**Deliverables**:
- Dialogue orchestrator (simple round-robin)
- Persona agents (1-2 sentence responses)
- Message threading (replies)
- Basic UI (chat view with threading)

**Files**:
```
lib/dialogue/
├── orchestrator.ts      # Main dialogue loop
├── agent.ts             # Persona response generation
├── prompts.ts           # Natural dialogue prompts
└── types.ts             # DialogueMessage, etc.

app/api/dialogue/route.ts   # SSE endpoint
components/dialogue/
├── MessageThread.tsx    # Threaded message view
└── DialogueView.tsx     # Main UI
```

**Success**: 3 personas have natural back-and-forth in UI.

---

### Phase 2: Disagreement Detection (Week 1.5)

**Goal**: Detect when crux room should spawn.

**Deliverables**:
- Disagreement detector (watches messages)
- Spawn crux room on detection
- Crux room stub (just logs "crux room started")

**Files**:
```
lib/dialogue/
└── disagreement-detector.ts

lib/crux/
└── types.ts             # CruxRoom, CruxCard
```

**Success**: System detects disagreement, logs crux room spawn.

---

### Phase 3: Crux Room Logic (Week 2)

**Goal**: Full crux room flow working.

**Deliverables**:
- Steelman protocol
- Root cause diagnosis
- Crux card generation
- Post card back to main channel

**Files**:
```
lib/crux/
├── orchestrator.ts      # Crux room loop
├── steelman.ts          # Steelman checks
├── diagnosis.ts         # Root cause analysis
├── prompts.ts           # Crux room prompts
└── card-generator.ts    # Create crux card
```

**Success**: 2 personas enter crux room, complete protocol, generate card.

---

### Phase 4: Integration + UI (Week 2.5)

**Goal**: Everything working together with polished UI.

**Deliverables**:
- Parallel crux rooms
- Crux card display in main channel
- Crux card challenges
- Responsive UI

**Files**:
```
components/crux/
├── CruxCard.tsx         # Display crux card
├── CruxRoom.tsx         # Crux room UI
└── CruxChallengeButton.tsx
```

**Success**: Full flow works end-to-end. Multiple crux rooms can run.

---

## MVP Success Criteria

After 2.5 weeks, we should have:

✅ **Natural dialogue**: 3-5 personas chat in group (1-2 sentences each)
✅ **Threading**: Replies show under original message
✅ **Disagreement detection**: System spawns crux room when disagreement clear
✅ **Crux rooms**: Steelman + diagnosis + card generation works
✅ **Crux cards**: Posted to main channel, visible to all
✅ **Challenges**: Other personas can challenge crux cards
✅ **Parallel rooms**: 2+ crux rooms can run simultaneously
✅ **Quality**: Cruxes are real (not shallow), diagnosis is insightful

---

## Example Full Flow

```
Main Channel starts:

Saylor: "Bitcoin is the best store of value ever created."

Hayes: "That's a narrative. Look at the correlation with Nasdaq."

Schiff: "Store of value? It has no intrinsic value."

Saylor: "@Hayes - short-term noise. 4-year view matters."

→ System detects disagreement (Saylor vs Hayes on "risk asset vs hedge")
→ Spawns Crux Room 1

[Crux Room 1: Saylor, Hayes]
... steelman protocol ...
... horizon alignment ...
... falsifier exchange ...
[Crux Card Generated: "Risk Asset vs Hedge"]

Meanwhile in Main Channel:

Mallers: "@Schiff - network effects are the new intrinsic value."

Schiff: "That's nonsense. Gold lasted 5000 years for a reason."

→ System detects disagreement (Schiff vs Mallers on "intrinsic value")
→ Spawns Crux Room 2

[Crux Room 2: Schiff, Mallers]
... protocol runs ...
[Crux Card Generated: "Does money need commodity backing?"]

Back in Main Channel:

[CRUX CARD 1: Risk Asset vs Hedge]
Saylor (NO - hedge) vs Hayes (YES - risk)
Root: Time horizon difference

[CRUX CARD 2: Intrinsic Value Requirement]
Schiff (YES - need backing) vs Mallers (NO - network effects)
Root: Different value theories

Taleb: "@CruxCard1 - You're both wrong. Need more crises to tell."

→ System detects challenge
→ Spawns Crux Room 3 with Saylor, Hayes, Taleb

... and so on
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Dialogue style** | Natural 1-2 sentences | Feels real, not like AI debate |
| **Turn-taking** | Pseudo-random (v0) | Simple, deterministic, works |
| **Crux spawning** | Automated detection | No manual intervention needed |
| **Steelman check** | Required in crux room | Forces understanding |
| **Diagnosis** | LLM-guided discovery | Agents figure out root cause |
| **Moderator** | None (only spawner) | Decentralized, emergent |
| **Graph** | Defer to future | Not needed for MVP |

---

## Tech Stack

- **Backend**: Next.js API routes (SSE)
- **LLM**: Claude Sonnet 4.5 (dialogue), Haiku (detection)
- **State**: In-memory (no DB for MVP)
- **Frontend**: React + Tailwind
- **Real-time**: SSE (not WebSocket)

---

## What Success Looks Like

**Good MVP**:
- Personas chat naturally
- Real disagreements get explored deeply in crux rooms
- Crux cards reveal insights (time horizons, evidence differences, value conflicts)
- Multiple crux rooms can run in parallel
- UI is clean and easy to follow

**Bad MVP**:
- Dialogue feels robotic or verbose
- Crux rooms produce shallow insights
- Detection spawns too many/few rooms
- UI is confusing

---

## Next Steps

1. ✅ Clean up old folders (orchestrator, argumentation)
2. Create `lib/dialogue/` folder structure
3. Implement Phase 1 (dialogue layer)
4. Test with 3 personas on "Bitcoin as store of value"

**Ready to start Phase 1?**
