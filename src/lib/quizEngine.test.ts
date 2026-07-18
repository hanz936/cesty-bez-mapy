import { describe, it, expect } from 'vitest';
import type { QuizProfile } from '../data/quizQuestions';
import { makeProfile, makeProduct } from './quizTestUtils';
import { parseQuizData, computeMatches, tierFor } from './quizEngine';
import type { QuizAnswerMap } from './quizEngine';

const validQuizData = (profile: QuizProfile = makeProfile(2)) => ({
  version: 1,
  enabled: true,
  profile,
});

describe('parseQuizData (spec §5.1)', () => {
  it('validní data projdou a vrátí typovaný objekt', () => {
    const parsed = parseQuizData(validQuizData());
    expect(parsed).not.toBeNull();
    expect(parsed!.enabled).toBe(true);
    expect(parsed!.profile.season.summer).toBe(2);
  });

  it('odmítne: null, prázdný objekt, špatnou verzi, chybějící enabled', () => {
    expect(parseQuizData(null)).toBeNull();
    expect(parseQuizData({})).toBeNull();
    expect(parseQuizData({ ...validQuizData(), version: 2 })).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- rest-omit pattern: `_` intentionally discarded to exclude that key from rest
    const { enabled: _e, ...noEnabled } = validQuizData();
    expect(parseQuizData(noEnabled)).toBeNull();
  });

  it('odmítne profil s chybějící dimenzí nebo klíčem', () => {
    const data = validQuizData();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- rest-omit pattern: `_` intentionally discarded to exclude that key from rest
    const { season: _s, ...profileWithout } = data.profile;
    expect(parseQuizData({ ...data, profile: profileWithout })).toBeNull();

    const missingKey = validQuizData(makeProfile(2));
    delete (missingKey.profile.budget as Record<string, number>).low;
    expect(parseQuizData(missingKey)).toBeNull();
  });

  it('odmítne hodnoty mimo 0–3, necelá čísla a ne-čísla', () => {
    expect(parseQuizData(validQuizData(makeProfile(2, { budget: { low: 4 } })))).toBeNull();
    expect(parseQuizData(validQuizData(makeProfile(2, { budget: { low: -1 } })))).toBeNull();
    expect(parseQuizData(validQuizData(makeProfile(2, { budget: { low: 1.5 } })))).toBeNull();
    const bad = validQuizData();
    (bad.profile.budget as Record<string, unknown>).low = 'tři';
    expect(parseQuizData(bad)).toBeNull();
  });
});

/** Odpovědi na všech 9 otázek stejným „směrem" — první klíč každé dimenze. */
const fullAnswers = (overrides: QuizAnswerMap = {}): QuizAnswerMap => ({
  vacation_type: 'adventure',
  season: 'summer',
  duration: 'short',
  company: 'solo',
  activity: 'nature',
  budget: 'low',
  climate: 'warm',
  destination: 'beach',
  accommodation: 'luxury',
  ...overrides,
});

describe('tierFor (spec §6.3)', () => {
  it('hraniční hodnoty: 75→Skvělá, 74→Dobrá, 55→Dobrá, 54→Zajímavý tip', () => {
    expect(tierFor(75)).toBe('Skvělá shoda');
    expect(tierFor(74)).toBe('Dobrá shoda');
    expect(tierFor(55)).toBe('Dobrá shoda');
    expect(tierFor(54)).toBe('Zajímavý tip');
    expect(tierFor(0)).toBe('Zajímavý tip');
  });
});

describe('computeMatches (spec §6)', () => {
  it('plný zásah = 100 %, minimální shoda pod 10 %', () => {
    const perfect = makeProduct(makeProfile(3));
    const zero = makeProduct(makeProfile(0, { season: { summer: 1 }, duration: { short: 1 } }));
    const { results } = computeMatches(fullAnswers(), [perfect, zero]);
    expect(results[0].product.id).toBe(perfect.id);
    expect(results[0].score).toBe(100);
    expect(results[0].tier).toBe('Skvělá shoda');
    expect(results[1].score).toBeLessThan(10);
  });

  it('neutrální odpověď dimenzi vyřadí z čitatele i jmenovatele (spec §6.1)', () => {
    // budget: low=0 → s odpovědí 'low' sráží; s neutral (null) se budget ignoruje
    const profile = makeProfile(3, { budget: { low: 0, mid: 0, high: 0 } });
    const product = makeProduct(profile);
    const withLow = computeMatches(fullAnswers(), [product]).results[0].score;
    const withNeutral = computeMatches(fullAnswers({ budget: null }), [product]).results[0].score;
    expect(withNeutral).toBe(100);
    expect(withLow).toBeLessThan(100);
  });

  it('nezodpovězená otázka se chová jako neutrální (dimenze se ignoruje)', () => {
    const product = makeProduct(makeProfile(3, { accommodation: { luxury: 0, comfortable: 0, mid: 0, budget: 0 } }));
    const answers = fullAnswers();
    delete answers.accommodation;
    expect(computeMatches(answers, [product]).results[0].score).toBe(100);
  });

  it('vylučovací dimenze: 0 u zvoleného termínu/délky produkt vyřadí (spec §6.1)', () => {
    const excludedByDuration = makeProduct(makeProfile(3, { duration: { short: 0 } }));
    const excludedBySeason = makeProduct(makeProfile(3, { season: { summer: 0 } }));
    const ok = makeProduct(makeProfile(1));
    const { results, backfilled } = computeMatches(fullAnswers(), [excludedByDuration, excludedBySeason, ok]);
    // ok je jediný kandidát; vyloučené se doplní jako backfill až za něj
    expect(results[0].product.id).toBe(ok.id);
    expect(results[0].fromBackfill).toBe(false);
    expect(results.slice(1).every((r) => r.fromBackfill)).toBe(true);
    expect(backfilled).toBe(true);
  });

  it('bez backfillu je backfilled=false a bere se top 3 ze 4 kandidátů', () => {
    const products = [
      makeProduct(makeProfile(3)),
      makeProduct(makeProfile(2)),
      makeProduct(makeProfile(1)),
      makeProduct(makeProfile(1)),
    ];
    const { results, backfilled } = computeMatches(fullAnswers(), [products[2], products[0], products[3], products[1]]);
    expect(results).toHaveLength(3);
    expect(backfilled).toBe(false);
    expect(results[0].product.id).toBe(products[0].id);
    expect(results[1].product.id).toBe(products[1].id);
  });

  it('remíza: vyšší average_rating, pak české řazení podle title', () => {
    const a = makeProduct(makeProfile(2), { title: 'Červený', average_rating: null });
    const b = makeProduct(makeProfile(2), { title: 'Cesta', average_rating: 4.5 });
    const c = makeProduct(makeProfile(2), { title: 'Balt', average_rating: null });
    const { results } = computeMatches(fullAnswers(), [a, b, c]);
    expect(results.map((r) => r.product.id)).toEqual([b.id, c.id, a.id]);
  });

  it('méně produktů než 3 → vrátí kolik je; prázdný vstup → prázdné výsledky', () => {
    expect(computeMatches(fullAnswers(), [makeProduct(makeProfile(2))]).results).toHaveLength(1);
    expect(computeMatches(fullAnswers(), []).results).toHaveLength(0);
    expect(computeMatches(fullAnswers(), []).backfilled).toBe(false);
  });
});
