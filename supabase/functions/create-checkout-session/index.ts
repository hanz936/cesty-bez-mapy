// ================================================
// Supabase Edge Function: Create Stripe Checkout Session
// ================================================
// Vytvoří Stripe Checkout Session pro platbu
// - Přijme pole produktů (product IDs)
// - Načte stripe_price_id z databáze
// - Vytvoří Stripe Checkout Session
// - Podporuje anonymous users
// ================================================

import Stripe from "https://esm.sh/stripe@20?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2025-12-15.clover",
});

const allowedOrigins = [
  "https://cestybezmapy.cz",
  "https://www.cestybezmapy.cz",
  "https://cesty-bez-mapy-admin.vercel.app",
  "https://admin.cestybezmapy.cz",
  "https://cesty-bez-mapy-git-development-jana-novakovas-projects.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const allowedUrlPrefixes = [
  "https://cestybezmapy.cz",
  "https://www.cestybezmapy.cz",
  "https://cesty-bez-mapy-git-development-jana-novakovas-projects.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function isAllowedUrl(url: string): boolean {
  return allowedUrlPrefixes.some(
    (prefix) => url.startsWith(prefix + "/") || url === prefix
  );
}

interface LineItem {
  product_id: string;
  quantity?: number;
  custom_itinerary_request_id?: string | null;
}

interface BillingFields {
  is_company?: boolean;
  company_ico?: string;
  company_dic?: string;
  company_name?: string;
  billing_street?: string;
  billing_city?: string;
  billing_zip?: string;
}

interface CreateCheckoutRequest {
  line_items: LineItem[];
  customer_email?: string;
  customer_name?: string;
  success_url: string;
  cancel_url: string;
  billing?: BillingFields;
  marketing_consent?: boolean;
  privacy_policy_version?: string;
}

