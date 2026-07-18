import { QUIZ_DIMENSIONS } from '../data/quizQuestions';
import type { QuizProfile } from '../data/quizQuestions';
import type { Tables } from '../types/database.types';

/** Parsovaný obsah sloupce products.quiz_data (spec §5.1). */
export interface QuizData {
  version: 1;
  enabled: boolean;
  profile: QuizProfile;
}

export type QuizProductRow = Pick<
  Tables<'products'>,
  | 'id' | 'slug' | 'title' | 'description' | 'price' | 'duration'
  | 'image_url' | 'average_rating'
  | 'spring_description' | 'summer_description' | 'autumn_description' | 'winter_description'
  | 'quiz_data'
>;

export interface QuizProduct extends Omit<QuizProductRow, 'quiz_data'> {
  quizData: QuizData;
}

/**
 * Runtime validace quiz_data — jediný zdroj pravdy tvaru na FE.
 * Vrací null pro cokoli nevalidního (produkt se pak z kvízu tiše vynechá).
 */
export function parseQuizData(json: unknown): QuizData | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  if (obj.version !== 1 || typeof obj.enabled !== 'boolean') return null;
  const rawProfile = obj.profile;
  if (typeof rawProfile !== 'object' || rawProfile === null) return null;
  const profile = rawProfile as Record<string, unknown>;
  for (const [dimension, keys] of Object.entries(QUIZ_DIMENSIONS)) {
    const dim = profile[dimension];
    if (typeof dim !== 'object' || dim === null) return null;
    const values = dim as Record<string, unknown>;
    for (const key of keys) {
      const value = values[key];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 3) {
        return null;
      }
    }
  }
  return { version: 1, enabled: obj.enabled, profile: rawProfile as QuizProfile };
}
