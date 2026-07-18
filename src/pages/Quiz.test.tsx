import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CartProvider } from '../contexts';
import { QUIZ_QUESTIONS, QUIZ_STORAGE_KEY } from '../data/quizQuestions';
import { makeProduct, makeProfile } from '../lib/quizTestUtils';
import type { QuizProduct } from '../lib/quizEngine';

const trackEventMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../lib/analytics', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/analytics')>();
  return { ...original, trackEvent: (...args: unknown[]) => trackEventMock(...args) };
});

let productsMock: QuizProduct[] = [];
let statusMock: 'loading' | 'ready' | 'error' = 'ready';
vi.mock('../hooks/useQuizProducts', () => ({
  useQuizProducts: () => ({ products: productsMock, status: statusMock, retry: vi.fn() }),
}));

import Quiz from './Quiz';

const renderQuiz = () =>
  render(
    <CartProvider>
      <MemoryRouter>
        <Quiz />
      </MemoryRouter>
    </CartProvider>,
  );

/** Odpoví první možností na všech 9 otázek a dokončí kvíz. */
const answerAll = () => {
  for (let i = 0; i < QUIZ_QUESTIONS.length; i += 1) {
    fireEvent.click(screen.getAllByRole('radio')[0]);
    const label = i === QUIZ_QUESTIONS.length - 1 ? 'Vyhodnotit' : 'Další →';
    fireEvent.click(screen.getByRole('button', { name: label }));
  }
};

describe('Quiz page', () => {
  beforeEach(() => {
    sessionStorage.clear();
    trackEventMock.mockClear();
    statusMock = 'ready';
    productsMock = [
      makeProduct(makeProfile(3), { slug: 'vitez', title: 'Vítěz' }),
      makeProduct(makeProfile(2), { slug: 'druhy', title: 'Druhý' }),
      makeProduct(makeProfile(1), { slug: 'treti', title: 'Třetí' }),
    ];
  });

  it('intro → start trackne quiz-start a ukáže první otázku', () => {
    renderQuiz();
    expect(screen.getByRole('heading', { name: 'Nevíš kudy kam?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Začít kvíz' }));
    expect(trackEventMock).toHaveBeenCalledWith('quiz-start');
    expect(
      screen.getByRole('heading', { name: `Otázka 1 z 9: ${QUIZ_QUESTIONS[0].question}` }),
    ).toBeInTheDocument();
  });

  it('průchod všemi 9 otázkami → výsledky, quiz-complete s vítězem, storage smazána', () => {
    renderQuiz();
    fireEvent.click(screen.getByRole('button', { name: 'Začít kvíz' }));
    answerAll();
    expect(screen.getByRole('heading', { name: 'Tvoje příští cesta' })).toBeInTheDocument();
    expect(screen.getByText('Vítěz')).toBeInTheDocument();
    expect(trackEventMock).toHaveBeenCalledWith(
      'quiz-complete',
      expect.objectContaining({ winner: 'vitez', backfilled: false }),
    );
    expect(sessionStorage.getItem(QUIZ_STORAGE_KEY)).toBeNull();
  });

  it('rozpracované odpovědi přežijí refresh — start pokračuje první nezodpovězenou', () => {
    const answers = {
      [QUIZ_QUESTIONS[0].dimension]: 0,
      [QUIZ_QUESTIONS[1].dimension]: 1,
    };
    sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({ answers }));
    renderQuiz();
    fireEvent.click(screen.getByRole('button', { name: 'Začít kvíz' }));
    expect(
      screen.getByRole('heading', { name: `Otázka 3 z 9: ${QUIZ_QUESTIONS[2].question}` }),
    ).toBeInTheDocument();
  });

  it('„Zkusit znovu" na výsledcích vrátí intro a smaže odpovědi', () => {
    renderQuiz();
    fireEvent.click(screen.getByRole('button', { name: 'Začít kvíz' }));
    answerAll();
    fireEvent.click(screen.getByRole('button', { name: '↻ Zkusit znovu' }));
    expect(screen.getByRole('heading', { name: 'Nevíš kudy kam?' })).toBeInTheDocument();
    expect(sessionStorage.getItem(QUIZ_STORAGE_KEY)).toBeNull();
  });

  it('chyba načtení produktů → na výsledcích chybová hláška se „Zkusit znovu"', () => {
    statusMock = 'error';
    renderQuiz();
    fireEvent.click(screen.getByRole('button', { name: 'Začít kvíz' }));
    answerAll();
    expect(screen.getByText(/Nepodařilo se načíst nabídku itinerářů/)).toBeInTheDocument();
  });
});
