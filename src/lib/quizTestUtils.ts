import { QUIZ_DIMENSIONS } from '../data/quizQuestions';
import type { QuizProfile } from '../data/quizQuestions';
import type { QuizProduct } from './quizEngine';

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

let productSeq = 0;

/** Testovací produkt s daným profilem; extras přepíšou libovolné pole. */
export function makeProduct(profile: QuizProfile, extras: Partial<QuizProduct> = {}): QuizProduct {
  productSeq += 1;
  return {
    id: `id-${productSeq}`,
    slug: `product-${productSeq}`,
    title: `Produkt ${productSeq}`,
    description: 'Obecný popis.',
    price: 699,
    duration: '7 dní',
    image_url: null,
    average_rating: null,
    spring_description: null,
    summer_description: null,
    autumn_description: null,
    winter_description: null,
    quizData: { version: 1, enabled: true, profile },
    ...extras,
  };
}
