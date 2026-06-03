# Introspekce schématu — evidence (Task 1.2)

> Projekt `dkblgznhnixubyoghrqe` · Postgres 17 · zachyceno 2026-06-03 přes Supabase MCP `execute_sql` (read-only, živé remote schéma).

## Step 1 — Tabulky + RLS status (17 tabulek v `public`)

Všech **17** tabulek má `rls_enabled = true` (žádný lint 0013). `rls_forced = false` u všech (normální — forced RLS aplikuje RLS i na vlastníka tabulky; není vyžadováno).

```
blog_posts, blog_tags, categories, contact_messages, csp_reports,
custom_itinerary_requests, customers, download_tokens, email_events,
email_suppressions, fakturoid_tokens, integration_logs,
newsletter_consent_log, order_items, orders, products, user_roles
```

(Pozn.: spec/plán odhadovaly 11 tabulek — skutečnost je 17. Přibyly blog_*, csp_reports, email_*, fakturoid_tokens, integration_logs, newsletter_consent_log, download_tokens.)

## Step 2 — RLS policies (~60 policies public+storage)

**Dobré patterny (potvrzeno):**
- Všechny admin policies používají `(SELECT is_admin())` — initplan-wrapped → žádný lint 0003.
- User-scoped policies používají `(SELECT auth.uid())` — wrapped.
- `is_admin()` čte JWT claim (ne tabulku), fail-closed, vylučuje anonymní uživatele.

**🔴 NÁLEZY v policies:**

| Tabulka | Policy | Role | Cmd | Výraz | Problém |
|---|---|---|---|---|---|
| `download_tokens` | `download_tokens_public_select` | **anon** | SELECT | `USING (true)` | **CRITICAL** — veřejný API klíč přečte VŠECHNY bearer tokeny |
| `download_tokens` | `download_tokens_authenticated_select` | **authenticated** | SELECT | `USING (true)` | **CRITICAL/HIGH** — kterýkoliv přihlášený uživatel přečte všechny tokeny |
| `blog_tags` | `blog_tags_admin_all` + `blog_tags_public_read` | authenticated | SELECT | obě permissive | lint 0006 — multiple permissive policies (perf) |

**Intencionálně veřejné (OK by design):**
- `products_public_select` (anon+auth, `is_deleted = false`) — veřejný katalog.
- `categories_public_select` (anon+auth, `true`) — veřejné taxonomie.
- `blog_posts_public_select` (anon, `published_at IS NOT NULL`) — publikované články.
- `blog_tags_public_read` (anon+auth, `true`) — veřejné tagy.
- `newsletter_consent_public_insert` (anon+auth, INSERT s NOT NULL check) — veřejný newsletter signup (mírné riziko spamu → Low).
- `user_roles_auth_admin_read_user_roles` (role `supabase_auth_admin`, `true`) — pro custom_access_token_hook. OK (restriktivní systémová role).

## Step 3 — Tabulky bez PK

`[]` — prázdné. Všechny tabulky mají primární klíč (žádný lint 0004). ✓

## Step 4 — Funkce: security definer + search_path (14 funkcí)

**Všechny funkce mají pinned `search_path`** → žádný lint 0011. ✓ Ale **nekonzistentní konvence** (Low):

| Funkce | SECDEF | search_path | Jazyk |
|---|---|---|---|
| cleanup_orphaned_anon_users | ✔ | `''` | plpgsql |
| create_order_with_items | invoker | `public` | plpgsql |
| custom_access_token_hook | invoker | `''` | plpgsql |
| handle_new_permanent_user | ✔ | `public` | plpgsql |
| handle_user_email_update | ✔ | `''` | plpgsql |
| increment_download_count | ✔ | `public` | sql |
| increment_email_resend_count | ✔ | `public` | plpgsql |
| is_admin | invoker | `''` | plpgsql |
| is_permanent_user | invoker | `''` | plpgsql |
| link_orders_to_customer | ✔ | `''` | plpgsql |
| link_requests_to_customer | ✔ | `''` | plpgsql |
| notify_vercel_blog_publish | ✔ | `''` | plpgsql |
| update_all_products_in_order | invoker | `''` | plpgsql |
| update_product_total_sales | invoker | `''` | plpgsql |

