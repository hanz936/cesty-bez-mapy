import DOMPurify from 'dompurify';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const STORAGE_PREFIX = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/`
  : '';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'strong', 'em', 'u', 's', 'code', 'br',
  'a', 'ul', 'ol', 'li', 'blockquote', 'hr',
  'img', 'figure', 'figcaption', 'aside', 'div', 'span',
];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'];

// Hook je globální; prefix čteme z modulové proměnné nastavené při každém volání.
let _storagePrefix = STORAGE_PREFIX;
let _hooked = false;
function ensureHook() {
  if (_hooked) return;
  _hooked = true;
  // Odebrání <img> mimo úložiště řešíme v `uponSanitizeElement` — dokumentovaný
  // bod pro odstranění celého uzlu (NE v afterSanitizeAttributes).
  DOMPurify.addHook('uponSanitizeElement', (node) => {
    if (node.nodeName && node.nodeName.toLowerCase() === 'img') {
      const src = (node.getAttribute && node.getAttribute('src')) || '';
      if (!_storagePrefix || !src.startsWith(_storagePrefix)) {
        node.parentNode?.removeChild(node);
      }
    }
  });
  // Atributové úpravy (povolené <img> z úložiště + externí odkazy).
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      node.setAttribute('decoding', 'async');
    }
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      const href = node.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }
  });
}

/** Sanitizuje HTML těla článku se striktním allowlistem; <img> jen z úložiště. */
export function sanitizeBlogHtml(html, storagePrefix = STORAGE_PREFIX) {
  ensureHook();
  _storagePrefix = storagePrefix;
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  });
}

/** Vytáhne 11znakové YouTube ID z URL nebo vrátí vstup, je-li už ID; jinak null. */
export function extractYoutubeId(input) {
  const direct = String(input || '').trim();
  if (/^[\w-]{11}$/.test(direct)) return direct;
  const m = direct.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

/** Odhad doby čtení v minutách (~200 slov/min), minimum 1. */
export function readingTimeMinutes(html) {
  const text = String(html || '').replace(/<[^>]*>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Unikátní seznam slugů produktů z atributů data-product-slug. */
export function extractProductSlugs(html) {
  const slugs = new Set();
  const re = /data-product-slug="([^"]+)"/g;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) slugs.add(m[1]);
  return [...slugs];
}
