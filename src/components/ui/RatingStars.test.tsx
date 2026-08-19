import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RatingStars from './RatingStars';

describe('RatingStars', () => {
  it('výchozí vykreslení: 5 hvězd, výchozí velikost a barvy, správný počet vyplněných', () => {
    const { container } = render(<RatingStars rating={3} />);
    // 5 pozic × (1 prázdná svg vždy + 1 vyplněná svg jen u plných/půl) = 5 + 3 pro rating=3
    expect(container.querySelectorAll('svg')).toHaveLength(8);
    expect(container.querySelectorAll('svg.text-gray-300')).toHaveLength(5);
    expect(container.querySelectorAll('svg.text-green-800')).toHaveLength(3);
    container.querySelectorAll('svg').forEach((svg) => {
      expect(svg.getAttribute('class')).toContain('w-4');
      expect(svg.getAttribute('class')).toContain('h-4');
    });
  });

  it('půl hvězda u desetinného hodnocení má ořez na 50 % a testid', () => {
    const { container } = render(<RatingStars rating={4.5} />);
    const halfStar = container.querySelector('[data-testid="half-star"]');
    expect(halfStar).not.toBeNull();
    expect(halfStar).toHaveAttribute('style', 'clip-path: inset(0 50% 0 0);');
    // 4 plné + 1 půl = 5 vyplněných překryvů
    expect(container.querySelectorAll('svg.text-green-800')).toHaveLength(5);
  });

  it('celé hodnocení bez zbytku nevykreslí žádnou půl hvězdu', () => {
    const { container } = render(<RatingStars rating={5} />);
    expect(container.querySelector('[data-testid="half-star"]')).toBeNull();
  });

  it('vlastní barvy a velikost se aplikují na obě vrstvy hvězd', () => {
    const { container } = render(
      <RatingStars rating={2} size="w-6 h-6" filledClassName="text-yellow-400" emptyClassName="text-gray-200" />
    );
    expect(container.querySelectorAll('svg.w-6.h-6')).toHaveLength(7); // 5 prázdné + 2 vyplněné
    expect(container.querySelectorAll('svg.text-yellow-400')).toHaveLength(2);
    expect(container.querySelectorAll('svg.text-gray-200')).toHaveLength(5);
    expect(container.querySelectorAll('svg.text-green-800')).toHaveLength(0);
    expect(container.querySelectorAll('svg.text-gray-300')).toHaveLength(0);
  });
});
