import { NextRequest } from 'next/server'
import { runBatchBenchmark } from '@/lib/argument/benchmarks/runner'
import type { Dataset } from '@/lib/argument/benchmarks/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 600 // 10 min — batch benchmarks are slow

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()

  try {
    const body = await req.json() as {
      dataset: Dataset
      questionCount: number
      seed?: number
    }

    if (!body.dataset || !body.questionCount) {
      return new Response(
        JSON.stringify({ error: 'dataset and questionCount are required' }),
        { status: 400 }
      )
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
          for await (const event of runBatchBenchmark(
            body.dataset,
            body.questionCount,
            body.seed ?? 42,
          )) {
            const data = `data: ${JSON.stringify(event)}\n\n`
            safeEnqueue(encoder.encode(data))
          }
        } catch (error) {
          console.error('Benchmark error:', error)
          const errorEvent = {
            type: 'error' as const,
            message: error instanceof Error ? error.message : 'Unknown error',
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
      JSON.stringify({ error: 'Failed to start benchmark' }),
      { status: 500 }
    )
  }
}
