// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * Build skripty načítá `node`, ne Vite — a Node má přísnější pravidla než Vitest:
 * relativní import musí mít příponu, `import.meta.env` neexistuje a z TypeScriptu
 * se jen odstraňují typy (žádné enumy, namespacy, parameter properties).
 * Vitest tyhle rozdíly zahlazuje, takže zelená sada o načitatelnosti nevypovídá nic —
 * bezpříponový import v `src/constants/*.ts` projde lintem, type-checkem i všemi testy
 * a build spadne až na Vercelu.
 *
 * Proto se každý skript zkouší načíst v opravdovém Node podprocesu. Import sám o sobě
 * nic nespustí: `run()` se v nich volá jen když `import.meta.url` odpovídá
 * `process.argv[1]`, a to je při `node -e` prázdné.
 */
const NODE_LOADED = ['scripts/prerender.mjs', 'scripts/sitemap.mjs'];

/**
 * Skripty, které se načíst NEDAJÍ, protože pracují už při importu (nemají guard na
 * `import.meta.url`). Import `postinstall.mjs` by rovnou spustil `playwright install`.
 * Jsou tu vyjmenované schválně: druhý test níž hlídá, že seznamy dohromady pokrývají
 * všechno, co package.json spouští přes `node scripts/…`.
 */
const SIDE_EFFECT_ON_IMPORT = ['scripts/postinstall.mjs'];

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

describe('build skripty jdou načíst v plain Node', () => {
  it.each(NODE_LOADED)('%s', (script) => {
    const href = pathToFileURL(path.join(repoRoot, script)).href;
    try {
      execFileSync(
        process.execPath,
        ['--no-warnings', '--input-type=module', '-e', `await import(${JSON.stringify(href)})`],
        { stdio: 'pipe' },
      );
    } catch (err) {
      // Bez stderr by z hlášky bylo jen „Command failed" — a přitom právě tam stojí
      // ERR_MODULE_NOT_FOUND i s cestou, která se nenašla.
      const stderr = /** @type {{ stderr?: Buffer }} */ (err).stderr;
      throw new Error(`${script} nejde načíst v plain Node:\n${stderr ? stderr.toString() : String(err)}`);
    }
  }, 30_000);

  it('seznam pokrývá všechny build skripty, které package.json spouští', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const referenced = new Set(
      [...JSON.stringify(pkg.scripts).matchAll(/node\s+(scripts\/[\w.-]+\.mjs)/g)].map((m) => m[1]),
    );
    // Pojistka proti tomu, aby test tiše prošel na prázdné množině (překlep v regexu).
    expect(referenced.size).toBeGreaterThan(0);
    expect([...referenced].sort()).toEqual([...NODE_LOADED, ...SIDE_EFFECT_ON_IMPORT].sort());
  });
});
