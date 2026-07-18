import { describe, it, expect } from 'vitest';
import type { QuizProfile } from '../data/quizQuestions';
import { makeProfile } from './quizTestUtils';
import { parseQuizData } from './quizEngine';

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
