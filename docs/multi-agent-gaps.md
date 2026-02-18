# Multi-Agent Architecture: Gap Analysis

**Document Analyzed**: `docs/multi-agent-architecture.md`
**Date**: 2026-02-14
**Status**: 🔍 **GAPS IDENTIFIED**

---

## Critical Gaps

### 1. Error Handling & Resilience

**Missing:**
- What happens if an agent LLM call fails mid-debate?
- What if the crystallizer LLM call fails?
- What if embedding generation fails?
- Retry logic with exponential backoff?
- Circuit breaker for failing agents?
- Fallback strategies when agents go offline?

**Impact**: Debates could crash mid-flight, losing all progress.

**Recommendation**:
```typescript
interface AgentErrorStrategy {
  maxRetries: number                    // e.g., 3
  retryDelayMs: number[]                // [1000, 2000, 4000]
  fallbackBehavior: 'SKIP' | 'PAUSE' | 'TERMINATE'
  circuitBreakerThreshold: number       // Disable agent after N failures
}
```

---

### 2. Persistence & State Recovery

**Missing:**
- Where is debate state stored? (In-memory only?)
- Can debates be paused and resumed?
- If server crashes, is all progress lost?
- How is message history persisted?
- Database schema for threads/messages/cruxes?

**Impact**: No durability, no audit trail, no ability to resume debates.

**Recommendation**:
- Add PostgreSQL schema for messages, threads, cruxes
- Checkpoint debate state every N messages
- Support `/api/debate-multi/{debateId}/resume` endpoint
- Store full debate transcript for replay

**Example Schema**:
```sql
CREATE TABLE multi_debates (
  id UUID PRIMARY KEY,
  topic TEXT,
  status TEXT,  -- ACTIVE | PAUSED | COMPLETED
  created_at TIMESTAMP,
  config JSONB
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  debate_id UUID REFERENCES multi_debates(id),
  agent_id TEXT,
  content TEXT,
  move TEXT,
  thread_id TEXT,
  reply_to TEXT,
  timestamp BIGINT,
  embedding VECTOR(1024)
);

CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  debate_id UUID REFERENCES multi_debates(id),
  topic TEXT,
  binary_question TEXT,
  status TEXT,
  crux JSONB,
  created_at BIGINT
);
```

---

### 3. Observability & Debugging

**Missing:**
- How do you debug why a thread didn't converge?
- How do you know which agent is stuck?
- What metrics are tracked?
- Logging strategy?
- Performance monitoring?

**Impact**: Black-box system, hard to diagnose failures.

**Recommendation**:

**Metrics to Track**:
```typescript
interface DebateMetrics {
  // Message flow
  messagesPerSecond: number
  messagesByAgent: Map<PersonaId, number>
  messagesByThread: Map<ThreadId, number>

  // Attention
  avgAttentionScore: number
  messagesDropped: number           // score < threshold

  // Threads
  threadsActive: number
  threadsConverged: number
  threadsStale: number
  avgMessagesUntilConvergence: number

  // Crystallization
  crystallizationAttempts: number
  crystallizationFailures: number
  cruxesExtracted: number
  cruxValidationFailures: number

  // Performance
  avgLLMLatency: number
  totalCost: number
  tokenUsage: { input: number, output: number }
}
```

**Debug Events**:
```typescript
type DebugEvent =
  | { type: 'agent_timeout', agentId: string, lastSeen: number }
  | { type: 'attention_dropped', messageId: string, score: number }
  | { type: 'thread_stale', threadId: string, lastActivity: number }
  | { type: 'crux_validation_failed', cruxId: string, failures: string[] }
  | { type: 'llm_error', agentId: string, error: string, retryCount: number }
```

---

### 4. API Contract Specification

**Missing:**
- Exact JSON schemas for all SSE events
- Request/response types for `/api/debate-multi`
- Error response format
- Event ordering guarantees
- WebSocket alternative?

**Impact**: Frontend integration is ambiguous, no contract testing.

**Recommendation**:

**Request Schema**:
```typescript
POST /api/debate-multi
{
  "topic": "Bitcoin is a good store of value",
  "personaIds": ["michael-saylor", "arthur-hayes", "nassim-taleb"],
  "config": {
    "maxDuration": 300000,        // Required
    "maxMessages": 200,           // Required
    "attentionThreshold": 0.6,    // Default: 0.6
    "maxThreads": 4,              // Default: 4
    "enableCoalitions": true      // Default: true
  }
}

Response: 200 OK + SSE stream
Response: 400 Bad Request { "error": "Invalid persona IDs", "invalid": [...] }
Response: 429 Too Many Requests { "error": "Rate limit exceeded", "retryAfter": 60 }
```

