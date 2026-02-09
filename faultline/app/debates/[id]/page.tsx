import { notFound } from 'next/navigation'
import { getDebateById } from '@/lib/db/debates'
import { getPersonas } from '@/lib/personas/loader'
import { hydrateDebateState } from '@/lib/hooks/hydrateDebateState'
import DebateReplay from '@/components/DebateReplay'
import type { SSEEvent, DebateMode } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DebateDetailPage({ params }: PageProps) {
  const { id } = await params
  const row = await getDebateById(id)
  if (!row) notFound()

  const events = row.events as SSEEvent[]
  const state = hydrateDebateState(events)

  const personas = await getPersonas()
  const personaIds = row.personaIds as string[]
  const personaMap = new Map(personas.map(p => [p.id, p]))

  const personaMetas = personaIds.map(pid => {
    const p = personaMap.get(pid)
    return {
      id: pid,
      name: p?.name ?? pid,
      picture: p?.twitterPicture ?? '',
    }
  })

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <DebateReplay
          topic={row.topic}
          mode={row.mode as DebateMode}
          personaMetas={personaMetas}
          state={state}
          createdAt={row.createdAt.toISOString()}
          hasError={row.status === 'error'}
        />
      </div>
    </div>
  )
}
