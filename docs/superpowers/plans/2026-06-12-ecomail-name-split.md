# Ecomail name/surname split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Posílat do Ecomailu křestní jméno a příjmení odděleně (`name` + `surname`), aby Ecomail automaticky generoval vokativ („Milý Jane") a personalizace fungovala.

**Architecture:** Čistá funkce `splitFullName` v `supabase/functions/_shared/ecomail/syncCustomer.ts` (frontend repo) rozdělí celé jméno heuristikou „první token = jméno, zbytek = příjmení" a odfiltruje placeholder jména („Zákazník", „Host", „Neznámý zákazník"), která do Ecomailu nepatří. `syncCustomerToEcomail` ji použije místo přímého `name`. Pokrývá oba vstupy: checkout (stripe-webhook) i admin re-sync (ecomail-sync) — obě cesty volají tutéž sdílenou funkci. `subscribe-newsletter` jméno neposílá → beze změny chování, jen sdílí soubor.

**Tech Stack:** Deno (Supabase Edge Functions), testy `deno test --allow-env supabase/functions/_shared/ecomail/`. Repo: `/Users/janparma/Desktop/Projekty/cesty-bez-mapy`, větev `feat/ecomail-name-split` z `main`.

**Kontext pro implementátora bez znalosti projektu:**
- `EcomailSubscriberData` v `supabase/functions/_shared/ecomail/types.ts` už má `surname?: string` — typy se nemění.
- Ecomail API ignoruje `undefined` pole (JSON.stringify je vynechá) — není třeba podmíněné skládání objektu.
- Placeholder jména vznikají ve `stripe-webhook/index.ts`: `"Neznámý zákazník"` (fallback customerName), `"Zákazník"` a `"Host"` (fallbacky při insertu do `customers`). Přes admin re-sync (`ecomail-sync` čte `customers.name`) se mohou dostat do syncu — proto filtr.
- Baseline před začátkem: 12 testů green (`deno test --allow-env supabase/functions/_shared/ecomail/`).

---

### Task 1: `splitFullName` — čistá funkce (TDD)

**Files:**
- Modify: `supabase/functions/_shared/ecomail/syncCustomer.ts` (přidat export nad `mergeTags`)
- Test: `supabase/functions/_shared/ecomail/syncCustomer.test.ts` (přidat testy na konec souboru)

- [ ] **Step 1: Napiš failující testy**

Přidej na konec `syncCustomer.test.ts` (import rozšiř o `splitFullName`):

```ts
import { splitFullName, syncCustomerToEcomail } from "./syncCustomer.ts";

Deno.test("splitFullName — dvě slova → name + surname", () => {
  assertEquals(splitFullName("Jan Novák"), { name: "Jan", surname: "Novák" });
});

Deno.test("splitFullName — jedno slovo → jen name", () => {
  assertEquals(splitFullName("Jan"), { name: "Jan" });
});

Deno.test("splitFullName — víceslovné příjmení + přebytečné mezery", () => {
  assertEquals(splitFullName("  Jan   van der Berg "), { name: "Jan", surname: "van der Berg" });
});

Deno.test("splitFullName — prázdné/null/undefined → {}", () => {
  assertEquals(splitFullName(""), {});
  assertEquals(splitFullName("   "), {});
  assertEquals(splitFullName(null), {});
  assertEquals(splitFullName(undefined), {});
});

Deno.test("splitFullName — placeholder jména → {} (case-insensitive)", () => {
  assertEquals(splitFullName("Zákazník"), {});
  assertEquals(splitFullName("Host"), {});
  assertEquals(splitFullName("Neznámý zákazník"), {});
  assertEquals(splitFullName("neznámý zákazník"), {});
});
```

Pozn.: stávající import `syncCustomerToEcomail` na řádku 2 nahraď rozšířeným importem (nesmí být dvojitý import téhož modulu).

- [ ] **Step 2: Ověř, že testy failují**

Run: `deno test --allow-env supabase/functions/_shared/ecomail/`
Expected: FAIL — `splitFullName` není exportováno (TS error / does not provide an export).

- [ ] **Step 3: Minimální implementace**

Do `syncCustomer.ts` přidej nad `mergeTags`:

```ts
/** Placeholder jména z checkout fallbacků — do Ecomailu se neposílají. */
const PLACEHOLDER_NAMES = new Set(["zákazník", "host", "neznámý zákazník"]);

export interface SplitName { name?: string; surname?: string }

/** Rozdělí celé jméno na křestní + příjmení (první token / zbytek). */
export function splitFullName(full?: string | null): SplitName {
  const normalized = (full ?? "").trim().replace(/\s+/g, " ");
  if (!normalized || PLACEHOLDER_NAMES.has(normalized.toLowerCase())) return {};
  const idx = normalized.indexOf(" ");
  if (idx === -1) return { name: normalized };
  return { name: normalized.slice(0, idx), surname: normalized.slice(idx + 1) };
}
```

- [ ] **Step 4: Ověř, že testy projdou**

