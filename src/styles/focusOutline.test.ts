import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * Strážce viditelného fokusu v režimu vynucených barev (vysoký kontrast Windows).
 *
 * Prstenec fokusu je v Tailwindu `box-shadow` a ten prohlížeč v tom režimu natvrdo
 * vynuluje (MDN, `forced-colors`). Když je vedle něj `outline-none`, nezbude nic —
 * změřeno Playwrightem s emulací `forced-colors: active` (audit A-8, 2026-09-24).
 * `outline-hidden` obrys schová jen mimo ten režim, proto je jediný povolený.
 *
 * Grepuje zdroják: jsdom žádné CSS nenačítá, takže render test rozdíl nepozná.
 */
const SRC = 'src';

const OUTLINE_NONE = /\boutline-none\b/;
const OUTLINE_HIDDEN = /\boutline-hidden\b/;

/**
 * Řetězce tříd s `outline-hidden`: literály v uvozovkách nebo backtickách v komponentách
 * a `@apply …;` v CSS. Literál, který je JEN `outline-hidden`, je zmínka v komentáři.
 */
const CLASS_LITERAL = /(["`])([^"`]*\boutline-hidden\b[^"`]*)\1|@apply([^;]*\boutline-hidden\b[^;]*);/g;

/** Náhrada za schovaný obrys: prstenec, nebo změna rámečku při fokusu. */
const FOCUS_INDICATOR = /\b(?:focus|focus-visible):(?:ring-|border-(?!transparent))/;

/**
 * Prvky, které smějí být bez náhrady. Klíč = soubor, hodnota = počet výskytů.
 * Nadpis otázky kvízu dostává fokus jen programově (`tabIndex={-1}`, posun po odpovědi
 * pro čtečku) — není ovladatelný klávesnicí, takže SC 2.4.7 na něj nedopadá.
 */
const WITHOUT_INDICATOR: Record<string, number> = {
  'components/quiz/QuizQuestion.tsx': 1,
};

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(tsx?|css)$/.test(file) && !file.includes('.test.'))
    .sort();
}

describe('fokus v režimu vynucených barev', () => {
  it('nikde není `outline-none`, jen `outline-hidden`', () => {
    const offenders = sourceFiles().filter((file) => OUTLINE_NONE.test(readFileSync(`${SRC}/${file}`, 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('strážce čte i CSS, nejen komponenty', () => {
    // Bez tohohle by filtr přípon, který omylem vynechá `.css`, nechal první test
    // zelený — a `@utility focus-ring` (23 použití) je právě v CSS.
    const withHidden = sourceFiles().filter((file) => OUTLINE_HIDDEN.test(readFileSync(`${SRC}/${file}`, 'utf8')));

    expect(withHidden).toContain('styles/utilities.css');
    expect(withHidden).toContain('components/ui/Button.tsx');
  });

  it('kde je obrys schovaný, je místo něj jiný indikátor fokusu', () => {
    // WCAG 2.2 SC 2.4.7. `outline-hidden` jen přesune problém z režimu vynucených barev
    // do běžného: tlačítka otázek na /caste-dotazy a odkaz „Ochrana údajů" u newsletteru
    // měla obrys vypnutý a žádnou náhradu, fokus tam nebyl vidět vůbec (nález N-A10-1).
    const missing: Record<string, number> = {};
    let checked = 0;
    for (const file of sourceFiles()) {
      for (const match of readFileSync(`${SRC}/${file}`, 'utf8').matchAll(CLASS_LITERAL)) {
        const classes = match[2] ?? match[3];
        if (classes.trim() === 'outline-hidden') continue;
        checked += 1;
        if (!FOCUS_INDICATOR.test(classes)) missing[file] = (missing[file] ?? 0) + 1;
      }
    }

    expect(missing).toEqual(WITHOUT_INDICATOR);
    // Pojistka proti výrazu, který nenajde nic: 29 řetězců tříd v 17 souborech.
    expect(checked).toBe(29);
  });
});
