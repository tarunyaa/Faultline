const SUITS = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
} as const

interface SuitIconProps {
  suit: keyof typeof SUITS
  className?: string
}

export default function SuitIcon({ suit, className = '' }: SuitIconProps) {
  const isRed = suit === 'heart' || suit === 'diamond'
  return (
    <span className={`${isRed ? 'text-accent' : 'text-foreground/40'} ${className}`}>
      {SUITS[suit]}
    </span>
  )
}
