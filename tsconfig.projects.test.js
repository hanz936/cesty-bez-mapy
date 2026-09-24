// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * Strážce typové kontroly. `npm run type-check` je `tsc -b`, a ten kontroluje jen projekty
 * z `references` v tsconfig.json, v každém jen soubory, které pokryje jeho `include`/`exclude`.
 * Co pod to nespadá, TypeScript vůbec neotevře a ohlásí 0 chyb. Odebraná reference nebo soubor
 * mimo všechny projekty je tedy tichá díra, zelený type-check o nich nevypovídá nic.
 *
 * Seznamy souborů počítá sám TypeScript (`--showConfig`), ne vlastní glob, jinak by test mohl
 * vykládat include/exclude jinak než kompilátor. JS API (`ts.getParsedCommandLineOfConfigFile`)
 * schválně ne: TypeScript 7 ho nemá, `--showConfig` ano.
 */
const root = fileURLToPath(new URL('.', import.meta.url));
const tsc = path.join(root, 'node_modules/.bin/tsc');

/** @param {string} project */
const showConfig = (project) =>
  JSON.parse(execFileSync(tsc, ['-p', project, '--showConfig'], { cwd: root, encoding: 'utf8' }));

/** Cesta relativně ke kořeni bez `./`, tedy ve tvaru, v jakém ji vrací git. @param {string} p */
const normalize = (p) => path.relative(root, path.resolve(root, p)).split(path.sep).join('/');

const referencedProjects = () => showConfig('tsconfig.json').references.map((r) => normalize(r.path));

describe('typová kontrola pokrývá celý repozitář', () => {
  it('každý tsconfig.*.json v kořeni je v references', () => {
    const onDisk = readdirSync(root).filter((f) => /^tsconfig\..+\.json$/.test(f));
    // Pojistka proti tomu, aby test tiše prošel na prázdné množině (překlep v regexu).
    expect(onDisk.length).toBeGreaterThan(0);
    expect(referencedProjects().sort()).toEqual(onDisk.sort());
  });

  it('každý TypeScript soubor patří aspoň do jednoho odkazovaného projektu', () => {
    const covered = new Set(referencedProjects().flatMap((p) => showConfig(p).files.map(normalize)));
    // I soubory dosud nepřidané do gitu (--others), aby díra vyplula už před commitem.
    // supabase/functions je Deno, typy mu kontroluje `npm run check:edge` (deno check).
    const tsFiles = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.ts', '*.tsx', '*.mts', '*.cts'],
      { cwd: root, encoding: 'utf8' },
    )
      .split('\n')
      .filter((f) => f && !f.startsWith('supabase/functions/') && existsSync(path.join(root, f)));
    expect(tsFiles.length).toBeGreaterThan(0);
    expect(tsFiles.filter((f) => !covered.has(f))).toEqual([]);
  }, 30_000);
});
