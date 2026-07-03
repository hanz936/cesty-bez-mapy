// Kanonické CORS pro všechny edge funkce. CORS NENÍ bezpečnostní hranice
// (browser-enforced) — reálná brána je assertAdmin/verify_jwt (viz withSupabase).
// ALLOWED_ORIGINS je zdroj pravdy pro origin/method handling; čte ho withCors.ts.

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
