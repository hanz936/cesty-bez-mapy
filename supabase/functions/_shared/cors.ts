// Kanonické CORS pro všechny edge funkce. CORS NENÍ bezpečnostní hranice
// (browser-enforced) — reálná brána je requireAdmin/verify_jwt. Tento modul jen
// sjednocuje hlavičky, aby origin/method handling zůstal konzistentní.

export const ALLOWED_ORIGINS = [
  "https://cestybezmapy.cz",
  "https://www.cestybezmapy.cz",
  "https://admin.cestybezmapy.cz",
  "https://cesty-bez-mapy-admin.vercel.app",
  "https://cesty-bez-mapy-git-development-jana-novakovas-projects.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:4173", // Vite preview (dnes jen submit-contact-form) — sjednocení musí být nadmnožina
];

const DEFAULT_HEADERS = "authorization, x-client-info, apikey, content-type";

export interface CorsOptions {
  methods?: string;
  publicAccess?: boolean;
}

export function getCorsHeaders(req: Request, opts: CorsOptions = {}): Record<string, string> {
  const methods = opts.methods ?? "POST, OPTIONS";
  if (opts.publicAccess) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": DEFAULT_HEADERS,
    };
  }
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": DEFAULT_HEADERS,
    "Access-Control-Allow-Methods": methods,
    "Vary": "Origin",
  };
}
