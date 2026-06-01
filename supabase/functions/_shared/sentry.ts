// ================================================
// Shared Sentry init + handler wrapper for Edge Functions
// ================================================
// Reports BOTH unhandled exceptions (full stack) and any 5xx response
// the handler returns. Wrap each function: Deno.serve(withSentry(handler, "fn-name")).
// No DSN (local dev) → wrapper is a transparent pass-through.
// ================================================

import * as Sentry from "npm:@sentry/deno@^10";

let initialized = false;

function ensureInit(): boolean {
  if (initialized) return true;
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return false;
  Sentry.init({
    dsn,
    defaultIntegrations: false, // edge isolate is short-lived; default global handlers can interfere with flush
    tracesSampleRate: 0,
    sendDefaultPii: false,
    environment: Deno.env.get("SB_REGION") ? "production" : "development",
  });
  Sentry.setTag("region", Deno.env.get("SB_REGION") ?? "unknown");
  initialized = true;
  return true;
}

type Handler = (req: Request) => Response | Promise<Response>;

export function withSentry(handler: Handler, fnName: string): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (!ensureInit()) {
      // Sentry disabled — run handler unguarded so local dev / missing-DSN is a no-op
      return await handler(req);
    }
    const executionId = Deno.env.get("SB_EXECUTION_ID") ?? "unknown";
    try {
      const res = await handler(req);
      if (res.status >= 500) {
        // withScope isolates these tags to THIS event. A Deno isolate serves
        // concurrent requests on one global scope, so per-request tags
        // (fn/execution_id/status) must be scoped or they bleed across requests.
        Sentry.withScope((scope) => {
          scope.setTags({ fn: fnName, execution_id: executionId, status: String(res.status) });
          Sentry.captureMessage(`${fnName} returned ${res.status}`, "error");
        });
        await Sentry.flush(2000); // CRITICAL: isolate freezes after the response
      }
      return res;
    } catch (e) {
      Sentry.withScope((scope) => {
        scope.setTags({ fn: fnName, execution_id: executionId });
        Sentry.captureException(e);
      });
      await Sentry.flush(2000); // CRITICAL: isolate freezes after the response
      throw e; // re-throw → unchanged behavior (Deno.serve returns 500)
    }
  };
}

// Re-exported for manual captures in edge functions that need finer control.
export { Sentry };
