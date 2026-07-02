import { ALLOWED_ORIGINS } from "./cors.ts";

const DEFAULT_HEADERS = "authorization, x-client-info, apikey, content-type";

function corsHeadersFor(req: Request, methods: string): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": DEFAULT_HEADERS,
    "Access-Control-Allow-Methods": methods,
    "Vary": "Origin",
  };
}

export function withCors(
  handler: (req: Request) => Response | Promise<Response>,
  opts: { methods?: string } = {},
): (req: Request) => Promise<Response> {
  const methods = opts.methods ?? "POST, OPTIONS";
  return async (req: Request) => {
    const cors = corsHeadersFor(req, methods);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    // withCors je NEJVNĚJŠÍ wrapper → musí obalit CORS i neodchycený throw z handleru/withSupabase.
    // withSentry (uvnitř, blíž handleru) zachytí výjimku SE stackem a re-throwne PŘED tímto catchem.
    let res: Response;
    try {
      res = await handler(req);
    } catch (_e) {
      res = new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
