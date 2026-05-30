# Blog „Inspirace na cesty" — Plán B: Veřejný web (implementační plán)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zobrazit na veřejném webu publikované články z DB — výpis `/inspirace` (z DB + filtr tagů) a detail `/inspirace/:slug` s bezpečně vykresleným bohatým obsahem, souvisejícími články a SEO; plus admin náhled konceptů přes zabezpečenou Edge funkci.

**Architecture:** Stávající CSR React SPA (`cesty-bez-mapy`). Výpis i detail tahají publikované články přes anon Supabase klienta (RLS hlídá `published_at IS NOT NULL`). Tělo článku (HTML z adminu) se **sanitizuje DOMPurify** a **hydratuje `html-react-parser`** na bezpečné React komponenty (YouTube facade, interní CTA na produkt). Callout a galerie jsou jen CSS. Náhled **nepublikovaných** konceptů jede přes Edge funkci `get-blog-preview` (service-role, gated per-post tokenem) — service-role nikdy v prohlížeči. SEO přes **nativní metadata React 19** + JSON-LD.

**Tech Stack:** React 19, react-router-dom 7, Tailwind 4 (+ `@tailwindcss/typography`), `@supabase/supabase-js`, **DOMPurify**, **html-react-parser**, vitest + @testing-library/react (TDD), Supabase Edge Functions (Deno).

**Repozitáře:**
- Frontend + DB migrace + Edge funkce → `cesty-bez-mapy` (větev `feat/blog-inspirace-web`)
- Drobná úprava admin náhledu → `cesty-bez-mapy-admin`

**Spec:** `cesty-bez-mapy-admin/docs/superpowers/specs/2026-05-30-blog-inspirace-design.md` (§5 web, §6 bezpečnost, §7 SEO, §8 testy, §11 hardening).

**Navazuje na Plán A** (hotový, mergnutý do `main`): admin píše články; v DB jsou `blog_posts` (HTML obsah + `tag_ids`) a `blog_tags`. RLS už pouští **anon** k publikovaným (`blog_posts_public_select`).

**Pozn. k ověřování:** Frontend **má vitest** (`npm test`) → jednotkové testy pro bezpečnostně/logicky kritické části (sanitizace, hydratace, util, datová vrstva) píšeme TDD. Celostránkovou integraci (výpis/detail proti živé DB) ověříme manuálně přes `playwright-cli` na konci. Edge funkce se testuje samostatně (`deno`), ne vitestem (vyloučeno ve `vite.config.js`).

---

## Struktura souborů (co vznikne / se změní)

**Repo `cesty-bez-mapy`:**
- Create: `supabase/migrations/044_blog_preview_token.sql` — sloupec `blog_posts.preview_token uuid`.
- Create: `supabase/functions/get-blog-preview/index.ts` — service-role náhled konceptu (token-gated).
- Create: `src/utils/blogContent.js` — `sanitizeBlogHtml`, `extractYoutubeId`, `readingTimeMinutes`, `extractProductSlugs`.
- Create: `src/utils/blogContent.test.js`.
- Create: `src/utils/blogSeo.js` — `buildBlogMeta` (SEO + JSON-LD data).
- Create: `src/utils/blogSeo.test.js`.
- Create: `src/lib/blog.js` — datová vrstva (Supabase dotazy + náhled přes edge fn).
- Create: `src/lib/blog.test.js`.
- Create: `src/components/blog/YoutubeEmbed.jsx` — facade → `youtube-nocookie` iframe.
- Create: `src/components/blog/ProductCtaLink.jsx` — interní `<Link>` na produkt (jen když existuje).
- Create: `src/components/blog/BlogContentRenderer.jsx` — sanitizace + hydratace bloků.
- Create: `src/components/blog/BlogContentRenderer.test.jsx`.
- Create: `src/components/blog/SeoTags.jsx` — nativní React 19 metadata + JSON-LD.
- Modify: `src/index.css` — `@plugin "@tailwindcss/typography"` + styly `.blog-content/.blog-callout/.blog-gallery/.blog-cta/.blog-youtube`.
- Modify: `src/constants/routes.js` — `INSPIRATION_DETAIL`.
- Modify: `src/App.jsx` — routa `/inspirace/:slug`.
- Modify: `src/pages/TravelInspiration.jsx` — výpis z DB + filtr tagů (zahodit hardcoded `BLOG_POSTS`).
- Create: `src/pages/BlogPostDetail.jsx` — detail článku.
- Modify: `package.json` — `dompurify`, `html-react-parser`, `@tailwindcss/typography`.

**Repo `cesty-bez-mapy-admin`:**
- Modify: `src/resources/blog-posts/BlogPostEdit.tsx` — do „Náhled" URL přidat `&token=<preview_token>`.

---

## Task 1: DB migrace — `blog_posts.preview_token`

**Repo:** `cesty-bez-mapy`

**Files:**
- Create: `supabase/migrations/044_blog_preview_token.sql`

- [ ] **Step 1: Napsat migraci**

Vytvoř `supabase/migrations/044_blog_preview_token.sql`:

```sql
-- ================================================
-- Migration: 044_blog_preview_token
-- Created: 2026-05-30
-- Description: Per-post náhledový token pro náhled NEpublikovaných konceptů
--   přes Edge funkci get-blog-preview (service-role, token-gated).
--   Vzor 2026 best practice: preview API + tajný per-content token.
-- ================================================

ALTER TABLE blog_posts
  ADD COLUMN preview_token uuid NOT NULL DEFAULT gen_random_uuid();

COMMENT ON COLUMN blog_posts.preview_token IS
  'Tajný token pro náhled konceptu přes edge fn get-blog-preview (per článek, rotovatelný).';
```

- [ ] **Step 2: Aplikovat na vzdálený projekt**

> **POZOR (ostrá DB):** Než to aplikuješ, ZASTAV SE a ukaž uživateli přesné SQL k odsouhlasení (stejný režim jako migrace `043`). Teprve po souhlasu aplikuj přes Supabase MCP `apply_migration` (název `044_blog_preview_token`).

- [ ] **Step 3: Ověřit**

Přes MCP `execute_sql`:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'blog_posts' AND column_name = 'preview_token';
-- Očekávané: preview_token | uuid | NO | gen_random_uuid()

