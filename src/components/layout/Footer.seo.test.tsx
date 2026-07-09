import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';

describe('Footer Organization JSON-LD (SEO-08)', () => {
  it('renderuje Organization JSON-LD s absolutní SITE_URL (ne localhost)', () => {
    const { container } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent) as { '@type': string; url: string; logo: string };
    expect(data['@type']).toBe('Organization');
    expect(data.url).toMatch(/^https:\/\//);
    expect(data.url).not.toContain('localhost');
    expect(data.logo).toContain(data.url);
  });
});
