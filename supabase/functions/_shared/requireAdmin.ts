import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "./database.types.ts";
import { jsonResponse } from "./http.ts";

export type ClientFactory = (kind: "anon" | "service", authHeader: string) => SupabaseClient<Database>;

export type RequireAdminResult =
  | { ok: true; user: User | null; userClient: SupabaseClient<Database> }
  | { ok: false; response: Response };

const defaultFactory: ClientFactory = (kind, authHeader) =>
  createClient<Database>(
    Deno.env.get("SUPABASE_URL")!,
    kind === "service"
      ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      : Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

export async function requireAdmin(
  req: Request,
  cors: Record<string, string>,
  opts: { allowServiceRole?: boolean } = {},
  factory: ClientFactory = defaultFactory,
): Promise<RequireAdminResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { ok: false, response: jsonResponse({ error: "unauthorized" }, 401, cors) };
  }

  // Service-role bypass (webhook/server callers): porovnání bearer s service-role klíčem.
  if (opts.allowServiceRole) {
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    if (bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      return { ok: true, user: null, userClient: factory("service", authHeader) };
    }
  }

  const userClient = factory("anon", authHeader);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return { ok: false, response: jsonResponse({ error: "unauthorized" }, 401, cors) };
  }
  const { data: isAdmin } = await userClient.rpc("is_admin");
  if (!isAdmin) {
    return { ok: false, response: jsonResponse({ error: "forbidden" }, 403, cors) };
  }
  return { ok: true, user, userClient };
}
