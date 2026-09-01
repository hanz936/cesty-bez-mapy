import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound';

/**
 * Server na neplatnou adresu odpovídá 200 (SPA rewrite), takže stavový kód
 * Googlu nic neřekne. Jediné, co tuhle stránku odliší od obsahu, je `noindex` —
 * a ten nikde jinde než tady vzniknout nesmí (skořápka by jím umlčela i platné,
 * jen nepředgenerované adresy). Bez těchhle asercí by se dal beze stopy smazat.
 */
describe('NotFound a indexování', () => {
  function renderNotFound() {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
  }

  it('vydává noindex', () => {
    renderNotFound();

    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });

  it('nevydává canonical — na neexistující adrese nemá co označovat', () => {
    renderNotFound();

    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('má vlastní titulek, ne titulek skořápky', () => {
    renderNotFound();

    expect(document.title).toBe('Stránka nenalezena | Cesty bez mapy');
  });

  it('pořád nese marker, podle kterého prerender pozná, proč se zasekl', () => {
    renderNotFound();

    expect(document.querySelector('[data-page="not-found"]')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Stránka nenalezena' })).toBeInTheDocument();
  });
});