SELECT count(*) AS posts_without_token
FROM blog_posts WHERE preview_token IS NULL;
-- Očekávané: 0 (existující řádky dostaly token)
```

- [ ] **Step 4: Ověřit advisory**

Přes MCP `get_advisors` typ `security`. Očekávané: žádné nové varování kvůli `preview_token` (nový sloupec na existující RLS tabulce).

- [ ] **Step 5: Commit**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
git add supabase/migrations/044_blog_preview_token.sql
git commit -m "feat(db): blog_posts.preview_token pro náhled konceptů (044)"
```

---

## Task 2: Edge funkce `get-blog-preview`

**Repo:** `cesty-bez-mapy`

**Files:**
- Create: `supabase/functions/get-blog-preview/index.ts`

- [ ] **Step 1: Napsat Edge funkci** (vzor: `supabase/functions/get-download-url/index.ts` — CORS allowlist inline, `createClient` z esm.sh, `Deno.serve`)

Vytvoř `supabase/functions/get-blog-preview/index.ts`:

```ts
// ================================================
// Supabase Edge Function: Get Blog Preview
// ================================================
// Vrátí blogový článek (i NEpublikovaný koncept) podle slug + preview_token.
// Service-role obchází RLS; jedinou autorizací je per-post preview_token.
// Cache vypnutá (Cache-Control: no-store).
// ================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  "https://cestybezmapy.cz",
  "https://www.cestybezmapy.cz",
  "https://cesty-bez-mapy-admin.vercel.app",
  "https://admin.cestybezmapy.cz",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  try {
    const { slug, token } = await req.json().catch(() => ({}));
    if (!slug || typeof slug !== "string") return json({ error: "Missing slug" }, 400, cors);
    if (!token || typeof token !== "string" || !UUID_RE.test(token)) {
      return json({ error: "Invalid token" }, 400, cors);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id, title, slug, excerpt, image_url, content, seo_title, seo_description, published_at, updated_at, tag_ids, created_at",
      )
      .eq("slug", slug)
      .eq("preview_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!data) return json({ error: "Not found" }, 404, cors);

    return json({ post: data }, 200, cors);
  } catch (_e) {
    return json({ error: "Server error" }, 500, cors);
  }
});
```

- [ ] **Step 2: Deploy** (Edge funkce na vzdálený projekt)

> Deploy přes Supabase MCP `deploy_edge_function` (name `get-blog-preview`, soubor výše). `SUPABASE_URL` a `SUPABASE_SERVICE_ROLE_KEY` jsou v Edge prostředí automaticky — není třeba je nastavovat.

- [ ] **Step 3: Ověřit funkci** (přes `execute_sql` zjisti testovací data, pak zavolej funkci)

```sql
-- Vyber libovolný existující článek (nebo si vytvoř koncept v adminu) a jeho token:
SELECT slug, preview_token, published_at FROM blog_posts ORDER BY created_at DESC LIMIT 1;
```
Pak zavolej funkci (nahraď `<PROJECT_URL>`, `<ANON_KEY>`, `<SLUG>`, `<TOKEN>`):
```bash
curl -s -X POST "<PROJECT_URL>/functions/v1/get-blog-preview" \
  -H "Content-Type: application/json" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -d '{"slug":"<SLUG>","token":"<TOKEN>"}' | head -c 400
```
Očekávané: JSON `{"post": {...}}`. Se špatným tokenem (`"token":"00000000-0000-0000-0000-000000000000"`) → `{"error":"Not found"}` (404). S neuuid tokenem → `{"error":"Invalid token"}` (400).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/get-blog-preview/index.ts
git commit -m "feat(edge): get-blog-preview (service-role, token-gated náhled konceptů)"
```

---

## Task 3: Závislosti + Tailwind typografie

**Repo:** `cesty-bez-mapy`

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/index.css`

- [ ] **Step 1: Instalace**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
npm install dompurify html-react-parser
npm install -D @tailwindcss/typography
```
Pozn.: `dompurify` v3 i `html-react-parser` v5 jsou plně React 19/ESM kompatibilní a mají vlastní typy (projekt je JS, typy nevadí).

- [ ] **Step 2: Zapnout typografii v `src/index.css`**

Najdi řádek `@import "tailwindcss";` (Tailwind v4) a HNED pod něj přidej:
```css
@plugin "@tailwindcss/typography";
```

- [ ] **Step 3: Ověřit build**

Run: `npm run build`
Expected: build projde (typografie se zaregistruje). Custom blogové styly přidáme v Tasku 9.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/index.css
git commit -m "chore(web): dompurify + html-react-parser + tailwind typography"
```

---

## Task 4: Util `blogContent.js` (sanitizace, YouTube ID, reading time, slugy) — TDD

**Repo:** `cesty-bez-mapy`

**Files:**
- Create: `src/utils/blogContent.test.js`
- Create: `src/utils/blogContent.js`

- [ ] **Step 1: Napsat padající testy**

Vytvoř `src/utils/blogContent.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  sanitizeBlogHtml,
  extractYoutubeId,
  readingTimeMinutes,
  extractProductSlugs,
} from './blogContent';

const STORAGE = 'https://demo.supabase.co/storage/v1/object/public/';

describe('sanitizeBlogHtml', () => {
  it('zahodí <script> a onerror', () => {
    const dirty = '<p>ok</p><script>alert(1)</script><img src="x" onerror="alert(2)">';
    const clean = sanitizeBlogHtml(dirty, STORAGE);
    expect(clean).toContain('<p>ok</p>');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onerror');
  });

  it('zahodí cizí <iframe>', () => {
    const clean = sanitizeBlogHtml('<iframe src="https://evil.tld"></iframe>', STORAGE);
    expect(clean).not.toContain('<iframe');
  });

  it('ponechá povolené bloky + data-atributy + class', () => {
    const dirty =
      '<aside class="blog-callout"><p>tip</p></aside>' +
      '<div data-youtube-id="dQw4w9WgXcQ"></div>' +
      '<a data-product-slug="salzburg-vikend" class="blog-cta">Průvodce</a>';
    const clean = sanitizeBlogHtml(dirty, STORAGE);
    expect(clean).toContain('class="blog-callout"');
    expect(clean).toContain('data-youtube-id="dQw4w9WgXcQ"');
    expect(clean).toContain('data-product-slug="salzburg-vikend"');
  });

  it('ponechá <img> jen z úložiště, cizí zahodí', () => {
    const ok = `<img src="${STORAGE}blog-images/a.jpg" alt="a">`;
    const bad = '<img src="https://evil.tld/x.jpg" alt="b">';
    expect(sanitizeBlogHtml(ok, STORAGE)).toContain(STORAGE);
    expect(sanitizeBlogHtml(bad, STORAGE)).not.toContain('evil.tld');
  });
});

describe('extractYoutubeId', () => {
  it('vrátí ID z plné URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('vrátí ID, když je vstup už ID', () => {
    expect(extractYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('vrátí null pro nesmysl', () => {
    expect(extractYoutubeId('https://evil.tld/x')).toBeNull();
    expect(extractYoutubeId('"><script>')).toBeNull();
  });
});

describe('readingTimeMinutes', () => {
  it('počítá z holého textu (~200 slov/min), min 1', () => {
    expect(readingTimeMinutes('<p>krátký text</p>')).toBe(1);
    const long = '<p>' + 'slovo '.repeat(450) + '</p>';
    expect(readingTimeMinutes(long)).toBe(3);
  });
});

describe('extractProductSlugs', () => {
  it('vytáhne unikátní slugy z data-product-slug', () => {
    const html =
      '<a data-product-slug="a">x</a><a data-product-slug="b">y</a><a data-product-slug="a">z</a>';
    expect(extractProductSlugs(html).sort()).toEqual(['a', 'b']);
  });
  it('prázdné pole, když žádné CTA', () => {
    expect(extractProductSlugs('<p>nic</p>')).toEqual([]);
  });
});
```

