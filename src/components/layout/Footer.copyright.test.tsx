import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';
import { FIRST_PUBLICATION_YEAR } from '../../utils/copyright';

/**
 * Hodiny se posouvají schválně. V roce vydání je „© 2026" k nerozeznání od roku
 * napsaného natvrdo, takže návrat k natvrdo zapsanému roku by prošel zeleně —
 * teprve posun do budoucna ukáže, jestli patička rok opravdu počítá.
 *
 * `setSystemTime` bez `useFakeTimers`: potřebujeme podvrhnout jen `Date`, ne
 * časovače. Falešné časovače by zbytečně sáhly Reactu pod ruku a docs uvádějí
 * tuhle variantu výslovně („mocks Date/Temporal calls when disabled").
 * Reset patří do `useRealTimers` — podvržený čas se sám mezi testy nevrací.
 */
describe('rok v copyrightové poznámce patičky', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderFooter() {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
  }

  it('v roce vydání nese jediný rok', () => {
    vi.setSystemTime(new Date(FIRST_PUBLICATION_YEAR, 5, 15));
    renderFooter();

    expect(screen.getByText(`© ${FIRST_PUBLICATION_YEAR} Cesty (bez) mapy`)).toBeInTheDocument();
  });

  it('o pět let později nese rozsah od vydání po dnešek', () => {
    vi.setSystemTime(new Date(FIRST_PUBLICATION_YEAR + 5, 0, 2));
    renderFooter();

    expect(
      screen.getByText(`© ${FIRST_PUBLICATION_YEAR}–${FIRST_PUBLICATION_YEAR + 5} Cesty (bez) mapy`),
    ).toBeInTheDocument();
  });
});
