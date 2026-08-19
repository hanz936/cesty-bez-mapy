import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SeoTags from './SeoTags';

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
});
