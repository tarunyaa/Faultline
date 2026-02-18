'use client'

// ─── Client Component Wrapper ────────────────────────────────

import { DialogueView } from '@/components/dialogue/DialogueView'

interface DialogueClientProps {
  topic: string
  personaIds: string[]
  personaNames: Map<string, string>
  personaAvatars: Map<string, string>
}

export function DialogueClient({ topic, personaIds, personaNames, personaAvatars }: DialogueClientProps) {
  return <DialogueView topic={topic} personaIds={personaIds} personaNames={personaNames} personaAvatars={personaAvatars} />
}