- [ ] **Step 2: Spustit — musí padat**

Run: `npm test -- --run src/utils/blogContent.test.js`
Expected: FAIL („Failed to resolve import './blogContent'").

- [ ] **Step 3: Implementovat `src/utils/blogContent.js`**

```js
import DOMPurify from 'dompurify';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const STORAGE_PREFIX = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/`
  : '';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'strong', 'em', 'u', 's', 'code', 'br',
  'a', 'ul', 'ol', 'li', 'blockquote', 'hr',
  'img', 'figure', 'figcaption', 'aside', 'div', 'span',
];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'];

// Hook je globální; prefix čteme z modulové proměnné nastavené při každém volání.
let _storagePrefix = STORAGE_PREFIX;
let _hooked = false;
function ensureHook() {
  if (_hooked) return;
  _hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') || '';
      if (!_storagePrefix || !src.startsWith(_storagePrefix)) {
        node.remove();
        return;
      }
      node.setAttribute('loading', 'lazy');
      node.setAttribute('decoding', 'async');
    }
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      const href = node.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }
  });
}

/** Sanitizuje HTML těla článku se striktním allowlistem; <img> jen z úložiště. */
export function sanitizeBlogHtml(html, storagePrefix = STORAGE_PREFIX) {
  ensureHook();
  _storagePrefix = storagePrefix;
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  });
}

/** Vytáhne 11znakové YouTube ID z URL nebo vrátí vstup, je-li už ID; jinak null. */
export function extractYoutubeId(input) {
  const direct = String(input || '').trim();
  if (/^[\w-]{11}$/.test(direct)) return direct;
  const m = direct.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

/** Odhad doby čtení v minutách (~200 slov/min), minimum 1. */
export function readingTimeMinutes(html) {
  const text = String(html || '').replace(/<[^>]*>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Unikátní seznam slugů produktů z atributů data-product-slug. */
export function extractProductSlugs(html) {
  const slugs = new Set();
  const re = /data-product-slug="([^"]+)"/g;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) slugs.add(m[1]);
  return [...slugs];
}
```

- [ ] **Step 4: Spustit — musí projít**

Run: `npm test -- --run src/utils/blogContent.test.js`
Expected: PASS (všechny testy).

- [ ] **Step 5: Commit**

```bash
git add src/utils/blogContent.js src/utils/blogContent.test.js
git commit -m "feat(web): blogContent util (sanitizace, youtube id, reading time) + testy"
```

---

## Task 5: SEO helper `blogSeo.js` — TDD

**Repo:** `cesty-bez-mapy`

**Files:**
- Create: `src/utils/blogSeo.test.js`
- Create: `src/utils/blogSeo.js`

- [ ] **Step 1: Napsat padající testy**

Vytvoř `src/utils/blogSeo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildBlogMeta } from './blogSeo';

const post = {
  title: 'Lago di Garda mimo sezónu',
  slug: 'lago-di-garda-mimo-sezonu',
  excerpt: 'Ticho a světlo.',
  image_url: 'https://cdn.example/lago.jpg',
  seo_title: '',
  seo_description: '',
  published_at: '2026-05-30T10:00:00Z',
  updated_at: '2026-05-30T12:00:00Z',
};

describe('buildBlogMeta', () => {
  it('skládá title/description s fallbacky', () => {
    const m = buildBlogMeta(post, 'https://cestybezmapy.cz');
    expect(m.title).toBe('Lago di Garda mimo sezónu'); // fallback z title
    expect(m.description).toBe('Ticho a světlo.'); // fallback z excerpt
    expect(m.canonical).toBe('https://cestybezmapy.cz/inspirace/lago-di-garda-mimo-sezonu');
    expect(m.ogImage).toBe('https://cdn.example/lago.jpg');
  });

  it('preferuje seo_title/seo_description, jsou-li vyplněné', () => {
    const m = buildBlogMeta({ ...post, seo_title: 'SEO T', seo_description: 'SEO D' }, 'https://x');
    expect(m.title).toBe('SEO T');
    expect(m.description).toBe('SEO D');
  });

  it('JSON-LD je validní Article s datem', () => {
    const m = buildBlogMeta(post, 'https://cestybezmapy.cz');
    expect(m.jsonLd['@type']).toBe('Article');
    expect(m.jsonLd.headline).toBe('Lago di Garda mimo sezónu');
    expect(m.jsonLd.datePublished).toBe('2026-05-30T10:00:00Z');
    expect(m.jsonLd.mainEntityOfPage).toContain('/inspirace/lago-di-garda-mimo-sezonu');
  });
});
```

- [ ] **Step 2: Spustit — musí padat**

Run: `npm test -- --run src/utils/blogSeo.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementovat `src/utils/blogSeo.js`**

```js
export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://cestybezmapy.cz';
const AUTHOR_NAME = 'Jana — Cesty bez mapy';

/** Sestaví SEO meta (title/description/canonical/og) + JSON-LD Article pro článek. */
export function buildBlogMeta(post, siteUrl = SITE_URL) {
  const title = post.seo_title?.trim() || post.title;
  const description = post.seo_description?.trim() || post.excerpt || '';
  const canonical = `${siteUrl}/inspirace/${post.slug}`;
  const ogImage = post.image_url || `${siteUrl}/images/blog-hero.jpg`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description,
    image: post.image_url ? [post.image_url] : undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: { '@type': 'Person', name: AUTHOR_NAME },
    publisher: { '@type': 'Organization', name: 'Cesty bez mapy' },
    mainEntityOfPage: canonical,
  };

  return { title, description, canonical, ogImage, jsonLd };
}
```

