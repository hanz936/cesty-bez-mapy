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
  // Šipky si stranu dopočítávají (`currentPage ± 1`), takže obcházejí filtr, který má
  // `paginationItems` uvnitř — z necelého čísla by vyrobily odkaz na `/strana/1.5`.
  // Doménový predikát `isPagedPage` se sem schválně netahá: komponenta dostává
  // `buildHref` zvenčí a o recenzích nic neví. Tohle je defenzivní guard, ne rozhodnutí.
  const hasIntegerPage = Number.isInteger(currentPage);

  return (
    <nav aria-label="Stránkování recenzí" className={`flex justify-center ${className}`.trim()}>
      {/* `role="list"` schválně: Tailwind Preflight nastavuje `list-style: none` a seznam
          bez odrážek pak VoiceOver jako seznam neohlásí — doporučuje to dokumentace
          Tailwindu. U stránkování ta ztráta bolí, „seznam, N položek" říká, kolik je stran. */}
      <ul role="list" className="flex flex-wrap items-center gap-2">
        {hasIntegerPage && currentPage > 1 && (
          <li>
            <Link to={buildHref(currentPage - 1)} className={linkClass} aria-label="Předchozí strana">
              ‹
            </Link>
          </li>
        )}
        {items.map((item, index) =>
          item === 'gap' ? (
            // `gray-500` (4,84 : 1), ne `gray-400` (2,60 : 1): výpustka je jediný vizuální
            // signál, že se strany přeskakují. Audit A-10, stejná volba jako oddělovač
            // v `Breadcrumbs`.
            <li key={`gap-${index}`} className="px-1 text-gray-500" aria-hidden="true">
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
        {hasIntegerPage && currentPage < totalPages && (
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
