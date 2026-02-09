# Faultline - UI

Debates feel like chess matches. Personalities are pieces. Arguments are moves. Analysis is the endgame.

---

## Vibe Principles

| Concept | Chess Equivalent |
|---|---|
| Rooms | Matches |
| Personalities | Pieces |
| Debate turns | Moves |
| Cruxes / flip conditions | Analysis |

---

## Pages

### 1. Home / Lobby

Purpose: Enter the product and pick a match.

- Big input field: "What question are we playing?"
- "Start Match" CTA
- Recent matches (cards)
- Featured room templates (e.g., "Builder vs Skeptic vs Macro")

### 2. Room Setup (Matchmaking)

Purpose: Choose your pieces.

- **Board-style lineup selector**: 3 or 5 slots, drag/drop personalities into slots
- Toggle: **3-piece Blitz** vs **5-piece Classical**
- Toggle: **Chaos** vs **Structured** (changes round limits + referee strictness)
- **Auto-balance** button: fills slots with complementary voices
- **The Bench** section: locked/coming-soon personalities (see Bench section below)

### 3. Debate Room (The Match)

Purpose: Watch the fight and see analysis form in real time.

- **Header**: Match title, time control (Blitz/Classical), "Resign" (end early), "Rematch"
- **Center**: Move-by-move feed (messages labeled Move 1, Move 2...)
- **Left rail**: Pieces (agents) with confidence meter, momentum indicator
- **Right rail — Analysis**:
  - Cruxes (key positions)
  - Fault lines (disagreement themes)
  - Flip conditions (win conditions)
- Streaming responses with per-agent typing indicators
- Tool usage visible inline (data fetches, citations)

### 4. Postgame (Analysis Report)

Purpose: The shareable artifact.

- Game recap (key turns)
- **Disagreement Map** — cleanly formatted
- Flip conditions per agent (as "win condition" cards)
- "What would settle this?" section
- Export / share: image, link, copy, markdown

### 5. Personalities Library (Pieces Catalog)

Purpose: Browse the roster and build trust.

- Grid of personality cards
- Filters: domain (AI, markets, crypto), temperament (aggressive, skeptical), evidence style
- Each card shows: piece type icon, style tags, strengths, availability (**Playable** vs **Locked**)

### 6. Personality Profile (Piece Sheet)

Purpose: Transparency and credibility.

- Tabs:
  - Voice (personality.md)
  - Bias (bias.md)
  - Stakes (stakes.md)
  - Epistemology (epistemology.md)
  - Time Horizon (time_horizon.md)
  - Flip Conditions (flip_conditions.md)
- Recent citations / grounding sources
- "Add to Lineup" button

### 7. Account / Settings

Purpose: Basics.

- API key input (bring-your-own-key support)
- Default time control (Blitz / Classical)
- Default room size (3 / 5)
- Content / safety disclaimers

---

## The Bench (Locked Pieces)

Displayed on **Room Setup** and **Personalities Library** pages.

### Visual Treatment
- Cards are slightly dimmed with a lock icon
- Hover shows: "Training / grounding in progress"
- Button: "Request unlock" (waitlist capture)

### Bench Roster

| Personality | Piece Type |
|---|---|
| Regulator / Antitrust Hawk | Rook |
| Open-source Maximalist | Bishop |
| Security Researcher | Knight |
| Macro Liquidity Trader | Queen |
| Academic ML Skeptic | Bishop |
| Consumer Product PM | Rook |
| Labor Economist | Bishop |

---

## Piece Type Visual System

Each personality displays a chess piece icon based on its archetype:

| Piece | Icon Role | Behavior |
|---|---|---|
| **King** | Anchor | Stabilizes the debate |
| **Queen** | Powerhouse | Wide-ranging, aggressive coverage |
| **Bishop** | Ideologue | First-principles, diagonal reasoning |
| **Knight** | Wildcard | Contrarian, unexpected angles |
| **Rook** | Operator | Execution-focused, concrete |
| **Pawn** | Crowd | Community sentiment, reality check |

Piece type is shown on personality cards, lineup slots, and the left rail of the Debate Room.

---

## Custom Persona Creation UI

### Creation Flow (Page / Modal)

1. **Name + Piece Type**: Text input for persona name, dropdown/grid to select piece type icon
2. **Data Sources**: Add one or more sources via input fields:
   - Reddit username or subreddit URL
   - Twitter/X handle
   - Substack / blog URL
   - YouTube / podcast URL
   - File upload (documents, essays, papers)
   - RSS feed URL
3. **Processing**: Progress indicator while system ingests and analyzes material
4. **Review**: Tabbed editor showing auto-generated profile files (personality, bias, stakes, epistemology, time_horizon, flip_conditions, rules) — user can edit before saving
5. **Done**: Persona appears in user's personal library, available for lineup selection

---

## Page Priority (MVP Cut)

### Must-have
1. Home / Lobby
2. Room Setup (with Bench)
3. Debate Room
4. Postgame (Analysis Report)

### Nice-to-have
5. Personalities Library
6. Personality Profile

### Post-MVP
7. Custom Persona Creation
8. Account / Settings
