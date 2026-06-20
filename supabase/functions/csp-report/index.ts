// ================================================
// Edge Function: csp-report
// ================================================
// Public, unauthenticated CSP violation receiver. Browsers POST violation
// reports here via the `report-uri` (legacy) and `report-to` (modern)
// directives in our CSP. Normalizes both shapes and inserts into csp_reports.
// Always returns 204 — this is fire-and-forget; we never want reporting to
// cause user-visible behavior or back-pressure.
// ================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const MAX_BODY_BYTES = 50 * 1024;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

interface NormalizedReport {
  disposition: "enforce" | "report";
  effective_directive: string | null;
  blocked_uri: string | null;
  document_uri: string | null;
  source_file: string | null;
  line_number: number | null;
  column_number: number | null;
  referrer: string | null;
  status_code: number | null;
  sample: string | null;
  user_agent: string | null;
  raw: unknown;
}

function toIntOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}

function toStrOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function normalizeDisposition(v: unknown): "enforce" | "report" {
  // Default to 'enforce' if the browser omits it (legacy report-uri payloads
  // pre-date the `disposition` field; treat unspecified as enforced).
  return v === "report" ? "report" : "enforce";
}

// Returns an array of normalized rows, or null if the body shape is unrecognized.
function normalizeReport(
  body: unknown,
  contentType: string,
  userAgent: string | null,
): NormalizedReport[] | null {
  // Modern: application/reports+json — array of { type, body, user_agent, url, ... }
  if (Array.isArray(body)) {
    const rows: NormalizedReport[] = [];
    for (const entry of body) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      if (e.type !== "csp-violation") continue;
      const b = (e.body && typeof e.body === "object")
        ? e.body as Record<string, unknown>
        : {};
      rows.push({
        disposition: normalizeDisposition(b.disposition),
        effective_directive: toStrOrNull(b.effectiveDirective),
        blocked_uri: toStrOrNull(b.blockedURL),
        document_uri: toStrOrNull(b.documentURL) ?? toStrOrNull(e.url),
        source_file: toStrOrNull(b.sourceFile),
        line_number: toIntOrNull(b.lineNumber),
        column_number: toIntOrNull(b.columnNumber),
        referrer: toStrOrNull(b.referrer),
        status_code: toIntOrNull(b.statusCode),
        sample: toStrOrNull(b.sample),
        user_agent: toStrOrNull(e.user_agent) ?? userAgent,
        raw: entry,
      });
    }
    return rows;
  }

  // Legacy: application/csp-report — { "csp-report": { "document-uri": ..., ... } }
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const r = obj["csp-report"];
    if (r && typeof r === "object") {
      const cr = r as Record<string, unknown>;
      return [{
        disposition: normalizeDisposition(cr["disposition"]),
        effective_directive:
          toStrOrNull(cr["effective-directive"]) ??
          toStrOrNull(cr["violated-directive"]),
        blocked_uri: toStrOrNull(cr["blocked-uri"]),
        document_uri: toStrOrNull(cr["document-uri"]),
        source_file: toStrOrNull(cr["source-file"]),
        line_number: toIntOrNull(cr["line-number"]),
        column_number: toIntOrNull(cr["column-number"]),
        referrer: toStrOrNull(cr["referrer"]),
        status_code: toIntOrNull(cr["status-code"]),
        sample: toStrOrNull(cr["script-sample"]),
        user_agent: userAgent,
        raw: body,
      }];
    }
  }

  // Unrecognized — caller checks for null and returns 400.
  void contentType;
  return null;
}

Deno.serve(withSentry(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS_HEADERS });
  }

  // Defensive size cap — CSP reports are tiny in practice (<2 KB).
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
    return new Response(null, { status: 413, headers: CORS_HEADERS });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return new Response(null, { status: 400, headers: CORS_HEADERS });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413, headers: CORS_HEADERS });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400, headers: CORS_HEADERS });
  }

  const contentType = req.headers.get("content-type") ?? "";
  const userAgent = req.headers.get("user-agent");
  const rows = normalizeReport(parsed, contentType, userAgent);
  if (!rows) {
    return new Response(null, { status: 400, headers: CORS_HEADERS });
  }
  if (rows.length === 0) {
    // Valid shape but nothing CSP-related to record — still success.
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Supabase populates x-forwarded-for; take the first hop.
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // SEC-03: cap report volume per IP to keep csp_reports from bloating.
  const allowedCsp = await enforceRateLimit(supabase, {
    bucket: `csp:${clientIp ?? "unknown"}`,
    limit: 60,
    windowSeconds: 60,
  });
  if (!allowedCsp) {
    // Fire-and-forget endpoint: silently drop over-limit reports.
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const { error } = await supabase.from("csp_reports").insert(
    rows.map((r) => ({ ...r, client_ip: clientIp })),
  );
  if (error) {
    // Never block the caller — log and still return 204.
    console.error("csp_reports insert error", error);
  }

  return new Response(null, { status: 204, headers: CORS_HEADERS });
}, "csp-report"));
