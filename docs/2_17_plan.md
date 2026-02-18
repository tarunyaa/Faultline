# Faultline Dialogue System: Quality Pass
## February 17, 2025

**Status**: 🎯 ACTIVE PLAN

**Focus**: Quality over features. The 2_14 system is functional — this pass makes it feel real.

**Four areas**:
1. Dialogue naturalness (persona voice quality)
2. Crux room visibility (live feed instead of black box)
3. App integration (deck → hand → topic → dialogue)
4. Aesthetic overhaul (match blitz/classical pages)

---

## Area 1: Dialogue Naturalness

### The Problem

The 2_14 system set a 120-character hard cap. This caused two distinct failures:

**Too curt to understand**:
```
Saylor: "Bitcoin is digital property."
Hayes: "Until correlation breaks."
```
A user who doesn't follow crypto closely has no idea what "correlation breaks" means or why it matters.

**Voice sounds generic**. All personas end up sounding like a compressed LLM answer, not like the actual person. Michael Saylor doesn't sound like Michael Saylor. He sounds like a financial chatbot doing an impression.

### What Makes Voice Authentic

Research on persona-based LLM systems (Character.AI, roleplay systems, persona chatbots) converges on a few key techniques:

**1. Speech pattern encoding — not just personality traits**

Weak persona prompt:
> "You are Michael Saylor. You believe Bitcoin is the best store of value."

Strong persona prompt:
> "You are Michael Saylor. You speak in declarative statements, never hedge. You think in centuries, not quarters. You dismiss short-term price noise without acknowledgment. When challenged, you don't defend — you zoom out further. You use: 'digital property', 'apex predator', '21 million hard cap', 'the escape velocity of capital'. You never say: 'that's a good point', 'I can see where you're coming from', 'it depends'."

The difference: speech patterns > personality labels.

**2. Few-shot voice examples in system prompt**

Character.AI's core technique: show the model how the character responds to a specific situation, so it can extrapolate the pattern.

```
How Michael Saylor responds when challenged on volatility:
- "Volatility is the price of admission. The alternative is infinite debasement."
- "BTC dropped 80% four times. Every dip was a generational buying opportunity."
- "Name a better-performing asset over 10 years. I'll wait."

How Arthur Hayes responds to Saylor's 10-year framing:
- "Cool, but what's your p&l right now? Sharpe ratio doesn't pay the rent."
- "The ten year chart includes buying at zero. That's not a strategy, that's luck."
```

**3. Forbidden phrases list**

Characters drift toward AI politeness unless you explicitly block it:

```
Never say: "That's a great point", "I understand your perspective",
"You make a valid argument", "It's worth considering", "That said..."
Never: acknowledge the question before answering
Never: use passive voice or hedge words (perhaps, might, could be)
```

**4. No hard length cap — context-sensitive length**

Different types of turns warrant different lengths:
- **Opening statement**: 3-5 sentences. Establish position with real substance.
- **Direct reply**: 2-3 sentences. Engage the specific point, don't re-explain your whole worldview.
- **Dismissal/one-liner**: 1 sentence. When the persona wouldn't dignify a point with a full response.
- **Key argument**: 4-6 sentences. When making the core claim that underpins everything.

The model decides which type of turn this is. No hard cap.

**5. Persona-specific rhetorical patterns**

Each real persona has rhetorical fingerprints:

| Persona | Pattern | Example |
|---------|---------|---------|
| Saylor | Declarative assertion → dismissal | "Bitcoin is $X. Period. Everything else is noise." |
| Hayes | Cynical observation + rhetorical question | "You're confusing a narrative with a trade. What's your exit?" |
| Schiff | Classical economics appeal + historical precedent | "Gold backed currency worked for 2,000 years. Explain what changed." |
| Mallers | Builder confidence + adoption data | "Lightning is processing X transactions. The usage is already here." |
| Taleb | Tail risk framing + epistemics challenge | "You're making probability estimates with insufficient samples. That's not analysis." |

### Research-Backed Techniques (from Character.AI, NVIDIA PersonaPlex, ACL 2025)

Three specific mechanisms worth implementing:

**Post Persona Alignment (PPA)**: Generate the response first, then do a lightweight alignment pass — retrieve the most relevant persona facts/quotes and check whether the response actually sounds like them. If it doesn't, refine. Two LLM calls per turn, but the second is cheap (Haiku). Reduces persona drift significantly in multi-turn dialogue.

