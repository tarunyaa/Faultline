/**
 * seed-db.ts
 *
 * Imports file-based seed data (personas.json, contracts/, corpus/)
 * into the Postgres database.
 *
 * Usage:
 *   npx tsx scripts/seed-db.ts
 *
 * Prerequisites:
 *   - Postgres running (docker compose up -d)
 *   - Schema pushed (npm run db:push)
 *   - Seed files generated (npm run build-personas)
 */

import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../lib/db/schema'

const SEED_DIR = path.join(process.cwd(), 'data', 'seed')

interface PersonasFile {
  decks: {
    id: string
    name: string
    slug: string
    personaIds: string[]
    locked: boolean
    createdAt?: string
  }[]
  personas: {
    id: string
    name: string
    twitterHandle: string
    twitterPicture: string
    deckIds: string[]
    suite: string | null
    locked: boolean
  }[]
}

interface PersonaContract {
  personaId: string
  version: string
  personality: string
  bias: string
  stakes: string
  epistemology: string
  timeHorizon: string
  flipConditions: string
  evidencePolicy: unknown
  anchorExcerpts: unknown[]
}

interface CorpusExcerpt {
  id: string
  content: string
  source: string
  date: string
  platform: string
  metrics?: unknown
}

async function main() {
  console.log('Crux — Database Seeder\n')

  const connectionString =
    process.env.DATABASE_URL ?? 'postgresql://faultline:faultline@localhost:5432/faultline'
  const client = postgres(connectionString)
  const db = drizzle(client, { schema })

  // Load personas.json
  const personasPath = path.join(SEED_DIR, 'personas.json')
  const personasFile: PersonasFile = JSON.parse(await fs.readFile(personasPath, 'utf-8'))

  if (personasFile.decks.length === 0 && personasFile.personas.length === 0) {
    console.error('ERROR: personas.json is empty. Run `npm run build-personas` first.')
    await client.end()
    process.exit(1)
  }

  // ─── Insert decks ───
  console.log(`Inserting ${personasFile.decks.length} deck(s)...`)
  for (const deck of personasFile.decks) {
    await db
      .insert(schema.decks)
      .values({
        id: deck.id,
        name: deck.name,
        slug: deck.slug,
        locked: deck.locked,
      })
      .onConflictDoUpdate({
        target: schema.decks.id,
        set: { name: deck.name, slug: deck.slug, locked: deck.locked },
      })
    console.log(`  Deck: ${deck.id}`)
  }

  // ─── Insert personas ───
  console.log(`Inserting ${personasFile.personas.length} persona(s)...`)
  for (const persona of personasFile.personas) {
    await db
      .insert(schema.personas)
      .values({
        id: persona.id,
        name: persona.name,
        twitterHandle: persona.twitterHandle,
        twitterPicture: persona.twitterPicture,
        locked: persona.locked,
        suite: persona.suite,
      })
      .onConflictDoUpdate({
        target: schema.personas.id,
        set: {
          name: persona.name,
          twitterHandle: persona.twitterHandle,
          twitterPicture: persona.twitterPicture,
          locked: persona.locked,
          suite: persona.suite,
        },
      })
    console.log(`  Persona: ${persona.id} (${persona.name})`)
  }

  // ─── Insert persona_decks links ───
  console.log('Linking personas to decks...')
  for (const deck of personasFile.decks) {
    for (const personaId of deck.personaIds) {
      await db
        .insert(schema.personaDecks)
        .values({ personaId, deckId: deck.id })
        .onConflictDoNothing()
    }
  }

  // ─── Insert contracts ───
  console.log('Inserting contracts...')
  const contractsDir = path.join(SEED_DIR, 'contracts')
  let contractFiles: string[] = []
  try {
    contractFiles = (await fs.readdir(contractsDir)).filter(f => f.endsWith('.json'))
  } catch {
    console.warn('  No contracts directory found, skipping.')
  }

  for (const file of contractFiles) {
    const contract: PersonaContract = JSON.parse(
      await fs.readFile(path.join(contractsDir, file), 'utf-8')
    )
    const contractId = `${contract.personaId}-${contract.version}`
    await db
      .insert(schema.personaContracts)
      .values({
        id: contractId,
        personaId: contract.personaId,
        version: contract.version,
        contractJson: contract,
      })
      .onConflictDoUpdate({
        target: schema.personaContracts.id,
        set: { version: contract.version, contractJson: contract },
      })
    console.log(`  Contract: ${contract.personaId} (v${contract.version})`)
  }

  // ─── Insert corpus chunks ───
  console.log('Inserting corpus chunks...')
  const corpusDir = path.join(SEED_DIR, 'corpus')
  let corpusFiles: string[] = []
  try {
    corpusFiles = (await fs.readdir(corpusDir)).filter(f => f.endsWith('.json'))
  } catch {
    console.warn('  No corpus directory found, skipping.')
  }

  let chunkCount = 0
  for (const file of corpusFiles) {
    const personaId = file.replace('.json', '')
    const excerpts: CorpusExcerpt[] = JSON.parse(
      await fs.readFile(path.join(corpusDir, file), 'utf-8')
    )

    for (const excerpt of excerpts) {
      await db
        .insert(schema.corpusChunks)
        .values({
          id: excerpt.id,
          personaId,
          content: excerpt.content,
          sourceType: excerpt.platform,
          sourceUrl: excerpt.source,
          sourceDate: excerpt.date ? new Date(excerpt.date) : null,
          chunkIndex: 0,
          // embedding: null — generated later by embedding pipeline
        })
        .onConflictDoUpdate({
          target: schema.corpusChunks.id,
          set: {
            content: excerpt.content,
            sourceUrl: excerpt.source,
            sourceDate: excerpt.date ? new Date(excerpt.date) : null,
          },
        })
      chunkCount++
    }
    console.log(`  Corpus: ${personaId} (${excerpts.length} chunks)`)
  }

  console.log(`\nDone! Seeded:`)
  console.log(`  ${personasFile.decks.length} deck(s)`)
  console.log(`  ${personasFile.personas.length} persona(s)`)
  console.log(`  ${contractFiles.length} contract(s)`)
  console.log(`  ${chunkCount} corpus chunk(s)`)

  await client.end()
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err)
  process.exit(1)
})
