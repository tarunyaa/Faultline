import { NextRequest, NextResponse } from 'next/server'
import { runBlitz } from '@/lib/orchestrator/blitz'
import type { SSEEvent } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

interface DebateRequest {
  topic: string
  personaIds: string[]
  mode?: 'blitz' | 'classical'
}

export async function POST(req: NextRequest) {
  let body: DebateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { topic, personaIds, mode = 'blitz' } = body

  if (!topic || typeof topic !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid topic' }, { status: 400 })
  }
  if (!Array.isArray(personaIds) || personaIds.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 persona IDs' }, { status: 400 })
  }
  if (mode !== 'blitz') {
    return NextResponse.json({ error: 'Only blitz mode is supported' }, { status: 400 })
  }

  const debateId = `debate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = runBlitz({
          topic,
          personaIds,
          debateId,
        })

        for await (const event of generator) {
          const data = formatSSE(event)
          controller.enqueue(encoder.encode(data))
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error'
        const errorEvent: SSEEvent = { type: 'error', message }
        controller.enqueue(encoder.encode(formatSSE(errorEvent)))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}
