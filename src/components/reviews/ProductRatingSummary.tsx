import { Link } from 'react-router-dom';
import { formatRatingCs, roundRating } from '../../utils/rating';
import { reviewCountLabel } from './reviewCountLabel';

interface ProductRatingSummaryProps {
  average: number;
  count: number;
  /** Když chybí, vykreslí se statický text (stránka by odkazovala sama na sebe). */
  href?: string;
  className?: string;
}

/** Hvězdičky nesou jen dekoraci — význam je v textu vedle nich. */
const Stars = ({ average }: { average: number }) => (
  <span className="flex items-center gap-0.5" aria-hidden="true">
    {Array.from({ length: 5 }, (_, index) => {
      const starNumber = index + 1;
      const isFull = starNumber <= Math.floor(average);
      const isHalf = starNumber === Math.ceil(average) && average % 1 !== 0;
      return (
        <span key={starNumber} className="relative inline-flex">
          <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {(isFull || isHalf) && (
            <svg
              className="w-4 h-4 text-green-800 absolute top-0 left-0"
              fill="currentColor"
              viewBox="0 0 24 24"
              style={{ clipPath: isHalf ? 'inset(0 50% 0 0)' : 'none' }}
              data-testid={isHalf ? 'half-star' : undefined}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          )}
        </span>
      );
    })}
  </span>
);

/**
 * Souhrn hodnocení produktu. Google vyžaduje, aby byl průměr z `aggregateRating`
 * na stránce vidět, ne jen v JSON-LD.
 */
const ProductRatingSummary = ({ average, count, href, className = '' }: ProductRatingSummaryProps) => {
  if (count === 0) return null;

  const formattedAverage = formatRatingCs(average);
  const label = `${count} ${reviewCountLabel(count)}`;
  // Hvězdičky se kreslí ze ZAOKROUHLENÉ hodnoty, ne ze syrového průměru —
  // jinak by mohly ukazovat jiný počet plných/půl hvězd, než kolik říká
  // číslo vedle nich (např. 4.96 → text „5,0", ale hvězdičky by z 4.96
  // dokreslily 4 plné + 1 půl). `roundRating` je jediné místo, které o
  // zaokrouhlení rozhoduje.
  const roundedAverage = roundRating(average);
  // Skryté fragmenty dávají větě smysl tam, kde souhrn není odkaz (hvězdičky
  // i oddělovač jsou aria-hidden). Ve variantě s href jsou zbytečné — `aria-label`
  // na <Link> přebíjí přístupný název celého podstromu, takže by se jen zdvojily.
  const body = (
    <>
      <Stars average={roundedAverage} />
      {!href && <span className="sr-only">Hodnocení </span>}
      <span className="font-semibold text-gray-900">{formattedAverage}</span>
      {!href && <span className="sr-only"> z 5,</span>}
      <span className="text-gray-500" aria-hidden="true">·</span>
      <span className="text-gray-600">{label}</span>
    </>
  );
  const shared = `inline-flex items-center gap-2 text-sm ${className}`.trim();

  if (!href) {
    return <div className={shared}>{body}</div>;
  }
  return (
    <Link
      to={href}
      className={`${shared} hover:text-green-800 underline-offset-4 hover:underline`}
      aria-label={`Hodnocení ${formattedAverage} z 5, ${label} — zobrazit všechny recenze`}
    >
      {body}
    </Link>
  );
};

export default ProductRatingSummary;
