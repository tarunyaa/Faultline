# Faultline - Implementation Plan
## Persona Corpus + Grounding System

## Overview
Building a multi-agent debate system where AI personas sound like real voices, maintain consistent beliefs, cite receipts, and update when new info hits. This is NOT a magical "clone"—it's a **three-layer grounding system** that produces believable, attributable debate.

---

## Core Architecture: Three Layers

### Layer 1: Identity Layer (style + stance)
**What it is:** The persona's "operating system"—voice, beliefs, incentives, failure modes.

**Implemented as 7 `.md` files per persona:**
1. `personality.md` - Voice patterns, rhetoric, confidence style, phrases to avoid
2. `bias.md` - Priors, blind spots, recurring failure modes
3. `stakes.md` - Incentives, holdings, ideology, affiliations, career exposure
4. `epistemology.md` - How they form beliefs (data/narrative/first principles)
5. `time_horizon.md` - Timeframe for reasoning (short/long term optimization)
6. `flip_conditions.md` - Known positions they'd change with evidence (default templates)
7. `rules.md` - Debate behavior (WIN and CONVERT, not just state views)

**Key point:** These are **structured specs**, not prose. Generated from evidence, not invented.

---

### Layer 2: Grounding Layer (receipts)
**What it is:** A searchable library of **attributable excerpts** so the agent can justify claims with citations and avoid hallucinating "what X would say."

**Implemented as:**
- **Evidence Store** (vector DB + metadata)
- Each chunk contains:
  - Text excerpt (tweet, quote, essay paragraph)
  - Source URL
  - Date
  - Topic tags
  - Confidence level
  - Context (what was this responding to?)

**Retrieval during debate:**
- Top-K relevant excerpts per turn
- Agent must either:
  - Cite the excerpt, or
  - Label as "inference/extrapolation"

**MVP data per persona:**
- 50–200 **anchor quotes** (short excerpts with attribution)
- 10–30 **signature takes** (most repeated claims/frameworks)
- 10–20 **disallowed moves** (what they never concede, dodge patterns)

**That's enough to feel real without boiling the ocean.**

---

### Layer 3: Update Layer (freshness + tools)
**What it is:** Pipeline for fetching new material and letting agents pull live data.

**Components:**
1. **Periodic refresh**: Fetch new tweets, posts, transcripts
2. **Tool access**: Agents can call:
   - Price data (stocks, crypto)
   - Filings/reports
   - Recent tweets/posts
   - Web search
   - Code inspection
3. **Update triggers**: When new evidence hits flip conditions, agents update stance

**MVP:** Tools are **mocked but hooks ready** for real integration.

---

## Data Architecture

### Evidence Store Schema

```typescript
interface PersonaEvidence {
  id: string;
  persona: 'elon' | 'sam' | 'jensen';
  type: 'anchor_quote' | 'signature_take' | 'disallowed_move';

  // Content
  text: string;
  source_url: string;
  source_type: 'twitter' | 'podcast' | 'essay' | 'interview' | 'wikipedia';
  date: string; // ISO date

  // Metadata
  topic_tags: string[]; // ['AI safety', 'regulation', 'scaling']
  confidence: 'high' | 'medium' | 'low'; // how representative is this?
  context?: string; // what was this responding to?

  // Special flags
  is_flip?: boolean; // did they change their mind here?
  is_core_belief?: boolean; // is this a fundamental position?

  // Vector embedding (for retrieval)
  embedding?: number[];
}

interface SignatureTake {
  id: string;
  persona: string;
  claim: string; // "AI will be AGI by 2027"
  framework: string; // "exponential progress + scaling laws"
  frequency: number; // how often they repeat this
  evidence_ids: string[]; // links to PersonaEvidence
}

interface DisallowedMove {
  id: string;
  persona: string;
  pattern: string; // "never concedes on timeline predictions"
  dodge_technique?: string; // "changes subject to concrete progress"
  examples: string[]; // evidence IDs
}
```

### Room State Schema

