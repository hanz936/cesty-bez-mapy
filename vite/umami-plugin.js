import { loadEnv } from 'vite';
import { sanitizeUmamiPayload } from '../src/lib/umamiBeforeSend.js';

const DOMAINS = 'cestybezmapy.cz,www.cestybezmapy.cz';
const DEFAULT_SRC = 'https://cloud.umami.is/script.js';

// Production-only injection of the Umami tracker into index.html <head>.
// Reads env from process.env (Vercel) with a .env fallback (local builds).
export function umamiPlugin() {
  let enabled = false;
  let websiteId = '';
  let src = DEFAULT_SRC;

  return {
    name: 'umami-analytics',
    apply: 'build',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root || process.cwd(), 'VITE_');
      websiteId = process.env.VITE_UMAMI_WEBSITE_ID || env.VITE_UMAMI_WEBSITE_ID || '';
      src = process.env.VITE_UMAMI_SRC || env.VITE_UMAMI_SRC || DEFAULT_SRC;
      enabled = Boolean(config.isProduction && websiteId);
    },
    transformIndexHtml(html) {
      if (!enabled) return html;
      const bootstrap = `<script>window.umamiBeforeSend=${sanitizeUmamiPayload.toString()}</script>`;
      const tracker =
        `<script defer src="${src}" data-website-id="${websiteId}" ` +
        `data-domains="${DOMAINS}" data-do-not-track="true" data-before-send="umamiBeforeSend"></script>`;
      return html.replace('</head>', `    ${bootstrap}\n    ${tracker}\n  </head>`);
    },
  };
}
