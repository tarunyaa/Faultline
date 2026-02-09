# Faultline MVP - Grounded Build Plan

## Goal
Build a working persona corpus + grounding system where Elon Musk, Sam Altman, and Jensen Huang debate with citations from real public material, attempting to convince each other, and revealing testable flip conditions.

## Core Philosophy
**This is NOT a "clone" system.** It's a **three-layer grounding system**:
1. **Identity** (style + stance) → persona `.md` files
2. **Grounding** (receipts) → evidence store with attributable excerpts
3. **Update** (freshness + tools) → mocked for MVP, hooks ready

## MVP Scope

### ✅ In Scope
- Evidence store (100 anchor quotes per persona, JSON + simple vector search)
- Profile builder (generate `.md` files from evidence)
- 3 personas: Elon, Sam, Jensen (grounded in real material)
- Debate with **citations required**
- 3 rounds of debate
- Flip condition detection (testable + specific)
- Mock tool system (hooks ready)
- Dark, clean roundtable UI with streaming
- Localhost deployment

### ❌ Out of Scope (Post-MVP)
- Real API integrations (price, news, X)
- User authentication
- Persistent storage / DB
- Multiple debate sessions
- Custom personas
- Advanced visualizations
- Long-term persona memory
- Deployment to Vercel

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS (dark theme)
- **LLM**: Anthropic Claude Sonnet
- **Vector Search**: Simple cosine similarity (in-memory)
- **Embeddings**: Voyage AI or OpenAI (for evidence store)
- **Language**: TypeScript
- **State**: In-memory (no DB)

## Build Plan (Adjusted for Grounding System)

### Phase 0: Setup (10 min)
**Tasks:**
1. ✅ Create Next.js project
2. ✅ Install dependencies: `@anthropic-ai/sdk`, `voyageai` (or `openai` for embeddings)
3. ✅ Set up `.env.local` with API keys
4. ✅ Configure Tailwind dark theme
5. ✅ Create directory structure

```bash
npx create-next-app@latest faultline --typescript --tailwind --app
cd faultline
npm install @anthropic-ai/sdk voyageai
```

**Files to create:**
- `.env.local`
- `tailwind.config.ts`

---

### Phase 1: Evidence Store (40 min)
**This is the foundation. Without evidence, everything else is just vibes.**

