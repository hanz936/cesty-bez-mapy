import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * Strážce hlavní oblasti dokumentu.
 *
 * Grepuje zdroják, nerenderuje. Druhou hlavní oblast žádný test stránky nechytí:
 * jsdom dva `main` landmarky vedle sebe klidně vykreslí a `getAllByRole` je oba
 * vrátí, takže aserce zůstane zelená. Poznat se to dá jen na zdrojáku.
 *
 * Cesty jsou relativní ke kořeni projektu — tam Vitest běží. `new URL(…, import.meta.url)`
 * tu použít nejde, Vite ho přepíše na asset URL a čtení spadne na ERR_INVALID_URL_SCHEME.
 */
const SRC = 'src';

/** Jediné místo, kde hlavní oblast vzniknout smí. */
const LAYOUT = 'components/layout/Layout.tsx';

/** Stránky. Každá z nich musí hlavní oblast dostat z Layoutu. */
const PAGES = 'src/pages';

/**
 * `role="banner"` na sekci uvnitř stránky. Web žádnou skutečnou hlavičku nemá —
 * `Navigation` je `<nav>` — takže každý výskyt je omyl: hero je obsah stránky,
 * ne hlavička webu. Až hlavička vznikne, patří jako `<header>` do `Layout`
 * a tahle aserce se upraví vědomě, ne omylem.
 */
const BANNER_ROLE = /role=["']banner["']/;

/**
 * Obě podoby hlavní oblasti. Samotné `<main` by minulo `<section role="main">`,
 * což je pro čtečku totéž — a přesně v té podobě to bylo v `MyStory`
 * a `Collaboration`, kde by grep na tag nenašel nic.
 */
const MAIN_LANDMARK = /<main[\s>]|role=["']main["']/;

/**
 * Otevírací tag orientačního bodu navigace — `<nav …>` i `<… role="navigation">`.
 * `[^>]*` stačí: žádný `<nav>` v repu nemá v atributech výraz s `>`. Tag v komentáři
 * je psaný v backtickách, proto `(?<!`)` — jinak by strážce hlásil komentáře.
 */
const NAVIGATION_TAG = /(?<!`)<nav\b[^>]*>|(?<!`)<[a-z]+\b[^>]*role=["']navigation["'][^>]*>/g;
const HAS_NAME = /\saria-label(?:ledby)?=/;

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.'))
    .sort();
}

describe('orientační body dokumentu', () => {
  it('hlavní oblast renderuje jediné místo — Layout', () => {
    // WHATWG: „A document must not have more than one main element that does not
    // have the hidden attribute specified." Druhý `main` navíc není hierarchicky
    // korektní (předci smí být jen html, body, div a form bez přístupného jména).
    // Prakticky: čtečka nabídne dvě „hlavní oblasti" a skip-link vysadí uživatele
    // nad obsahem stránky, ne u něj.
    const offenders = sourceFiles().filter((file) => MAIN_LANDMARK.test(readFileSync(`${SRC}/${file}`, 'utf8')));

    expect(offenders).toEqual([LAYOUT]);
  });

  it('skip-link míří na id, které hlavní oblast opravdu má', () => {
    // Kdyby se `id` a `href` rozešly, odkaz začne mířit do prázdna — a to je
    // přesně ta vada, kvůli které se hlavní oblasti sjednocovaly. Bez téhle
    // aserce by ji nic nehlídalo: odkaz na neexistující kotvu nikde nespadne.
    const layout = readFileSync(`${SRC}/${LAYOUT}`, 'utf8');

    const mainId = /<main[^>]*\bid="([^"]+)"/.exec(layout)?.[1];
    const skipHref = /<a\s[^>]*href="#([^"]+)"/.exec(layout)?.[1];

    expect(mainId).toBe('main-content');
    expect(skipHref).toBe(mainId);
  });

  it('každá stránka renderuje Layout, takže hlavní oblast opravdu má', () => {
    // Aserce výš hlídá, že `main` nevznikne JINDE než v Layoutu — ale mlčí o tom,
    // že stránka nemusí mít žádný. Přesně tudy propadla domovská stránka: renderovala
    // `<div><Navigation/><Hero/></div>`, takže neměla hlavní oblast, skip-link ani
    // patičku, a guard byl přesto zelený. Změřeno na předgenerovaném buildu —
    // `dist/index.html` main=0 footer=0, zbylých 29 stran main=1.
    // WCAG 2.2 SC 2.4.1 (Bypass Blocks); ARIA APG, Landmark Regions: „ensure that
    // all content is contained within an appropriate landmark region."
    const offenders = readdirSync(PAGES, { encoding: 'utf8' })
      .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
      .filter((file) => !readFileSync(`${PAGES}/${file}`, 'utf8').includes('<Layout'))
      .sort();

    expect(offenders).toEqual([]);
  });

  it('nikde nevzniká druhá hlavička — `role="banner"` na sekci', () => {
    // ARIA APG, Landmark Regions: „Each page should have only one `banner`, one
    // `main`, and one `contentinfo` landmark." Hero sekce nesla `role="banner"` na
    // dvou stránkách a na `PlanYourDreamTrip` seděl ten banner dokonce UVNITŘ
    // `<main>` — čtečka pak nabízí hlavičku vnořenou do hlavního obsahu.
    const offenders = sourceFiles().filter((file) => BANNER_ROLE.test(readFileSync(`${SRC}/${file}`, 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('každá navigace má jméno', () => {
    // ARIA APG, Landmark Regions: „If a page includes more than one `navigation`
    // landmark, each should have a unique label." Na každé stránce je jich víc
    // (hlavní menu + dvě v patičce), takže platí vždycky. Nepojmenované byly hlavní
    // menu a pět zpětných odkazů (audit A-7). Render test to nechytí — jsdom `nav`
    // bez jména vykreslí a `getAllByRole('navigation')` ho vrátí.
    const offenders = sourceFiles().flatMap((file) =>
      Array.from(readFileSync(`${SRC}/${file}`, 'utf8').matchAll(NAVIGATION_TAG))
        .map((match) => match[0])
        .filter((tag) => !HAS_NAME.test(tag))
        .map((tag) => `${file}: ${tag}`),
    );

    expect(offenders).toEqual([]);
  });

  it('strážce navigací opravdu vidí všechny `<nav>` v repu', () => {
    // Bez tohohle by rozbitý regulární výraz, který nenajde nic, nechal předchozí
    // test zelený navždy. 10 = hlavní menu, jeho záložní podoba, patička, drobečky,
    // stránkování a pět zpětných odkazů na stránkách.
    const count = sourceFiles().reduce(
      (sum, file) => sum + Array.from(readFileSync(`${SRC}/${file}`, 'utf8').matchAll(NAVIGATION_TAG)).length,
      0,
    );

    expect(count).toBe(10);
  });
});
