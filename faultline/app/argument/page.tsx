import { ArgumentSetup } from '@/components/argument/ArgumentSetup'
import { ArgumentView } from '@/components/argument/ArgumentView'
import { getPersona } from '@/lib/personas/loader'

interface Props {
  searchParams: Promise<{ topic?: string; experts?: string; personas?: string }>
}

export default async function ArgumentPage({ searchParams }: Props) {
  const params = await searchParams
  const topic = params.topic ? decodeURIComponent(params.topic).trim() : ''

  if (!topic) {
    return <ArgumentSetup />
  }

  const numExperts = params.experts ? Math.max(2, Math.min(5, parseInt(params.experts, 10) || 3)) : 3

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

  return (
    <ArgumentView
      config={{
        topic,
        numExperts: personaIds ? personaIds.length : numExperts,
        personaIds,
      }}
      personaNames={personaNames}
      personaAvatars={personaAvatars}
    />
  )
}
