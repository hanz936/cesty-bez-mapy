import { Link } from 'react-router-dom';
import { paginationItems } from './paginationItems';

interface ReviewsPaginationProps {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
  className?: string;
}

const linkClass =
  'inline-flex items-center justify-center min-w-10 h-10 px-3 rounded-xl border border-gray-200 text-gray-700 hover:border-green-800 hover:text-green-800 transition-colors';
const currentClass =
  'inline-flex items-center justify-center min-w-10 h-10 px-3 rounded-xl bg-green-800 text-white font-medium';

/**
 * Stránkování recenzí. Vždy odkazy, nikdy tlačítka — Google crawler neklikne
 * na tlačítko a další strany by nenašel. Odkaz na stranu 1 je vždy přítomný,
 * protože dokumentace doporučuje zdůraznit začátek kolekce.
 *
 * Aktuální strana zůstává odkazem s `aria-current="page"`, jak doporučuje W3C
 * Design System: „it is fully linked so users of Assistive Technology can find
 * which is the currently active link."
 *
 * Šipky `‹`/`›` se nedublují s `aria-label` — přístupný název odkazu ho nahrazuje,
 * a WCAG 2.5.3 symbolicky užitý znak za viditelný popisek nepovažuje.
 */
const ReviewsPagination = ({ currentPage, totalPages, buildHref, className = '' }: ReviewsPaginationProps) => {
  if (totalPages <= 1) return null;

  const items = paginationItems(currentPage, totalPages);

  return (
    <nav aria-label="Stránkování recenzí" className={`flex justify-center ${className}`.trim()}>
      <ul className="flex flex-wrap items-center gap-2">
        {currentPage > 1 && (
          <li>
            <Link to={buildHref(currentPage - 1)} className={linkClass} aria-label="Předchozí strana">
              ‹
            </Link>
          </li>
        )}
        {items.map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} className="px-1 text-gray-400" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                to={buildHref(item)}
                className={item === currentPage ? currentClass : linkClass}
                aria-label={`Strana ${item}`}
                aria-current={item === currentPage ? 'page' : undefined}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        {currentPage < totalPages && (
          <li>
            <Link to={buildHref(currentPage + 1)} className={linkClass} aria-label="Další strana">
              ›
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default ReviewsPagination;