Deno.serve(withSentry(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    // Parse request body
    const body: CreateCheckoutRequest = await req.json();
    const {
      line_items,
      customer_email,
      customer_name,
      success_url,
      cancel_url,
      billing,
      marketing_consent,
      privacy_policy_version,
    } = body;

    // Extract user_id from JWT (not from body - prevents spoofing)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      userId = user?.id ?? null;
    }

    // Validace
    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Chybí položky k objednání (line_items)",
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (!success_url || !cancel_url) {
      return new Response(
        JSON.stringify({
          error: "Chybí success_url nebo cancel_url",
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (!isAllowedUrl(success_url) || !isAllowedUrl(cancel_url)) {
      return new Response(
        JSON.stringify({
          error: "Nepovolená URL adresa",
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Validace fakturačních údajů pro B2B (firma = chce fakturu)
    const b: BillingFields = billing ?? {};
    if (b.is_company) {
      if (
        !b.company_ico ||
        !b.company_name ||
        !b.billing_street ||
        !b.billing_city ||
        !b.billing_zip
      ) {
        return new Response(
          JSON.stringify({
            error: "Incomplete billing fields",
          }),
          {
            status: 400,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }
    }

    console.log(
      `Vytvářím Checkout Session pro ${line_items.length} položek, user: ${userId || "anonymous"}`
    );

    // Vytvoření Supabase klienta pro načtení produktů
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Načtení stripe_price_id pro všechny produkty z databáze
    const productIds = line_items.map((item) => item.product_id);

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, title, stripe_price_id, price")
      .in("id", productIds)
      .eq("is_active", true)
      .eq("is_deleted", false);

    if (productsError) {
      console.error("Chyba při načítání produktů:", productsError);
      return new Response(
        JSON.stringify({
          error: "Nepodařilo se načíst produkty z databáze",
        }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Žádné platné produkty nebyly nalezeny",
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Kontrola, že všechny produkty mají stripe_price_id
    const missingStripeProducts = products.filter((p) => !p.stripe_price_id);
    if (missingStripeProducts.length > 0) {
      console.error(
        "Produkty bez stripe_price_id:",
        missingStripeProducts.map((p) => p.title)
      );
      return new Response(
        JSON.stringify({
          error: `Některé produkty nemají nastavenou cenu ve Stripe: ${missingStripeProducts.map((p) => p.title).join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Validace množství položek - musí být celé číslo 1-10 (pokud je zadáno)
    for (const item of line_items) {
      const q = item.quantity;
      if (q !== undefined && !(Number.isInteger(q) && q >= 1 && q <= 10)) {
        return new Response(
          JSON.stringify({
            error: "Neplatné množství položky (povoleno 1–10)",
          }),
          {
            status: 400,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }
    }

    // Mapování line_items na Stripe formát
    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      products.map((product) => {
        const requestItem = line_items.find(
          (item) => item.product_id === product.id
        );
        return {
          price: product.stripe_price_id,
          quantity: requestItem?.quantity || 1,
        };
      });

    console.log(
      "Stripe line items:",
      stripeLineItems.map((item) => `${item.price} x${item.quantity}`)
    );

    // Příprava metadata pro session
    const metadata: Record<string, string> = {
      product_ids: productIds.join(","),
    };

    // Přidání user_id pokud existuje (anonymous nebo registered)
    if (userId) {
      metadata.supabase_user_id = userId;
    }

    // Přidání customer info pokud existuje
    if (customer_name) {
      metadata.customer_name = customer_name;
    }

    // Fakturační údaje (B2B / Fakturoid)
    metadata.is_company = String(!!b.is_company);
    if (b.is_company) {
      metadata.company_ico = b.company_ico!;
      metadata.company_dic = b.company_dic ?? "";
      metadata.company_name = b.company_name!;
      metadata.billing_street = b.billing_street!;
      metadata.billing_city = b.billing_city!;
      metadata.billing_zip = b.billing_zip!;
    }

    // Mapování product_id -> custom_itinerary_request_id pro položky košíku,
    // které vznikly z formuláře "itinerář na míru". Webhook podle toho propojí
    // order_items s původním záznamem v custom_itinerary_requests.
    const customRequestsMapping: Record<string, string> = {};
    for (const item of line_items) {
      if (item.custom_itinerary_request_id) {
        customRequestsMapping[item.product_id] = item.custom_itinerary_request_id;
      }
    }

    if (Object.keys(customRequestsMapping).length > 0) {
      metadata.custom_requests = JSON.stringify(customRequestsMapping);
    }

    // Marketingový souhlas (Ecomail). IP/UA zachytáváme TADY (okamžik souhlasu),
    // webhook je z metadat zapíše do newsletter_consent_log.
    if (marketing_consent) {
      const consentIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
      const consentUa = (req.headers.get("user-agent") ?? "").slice(0, 500);
      metadata.marketing_consent = "true";
      metadata.consent_ip = consentIp;
      metadata.consent_ua = consentUa;
      metadata.privacy_policy_version = privacy_policy_version ?? "unknown";
    }

    // Vytvoření Stripe Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: stripeLineItems,
      success_url: success_url,
      cancel_url: cancel_url,
      metadata: metadata,
      locale: "cs", // Čeština
      // Sbírat email pokud není předvyplněn
      customer_email: customer_email || undefined,
      // Pokud nemáme email, necháme Stripe sbírat billing details
      billing_address_collection: customer_email ? "auto" : "required",
      // Umožnit úpravu množství
      // Poznámka: Pro digitální produkty většinou nechceme měnit množství
    };

    // Pokud nemáme email, sbíráme ho v Stripe formuláři
    if (!customer_email) {
      sessionParams.customer_creation = "always";
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Stripe Checkout Session vytvořena: ${session.id}`);

    // Vrácení URL pro redirect
    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        url: session.url,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Chyba při vytváření Checkout Session:", error);

    return new Response(
      JSON.stringify({
        error: "Nepodařilo se vytvořit platební session",
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
}, "create-checkout-session"));
