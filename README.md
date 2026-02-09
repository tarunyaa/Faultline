# Faultline

**Automated Insight Generation through Multi-Agent Socratic Seminar Grounded in Real Voices**

Faultline is a debate room for the internet's most influential viewpoints. Spin up AI agents with personas modeled on real-world voices and watch them challenge each other in a structured Socratic seminar. Instead of forcing agreement, Faultline distills debates into **cruxes** (the core assumptions driving disagreement) and **flip conditions** (the evidence that would actually change each position).

## How It Works

1. **Enter a topic** (e.g. "Is NVIDIA overvalued at current multiples?")
2. **Pick your voices** from curated persona decks, or let Faultline auto-select a balanced room
3. **Watch the debate** unfold in real time via SSE streaming
4. **Get structured output**: cruxes, fault lines, flip conditions, and an evidence ledger

Each persona is backed by an inspectable **contract** generated from public material (X/Twitter, Substack, transcripts) covering:

- **Personality** -- voice, rhetorical habits, confidence style
- **Bias** -- priors, blind spots, failure modes
- **Stakes** -- incentives, preferred outcomes, exposure
- **Epistemology** -- how they form beliefs
- **Time Horizon** -- what timeframe their reasoning optimizes for
- **Flip Conditions** -- what evidence would change their mind

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Frontend | React 19, Tailwind CSS 4 |
| LLM | Anthropic Claude (Sonnet 4.5 / Haiku 4.5) |
| Database | PostgreSQL 17 + pgvector |
| ORM | Drizzle ORM |
| Persona Ingestion | X API v2, Substack RSS, Claude |
| Runtime | Node.js 18+ |

## Project Structure

```
Faultline/
├── docker-compose.yml              # Postgres + pgvector (port 5433)
├── docs/                           # Design docs (overview, features, implementation)
│
└── faultline/                      # Next.js application
    ├── app/
    │   ├── page.tsx                # Lobby (landing page)
    │   ├── cards/                  # Browse decks & persona cards
    │   ├── setup/                  # Hand builder (select personas + topic)
    │   ├── match/[id]/             # Game room (live debate viewer)
    │   └── api/debate/route.ts     # POST SSE endpoint
    │
    ├── lib/
    │   ├── types/index.ts          # Shared TypeScript types
    │   ├── db/                     # Drizzle schema & client
    │   ├── llm/                    # Anthropic SDK wrapper & prompt templates
    │   ├── orchestrator/           # Debate engine (blitz + classical modes)
    │   │   ├── blitz.ts            # Parallel round-based debate
    │   │   ├── classical.ts        # Sequential urgency-based debate
    │   │   ├── claims.ts           # Topic -> testable claims
    │   │   ├── blackboard.ts       # Shared debate state
    │   │   ├── convergence.ts      # Entropy & stop conditions
    │   │   ├── context.ts          # Per-turn context assembly
    │   │   ├── agents.ts           # Agent init & stance generation
    │   │   └── output.ts           # Final structured output
    │   └── personas/loader.ts      # File-based persona loader
    │
    ├── components/                 # React components
    ├── data/seed/                  # Persona contracts & corpus data
    └── scripts/
        ├── build-personas.ts       # Automated persona builder
        └── seed-db.ts              # Seed Postgres from file data
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- An [Anthropic API key](https://console.anthropic.com/)
- (Optional) X/Twitter API bearer token for persona building

### 1. Clone & Install

```bash
git clone https://github.com/your-org/faultline.git
cd faultline/faultline
npm install
```

### 2. Environment Variables

Create `faultline/.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://faultline:faultline@localhost:5433/faultline
X_BEARER_TOKEN=AAAA...   # optional, for persona building
```

### 3. Start the Database

From the repo root:

```bash
docker compose up -d
```

This starts PostgreSQL 17 with pgvector on port **5433**.

### 4. Initialize the Database

```bash
npm run db:push    # Apply schema to Postgres
npm run db:seed    # Seed personas from file data
```

### 5. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

Run these from the `faultline/` directory:

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint check |
| `npm run db:push` | Apply Drizzle schema to Postgres |
| `npm run db:generate` | Generate migrations from schema changes |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:seed` | Seed DB from file-based persona data |
| `npm run db:studio` | Open Drizzle Studio (visual DB browser) |
| `npm run build-personas` | Build persona contracts from X/Substack + Claude |

## Debate Modes

### Blitz Mode

All agents respond in parallel each round. Fast, high-throughput. Runs up to 5 rounds with convergence tracking (entropy, confidence distance, crux stability). Stops early if positions converge or diverge stably.

### Classical Mode

Sequential turns with urgency-based speaker selection. Deeper, more deliberate. Each agent decides whether to speak, interrupt, or listen. Runs up to 15 turns.

## API

### `POST /api/debate`

Starts a debate and returns a Server-Sent Events stream.

**Request body:**

```json
{
  "topic": "Should AI companies slow down frontier training?",
  "personaIds": ["Elon Musk", "Sam Altman", "Yann LeCun"],
  "mode": "blitz",
  "save": true
}
```

**SSE event types:** `status`, `debate_start`, `initial_stance`, `agent_turn`, `blackboard_update`, `convergence_update`, `debate_complete`, `error`

## Persona Decks

Pre-built decks include:

- **Macroeconomic Trends** -- Chamath, Michael Burry, Cathie Wood, Aswath Damodaran, and more
- **Crypto** -- Michael Saylor, Arthur Hayes, Brian Armstrong, Vitalik Buterin
- **AI** -- Jim Fan, Garry Tan, Yann LeCun, Andrej Karpathy
- **Famous Personalities** -- Elon Musk, Sam Altman, Satya Nadella, Mark Zuckerberg, Bill Gates
- **Climate & Energy** -- Vaclav Smil, Alex Epstein, Jigar Shah, Michael Shellenberger
- **Memory SuperCycle** -- Serenity, Dylan Patel, and more

### Building Custom Personas

```bash
# Build all decks defined in data/seed/deck-config.json
npm run build-personas

# Build a specific persona in a specific deck
npm run build-personas -- --deck crypto --only "Michael Saylor"
```

## License

Private. All rights reserved.
