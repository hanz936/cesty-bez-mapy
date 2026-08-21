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

/**
 * Obě podoby hlavní oblasti. Samotné `<main` by minulo `<section role="main">`,
 * což je pro čtečku totéž — a přesně v té podobě to bylo v `MyStory`
 * a `Collaboration`, kde by grep na tag nenašel nic.
 */
const MAIN_LANDMARK = /<main[\s>]|role=["']main["']/;

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
});
