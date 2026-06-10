import { EcomailClient } from "./client.ts";

export const ECOMAIL_BASE_URL = "https://api2.ecomailapp.cz";

export const TAGS = {
  CUSTOMER: "zakaznik",
  NEWSLETTER: "newsletter",
} as const;

/** Čte ECOMAIL_LIST_ID ze secrets; vyhodí, pokud chybí nebo není číslo. */
export function getEcomailListId(): number {
  const raw = Deno.env.get("ECOMAIL_LIST_ID");
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id <= 0) {
    throw new Error("ECOMAIL_LIST_ID env var is missing or not a positive integer");
  }
  return id;
}

/** Vytvoří klienta z ECOMAIL_API_KEY. */
export function makeEcomailClient(): EcomailClient {
  const apiKey = Deno.env.get("ECOMAIL_API_KEY");
  if (!apiKey) throw new Error("ECOMAIL_API_KEY env var is not configured");
  return new EcomailClient({ apiKey, baseUrl: ECOMAIL_BASE_URL });
}