Run: `deno test --allow-env supabase/functions/_shared/ecomail/`
Expected: PASS — 17 testů (12 původních + 5 nových).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/ecomail/syncCustomer.ts supabase/functions/_shared/ecomail/syncCustomer.test.ts
git commit -m "feat(ecomail): splitFullName — rozdělení jména na name/surname s filtrem placeholderů"
```

(Bez Co-Authored-By traileru — preference uživatele.)

---

### Task 2: Zapojení do `syncCustomerToEcomail` (TDD)

**Files:**
- Modify: `supabase/functions/_shared/ecomail/syncCustomer.ts` (řádek ~42, volání `p.client.subscribe`)
- Test: `supabase/functions/_shared/ecomail/syncCustomer.test.ts`

- [ ] **Step 1: Napiš failující testy**

V existujícím testu „happy path" (volá se s `name: "Jan Novák"`) přidej za assert na `skip_confirmation`:

```ts
  assertEquals(client.calls[0].data.name, "Jan");
  assertEquals(client.calls[0].data.surname, "Novák");
```

A na konec souboru přidej nový test:

```ts
Deno.test("syncCustomerToEcomail — placeholder jméno se do Ecomailu neposílá", async () => {
  const client = fakeClient(null);
  const res = await syncCustomerToEcomail({
    client, supabase: fakeSupabase(false), listId: 7, customerId: "c", orderId: "o",
    email: "a@b.cz", name: "Neznámý zákazník",
  });
  assertEquals(res.synced, true);
  assertEquals(client.calls[0].data.name, undefined);
  assertEquals(client.calls[0].data.surname, undefined);
});
```

- [ ] **Step 2: Ověř, že nové asserty failují**

Run: `deno test --allow-env supabase/functions/_shared/ecomail/`
Expected: FAIL — happy path: `data.name` je `"Jan Novák"`, ne `"Jan"`; nový test: `data.name` je `"Neznámý zákazník"`.

- [ ] **Step 3: Minimální implementace**

V `syncCustomer.ts` ve funkci `syncCustomerToEcomail` nahraď:

```ts
    const resp = await p.client.subscribe(
      p.listId,
      { email: p.email, name: p.name, source: "checkout", tags },
      { update_existing: true, skip_confirmation: true },
    );
```

za:

```ts
    const { name, surname } = splitFullName(p.name);
    const resp = await p.client.subscribe(
      p.listId,
      { email: p.email, name, surname, source: "checkout", tags },
      { update_existing: true, skip_confirmation: true },
    );
```

- [ ] **Step 4: Ověř, že vše projde**

Run: `deno test --allow-env supabase/functions/_shared/ecomail/`
Expected: PASS — 18 testů, 0 failed.

- [ ] **Step 5: Type-check entrypointů všech tří funkcí, které soubor sdílejí**

Run: `deno check supabase/functions/stripe-webhook/index.ts supabase/functions/ecomail-sync/index.ts supabase/functions/subscribe-newsletter/index.ts`
Expected: bez chyb (warning o lock filu je OK).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/ecomail/syncCustomer.ts supabase/functions/_shared/ecomail/syncCustomer.test.ts
git commit -m "feat(ecomail): sync posílá name/surname odděleně — auto-vokativ personalizace"
```

---

### Task 3: Merge, deploy, E2E ověření (main session — ne subagent)

**Files:** žádné nové; operace nad repem a prod prostředím.

- [ ] **Step 1: Finální kontrola na větvi**

Run: `deno test --allow-env supabase/functions/_shared/ecomail/ && git log --oneline main..HEAD`
Expected: 18 testů PASS; 2 commity.

- [ ] **Step 2: Code review (požadavek uživatele: implementer + 2 revieweři)**

Dva review subagenti (spec-compliance + code-quality) nad `git diff main...HEAD`. Nálezy opravit před merge.

- [ ] **Step 3: FF-merge do main + push**

```bash
git checkout main && git merge --ff-only feat/ecomail-name-split && git push origin main
```

- [ ] **Step 4: Deploy edge funkcí (všechny tři sdílejí změněný soubor)**

```bash
supabase functions deploy stripe-webhook --project-ref dkblgznhnixubyoghrqe
supabase functions deploy ecomail-sync --project-ref dkblgznhnixubyoghrqe
supabase functions deploy subscribe-newsletter --project-ref dkblgznhnixubyoghrqe
```

Před spuštěním ověřit v `supabase/config.toml`, že per-function `verify_jwt` nastavení existuje (deploy je respektuje — stripe-webhook musí zůstat bez JWT verifikace).

- [ ] **Step 5: E2E — vyžaduje 1 klik uživatele**

Uživatel v admin panelu otevře zákazníka Jan Parma a klikne „Znovu synchronizovat do Ecomailu" (MFA admin session nelze automatizovat).

- [ ] **Step 6: Ověření přes Ecomail MCP**

`subscriber-detail-tool` pro `parma29@seznam.cz`:
- Expected ihned: `name: "Jan"`, `surname: "Parma"`, tag `zakaznik` zachován, status 1.
- Expected do ~10 minut (Ecomail auto-generace): `vokativ: "Jane"`, `gender: "male"`, příp. `nameday`.
- Druhé čtení po pár minutách na vokativ.

- [ ] **Step 7: Aktualizace paměti**

Memory `project_ecomail_integration.md`: name/surname split HOTOVO (datum, větev, výsledek E2E); odstranit „čeká na rozhodnutí".
