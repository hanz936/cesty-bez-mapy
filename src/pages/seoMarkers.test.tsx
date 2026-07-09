import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../contexts';
import Privacy from './Privacy';
import FAQ from './FAQ';
import TravelInspiration from './TravelInspiration';

// vi.mock je hoistovaný Vitestem nad importy, takže pořadí zápisu v souboru nevadí.
vi.mock('../lib/blog', () => ({
  fetchPublishedPosts: vi.fn().mockResolvedValue([]),
  fetchTags: vi.fn().mockResolvedValue([]),
  tagNameMap: vi.fn().mockReturnValue(new Map()),
}));

const renderWithProviders = (children: ReactNode) =>
  render(
    <CartProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </CartProvider>,
  );

describe('static page prerender marker + SEO (SEO-02/05/06)', () => {
  it('Privacy vykreslí marker připravenosti a titulek', () => {
    const { container } = renderWithProviders(<Privacy />);
    expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    expect(document.head.querySelector('title')).toHaveTextContent(/ochrana osobních údajů/i);
  });

  it('FAQ vykreslí marker připravenosti a titulek', () => {
    const { container } = renderWithProviders(<FAQ />);
    expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    expect(document.head.querySelector('title')).toHaveTextContent(/časté dotazy/i);
  });

  it('TravelInspiration (async) vykreslí marker připravenosti až po doběhnutí loadingu', async () => {
    const { container } = renderWithProviders(<TravelInspiration />);

    // Během loadingu marker není přítomný (Layout ready={false}).
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();

    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });
    expect(document.head.querySelector('title')).toHaveTextContent(/inspirace na cesty/i);
  });
});