Mix `search_path=''` (nejpřísnější) vs `search_path=public`. Doporučení: sjednotit na `''` s plně kvalifikovanými názvy (Low, kosmetika — funkčně OK, protože i `public` verze používají kvalifikované `public.<table>`).

**Definice klíčových funkcí:**
- `is_admin()` — invoker, STABLE, čte `auth.jwt()->>'is_admin'` + kontroluje `is_anonymous IS FALSE`, COALESCE fail-closed. **Bezpečný, performantní pattern.** ✓
- `custom_access_token_hook(jsonb)` — invoker, čte `public.user_roles` pro event user_id, přidává `is_admin`/`user_role` claims. Jen `service_role` exec. ✓
- `increment_email_resend_count(text,uuid,text)` — secdef; **whitelist** table_name ('orders'|'custom_itinerary_requests', jinak RAISE) → žádná SQL injekce. Ale exponovaná anonu (viz Step 5).
- `increment_download_count(uuid)` — secdef sql, `UPDATE download_tokens SET download_count+1 WHERE id=token_id`. Exponovaná anonu.
- `notify_vercel_blog_publish()` — secdef, RETURNS `trigger`, čte `vault.decrypted_secrets` ('vercel_deploy_hook') + `net.http_post`. Vrací trigger → PostgREST ji jako RPC NEvystaví.

## Step 5 — EXECUTE granty na funkce (linty 0028/0029)

**🟠 SECURITY DEFINER funkce exponované `anon` + `authenticated`:**

| Funkce | anon | auth | service | SECDEF | Posouzení |
|---|---|---|---|---|---|
| increment_download_count | ✔ | ✔ | ✔ | ✔ | **HIGH/Med** — anon může bumpovat download_count libovolného tokenu (DoS download limitu) |
| increment_email_resend_count | ✔ | ✔ | ✔ | ✔ | **Med** — anon může vyčerpat resend limit cizí objednávky (DoS) |
| notify_vercel_blog_publish | ✔ | ✔ | ✔ | ✔ | **Low** — vrací trigger, PostgREST RPC ji nevystaví; revoke = hygiena |

**Trigger funkce (invoker) zbytečně exponované** (Low, hygiena): `update_all_products_in_order`, `update_product_total_sales` — anon/auth exec true, ale jsou to trigger funkce.

**Správně omezené:** `cleanup_orphaned_anon_users`, `create_order_with_items`, `custom_access_token_hook`, `handle_new_permanent_user`, `handle_user_email_update`, `link_orders_to_customer`, `link_requests_to_customer` — pouze `service_role`. ✓
`is_admin`, `is_permanent_user` — anon/auth exec true, ale invoker + používané v policies → OK.

## Step 6 — Triggery

Vše konzistentní/očekávané: `moddatetime('updated_at')` na blog_posts/categories/contact_messages/custom_itinerary_requests/customers/orders/products; `trg_blog_publish_deploy` (INSERT/UPDATE/DELETE → notify_vercel_blog_publish); `on_customer_created` + `on_customer_created_link_orders` (link_requests/link_orders); `update_total_sales_on_order_item_change` (I/U/D); `update_total_sales_on_order_status_change`. Žádný nález.

## Step 7 — Indexy

- **Neindexované FK:** `[]` — všechny FK indexované (žádný lint 0001). ✓
- **Redundantní/duplicitní (group by indkey):**
  - 🟡 `orders`: `orders_stripe_payment_id_key` (UNIQUE constraint) + `idx_orders_stripe_payment_id` (plain) — **skutečný duplikát**, plain index lze dropnout (unique už indexuje). (Low/Med perf)
  - `custom_itinerary_requests`: `{idx_custom_requests_delivery_email_unsent, idx_custom_requests_created_at}` — stejný indkey (created_at), ale pravděpodobně **partial** indexy s různým predikátem → NE pravý duplikát (ověřit predikát před dropem).
  - `orders`: `{idx_orders_created_at, idx_orders_pending, idx_orders_confirmation_email_unsent}` — stejný indkey (created_at), pravděpodobně **partial** → NE pravý duplikát (ověřit predikát).
