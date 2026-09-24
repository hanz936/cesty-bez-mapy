// @vitest-environment node
import { ESLint } from 'eslint';
import { describe, it, expect } from 'vitest';

/**
 * Strážce konfigurace lintu. Obě vady, kvůli kterým vznikl, byly neviditelné:
 * `npm run lint` hlásil nulu, protože build skripty (`.mjs`) nedostávaly žádné
 * pravidlo a JS soubory jen 4 z doporučené sady — ne proto, že by byly čisté.
 * Zelený lint to nepozná, pozná to jen dotaz na výslednou konfiguraci souboru.
 */
const eslint = new ESLint();

/** @param {string} file */
const rulesFor = async (file) => Object.keys((await eslint.calculateConfigForFile(file)).rules ?? {});

describe('konfigurace ESLintu', () => {
  it.each(['scripts/prerender.mjs', 'scripts/prerender.test.js', 'vite/umami-plugin.js'])(
    '%s dostane doporučenou sadu pravidel',
    async (file) => {
      const rules = await rulesFor(file);
      expect(rules).toContain('no-undef');
      expect(rules).toContain('no-unused-vars');
    },
  );

  it('middleware.ts (předlaunchová brána) se lintuje s typy', async () => {
    expect(await eslint.isPathIgnored('middleware.ts')).toBe(false);
    expect(await rulesFor('middleware.ts')).toContain('@typescript-eslint/no-floating-promises');
  });

  it.each(['.superpowers/sdd/x/sonda.mjs', '.worktrees/vetev/scripts/prerender.mjs'])(
    '%s je mimo lint (mimo git, flat config .gitignore nečte)',
    async (file) => {
      expect(await eslint.isPathIgnored(file)).toBe(true);
    },
  );
});
