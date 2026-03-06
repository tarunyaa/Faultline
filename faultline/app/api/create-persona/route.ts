import { NextRequest } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'
import {
  fetchTwitterProfile,
  fetchTweets,
  fetchSubstackPosts,
  buildCorpusText,
  buildCorpusEntries,
  filterContent,
  generateContractField,
  generateEvidencePolicy,
  selectAnchorExcerpts,
  CONTRACT_FIELDS,
} from '@/lib/persona-builder/pipeline'
import { invalidatePersonasCache } from '@/lib/personas/loader'

const SEED_DIR = path.join(process.cwd(), 'data', 'seed')
const MAX_TWEETS = 100
const MAX_SUBSTACK_POSTS = 20
const MAX_ANCHOR_EXCERPTS = 15

interface CreatePersonaBody {
  name: string
  xHandle?: string
  substackUrl?: string
  deckId?: string
  newDeck?: { name: string; slug: string; topic: string }
}

interface DeckConfigEntry {
  deck: { id: string; name: string; slug: string }
  topic: string
  personas: { id: string; twitterHandle: string | null; substackUrl: string | null }[]
  settings: { maxTweets: number; maxSubstackPosts: number; maxAnchorExcerpts: number }
}

interface PersonasFile {
  decks: {
    id: string
    name: string
    slug: string
    personaIds: string[]
    locked: boolean
    createdAt: string
  }[]
  personas: {
    id: string
    name: string
    twitterHandle: string
    twitterPicture: string
    deckIds: string[]
    suite: null
    locked: boolean
  }[]
}

function send(controller: ReadableStreamDefaultController, encoder: TextEncoder, data: object) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

