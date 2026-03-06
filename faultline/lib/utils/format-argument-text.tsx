import React from 'react'

/**
 * Formats raw argument text into structured JSX.
 * Handles: **bold** → <strong>, ## headers → bold line, bullet points,
 * paragraph breaks, and strips markdown artifacts.
 */
export function formatArgumentText(text: string): React.ReactNode {
  if (!text) return null

  // Split into lines
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (!line) continue

    // Strip ## headers — render as bold text on its own line
    if (line.startsWith('#')) {
      line = line.replace(/^#+\s*/, '')
      elements.push(
        <span key={key++} className="block font-semibold text-foreground mt-1.5 mb-0.5">
          {inlineFormat(line)}
        </span>
      )
      continue
    }

    // Bullet points: -, *, numbered lists
    const bulletMatch = line.match(/^(?:[-*]|\d+[.)]) (.+)/)
    if (bulletMatch) {
      elements.push(
        <span key={key++} className="flex items-start gap-1.5 mt-0.5">
          <span className="text-accent flex-shrink-0 mt-px">·</span>
          <span>{inlineFormat(bulletMatch[1])}</span>
        </span>
      )
      continue
    }

    // Regular paragraph line
    elements.push(
      <span key={key++} className="block mt-1">
        {inlineFormat(line)}
      </span>
    )
  }

  return <>{elements}</>
}

/** Inline formatting: **bold** → <strong>, *italic* → <em>, strip **** noise */
function inlineFormat(text: string): React.ReactNode {
  // Replace **** (empty bold) with nothing
  text = text.replace(/\*{4,}/g, '')
  // Replace ** ** (bold space) with nothing
  text = text.replace(/\*\*\s*\*\*/g, '')

  // Split on **bold** patterns
  const parts = text.split(/(\*\*[^*]+?\*\*)/)
  if (parts.length === 1) return text

  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*\*(.+?)\*\*$/)
    if (boldMatch) {
      return <strong key={i} className="font-semibold text-foreground">{boldMatch[1]}</strong>
    }
    return part
  })
}