**SSE Event Schemas**:
```typescript
// Event: message_published
data: {
  "type": "message_published",
  "message": {
    "id": "msg-123",
    "agentId": "michael-saylor",
    "content": "...",
    "move": "CLAIM",
    "threadId": "thread-1",
    "timestamp": 1707879137124
  }
}

// Event: thread_converged
data: {
  "type": "thread_converged",
  "threadId": "thread-1",
  "crux": {
    "question": "...",
    "positions": {...},
    "validated": true
  }
}

// Event: coalition_detected
data: {
  "type": "coalition_detected",
  "coalition": {
    "members": ["michael-saylor", "jack-mallers"],
    "label": "Bitcoin Fundamentalists",
    "positions": {...}
  }
}

// Event: debate_error
data: {
  "type": "debate_error",
  "error": "Agent michael-saylor failed after 3 retries",
  "recoverable": false
}
```

---

### 5. Frontend State Management

**Missing:**
- How does the frontend handle out-of-order SSE events?
- How are 4 concurrent thread columns rendered?
- How is the crux map graph rendered?
- Real-time updates for agent status?
- Scroll behavior when new messages arrive?

**Impact**: Frontend implementation left to guesswork.

**Recommendation**:

**State Structure**:
```typescript
interface MultiDebateState {
  debateId: string
  topic: string
  status: 'connecting' | 'running' | 'paused' | 'completed' | 'error'

  // Messages (global, sorted by timestamp)
  messages: Message[]
  messagesByThread: Map<ThreadId, Message[]>

  // Threads
  threads: Map<ThreadId, Thread>
  activeThreadIds: ThreadId[]

  // Agents
  agents: Map<PersonaId, AgentState>

  // Cruxes
  cruxes: Map<CruxId, ThreadCrux>

  // Coalitions
  coalitions: Coalition[]

  // UI state
  selectedThreadId: ThreadId | null
  expandedCruxId: CruxId | null

  // Metrics
  metrics: DebateMetrics
}
```

**Component Tree**:
```
MultiDebateClient (orchestrator)
├── AgentPanel (sidebar: agent avatars, status, coalitions)
├── ThreadGrid (main area)
│   ├── ThreadColumn (thread-1)
│   │   ├── ThreadHeader (topic, convergence bar)
│   │   └── MessageList (chat-style messages)
│   ├── ThreadColumn (thread-2)
│   └── ThreadColumn (thread-3)
└── CruxMap (bottom panel)
    └── Graph visualization (D3.js or React Flow)
```

---

### 6. Integration with Existing System

**Missing:**
- How does multi-agent mode coexist with v2 mode?
- Can users switch between modes?
- Are personas compatible between v2 and multi-agent?
- Is there a unified debate history view?
- Can multi-agent debates be compared to v2 debates?

**Impact**: Unclear how this fits into the existing product.

**Recommendation**:

**Unified Debate Selection**:
```
/setup
├── Mode Selection:
│   ├── v2 ⚡ (2 agents, sequential, proven)
│   └── Multi 🌐 (3-12 agents, parallel, experimental)
├── Persona Selection (same pool for both modes)
└── Topic Input
```

**Shared Infrastructure**:
- Same persona loader (`lib/personas/loader.ts`)
- Same LLM client (`lib/llm/client.ts`)
- Separate debate engines (`lib/debate/engine.ts` vs `lib/multi-agent/orchestrator.ts`)
- Unified output format converter (v2 → multi output, multi → v2 output)

**Example Converter**:
```typescript
function convertMultiToV2Format(multiOutput: MultiDebateOutput): DebateEngineOutput {
  // Flatten threads → single transcript
  // First crux → main crux
  // Coalitions → camps
  // ...
}
```

---

### 7. Security & Rate Limiting

**Missing:**
- API authentication (or is it public?)
- Rate limiting per user/IP
- Content moderation (what if agent outputs offensive content?)
- Prompt injection safeguards
- Cost limits per debate
- Abuse prevention (someone spawning 100 debates)

**Impact**: System could be abused, costs could explode.

**Recommendation**:

**Rate Limiting**:
```typescript
// Per IP
const RATE_LIMITS = {
  debatesPerHour: 10,
  debatesPerDay: 50,
  maxConcurrentDebates: 2
}

// Per debate
const DEBATE_LIMITS = {
  maxCostUSD: 5.0,              // Hard stop
  maxDurationMs: 600000,        // 10 minutes
  maxMessagesTotal: 500
}
```

**Content Moderation**:
```typescript
// Check every message output
async function moderateMessage(content: string): Promise<{ safe: boolean, reason?: string }> {
  // Use Anthropic moderation API or keyword filter
  // If unsafe: drop message, warn agent, maybe terminate debate
}
```

**Authentication**:
- Add API key requirement for `/api/debate-multi`
- Track usage per API key
- Implement billing/quotas

