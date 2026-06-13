# Manual Setup: Cloudflare Turnstile (production)

This document lists the manual steps required to wire production Cloudflare Turnstile keys into the running deployment. Code changes are already merged; only environment configuration is needed.

**Status pre-launch:** Currently configured with Cloudflare's always-pass test keys. Production keys MUST be swapped before go-live (see [`MEMORY pre_launch_secret_swap`](../../cesty-bez-mapy-admin/docs/superpowers/specs/2026-05-01-cloudflare-turnstile-design.md) for the full launch-secret checklist).

---

## 1. Cloudflare account & widget

1. Sign in to Cloudflare → **Turnstile** → **Add site**.
2. Domain: `cestybezmapy.cz` (add `www.cestybezmapy.cz` and any preview URLs you want to allow, e.g. `*.vercel.app`).
3. Widget mode: **Managed**.
4. Save. Copy the **Site Key** and **Secret Key** that Cloudflare displays.

---

## 2. Frontend env (Vercel)

In the Vercel project for `cesty-bez-mapy`:

1. **Settings → Environment Variables**.
2. Add `VITE_TURNSTILE_SITE_KEY` for **Production** (and Preview if desired).
3. Value: the **Site Key** from step 1.
4. Redeploy the frontend so the variable is bundled.

For local dev, the always-pass test key (`1x00000000000000000000AA`) is set in `.env.local`.

---

## 3. Edge Function secret (Supabase)

```bash
npx supabase secrets set TURNSTILE_SECRET_KEY=<paste_secret_key>
```

(Use the production project ref. Verify with `npx supabase secrets list`.)

Alternative via Dashboard: Supabase Dashboard → Project → Edge Functions → Settings → Secrets → Add `TURNSTILE_SECRET_KEY`.

---

## 4. Supabase Auth CAPTCHA provider

This is what activates Turnstile protection on `signInAnonymously()` calls (Checkout + CustomItineraryForm).

1. Supabase Dashboard → Project → **Authentication** → **Providers** → **CAPTCHA Provider**.
2. **Enable**.
3. Provider: **Cloudflare Turnstile**.
4. **Secret Key**: paste the same secret as in step 3.
5. Save.

**Important:** Without this step, Supabase Auth ignores the `captchaToken` from the frontend. The Turnstile widget will render and produce tokens, but auth calls will succeed without verification — providing no actual bot protection. Always verify after enabling.

---

## 5. Verify

After all deploys:

1. Submit Contact form on the production site → expect success state and a row in `contact_messages`.
2. Submit Collaboration form → expect success state and `form_type='collaboration'` row.
3. Start guest checkout → expect anonymous user created and Stripe redirect.
4. Submit CustomItineraryForm → expect anonymous user + `custom_itinerary_requests` row + Stripe redirect.

To confirm Turnstile is actually enforcing (not just rendering):

- Open browser dev tools → Network tab.
- Submit Contact form.
- Inspect the request to `submit-contact-form`. Body should contain `captchaToken`.
- Inspect the response. Should be 200 with `{"success":true}`.
- For auth flow: `signup` request body should contain `gotrue_meta_security: { captcha_token: "..." }`.

To confirm protection works, temporarily set `TURNSTILE_SECRET_KEY` to the always-fail test value (`2x0000000000000000000000000000000AA`), submit Contact form, expect 403 + "Bezpečnostní ověření selhalo" error message. **Restore real secret immediately after.**

---

## Test keys (dev only — NEVER deploy)

| Purpose      | Site key                           | Secret key                                  |
| ------------ | ---------------------------------- | ------------------------------------------- |
| Always pass  | `1x00000000000000000000AA`         | `1x0000000000000000000000000000000AA`       |
| Always fail  | `2x00000000000000000000AB`         | `2x0000000000000000000000000000000AA`       |

These universal test keys work on **any** domain — localhost, `127.0.0.1`, and any dev/preview/production domain (per Cloudflare docs); the earlier "localhost only" claim was incorrect. Because they always pass/fail regardless of origin, they must NEVER be deployed to production.

---

## Files involved

- Frontend widget component: `src/components/ui/TurnstileField.jsx`
- Edge Function: `supabase/functions/submit-contact-form/index.ts`
- Shared verifier: `supabase/functions/_shared/verifyTurnstile.ts`
- DB table: `public.contact_messages` (migration `035`)
- Auth integration: configured in Supabase Dashboard (step 4 above), not in code
- CORS allowlist: hardcoded in `supabase/functions/submit-contact-form/index.ts` — add new domains there if needed
