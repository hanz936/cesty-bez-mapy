import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fetchApprovedReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
const fetchReviewStatsMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../../lib/reviews', () => ({
  fetchApprovedReviews: (...args: unknown[]) => fetchApprovedReviewsMock(...args),
  fetchReviewStats: (...args: unknown[]) => fetchReviewStatsMock(...args),
}));
const captureExceptionMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('@sentry/react', () => ({ captureException: (...args: unknown[]) => captureExceptionMock(...args) }));

import ReviewsSection from './ReviewsSection';
import { formatReviewDate, reviewDateIso } from './formatReviewDate';

const REVIEW = {
  id: 'r1',
  product_id: 'p1',
  reviewer_name: 'Jana N.',
  rating: 5,
  review_text: 'Skvělý průvodce, doporučuji.',
  created_at: '2026-07-01T10:00:00.000Z',
  products: { title: 'Salzburg na víkend', slug: 'salzburg' },
};

describe('ReviewsSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('formatReviewDate renders a full Czech date', () => {
    // Datum musí odpovídat `datePublished` v JSON-LD (2026-07-01), jinak markujeme
    // přesnější údaj, než jaký je na stránce vidět.
    expect(formatReviewDate('2026-07-01T10:00:00.000Z')).toBe('1. července 2026');
  });

  it('formatReviewDate i reviewDateIso jsou ukotvené na pražskou zónu, ne na runtime zónu', () => {
    // 22:30 UTC = 0:30 SELČ (UTC+2 v létě) následujícího dne — bez timeZone by karta
    // a JSON-LD mohly ukázat různý den podle toho, v jaké zóně běží runtime.
    expect(formatReviewDate('2026-06-30T22:30:00.000Z')).toBe('1. července 2026');
    // Tohle je test, co by na starém `iso.slice(0, 10)` spadl: UTC dá '2026-06-30',
    // zatímco pražská půlnoc už je '2026-07-01' — přesně ten posun, co karta vedle neměla.
    expect(reviewDateIso('2026-06-30T22:30:00.000Z')).toBe('2026-07-01');
  });

  it('reviewDateIso respektuje zimní čas (UTC+1), není nahardkódovaný posun +2', () => {
    // 23:30 UTC v lednu = 0:30 SEČ (UTC+1 v zimě) následujícího dne.
    expect(reviewDateIso('2026-01-15T23:30:00.000Z')).toBe('2026-01-16');
  });

  it('formatReviewDate a reviewDateIso popisují pro pozdně-večerní UTC čas stejný kalendářní den', () => {
    const lateEveningUtc = '2026-06-30T22:30:00.000Z';
    const cardDay = formatReviewDate(lateEveningUtc); // '1. července 2026'
    const jsonLdDate = reviewDateIso(lateEveningUtc); // '2026-07-01'
    expect(jsonLdDate).toBe('2026-07-01');
    expect(cardDay).toBe('1. července 2026');
    // Obě hodnoty musí popisovat stejný den (1. července), jinak markup a viditelný text nesouhlasí.
    expect(jsonLdDate.endsWith('-07-01')).toBe(true);
    expect(cardDay.startsWith('1. ')).toBe(true);
  });

  it('shows honest empty state with zero reviews', async () => {
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [], total: 0 });
    fetchReviewStatsMock.mockResolvedValue({ count: 0, average: 0 });
    render(<MemoryRouter><ReviewsSection /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Zatím tu žádné recenze nejsou/)).toBeInTheDocument());
  });

  it('shows error message (not empty state) and reports to Sentry when the fetch fails', async () => {
    fetchApprovedReviewsMock.mockRejectedValue(new Error('network down'));
    fetchReviewStatsMock.mockResolvedValue({ count: 0, average: 0 });
    render(<MemoryRouter><ReviewsSection /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(screen.queryByText(/Zatím tu žádné recenze nejsou/)).not.toBeInTheDocument();
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { area: 'reviews', component: 'ReviewsSection' } }),
    );
  });

  it('renders reviews with verified badge, stats hidden under threshold', async () => {
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [REVIEW], total: 1 });
    fetchReviewStatsMock.mockResolvedValue({ count: 1, average: 5 });
    render(<MemoryRouter><ReviewsSection /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Jana N.')).toBeInTheDocument());
    expect(screen.getByText('Ověřeno nákupem')).toBeInTheDocument();
    // Disclosure se od 2026-08-29 u recenzí nezobrazuje — má vlastní stránku
    // `/overovani-recenzi`, na kterou vede odkaz z patičky (rozhodnutí usera).
    expect(screen.queryByText(/ověření zákazníci/)).not.toBeInTheDocument();
    expect(screen.queryByText('Průměrné hodnocení')).not.toBeInTheDocument();
  });

  it('shows stats from 3 reviews up', async () => {
    fetchApprovedReviewsMock.mockResolvedValue({
      reviews: [REVIEW, { ...REVIEW, id: 'r2' }, { ...REVIEW, id: 'r3' }],
      total: 3,
    });
    fetchReviewStatsMock.mockResolvedValue({ count: 3, average: 4.7 });
    render(<MemoryRouter><ReviewsSection /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Průměrné hodnocení')).toBeInTheDocument());
    expect(screen.getByText('4,7')).toBeInTheDocument();
  });

  it.each([
    [3, 'recenze'],
    [5, 'recenzí'],
  ])('počet %i v souhrnu skloňuje sdílený reviewCountLabel („%s")', async (count, label) => {
    // Dřív tu stál vlastní ternár vedle helperu — oprava pravidla v `reviewCountLabel`
    // by detail i stránku recenzí opravila, `/recenze` ne (audit T-3, ověřeno mutací).
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [REVIEW], total: count });
    fetchReviewStatsMock.mockResolvedValue({ count, average: 4.7 });
    render(<MemoryRouter><ReviewsSection /></MemoryRouter>);
    const countBox = (await screen.findByText(String(count))).parentElement;
    expect(countBox).toHaveTextContent(new RegExp(`^${count}${label}$`));
  });

  describe('prerender gating (P3-A)', () => {
    it('připravenost ohlásí až po doběhnutí načítání, ne hned', async () => {
      fetchApprovedReviewsMock.mockResolvedValue({ reviews: [REVIEW], total: 1 });
      fetchReviewStatsMock.mockResolvedValue({ count: 1, average: 5 });
      const onReadyChange = vi.fn();
      render(<MemoryRouter><ReviewsSection onReadyChange={onReadyChange} /></MemoryRouter>);
      // První render je loading — kdyby se `true` ohlásilo tady, prerender zachytí skeleton.
      expect(onReadyChange).toHaveBeenCalledWith(false);
      expect(onReadyChange).not.toHaveBeenCalledWith(true);
      await waitFor(() => expect(onReadyChange).toHaveBeenCalledWith(true));
    });

    it('při chybě načtení připravenost neohlásí vůbec', async () => {
      fetchApprovedReviewsMock.mockRejectedValue(new Error('network down'));
      fetchReviewStatsMock.mockResolvedValue({ count: 0, average: 0 });
      const onReadyChange = vi.fn();
      render(<MemoryRouter><ReviewsSection onReadyChange={onReadyChange} /></MemoryRouter>);
      await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
      // Build má spadnout hlasitě, ne předgenerovat chybovou stránku.
      expect(onReadyChange).not.toHaveBeenCalledWith(true);
    });

    it('loading stav nese atribut data-loading, podle kterého ho prerender pozná', () => {
      // Nikdy nedokončený fetch = trvalý loading stav, přesně to, co má prerender poznat.
      const pending = new Promise(() => undefined);
      fetchApprovedReviewsMock.mockReturnValue(pending);
      fetchReviewStatsMock.mockReturnValue(pending);
      const { container } = render(<MemoryRouter><ReviewsSection /></MemoryRouter>);
      expect(container.querySelector('[data-loading="true"]')).not.toBeNull();
    });
  });
});
