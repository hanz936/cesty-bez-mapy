import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import type { QuizProduct, QuizResultSet } from '../../lib/quizEngine';
import { makeProfile } from '../../lib/quizTestUtils';
import QuizResults from './QuizResults';

let seq = 0;
const product = (extras: Partial<QuizProduct> = {}): QuizProduct => {
  seq += 1;
  return {
    id: `p${seq}`, slug: `slug-${seq}`, title: `Cesta ${seq}`,
    description: 'Obecný popis produktu.', price: 699, duration: '7 dní',
    image_url: null, average_rating: null,
    spring_description: null, summer_description: null,
    autumn_description: null, winter_description: null,
    quizData: { version: 1, enabled: true, profile: makeProfile(2) },
    ...extras,
  };
};

const resultSet = (overrides: Partial<QuizResultSet> = {}): QuizResultSet => ({
  results: [
    { product: product({ summer_description: 'Léto u moře.' }), score: 87, tier: 'Skvělá shoda', fromBackfill: false },
    { product: product(), score: 74, tier: 'Dobrá shoda', fromBackfill: false },
    { product: product(), score: 66, tier: 'Dobrá shoda', fromBackfill: false },
  ],
  backfilled: false,
  ...overrides,
});

const renderResults = (rs: QuizResultSet, chosenSeason: string | null = null, handlers = {}) =>
  render(
    <MemoryRouter>
      <QuizResults
        resultSet={rs}
        chosenSeason={chosenSeason}
        onRestart={() => undefined}
        onResultClick={() => undefined}
        onCustomClick={() => undefined}
        {...handlers}
      />
    </MemoryRouter>,
  );

describe('QuizResults', () => {
  it('vykreslí vítěze + 2 alternativy, nadpis „Tvoje příští cesta" a fallback lísteček', () => {
    renderResults(resultSet());
    expect(screen.getByRole('heading', { name: 'Tvoje příští cesta' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Zobrazit itinerář' })).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Chci itinerář na míru' })).toBeInTheDocument();
  });

  it('sezónní popisek: zvolené léto → summer_description; bez sezónního → obecný popis', () => {
    renderResults(resultSet(), 'summer');
    expect(screen.getByText('Léto u moře.')).toBeInTheDocument();
    expect(screen.getAllByText('Obecný popis produktu.').length).toBeGreaterThan(0);
  });

  it('backfilled přepne nadpis na „Nejblíž tvým odpovědím"', () => {
    renderResults(resultSet({ backfilled: true }));
    expect(screen.getByRole('heading', { name: 'Nejblíž tvým odpovědím' })).toBeInTheDocument();
  });

  it('prázdné výsledky → zpráva + odkaz na katalog + lísteček na míru', () => {
    renderResults({ results: [], backfilled: false });
    expect(screen.getByText(/není žádný itinerář zařazený do kvízu/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /všechny průvodce/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chci itinerář na míru' })).toBeInTheDocument();
  });

  it('klik na výsledek hlásí slug a pozici 1–3; klik na míru hlásí custom', () => {
    const onResultClick = vi.fn();
    const onCustomClick = vi.fn();
    const rs = resultSet();
    renderResults(rs, null, { onResultClick, onCustomClick });
    const links = screen.getAllByRole('link', { name: 'Zobrazit itinerář' });
    fireEvent.click(links[0]);
    expect(onResultClick).toHaveBeenCalledWith(rs.results[0].product.slug, 1);
    fireEvent.click(links[2]);
    expect(onResultClick).toHaveBeenCalledWith(rs.results[2].product.slug, 3);
    fireEvent.click(screen.getByRole('link', { name: 'Chci itinerář na míru' }));
    expect(onCustomClick).toHaveBeenCalled();
  });
});
