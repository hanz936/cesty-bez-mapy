// deno-lint-ignore-file no-explicit-any
/** Zapíše řádek do integration_logs. POZOR: tabulka má sloupce status + error_message
 *  (NE success boolean). Píše se přes service-role klienta (bypass RLS). */
export async function logEcomail(
  supabase: any,
  action: string,
  status: "success" | "failed",
  metadata: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  await supabase.from("integration_logs").insert({
    service: "ecomail",
    action,
    status,
    error_message: errorMessage ?? null,
    metadata,
  });
}
