import { Link } from 'react-router-dom';
import type { Crumb } from '../../utils/breadcrumbs';

interface BreadcrumbsProps {
  crumbs: Crumb[];
  className?: string;
}

/**
 * Viditelná drobečková navigace. Vykresluje přesně ten seznam, ze kterého se skládá
 * i `BreadcrumbList` (viz `utils/breadcrumbs.ts`) — markup tak nemůže tvrdit cestu,
 * kterou uživatel na stránce nevidí.
 *
 * `<nav>` je pojmenovaný schválně: na stránce už jeden orientační bod `nav` je
 * (navigace v `Layout`) a dva nepojmenované se v odečítači nedají rozlišit.
 * Jméno je „Drobečky", ne „Drobečková navigace": čtečka roli ohlásí sama, takže by
 * zaznělo „navigace" dvakrát (MDN, role navigation: „omitting the term navigation").
 * Stejné jméno nesou jednopoložkové drobečky na detailu produktu a itineráře.
 * Oddělovač „/" je `aria-hidden` — hierarchii nese seznam, přečítat ho nahlas
 * by bylo jen šumem navíc. Poslední položka není odkaz (vedl by sám na sebe)
 * a nese `aria-current="page"`.
 */
export default function Breadcrumbs({ crumbs, className = '' }: BreadcrumbsProps) {
  return (
    <nav aria-label="Drobečky" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {crumbs.map((crumb, index) => (
          <li key={crumb.path ?? '#aktualni'} className="flex items-center gap-x-2">
            {index > 0 && (
              <span aria-hidden="true" className="text-gray-500">
                /
              </span>
            )}
            {crumb.path ? (
              <Link to={crumb.path} className="text-green-800 underline underline-offset-4">
                {crumb.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-gray-700">
                {crumb.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
