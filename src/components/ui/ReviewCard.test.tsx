import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewCard from './ReviewCard';

const base = {
  name: 'Jana N.',
  rating: 5,
  text: 'Skvělý průvodce.',
  productTitle: null,
  date: 'červenec 2026',
  verified: true,
};

describe('ReviewCard', () => {
  it('teaser ořezává přes line-clamp, ale bez pevné výšky boxu', () => {
    const { container } = render(<ReviewCard {...base} variant="teaser" />);
    const paragraph = screen.getByText(/Skvělý průvodce/);
    expect(paragraph.className).toContain('line-clamp-6');
    // Pevná výška by výpustku znemožnila (128 px = 4,92 řádku při line-height 26 px).
    expect(container.innerHTML).not.toContain('h-32');
  });

  it('full vykreslí celý text bez ořezu', () => {
    const long = 'A'.repeat(2000);
    const { container } = render(<ReviewCard {...base} text={long} variant="full" />);
    expect(screen.getByText(new RegExp(`^"?${'A'.repeat(50)}`))).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('line-clamp');
    expect(container.innerHTML).not.toContain('h-32');
  });

  it('full zalamuje nezalomitelný text, aby ho overflow-hidden neustřihl', () => {
    // Recenze běžně obsahují URL; bez zalomení by dlouhý token přetekl kartu.
    const url = `https://example.com/${'a'.repeat(300)}`;
    render(<ReviewCard {...base} text={url} variant="full" />);
    expect(screen.getByText(new RegExp('^"?https://example')).className).toContain('wrap-break-word');
  });

  it('teaser je výchozí režim', () => {
    render(<ReviewCard {...base} />);
    expect(screen.getByText(/Skvělý průvodce/).className).toContain('line-clamp-6');
  });

  it('karta nevnucuje pevnou výšku 400 px', () => {
    const { container } = render(<ReviewCard {...base} variant="full" />);
    expect(container.innerHTML).not.toContain('h-[400px]');
  });

  it('odznak ověření se vykreslí jen když verified', () => {
    const { rerender } = render(<ReviewCard {...base} verified />);
    expect(screen.getByText('Ověřeno nákupem')).toBeInTheDocument();
    rerender(<ReviewCard {...base} verified={false} />);
    expect(screen.queryByText('Ověřeno nákupem')).not.toBeInTheDocument();
  });

  it('rating se vykreslí s českou desetinnou čárkou', () => {
    render(<ReviewCard {...base} />);
    expect(screen.getByText('5,0')).toBeInTheDocument();
  });

  it('hodnocení má vedle hvězd i větu pro odečítač, ale vizuálně zůstává holé číslo', () => {
    // Bez tohohle přečte odečítač v seznamu recenzí jen „5,0“ a číslo splyne
    // s datem i cenou — měřítko („z 5“) nese pouze obrázek hvězd.
    const { container } = render(<ReviewCard {...base} />);

    // Přes skrytý úvod, ne přes „5,0“: `getByText` porovnává jen PŘÍMÉ textové
    // potomky, takže by na „5,0“ sedl rovnou obalový span a test by se díval
    // o patro výš, než si myslí.
    const label = screen.getByText('Hodnocení', { selector: '.sr-only' }).parentElement;
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe('Hodnocení 5,0 z 5');

    // Oko vidí pořád jen „5,0“ — oprava nesmí nic přikreslit.
    const visible = Array.from(label!.childNodes)
      .filter((node) => !(node instanceof HTMLElement && node.className.includes('sr-only')))
      .map((node) => node.textContent)
      .join('');
    expect(visible).toBe('5,0');

    // Deset hvězd bez názvu by se za tou větou přečetlo jako deset prázdných obrázků.
    expect(label!.previousElementSibling?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('[aria-hidden="true"] svg')).toHaveLength(10);
  });
});
