import { describe, it, expect } from 'vitest';
import {
  QUIZ_DIMENSIONS,
  QUIZ_QUESTIONS,
  QUIZ_TIERS,
  GATING_DIMENSIONS,
} from './quizQuestions';

describe('QUIZ_QUESTIONS — konzistence dat (spec §5.2)', () => {
  it('má 9 otázek, každou dimenzi schématu pokrývá právě jedna otázka', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(9);
    const dims = QUIZ_QUESTIONS.map((q) => q.dimension);
    expect(new Set(dims).size).toBe(9);
    expect([...dims].sort()).toEqual(Object.keys(QUIZ_DIMENSIONS).sort());
  });

  it('pořadí dle specu: klimatické otázky rozestrčené (season=2., climate=7.)', () => {
    expect(QUIZ_QUESTIONS[1].dimension).toBe('season');
    expect(QUIZ_QUESTIONS[6].dimension).toBe('climate');
  });

  it('každá ne-null volba mapuje na platný klíč své dimenze', () => {
    for (const q of QUIZ_QUESTIONS) {
      const validKeys: readonly string[] = QUIZ_DIMENSIONS[q.dimension];
      for (const opt of q.options) {
        expect(opt.text.trim().length).toBeGreaterThan(0);
        expect(opt.img.length).toBeGreaterThan(0);
        if (opt.key !== null) expect(validKeys).toContain(opt.key);
      }
    }
  });

  it('neutrální volbu mají jen budget a climate; ostatní pokrývají všechny klíče', () => {
    for (const q of QUIZ_QUESTIONS) {
      const neutrals = q.options.filter((o) => o.key === null);
      if (q.dimension === 'budget' || q.dimension === 'climate') {
        expect(neutrals).toHaveLength(1);
      } else {
        expect(neutrals).toHaveLength(0);
        expect(q.options.map((o) => o.key).sort()).toEqual(
          [...QUIZ_DIMENSIONS[q.dimension]].sort(),
        );
      }
    }
  });

  it('váhy jsou v rozpětí 0,90–1,35; season+duration jsou vylučovací', () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(q.weight).toBeGreaterThanOrEqual(0.9);
      expect(q.weight).toBeLessThanOrEqual(1.35);
    }
    expect(GATING_DIMENSIONS).toEqual(['season', 'duration']);
  });

  it('úrovně shody: 75/55/0, sestupně', () => {
    expect(QUIZ_TIERS.map((t) => t.min)).toEqual([75, 55, 0]);
    expect(QUIZ_TIERS.map((t) => t.label)).toEqual([
      'Skvělá shoda',
      'Dobrá shoda',
      'Zajímavý tip',
    ]);
  });
});
