'use client'

// ─── Dialogue Layout: Chat + Sidebar + Bottom Drawer ─────────
// 70% main chat | 30% crux card sidebar
// Bottom drawer for active/completed crux rooms (like IDE terminal tabs)

import { useState } from 'react'
import { MessageThread } from './MessageThread'
import { PlayingCard } from '@/components/crux/PlayingCard'
import { CruxRoom } from '@/components/crux/CruxRoom'
import type { DialogueMessage } from '@/lib/dialogue/types'
import type { CruxCard as CruxCardType } from '@/lib/crux/types'
import type { ActiveCruxRoom } from '@/lib/hooks/useDialogueStream'

interface DialogueLayoutProps {
  topic: string
  messages: DialogueMessage[]
  cruxCards: CruxCardType[]
  activeCruxRooms: Map<string, ActiveCruxRoom>
  completedRooms: Map<string, ActiveCruxRoom>
  personaNames: Map<string, string>
  personaAvatars: Map<string, string>
  isRunning: boolean
  isComplete: boolean
}

export function ThreeColumnLayout({
  topic,
  messages,
  cruxCards,
  activeCruxRooms,
  completedRooms,
  personaNames,
  personaAvatars,
  isRunning,
  isComplete,
}: DialogueLayoutProps) {
  const [openRoomId, setOpenRoomId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // All rooms (active + completed) for the tab bar
  const allRooms = new Map([...completedRooms, ...activeCruxRooms])

  function toggleRoom(roomId: string) {
    if (openRoomId === roomId && drawerOpen) {
      setDrawerOpen(false)
    } else {
      setOpenRoomId(roomId)
      setDrawerOpen(true)
    }
  }

  const openRoom = openRoomId ? allRooms.get(openRoomId) : null
  const hasRooms = allRooms.size > 0

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-card-border bg-card-bg px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">{topic}</h1>
            <div className="flex gap-2 mt-1.5">
              {Array.from(personaNames.values()).map(name => (
                <span key={name} className="text-xs text-muted border border-card-border px-2 py-0.5 rounded">
                  {name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {cruxCards.length > 0 && (
              <span className="text-xs text-muted">
                <span className="text-accent font-semibold">{cruxCards.length}</span> crux{cruxCards.length !== 1 ? 'es' : ''} found
              </span>
            )}
            {isRunning && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Live
              </div>
            )}
            {isComplete && (
              <span className="text-xs text-muted">{messages.length} messages</span>
            )}
          </div>
        </div>
      </div>

      {/* Main area: chat (70%) + crux card sidebar (30%) */}
      <div
        className="flex-1 overflow-hidden flex"
        style={{ height: drawerOpen ? 'calc(100% - 40px - 35vh)' : undefined }}
      >
        {/* Chat — 70% */}
        <div className="flex flex-col border-r border-card-border" style={{ width: '70%' }}>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted text-sm">Starting conversation...</p>
              </div>
            ) : (
              <MessageThread messages={messages} personaNames={personaNames} personaAvatars={personaAvatars} />
            )}
          </div>
        </div>

        {/* Crux card sidebar — 30% */}
        <div className="flex flex-col overflow-hidden" style={{ width: '30%' }}>
          <div className="px-4 py-3 border-b border-card-border flex-shrink-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Crux Cards
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {cruxCards.length === 0 ? (
              <p className="text-xs text-muted text-center mt-8">
                Cards appear after crux rooms resolve
              </p>
            ) : (
              <div className="space-y-3">
                {cruxCards.map((card, i) => (
                  <PlayingCard key={card.id} card={card} personaNames={personaNames} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom drawer — crux rooms */}
      {hasRooms && (
        <div className="flex-shrink-0 border-t border-card-border">
          {/* Drawer content (when open) */}
          {drawerOpen && openRoom && (
            <div className="bg-card-bg border-b border-card-border" style={{ height: '35vh' }}>
              <CruxRoom
                roomId={openRoom.roomId}
                question={openRoom.question}
                messages={openRoom.messages}
                personaNames={personaNames}
                status={openRoom.status}
              />
            </div>
          )}

          {/* Tab bar */}
          <div className="bg-surface flex items-center gap-1 px-3 py-1.5 overflow-x-auto">
            <span className="text-xs text-muted mr-2 flex-shrink-0">Crux Rooms:</span>
            {Array.from(allRooms.values()).map(room => {
              const isActive = room.status === 'arguing'
              const isOpen = openRoomId === room.roomId && drawerOpen
              return (
                <button
                  key={room.roomId}
                  onClick={() => toggleRoom(room.roomId)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs whitespace-nowrap transition-all border ${
                    isOpen
                      ? 'bg-card-bg border-accent text-foreground'
                      : 'bg-surface border-card-border text-muted hover:text-foreground hover:border-muted'
                  }`}
                >
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
                  )}
                  {!isActive && <span className="text-accent">♠</span>}
                  <span className="max-w-[160px] truncate">
                    {personaNames.get(room.personas[0]) ?? room.personas[0]}
                    {' & '}
                    {personaNames.get(room.personas[1]) ?? room.personas[1]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
