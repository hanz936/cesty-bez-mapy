import { withSupabase } from "npm:@supabase/server@1.2.0"; // ověřený specifier pro Deno edge
import { withCors } from "./withCors.ts";
import { withSentry } from "./sentry.ts";

export type AuthMode = "user" | "publishable" | "secret" | "none" | Array<"user" | "publishable" | "secret">;
export interface ServeEdgeOpts { auth: AuthMode; fnName: string; methods?: string; }
// deno-lint-ignore no-explicit-any
type Handler = (req: Request, ctx: any) => Promise<Response>;
// deno-lint-ignore no-explicit-any
type WithSupabase = (opts: any, handler: Handler) => (req: Request) => Response | Promise<Response>;

// Pořadí (zvenčí dovnitř): withCors → withSentry → withSupabase → handler.
// withCors NEJVNĚJŠÍ: OPTIONS před auth + CORS na všech odpovědích (401/500) + catch throw→500+CORS.
// withSentry UVNITŘ withCors: zachytí výjimku SE stackem a re-throwne dřív, než ji withCors obalí do 500.
export function composeEdge(opts: ServeEdgeOpts, handler: Handler, ws: WithSupabase = withSupabase): (req: Request) => Promise<Response> {
  const supa = ws({ auth: opts.auth, cors: false }, handler);
  const sentried = withSentry(supa, opts.fnName);
  return withCors((req) => sentried(req), { methods: opts.methods });
}

export function serveEdge(opts: ServeEdgeOpts, handler: Handler): void {
  Deno.serve(composeEdge(opts, handler));
}
