# Evidence Store - Implementation Guide

## ✅ What's Been Added

The evidence store is now **fully integrated** into Faultline. Agents can now cite real excerpts from public material instead of hallucinating positions.

## 📁 File Structure

```
faultline/
├── data/
│   ├── sources/          # Raw source files (you edit these)
│   │   ├── elon-raw.txt
│   │   ├── sam-raw.txt
│   │   └── jensen-raw.txt
│   └── evidence/         # Generated JSON (auto-built from sources)
│       ├── elon.json
│       ├── sam.json
│       └── jensen.json
├── lib/
│   ├── evidence-store.ts # Retrieval system
│   └── types.ts          # PersonaEvidence interface
└── scripts/
    └── build-evidence.ts # Convert raw → JSON
```

## 🎯 Current State

**Status:** MVP-ready with sample data

- **5 excerpts per persona** (Elon, Sam, Jensen)
- **Keyword-based retrieval** (no vector search needed for MVP)
- **Citation system** instructed in prompts
- **Integrated** into debate orchestrator

## 🔨 How It Works

### 1. Evidence is retrieved per turn
```typescript
// In orchestrator.ts
const context = `${topic}\n\n${conversationHistory}`;
const relevantEvidence = evidenceStore.retrieve(agent, context, 5);
```

### 2. Evidence is included in system prompt
```
## GROUNDING EVIDENCE (Your Past Public Statements)

[0] "AI will probably be smarter than any single human next year..."
[Source: twitter, 2024-03-15]

[1] "The biggest risk with AI is not that it will be evil..."
[Source: podcast, 2024-01-20]

When you use these, cite inline like:
"As I've said [Source: twitter, 2024-03-15], AGI is coming sooner than most think."
```

### 3. Agents cite sources in responses
```
Elon: "Look, [Source: twitter, 2024-03-15] I've been saying AI will be smarter than humans
by next year. The exponential curve is clear."
```

## 📝 Adding More Evidence

**Goal:** 30-50 excerpts per persona for strong grounding

### Step 1: Edit raw source files

Open `data/sources/elon-raw.txt` (or sam/jensen) and add excerpts:

```
---
source: twitter
url: https://twitter.com/elonmusk/status/1234567890
date: 2024-03-20
tags: Mars, SpaceX, timeline
---
Mars is essential. We need to establish a self-sustaining city there within 20 years.

---
source: podcast
url: https://lexfridman.com/elon-musk-5
date: 2024-02-10
tags: AI safety, regulation
---
The biggest mistake would be over-regulating AI before we even know what we're regulating.
```

**Format rules:**
- Separate each excerpt with `---`
- Include: source, url, date, tags
- Text goes AFTER the second `---`
- Keep excerpts focused (1-3 sentences)

### Step 2: Rebuild evidence store

```bash
npx tsx scripts/build-evidence.ts
```

This generates updated JSON files in `data/evidence/`.

### Step 3: Restart dev server

Evidence is loaded on startup, so restart to pick up changes:
```bash
# Kill current server
# Restart: npm run dev
```

## 🎨 Where to Find Source Material

### Elon Musk
- **Twitter/X:** Search recent posts (2023-2024)
- **Podcasts:** Lex Fridman (#1-4), All-In, Joe Rogan
- **Essays:** Tesla Master Plans, SpaceX updates
- **Transcripts:** Earnings calls, keynotes

### Sam Altman
- **Blog:** blog.samaltman.com (essays)
- **Twitter:** @sama
- **Interviews:** Lex Fridman, tech media
- **OpenAI:** Blog posts he's authored

### Jensen Huang
- **Keynotes:** GTC conference transcripts
- **Earnings calls:** NVIDIA quarterly reports
- **Interviews:** Tech media, conference panels
- **Twitter:** @nvidia announcements

## 🧪 Testing the Evidence Store

### 1. Start a debate on an AI topic
Navigate to `http://localhost:3000` and enter:
- "Is AGI coming by 2026?"
- "Should AI be regulated?"
- "Will scaling laws continue?"

### 2. Watch for citations
Agents should reference sources like:
```
[Source: twitter, 2024-03-15]
[Source: podcast, 2024-01-20]
```

### 3. Check relevance
- Are the retrieved excerpts relevant to the debate topic?
- Do citations strengthen the argument?
- Are agents staying grounded vs hallucinating?

## 📊 Current Evidence Sample

**Elon (5 excerpts):**
- AI timeline predictions
- First principles thinking
- Mars colonization
- AI safety concerns

**Sam (5 excerpts):**
- AGI transformation
- Scaling hypothesis
- AI regulation stance
- Optimism about building safe AI

**Jensen (5 excerpts):**
- Accelerated computing
- AI infrastructure demand
- Moore's Law replacement
- GPU scaling for AI

## 🚀 Next Steps

### Immediate (to strengthen grounding):
1. **Add 25-45 more excerpts** per persona
   - Focus on diverse topics (AI, business, tech, regulation)
   - Include recent material (2023-2024)
   - Mix sources (tweets, podcasts, essays)

2. **Test retrieval quality**
   - Run debates on various topics
   - Check if relevant excerpts are surfaced
   - Adjust keyword extraction if needed

### Later (optional enhancements):
3. **Add vector search**
   - Install Voyage AI or OpenAI SDK
   - Generate embeddings in build-evidence.ts
   - Update evidence-store.ts to use semantic search

4. **Enforce citations**
   - Post-process responses to verify claims have sources
   - Highlight uncited statements in UI
   - Track citation rate as quality metric

5. **Expand personas**
   - Add more voices (Marc Andreessen, Yann LeCun, etc.)
   - Build evidence stores for new personas
   - Auto-generate profiles from evidence

## 💡 Pro Tips

1. **Quality over quantity:** 30 great excerpts > 100 mediocre ones
2. **Diverse topics:** Cover AI, business, tech, philosophy, regulation
3. **Recent material:** Focus on 2023-2024 for current positions
4. **Core beliefs:** Tag excerpts that represent fundamental positions
5. **Flip examples:** Include cases where they changed their mind (rare but valuable)

## 🐛 Troubleshooting

**Problem:** Evidence not showing in prompts
- Check: Are JSON files generated? (`data/evidence/*.json`)
- Check: Is evidence store loading? (see console logs)
- Fix: Rebuild with `npx tsx scripts/build-evidence.ts`

**Problem:** Citations not appearing in responses
- Check: Is relevant evidence being retrieved?
- Check: Are agents citing inline with `[Source: ...]` format?
- Fix: Adjust retrieval keywords or add more diverse excerpts

**Problem:** Wrong evidence retrieved
- Check: Do topic tags match debate topics?
- Fix: Improve tags in raw source files
- Future: Add vector search for semantic matching

## 📈 Success Metrics

Track these to measure grounding quality:

- **Citation rate:** % of agent responses with `[Source: ...]`
- **Relevance score:** Are retrieved excerpts topically relevant?
- **Grounding depth:** Are arguments backed by real positions vs invented?
- **User trust:** Do citations increase credibility?

---

**Current Status:** ✅ MVP-ready with 5 excerpts/persona
**Next Milestone:** 30-50 excerpts/persona for strong grounding
**Future Goal:** Vector search + auto-curation from live sources
