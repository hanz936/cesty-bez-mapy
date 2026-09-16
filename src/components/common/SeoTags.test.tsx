import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SeoTags from './SeoTags';
import { buildBreadcrumbJsonLd } from '../../utils/breadcrumbs';

const base = {
  title: 'Recenze',
  description: 'Popis',
  canonical: 'https://x.cz/a',
  ogImage: 'https://x.cz/i.png',
};

describe('SeoTags', () => {
  it('bez robots značku nevykreslí', () => {
    render(<SeoTags meta={base} />);
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('s robots značku vykreslí', () => {
    render(<SeoTags meta={{ ...base, robots: 'noindex' }} />);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });

  it('breadcrumb vydá jako SAMOSTATNÝ blok, aby Product uzel zůstal nedotčený', () => {
    // Google čte víc bloků `ld+json` na stránce; `BreadcrumbList` je vlastní položka
    // stránky, ne vlastnost produktu, takže do `Product` nepatří.
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
      [{ name: 'Cestovní průvodci', path: '/cestovni-pruvodci' }, { name: 'Recenze' }],
      'https://x.cz',
    );
    const { container } = render(
      <SeoTags meta={{ ...base, jsonLd: { '@type': 'Product' } as never, breadcrumbJsonLd }} />,
    );
    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(2);
    expect(JSON.parse(scripts[0].textContent)).toHaveProperty('@type', 'Product');
    expect(JSON.parse(scripts[1].textContent)).toHaveProperty('@type', 'BreadcrumbList');
  });

  it('bez breadcrumbu druhý blok nevykreslí', () => {
    const { container } = render(<SeoTags meta={base} />);
    expect(container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  });
});