- [ ] **Step 4: Spustit — musí projít**

Run: `npm test -- --run src/utils/blogSeo.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/blogSeo.js src/utils/blogSeo.test.js
git commit -m "feat(web): blogSeo helper (meta + JSON-LD Article) + testy"
```

---

## Task 6: Datová vrstva `lib/blog.js` — TDD

**Repo:** `cesty-bez-mapy`

**Files:**
- Create: `src/lib/blog.test.js`
- Create: `src/lib/blog.js`

- [ ] **Step 1: Napsat padající testy** (mockujeme `./supabase` chainovatelným builderem)

Vytvoř `src/lib/blog.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Chainovatelný mock query builderu: každá metoda vrací `this`,
// terminál je await (thenable) → vrátí { data, error } z _result.
function makeBuilder() {
  const calls = [];
  const builder = {
    _result: { data: [], error: null },
    then(resolve) { return Promise.resolve(this._result).then(resolve); },
  };
  ['select', 'eq', 'neq', 'not', 'lte', 'in', 'overlaps', 'order', 'limit'].forEach((m) => {
    builder[m] = vi.fn((...args) => { calls.push([m, ...args]); return builder; });
  });
  builder.maybeSingle = vi.fn(() => Promise.resolve(builder._result));
  builder._calls = calls;
  return builder;
}

const fromMock = vi.fn();
vi.mock('./supabase', () => ({ supabase: { from: (...a) => fromMock(...a) } }));

import { fetchPublishedPosts, fetchPostBySlug, fetchRelatedPosts, fetchExistingProductSlugs } from './blog';

beforeEach(() => { fromMock.mockReset(); });

describe('fetchPublishedPosts', () => {
  it('filtruje na published a řadí sestupně', async () => {
    const b = makeBuilder();
    b._result = { data: [{ id: '1' }], error: null };
    fromMock.mockReturnValue(b);
    const res = await fetchPublishedPosts();
    expect(fromMock).toHaveBeenCalledWith('blog_posts');
    expect(b.not).toHaveBeenCalledWith('published_at', 'is', null);
    expect(b.order).toHaveBeenCalledWith('published_at', { ascending: false });
    expect(res).toEqual([{ id: '1' }]);
  });
});

describe('fetchPostBySlug', () => {
  it('hledá podle slug + published a vrací maybeSingle', async () => {
    const b = makeBuilder();
    b._result = { data: { id: '1', slug: 'x' }, error: null };
    fromMock.mockReturnValue(b);
    const res = await fetchPostBySlug('x');
    expect(b.eq).toHaveBeenCalledWith('slug', 'x');
    expect(b.maybeSingle).toHaveBeenCalled();
    expect(res).toEqual({ id: '1', slug: 'x' });
  });
});

describe('fetchRelatedPosts', () => {
  it('vrátí [] bez tagů (žádný dotaz)', async () => {
    const res = await fetchRelatedPosts([], 'id1');
    expect(res).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
  it('používá overlaps a vylučuje aktuální článek', async () => {
    const b = makeBuilder();
    b._result = { data: [{ id: '2' }], error: null };
    fromMock.mockReturnValue(b);
    const res = await fetchRelatedPosts(['t1'], 'id1');
    expect(b.overlaps).toHaveBeenCalledWith('tag_ids', ['t1']);
    expect(b.neq).toHaveBeenCalledWith('id', 'id1');
    expect(res).toEqual([{ id: '2' }]);
  });
});

describe('fetchExistingProductSlugs', () => {
  it('vrátí Set existujících slugů', async () => {
    const b = makeBuilder();
    b._result = { data: [{ slug: 'a' }], error: null };
    fromMock.mockReturnValue(b);
    const res = await fetchExistingProductSlugs(['a', 'b', 'a']);
    expect(b.in).toHaveBeenCalledWith('slug', ['a', 'b']);
    expect(res.has('a')).toBe(true);
    expect(res.has('b')).toBe(false);
  });
  it('prázdný vstup → prázdný Set, žádný dotaz', async () => {
    const res = await fetchExistingProductSlugs([]);
    expect(res.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Spustit — musí padat**

Run: `npm test -- --run src/lib/blog.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementovat `src/lib/blog.js`**

```js
import { supabase } from './supabase';

const CARD_FIELDS = 'id, title, slug, excerpt, image_url, published_at, tag_ids';
const FULL_FIELDS =
  'id, title, slug, excerpt, image_url, content, seo_title, seo_description, published_at, updated_at, tag_ids, created_at';

const nowIso = () => new Date().toISOString();

/** Publikované články pro výpis (nejnovější první). */
export async function fetchPublishedPosts() {
  const { data, error } = await supabase
    .from('blog_posts')
    .select(CARD_FIELDS)
    .not('published_at', 'is', null)
    .lte('published_at', nowIso())
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Jeden publikovaný článek podle slug (null, když není). */
export async function fetchPostBySlug(slug) {
  const { data, error } = await supabase
    .from('blog_posts')
    .select(FULL_FIELDS)
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .lte('published_at', nowIso())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Všechny tagy (id, name, slug). */
export async function fetchTags() {
  const { data, error } = await supabase
    .from('blog_tags')
    .select('id, name, slug')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Související publikované články se sdíleným tagem (kromě aktuálního). */
export async function fetchRelatedPosts(tagIds, excludeId, limit = 3) {
  if (!tagIds || tagIds.length === 0) return [];
  const { data, error } = await supabase
    .from('blog_posts')
    .select(CARD_FIELDS)
    .not('published_at', 'is', null)
    .lte('published_at', nowIso())
    .overlaps('tag_ids', tagIds)
    .neq('id', excludeId)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Množina slugů produktů, které reálně existují (pro bezpečné CTA). */
export async function fetchExistingProductSlugs(slugs) {
  const unique = [...new Set(slugs)].filter(Boolean);
  if (unique.length === 0) return new Set();
  const { data, error } = await supabase
    .from('products')
    .select('slug')
    .in('slug', unique)
    .eq('is_deleted', false);
  if (error) throw error;
  return new Set((data ?? []).map((p) => p.slug));
}

/** Náhled konceptu přes Edge funkci (service-role, token-gated). */
export async function fetchPreviewPost(slug, token) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${base}/functions/v1/get-blog-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ slug, token }),
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => ({}));
  return json.post ?? null;
}
```

