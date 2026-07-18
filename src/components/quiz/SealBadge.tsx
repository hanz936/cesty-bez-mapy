interface SealBadgeProps {
  variant: 'check' | 'score';
  tier?: string;
  score?: number;
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * Poštovní pečeť (spec §4.4): krémový podkladový kotouček řeší čitelnost
 * na fotce i tmavém pozadí; inkoust green-900. Dekorativní — aria-hidden.
 */
const SealBadge = ({ variant, tier, score, size = 'lg', className = '' }: SealBadgeProps) => (
  <svg
    viewBox="0 0 120 120"
    aria-hidden="true"
    className={`rotate-[10deg] drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)] ${className}`.trim()}
  >
    <circle cx="60" cy="60" r="58" fill="rgba(255,254,247,0.96)" />
    <circle cx="60" cy="60" r="55" fill="none" stroke="#14532d" strokeWidth="3" />
    {variant === 'score' && size === 'lg' && (
      <circle cx="60" cy="60" r="47" fill="none" stroke="#14532d" strokeWidth="1.2" />
    )}
    {variant === 'check' ? (
      <path
        d="M 38 62 l 15 15 l 29 -32"
        fill="none"
        stroke="#14532d"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : (
      <>
        <text
          x="60"
          y={size === 'lg' ? 42 : 44}
          textAnchor="middle"
          fill="#14532d"
          fontSize={size === 'lg' ? 9 : 10}
          fontWeight="800"
          letterSpacing="0.3"
        >
          {tier?.toUpperCase()}
        </text>
        <text x="60" y={size === 'lg' ? 74 : 78} textAnchor="middle" fill="#14532d" fontSize="26" fontWeight="800">
          {score}&#8202;%
        </text>
        <path
          d="M 34 90 q 6.5 -4 13 0 t 13 0 t 13 0 t 13 0"
          fill="none"
          stroke="#14532d"
          strokeWidth="1.5"
          opacity="0.7"
        />
      </>
    )}
  </svg>
);

export default SealBadge;
