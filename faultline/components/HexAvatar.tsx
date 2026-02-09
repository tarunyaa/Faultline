import Image from 'next/image'

interface HexAvatarProps {
  src?: string
  alt: string
  size?: number
  fallbackInitial?: string
  className?: string
}

export default function HexAvatar({
  src,
  alt,
  size = 48,
  fallbackInitial,
  className = '',
}: HexAvatarProps) {
  const initial = fallbackInitial ?? alt.charAt(0)

  return (
    <div
      className={`relative shrink-0 group ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Hex glow ring on hover */}
      <div
        className="absolute inset-[-3px] hex-clip transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{ background: 'var(--accent-glow)' }}
      />
      {/* Hex border */}
      <div
        className="absolute inset-[-2px] hex-clip transition-colors duration-300"
        style={{ background: 'var(--card-border)' }}
      />
      {/* Hex content */}
      <div className="absolute inset-0 hex-clip overflow-hidden bg-card-bg flex items-center justify-center">
        {src ? (
          <Image
            src={src}
            alt={alt}
            width={size}
            height={size}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-muted font-bold" style={{ fontSize: size * 0.4 }}>
            {initial}
          </span>
        )}
      </div>
    </div>
  )
}
