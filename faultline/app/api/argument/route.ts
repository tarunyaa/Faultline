import { NextRequest } from 'next/server'
import { runArgora, BridgeConfig } from '@/lib/argument/bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — ARGORA pipeline is slow

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  try {
    const body = await req.json() as BridgeConfig & { personaIds?: string[] }

    if (!body.topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400 }
      )
    }

    // Pass personaIds through to bridge config
    if (body.personaIds) {
      body.personaIds = body.personaIds.slice(0, 5) // Cap at 5
    }

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false
        function safeEnqueue(chunk: Uint8Array) {
          if (closed) return
          try { controller.enqueue(chunk) } catch { closed = true }
        }
        function safeClose() {
          if (closed) return
          try { controller.close() } catch { /* already closed */ }
          closed = true
        }

        try {
          for await (const event of runArgora(body)) {
            const data = `data: ${JSON.stringify(event)}\n\n`
            safeEnqueue(encoder.encode(data))
          }
        } catch (error) {
          console.error('Argument pipeline error:', error)
          const errorEvent = {
            type: 'error' as const,
            data: { message: error instanceof Error ? error.message : 'Unknown error' },
          }
          safeEnqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
        }

        safeClose()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to start argument pipeline' }),
      { status: 500 }
    )
  }
}
