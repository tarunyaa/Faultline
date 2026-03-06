import { ArgumentSetup } from '@/components/argument/ArgumentSetup'
import { ArgumentView } from '@/components/argument/ArgumentView'
import { GraphDebateView } from '@/components/argument/GraphDebateView'
import { getPersona } from '@/lib/personas/loader'

interface Props {
  searchParams: Promise<{ topic?: string; experts?: string; personas?: string; engine?: string }>
}

export default async function ArgumentPage({ searchParams }: Props) {
  const params = await searchParams
  const topic = params.topic ? decodeURIComponent(params.topic).trim() : ''

  if (!topic) {
    return <ArgumentSetup />
  }

  const numExperts = params.experts ? Math.max(2, Math.min(5, parseInt(params.experts, 10) || 3)) : 3
  const engine = params.engine ?? 'graph'

  // Parse persona IDs from URL (comma-separated)
  const personaIds = params.personas
    ? params.personas.split(',').map(id => decodeURIComponent(id)).slice(0, 5)
    : undefined

  // Load persona names + avatars for display
  const personaNames = new Map<string, string>()
  const personaAvatars = new Map<string, string>()
  if (personaIds) {
    for (const id of personaIds) {
      const persona = await getPersona(id)
      if (persona) {
        personaNames.set(id, persona.name)
        if (persona.twitterPicture) personaAvatars.set(id, persona.twitterPicture)
      }
    }
  }

  // Graph 2.0: crux-personas engine with personality agent injection
  if (personaIds && personaIds.length > 0 && engine === 'crux') {
    return (
      <ArgumentView
        config={{
          topic,
          numExperts: personaIds.length,
          personaIds,
          skipBaselines: true,
        }}
        personaNames={personaNames}
        personaAvatars={personaAvatars}
      />
    )
  }

  // Graph (classic): argora-personas engine
  if (personaIds && personaIds.length > 0) {
    return (
      <GraphDebateView
        config={{
          topic,
          numExperts: personaIds.length,
          personaIds,
          skipBaselines: true,
          useCrux: false,
        }}
        personaNames={personaNames}
        personaAvatars={personaAvatars}
      />
    )
  }

  return (
    <ArgumentView
      config={{
        topic,
        numExperts,
        skipBaselines: true,
      }}
      personaNames={personaNames}
      personaAvatars={personaAvatars}
    />
  )
}
