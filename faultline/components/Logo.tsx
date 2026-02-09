interface LogoProps {
  size?: number
  className?: string
}

export default function Logo({ size = 64, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size * 1.4}
      viewBox="0 0 64 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Card outline */}
      <rect
        x="1"
        y="1"
        width="62"
        height="88"
        rx="6"
        stroke="#dc2626"
        strokeWidth="2"
        fill="#111113"
      />

      {/* Inner border */}
      <rect
        x="5"
        y="5"
        width="54"
        height="80"
        rx="3"
        stroke="#1e1e22"
        strokeWidth="1"
        fill="none"
      />

      {/* Top-left rank "F" */}
      <text
        x="10"
        y="22"
        fill="#dc2626"
        fontSize="14"
        fontFamily="Georgia, serif"
        fontWeight="bold"
      >
        F
      </text>

      {/* Top-left suit (spade) */}
      <text
        x="10.5"
        y="33"
        fill="#dc2626"
        fontSize="10"
        fontFamily="serif"
      >
        ♠
      </text>

      {/* Center diamond with fault line */}
      <g transform="translate(32, 45)">
        {/* Diamond shape */}
        <path
          d="M0 -16 L12 0 L0 16 L-12 0 Z"
          fill="none"
          stroke="#dc2626"
          strokeWidth="1.5"
        />
        {/* Fault line crack */}
        <path
          d="M-8 -6 L-2 -1 L-5 4 L2 8 L8 6"
          fill="none"
          stroke="#f0f0f0"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      {/* Bottom-right rank "F" (inverted) */}
      <text
        x="54"
        y="80"
        fill="#dc2626"
        fontSize="14"
        fontFamily="Georgia, serif"
        fontWeight="bold"
        textAnchor="end"
        transform="rotate(180, 54, 74)"
      >
        F
      </text>

      {/* Bottom-right suit (spade, inverted) */}
      <text
        x="53.5"
        y="69"
        fill="#dc2626"
        fontSize="10"
        fontFamily="serif"
        textAnchor="end"
        transform="rotate(180, 53.5, 63)"
      >
        ♠
      </text>
    </svg>
  )
}
