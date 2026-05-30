import { Link } from 'react-router-dom';

/** CTA na produkt: interní navigace; vykreslí se jen pokud produkt existuje (spec §11.2). */
export default function ProductCtaLink({ slug, label, exists }) {
  if (!exists) return null;
  return (
    <Link to={`/cestovni-pruvodci/${slug}`} className="blog-cta">
      🛒 {label || 'Zobrazit průvodce'}
    </Link>
  );
}