**Role Chain self-questioning**: Before generating, add a "What would [persona] actually say here?" pre-prompt step. Shown to reduce hallucinated out-of-character responses. Can be folded into the main prompt as a chain-of-thought prefix rather than a separate call.

**Real corpus grounding**: Including actual quotes from a persona's writing/tweets in the system prompt outperforms synthetic descriptions alone. The existing `build-personas.ts` already scrapes X and Substack — that corpus should feed directly into the voice system prompt, not just into embeddings. Pick the 5-10 most representative quotes per persona and include them verbatim.

### What to Change in Code

**`lib/dialogue/prompts.ts`**: Rewrite `createPersonaSystemPrompt()` to include:
- Speech pattern description (not just personality)
- 3-5 actual quotes from persona's real corpus (verbatim, from their scraped data)
- 3-5 few-shot voice examples ("when challenged on X, say things like...")
- Forbidden phrases list
- Turn-type guidance (opening vs. reply vs. dismissal)
- Role Chain prefix: "Before responding, consider: what would [persona] genuinely say here given their beliefs and style?"

**`lib/dialogue/agent.ts`**: Remove the 120-char cap. Let the model generate naturally. (PPA alignment pass deferred — try prompt improvements first.)

**`lib/dialogue/types.ts`**: Add `turnType: 'opening' | 'reply' | 'challenge' | 'dismissal'` to `DialogueMessage` so the UI can display length expectations and the model knows what register to use.

**`lib/dialogue/orchestrator.ts`**: Pass `turnType` context when generating turns. Opening turns for a persona happen once; after that, all turns are replies, challenges, or dismissals.

**`data/seed/[persona]/`**: Add a `voice.json` per persona (separate from the contract — keeps debate data and voice data distinct):
```json
{
  "speechPatterns": ["declarative assertions", "no hedging", "zooms out when challenged"],
  "vocabulary": ["digital property", "21 million", "apex predator", "stack sats"],
  "forbiddenPhrases": ["that's a good point", "I understand", "it depends"],
  "realQuotes": [
    "Bitcoin is digital property. Buy it, hold it, never sell it.",
    "There is no second best."
  ],
  "voiceExamples": [
    { "context": "challenged on volatility", "response": "Volatility is the price of admission." },
    { "context": "asked about short-term price", "response": "Zoom out. This is a decade-by-decade asset." }
  ],
  "rhetoricalPattern": "declarative assertion followed by dismissal of alternative"
}
```

---

## Area 2: Crux Room Visibility

### The Problem

Crux rooms currently run as a black box. The UI shows "Crux room spawned" and then eventually a crux card appears. Users miss the actual intellectual work — the steelman exchange, the diagnosis, the falsifier negotiation.

This is the most interesting part of the system and it's hidden.

### What to Build

Stream crux room messages to the frontend in real-time, displayed in an IDE-style bottom drawer.

**New SSE event** (one, not two — no phases in the redesigned crux room):
```typescript
'crux_room_message'   // Each turn as it generates inside the crux room
```

**Bottom drawer behavior**:
- Collapsed by default (just a tab bar at the bottom)
- Each active crux room = one tab with a pulsing dot while active
- Click tab → panel slides up to ~40% viewport height
- Shows the crux room conversation as it streams, in real-time
- Header shows: question + participant names + turn count
- Auto-scrolls as messages arrive
- When crux room completes → tab gets a card suit icon, stays accessible

**Example of what it looks like open**:
```
┌──────────────────────────────────────────────────────────────────┐
│ ♠ "Is Bitcoin a risk asset or a long-term hedge?"  Saylor, Hayes │
│──────────────────────────────────────────────────────────────────│
│                                                                    │
│  System: Figure out why you disagree. Don't leave until you know. │
│                                                                    │
│  Hayes: You keep comparing Bitcoin to gold on a 10-year chart.   │
│  In the last 3 years it's traded like a leveraged Nasdaq ETF.    │
│                                                                    │
│  Saylor: You're measuring the wrong thing. Correlation during    │
│  liquidity crises is noise. What's the terminal value?           │
│                                                                    │
│  Hayes: So your thesis only works if you hold for a decade        │
│  and never need liquidity...  ●                                   │
└──────────────────────────────────────────────────────────────────┘
  [● Risk vs Hedge — Saylor, Hayes]  [● Intrinsic Value — Schiff, Mallers]
```

