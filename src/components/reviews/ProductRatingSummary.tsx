import { Link } from 'react-router-dom';
import { formatRatingCs, roundRating } from '../../utils/rating';
import { reviewCountLabel } from './reviewCountLabel';
import RatingStars from '../ui/RatingStars';

interface ProductRatingSummaryProps {
  average: number;
  count: number;
  /** Když chybí, vykreslí se statický text (stránka by odkazovala sama na sebe). */
  href?: string;
  className?: string;
}

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
      <RatingStars rating={roundedAverage} className="items-center gap-0.5" decorative />
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
