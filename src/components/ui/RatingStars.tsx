import type { CSSProperties } from 'react';

interface StarIconProps {
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

/** Jediné místo, které nese cestu pěticípé hvězdy — barvu a velikost určuje volající přes `className`. */
export const StarIcon = ({ className, style, ...rest }: StarIconProps) => (
  <svg className={className} style={style} fill="currentColor" viewBox="0 0 24 24" {...rest}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

interface RatingStarsProps {
  rating: number;
  /** Velikost jedné hvězdy (Tailwind `w-* h-*`). */
  size?: string;
  /** Barva vyplněné/půl hvězdy. */
  filledClassName?: string;
  /** Barva prázdné hvězdy pod ní. */
  emptyClassName?: string;
  /** Třídy na obalový řádek (rozestupy mezi hvězdami apod.). */
  className?: string;
  /** True, když řádek nese jen dekoraci a význam je vyjádřen textem vedle něj. */
  decorative?: boolean;
}

/**
 * Řádek pěti hvězd s podporou půl hvězdy (ořez `clip-path` na 50 %).
 * Cesta hvězdy je jen v `StarIcon` — každé volající místo si drží vlastní
 * velikost a barvy, ale plný/půl/prázdný výpočet je společný.
 */
const RatingStars = ({
  rating,
  size = 'w-4 h-4',
  filledClassName = 'text-green-800',
  emptyClassName = 'text-gray-300',
  className = '',
  decorative = false,
}: RatingStarsProps) => (
  <span className={`flex ${className}`.trim()} {...(decorative ? { 'aria-hidden': 'true' as const } : {})}>
    {Array.from({ length: 5 }, (_, index) => {
      const starNumber = index + 1;
      const isFull = starNumber <= Math.floor(rating);
      const isHalf = starNumber === Math.ceil(rating) && rating % 1 !== 0;
      return (
        <span key={starNumber} className="relative inline-flex">
          <StarIcon className={`${size} ${emptyClassName}`} />
          {(isFull || isHalf) && (
            <StarIcon
              className={`${size} ${filledClassName} absolute top-0 left-0`}
              style={{ clipPath: isHalf ? 'inset(0 50% 0 0)' : 'none' }}
              data-testid={isHalf ? 'half-star' : undefined}
            />
          )}
        </span>
      );
    })}
  </span>
);

export default RatingStars;
