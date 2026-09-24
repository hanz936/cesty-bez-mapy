import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const getReviewRequestMock = vi.fn<(...args: unknown[]) => unknown>();
const submitReviewMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../lib/reviews', () => ({
  getReviewRequest: (...args: unknown[]) => getReviewRequestMock(...args),
  submitReview: (...args: unknown[]) => submitReviewMock(...args),
}));
vi.mock('../components/layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import ReviewSubmit from './ReviewSubmit';

const renderPage = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/recenze/pridat${search}`]}>
      <ReviewSubmit />
    </MemoryRouter>,
  );

describe('ReviewSubmit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows error state without token', async () => {
    renderPage('');
    await waitFor(() =>
      expect(screen.getByText(/Odkaz není platný/)).toBeInTheDocument(),
    );
    expect(getReviewRequestMock).not.toHaveBeenCalled();
  });

  it('shows expired message', async () => {
    getReviewRequestMock.mockResolvedValue({ ok: false, error: 'expired' });
    renderPage('?token=123e4567-e89b-42d3-a456-426614174000');
    await waitFor(() =>
      expect(screen.getByText(/Platnost odkazu už bohužel vypršela/)).toBeInTheDocument(),
    );
  });

  it('renders product form with prefilled name and disclosure', async () => {
    getReviewRequestMock.mockResolvedValue({
      ok: true,
      data: {
        customer_name: 'Jana Nováková',
        products: [{ product_id: 'p1', title: 'Salzburg na víkend', image_url: null, already_reviewed: false }],
      },
    });
    renderPage('?token=123e4567-e89b-42d3-a456-426614174000');
    await waitFor(() => expect(screen.getByText('Salzburg na víkend')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Jana Nováková')).toBeInTheDocument();
    // Text disclosure se na formuláři nezobrazuje (povinný je jen u zobrazených recenzí),
    // ale odkaz na něj ano — ISO 20488 radí říct pisateli o moderaci před odesláním
    // (rozhodnutí usera 2026-09-24, audit B-5).
    expect(screen.queryByText(/ověření zákazníci/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ověřování recenzí' })).toHaveAttribute('href', '/overovani-recenzi');
  });

  it('počítadlo znaků má čitelný kontrast (`gray-500`, ne `gray-400`)', async () => {
    // Počítadlo je text („0/2000 (min. 10)") a `gray-400` má vůči bílé jen 2,60 : 1,
    // WCAG 2.2 SC 1.4.3 chce 4,5 : 1; `gray-500` má 4,84 : 1. jsdom CSS nenačítá — třída.
    getReviewRequestMock.mockResolvedValue({
      ok: true,
      data: {
        customer_name: null,
        products: [{ product_id: 'p1', title: 'Salzburg', image_url: null, already_reviewed: false }],
      },
    });
    renderPage('?token=123e4567-e89b-42d3-a456-426614174000');
    const counter = await screen.findByText(/^0\/\d+ \(min\. \d+\)$/);
    expect(counter).toHaveClass('text-gray-500');
    expect(counter).not.toHaveClass('text-gray-400');
  });

  it('nevybraná hvězda je obrys, vybraná plná — stav nenese jen barva', async () => {
    // Bledá výplň `gray-300` měla vůči bílé 1,47 : 1, takže před prvním klikem nebyl
    // ovládací prvek skoro vidět (WCAG 2.2 SC 1.4.11, nález N-A10-2). jsdom CSS nenačítá,
    // proto se ověřují třídy, ne vypočtený vzhled.
    getReviewRequestMock.mockResolvedValue({
      ok: true,
      data: {
        customer_name: null,
        products: [{ product_id: 'p1', title: 'Salzburg', image_url: null, already_reviewed: false }],
      },
    });
    renderPage('?token=123e4567-e89b-42d3-a456-426614174000');
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(5));
    const stars = screen.getAllByRole('radio');
    const icon = (star: HTMLElement) => star.querySelector('svg')!;

    for (const star of stars) {
      expect(icon(star)).toHaveClass('text-gray-500', 'fill-none', 'stroke-current');
    }

    fireEvent.click(stars[2]); // 3 hvězdičky
    for (const star of stars.slice(0, 3)) {
      expect(icon(star)).toHaveClass('text-green-800');
      expect(icon(star)).not.toHaveClass('fill-none');
    }
    for (const star of stars.slice(3)) {
      expect(icon(star)).toHaveClass('text-gray-500', 'fill-none', 'stroke-current');
    }
  });

  it('supports APG radio-group keyboard pattern (roving tabindex + arrow selection)', async () => {
    getReviewRequestMock.mockResolvedValue({
      ok: true,
      data: {
        customer_name: null,
        products: [{ product_id: 'p1', title: 'Salzburg', image_url: null, already_reviewed: false }],
      },
    });
    renderPage('?token=123e4567-e89b-42d3-a456-426614174000');
    await waitFor(() => expect(screen.getByRole('radiogroup', { name: 'Hodnocení' })).toBeInTheDocument());
    const stars = screen.getAllByRole('radio');
    expect(stars).toHaveLength(5);

    // Roving tabindex: bez výběru je tabbable jen první hvězdička.
    expect(stars[0]).toHaveAttribute('tabindex', '0');
    for (const star of stars.slice(1)) {
      expect(star).toHaveAttribute('tabindex', '-1');
    }

    // ArrowRight bez výběru vybere první hvězdičku.
    stars[0].focus();
    fireEvent.keyDown(stars[0], { key: 'ArrowRight' });
    expect(stars[0]).toHaveAttribute('aria-checked', 'true');
    expect(stars[0]).toHaveFocus();

    // ArrowRight posune výběr i fokus na další hvězdičku; tabindex roluje s výběrem.
    fireEvent.keyDown(stars[0], { key: 'ArrowRight' });
    expect(stars[1]).toHaveAttribute('aria-checked', 'true');
    expect(stars[1]).toHaveFocus();
    expect(stars[1]).toHaveAttribute('tabindex', '0');
    expect(stars[0]).toHaveAttribute('tabindex', '-1');

    // ArrowUp vrátí výběr zpět.
    fireEvent.keyDown(stars[1], { key: 'ArrowUp' });
    expect(stars[0]).toHaveAttribute('aria-checked', 'true');
    expect(stars[0]).toHaveFocus();

    // Wrap dle APG: ArrowLeft z první hvězdičky vybere pátou a naopak.
    fireEvent.keyDown(stars[0], { key: 'ArrowLeft' });
    expect(stars[4]).toHaveAttribute('aria-checked', 'true');
    expect(stars[4]).toHaveFocus();
    fireEvent.keyDown(stars[4], { key: 'ArrowDown' });
    expect(stars[0]).toHaveAttribute('aria-checked', 'true');
    expect(stars[0]).toHaveFocus();
  });

  it('marks already reviewed product as submitted', async () => {
    getReviewRequestMock.mockResolvedValue({
      ok: true,
      data: {
        customer_name: null,
        products: [{ product_id: 'p1', title: 'Salzburg', image_url: null, already_reviewed: true }],
      },
    });
    renderPage('?token=123e4567-e89b-42d3-a456-426614174000');
    await waitFor(() => expect(screen.getByText(/Díky moc! Recenze je odeslaná/)).toBeInTheDocument());
  });

  describe('odeslání recenze', () => {
    const renderWithProduct = async (customerName: string | null = 'Jana Nováková') => {
      getReviewRequestMock.mockResolvedValue({
        ok: true,
        data: {
          customer_name: customerName,
          products: [{ product_id: 'p1', title: 'Salzburg', image_url: null, already_reviewed: false }],
        },
      });
      renderPage('?token=123e4567-e89b-42d3-a456-426614174000');
      await waitFor(() => expect(screen.getByText('Salzburg')).toBeInTheDocument());
    };

    const submitButton = () => screen.getByRole('button', { name: 'Odeslat recenzi' });
    const textArea = () => screen.getByRole('textbox', { name: 'Text recenze: Salzburg' });

    it('blocks submit and shows Czech message when no rating is selected', async () => {
      await renderWithProduct();
      fireEvent.click(submitButton());
      await waitFor(() =>
        expect(screen.getByText('Vyber prosím počet hvězdiček.')).toBeInTheDocument(),
      );
      expect(submitReviewMock).not.toHaveBeenCalled();
    });

    it('blocks submit and shows Czech message when review text is too short', async () => {
      await renderWithProduct();
      fireEvent.click(screen.getAllByRole('radio')[4]); // 5 hvězdiček
      fireEvent.change(textArea(), { target: { value: 'kratke' } });
      fireEvent.click(submitButton());
      await waitFor(() =>
        expect(screen.getByText('Text recenze musí mít alespoň 10 znaků.')).toBeInTheDocument(),
      );
      expect(submitReviewMock).not.toHaveBeenCalled();
    });

    it('blocks submit and shows Czech message when name is empty', async () => {
      await renderWithProduct(null);
      fireEvent.click(screen.getAllByRole('radio')[4]);
      fireEvent.change(textArea(), { target: { value: 'Dostatecne dlouhy text recenze na otestovani.' } });
      fireEvent.click(submitButton());
      await waitFor(() =>
        expect(screen.getByText('Vyplň prosím jméno (max 100 znaků).')).toBeInTheDocument(),
      );
      expect(submitReviewMock).not.toHaveBeenCalled();
    });

    it('shows the thank-you state after a successful submit', async () => {
      submitReviewMock.mockResolvedValue({ ok: true });
      await renderWithProduct();
      fireEvent.click(screen.getAllByRole('radio')[4]);
      fireEvent.change(textArea(), { target: { value: 'Skvely pruvodce, moc doporucuji vsem.' } });
      fireEvent.click(submitButton());
      await waitFor(() => expect(screen.getByText(/Díky moc! Recenze je odeslaná/)).toBeInTheDocument());
      expect(submitReviewMock).toHaveBeenCalledWith({
        token: '123e4567-e89b-42d3-a456-426614174000',
        product_id: 'p1',
        rating: 5,
        review_text: 'Skvely pruvodce, moc doporucuji vsem.',
        reviewer_name: 'Jana Nováková',
      });
    });

    it('shows the already_reviewed Czech message when submit fails with that error code', async () => {
      submitReviewMock.mockResolvedValue({ ok: false, error: 'already_reviewed' });
      await renderWithProduct();
      fireEvent.click(screen.getAllByRole('radio')[4]);
      fireEvent.change(textArea(), { target: { value: 'Skvely pruvodce, moc doporucuji vsem.' } });
      fireEvent.click(submitButton());
      await waitFor(() =>
        expect(screen.getByText('Tento produkt jsi už ohodnotil/a, díky!')).toBeInTheDocument(),
      );
      expect(screen.queryByText(/Díky moc! Recenze je odeslaná/)).not.toBeInTheDocument();
    });
  });
});
