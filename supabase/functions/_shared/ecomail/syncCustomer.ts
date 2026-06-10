// FE/supabase/functions/_shared/ecomail/syncCustomer.ts (zatím jen helper; zbytek v pozdějším tasku)
/** Sjednotí existující a nové tagy (bez duplikátů, zachová pořadí). */
export function mergeTags(existing: string[], add: string[]): string[] {
  const out = [...existing];
  for (const t of add) if (!out.includes(t)) out.push(t);
  return out;
}
