'use client'

import Image from 'next/image'
import Link from 'next/link'

interface PersonaCardProps {
  id: string
  name: string
  handle: string
  picture: string
  locked?: boolean
  selected?: boolean
  disabled?: boolean
  selectable?: boolean
  onToggle?: (id: string) => void
}

export default function PersonaCard({
  id,
  name,
  handle,
  picture,
  locked,
  selected,
  disabled,
  selectable,
  onToggle,
}: PersonaCardProps) {
  const card = (
    <div
      className={`
        rounded-xl border p-4 flex items-center gap-4 transition-colors
        ${locked
          ? 'border-card-border bg-card-bg/50 opacity-50 cursor-not-allowed'
          : selected
            ? 'border-accent bg-accent-dim/20 cursor-pointer'
            : disabled
              ? 'border-card-border bg-card-bg opacity-40 cursor-not-allowed'
              : 'border-card-border bg-card-bg hover:border-muted cursor-pointer'
        }
      `}
      onClick={() => {
        if (selectable && !locked && !disabled && onToggle) {
          onToggle(id)
        }
      }}
    >
      {picture ? (
        <Image
          src={picture}
          alt={name}
          width={48}
          height={48}
          className="rounded-full shrink-0"
          unoptimized
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-card-border shrink-0 flex items-center justify-center text-muted text-lg font-bold">
          {name.charAt(0)}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-semibold truncate">{locked ? 'Locked' : name}</p>
        {handle && !locked && (
          <p className="text-muted text-sm truncate">{handle}</p>
        )}
        {locked && (
          <p className="text-muted text-xs">Data not available</p>
        )}
      </div>
      {selectable && !locked && (
        <div className="ml-auto shrink-0">
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              selected
                ? 'border-accent bg-accent'
                : 'border-muted'
            }`}
          >
            {selected && (
              <svg viewBox="0 0 12 12" className="w-3 h-3 text-black">
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (selectable || locked) {
    return card
  }

  return (
    <Link href={`/cards/${encodeURIComponent(id)}`}>
      {card}
    </Link>
  )
}