```typescript
interface RoomState {
  topic: string;
  round: number;
  messages: Message[];

  // Structured debate state
  cruxCandidates: Crux[];
  flipConditions: FlipCondition[];
  activeDisagreements: Disagreement[];

  // Persuasion tracking
  persuasionAttempts: Map<string, number>; // "elon->sam:AI_timeline" -> 2

  concluded: boolean;
}

interface Message {
  agent: string;
  content: string;
  timestamp: number;

  // Citations
  citations: Citation[];
  toolCalls?: ToolCall[];

  // Structured extracts
  statedPosition?: string;
  confidence?: number; // 0-100
  isConvincingAttempt?: boolean;
  targetAgent?: string;
}

interface Citation {
  text: string; // the excerpt used
  evidence_id: string; // links to PersonaEvidence
  inline: boolean; // did they cite inline or just use it?
}

interface Crux {
  id: string;
  agents: [string, string];
  description: string; // "time horizon on AGI timeline"
  discovered_round: number;
  resolved: boolean;
}

interface FlipCondition {
  agent: string;
  topic: string; // what specific disagreement
  position: string; // their current stance
  minimumEvidence: string; // TESTABLE condition
  threshold?: string; // "if GPU prices drop 50%"
  timeWindow?: string; // "within 12 months"
  discovered_round: number;
}

interface Disagreement {
  agents: [string, string];
  topic: string;
  persuasionAttempts: number; // 0-3
  resolved: boolean;
  becameFlipCondition: boolean;
}
```

---

## Building the Persona Corpus

### Step 1: Curate Sources (per persona)

**For each voice, collect:**

**Elon Musk:**
- Twitter/X: Selected threads on AI, SpaceX, Tesla, free speech
- Podcasts: Lex Fridman, All-In, Joe Rogan (transcripts)
- Essays/Interviews: master plan documents, earnings calls
- Wikipedia: Bio/timeline (facts only, not opinions)

**Sam Altman:**
- Twitter/X: AI safety, OpenAI announcements, policy takes
- Blog: blog.samaltman.com essays
- Podcasts: Lex Fridman, interviews
- OpenAI blog posts

**Jensen Huang:**
- Twitter/X: NVIDIA announcements, GPU/AI takes
- Keynotes: GTC transcripts (YouTube → transcript)
- Earnings calls: quarterly reports
- Interviews: tech media

**MVP target per persona:**
- 100-200 anchor quotes
- 10-30 signature takes
- 10-20 disallowed moves

**Quality over quantity:** Better 100 great excerpts than 10,000 mediocre ones.

---

### Step 2: Build Evidence Store

**Practical implementation:**

```typescript
// lib/evidence-store.ts

interface EvidenceStoreConfig {
  persona: string;
  sources: Source[];
}

interface Source {
  type: 'twitter' | 'podcast' | 'essay' | 'interview';
  url?: string;
  raw_text?: string;
  date: string;
}

class EvidenceStore {
  private evidence: PersonaEvidence[] = [];

  async addSource(source: Source, persona: string) {
    // 1. Chunk the source into excerpts
    const chunks = this.chunkSource(source);

    // 2. Generate embeddings
    const embeddings = await this.generateEmbeddings(chunks);

    // 3. Tag with topics (use LLM to extract)
    const tagged = await this.tagChunks(chunks, embeddings);

    // 4. Store
    this.evidence.push(...tagged.map(chunk => ({
      id: generateId(),
      persona,
      type: this.inferType(chunk),
      text: chunk.text,
      source_url: source.url || '',
      source_type: source.type,
      date: source.date,
      topic_tags: chunk.topics,
      confidence: chunk.confidence,
      embedding: chunk.embedding,
    })));
  }

  async retrieve(query: string, persona: string, topK: number = 5): Promise<PersonaEvidence[]> {
    // Vector similarity search
    const queryEmbedding = await this.generateEmbedding(query);

    const scored = this.evidence
      .filter(e => e.persona === persona)
      .map(e => ({
        evidence: e,
        score: this.cosineSimilarity(queryEmbedding, e.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored.map(s => s.evidence);
  }

  private chunkSource(source: Source): Chunk[] {
    // For tweets: each tweet is a chunk
    // For essays: semantic chunking (paragraphs or ~200 word chunks)
    // For transcripts: speaker turns or ~30 second segments

    if (source.type === 'twitter') {
      return this.chunkTweets(source.raw_text);
    } else if (source.type === 'essay') {
      return this.chunkEssay(source.raw_text);
    } else {
      return this.chunkTranscript(source.raw_text);
    }
  }
}
```

**Storage options:**
- **MVP**: JSON file + in-memory vector search (simple, fast to build)
- **Production**: Pinecone/Weaviate/Postgres+pgvector

---

### Step 3: Generate Profile `.md` Files

**Use a "profile builder" prompt that analyzes the evidence store and outputs structured specs.**