### What to Change in Code

**`lib/crux/orchestrator.ts`**: Yield SSE events for each message generated in the crux room, not just the final card.

**`lib/crux/types.ts`**: Add `CruxRoomMessage` event type for streaming individual messages.

**`components/dialogue/DialogueClient.tsx`** (or new `CruxDrawer.tsx`):
- Bottom fixed panel with tab bar
- Each tab corresponds to an active/completed crux room
- Expandable to show live message stream

**`lib/hooks/useDialogueStream.ts`**: Handle `crux_room_message` events, append to per-room message arrays.

---

## Area 3: App Integration

### The Problem

The dialogue system lives at `/dialogue` with hardcoded personas and topic. Users can't reach it through the normal app flow (SetupClient → MatchClient).

### What to Build

Add `'dialogue'` as a mode in the existing setup flow. Users go through the same deck → hand → topic steps they already know, then land on the dialogue page instead of the debate page.

**SetupClient changes**:
- Add `'dialogue'` to the `DebateMode` type alongside `'blitz'` | `'classical'` | `'graph'`
- Add mode card for "Dialogue" in the mode selection step
- The topic input step already exists — reuse it
- On submit, route to `/dialogue?personas=...&topic=...` instead of `/match`

**`app/dialogue/page.tsx` changes**:
- Read `personas` and `topic` from URL search params
- Pass to `DialogueClient` instead of hardcoded values
- Fallback: if no params, show a setup form inline

**`lib/types/index.ts`**: Add `'dialogue'` to `DebateMode`.

**Route**: `/dialogue` stays as the URL. Setup just routes there with params.

No new pages needed.

---

## Area 4: Aesthetic Overhaul

### The Problem

The dialogue UI uses `gray-*` Tailwind classes and blue accents — a completely separate design system from the blitz/classical pages which use the project's custom CSS vars (`bg-card-bg`, `text-accent`, `border-card-border`).

The crux cards use a purple gradient that violates the black/red/white mandate.

### Color System Fix

**Replace in all dialogue/crux components**:

| Current (wrong) | Replace with |
|-----------------|--------------|
| `bg-gray-950` | `bg-background` |
| `bg-gray-900` | `bg-card-bg` |
| `bg-gray-800` | `bg-surface` |
| `border-gray-700` / `border-gray-800` | `border-card-border` |
| `text-gray-100` / `text-gray-200` | `text-foreground` |
| `text-gray-400` / `text-gray-500` | `text-muted` |
| `text-blue-400` (persona names) | `text-accent` (red) |
| `bg-purple-900 via-purple-800` (crux cards) | `bg-card-bg` with red accent borders |

### Typography Fix

Match blitz page: `text-xs uppercase tracking-wider` for section labels, `font-semibold` for emphasis, Geist Sans throughout.

### Crux Card Redesign

Remove the purple playing card. Replace with a compact black/red/white card that resembles the persona cards in SetupClient.

**New crux card (small, sidebar format)**:
```
┌────────────────────────────────┐
│ ♠  K                           │  ← suit + rank in corner
│                                │
│  Is Bitcoin a risk asset       │
│  or a long-term hedge?         │
│                                │
│  Saylor  ──────────  Hayes     │
│  HEDGE              RISK       │
│                                │
│  Root: Time horizon            │
│                                │
│                            K ♠ │  ← flipped corner
└────────────────────────────────┘
```

- Black background (`bg-card-bg`)
- Red accent for border on hover/click (`border-accent`)
- White text
- Suit symbol in corner (rotated at bottom like real cards)
- Compact: `w-48` or similar, stacked in sidebar
- Click → opens a detail modal with full transcript, falsifiers, etc.

### Layout: Two-column + Bottom Drawer

Replace the three equal-column layout with:

```
┌────────────────────────────────────────────────────────┐
│  Header: Topic | Personas | Status                      │
├─────────────────────────────────────┬──────────────────┤
│                                     │  Crux Cards      │
│   MAIN CHAT  (70%)                  │  (30%)           │
│                                     │                  │
│   [Avatar] Saylor                   │  ┌────────────┐  │
│   Bitcoin has been the best         │  │ ♠ K        │  │
│   performing asset for the last     │  │ Risk vs    │  │
│   decade by any metric. Show me     │  │ Hedge      │  │
│   something that beats it.          │  │            │  │
│                                     │  │ ─────────  │  │
│   [Avatar] Hayes                    │  │ SAYLOR     │  │
│   Pick your start date carefully.   │  │ HEDGE      │  │
│   You're comparing from $0.01.      │  │ ─────────  │  │
│   What's the 3-year sharpe ratio?   │  │ HAYES      │  │
│                                     │  │ RISK       │  │
│   [Avatar] Schiff                   │  └────────────┘  │
│   Gold has held value for 5,000     │                  │
│   years without requiring           │  ┌────────────┐  │
│   electricity or a password.        │  │ ♦ Q        │  │
│   That's not a narrative.           │  │ Intrinsic  │  │
│                                     │  │ Value      │  │
│                                     │  └────────────┘  │
├─────────────────────────────────────┴──────────────────┤
│  [● Risk vs Hedge – Saylor, Hayes]  [● Intrinsic Value] │  ← drawer tabs
└────────────────────────────────────────────────────────┘
```

When a drawer tab is clicked, it expands upward (~35-40% viewport height) pushing the chat up:

```
├──────────────────────────────────────────────────────────┤
│ ♠ Risk vs Hedge?   STEELMAN ●──── DIAGNOSIS ──── RESOL   │
│──────────────────────────────────────────────────────────│
│ System: Steelman each other first.                       │
│                                                          │
│ Hayes: Saylor believes Bitcoin is digital property —    │
│ a fixed-supply, censorship-resistant asset that gains   │
│ value as fiat money loses purchasing power over decades. │
│                                                          │
│ Saylor: ✓ Accurate.                             ▼ close │
├──────────────────────────────────────────────────────────┤
│  [● Risk vs Hedge – Saylor, Hayes (STEELMAN)]            │
└──────────────────────────────────────────────────────────┘
```

### Message Thread

Replace the nested-reply visual tree with something simpler: show `@[Name]` inline in the message content when replying. The nested indentation makes the chat feel like a forum, not a conversation.

```
[Saylor]  2s ago
Bitcoin has been the best performing asset for the last decade. Name one that's better.

[Hayes]  4s ago  @Saylor
Pick your start date carefully. You're comparing from zero. What's the 3-year sharpe?

[Schiff]  6s ago
Gold has held value for 5,000 years without electricity or a password.

[Hayes]  8s ago  @Schiff
Gold also didn't produce any returns. Inflation-adjusted, you broke even.
```

---

## Area 5: Crux Room Redesign — Personas Diagnose Themselves

### The Problem

The crux room is a pipeline of isolated LLM calls. Personas never actually talk to each other inside it:

1. Each persona independently states their position
2. Each persona independently steelmans the other (monologues, no exchange)
3. An **anonymous external Sonnet call** diagnoses the disagreement type — the personas play no part
4. Each persona independently states their falsifier
5. An **anonymous external Sonnet call** decides if it's resolved

There's even a `cruxArgumentPrompt()` function written in `lib/crux/prompts.ts` with combative back-and-forth dialogue — but it's never called anywhere. The crux room currently has no actual debate.

### The Fix: Personas Diagnose Themselves

The crux is discovered by the personas through conversation. No external LLM calls for diagnosis or moderation.

**Design principle**: When personas enter a crux room, they know two things:
1. What they're disagreeing on
2. They cannot leave until they've surfaced WHY — either they agree, or they've both committed to the specific thing they can't resolve

The system prompt tells them this directly:

```
You're in a crux room with [Persona B].

You disagree on: "[question]"

Your goal: figure out WHY you disagree. Don't leave until you know.

Ask yourself:
- Are you using the same timeframe? (1 year vs 10 years)
- Are you using the same data? (or different sources?)
- Do you define the key terms the same way?
- Is the disagreement about facts, or about what you value?

When you think you've found the core of it, say so:
"I think the real disagreement is..."

The room ends when both of you can state the crux and agree that's what it is —
even if you still disagree on the answer.
```

**How the crux room runs:**

1. **Entry** — each persona makes a short opening statement of their position (1-3 sentences)
2. **Free exchange** — persona turns alternate, each responding to what the other just said. No phases, no prompts, just the goal: find the why.
3. **Exit check after every turn** — after each exchange (both personas have spoken), a lightweight Haiku call checks: "Has the crux been surfaced? Have both personas either reached agreement or clearly articulated why they can't agree?" Returns yes/no. If yes, exit. If no, continue.
4. **Safety cap** — max 20 turns to prevent runaway loops. If cap reached without surfacing, extract from whatever was said.
5. **Card extraction** — one final Sonnet call reads the full conversation and extracts: the crux statement, each persona's position, the disagreement type, and falsifiers. This replaces all the separate phase calls.