---

### 8. Edge Case Handling

**Missing:**
- What if all agents say "UNCERTAIN" on a crux? (no YES/NO split)
- What if a thread never spawns a binary question?
- What if coalition detection produces 1 agent per coalition? (no clusters)
- What if agents never concede? (infinite debate)
- What if attention scoring produces all zeros? (no agent responds)
- What if two threads have identical binary questions? (duplicate detection)

**Impact**: System could get stuck in undefined states.

**Recommendation**:

**Edge Case Handlers**:
```typescript
// All UNCERTAIN → mark as "inconclusive" crux
if (positions.every(p => p.side === 'UNCERTAIN')) {
  crux.validated = false
  crux.validationFailures = ["No definitive positions (all UNCERTAIN)"]
  thread.status = 'INCONCLUSIVE'
}

// No binary question after 20 messages → inject moderator
if (thread.messages.length >= 20 && !thread.binaryQuestion) {
  injectModeratorMessage(thread, "Can you state the core yes/no question you're debating?")
}

// Singleton coalitions → don't report (not coalitions)
const coalitions = clusters.filter(c => c.members.length >= 2)

// Infinite debate → max turns enforced
if (totalMessages >= config.maxMessages) {
  forceConvergence("Max messages reached")
}

// All-zero attention → fall back to round-robin
if (relevant.length === 0 && unhandledMessages.length > 0) {
  const next = roundRobinSelect(agents, lastSpeaker)
  forceDeliver(next, unhandledMessages[0])
}

// Duplicate threads → auto-merge
if (cosineSimilarity(thread1.binaryQuestion, thread2.binaryQuestion) > 0.9) {
  mergeThreads(thread1, thread2)
}
```

---

### 9. Testing Strategy

**Missing:**
- Unit test approach
- Integration test approach
- End-to-end test approach
- Performance benchmarks
- Acceptance criteria

**Impact**: No way to verify system works correctly.

**Recommendation**:

**Unit Tests** (`lib/multi-agent/*.test.ts`):
```typescript
describe('AttentionScorer', () => {
  it('should score direct mention as 1.0', () => {
    const message = { content: "@michael-saylor what do you think?", ... }
    const agent = { id: 'michael-saylor', ... }
    expect(scoreMessage(message, agent)).toBe(1.0)
  })

  it('should score irrelevant message below threshold', () => {
    const message = { content: "Ethereum gas fees are too high", ... }
    const agent = { id: 'michael-saylor', interests: [{ topic: 'bitcoin', ... }] }
    expect(scoreMessage(message, agent)).toBeLessThan(0.6)
  })
})

describe('ThreadManager', () => {
  it('should detect convergence after PROPOSE_CRUX + acknowledgment', () => {
    const thread = createThreadWithMoves(['CLAIM', 'CHALLENGE', 'PROPOSE_CRUX', 'CONCEDE'])
    expect(checkConvergence(thread).converged).toBe(true)
  })

  it('should mark thread as stale after 30s inactivity', () => {
    const thread = createThread({ lastActivityAt: Date.now() - 31000 })
    expect(checkStaleness(thread)).toBe(true)
  })
})
```

**Integration Tests** (`tests/multi-agent-integration.test.ts`):
```typescript
describe('Multi-Agent Debate', () => {
  it('should complete 3-agent debate with 2 threads', async () => {
    const debate = await runMultiDebate({
      topic: "Test topic",
      personaIds: ['agent-1', 'agent-2', 'agent-3'],
      config: { maxMessages: 50, maxDuration: 60000 }
    })

    expect(debate.threads.length).toBeGreaterThanOrEqual(2)
    expect(debate.cruxes.size).toBeGreaterThanOrEqual(1)
    expect(debate.status).toBe('completed')
  })

  it('should handle agent failure gracefully', async () => {
    // Mock agent to fail after 3 messages
    mockAgentFailure('agent-2', 3)

    const debate = await runMultiDebate({
      topic: "Test topic",
      personaIds: ['agent-1', 'agent-2', 'agent-3']
    })

    // Should complete with 2 agents
    expect(debate.status).toBe('completed')
    expect(debate.messages.filter(m => m.agentId === 'agent-2').length).toBe(3)
  })
})
```

**Performance Benchmarks**:
```typescript
describe('Performance', () => {
  it('should complete 5-agent debate in <3 minutes', async () => {
    const start = Date.now()
    const debate = await runMultiDebate({
      personaIds: ['a1', 'a2', 'a3', 'a4', 'a5'],
      config: { maxMessages: 80 }
    })
    const duration = Date.now() - start
    expect(duration).toBeLessThan(180000)
  })

  it('should stay under $1 cost for 5 agents', async () => {
    const debate = await runMultiDebate({
      personaIds: ['a1', 'a2', 'a3', 'a4', 'a5']
    })
    expect(debate.cost).toBeLessThan(1.0)
  })
})
```

