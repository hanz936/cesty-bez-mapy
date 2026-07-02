import { jsonResponse } from "./http.ts";

// deno-lint-ignore no-explicit-any
export async function assertAdmin(ctx: any, cors: Record<string, string>): Promise<{ ok: true } | { ok: false; response: Response }> {
  const { data: isAdmin } = await ctx.supabase.rpc("is_admin");
  if (!isAdmin) {
    return { ok: false, response: jsonResponse({ error: "forbidden" }, 403, cors) };
  }
  return { ok: true };
}
