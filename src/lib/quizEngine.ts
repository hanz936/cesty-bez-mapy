import { QUIZ_DIMENSIONS, GATING_DIMENSIONS, QUIZ_QUESTIONS, QUIZ_TIERS } from '../data/quizQuestions';
import type { QuizProfile, QuizDimension } from '../data/quizQuestions';
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

/** Odpovědi kvízu: klíč dimenze, null = neutrální, chybějící = nezodpovězeno. */
export type QuizAnswerMap = Partial<Record<QuizDimension, string | null>>;

export interface QuizMatch {
  product: QuizProduct;
  /** Zaokrouhlené celé procento 0–100. */
  score: number;
  tier: string;
  fromBackfill: boolean;
}

export interface QuizResultSet {
  results: QuizMatch[];
  /** true = aspoň jeden zobrazený výsledek pochází z vyloučených (spec §6.2). */
  backfilled: boolean;
}

export const QUIZ_RESULT_COUNT = 3;

export function tierFor(score: number): string {
  const tier = QUIZ_TIERS.find((t) => score >= t.min);
  return (tier ?? QUIZ_TIERS[QUIZ_TIERS.length - 1]).label;
}

function scoreProduct(answers: QuizAnswerMap, profile: QuizProfile): number {
  let match = 0;
  let max = 0;
  for (const q of QUIZ_QUESTIONS) {
    const key = answers[q.dimension];
    if (key == null) continue; // nezodpovězeno nebo neutrální → dimenze se ignoruje (spec §6.1)
    const values = profile[q.dimension] as Record<string, number>;
    match += q.weight * (values[key] ?? 0);
    max += q.weight * 3;
  }
  return max > 0 ? Math.round((match / max) * 100) : 0;
}

function isExcluded(answers: QuizAnswerMap, profile: QuizProfile): boolean {
  return GATING_DIMENSIONS.some((dimension) => {
    const key = answers[dimension];
    if (key == null) return false;
    const values = profile[dimension] as Record<string, number>;
    return (values[key] ?? 0) === 0;
  });
}

function byRank(a: QuizMatch, b: QuizMatch): number {
  if (b.score !== a.score) return b.score - a.score;
  const ratingA = a.product.average_rating ?? 0;
  const ratingB = b.product.average_rating ?? 0;
  if (ratingB !== ratingA) return ratingB - ratingA;
  return a.product.title.localeCompare(b.product.title, 'cs');
}

/**
 * Spočítá top 3 doporučení (spec §6.2). Kandidáti (koupitelné, ne-vyloučené)
 * mají vždy přednost před backfillem, i kdyby backfill měl vyšší score —
 * doporučujeme primárně to, co reálně odpovídá termínu a délce.
 */
export function computeMatches(answers: QuizAnswerMap, products: QuizProduct[]): QuizResultSet {
  const candidates: QuizMatch[] = [];
  const excluded: QuizMatch[] = [];
  for (const product of products) {
    const { profile } = product.quizData;
    const score = scoreProduct(answers, profile);
    const match: QuizMatch = { product, score, tier: tierFor(score), fromBackfill: false };
    (isExcluded(answers, profile) ? excluded : candidates).push(match);
  }
  candidates.sort(byRank);
  excluded.sort(byRank);
  const results = candidates.slice(0, QUIZ_RESULT_COUNT);
  for (const extra of excluded) {
    if (results.length >= QUIZ_RESULT_COUNT) break;
    results.push({ ...extra, fromBackfill: true });
  }
  return { results, backfilled: results.some((r) => r.fromBackfill) };
}