- **Nevyužité indexy (0005):** ~31 — **pre-launch šum** (idx_scan=0, žádný provoz). NEdropovat plošně; jen skutečné duplikáty výše.

## Step 8 — Extensions

| Extension | Schéma | Verze | Nález |
|---|---|---|---|
| moddatetime | extensions | 1.0=latest | ✓ |
| **pg_net** | **public** | 0.19.5=latest | **🟠 lint 0014 — přesunout z public** |
| pg_stat_statements | extensions | 1.11 | ✓ |
| pgcrypto | extensions | 1.3 | ✓ |
| plpgsql | pg_catalog | 1.0 | ✓ |
| supabase_vault | vault | 0.3.1 | ✓ |
| uuid-ossp | extensions | 1.1 | ✓ |

Všechny na latest (žádný 0022). Jediný problém: **pg_net v public** (přesun ověřit proti docs — pg_net bývá Supabase-managed, relokace má caveaty).

## Step 9 — Storage buckety

| Bucket | Public | Limit | MIME | Nález |
|---|---|---|---|---|
| blog-images | ✔ public | 10 MB | image/jpeg,png,webp | ✓ |
| products-images | ✔ public | 10 MB | image/jpeg,png,webp | ✓ |
| custom-itinerary-pdfs | private | 200 MB | application/pdf | ✓ |
| products-pdfs | private | 50 MB | application/pdf | ✓ |

`storage.objects` má jen **admin** policies (per bucket, `is_admin()`); žádná anon/auth SELECT policy → bucket listing přes API není vystaven (public buckety servírují objekty přímo přes CDN dle public flagu). Žádný lint 0025. ✓
(Pozn.: policy `custom_itinerary_pdfs_admin_*` cílí bucket `custom-itinerary-pdfs` — konzistentní.)

## Step 10 — FK ON DELETE chování

| Child | FK | Parent | ON DELETE |
|---|---|---|---|
| customers | fk_customers_auth_users | auth.users | CASCADE |
| orders | orders_customer_id_fkey | customers | SET NULL |
| orders | orders_auth_user_id_fkey | auth.users | SET NULL |
| order_items | order_items_order_id_fkey | orders | CASCADE |
| order_items | order_items_product_id_fkey | products | RESTRICT |
| order_items | order_items_custom_itinerary_request_id_fkey | custom_itinerary_requests | SET NULL |
| custom_itinerary_requests | ..._auth_user_id_fkey | auth.users | CASCADE |
| custom_itinerary_requests | ..._customer_id_fkey | customers | SET NULL |
| download_tokens | ..._custom_itinerary_request_id_fkey | custom_itinerary_requests | CASCADE |
| download_tokens | download_tokens_order_id_fkey | orders | CASCADE |
| user_roles | user_roles_user_id_fkey | auth.users | CASCADE |

Promyšlené: smazání auth.users kaskáduje na customers/custom_requests/user_roles, ale `orders.auth_user_id` = SET NULL (zachová finanční historii). `order_items.product_id` = RESTRICT (chrání produkty v objednávkách; produkty navíc soft-delete). Žádný integritní nález.

## Step 11 (systémový) — Table-level granty anon/authenticated

**🟠 VŠECH 17 public tabulek má `GRANT ALL` (DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE) pro `anon` I `authenticated`.**

To je **Supabase default** (model: bezpečnost stojí na RLS, granty jsou hrubé). Implikace:
- Bezpečnost závisí VÝHRADNĚ na korektnosti RLS → každá RLS díra je plně exploitovatelná přes PostgREST.
- **Proto je `download_tokens` `USING(true)` CRITICAL** (anon SELECT grant + USING(true) = veřejné čtení tokenů).
- `TRUNCATE/REFERENCES/TRIGGER` granty anonu nejsou přes PostgREST přímo dosažitelné (PostgREST je nevystaví), ale porušují least-privilege. Zúžení grantů = Low/volitelné (ověřit doporučení 06/2026; má PostgREST implikace).

**Závěr Task 1.2:** hlavní nález = `download_tokens` RLS expozice (CRITICAL). Sekundární: 0028/0029 secdef granty, pg_net v public, blog_tags duplicate permissive, redundantní index na orders, nekonzistentní search_path konvence.