- [ ] **Step 4: Spustit — musí projít**

Run: `npm test -- --run src/lib/blog.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog.js src/lib/blog.test.js
git commit -m "feat(web): datová vrstva blog.js (výpis, detail, related, preview) + testy"
```

---

## Task 7: Blokové komponenty (YouTube facade, CTA) — TDD

**Repo:** `cesty-bez-mapy`

**Files:**
- Create: `src/components/blog/YoutubeEmbed.jsx`
- Create: `src/components/blog/ProductCtaLink.jsx`

- [ ] **Step 1: `YoutubeEmbed.jsx`** (facade náhled → na klik `youtube-nocookie` iframe; validace ID)

```jsx
import { useState } from 'react';
import { extractYoutubeId } from '../../utils/blogContent';

/** YouTube blok: lehký facade náhled, po kliknutí načte privacy-friendly iframe. */
export default function YoutubeEmbed({ videoId }) {
  const id = extractYoutubeId(videoId);
  const [open, setOpen] = useState(false);
  if (!id) return null;

  if (open) {
    return (
      <div className="blog-youtube">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="blog-youtube blog-youtube-facade"
      onClick={() => setOpen(true)}
      aria-label="Přehrát video"
    >
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <span className="blog-youtube-play" aria-hidden="true">▶</span>
    </button>
  );
}
```

- [ ] **Step 2: `ProductCtaLink.jsx`** (interní `<Link>`; vykreslí jen když produkt existuje)

```jsx
import { Link } from 'react-router-dom';

/** CTA na produkt: interní navigace; vykreslí se jen pokud produkt existuje (spec §11.2). */
export default function ProductCtaLink({ slug, label, exists }) {
  if (!exists) return null;
  return (
    <Link to={`/cestovni-pruvodci/${slug}`} className="blog-cta">
      🛒 {label || 'Zobrazit průvodce'}
    </Link>
  );
}
```

- [ ] **Step 3: Ověřit (lint + build)**

Run: `npm run build`
Expected: PASS (komponenty se přeloží; testy hydratace jsou v Tasku 8).

- [ ] **Step 4: Commit**

```bash
git add src/components/blog/YoutubeEmbed.jsx src/components/blog/ProductCtaLink.jsx
git commit -m "feat(web): blokové komponenty YouTube facade + ProductCTA link"
```

---

## Task 8: Renderer `BlogContentRenderer.jsx` (sanitizace + hydratace) — TDD

**Repo:** `cesty-bez-mapy`

**Files:**
- Create: `src/components/blog/BlogContentRenderer.test.jsx`
- Create: `src/components/blog/BlogContentRenderer.jsx`

- [ ] **Step 1: Napsat padající testy**

Vytvoř `src/components/blog/BlogContentRenderer.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BlogContentRenderer from './BlogContentRenderer';

const renderWith = (html, validProductSlugs) =>
  render(
    <MemoryRouter>
      <BlogContentRenderer html={html} validProductSlugs={validProductSlugs} />
    </MemoryRouter>,
  );

describe('BlogContentRenderer', () => {
  it('vykreslí běžné HTML (odstavec, callout)', () => {
    renderWith('<p>Ahoj světe</p><aside class="blog-callout"><p>tip</p></aside>');
    expect(screen.getByText('Ahoj světe')).toBeInTheDocument();
    expect(screen.getByText('tip')).toBeInTheDocument();
  });

  it('hydratuje YouTube blok na facade tlačítko', () => {
    renderWith('<div data-youtube-id="dQw4w9WgXcQ"></div>');
    expect(screen.getByRole('button', { name: 'Přehrát video' })).toBeInTheDocument();
  });

  it('CTA vykreslí jako odkaz, jen když produkt existuje', () => {
    const html = '<a data-product-slug="salzburg-vikend" class="blog-cta">Průvodce</a>';
    const { rerender } = renderWith(html, new Set()); // neexistuje
    expect(screen.queryByRole('link')).toBeNull();

    rerender(
      <MemoryRouter>
        <BlogContentRenderer html={html} validProductSlugs={new Set(['salzburg-vikend'])} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/cestovni-pruvodci/salzburg-vikend');
  });

  it('zahodí <script> (sanitizace)', () => {
    const { container } = renderWith('<p>ok</p><script>window.__x=1</script>');
    expect(container.querySelector('script')).toBeNull();
    expect(window.__x).toBeUndefined();
  });
});
```

- [ ] **Step 2: Spustit — musí padat**

Run: `npm test -- --run src/components/blog/BlogContentRenderer.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implementovat `src/components/blog/BlogContentRenderer.jsx`**

```jsx
import parse from 'html-react-parser';
import { sanitizeBlogHtml } from '../../utils/blogContent';
import YoutubeEmbed from './YoutubeEmbed';
import ProductCtaLink from './ProductCtaLink';

/**
 * Vykreslí HTML tělo článku: nejdřív DOMPurify sanitizace, pak hydratace
 * YouTube (data-youtube-id) a CTA (data-product-slug) na React komponenty.
 * Callout a galerie zůstávají jako (osanitizované) HTML stylované přes CSS.
 */
export default function BlogContentRenderer({ html, validProductSlugs }) {
  const clean = sanitizeBlogHtml(html);

  const options = {
    replace(node) {
      if (node.type !== 'tag' || !node.attribs) return undefined;
      if (node.name === 'div' && node.attribs['data-youtube-id']) {
        return <YoutubeEmbed videoId={node.attribs['data-youtube-id']} />;
      }
      if (node.name === 'a' && node.attribs['data-product-slug']) {
        const slug = node.attribs['data-product-slug'];
        const label = node.children?.[0]?.data ?? 'Zobrazit průvodce';
        return (
          <ProductCtaLink
            slug={slug}
            label={label}
            exists={validProductSlugs?.has(slug) ?? false}
          />
        );
      }
      return undefined;
    },
  };

  return <div className="blog-content prose prose-lg max-w-none">{parse(clean, options)}</div>;
}
```

- [ ] **Step 4: Spustit — musí projít**

Run: `npm test -- --run src/components/blog/BlogContentRenderer.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/blog/BlogContentRenderer.jsx src/components/blog/BlogContentRenderer.test.jsx
git commit -m "feat(web): BlogContentRenderer (DOMPurify + hydratace bloků) + testy"
```

---

## Task 9: Blogové styly (callout, galerie, CTA, YouTube)

**Repo:** `cesty-bez-mapy`

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Přidat styly na konec `src/index.css`**

```css
/* ===== Blog „Inspirace na cesty" ===== */
.blog-content { color: #1f2937; }
.blog-content img.blog-img { border-radius: 0.75rem; margin: 1.5rem 0; }

.blog-callout {
  background: #fff8e1;
  border-left: 4px solid #e0a800;
  padding: 0.75rem 1rem;
  margin: 1.25rem 0;
  border-radius: 0.375rem;
}
.blog-callout > :first-child { margin-top: 0; }
.blog-callout > :last-child { margin-bottom: 0; }

.blog-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.5rem;
  margin: 1.5rem 0;
}
.blog-gallery img { width: 100%; height: 100%; object-fit: cover; border-radius: 0.5rem; }

