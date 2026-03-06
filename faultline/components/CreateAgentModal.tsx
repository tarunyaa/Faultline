'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Deck {
  id: string
  name: string
}

interface CreateAgentModalProps {
  decks: Deck[]
}

type Step = 'info' | 'deck' | 'building' | 'done'

interface DoneResult {
  personaId: string
  personaName: string
  deckId: string
  deckName: string
}

export default function CreateAgentModal({ decks }: CreateAgentModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('info')

  // Step 1
  const [name, setName] = useState('')
  const [xHandle, setXHandle] = useState('')
  const [substackUrl, setSubstackUrl] = useState('')
  const [infoError, setInfoError] = useState('')

  // Step 2
  const [deckMode, setDeckMode] = useState<'existing' | 'new'>('existing')
  const [selectedDeckId, setSelectedDeckId] = useState(decks[0]?.id ?? '')
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckTopic, setNewDeckTopic] = useState('')
  const [deckError, setDeckError] = useState('')

  // Step 3
  const [logs, setLogs] = useState<string[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Step 4
  const [done, setDone] = useState<DoneResult | null>(null)
  const [buildError, setBuildError] = useState('')

  function reset() {
    setStep('info')
    setName('')
    setXHandle('')
    setSubstackUrl('')
    setInfoError('')
    setDeckMode('existing')
    setSelectedDeckId(decks[0]?.id ?? '')
    setNewDeckName('')
    setNewDeckTopic('')
    setDeckError('')
    setLogs([])
    setDone(null)
    setBuildError('')
  }

  function close() {
    setOpen(false)
    reset()
  }

  function validateInfo() {
    if (!name.trim()) return 'Persona name is required.'
    if (!xHandle.trim() && !substackUrl.trim()) return 'Provide at least an X handle or Substack URL.'
    return ''
  }

  function validateDeck() {
    if (deckMode === 'existing' && !selectedDeckId) return 'Select a deck.'
    if (deckMode === 'new') {
      if (!newDeckName.trim()) return 'Deck name is required.'
      if (!newDeckTopic.trim()) return 'Debate topic is required.'
    }
    return ''
  }

  async function startBuild() {
    setStep('building')
    setLogs([])
    setBuildError('')

    const slug = newDeckName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    const body = {
      name: name.trim(),
      xHandle: xHandle.trim() || undefined,
      substackUrl: substackUrl.trim() || undefined,
      deckId: deckMode === 'existing' ? selectedDeckId : undefined,
      newDeck:
        deckMode === 'new'
          ? { name: newDeckName.trim(), slug, topic: newDeckTopic.trim() }
          : undefined,
    }

    try {
      const response = await fetch('/api/create-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: readerDone, value } = await reader.read()
        if (readerDone) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const event = JSON.parse(part.slice(6)) as {
            type: string
            message?: string
            personaId?: string
            personaName?: string
            deckId?: string
          }

          if (event.type === 'status') {
            setLogs(prev => {
              const next = [...prev, event.message!]
              setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 10)
              return next
            })
          } else if (event.type === 'complete') {
            const resolvedDeckName =
              deckMode === 'existing'
                ? (decks.find(d => d.id === event.deckId)?.name ?? event.deckId!)
                : newDeckName.trim()
            setDone({
              personaId: event.personaId!,
              personaName: event.personaName!,
              deckId: event.deckId!,
              deckName: resolvedDeckName,
            })
            setStep('done')
            router.refresh()
          } else if (event.type === 'error') {
            setBuildError(event.message ?? 'Unknown error')
            setStep('building')
          }
        }
      }
    } catch (err) {
      setBuildError((err as Error).message ?? 'Network error')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-card-border bg-surface px-4 py-2 text-sm text-muted hover:text-foreground hover:border-muted transition-colors"
      >
        + Create Agent
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={close}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md rounded-xl border border-card-border bg-card-bg p-6 card-shadow space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-0.5">
                  {step === 'info' && 'Step 1 of 3'}
                  {step === 'deck' && 'Step 2 of 3'}
                  {step === 'building' && 'Building...'}
                  {step === 'done' && 'Done'}
                </p>
                <h2 className="text-lg font-bold">
                  {step === 'info' && 'Persona Info'}
                  {step === 'deck' && 'Assign to Deck'}
                  {step === 'building' && name}
                  {step === 'done' && 'Agent Created'}
                </h2>
              </div>
              <button
                onClick={close}
                className="text-muted hover:text-foreground text-xl leading-none transition-colors"
              >
                &times;
              </button>
            </div>

            {/* ── Step 1: Info ── */}
            {step === 'info' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Paul Graham"
                    className="w-full rounded-lg border border-card-border bg-surface px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:border-muted"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">X Handle</label>
                  <div className="flex items-center gap-2 rounded-lg border border-card-border bg-surface px-3 py-2">
                    <span className="text-muted text-sm">@</span>
                    <input
                      type="text"
                      value={xHandle}
                      onChange={e => setXHandle(e.target.value.replace('@', ''))}
                      placeholder="paulg"
                      className="flex-1 bg-transparent text-sm text-foreground placeholder-muted focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Substack URL</label>
                  <input
                    type="url"
                    value={substackUrl}
                    onChange={e => setSubstackUrl(e.target.value)}
                    placeholder="https://paulgraham.substack.com"
                    className="w-full rounded-lg border border-card-border bg-surface px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:border-muted"
                  />
                </div>
                <p className="text-xs text-muted">At least one source required.</p>
                {infoError && <p className="text-xs text-danger">{infoError}</p>}
                <button
                  onClick={() => {
                    const err = validateInfo()
                    if (err) { setInfoError(err); return }
                    setInfoError('')
                    setStep('deck')
                  }}
                  className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 transition-colors"
                >
                  Next &rarr;
                </button>
              </div>
            )}

            {/* ── Step 2: Deck ── */}
            {step === 'deck' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeckMode('existing')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      deckMode === 'existing'
                        ? 'border-accent text-accent bg-accent/5'
                        : 'border-card-border text-muted hover:border-muted'
                    }`}
                  >
                    Existing Deck
                  </button>
                  <button
                    onClick={() => setDeckMode('new')}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      deckMode === 'new'
                        ? 'border-accent text-accent bg-accent/5'
                        : 'border-card-border text-muted hover:border-muted'
                    }`}
                  >
                    New Deck
                  </button>
                </div>

                {deckMode === 'existing' && (
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Select Deck</label>
                    <select
                      value={selectedDeckId}
                      onChange={e => setSelectedDeckId(e.target.value)}
                      className="w-full rounded-lg border border-card-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:border-muted"
                    >
                      {decks.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {deckMode === 'new' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Deck Name *</label>
                      <input
                        type="text"
                        value={newDeckName}
                        onChange={e => setNewDeckName(e.target.value)}
                        placeholder="e.g. Startup Founders"
                        className="w-full rounded-lg border border-card-border bg-surface px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:border-muted"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Debate Topic *</label>
                      <input
                        type="text"
                        value={newDeckTopic}
                        onChange={e => setNewDeckTopic(e.target.value)}
                        placeholder="e.g. Should founders raise VC money?"
                        className="w-full rounded-lg border border-card-border bg-surface px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:border-muted"
                      />
                      <p className="text-xs text-muted mt-1">Used to filter and ground this persona&apos;s contract.</p>
                    </div>
                  </>
                )}

                {deckError && <p className="text-xs text-danger">{deckError}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('info')}
                    className="flex-1 rounded-lg border border-card-border px-4 py-2.5 text-sm text-muted hover:text-foreground transition-colors"
                  >
                    &larr; Back
                  </button>
                  <button
                    onClick={() => {
                      const err = validateDeck()
                      if (err) { setDeckError(err); return }
                      setDeckError('')
                      startBuild()
                    }}
                    className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 transition-colors"
                  >
                    Build Agent
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Building ── */}
            {step === 'building' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-card-border bg-background p-3 h-56 overflow-y-auto font-mono text-xs space-y-1">
                  {logs.map((log, i) => (
                    <div key={i} className="text-foreground/70">
                      <span className="text-accent mr-2">›</span>{log}
                    </div>
                  ))}
                  {!buildError && <div className="text-muted animate-pulse">Running...</div>}
                  <div ref={logsEndRef} />
                </div>
                {buildError && (
                  <div className="space-y-3">
                    <p className="text-xs text-danger">{buildError}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStep('deck')}
                        className="flex-1 rounded-lg border border-card-border px-4 py-2.5 text-sm text-muted hover:text-foreground transition-colors"
                      >
                        &larr; Back
                      </button>
                      <button
                        onClick={startBuild}
                        className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Done ── */}
            {step === 'done' && done && (
              <div className="space-y-4">
                <div className="rounded-lg border border-card-border bg-surface p-4 text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">{done.personaName}</p>
                  <p className="text-xs text-muted">added to {done.deckName}</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/cards/${encodeURIComponent(done.personaId)}`}
                    className="flex-1 rounded-lg border border-card-border px-4 py-2.5 text-sm text-center text-muted hover:text-foreground transition-colors"
                  >
                    View Card
                  </a>
                  <a
                    href="/setup"
                    className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white text-center hover:bg-accent/90 transition-colors"
                  >
                    Build Hand &rarr;
                  </a>
                </div>
                <button onClick={close} className="w-full text-xs text-muted hover:text-foreground transition-colors">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
