# Create Agent Feature

## Status: Implemented (v1)

## What it does

"Create Agent" button on `/cards` page lets users build a new persona from X and/or Substack content. The pipeline runs server-side and streams progress back to the UI.

## Files

| File | Role |
|------|------|
| `lib/persona-builder/pipeline.ts` | Reusable pipeline functions (fetch, filter, generate) |
| `app/api/create-persona/route.ts` | SSE POST endpoint — runs pipeline, writes seed files |
| `components/CreateAgentModal.tsx` | 4-step client modal: info → deck → building → done |
| `app/cards/page.tsx` | Hosts `<CreateAgentButton>` client island |
| `lib/personas/loader.ts` | Exports `invalidatePersonasCache()` |

## Modal flow

1. **Persona Info** — name (required), X handle (optional), Substack URL (optional). At least one source required.
2. **Deck** — pick existing deck OR create new deck (name + debate topic).
3. **Building** — SSE log of pipeline stages.
4. **Done** — links to view card / build hand.

## API: POST /api/create-persona

Request body:
```json
{
  "name": "string",
  "xHandle": "string | undefined",
  "substackUrl": "string | undefined",
  "deckId": "string | undefined",
  "newDeck": { "name": "string", "slug": "string", "topic": "string" } | undefined
}
```

SSE events:
- `{ type: 'status', message: string }`
- `{ type: 'complete', personaId: string, personaName: string, deckId: string }`
- `{ type: 'error', message: string }`

## Data written on completion

- `data/seed/corpus/[id].json`
- `data/seed/contracts/[id].json`
- `data/seed/personas.json` — persona added, deck's `personaIds` updated
- `data/seed/deck-config.json` — deck entry added/updated (for CLI `build-personas` compatibility)

## Deck topic resolution

- Existing deck → topic read from `deck-config.json` (fallback: deck name)
- New deck → topic provided by user in form

## Persona ID convention

ID = persona name as typed (matches existing convention: "Dylan Patel", "Cathie Wood", etc.)

---

## Future work

### Non-public figure / self persona (interview mode)

When no X handle or Substack exists, an interview flow collects beliefs:
1. Faultline asks 5-7 targeted questions about the person's positions
2. User answers in a chat interface
3. Answers are treated as the "corpus" and fed into contract generation
4. A belief graph is produced for review/editing before finalizing

### Belief graph generation for public figures

Separate pipeline (not part of create flow):
- Stage 1: `extract-beliefs.ts` — corpus → causal triples (Haiku)
- Stage 1.5: `synthesize-worldviews.ts` — cross-corpus worldview synthesis
- Triggered from the persona card page as a separate action ("Generate Belief Graph")
- Progress shown inline on the card page

### Deck management

- Edit deck name/topic from cards page
- Remove persona from deck
- Reorder personas within deck