.blog-cta {
  display: inline-block;
  background: #2e7d32;
  color: #fff;
  padding: 0.625rem 1.375rem;
  border-radius: 0.375rem;
  font-weight: 600;
  text-decoration: none;
  margin: 0.5rem 0;
}
.blog-cta:hover { background: #276b2b; }

.blog-youtube {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin: 1.5rem 0;
  border: 0;
  padding: 0;
  border-radius: 0.5rem;
  overflow: hidden;
  background: #000;
  cursor: pointer;
}
.blog-youtube iframe { width: 100%; height: 100%; border: 0; }
.blog-youtube-facade img { width: 100%; height: 100%; object-fit: cover; opacity: 0.9; }
.blog-youtube-play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.6);
}
```

- [ ] **Step 2: Ověřit build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(web): styly blogového obsahu (callout, galerie, CTA, YouTube)"
```

---

## Task 10: Výpis `/inspirace` z DB + filtr tagů

**Repo:** `cesty-bez-mapy`

**Files:**
- Modify: `src/pages/TravelInspiration.jsx`

**Pozn.:** Zachováme stávající `<Layout>` + `<PageHero>` + design karty (`card-base card-hover`, `line-clamp-*`). Místo hardcoded `BLOG_POSTS` tahá z DB; karty linkují na `/inspirace/:slug`; přidáme řádek s filtrem tagů.

- [ ] **Step 1: Přepsat `src/pages/TravelInspiration.jsx`**

```jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import { BASE_PATH } from '../constants';
import { fetchPublishedPosts, fetchTags } from '../lib/blog';

const BlogCard = ({ post, tagNames }) => {
  const [imageError, setImageError] = useState(false);
  return (
    <Link
      to={`/inspirace/${post.slug}`}
      className="card-base card-hover flex flex-col ease-in-out min-h-[672px] max-h-[672px] cursor-pointer group no-underline"
      aria-label={`Zobrazit článek: ${post.title}`}
    >
      <div className="relative w-full h-60 flex-shrink-0 overflow-hidden">
        {post.image_url && !imageError ? (
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <span className="text-green-800 text-4xl font-bold">?</span>
          </div>
        )}
        {tagNames[0] && (
          <span className="absolute top-3 left-3 bg-white/60 backdrop-blur-sm text-gray-800 text-xs font-semibold px-2.5 py-1.5 rounded-full uppercase tracking-wider z-10">
            #{tagNames[0]}
          </span>
        )}
      </div>
      <div className="p-7 flex flex-col flex-grow">
        <h3 className="text-lg font-medium text-black mb-2 leading-snug line-clamp-3">
          {post.title}
        </h3>
        <div className="w-[70px] h-0.5 bg-gradient-to-r from-green-800 to-green-600 mx-auto my-3 rounded-full group-hover:w-[100px] transition-all duration-300 ease-in-out"></div>
        <p className="text-sm text-black leading-relaxed mt-2 flex-grow line-clamp-8">
          {post.excerpt}
        </p>
        <span className="self-start mt-auto inline-block bg-green-800 group-hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Přečti si celý článek
        </span>
      </div>
    </Link>
  );
};
BlogCard.displayName = 'BlogCard';

const TravelInspiration = () => {
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null); // tag id nebo null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [postsData, tagsData] = await Promise.all([fetchPublishedPosts(), fetchTags()]);
        if (!isMounted) return;
        setPosts(postsData);
        setTags(tagsData);
      } catch (err) {
        if (!isMounted) return;
        console.error('Chyba načítání článků:', err);
        setError('Články se nepodařilo načíst.');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const tagNameById = useMemo(() => {
    const map = new Map();
    tags.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [tags]);

  // Zobrazíme jen tagy, které mají aspoň jeden publikovaný článek.
  const usedTags = useMemo(() => {
    const used = new Set();
    posts.forEach((p) => (p.tag_ids || []).forEach((id) => used.add(id)));
    return tags.filter((t) => used.has(t.id));
  }, [posts, tags]);

  const visiblePosts = useMemo(
    () => (activeTag ? posts.filter((p) => (p.tag_ids || []).includes(activeTag)) : posts),
    [posts, activeTag],
  );

  const tagNamesFor = useCallback(
    (post) => (post.tag_ids || []).map((id) => tagNameById.get(id)).filter(Boolean),
    [tagNameById],
  );

  return (
    <Layout>
      <PageHero
        backgroundImage={`${BASE_PATH}/images/blog-hero.jpg`}
        title="Inspirace na cesty"
        subtitle="Hledáš tipy na víkend, útěk z města nebo malé dobrodružství? Tady najdeš články plné nápadů, pro cesty v Česku i Evropě."
        overlayOpacity={0.5}
        ariaLabel="Hero sekce s názvem stránky"
      />

      <main className="py-16 px-5 max-w-6xl mx-auto" role="main" aria-label="Seznam článků o cestování" style={{ overflowAnchor: 'none' }}>
        {usedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTag === null ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Vše
            </button>
            {usedTags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTag(t.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTag === t.id ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                #{t.name}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-center py-20 text-gray-600">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-700 mb-4"></div>
            <p>Načítám články…</p>
          </div>
        )}

        {!loading && error && (
          <p className="text-center py-20 text-gray-600">{error}</p>
        )}

        {!loading && !error && visiblePosts.length === 0 && (
          <p className="text-center py-20 text-gray-600">Zatím tu nejsou žádné články. Brzy přibydou!</p>
        )}

        {!loading && !error && visiblePosts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {visiblePosts.map((post) => (
              <BlogCard key={post.id} post={post} tagNames={tagNamesFor(post)} />
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
};
TravelInspiration.displayName = 'TravelInspiration';

export default TravelInspiration;
```

