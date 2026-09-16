/**
 * Drobečková navigace — JEDEN zdroj pro to, co je na stránce vidět, i pro `BreadcrumbList`.
 *
 * Proč jedno pole místo dvou seznamů: Google zakazuje markovat obsah, který na stránce
 * není („Don't mark up content that is not visible to readers of the page", pravidla
 * strukturovaných dat, aktualizovaná 10. 7. 2026). Dva nezávislé seznamy by se dřív nebo
 * později rozešly a ten rozpor by nikdo neviděl — JSON-LD není vidět a viditelná cesta
 * se netestuje sama od sebe. Proto `Crumb[]` vzniká jednou a používají ho obě strany.
 *
 * Poslední položka schválně nemá `path` — je to stránka, na které uživatel stojí.
 * Google to tak přímo popisuje: „If the breadcrumb is the last item in the breadcrumb
 * trail, `item` is not required. If `item` isn't included for the last item, Google uses
 * the URL of the containing page." Díky tomu funguje tentýž seznam i na stránkovaných
 * stranách recenzí: poslední položka se sama přepíše na adresu té které strany, takže
 * `/recenze/strana/2` neukazuje na stranu 1.
 */
export interface Crumb {
  name: string;
  /** Relativní cesta. Chybí u poslední položky — tam adresu dosadí Google sám. */
  path?: string;
}

interface BreadcrumbItemJsonLd {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string;
}

export interface BreadcrumbListJsonLd {
  '@context': string;
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbItemJsonLd[];
}

/** Google chce v `BreadcrumbList` aspoň dvě položky; při jedné markup tiše zahodí. */
export const MIN_BREADCRUMB_ITEMS = 2;

/**
 * `BreadcrumbList` z viditelné cesty. `position` je 1-based (docs: „Position 1 signifies
 * the beginning of the trail"), `item` se skládá na absolutní adresu, protože relativní
 * cesta by v strukturovaných datech neměla čím být doplněna.
 */
export function buildBreadcrumbJsonLd(crumbs: Crumb[], siteUrl: string): BreadcrumbListJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => {
      const item: BreadcrumbItemJsonLd = {
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
      };
      if (crumb.path) item.item = `${siteUrl}${crumb.path}`;
      return item;
    }),
  };
}
