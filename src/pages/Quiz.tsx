import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import Layout from '../components/layout/Layout';
import SeoTags from '../components/common/SeoTags';
import { buildPageMeta } from '../utils/pageSeo';
import { BASE_PATH, ROUTES } from '../constants';
import { QUIZ_QUESTIONS, QUIZ_STORAGE_KEY } from '../data/quizQuestions';
import { computeMatches } from '../lib/quizEngine';
import type { QuizAnswerMap } from '../lib/quizEngine';
import { useQuizProducts } from '../hooks/useQuizProducts';
import QuizQuestion from '../components/quiz/QuizQuestion';
import QuizResults from '../components/quiz/QuizResults';
import { ANALYTICS_EVENTS, trackEvent } from '../lib/analytics';

type QuizScreen = 'intro' | 'questions' | 'results';

interface QuizState {
  screen: QuizScreen;
  current: number;
  /** dimenze → index zvolené možnosti (pro obnovu UI). */
  answers: Record<string, number>;
}

type QuizAction =
  | { type: 'start' }
  | { type: 'select'; optionIndex: number }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'restart' };

const loadStoredAnswers = (): Record<string, number> => {
  try {
    const raw = sessionStorage.getItem(QUIZ_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { answers?: Record<string, number> };
    return parsed.answers ?? {};
  } catch {
    return {}; // sessionStorage nedostupné / vadný obsah — kvíz jede z prázdna (spec §3)
  }
};

const persistAnswers = (answers: Record<string, number>) => {
  try {
    sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({ answers }));
  } catch {
    // private mode — jen in-memory
  }
};

const clearStoredAnswers = () => {
  try {
    sessionStorage.removeItem(QUIZ_STORAGE_KEY);
  } catch {
    // noop
  }
};

const firstUnanswered = (answers: Record<string, number>): number => {
  const idx = QUIZ_QUESTIONS.findIndex((q) => answers[q.dimension] === undefined);
  return idx === -1 ? QUIZ_QUESTIONS.length - 1 : idx;
};

const initialState = (): QuizState => ({ screen: 'intro', current: 0, answers: loadStoredAnswers() });

function reducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'start':
      return { ...state, screen: 'questions', current: firstUnanswered(state.answers) };
    case 'select': {
      const { dimension } = QUIZ_QUESTIONS[state.current];
      return { ...state, answers: { ...state.answers, [dimension]: action.optionIndex } };
    }
    case 'next': {
      const { dimension } = QUIZ_QUESTIONS[state.current];
      if (state.answers[dimension] === undefined) return state; // bez výběru se nejde dál
      return state.current < QUIZ_QUESTIONS.length - 1
        ? { ...state, current: state.current + 1 }
        : { ...state, screen: 'results' };
    }
    case 'back':
      return state.current > 0 ? { ...state, current: state.current - 1 } : state;
    case 'restart':
      return { screen: 'intro', current: 0, answers: {} };
    default:
      return state;
  }
}

/** Index zvolené možnosti → klíč dimenze pro engine (null = neutrální volba). */
const toAnswerMap = (answers: Record<string, number>): QuizAnswerMap => {
  const map: QuizAnswerMap = {};
  for (const q of QUIZ_QUESTIONS) {
    const optionIndex = answers[q.dimension];
    if (optionIndex !== undefined) {
      map[q.dimension] = q.options[optionIndex]?.key ?? null;
    }
  }
  return map;
};

