'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ArgumentSetup() {
  const [topic, setTopic] = useState('')
  const [numExperts, setNumExperts] = useState(3)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = topic.trim()
    if (!t) return
    const params = new URLSearchParams({ topic: t, experts: String(numExperts) })
    router.push(`/argument?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">ARGORA</h1>
          <p className="mt-2 text-sm text-muted">
            Structured argumentation with auto-generated expert panels.
            Enter a topic and the system builds the debate.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="topic" className="block text-xs font-semibold text-muted uppercase tracking-widest mb-2">
              Topic
            </label>
            <textarea
              id="topic"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Should governments regulate large language models?"
              rows={3}
              className="w-full bg-card-bg border border-card-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted text-sm resize-none focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="experts" className="block text-xs font-semibold text-muted uppercase tracking-widest mb-2">
              Expert Count
            </label>
            <div className="flex gap-2">
              {[2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumExperts(n)}
                  className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
                    numExperts === n
                      ? 'bg-accent border-accent text-foreground'
                      : 'bg-card-bg border-card-border text-muted hover:border-accent hover:text-foreground'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!topic.trim()}
            className="w-full bg-accent hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-foreground font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            Run ARGORA
          </button>
        </form>
      </div>
    </div>
  )
}
