import { QUIZ_DIMENSIONS } from '../data/quizQuestions';
import type { QuizProfile } from '../data/quizQuestions';

/** Kompletní profil se stejnou hodnotou všude + overrides pro konkrétní dimenze. */
export function makeProfile(
  fill: number,
  overrides: Partial<Record<string, Record<string, number>>> = {},
): QuizProfile {
  const profile: Record<string, Record<string, number>> = {};
  for (const [dimension, keys] of Object.entries(QUIZ_DIMENSIONS)) {
    profile[dimension] = {};
    for (const key of keys) {
      profile[dimension][key] = overrides[dimension]?.[key] ?? fill;
    }
  }
  return profile as QuizProfile;
}
