// ================================================
// Supabase Edge Function: Get Blog Preview
// ================================================
// Vrátí blogový článek (i NEpublikovaný koncept) podle slug + preview_token.
// Service-role obchází RLS; jedinou autorizací je per-post preview_token.
// Cache vypnutá (Cache-Control: no-store).
// ================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../_shared/database.types.ts";
import { serveEdge } from "../_shared/serveEdge.ts";
import { jsonResponse } from "../_shared/http.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serveEdge({ auth: "publishable", fnName: "get-blog-preview" }, async (req, ctx) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {}, { "Cache-Control": "no-store" });
  }

  try {
    const { slug, token } = await req.json().catch(() => ({}));
    if (!slug || typeof slug !== "string") {
      return jsonResponse({ error: "Missing slug" }, 400, {}, { "Cache-Control": "no-store" });
    }
    if (!token || typeof token !== "string" || !UUID_RE.test(token)) {
      return jsonResponse({ error: "Invalid token" }, 400, {}, { "Cache-Control": "no-store" });
    }

    const supabase: SupabaseClient<Database> = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id, title, slug, excerpt, image_url, content, seo_title, seo_description, published_at, updated_at, tag_ids, created_at",
      )
      .eq("slug", slug)
      .eq("preview_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!data) return jsonResponse({ error: "Not found" }, 404, {}, { "Cache-Control": "no-store" });

    return jsonResponse({ post: data }, 200, {}, { "Cache-Control": "no-store" });
  } catch (_e) {
    return jsonResponse({ error: "Server error" }, 500, {}, { "Cache-Control": "no-store" });
  }
});