---

### 10. Operational Concerns

**Missing:**
- Deployment strategy (Docker? Serverless?)
- Monitoring/alerting (Sentry? Datadog?)
- Backup strategy
- Scaling considerations (Redis for message bus?)
- Cost tracking per debate
- Graceful shutdown (finish in-progress debates)

**Impact**: Can't deploy to production safely.

**Recommendation**:

**Deployment Checklist**:
- [ ] Dockerize app with multi-agent support
- [ ] Add Redis for message bus (scale beyond single instance)
- [ ] Add PostgreSQL for debate persistence
- [ ] Add Sentry for error tracking
- [ ] Add Prometheus metrics endpoint
- [ ] Add health check endpoint `/health`
- [ ] Add graceful shutdown (SIGTERM handler)
- [ ] Add environment-based config (dev vs prod)
- [ ] Add CI/CD pipeline (tests before deploy)
- [ ] Add cost tracking dashboard

**Health Check Endpoint**:
```typescript
GET /health
Response:
{
  "status": "healthy",
  "uptime": 123456,
  "activeDebates": 3,
  "messageBus": "connected",
  "database": "connected",
  "llmProvider": "connected"
}
```

---

### 11. User Experience Gaps

**Missing:**
- Can users pause/resume debates?
- Can users inject a message mid-debate?
- Can users remove an agent mid-debate?
- Can users force a thread to spawn?
- Can users mark a crux as incorrect?
- What controls are exposed in the UI?

**Impact**: Users have no control, system is fully automated.

**Recommendation**:

**User Controls**:
```typescript
interface DebateControls {
  // Playback
  pause(): void
  resume(): void
  terminate(): void

  // Intervention
  injectMessage(content: string, threadId?: ThreadId): void
  removeAgent(agentId: PersonaId): void
  forceThreadSpawn(topic: string, binaryQuestion: string): void

  // Feedback
  markCruxIncorrect(cruxId: CruxId, reason: string): void
  suggestCoalitionLabel(coalitionId: string, label: string): void
}
```

**UI Controls**:
- Pause/Resume button (top right)
- "Inject Message" button (per thread)
- "Force Convergence" button (per thread)
- "Challenge Crux" button (on crux cards)
- Agent cards with "Remove" action

---

### 12. Ambiguous Specifications

**Issues:**

1. **"randomDelay(2000, 5000)"** - Uniform or exponential distribution?
   - **Recommendation**: Use uniform for simplicity.

2. **Coalition labeling** - What if LLM produces offensive label?
   - **Recommendation**: Filter through moderation API, fallback to "Coalition A".

3. **Thread orthogonality** - What embedding model?
   - **Recommendation**: Use Voyage-3 (already integrated), specify `voyage-3` explicitly.

4. **"interesting topic"** - No definition.
   - **Recommendation**: Remove vague check, rely on 2-agent bite requirement only.

5. **"cosineSimilarity threshold 0.3"** - Distance or similarity?
   - **Recommendation**: Clarify: `cosineSimilarity > 0.7` (high similarity) → merge.

6. **"Hierarchical clustering threshold 0.7"** - Which linkage method?
   - **Recommendation**: Specify `average linkage`.

---

## Summary: Priority Gaps

### P0 (Must-have before v0):
1. **Error handling** - debates must not crash on LLM failures
2. **Persistence** - debates must be resumable
3. **Edge case handling** - all-UNCERTAIN, no binary question, etc.
4. **API contracts** - exact JSON schemas for integration

### P1 (Before v1):
5. **Observability** - metrics, logging, debugging tools
6. **Testing strategy** - unit + integration tests
7. **Security** - rate limiting, content moderation
8. **Frontend state management** - detailed component architecture

### P2 (Nice-to-have):
9. **User controls** - pause/resume, inject messages
10. **Operational** - deployment, monitoring, alerting
11. **Integration** - how it fits with v2 mode
12. **Ambiguity resolution** - clarify all vague specs

---

## Next Steps

1. **Address P0 gaps** before starting implementation
2. **Write error handling spec** (retry logic, circuit breakers)
3. **Design database schema** (messages, threads, cruxes)
4. **Define API contracts** (SSE event schemas)
5. **Add edge case handlers** (all-UNCERTAIN, duplicate threads, etc.)
6. **Then proceed** with Phase 1 implementation (message bus + agent loop)

---

**Questions?**
- Should debates be resumable? (persistence required)
- Should users be able to intervene mid-debate? (controls required)
- What's the deployment target? (local dev, cloud, both?)
- What's the budget for monitoring tools? (Sentry, Datadog, etc.)