#### Step 1a: Curate Raw Sources (20 min)
**Manual curation** (you'll do this part):

For each persona, create a text file with ~30-50 curated excerpts:

**Format:**
```
---
source: twitter
url: https://twitter.com/elonmusk/status/...
date: 2024-12-15
---
We need to make life multiplanetary. The longer we take, the higher the risk of a civilization-ending event.

---
source: podcast
url: https://lexfridman.com/elon-musk-3
date: 2024-10-20
---
I think AI will be smarter than any human by 2026, maybe sooner. The question is how to make it safe.
```

**Where to find sources:**
- **Elon**: Twitter/X (search recent posts), Lex Fridman podcasts, All-In appearances
- **Sam**: blog.samaltman.com, Twitter, OpenAI blog, podcasts
- **Jensen**: GTC keynote transcripts (YouTube auto-captions), earnings calls, Twitter

**Target**: 30-50 excerpts per persona (enough for MVP, can expand later)

**Files to create:**
- `data/sources/elon-raw.txt`
- `data/sources/sam-raw.txt`
- `data/sources/jensen-raw.txt`

#### Step 1b: Build Evidence Store (20 min)
**Auto-generate from raw sources:**

**Files to create:**
- `lib/types.ts` - TypeScript interfaces
- `lib/evidence-store.ts` - Evidence store class
- `scripts/build-evidence.ts` - Script to process raw sources
- `data/evidence/elon.json` (generated)
- `data/evidence/sam.json` (generated)
- `data/evidence/jensen.json` (generated)

**Implementation:**
```typescript
// lib/types.ts
export interface PersonaEvidence {
  id: string;
  persona: 'elon' | 'sam' | 'jensen';
  type: 'anchor_quote' | 'signature_take';
  text: string;
  source_url: string;
  source_type: 'twitter' | 'podcast' | 'essay' | 'interview';
  date: string;
  topic_tags: string[];
  confidence: 'high' | 'medium' | 'low';
  embedding: number[];
}

// scripts/build-evidence.ts
import fs from 'fs';
import { VoyageAIClient } from 'voyageai';

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

async function buildEvidenceStore(persona: string) {
  const raw = fs.readFileSync(`data/sources/${persona}-raw.txt`, 'utf-8');

  // Parse raw file (split by ---)
  const excerpts = parseRawFile(raw);

  // Generate embeddings
  const texts = excerpts.map(e => e.text);
  const embeddingsResponse = await voyage.embed({
    input: texts,
    model: 'voyage-3',
  });

  // Build evidence objects
  const evidence: PersonaEvidence[] = excerpts.map((excerpt, i) => ({
    id: `${persona}-${i}`,
    persona: persona as any,
    type: 'anchor_quote',
    text: excerpt.text,
    source_url: excerpt.url,
    source_type: excerpt.source,
    date: excerpt.date,
    topic_tags: extractTopics(excerpt.text), // simple keyword extraction
    confidence: 'high',
    embedding: embeddingsResponse.data[i].embedding,
  }));

  // Save to JSON
  fs.writeFileSync(
    `data/evidence/${persona}.json`,
    JSON.stringify(evidence, null, 2)
  );

  console.log(`✅ Built evidence store for ${persona}: ${evidence.length} excerpts`);
}

// Run for all personas
['elon', 'sam', 'jensen'].forEach(buildEvidenceStore);
```

**Run it:**
```bash
tsx scripts/build-evidence.ts
```

---

### Phase 2: Persona Profiles (30 min)

#### Step 2a: Profile Builder Script (15 min)
**Auto-generate `.md` files from evidence store:**

**Files to create:**
- `scripts/generate-profiles.ts`
- `personas/elon/*.md` (generated)
- `personas/sam/*.md` (generated)
- `personas/jensen/*.md` (generated)

**Implementation:**
```typescript
// scripts/generate-profiles.ts
import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'fs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateProfile(persona: string) {
  const evidence = JSON.parse(
    fs.readFileSync(`data/evidence/${persona}.json`, 'utf-8')
  );

  const prompt = `
You are analyzing ${evidence.length} excerpts from ${persona}'s public statements.

Evidence:
${evidence.map(e => `[${e.date}] "${e.text}"\nSource: ${e.source_url}`).join('\n\n')}

Generate 7 structured markdown files for this persona. Use ONLY patterns visible in the evidence.

Output format:
===PERSONALITY===
[content for personality.md]

===EPISTEMOLOGY===
[content for epistemology.md]

===BIAS===
[content for bias.md]

===STAKES===
[content for stakes.md]

===TIME_HORIZON===
[content for time_horizon.md]

===FLIP_CONDITIONS===
[content for flip_conditions.md]

===RULES===
[content for rules.md - MUST include: "You are trying to WIN and CONVERT others"]

Make them structured, concise, and evidence-based.
`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0].text;

  // Parse and save
  const files = parseProfileResponse(content);

  fs.mkdirSync(`personas/${persona}`, { recursive: true });

  Object.entries(files).forEach(([name, content]) => {
    fs.writeFileSync(`personas/${persona}/${name}.md`, content);
  });

  console.log(`✅ Generated profile for ${persona}`);
}

['elon', 'sam', 'jensen'].forEach(generateProfile);
```

#### Step 2b: Manual Review (15 min)
Review generated files, fix any issues, ensure quality.

---

### Phase 3: Evidence Retrieval System (20 min)

**Files to create:**
- `lib/evidence-store.ts` (runtime retrieval)

**Implementation:**
```typescript
// lib/evidence-store.ts
import fs from 'fs';
import { VoyageAIClient } from 'voyageai';

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

export class EvidenceStore {
  private evidence: Map<string, PersonaEvidence[]> = new Map();

  constructor() {
    // Load evidence for all personas
    ['elon', 'sam', 'jensen'].forEach(persona => {
      const data = JSON.parse(
        fs.readFileSync(`data/evidence/${persona}.json`, 'utf-8')
      );
      this.evidence.set(persona, data);
    });
  }

  async retrieve(
    query: string,
    persona: string,
    topK: number = 10
  ): Promise<PersonaEvidence[]> {
    const personaEvidence = this.evidence.get(persona) || [];

    // Generate query embedding
    const queryEmbedding = await voyage.embed({
      input: [query],
      model: 'voyage-3',
    });

    // Compute cosine similarity
    const scored = personaEvidence.map(e => ({
      evidence: e,
      score: this.cosineSimilarity(
        queryEmbedding.data[0].embedding,
        e.embedding
      ),
    }));

    // Sort and return top K
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.evidence);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// Singleton instance
export const evidenceStore = new EvidenceStore();
```

---

### Phase 4: Debate Orchestrator with Grounding (30 min)

**Files to create:**
- `lib/orchestrator.ts`
- `lib/anthropic.ts`

**Key difference from original plan:** System prompts now include **grounding evidence**.

**Implementation:**
```typescript
// lib/orchestrator.ts
import { evidenceStore } from './evidence-store';
import { buildSystemPrompt, callAgent } from './anthropic';

export async function* runDebate(topic: string) {
  const state = {
    topic,
    round: 0,
    messages: [],
    flipConditions: [],
  };

  for (let round = 0; round < 3; round++) {
    for (const agent of ['elon', 'sam', 'jensen']) {
      yield { type: 'message_start', agent };

      // 1. Retrieve relevant evidence for this agent
      const currentContext = formatDebateForRetrieval(state);
      const relevantEvidence = await evidenceStore.retrieve(
        currentContext,
        agent,
        10
      );

      // 2. Build system prompt with evidence
      const systemPrompt = buildSystemPrompt(agent, {
        relevantEvidence,
        roomState: state,
      });

      // 3. Get agent response
      const response = await callAgent(agent, state.messages, systemPrompt);

      let fullText = '';
      for await (const chunk of response) {
        if (chunk.type === 'content_block_delta') {
          fullText += chunk.delta.text;
          yield { type: 'message_chunk', agent, chunk: chunk.delta.text };
        }
      }

      // 4. Extract flip condition
      const flipCondition = extractFlipCondition(fullText, agent);
      if (flipCondition) {
        state.flipConditions.push(flipCondition);
        yield { type: 'flip_condition', data: flipCondition };
      }

      // 5. Add to history
      state.messages.push({ role: 'assistant', content: fullText, agent });
    }

    state.round++;
  }

  yield { type: 'complete' };
}

function buildSystemPrompt(agent: string, context: any): string {
  const personaFiles = loadPersonaFiles(agent);

  return `
You are debating as ${agent}. You are trying to WIN and CONVERT the others.

${personaFiles.personality}
${personaFiles.rules}
${personaFiles.epistemology}
${personaFiles.bias}
${personaFiles.stakes}
${personaFiles.time_horizon}

---

GROUNDING EVIDENCE (your past public statements):
${context.relevantEvidence.map((e, i) => `
[${i}] "${e.text}"
Source: ${e.source_url} (${e.date})
`).join('\n')}

You MUST cite these using [0], [1], etc. or clearly label extrapolation.

---

DEBATE RULES:
1. You are trying to WIN and CONVERT others
2. CITE your sources: Use [0], [1] to reference evidence above
3. When someone disagrees after 3 attempts, ask: "What evidence would change your mind?"
4. When you can't be convinced, state: "FLIP_CONDITION: I would change my mind if [specific, testable evidence]"
5. Be true to your character

Topic: ${context.roomState.topic}
Round: ${context.roomState.round}
`;
}
```

---

### Phase 5: API Route (15 min)

**Files to create:**
- `app/api/debate/route.ts`

**Implementation:**
```typescript
// app/api/debate/route.ts
import { runDebate } from '@/lib/orchestrator';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic') || 'AI Safety';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of runDebate(topic)) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
```

---

### Phase 6: UI Components (30 min)

**Same as before, but with citation display:**

**Files to create:**
- `app/page.tsx` - Landing page
- `app/debate/page.tsx` - Debate page
- `components/DebateRoom.tsx` - Main debate UI
- `components/PersonaColumn.tsx` - Individual persona
- `components/FlipConditionTracker.tsx` - Bottom panel

**Key addition:** Display citations inline (e.g., `[0]`, `[1]`).

**Example:**
```tsx
// components/PersonaColumn.tsx
function formatMessageWithCitations(text: string) {
  // Replace [0], [1] with superscript links
  return text.replace(/\[(\d+)\]/g, '<sup>[$1]</sup>');
}
```

---

### Phase 7: Testing & Polish (15 min)

1. ✅ Run evidence store builder
2. ✅ Run profile generator
3. ✅ Test debate with sample topic
4. ✅ Verify citations appear
5. ✅ Check flip conditions are testable
6. ✅ Polish UI

---

## Deliverables Checklist

### Evidence System
- [ ] 30-50 curated excerpts per persona (raw files)
- [ ] Evidence store built (JSON + embeddings)
- [ ] Retrieval working (test with sample query)

### Persona Profiles
- [ ] 21 `.md` files generated (7 per persona)
- [ ] Manual review completed
- [ ] Quality validated (evidence-based, not invented)

### Debate Engine
- [ ] Orchestrator with evidence retrieval
- [ ] System prompts include grounding evidence
- [ ] Citations enforced ([0], [1] format)
- [ ] Flip condition detection (testable format)

### UI
- [ ] Landing page with topic input
- [ ] Roundtable debate view (3 columns)
- [ ] Real-time streaming
- [ ] Citations displayed inline
- [ ] Flip conditions tracker
- [ ] Dark, clean aesthetic

### Functionality
- [ ] Enter topic → start debate
- [ ] 3 agents debate for 3 rounds
- [ ] Messages stream with citations
- [ ] Flip conditions appear (testable + specific)
- [ ] Agents try to convince each other
- [ ] Debate completes in <3 minutes

## Time Breakdown (Updated)

- **Setup**: 10 min
- **Evidence Store**: 40 min
  - Curate sources: 20 min
  - Build store: 20 min
- **Persona Profiles**: 30 min
  - Profile builder: 15 min
  - Manual review: 15 min
- **Evidence Retrieval**: 20 min
- **Debate Orchestrator**: 30 min
- **API Route**: 15 min
- **UI Components**: 30 min
- **Testing & Polish**: 15 min

**Total: 190 minutes (3 hours)**

## Critical Path

1. **Curate evidence first** (no evidence = no grounding = just vibes)
2. **Build evidence store** (with embeddings)
3. **Generate profiles** (auto-generated from evidence)
4. **Test retrieval** (make sure relevant excerpts are surfaced)
5. **Build orchestrator** (include evidence in system prompts)
6. **Build UI** (show citations)
7. **Test & validate** (are flip conditions testable?)

## Success Criteria

### Quality
✅ Agents cite real excerpts (not hallucinated)
✅ Citations are relevant to arguments
✅ Flip conditions are specific + testable
✅ Debate feels grounded, not invented

### System
✅ Evidence retrieval is fast (<500ms)
✅ Debate completes in <3 minutes
✅ UI streams smoothly

### User Value
✅ Users trust the citations
✅ Flip conditions are actionable
✅ Disagreement map is clear

## Post-MVP Improvements

1. **Evidence expansion**: 100-200 quotes per persona
2. **Better retrieval**: BM25 + vector hybrid search
3. **Real tools**: Price data, news, X API
4. **Disagreement map synthesis**: Final structured output
5. **UI polish**: Better citation tooltips, animations
6. **Verification**: Check citations against evidence store

## Notes

- **Don't skip evidence curation.** This is the foundation. Without it, you're just building a creative writing system.
- **Quality > quantity.** 30 great excerpts beats 300 mediocre ones.
- **Test retrieval early.** If the wrong evidence is surfaced, the whole debate breaks.
- **Citations are non-negotiable.** Force agents to cite or label extrapolation.
- **Flip conditions must be testable.** "I'd change my mind if AGI" is not testable. "I'd change my mind if no AGI by 2028" is testable.
