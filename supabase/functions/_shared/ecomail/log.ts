// deno-lint-ignore-file no-explicit-any
/** Zapíše řádek do integration_logs. POZOR: tabulka má sloupce status + error_message
 *  (NE success boolean). Píše se přes service-role klienta (bypass RLS).
 *  Logování je best-effort: chybu jen reportuje (nethrowuje), aby neshodilo hlavní flow. */
export async function logEcomail(
  supabase: any,
  action: string,
  status: "success" | "failed",
  metadata: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabase.from("integration_logs").insert({
    service: "ecomail",
    action,
    status,
    error_message: errorMessage ?? null,
    metadata,
  });
  if (error) console.error("[logEcomail] failed to write integration_log:", error.message);
}
