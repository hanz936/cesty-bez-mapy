// src/components/quiz/QuizQuestion.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QUIZ_QUESTIONS } from '../../data/quizQuestions';
import QuizQuestion from './QuizQuestion';

const noop = () => undefined;
type QuizQuestionProps = Parameters<typeof QuizQuestion>[0];
const renderQuestion = (props: Partial<QuizQuestionProps> = {}) =>
  render(
    <QuizQuestion
      question={QUIZ_QUESTIONS[0]}
      index={0}
      total={9}
      onSelect={noop}
      onBack={noop}
      onNext={noop}
      {...props}
    />,
  );

describe('QuizQuestion', () => {
  it('vykreslí nadpis s sr-only pozicí, radiogroup se 4 přístupnými radii a progressbar s aria-valuetext', () => {
    renderQuestion({ index: 2 });
    expect(
      screen.getByRole('heading', { name: `Otázka 3 z 9: ${QUIZ_QUESTIONS[0].question}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Otázka 3 z 9');
  });

  it('klik na kartu volá onSelect s indexem volby', () => {
    const onSelect = vi.fn();
    renderQuestion({ onSelect });
    fireEvent.click(screen.getByRole('radio', { name: QUIZ_QUESTIONS[0].options[2].text }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('„Další" je bez výběru aria-disabled a nevolá onNext; s výběrem funguje; poslední otázka má „Vyhodnotit"', () => {
    const onNext = vi.fn();
    renderQuestion({ onNext });
    const next = screen.getByRole('button', { name: 'Další →' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(next);
    expect(onNext).not.toHaveBeenCalled();

    renderQuestion({ selectedIndex: 1, onNext });
    const enabledNext = screen.getAllByRole('button', { name: 'Další →' }).at(-1)!;
    expect(enabledNext).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(enabledNext);
    expect(onNext).toHaveBeenCalledTimes(1);

    renderQuestion({ index: 8, selectedIndex: 0 });
    expect(screen.getByRole('button', { name: 'Vyhodnotit' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('klávesa „2" vybere druhou možnost', () => {
    const onSelect = vi.fn();
    renderQuestion({ onSelect });
    fireEvent.keyDown(document, { key: '2' });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('na první otázce je „Zpět" vizuálně skryté (invisible), jinak viditelné', () => {
    renderQuestion();
    expect(screen.getByRole('button', { name: '← Zpět' }).className).toContain('invisible');
    renderQuestion({ index: 3 });
    expect(screen.getAllByRole('button', { name: '← Zpět' }).at(-1)!.className).not.toContain('invisible');
  });
});
