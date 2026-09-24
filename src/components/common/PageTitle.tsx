import { APP_CONFIG } from '../../constants/app';

interface PageTitleProps {
  /** Holý název stránky, přípona „| Cesty bez mapy" se přidá tady. */
  title: string;
  /** `true` → `<meta name="robots" content="noindex">` (transakční a chybové stránky). */
  noindex?: boolean;
}

/**
 * `<title>` (a volitelně `noindex`) pro stránky, které nepotřebují celé `SeoTags`.
 *
 * Skořápka (`index.html`) žádný statický `<title>` nemá a React 19 při odchodu ze stránky
 * odebere jen svůj vlastní — stránka bez titulku by tak po navigaci v aplikaci nesla titulek
 * té předchozí (v záložce, historii i záložkách prohlížeče).
 *
 * Canonical tu schválně NENÍ: s `noindex` by si odporoval a stránky, které tuhle komponentu
 * používají, do indexu nepatří nebo canonical nepotřebují (stejné pravidlo jako `NotFound.tsx`).
 *
 * React chce v jednu chvíli jen jeden `<title>` a jeho potomek musí být jediný řetězec —
 * proto template literal, ne `{title} | …`.
 */
export default function PageTitle({ title, noindex = false }: PageTitleProps) {
  return (
    <>
      <title>{`${title} | ${APP_CONFIG.SITE_NAME}`}</title>
      {noindex && <meta name="robots" content="noindex" />}
    </>
  );
}
