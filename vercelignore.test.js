// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * Strážce `.vercelignore`. Vercel CLI (`vercel deploy`) `.gitignore` nečte: nahraje všechno
 * kromě svých výchozích výjimek a toho, co vyloučí `.vercelignore`. Pravidlo, které přibude
 * jen do `.gitignore`, tedy pošle na Vercel i to, co v gitu není. V červenci a srpnu 2026 tak
 * odešly pracovní reporty, snímky z Playwrightu a link state Supabase CLI.
 *
 * Pořadí se hlídá kvůli výjimkám: `!…` platí jen za pravidlem, které ruší.
 */
const rules = (file) =>
  readFileSync(new URL(file, import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

describe('.vercelignore pokrývá .gitignore', () => {
  it('obsahuje všechna pravidla .gitignore ve stejném pořadí', () => {
    const vercel = rules('./.vercelignore');
    const missing = [];
    let from = 0;
    for (const rule of rules('./.gitignore')) {
      const at = vercel.indexOf(rule, from);
      if (at === -1) missing.push(rule);
      else from = at + 1;
    }
    expect(missing).toEqual([]);
  });

  it('vylučuje .superpowers, kterou git ignoruje jen přes .git/info/exclude', () => {
    expect(rules('./.vercelignore')).toContain('.superpowers');
  });
});