const Quiz = () => {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const { products, status, retry } = useQuizProducts();
  const completeTracked = useRef(false);

  useEffect(() => {
    // prázdné answers = intro/po restartu — zápis by vracel klíč smazaný v handleRestart
    if (Object.keys(state.answers).length > 0) {
      persistAnswers(state.answers);
    } else {
      clearStoredAnswers();
    }
  }, [state.answers]);

  const answerMap = useMemo(() => toAnswerMap(state.answers), [state.answers]);
  const resultSet = useMemo(
    () => (state.screen === 'results' && status === 'ready' ? computeMatches(answerMap, products) : null),
    [state.screen, status, answerMap, products],
  );

  useEffect(() => {
    if (resultSet && !completeTracked.current) {
      completeTracked.current = true;
      trackEvent(ANALYTICS_EVENTS.QUIZ_COMPLETE, {
        winner: resultSet.results[0]?.product.slug ?? 'none',
        score: resultSet.results[0]?.score ?? 0,
        backfilled: resultSet.backfilled,
      });
      clearStoredAnswers();
    }
  }, [resultSet]);

  const handleStart = useCallback(() => {
    trackEvent(ANALYTICS_EVENTS.QUIZ_START);
    dispatch({ type: 'start' });
  }, []);

  const handleRestart = useCallback(() => {
    completeTracked.current = false;
    clearStoredAnswers();
    dispatch({ type: 'restart' });
  }, []);

  const handleResultClick = useCallback((slug: string, position: number) => {
    trackEvent(ANALYTICS_EVENTS.QUIZ_RESULT_CLICK, { slug, position });
  }, []);

  const handleCustomClick = useCallback(() => {
    trackEvent(ANALYTICS_EVENTS.QUIZ_CUSTOM_CLICK);
  }, []);

  const question = QUIZ_QUESTIONS[state.current];

  return (
    <Layout ready>
      <SeoTags meta={buildPageMeta(ROUTES.QUIZ)} />
      {/* Scéna (spec §4.1): foto pozadí + tmavý překryv + bílý rám. Layout dodává <main>. */}
      <div
        className="min-h-screen bg-cover bg-center px-2 py-6 sm:px-4 sm:py-10"
        style={{ backgroundImage: `url(${BASE_PATH}/images/background-quiz-image.png)` }}
      >
        <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border-[6px] border-white shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <div className="bg-[radial-gradient(ellipse_at_50%_30%,rgba(18,28,38,0.5),rgba(10,18,26,0.8))] p-6 sm:p-8">
            {state.screen === 'intro' && (
              <div className="py-10 text-center">
                <p className="mb-2 text-xs font-bold tracking-[3px] text-white/75">CESTOVNÍ KVÍZ</p>
                <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.5)] sm:text-4xl">
                  Nevíš kudy kam?
                </h1>
                <p className="mx-auto mb-8 max-w-md text-sm font-semibold text-[#d9e8d9] sm:text-base">
                  Odpověz na 9 otázek — zabere ti to zhruba 2 minuty — a já ti doporučím itineráře,
                  které ti sednou nejvíc.
                </p>
                <button
                  type="button"
                  onClick={handleStart}
                  className="rounded-lg border-2 border-white/35 bg-green-800 px-8 py-3 font-bold text-white shadow-lg"
                >
                  Začít kvíz
                </button>
              </div>
            )}

            {state.screen === 'questions' && question && (
              <QuizQuestion
                question={question}
                index={state.current}
                total={QUIZ_QUESTIONS.length}
                selectedIndex={state.answers[question.dimension]}
                onSelect={(optionIndex) => dispatch({ type: 'select', optionIndex })}
                onBack={() => dispatch({ type: 'back' })}
                onNext={() => dispatch({ type: 'next' })}
              />
            )}

            {state.screen === 'results' &&
              (status === 'error' ? (
                <div className="py-10 text-center">
                  <p className="mb-4 text-sm font-semibold text-white">
                    Nepodařilo se načíst nabídku itinerářů. Zkus to prosím znovu.
                  </p>
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-lg border-2 border-white/55 bg-white/10 px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Zkusit znovu
                  </button>
                </div>
              ) : resultSet === null ? (
                <p className="py-10 text-center text-sm font-semibold text-white" aria-busy="true">
                  Vyhodnocuji…
                </p>
              ) : (
                <QuizResults
                  resultSet={resultSet}
                  chosenSeason={answerMap.season ?? null}
                  onRestart={handleRestart}
                  onResultClick={handleResultClick}
                  onCustomClick={handleCustomClick}
                />
              ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

Quiz.displayName = 'Quiz';

export default Quiz;
