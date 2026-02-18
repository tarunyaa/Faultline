# Micro-Turn Implementation Summary

## What Changed

Implemented professional multi-agent chat patterns based on user feedback:

### 1. Micro-Turn Contract
- **Hard caps**: max 50 tokens, < 150 chars
- **One intent per turn**: AGREE/DISAGREE/ASK/CLARIFY/EVIDENCE/REFRAME
- **Controller-driven**: Turn manager assigns reply target + intent
- **Banned patterns**: "firstly", "in summary", "I think", etc.

### 2. Speech Roles (Not Essay Personas)
- Michael Saylor → "long-term maximalist who thinks in decades"
- Arthur Hayes → "trader who cuts through narratives, show me correlation"
- Brian Armstrong → "ecosystem builder, cares about adoption not price"
- Vitalik Buterin → "technical nitpicker, asks for definitions"

### 3. Turn Manager (Dialogue Controller)
- Picks who speaks next
- Assigns reply target (threading)
- Assigns intent (what they should do)
- Creates natural conversational flow

### 4. Automatic Validation
- Length check (hard reject > 150 chars)
- Pattern detection (rejects banned phrases)
- Temperature 1.0 for authentic voice

### 5. Few-Shot Tone Anchoring
- Included chat examples showing desired style
- Learns form, not content

## Files Created
- `lib/dialogue/turn-manager.ts` - Controller picks turns
- `lib/dialogue/speech-roles.ts` - Conversational roles
- `lib/dialogue/prompts.ts` - Micro-turn prompts (COMPLETELY REWRITTEN)
- `lib/dialogue/agent.ts` - Micro-turn generation (COMPLETELY REWRITTEN)

## Files To Update
- `lib/dialogue/orchestrator.ts` - Use turn manager + new agent functions

## Result
Should produce chat like:

```
Saylor: "BTC eats everything long-term."
Hayes: "Show me when correlation breaks."
Saylor: "Zoom out. 10-year view."
Armstrong: "Adoption curve matters more than price."
```

Not:

```
Saylor: "I believe that Bitcoin represents a fundamental paradigm shift in how we conceptualize value storage. Let me break this down into several key considerations..."
```
