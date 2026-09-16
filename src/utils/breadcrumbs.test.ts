import { describe, it, expect } from 'vitest';
import { buildBreadcrumbJsonLd, MIN_BREADCRUMB_ITEMS } from './breadcrumbs';
import type { Crumb } from './breadcrumbs';

const crumbs: Crumb[] = [
  { name: 'Cestovní průvodci', path: '/cestovni-pruvodci' },
  { name: 'Toskánsko', path: '/cestovni-pruvodci/toskansko' },
  { name: 'Recenze' },
];

describe('buildBreadcrumbJsonLd', () => {
  it('je validní BreadcrumbList s 1-based pozicemi v pořadí cesty', () => {
    const json = buildBreadcrumbJsonLd(crumbs, 'https://x.cz');
    expect(json['@type']).toBe('BreadcrumbList');
    expect(json['@context']).toBe('https://schema.org');
    expect(json.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(json.itemListElement.map((i) => i.name)).toEqual([
      'Cestovní průvodci',
      'Toskánsko',
      'Recenze',
    ]);
  });

  it('cesty skládá na absolutní adresy', () => {
    const json = buildBreadcrumbJsonLd(crumbs, 'https://x.cz');
    expect(json.itemListElement[0].item).toBe('https://x.cz/cestovni-pruvodci');
    expect(json.itemListElement[1].item).toBe('https://x.cz/cestovni-pruvodci/toskansko');
  });

  it('poslední položka `item` NEMÁ — Google tam dosadí adresu stránky', () => {
    // Tohle je celá podstata toho, proč tentýž seznam sedí i na /recenze/strana/2:
    // kdyby tu `item` byl, ukazoval by na stranu 1 a odporoval by canonicalu.
    const json = buildBreadcrumbJsonLd(crumbs, 'https://x.cz');
    expect(json.itemListElement[2]).not.toHaveProperty('item');
  });

  it('nevyrábí `item` s holým originem, když položka cestu nemá', () => {
    // Regrese: `${siteUrl}${undefined}` by dalo 'https://x.cz/undefined'.
    const json = buildBreadcrumbJsonLd([{ name: 'Sama' }], 'https://x.cz');
    expect(JSON.stringify(json)).not.toContain('undefined');
  });

  it('naše cesty splňují Googlem požadované minimum položek', () => {
    expect(MIN_BREADCRUMB_ITEMS).toBe(2);
    expect(crumbs.length).toBeGreaterThanOrEqual(MIN_BREADCRUMB_ITEMS);
  });
});
