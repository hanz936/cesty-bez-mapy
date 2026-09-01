import { memo } from 'react';
import RatingStars from './RatingStars';
import { formatRatingCs } from '../../utils/rating';

interface ReviewCardProps {
  name: string;
  rating: number;
  text: string;
  /** Název recenzovaného produktu; null když produkt už není veřejně dostupný */
  productTitle: string | null;
  /** Formátované datum, např. "1. července 2026" */
  date: string;
  /** true = recenze z ověřeného nákupu (u nás vždy — sběr je token-only) */
  verified: boolean;
  /**
   * `teaser` = ukázka na detailu produktu (ořez s výpustkou).
   * `full` = plné znění na stránce recenzí.
   */
  variant?: 'teaser' | 'full';
  className?: string;
}

const ReviewCard = memo(({
  name,
  rating,
  text,
  productTitle,
  date,
  verified,
  variant = 'teaser',
  className = ''
}: ReviewCardProps) => {
  return (
    <div className={`bg-white rounded-3xl p-8 lg:p-10 transition-all duration-500 border border-gray-100 group relative overflow-hidden backdrop-blur-sm flex flex-col ${className}`.trim()}>

      {/* Elegant gradient border */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gray-50/30 via-transparent to-gray-50/30 pointer-events-none"></div>
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-800 to-transparent opacity-60"></div>

      {/* Floating quote icon */}
      <div className="absolute -top-2 -right-2 w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-all duration-500">
        <div className="text-green-800 opacity-20 group-hover:opacity-30 transition-opacity duration-300">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z"/>
          </svg>
        </div>
      </div>

      {/* Header with subtle rating */}
      <div className="relative z-10 flex items-center justify-start mb-6 flex-shrink-0 pr-12">
        <div className="flex items-center gap-1.5">
          {/* `decorative` skryje hvězdy před odečítačem a vedle nich se rozsvítí věta.
              Bez toho zbyde v seznamu recenzí holé „5,0", které splyne s cenou i datem:
              deset SVG hvězd nese informaci „ze škály do 5" jen opticky. WCAG 2.2 SC 1.1.1
              a 1.3.1. Stejný vzor drží `ProductRatingSummary` — tady se na něj zapomnělo. */}
          <RatingStars rating={rating} size="w-3.5 h-3.5" className="gap-1.5" decorative />
          <span className="ml-2 text-xs font-medium text-gray-500 tracking-wide">
            <span className="sr-only">Hodnocení </span>{formatRatingCs(rating)}<span className="sr-only"> z 5</span>
          </span>
        </div>
        {verified && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-green-800 bg-green-50 px-2 py-1 rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            Ověřeno nákupem
          </span>
        )}
      </div>

      {/* Review text - fixed height with scroll */}
      <div className="mb-8 flex-grow">
        <p
          className={`text-gray-700 leading-relaxed text-base italic font-light tracking-wide ${
            // `wrap-break-word` je povinné: karta má v základní třídě `overflow-hidden`,
            // takže nezalomitelný token (typicky URL v recenzi) by přetekl a tiše se
            // ustřihl — přesně to, co má `full` odstranit. Formulář povoluje 2 000 znaků.
            // (`wrap-break-word` je v Tailwindu 4 kanonický tvar; starší alias hlásí LSP.)
            variant === 'teaser' ? 'line-clamp-6' : 'whitespace-pre-line wrap-break-word'
          }`}
        >
          "{text}"
        </p>
      </div>

      {/* Footer with enhanced user info - always at bottom */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-100 flex-shrink-0 mt-auto">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-300">
            <span className="text-green-800 font-semibold text-sm">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-green-800 transition-colors duration-300">{name}</p>
            {productTitle && <p className="text-xs text-gray-500">{productTitle}</p>}
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-600 font-medium">{date}</span>
        </div>
      </div>
    </div>
  );
});

ReviewCard.displayName = 'ReviewCard';

export default ReviewCard;