```typescript
// lib/profile-builder.ts

async function buildPersonaProfile(persona: string, evidenceStore: EvidenceStore) {
  // Get all evidence for this persona
  const allEvidence = await evidenceStore.getAll(persona);

  // Build profile via LLM analysis
  const profilePrompt = `
You are analyzing ${allEvidence.length} excerpts from ${persona}'s public material (tweets, essays, interviews).

Your task: Generate structured persona profile files.

Evidence excerpts:
${allEvidence.map(e => `[${e.date}] ${e.text}\nSource: ${e.source_url}`).join('\n\n')}

Generate the following files:

## personality.md
- Voice patterns (sentence structure, word choice, energy level)
- Rhetorical style (direct/diplomatic, technical/accessible)
- Confidence patterns (hedges vs certainties)
- Phrases to USE (signature expressions)
- Phrases to AVOID (out of character)

## epistemology.md
- What counts as evidence to them (data, first principles, narrative, authority)
- How they resolve contradictions
- What they dismiss as noise
- Their skepticism triggers

## bias.md
- Clear priors (what they assume without proof)
- Blind spots (what they consistently miss or downplay)
- Failure modes (when they're most wrong)
- Identity attachments (beliefs tied to self-image)

## stakes.md
- Financial incentives (holdings, company interests)
- Career exposure (reputation risks)
- Ideological commitments
- Social pressures (peer groups, public image)

## time_horizon.md
- Default planning timeframe
- When they think short-term vs long-term
- How time horizon affects their judgment

## flip_conditions.md (default templates)
- Known topics where they've updated beliefs (if any)
- Template structure for new flip conditions
- What types of evidence they historically respect

## rules.md
- Debate behavior: You are trying to WIN and CONVERT
- Argumentation patterns
- How they handle disagreement
- When they double down vs concede

IMPORTANT: Use ONLY patterns visible in the evidence. Do not invent or assume.
Format: Clear, structured markdown with bullet points and examples from the evidence.
`;

  const response = await callClaude({
    system: 'You are a persona analyst. Output structured, evidence-based profiles.',
    messages: [{ role: 'user', content: profilePrompt }],
  });

  // Parse and write files
  const profiles = parseProfileResponse(response.content);

  await writeFile(`personas/${persona}/personality.md`, profiles.personality);
  await writeFile(`personas/${persona}/epistemology.md`, profiles.epistemology);
  // ... etc

  return profiles;
}
```

**Key trick:** Store not just "what they said," but **what they changed their mind about** (rare but gold for flip-condition data).

---

## Debate Runtime Loop

### Agent Turn with Grounding

```typescript
async function getAgentResponse(
  agent: string,
  roomState: RoomState,
  evidenceStore: EvidenceStore
): Promise<AgentResponse> {

  // 1. Retrieve relevant persona evidence
  const currentContext = formatCurrentDebate(roomState);
  const relevantEvidence = await evidenceStore.retrieve(
    currentContext,
    agent,
    topK: 10
  );

  // 2. Retrieve factual evidence via tools (if needed)
  const toolResults = await maybeCallTools(agent, roomState);

  // 3. Build system prompt
  const systemPrompt = buildSystemPrompt(agent, {
    personaFiles: loadPersonaFiles(agent),
    relevantEvidence,
    toolResults,
  });

  // 4. Build message history
  const messages = formatMessagesForClaude(roomState.messages);

  // 5. Call Claude with tools
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages,
    tools: getToolsForAgent(agent),
    stream: true,
  });

  // 6. Stream response + extract structured data
  let fullText = '';
  const citations: Citation[] = [];
  let statedPosition: string | null = null;

  for await (const chunk of response) {
    if (chunk.type === 'content_block_delta') {
      const text = chunk.delta.text;
      fullText += text;

      // Stream to client
      streamToClient({ type: 'chunk', agent, text });

      // Extract citations on-the-fly
      const extractedCitations = extractCitations(text, relevantEvidence);
      citations.push(...extractedCitations);
    }
  }

  // 7. Extract structured outputs
  statedPosition = extractPosition(fullText);
  const flipCondition = extractFlipCondition(fullText, agent);
  const isConvincing = detectConvincingAttempt(fullText, roomState);

  return {
    agent,
    content: fullText,
    citations,
    statedPosition,
    flipCondition,
    isConvincing,
    toolCalls: response.tool_calls,
  };
}

function buildSystemPrompt(agent: string, context: {
  personaFiles: PersonaFiles;
  relevantEvidence: PersonaEvidence[];
  toolResults?: ToolResult[];
}): string {
  return `
You are debating as ${agent}. You are trying to WIN and CONVERT the other participants.

${context.personaFiles.personality}

${context.personaFiles.rules}

Your beliefs and reasoning style:
${context.personaFiles.epistemology}

Your biases and failure modes:
${context.personaFiles.bias}

Your stakes in this debate:
${context.personaFiles.stakes}

Your time horizon:
${context.personaFiles.time_horizon}

---

GROUNDING EVIDENCE (from your public statements):
Below are relevant excerpts from your past statements. Use these to ground your arguments.
You MUST either:
- Cite these excerpts directly, or
- Clearly label when you're extrapolating beyond what you've said publicly

${context.relevantEvidence.map((e, i) => `
[${i}] "${e.text}"
Source: ${e.source_url} (${e.date})
`).join('\n')}

${context.toolResults ? `
FRESH DATA (from tools):
${formatToolResults(context.toolResults)}
` : ''}

---

CRITICAL DEBATE RULES:
1. You are trying to WIN this debate and CONVERT the others to your position
2. When you disagree, actively try to convince with evidence and reasoning
3. CITE your sources: Use [0], [1], etc. to reference the grounding evidence above
4. Use tools to fetch fresh data when it would strengthen your argument
5. If after 3 attempts someone still disagrees, ask: "What evidence would make you change your mind?"
6. When you cannot be convinced, state the MINIMUM evidence that would change your position:
   Format: "FLIP_CONDITION: I would change my mind if [specific, testable evidence]"
7. Be true to your character—don't concede unless genuinely convinced

Current debate state:
- Topic: ${context.roomState.topic}
- Round: ${context.roomState.round}
- Flip conditions found: ${context.roomState.flipConditions.length}
`;
}
```

---

## Flip Condition Extraction

### Explicit Format (preferred)

```typescript
function extractFlipCondition(text: string, agent: string): FlipCondition | null {
  const match = text.match(/FLIP_CONDITION:\s*(.+?)(?:\n|$)/);

  if (!match) return null;

  const statement = match[1];

  // Try to extract testable threshold + time window
  const threshold = extractThreshold(statement); // "if GPU prices drop 50%"
  const timeWindow = extractTimeWindow(statement); // "within 12 months"

  return {
    agent,
    topic: inferTopic(text),
    position: extractCurrentPosition(text),
    minimumEvidence: statement,
    threshold,
    timeWindow,
    discovered_round: currentRound,
  };
}

function extractThreshold(statement: string): string | undefined {
  // Look for quantifiable conditions
  const patterns = [
    /if .* (drops?|increases?|reaches?) (\d+%|\$\d+|[\d.]+x)/i,
    /when .* (below|above|exceeds?) ([\d.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = statement.match(pattern);
    if (match) return match[0];
  }

  return undefined;
}

function extractTimeWindow(statement: string): string | undefined {
  const patterns = [
    /within (\d+ (?:days?|weeks?|months?|years?))/i,
    /by (\d{4})/i, // by 2025
    /in the next (\d+ (?:days?|weeks?|months?|years?))/i,
  ];

  for (const pattern of patterns) {
    const match = statement.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}
```

### Implicit Detection (fallback)

If agent doesn't use FLIP_CONDITION format after 3 convince attempts:

```typescript
async function extractImplicitFlipCondition(
  agent: string,
  disagreement: Disagreement,
  roomState: RoomState
): Promise<FlipCondition> {

  const prompt = `
You have been trying to convince ${disagreement.agents[1]} about ${disagreement.topic} for 3 rounds.

They are not convinced.

What is the MINIMUM, TESTABLE evidence that would make you change your position?

Be specific:
- Include thresholds (numbers, percentages, etc.)
- Include time windows if relevant
- Make it verifiable

Format: "I would change my mind if [specific evidence]"
`;

  const response = await callClaude({
    system: buildSystemPrompt(agent, roomState),
    messages: [
      ...formatMessages(roomState.messages),
      { role: 'user', content: prompt }
    ],
  });

  return {
    agent,
    topic: disagreement.topic,
    position: extractCurrentPosition(response.content),
    minimumEvidence: response.content,
    threshold: extractThreshold(response.content),
    timeWindow: extractTimeWindow(response.content),
    discovered_round: roomState.round,
  };
}
```

---

## Disagreement Map Synthesis

After debate concludes, produce final structured output:

```typescript
async function synthesizeDisagreementMap(roomState: RoomState): Promise<DisagreementMap> {
  const prompt = `
You are analyzing a completed debate between Elon Musk, Sam Altman, and Jensen Huang.

Topic: ${roomState.topic}

Full transcript:
${formatTranscript(roomState.messages)}

Flip conditions identified:
${roomState.flipConditions.map(fc =>
  `- ${fc.agent}: ${fc.minimumEvidence}${fc.threshold ? ` (${fc.threshold})` : ''}`
).join('\n')}

Your task: Generate a DISAGREEMENT MAP (not a summary, not a conclusion).

Output JSON:
{
  "crux": "The 1-2 sentence core disagreement driving the split",
  "sources_of_disagreement": [
    {
      "type": "time_horizon | assumptions | values | identity | epistemology",
      "description": "clear explanation",
      "agents_involved": ["elon", "sam"]
    }
  ],
  "flip_conditions": [
    {
      "agent": "elon",
      "position": "current stance",
      "minimum_evidence": "testable condition",
      "threshold": "specific number/metric if applicable",
      "time_window": "timeframe if applicable",
      "likelihood": "high | medium | low (estimate of this evidence appearing)"
    }
  ],
  "areas_of_agreement": [
    "things all agents agreed on (if any)"
  ],
  "unresolved": [
    "disagreements that didn't reach flip conditions"
  ]
}

IMPORTANT:
- The crux is NOT "they disagree on X"—it's WHY they disagree (different priors, time horizons, etc.)
- Flip conditions should be TESTABLE and SPECIFIC
- If a flip condition has no realistic trigger, note that
`;

  const response = await callClaude({
    system: 'You are a debate analyst. Your output is structured JSON only.',
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(response.content);
}

interface DisagreementMap {
  crux: string;
  sources_of_disagreement: {
    type: 'time_horizon' | 'assumptions' | 'values' | 'identity' | 'epistemology';
    description: string;
    agents_involved: string[];
  }[];
  flip_conditions: {
    agent: string;
    position: string;
    minimum_evidence: string;
    threshold?: string;
    time_window?: string;
    likelihood: 'high' | 'medium' | 'low';
  }[];
  areas_of_agreement: string[];
  unresolved: string[];
}
```

---

## Tool System

### Tool Definitions

```typescript
const tools = [
  {
    name: 'search_persona_history',
    description: 'Search your own past statements on a topic',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Topic or keyword to search' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_price_data',
    description: 'Get current stock/crypto price and metrics',
    input_schema: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Stock ticker or crypto symbol' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'search_recent_news',
    description: 'Search recent news/articles on a topic',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        days: { type: 'number', description: 'How many days back to search' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_twitter',
    description: 'Search recent tweets by keyword or user',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        user: { type: 'string', optional: true },
      },
      required: ['query'],
    },
  },
  {
    name: 'calculate',
    description: 'Perform calculations or run simple models',
    input_schema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression or model' },
      },
      required: ['expression'],
    },
  },
];

async function executeTool(toolName: string, params: any, agent: string): Promise<any> {
  switch (toolName) {
    case 'search_persona_history':
      return await evidenceStore.retrieve(params.query, agent, 5);

    case 'fetch_price_data':
      // TODO: integrate real API (Alpha Vantage, CoinGecko, etc.)
      return mockPriceData(params.ticker);

    case 'search_recent_news':
      // TODO: integrate news API
      return mockNewsSearch(params.query, params.days);

    case 'search_twitter':
      // TODO: integrate X API
      return mockTwitterSearch(params.query, params.user);

    case 'calculate':
      return evalSafe(params.expression);

    default:
      return { error: 'Tool not implemented' };
  }
}
```

---

## Memory System

### A) Room Memory (short-term, per debate)
**What it tracks:**
- Full transcript
- Current stance + confidence per agent
- Active cruxes
- Attempted persuasion count (your "3 tries" mechanic)
- Tool call results

**Implementation:** Just normal `RoomState` object (see schema above).

### B) Persona Memory (long-term, across debates)
**Optional at first.** If you want agents to feel consistent over weeks:

```typescript
interface PersonaState {
  persona: string;
  last_updated: string;

  // Evolving positions
  current_positions: {
    topic: string;
    stance: string;
    confidence: number;
    last_updated: string;
    supporting_evidence: string[];
  }[];

  // Debate history
  past_debates: {
    topic: string;
    date: string;
    outcome: 'won' | 'lost' | 'flip_condition';
    flip_condition?: string;
  }[];
}
```

**MVP recommendation:** Don't let personas "drift" permanently yet. Keep persona files stable + let them update *within a room*.

---

## Directory Structure (Updated)

```
faultline/
├── app/
│   ├── page.tsx
│   ├── debate/page.tsx
│   └── api/
│       ├── debate/route.ts
│       └── tools/route.ts
├── lib/
│   ├── anthropic.ts
│   ├── orchestrator.ts
│   ├── evidence-store.ts        # NEW
│   ├── profile-builder.ts       # NEW
│   ├── tools.ts
│   ├── flip-detector.ts         # NEW
│   └── types.ts
├── components/
│   ├── DebateRoom.tsx
│   ├── PersonaColumn.tsx
│   ├── FlipConditionTracker.tsx
│   └── DisagreementMap.tsx
├── personas/
│   ├── elon/
│   │   ├── personality.md
│   │   ├── bias.md
│   │   ├── stakes.md
│   │   ├── epistemology.md
│   │   ├── time_horizon.md
│   │   ├── flip_conditions.md
│   │   └── rules.md
│   ├── sam/
│   │   └── [same]
│   └── jensen/
│       └── [same]
├── data/
│   └── evidence/
│       ├── elon.json           # Evidence store
│       ├── sam.json
│       └── jensen.json
├── scripts/
│   ├── build-evidence-store.ts # Curate + chunk sources
│   └── generate-profiles.ts    # Run profile builder
└── public/
    └── avatars/
```

---

## Big Gotchas (Avoid These)

### 1. Impersonation Risk
**Problem:** Legal/ethical issues with "I am X."

**Solution:** Frame as "X-style agent grounded in public material." Never have the agent say "I am Elon Musk"—say "This agent represents Elon Musk's publicly stated positions."

### 2. Drift
**Problem:** If agents write to long-term memory too early, they slowly become caricatures.

**Solution:** Keep persona files stable. Only update via manual review of evidence store additions.

### 3. Receipts Quality
**Problem:** 10,000 mediocre excerpts = garbage in, garbage out.

**Solution:** Curate **high-signal anchors**. Better 100 great excerpts than 10,000 mediocre ones.

### 4. Hallucinated Citations
**Problem:** Agent claims to cite evidence but invents it.

**Solution:**
- Only include evidence excerpts in context
- Require `[0]`, `[1]` style citations
- Verify citations in post-processing

### 5. Tool Overuse
**Problem:** Agent calls 10 tools per turn, debate is slow.

**Solution:** Limit tool calls per turn (max 2-3). Prefer using grounding evidence first.

---

## Development Roadmap

### Week 1: MVP (Core System)
**Day 1-2: Evidence Store**
- Curate 100 anchor quotes per persona (Elon, Sam, Jensen)
- Build evidence store (JSON + simple vector search)
- Test retrieval

**Day 3-4: Persona Profiles**
- Build profile-builder prompt
- Generate 7 `.md` files per persona
- Manual review + refinement

**Day 5-7: Debate Engine**
- Orchestrator with grounding
- Citation enforcement
- Flip condition detection
- Basic UI

### Week 2: Grounding + Tools
- Improve evidence retrieval (better ranking)
- Add real tool integration (price data, news)
- Test full debates with citations
- Validate flip conditions are testable

### Week 3: Polish + Production
- Better UI/UX
- Disagreement map visualization
- Persistent storage
- Deploy

### Week 4+: Expansion
- Add more personas
- Continuous evidence updates
- User-submitted topics
- Analytics on flip conditions

---

## Success Metrics

### Quality Metrics
- **Citation rate**: % of claims backed by evidence
- **Flip condition testability**: % of flip conditions that are specific + measurable
- **Crux clarity**: Can users understand the core disagreement?
- **Debate depth**: Do agents explore multiple angles before concluding?

### System Metrics
- **Retrieval accuracy**: Are retrieved excerpts relevant?
- **Debate speed**: Does it complete in <3 minutes?
- **Tool effectiveness**: Do tool calls improve arguments?

### User Value
- **Insight generation**: Do users learn something they couldn't get from a single LLM?
- **Actionability**: Can flip conditions actually be tested?
- **Trust**: Do users trust the citations and reasoning?

---

## Next Steps

1. **Curate evidence** (100 quotes per persona)
2. **Build evidence store** (JSON + embeddings)
3. **Generate profiles** (run profile-builder)
4. **Build orchestrator** (grounding + citations)
5. **Test debate** with one topic
6. **Iterate** on flip condition quality
