import { useEffect, useId, useRef } from 'react';
import type { QuizQuestionDef } from '../../data/quizQuestions';
import SealBadge from './SealBadge';

interface QuizQuestionProps {
  question: QuizQuestionDef;
  /** 0-based index otázky. */
  index: number;
  total: number;
  selectedIndex?: number;
  onSelect: (optionIndex: number) => void;
  onBack: () => void;
  onNext: () => void;
}

/** Progress jako filmový pás: 9 políček, exponovaná bílá, aktuální zelené (spec §4.2). */
const FilmStrip = ({ current, total }: { current: number; total: number }) => {
  const perforation =
    'h-1.5 bg-[repeating-linear-gradient(90deg,transparent_0_5px,rgba(255,255,255,0.35)_5px_9px,transparent_9px_14px)]';
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-valuetext={`Otázka ${current + 1} z ${total}`}
      className="mx-auto mb-5 w-full max-w-sm"
    >
      <div className={perforation} />
      <div className="flex gap-1.5 py-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-4 flex-1 rounded-sm border-2 ${
              i < current
                ? 'border-white/80 bg-white/75'
                : i === current
                  ? 'border-white bg-green-800 shadow-[0_0_10px_rgba(134,239,172,0.5)]'
                  : 'border-white/30 bg-white/15'
            }`}
          />
        ))}
      </div>
      <div className={perforation} />
    </div>
  );
};

/** Natočení fotek „na stole"; vybraná karta se narovná a zvedne (spec §4.2). */
const ROTATIONS = ['-rotate-2', 'rotate-[1.6deg]', 'rotate-[-1.1deg]', 'rotate-[2.1deg]'];

const QuizQuestion = ({ question, index, total, selectedIndex, onSelect, onBack, onNext }: QuizQuestionProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  // Přechod otázek: fokus na nadpis, ať SR i klávesnice vědí, kde jsou (spec §7.3)
  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  // Bonus: čísla 1–4 vybírají možnosti (spec §7.3)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const n = Number.parseInt(event.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= question.options.length) onSelect(n - 1);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [question, onSelect]);

  const hasSelection = selectedIndex !== undefined;

  return (
    <div>
      <p className="mb-2.5 text-center text-xs font-bold tracking-[3px] text-white/75">
        OTÁZKA {index + 1} Z {total}
      </p>
      <FilmStrip current={index} total={total} />
      <h2
        ref={headingRef}
        tabIndex={-1}
        id={headingId}
        className="mb-6 text-center text-2xl font-extrabold tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.5)] focus:outline-none sm:text-3xl"
      >
        <span className="sr-only">
          Otázka {index + 1} z {total}:{' '}
        </span>
        {question.question}
      </h2>
      <div role="radiogroup" aria-labelledby={headingId} className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4">
        {question.options.map((option, i) => {
          const checked = selectedIndex === i;
          return (
            <label
              key={option.text}
              className={`relative cursor-pointer rounded bg-[#fbf9f3] p-1.5 pb-2 text-center shadow-[0_10px_26px_rgba(0,0,0,0.42)] transition-transform duration-200 focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 motion-reduce:transition-none ${
                checked
                  ? 'z-10 -translate-y-1.5 scale-105 ring-[2.5px] ring-green-800'
                  : `${ROTATIONS[i % ROTATIONS.length]} hover:-translate-y-1`
              }`}
            >
              <input
                type="radio"
                name={`quiz-question-${index}`}
                value={i}
                checked={checked}
                onChange={() => onSelect(i)}
                className="sr-only"
                aria-label={option.text}
              />
              {checked && <SealBadge variant="check" size="sm" className="absolute -right-3 -top-4 w-11" />}
              <img src={option.img} alt="" className="aspect-[4/3.6] w-full object-cover" />
              <span className="block px-1 pt-2 text-sm font-bold leading-snug text-[#1c2b21]">{option.text}</span>
            </label>
          );
        })}
      </div>
      <div className="mt-7 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className={`rounded-lg border-2 border-white/55 bg-white/10 px-5 py-2.5 text-sm font-bold text-white ${
            index === 0 ? 'invisible' : ''
          }`}
        >
          ← Zpět
        </button>
        {/* aria-disabled místo disabled: tlačítko zůstává v tab-orderu a čtečka stav vysvětlí (spec §7.3) */}
        <button
          type="button"
          onClick={() => {
            if (hasSelection) onNext();
          }}
          aria-disabled={!hasSelection}
          className="rounded-lg border-2 border-white/35 bg-green-800 px-5 py-2.5 text-sm font-bold text-white shadow-lg aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {index === total - 1 ? 'Vyhodnotit' : 'Další →'}
        </button>
      </div>
    </div>
  );
};

export default QuizQuestion;