The room runs as long as the argument needs. Short if they converge quickly. Longer if it takes several rounds to expose the real disagreement.

**What the crux room conversation looks like:**

```
System: You disagree on "Is Bitcoin a risk asset or a long-term hedge?"
        Figure out why. You can leave when you both know what the real disagreement is.

Hayes: You keep comparing Bitcoin to gold on a 10-year chart. In the last
       3 years it's traded like a leveraged Nasdaq ETF. That's the data.

Saylor: You're measuring the wrong thing. Correlation during liquidity crises
        is noise. The question is: what's the terminal value? Gold answered
        that after 2,000 years. Bitcoin is 15 years in.

Hayes: So your thesis only works if you hold for a decade minimum and never
       need liquidity. That's not most investors.

Saylor: Correct. This is a savings technology, not a trading vehicle.
        If your horizon is 18 months you're using the wrong instrument.

Hayes: Okay — I think the real disagreement is time horizon. You're optimizing
       for 10+ years. I'm talking about how it actually behaves as a portfolio
       asset for most people who can't lock up capital indefinitely.

Saylor: That's accurate. And my answer is: most people have the wrong horizon.
        That's the crux — we disagree on what the relevant planning window is.

System: Crux identified.
```

**Card extraction**: One Sonnet call at the end reads the full conversation and extracts:
- The crux statement (the core disagreement as it emerged from the conversation)
- Each persona's position and reasoning (from their statements)
- The disagreement type (horizon / evidence / values / definition / claim)
- Falsifiers (ask each persona one final question after the conversation if not already stated)

### What to Change in Code

**`lib/crux/orchestrator.ts`**: Replace the 5-phase pipeline with a conversation loop:
- Entry statements (one turn each)
- Free exchange loop (alternate turns, respond to prior message)
- Crux proposal detection (watch for "the real disagreement is..." pattern)
- Exit when crux confirmed or turn limit hit
- Pass full conversation to card generator

**`lib/crux/prompts.ts`**: Replace the existing phase prompts with two new ones:
- `cruxRoomSystemPrompt(question, opponentName)` — the goal-setting prompt above
- `cruxTurnPrompt(question, opponentName, lastMessage, conversationHistory)` — respond to what was just said, keep pushing toward the why

**`lib/crux/card-generator.ts`**: Extract card data from conversation transcript rather than from phase outputs.

**Delete**: The separate `steelman.ts`, `diagnosis.ts` modules. Their logic is replaced by the conversation itself. The steelman now happens naturally — you can't argue well against someone you don't understand. The diagnosis is what the personas say out loud.

---

## Area 6: Crux Room Triggering — Require Persistence

### The Problem

Current `shouldSpawnCruxRoom` is two conditions:

```typescript
return candidate.personas.length >= 2 && candidate.confidence >= 0.7
```

And detection runs every 3 messages on a 6-message sliding window with a single Haiku call. Problems:

1. **No topic stability**: A one-off disagreement that resolves in the next message can still trigger a room
2. **No persistence tracking**: Each detection window is independent — no memory of what was detected before
3. **No dedup**: Same two personas disagreeing on the same topic can spawn multiple rooms simultaneously
4. **No commitment check**: Haiku infers "disagreement" from tone/phrasing, not from each persona having actually stated a clear opposing position
5. **Too small a window**: 6 messages can easily capture personas talking past each other rather than a real argument

**Over-triggering consequences**: Crux rooms spawn on minor quibbles, personas get pulled out of dialogue before the argument matures, multiple rooms run on the same topic, users see five crux cards about variants of the same thing.

### The Fix: Staged Commitment Model

A crux room only spawns when a disagreement has demonstrated **persistence** (same topic, multiple windows) and **commitment** (both personas have staked a clear position).

**Two-stage detection:**

**Stage 1 — Track candidates**: Every 3 messages, run detection as now. But instead of spawning immediately, record a `DisagreementCandidate` with a `seenCount` and `firstSeenAt`. A candidate is identified by `(personaA, personaB, normalizedTopic)`.