- [ ] **Step 2: Ověřit build + lint**

Run: `npm run build`
Expected: PASS. (Pozn.: pokud projekt nepoužívá `no-underline` třídu, je z Tailwindu k dispozici; karty mají `text-decoration:none`.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/TravelInspiration.jsx
git commit -m "feat(web): výpis /inspirace z DB + filtr tagů (konec mockupu)"
```

---

## Task 11: Detail `/inspirace/:slug` + routa + SEO + související + náhled

**Repo:** `cesty-bez-mapy`

**Files:**
- Create: `src/components/blog/SeoTags.jsx`
- Modify: `src/constants/routes.js`
- Modify: `src/App.jsx`
- Create: `src/pages/BlogPostDetail.jsx`

- [ ] **Step 1: `SeoTags.jsx`** (nativní React 19 metadata + JSON-LD)

Vytvoř `src/components/blog/SeoTags.jsx`:

```jsx
/**
 * SEO meta pro detail článku. React 19 hoistuje <title>/<meta>/<link> do <head>.
 * JSON-LD se vykreslí inline (Google čte strukturovaná data i v body).
 */
export default function SeoTags({ meta }) {
  return (
    <>
      <title>{`${meta.title} | Cesty bez mapy`}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={meta.canonical} />
      <meta property="og:type" content="article" />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:image" content={meta.ogImage} />
      <meta property="og:url" content={meta.canonical} />
      <meta name="twitter:card" content="summary_large_image" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(meta.jsonLd) }}
      />
    </>
  );
}
```

- [ ] **Step 2: Routa** — `src/constants/routes.js`: do objektu `ROUTES` přidej (za `INSPIRATION`):
```js
  INSPIRATION_DETAIL: '/inspirace/:slug',
```

- [ ] **Step 3: `src/App.jsx`** — přidej import a routu. Import k ostatním stránkám:
```jsx
import BlogPostDetail from './pages/BlogPostDetail';
```
Routu vlož HNED za řádek s `ROUTES.INSPIRATION`:
```jsx
            <Route path={ROUTES.INSPIRATION_DETAIL} element={<BlogPostDetail />} />
