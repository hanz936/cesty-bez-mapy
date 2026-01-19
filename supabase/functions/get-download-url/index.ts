// ================================================
// Supabase Edge Function: Get Download URL
// ================================================
// Generuje signed URLs pro stažení PDF z objednávky
// - Ověří download token (není expirovaný)
// - Načte všechny produkty z objednávky přes order_items
// - Vygeneruje signed URLs pro každé PDF (1 hodina)
// ================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GetDownloadRequest {
  token: string;
}

interface DownloadItem {
  product_id: string;
  product_title: string;
  download_url: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: GetDownloadRequest = await req.json();
    const { token } = body;

    // Validace
    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Chybí download token",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Verifying download token: ${token.substring(0, 8)}...`);

    // Vytvoření Supabase klienta s service_role pro přístup ke storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Načtení download tokenu z databáze
    const { data: downloadToken, error: tokenError } = await supabase
      .from("download_tokens")
      .select(`
        id,
        token,
        expires_at,
        order_id
      `)
      .eq("token", token)
      .single();

    if (tokenError || !downloadToken) {
      console.error("Token not found:", tokenError);
      return new Response(
        JSON.stringify({
          error: "Neplatný download token",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Kontrola expirace
    const expiresAt = new Date(downloadToken.expires_at);
    if (expiresAt < new Date()) {
      console.log(`Token expired at ${downloadToken.expires_at}`);
      return new Response(
        JSON.stringify({
          error: "Download token vypršel. Kontaktujte nás pro nový odkaz.",
          expired: true,
        }),
        {
          status: 410, // Gone
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Načtení produktů z objednávky přes order_items
    const { data: orderItems, error: orderItemsError } = await supabase
      .from("order_items")
      .select(`
        product_id,
        products (
          id,
          title,
          pdf_url
        )
      `)
      .eq("order_id", downloadToken.order_id);

    if (orderItemsError || !orderItems || orderItems.length === 0) {
      console.error("Order items not found:", orderItemsError);
      return new Response(
        JSON.stringify({
          error: "Položky objednávky nebyly nalezeny",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${orderItems.length} items in order ${downloadToken.order_id}`);

    // Generování signed URLs pro každý produkt s PDF
    const downloads: DownloadItem[] = [];

    for (const item of orderItems) {
      // deno-lint-ignore no-explicit-any
      const product = item.products as any;

      if (!product || !product.pdf_url) {
        console.log(`Skipping product without PDF: ${product?.title || "unknown"}`);
        continue;
      }

      console.log(`Generating signed URL for: ${product.pdf_url}`);

      // Generování signed URL pro Storage (1 hodina = 3600 sekund)
      const { data: signedUrl, error: signedUrlError } = await supabase.storage
        .from("products-pdfs")
        .createSignedUrl(product.pdf_url, 3600);

      if (signedUrlError || !signedUrl) {
        console.error(`Failed to generate signed URL for ${product.title}:`, signedUrlError);
        continue;
      }

      downloads.push({
        product_id: product.id,
        product_title: product.title,
        download_url: signedUrl.signedUrl,
      });

      console.log(`Signed URL generated successfully for: ${product.title}`);
    }

    if (downloads.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Žádné PDF soubory nejsou dostupné ke stažení",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Vrácení všech signed URLs
    return new Response(
      JSON.stringify({
        success: true,
        downloads: downloads,
        expires_in: 3600, // sekundy
        order_id: downloadToken.order_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating download URLs:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Neznámá chyba",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
