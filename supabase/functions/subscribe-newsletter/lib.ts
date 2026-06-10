// deno-lint-ignore-file no-explicit-any
import { TAGS } from "../_shared/ecomail/config.ts";
import { mergeTags } from "../_shared/ecomail/syncCustomer.ts";
import { logEcomail } from "../_shared/ecomail/log.ts";

interface NewsletterSignupParams {
  client: any; // EcomailClient
  supabase: any; // service-role klient
  listId: number;
  email: string;
  ip: string | null;
  userAgent: string | null;
  privacyPolicyVersion: string;
}

/** Zapíše GDPR consent log a přihlásí e-mail do Ecomailu s double opt-in. */
export async function processNewsletterSignup(p: NewsletterSignupParams): Promise<{ success: boolean }> {
  // 1) GDPR audit (uživatelova akce — logujeme i kdyby Ecomail selhal)
  await p.supabase.from("newsletter_consent_log").insert({
    email: p.email,
    consent_given: true,
    source: "footer",
    ip_address: p.ip,
    user_agent: p.userAgent,
    privacy_policy_version: p.privacyPolicyVersion,
  });

  // 2) read-merge-write tagů + subscribe (double opt-in)
  const existing = await p.client.getSubscriber(p.listId, p.email);
  const tags = mergeTags(existing?.tags ?? [], [TAGS.NEWSLETTER]);
  try {
    await p.client.subscribe(
      p.listId,
      { email: p.email, source: "footer", tags },
      { update_existing: true, skip_confirmation: false },
    );
    await logEcomail(p.supabase, "subscribe-newsletter", "success", { email: p.email });
    return { success: true };
  } catch (e) {
    await logEcomail(p.supabase, "subscribe-newsletter", "failed", { email: p.email }, String(e));
    throw e;
  }
}
