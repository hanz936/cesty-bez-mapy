import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ProductCtaLinkProps {
  slug: string;
  label?: ReactNode;
  exists: boolean;
}

/** CTA na produkt: interní navigace; vykreslí se jen pokud produkt existuje (spec §11.2). */
export default function ProductCtaLink({ slug, label, exists }: ProductCtaLinkProps) {
  if (!exists) return null;
  return (
    <Link to={`/cestovni-pruvodci/${slug}`} className="blog-cta">
      {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: falsy ReactNode (''/0/false) must fall through to the fallback label */}
      🛒 {label || 'Zobrazit průvodce'}
    </Link>
  );
}