async function getDeckTopic(deckId: string, deckName: string): Promise<string> {
  try {
    const raw = await fs.readFile(path.join(SEED_DIR, 'deck-config.json'), 'utf-8')
    const configs = JSON.parse(raw) as DeckConfigEntry[]
    const entry = configs.find(c => c.deck.id === deckId || c.deck.slug === deckId)
    return entry?.topic ?? deckName
  } catch {
    return deckName
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreatePersonaBody
  const { name, xHandle, substackUrl, deckId, newDeck } = body

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => send(controller, encoder, data)

      try {
        // ─── Validate ─────────────────────────────────────────
        if (!name?.trim()) {
          emit({ type: 'error', message: 'Persona name is required.' })
          controller.close()
          return
        }
        if (!xHandle?.trim() && !substackUrl?.trim()) {
          emit({ type: 'error', message: 'At least one source (X handle or Substack URL) is required.' })
          controller.close()
          return
        }
        if (!deckId && !newDeck) {
          emit({ type: 'error', message: 'Deck selection is required.' })
          controller.close()
          return
        }

        const personaId = name.trim()
        const resolvedDeckId = deckId ?? newDeck!.slug

        // ─── Init clients ──────────────────────────────────────
        const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const twitter = process.env.X_BEARER_TOKEN
          ? new TwitterApi(process.env.X_BEARER_TOKEN)
          : null

        // ─── Resolve topic ─────────────────────────────────────
        const topic = newDeck
          ? newDeck.topic
          : await getDeckTopic(resolvedDeckId, resolvedDeckId)

        // ─── Fetch corpus ──────────────────────────────────────
        let profileName = personaId
        let profileImageUrl = ''
        const tweets = []
        const substackPosts = []

        if (xHandle?.trim()) {
          if (!twitter) {
            emit({ type: 'status', message: 'X_BEARER_TOKEN not set — skipping Twitter fetch.' })
          } else {
            emit({ type: 'status', message: `Fetching X profile: @${xHandle}...` })
            try {
              const profile = await fetchTwitterProfile(twitter, xHandle.trim())
              profileName = profile.name
              profileImageUrl = profile.profileImageUrl
              emit({ type: 'status', message: `Found: ${profile.name}` })

              emit({ type: 'status', message: `Fetching tweets...` })
              const fetched = await fetchTweets(twitter, profile.id, MAX_TWEETS)
              tweets.push(...fetched)
              emit({ type: 'status', message: `Fetched ${fetched.length} tweets` })
            } catch (err) {
              emit({ type: 'status', message: `Twitter fetch failed: ${(err as Error).message}` })
            }
          }
        }

        if (substackUrl?.trim()) {
          emit({ type: 'status', message: `Fetching Substack posts...` })
          try {
            const posts = await fetchSubstackPosts(substackUrl.trim(), MAX_SUBSTACK_POSTS)
            substackPosts.push(...posts)
            emit({ type: 'status', message: `Fetched ${posts.length} Substack posts` })
          } catch (err) {
            emit({ type: 'status', message: `Substack fetch failed: ${(err as Error).message}` })
          }
        }

        if (tweets.length === 0 && substackPosts.length === 0) {
          emit({ type: 'error', message: 'No content could be fetched. Check your X handle or Substack URL.' })
          controller.close()
          return
        }

        // ─── Filter ────────────────────────────────────────────
        emit({ type: 'status', message: 'Filtering content for relevance...' })
        const corpusText = buildCorpusText(tweets, substackPosts, xHandle ?? null)
        const { tweetIndices, postIndices } = await filterContent(
          claude,
          corpusText,
          topic,
          tweets.length,
          substackPosts.length
        )
        emit({ type: 'status', message: `Kept ${tweetIndices.length} tweets, ${postIndices.length} posts` })

        if (tweetIndices.length === 0 && postIndices.length === 0) {
          emit({ type: 'error', message: 'No relevant content found for this topic. Try a different topic or more content sources.' })
          controller.close()
          return
        }

        const filteredParts: string[] = []
        for (const i of tweetIndices) {
          const t = tweets[i]
          if (t) filteredParts.push(`[Tweet ${t.created_at}] ${t.text}`)
        }
        for (const i of postIndices) {
          const p = substackPosts[i]
          if (p) filteredParts.push(`[Substack "${p.title}" ${p.date}] ${p.content}`)
        }
        const filteredCorpus = filteredParts.join('\n\n')

        // ─── Generate contract fields ──────────────────────────
        const contractFields: Record<string, string> = {}
        for (let i = 0; i < CONTRACT_FIELDS.length; i++) {
          const field = CONTRACT_FIELDS[i]
          emit({ type: 'status', message: `Generating ${field}... (${i + 1}/${CONTRACT_FIELDS.length})` })
          contractFields[field] = await generateContractField(claude, field, filteredCorpus, profileName, topic)
        }

        emit({ type: 'status', message: 'Generating evidence policy...' })
        const evidencePolicy = await generateEvidencePolicy(claude, filteredCorpus, profileName, topic)

        emit({ type: 'status', message: 'Selecting anchor excerpts...' })
        const anchorExcerpts = await selectAnchorExcerpts(
          claude,
          tweets,
          substackPosts,
          tweetIndices,
          postIndices,
          xHandle ?? null,
          profileName,
          topic,
          MAX_ANCHOR_EXCERPTS
        )

        // ─── Write corpus ──────────────────────────────────────
        emit({ type: 'status', message: 'Writing files...' })
        const corpus = buildCorpusEntries(tweets, substackPosts, xHandle ?? null)
        await fs.mkdir(path.join(SEED_DIR, 'corpus'), { recursive: true })
        await fs.writeFile(
          path.join(SEED_DIR, 'corpus', `${personaId}.json`),
          JSON.stringify(corpus, null, 2)
        )

        // ─── Write contract ────────────────────────────────────
        const contract = {
          personaId,
          version: new Date().toISOString(),
          ...Object.fromEntries(CONTRACT_FIELDS.map(f => [f, contractFields[f]])),
          evidencePolicy,
          anchorExcerpts,
        }
        await fs.mkdir(path.join(SEED_DIR, 'contracts'), { recursive: true })
        await fs.writeFile(
          path.join(SEED_DIR, 'contracts', `${personaId}.json`),
          JSON.stringify(contract, null, 2)
        )

        // ─── Update personas.json ──────────────────────────────
        const personasPath = path.join(SEED_DIR, 'personas.json')
        let personasFile: PersonasFile = { decks: [], personas: [] }
        try {
          personasFile = JSON.parse(await fs.readFile(personasPath, 'utf-8')) as PersonasFile
        } catch { /* start fresh if missing */ }

        // Add or replace persona
        const existingIdx = personasFile.personas.findIndex(p => p.id === personaId)
        const personaEntry = {
          id: personaId,
          name: profileName,
          twitterHandle: xHandle ? `@${xHandle.trim()}` : '',
          twitterPicture: profileImageUrl,
          deckIds: [resolvedDeckId],
          suite: null,
          locked: false,
        }
        if (existingIdx >= 0) {
          personasFile.personas[existingIdx] = personaEntry
        } else {
          personasFile.personas.push(personaEntry)
        }

        // Add or update deck
        const deckIdx = personasFile.decks.findIndex(d => d.id === resolvedDeckId)
        if (deckIdx >= 0) {
          if (!personasFile.decks[deckIdx].personaIds.includes(personaId)) {
            personasFile.decks[deckIdx].personaIds.push(personaId)
          }
        } else {
          personasFile.decks.push({
            id: resolvedDeckId,
            name: newDeck?.name ?? resolvedDeckId,
            slug: resolvedDeckId,
            personaIds: [personaId],
            locked: false,
            createdAt: new Date().toISOString(),
          })
        }

        await fs.writeFile(personasPath, JSON.stringify(personasFile, null, 2))

        // ─── Update deck-config.json ───────────────────────────
        const deckConfigPath = path.join(SEED_DIR, 'deck-config.json')
        let deckConfigs: DeckConfigEntry[] = []
        try {
          deckConfigs = JSON.parse(await fs.readFile(deckConfigPath, 'utf-8')) as DeckConfigEntry[]
        } catch { /* start fresh */ }

        const dcIdx = deckConfigs.findIndex(c => c.deck.id === resolvedDeckId)
        const personaConfigEntry = {
          id: personaId,
          twitterHandle: xHandle?.trim() ?? null,
          substackUrl: substackUrl?.trim() ?? null,
        }
        if (dcIdx >= 0) {
          const existing = deckConfigs[dcIdx].personas.findIndex(p => p.id === personaId)
          if (existing >= 0) {
            deckConfigs[dcIdx].personas[existing] = personaConfigEntry
          } else {
            deckConfigs[dcIdx].personas.push(personaConfigEntry)
          }
        } else {
          deckConfigs.push({
            deck: {
              id: resolvedDeckId,
              name: newDeck?.name ?? resolvedDeckId,
              slug: resolvedDeckId,
            },
            topic,
            personas: [personaConfigEntry],
            settings: { maxTweets: MAX_TWEETS, maxSubstackPosts: MAX_SUBSTACK_POSTS, maxAnchorExcerpts: MAX_ANCHOR_EXCERPTS },
          })
        }
        await fs.writeFile(deckConfigPath, JSON.stringify(deckConfigs, null, 2))

        // ─── Invalidate runtime cache ──────────────────────────
        invalidatePersonasCache()

        emit({
          type: 'complete',
          personaId,
          personaName: profileName,
          deckId: resolvedDeckId,
        })
      } catch (err) {
        send(controller, encoder, {
          type: 'error',
          message: (err as Error).message ?? 'Unknown error',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
