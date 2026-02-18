# Dialogue Layer Review - What Actually Got Built

## TL;DR - What Changed

Started with: Verbose AI debate responses
Goal: Punchy 1-sentence group chat
Reality: Built a bunch of stuff, some useful, some over-engineered

---

## Files Created/Modified

### Core Files (Actually Needed)

**1. `lib/dialogue/agent.ts`** - Generates responses from personas
- Takes: PersonaContract + Persona + intent + reply target
- Returns: One utterance (or null if rejected)
- **Key feature**: Combines full personality + chat constraints
- **Validation**: Length check (120 chars), banned patterns

**2. `lib/dialogue/prompts.ts`** - Prompt templates
- `microTurnPrompt()` - Main chat response
- `openingMicroTurnPrompt()` - Opening message
- **Key feature**: Explicit "MAX 120 CHARACTERS" in prompt
- Has few-shot examples

**3. `lib/dialogue/orchestrator.ts`** - Main dialogue loop
- Round-robin turn-taking
- Calls agent to generate responses
- Detects disagreements every 3 messages
- Spawns crux rooms when detected

### Probably Over-Engineered

**4. `lib/dialogue/turn-manager.ts`** - "Controller picks turns"
- **Purpose**: Assign who speaks + what intent (AGREE/DISAGREE/ASK/etc)
- **Reality**: Just does round-robin anyway
- **Over-engineered?**: YES - could be simpler

**5. `lib/dialogue/speech-roles.ts`** - Chat style hints
- Maps persona → style hint like "Show correlation. Challenge narratives."
- **Over-engineered?**: MAYBE - could just use personality directly

### UI Files (Working)

**6. `components/dialogue/ThreeColumnLayout.tsx`** - 3-column UI
- Left: Main chat
- Middle: Active crux rooms
- Right: Crux cards (playing card style)

**7. `lib/hooks/useDialogueStream.ts`** - React hook for SSE
- Manages messages, crux cards, active rooms
- Handles SSE events

---

## The Actual Flow

```
User visits /dialogue
    ↓
DialogueView loads
    ↓
useDialogueStream() starts SSE to /api/dialogue
    ↓
Orchestrator runs:

    1. Opening messages:
       For each persona:
         - Call generateOpeningMicroTurn()
         - Get one sentence (< 100 chars)
         - Post to chat

    2. Round-robin turns:
       Loop:
         - Turn manager assigns next persona + intent
         - Call generateMicroTurn()
         - Persona gets:
           * Full PersonaContract (personality, evidence, etc)
           * Chat constraint: "MAX 120 CHARS"
           * Intent: DISAGREE/ASK/etc
           * Reply target
         - LLM generates response
         - Validate: length + banned patterns
         - If valid: post message
         - If invalid: skip

         Every 3 messages:
           - Check for disagreements
           - If found → spawn crux room

    3. Crux rooms:
       - Run in background
       - Emit events (messages, status updates)
       - Generate crux card when done
       - Card appears in right column
```

---

## What Actually Works

✅ **Full personality + chat constraints**
- Uses buildSystemPrompt() (keeps unique personality)
- Adds "MAX 120 CHARS" constraint on top
- Personas sound like themselves, just punchier

✅ **Explicit character limits**
- Prompt literally says "MAX 120 CHARACTERS"
- maxTokens: 35 (hard cap)
- Validation rejects > 120 chars

✅ **Banned pattern detection**
- Auto-rejects "firstly", "I think", etc.
- Regex patterns checked after generation

✅ **Three-column UI**
- Main chat | Active crux rooms | Crux cards
- Real-time updates via SSE

✅ **Crux room tracking**
- Hook tracks active rooms
- Shows live messages
- Removes room when card generated

---

## What's Over-Engineered

❌ **Turn Manager** (`turn-manager.ts`)
- **What it does**: Assigns intent (AGREE/DISAGREE/ASK)
- **Problem**: Just does round-robin anyway
- **Simpler**: Could just pick random intent or no intent at all

❌ **Speech roles as separate system** (`speech-roles.ts`)
- **What it does**: Maps persona → chat style hint
- **Problem**: Adds complexity for minimal benefit
- **Simpler**: Could just add "Keep it punchy" to everyone's system prompt

❌ **TurnIntent enum** (6 different intents)
- AGREE, DISAGREE, ASK, CLARIFY, EVIDENCE, REFRAME
- **Problem**: Not clear this actually affects behavior
- **Simpler**: Just let personas respond naturally

---

## What's Actually Important

The core insight that WORKS:

```typescript
// System prompt = Full personality + Chat mode

const systemPrompt = `${buildSystemPrompt(contract, persona)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHAT MODE:
🚨 MAX 120 CHARACTERS 🚨

BANNED: "Firstly", "I think", "In summary"

Speak like YOU, just PUNCHY.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
```

Everything else is optional complexity.

---

## Simplified Version (Recommendation)

Keep:
1. ✅ `agent.ts` - Personality + chat constraints
2. ✅ `prompts.ts` - Explicit char limits
3. ✅ `orchestrator.ts` - Main loop
4. ✅ UI components - Three columns
5. ✅ Hook - SSE management

Remove/Simplify:
1. ❌ `turn-manager.ts` - Just do round-robin in orchestrator
2. ❌ `speech-roles.ts` - Just add "be punchy" to all personas
3. ❌ TurnIntent system - Let personas respond naturally

---

## Current State

**Does it work?** Should work, but untested with new char limits.

**Is it too complex?** Yes, for what it does.

**Should we simplify?** Probably yes.

**Main risk:** LLM still might not respect "MAX 120 CHARS" even when explicit.

---

## Test Plan

1. Start dev server: `npm run dev`
2. Visit: `http://localhost:3000/dialogue`
3. Watch console for:
   - "Response too long (X chars), rejecting" ← Bad
   - Messages appearing in chat ← Good
4. Check if messages are actually < 120 chars
5. Check if personas sound like themselves (not generic)

---

## Questions for Review

1. **Turn Manager** - Keep or remove?
2. **Speech Roles** - Keep or just use personality?
3. **Intent System** - Useful or noise?
4. **Character limit** - 120 too strict? 150 better?
5. **Disagreement detection** - Every 3 messages too frequent?

---

## Bottom Line

**Core working concept:**
Full personality + explicit char limits + banned patterns = Punchy authentic chat

**Over-engineering:**
Turn manager, speech roles, intent system = Probably unnecessary complexity

**Recommendation:**
Test current system. If char limits work, simplify the turn management.
