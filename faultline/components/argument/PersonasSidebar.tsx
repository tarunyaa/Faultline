'use client'

import type { QBAFStrength } from '@/lib/argument/types'

interface PersonasSidebarProps {
  experts: string[]
  expertNames: Map<string, string>
  expertAvatars: Map<string, string>
  strengths?: QBAFStrength[]
  phase?: string
}

interface Point { x: number; y: number }

function getVertexPositions(count: number, cx: number, cy: number, radius: number): Point[] {
  const points: Point[] = []
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    })
  }
  return points
}

export function PersonasSidebar({ experts, expertNames, expertAvatars, strengths, phase }: PersonasSidebarProps) {
  if (experts.length === 0) return null

  const activePhases = new Set(['starting', 'experts', 'arguments', 'building'])
  const isActive = phase ? activePhases.has(phase) : false
  const isScored = strengths && strengths.length > 0

  const size = 240
  const cx = size / 2
  const cy = size / 2
  const outerRadius = size / 2 - 44
  const avatarSize = 30
  const vertices = getVertexPositions(experts.length, cx, cy, outerRadius)

  // Find the winner for edge highlighting
  let winnerIdx = -1
  let maxScore = -Infinity
  if (isScored) {
    experts.forEach((expert, i) => {
      const s = strengths.find(st => st.expert === expert)
      if (s?.final_score !== null && s?.final_score !== undefined && s.final_score > maxScore) {
        maxScore = s.final_score
        winnerIdx = i
      }
    })
  }

  return (
    <div className="rounded-xl border border-card-border bg-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
          <span className="text-[10px]">♠</span>
          Personas in Debate
        </h2>
        {isActive && (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[9px] text-muted">live</span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        style={{ maxWidth: size }}
        className="overflow-visible mx-auto block"
      >
        {/* Axis spokes from center to each vertex */}
        {vertices.map((v, i) => (
          <line
            key={`axis-${i}`}
            x1={cx} y1={cy} x2={v.x} y2={v.y}
            stroke="var(--card-border)" strokeWidth={1} opacity={0.25}
          />
        ))}

        {/* Pairwise edges */}
        {experts.length > 1 && experts.map((_, i) =>
          experts.slice(i + 1).map((_, jOffset) => {
            const j = i + 1 + jOffset
            const iIsWinner = i === winnerIdx
            const jIsWinner = j === winnerIdx
            const isWinnerEdge = iIsWinner || jIsWinner

            return (
              <line
                key={`edge-${i}-${j}`}
                x1={vertices[i].x} y1={vertices[i].y}
                x2={vertices[j].x} y2={vertices[j].y}
                stroke={isWinnerEdge ? 'var(--accent)' : 'var(--card-border)'}
                strokeWidth={isWinnerEdge ? 1.5 : 1}
                opacity={isWinnerEdge ? 0.5 : 0.12}
                strokeLinecap="round"
              />
            )
          })
        )}

        {/* Vertex nodes — hex avatars via foreignObject */}
        {experts.map((expert, i) => {
          const v = vertices[i]
          const displayName = expertNames.get(expert) ?? expert
          const avatarUrl = expertAvatars.get(expert)
          const strength = strengths?.find(s => s.expert === expert)
          const isWinner = i === winnerIdx
          const firstName = displayName.split(' ')[0]
          const label = firstName.length > 10 ? firstName.slice(0, 9) + '…' : firstName

          return (
            <g key={expert}>
              {/* Winner glow */}
              {isWinner && (
                <rect
                  x={v.x - avatarSize / 2 - 4} y={v.y - avatarSize / 2 - 4}
                  width={avatarSize + 8} height={avatarSize + 8}
                  rx={4} fill="var(--accent)" opacity={0.12}
                />
              )}

              {/* Hex avatar */}
              <foreignObject
                x={v.x - avatarSize / 2}
                y={v.y - avatarSize / 2}
                width={avatarSize}
                height={avatarSize}
                className="overflow-visible"
              >
                <div className="relative w-full h-full">
                  <div className="absolute inset-[-1px] hex-clip" style={{ background: isWinner ? 'var(--accent)' : 'var(--card-border)' }} />
                  <div className="absolute inset-0 hex-clip overflow-hidden bg-card-bg flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-accent">{displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>
              </foreignObject>

              {/* Name label below avatar */}
              <text
                x={v.x}
                y={v.y + avatarSize / 2 + 11}
                textAnchor="middle"
                className="text-[9px] fill-foreground font-medium"
              >
                {label}
              </text>

              {/* Score below name */}
              {strength?.final_score !== null && strength?.final_score !== undefined && (
                <text
                  x={v.x}
                  y={v.y + avatarSize / 2 + 21}
                  textAnchor="middle"
                  className={`text-[8px] font-mono ${isWinner ? 'fill-accent' : 'fill-muted'}`}
                >
                  {strength.final_score.toFixed(2)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