**Stage 2 — Spawn gate**: Only spawn when a candidate passes **all** of these:

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| `seenCount` | ≥ 3 consecutive windows | Topic stability — same argument across 9+ messages |
| `confidence` | ≥ 0.8 (raised from 0.7) | Reduce noise |
| No existing room for this pair | Check active rooms | Dedup |
| Cooldown since last room | ≥ 5 minutes | Prevent re-spawning after a room completes |

Note: no separate "both personas still active" check — if the argument has drifted and they've stopped engaging, Haiku will stop flagging them as disagreeing, `seenCount` stops incrementing, and the spawn threshold is never reached. The persistence requirement handles this implicitly.

**Candidate normalization**: Use the topic string directly as the key. Accept that slightly different phrasings won't always merge — imperfect dedup is fine. Don't add an LLM call for normalization.

### What to Change in Code

**`lib/dialogue/disagreement-detector.ts`**: Add `CandidateRegistry` — an in-memory map from `(personaA, personaB, topic)` → `{ seenCount, firstSeenAt, lastSeenAt, confidence }`. Update on each detection pass instead of returning a candidate directly.

**`shouldSpawnCruxRoom()`**: Replace with a function that checks the full gate conditions against the registry.

**`lib/dialogue/orchestrator.ts`**: Pass the registry between detection calls. Add room dedup check before spawning. After a room completes for a pair, record a cooldown.

**Window size**: Increase from last 6 to last 10 messages for detection.

**Detection frequency**: Keep every 3 messages, but now it feeds the registry instead of directly spawning.

---

## What We're NOT Building

❌ **Crux card challenges** — personas reacting to crux cards and spawning new rooms. Still deferred.

❌ **Attention-based turn taking** — still using round-robin. Voice quality is the bottleneck, not turn selection.

❌ **Coalition detection** — deferred.

❌ **Retrieval augmentation** — using contract files, not vector search.

---

## Implementation Order

```
Area 1 (Voice)           → No dependencies. Start here.
Area 4 (Aesthetic)       → No dependencies. Run in parallel with Area 1.
Area 6 (Triggering)      → No dependencies. Run in parallel with Area 1 + 4.
Area 5 (Crux Room)       → No dependencies on other areas (internal to crux/).
Area 2 (Crux Visibility) → Needs Area 5 (new crux room format has messages to stream).
Area 3 (Integration)     → Needs Area 4 (aesthetic) so the page looks right from setup.
```

**Recommended order**: Area 1 + Area 4 + Area 6 in parallel → Area 5 → Area 2 → Area 3.

---

## Success Criteria

After this pass, the system should feel like:

✅ **Saylor sounds like Saylor** — not a crypto chatbot. Someone unfamiliar with him reads a message and gets his worldview.

✅ **Dialogue is readable without domain knowledge** — a non-expert can follow the argument.

✅ **Crux rooms feel like real arguments** — the personas actually push back on each other, narrow in on the why, and name it themselves.

✅ **Crux rooms don't spam** — rooms only spawn when a real argument has been going for several turns with clear positions on both sides.

✅ **The page looks like it belongs** — same colors, typography, and card language as the rest of the app.

✅ **You reach it through the normal setup flow** — pick your deck, your hand, your topic, then watch.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Message length** | No hard cap, context-sensitive | Hard cap was the root cause of curt, generic voice |
| **Voice technique** | Speech patterns + few-shot examples + forbidden phrases | Character.AI / persona systems approach |
| **Crux room structure** | Conversation loop, no phases | Personas diagnose themselves — no external LLM arbiter |
| **Crux room exit condition** | Personas name the crux themselves | Crux must be stated by the people in the room |
| **Crux diagnosis** | Extracted from conversation, not separate call | More authentic, cheaper, naturally grounded |
| **Triggering gate** | 3 consecutive detection windows + commitment check | Prevents one-off quibbles from spawning rooms |
| **Topic dedup** | Registry keyed on (personaA, personaB, topic) | No duplicate rooms on same argument |
| **Crux room display** | Bottom drawer tabs (IDE-style) | Keeps main chat dominant; crux is secondary, accessible |
| **Crux card size** | Small sidebar cards, click to expand | Cards as scoreboard, not primary content |
| **Reply display** | @mention inline, no nesting | Nesting felt like forum, not chat |
| **Integration** | Reuse SetupClient, add dialogue mode | Don't build new setup pages; extend existing flow |
| **Theme** | Port all dialog UI to existing CSS vars | One color system, not three |
