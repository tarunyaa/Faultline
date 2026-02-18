# Quick Start: Dialogue + Crux System

## What Was Built

While you were at the gym, I implemented all 4 phases of the new dialogue + crux system from `docs/2_14_plan.md`.

## Start Testing Now

```bash
cd faultline
npm run dev
```

Then visit: **http://localhost:3000/dialogue**

## What You'll See

1. **Natural Chat** - Saylor, Hayes, Schiff discuss Bitcoin (1-2 sentences each)
2. **Threaded Replies** - Discord-style nested conversations
3. **Disagreement Detection** - System automatically detects when personas disagree
4. **Crux Rooms Spawn** - Background process explores WHY they disagree
5. **Crux Cards Appear** - Purple cards with root cause analysis, positions, falsifiers

## Example Flow

```
Main Chat:
  Saylor: "Bitcoin is digital property."
  Hayes: "Until correlation breaks. Levered Nasdaq trade."
  Saylor: "@Hayes - zoom out. 4-year cycles matter."

  → System detects disagreement
  → Spawns crux room (Hayes vs Saylor)

Crux Room (background):
  - Steelman phase
  - Root cause: Different time horizons
  - Falsifiers exchanged

Main Chat:
  [CRUX CARD: Risk Asset vs Hedge]
  Root Cause: Time Horizon
  Hayes (YES) - 12-18 month view
  Saylor (NO) - 10-year view
```

## Files Created

**21 new files** across 4 phases:
- `lib/dialogue/` - 6 files (natural chat engine)
- `lib/crux/` - 7 files (crux room protocol)
- `components/dialogue/` - 2 files (chat UI)
- `components/crux/` - 2 files (crux card UI)
- `app/dialogue/` - 2 files (route)
- `app/api/dialogue/` - 1 file (SSE endpoint)
- `lib/hooks/useDialogueStream.ts` - 1 file (React hook)

## Key Features

✅ Natural 1-2 sentence messages (no AI politeness)
✅ Round-robin with skip option
✅ Automatic disagreement detection (LLM-based)
✅ Steelman protocol (must understand before debating)
✅ Root cause analysis (horizon/evidence/values/etc)
✅ Falsifier exchange (what would change minds)
✅ Crux cards posted to main chat
✅ Real-time SSE streaming
✅ TypeScript + full type safety
✅ Build passing ✅

## Next Steps

1. **Test it** - Visit /dialogue and watch the magic
2. **Tune thresholds** - Adjust detection sensitivity if needed
3. **Add personas** - Edit `app/dialogue/page.tsx`
4. **Polish UI** - Colors, animations, mobile

## Documentation

- **Master Plan:** `docs/2_14_plan.md`
- **Full Summary:** `docs/implementation-summary-feb14.md`
- **This File:** Quick reference

## Architecture

```
/dialogue
  ↓
Dialogue Orchestrator (round-robin chat)
  ↓
Disagreement Detector (every 3 messages)
  ↓
Crux Room Spawner (if confidence > 0.7)
  ↓
Crux Orchestrator (5-phase protocol)
  ↓
Crux Card Generator
  ↓
Posted back to main chat
```

---

**Status:** 🟢 All phases complete, build passing, ready to test!
