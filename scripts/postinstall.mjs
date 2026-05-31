import { execFileSync } from 'node:child_process';

// Lokálně / CI: nainstaluj Playwrightem řízený Chromium pro prerender + E2E.
// Na Vercelu NE — build tam používá @sparticuz/chromium (Playwrightův Chromium
// by se v build containeru stejně nespustil kvůli chybějícím systémovým knihovnám).
if (process.env.VERCEL) {
  console.log('[postinstall] Vercel detekován → přeskakuji "playwright install" (build použije @sparticuz/chromium).');
} else {
  // Statické argumenty, žádný shell (execFile místo exec) — viz security guideline.
  execFileSync('npx', ['playwright', 'install', 'chromium'], { stdio: 'inherit' });
}