```

- [ ] **Step 4: `src/pages/BlogPostDetail.jsx`**

```jsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import { ROUTES } from '../constants';
import {
  fetchPostBySlug,
  fetchPreviewPost,
  fetchRelatedPosts,
  fetchTags,
  fetchExistingProductSlugs,
} from '../lib/blog';
import { readingTimeMinutes, extractProductSlugs } from '../utils/blogContent';
import { buildBlogMeta } from '../utils/blogSeo';
import BlogContentRenderer from '../components/blog/BlogContentRenderer';
import SeoTags from '../components/blog/SeoTags';

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const BlogPostDetail = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreview = searchParams.get('preview') === '1';
  const previewToken = searchParams.get('token');

  const [post, setPost] = useState(null);
  const [tags, setTags] = useState([]);
  const [related, setRelated] = useState([]);
  const [validProductSlugs, setValidProductSlugs] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data =
          isPreview && previewToken
            ? await fetchPreviewPost(slug, previewToken)
            : await fetchPostBySlug(slug);
        if (!isMounted) return;
        if (!data) {
          setError('Článek nebyl nalezen.');
          return;
        }
        setPost(data);

        const [tagsData, relatedData, productSlugs] = await Promise.all([
          fetchTags(),
          fetchRelatedPosts(data.tag_ids || [], data.id),
          fetchExistingProductSlugs(extractProductSlugs(data.content || '')),
        ]);
        if (!isMounted) return;
        setTags(tagsData);
        setRelated(relatedData);
        setValidProductSlugs(productSlugs);
      } catch (err) {
        if (!isMounted) return;
        console.error('Chyba načítání článku:', err);
        setError('Článek se nepodařilo načíst.');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [slug, isPreview, previewToken]);

  const tagNameById = useMemo(() => {
    const map = new Map();
    tags.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [tags]);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mb-4"></div>
            <p className="text-gray-600">Načítám článek…</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !post) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="mb-6"><span className="text-6xl">😔</span></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Článek nebyl nalezen'}</h1>
            <Button onClick={() => navigate(ROUTES.INSPIRATION)} variant="green" size="lg">
              Zpět na inspiraci
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const meta = buildBlogMeta(post);
  const postTagNames = (post.tag_ids || []).map((id) => tagNameById.get(id)).filter(Boolean);
  const minutes = readingTimeMinutes(post.content);

  return (
    <Layout>
      <SeoTags meta={meta} />

      {isPreview && (
        <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-900 text-sm text-center py-2 px-4">
          Náhled konceptu — tento článek {post.published_at ? 'je publikovaný' : 'ještě není veřejně publikovaný'}.
        </div>
      )}

      <main className="min-h-screen bg-white">
        {post.image_url && (
          <div
            className="w-full h-64 sm:h-80 bg-center bg-cover"
            style={{ backgroundImage: `url(${post.image_url})` }}
            role="img"
            aria-label={post.title}
          />
        )}

        <article className="max-w-2xl mx-auto px-5 py-10">
          <nav className="mb-6">
            <Link to={ROUTES.INSPIRATION} className="text-sm text-gray-600 hover:text-green-700">
              ← Inspirace na cesty
            </Link>
          </nav>

          <div className="text-xs text-gray-500 mb-2">
            {formatDate(post.published_at)} · ⏱ {minutes} min čtení
          </div>
          {postTagNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {postTagNames.map((name) => (
                <span key={name} className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs">
                  #{name}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold text-black leading-tight mb-6">{post.title}</h1>

          <BlogContentRenderer html={post.content} validProductSlugs={validProductSlugs} />
        </article>

        {related.length > 0 && (
          <section className="max-w-4xl mx-auto px-5 pb-16">
            <hr className="border-gray-200 mb-8" />
            <h2 className="text-sm text-gray-500 mb-4">Mohlo by se ti líbit</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/inspirace/${r.slug}`}
                  className="card-base card-hover flex flex-col cursor-pointer group no-underline"
                >
                  <div className="relative w-full h-36 overflow-hidden">
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-green-100" />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-black line-clamp-3">{r.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </Layout>
  );
};
BlogPostDetail.displayName = 'BlogPostDetail';

export default BlogPostDetail;
```

- [ ] **Step 5: Ověřit build + lint**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/blog/SeoTags.jsx src/constants/routes.js src/App.jsx src/pages/BlogPostDetail.jsx
git commit -m "feat(web): detail /inspirace/:slug + SEO (React 19 + JSON-LD) + související + náhled konceptů"
```

---

## Task 12: Admin — do „Náhled" doplnit preview token

**Repo:** `cesty-bez-mapy-admin`

**Files:**
- Modify: `src/resources/blog-posts/BlogPostEdit.tsx`

> Po migraci `044` má každý článek `preview_token`; React Admin ho má v `record`. „Náhled" ho přidá do URL, aby frontend mohl přes edge funkci načíst i koncept.

- [ ] **Step 1: Upravit `BlogEditToolbar`** v `src/resources/blog-posts/BlogPostEdit.tsx`

Nahraď `onClick` u tlačítka „Náhled" tak, aby přidalo token (jen když existuje):
```tsx
          onClick={() =>
            window.open(
              `${FRONTEND_URL}/inspirace/${record.slug}?preview=1${
                record.preview_token ? `&token=${record.preview_token}` : ""
              }`,
              "_blank",
              "noopener,noreferrer",
            )
          }
```

- [ ] **Step 2: Ověřit**

Run: `cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin && npm run type-check && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit** (v admin repu — pokud je na `main`, nejdřív větev `feat/blog-inspirace-web` i tady)

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin
git checkout -b feat/blog-inspirace-web 2>/dev/null || git checkout feat/blog-inspirace-web
git add src/resources/blog-posts/BlogPostEdit.tsx
git commit -m "feat(admin): náhled konceptu přes preview_token v URL"
```

---

## Task 13: Finální QA Plánu B

- [ ] **Step 1: Testy + build (frontend)**

Run: `cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy && npm test -- --run && npm run build`
Expected: všechny testy PASS, build projde.

- [ ] **Step 2: Manuální E2E přes `playwright-cli`** (proti běžícímu `npm run dev` + živé DB)

V adminu (z Plánu A) vytvoř/uprav publikovaný článek s tagy a bohatým obsahem (Tip box, YouTube, CTA na existující produkt, obrázek). Pak na webu projdi:
1. `/inspirace` — článek je ve výpisu; filtr tagů funguje (klik na tag schová ostatní).
2. Klik na kartu → `/inspirace/<slug>` — hero, datum, reading time, tagy, tělo.
3. **Tip box** má žluté pozadí; **YouTube** facade → po kliknutí přehraje `youtube-nocookie`; **CTA** je zelené tlačítko vedoucí na `/cestovni-pruvodci/<slug>`; **obrázky** se zobrazí.
4. **Související články** dole (sdílený tag) vedou na další detail.
5. **SEO:** v DOM je `<title>`, `<meta name="description">`, `<link rel="canonical">`, `og:*` a `<script type="application/ld+json">` (ověř `document.querySelector('script[type="application/ld+json"]')`).
6. **Náhled konceptu:** v adminu u NEpublikovaného článku klikni „Náhled" → otevře `?preview=1&token=…` → web koncept zobrazí (žlutý pruh „Náhled konceptu"). Bez tokenu / se špatným tokenem → „Článek nebyl nalezen".

- [ ] **Step 3: XSS ověření** (manuální)

V adminu dočasně vlož do obsahu článku `<script>window.__x=1</script>` a `<img src="https://evil.tld/x.jpg">`, ulož, zobraz na webu → v konzoli `window.__x` je `undefined`, cizí `<img>` se nevykreslil. Potom obsah vrať zpět.

- [ ] **Step 4: Závěrečný commit (pokud zbývají změny)**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
git status
git add -A && git commit -m "chore(web): dokončení Plánu B (veřejný blog)" || echo "nic k commitu"
```

---

## Hotovo (Plán B)

Po Plánu B veřejný web zobrazuje publikované články z DB: výpis `/inspirace` s filtrem tagů, detail `/inspirace/:slug` s bezpečně vykresleným bohatým obsahem (sanitizace + hydratace YouTube/CTA), souvisejícími články a SEO (nativní metadata React 19 + JSON-LD). Jana vidí náhled konceptu přes zabezpečenou Edge funkci. Celý blog je end-to-end funkční.

**Mimo rozsah (dle specu §10):** prerender/SSR pro sociální OG náhledy (celosystémové), stránkování výpisu, komentáře/RSS.

---

## Self-Review (kontrola proti specu)

**Pokrytí specu §5–§8, §11:**
- §5 výpis z DB + filtr tagů → Task 10 ✓; detail s reading time + tagy + související → Task 11 ✓; routing + konstanta → Task 11 ✓.
- §6 DOMPurify allowlist + img jen z úložiště → Task 4 ✓; YouTube/CTA hydratace (ne syrový iframe) → Tasky 7–8 ✓; `youtube-nocookie` facade → Task 7 ✓; CTA interní Link + existence produktu → Tasky 6–8 ✓; prose + custom CSS → Tasky 3, 9 ✓.
- §7 nativní metadata React 19 + OG + canonical + JSON-LD Article → Tasky 5, 11 ✓.
- §8 testy: XSS sanitizace (Task 4, 8) ✓; hydratace bloků (Task 8) ✓; výpis tahá/filtruje (Task 6 + E2E Task 13) ✓; SEO meta přítomné (Task 5 + E2E Task 13) ✓.
- §11 hardening: YouTube ID `^[\w-]{11}$` (Task 4/7) ✓; CTA jen pro existující produkt (Tasky 6, 8, 11) ✓; explicitní `published_at` filtr (Task 6) ✓.
- Náhled konceptů (§4 z Plánu A) → Tasky 1, 2, 11, 12 (Edge fn + token, rozhodnuto dle rešerše) ✓.

**Konzistence názvů:** `sanitizeBlogHtml`, `extractYoutubeId`, `readingTimeMinutes`, `extractProductSlugs`, `buildBlogMeta`, `fetchPublishedPosts/fetchPostBySlug/fetchTags/fetchRelatedPosts/fetchExistingProductSlugs/fetchPreviewPost` — používané shodně napříč Tasky 4–11. ✓

**Caution:** Task 1 = živá DB migrace `044` → pauza + odsouhlasení SQL před aplikací (jako `043`). Task 2 = deploy Edge funkce na ostrý projekt.
