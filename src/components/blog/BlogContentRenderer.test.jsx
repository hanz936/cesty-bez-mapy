import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BlogContentRenderer from './BlogContentRenderer';

const renderWith = (html, validProductSlugs) =>
  render(
    <MemoryRouter>
      <BlogContentRenderer html={html} validProductSlugs={validProductSlugs} />
    </MemoryRouter>,
  );

describe('BlogContentRenderer', () => {
  it('vykreslí běžné HTML (odstavec, callout)', () => {
    renderWith('<p>Ahoj světe</p><aside class="blog-callout"><p>tip</p></aside>');
    expect(screen.getByText('Ahoj světe')).toBeInTheDocument();
    expect(screen.getByText('tip')).toBeInTheDocument();
  });

  it('hydratuje YouTube blok na facade tlačítko', () => {
    renderWith('<div data-youtube-id="dQw4w9WgXcQ"></div>');
    expect(screen.getByRole('button', { name: 'Přehrát video' })).toBeInTheDocument();
  });

  it('CTA vykreslí jako odkaz, jen když produkt existuje', () => {
    const html = '<a data-product-slug="salzburg-vikend" class="blog-cta">Průvodce</a>';
    const { rerender } = renderWith(html, new Set()); // neexistuje
    expect(screen.queryByRole('link')).toBeNull();

    rerender(
      <MemoryRouter>
        <BlogContentRenderer html={html} validProductSlugs={new Set(['salzburg-vikend'])} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/cestovni-pruvodci/salzburg-vikend');
  });

  it('zahodí <script> (sanitizace)', () => {
    const { container } = renderWith('<p>ok</p><script>window.__x=1</script>');
    expect(container.querySelector('script')).toBeNull();
    expect(window.__x).toBeUndefined();
  });
});
