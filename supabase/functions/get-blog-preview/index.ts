// ================================================
// Supabase Edge Function: Get Blog Preview
// ================================================
// Vrátí blogový článek (i NEpublikovaný koncept) podle slug + preview_token.
// Service-role obchází RLS; jedinou autorizací je per-post preview_token.
// Cache vypnutá (Cache-Control: no-store).
// ================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";

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
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  // ACAO nastavíme jen pro povolený Origin; jinak prohlížeč cross-origin čtení zablokuje.
  if (allowedOrigins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(withSentry(async (req) => {
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
}, "get-blog-preview"));
