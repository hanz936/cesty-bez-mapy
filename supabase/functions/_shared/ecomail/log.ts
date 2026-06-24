import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database, Json } from "../database.types.ts";
import { logError } from "../log.ts";

/** Zapíše řádek do integration_logs. POZOR: tabulka má sloupce status + error_message
 *  (NE success boolean). Píše se přes service-role klienta (bypass RLS).
 *  Logování je best-effort: chybu jen reportuje (nethrowuje), aby neshodilo hlavní flow. */
export async function logEcomail(
  supabase: SupabaseClient<Database>,
  action: string,
  status: "success" | "failed",
  metadata: Record<string, Json | undefined>,
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabase.from("integration_logs").insert({
    service: "ecomail",
    action,
    status,
    error_message: errorMessage ?? null,
    metadata,
  });
  if (error) logError("logEcomail_write_failed", { error: error.message });
}
