import { BASE_PATH } from '../constants';

/**
 * Schéma kvízových dimenzí a jejich klíčů — jediný zdroj pravdy tvaru
 * `products.quiz_data.profile` (spec §5.1). Admin repo zrcadlí v
 * `src/resources/products/quizProfile.ts` (musí zůstat 1:1).
 */
export const QUIZ_DIMENSIONS = {
  vacation_type: ['adventure', 'cultural', 'relax', 'city'],
  season: ['spring', 'summer', 'autumn', 'winter'],
  duration: ['weekend', 'short', 'mid', 'long'],
  company: ['solo', 'couple', 'family', 'friends'],
  activity: ['nature', 'cultural', 'food', 'nightlife'],
  budget: ['low', 'mid', 'high'],
  climate: ['warm', 'mild', 'cool'],
  destination: ['beach', 'nature', 'city', 'cultural'],
  accommodation: ['luxury', 'comfortable', 'mid', 'budget'],
} as const;

export type QuizDimension = keyof typeof QUIZ_DIMENSIONS;

export type QuizProfile = {
  [D in QuizDimension]: Record<(typeof QUIZ_DIMENSIONS)[D][number], number>;
};

/** Dimenze, kde 0 u zvolené odpovědi produkt z doporučení vylučuje (spec §6.1). */
export const GATING_DIMENSIONS: readonly QuizDimension[] = ['season', 'duration'];

export interface QuizOptionDef {
  text: string;
  img: string;
  /** Klíč dimenze; null = neutrální odpověď — dimenze se ve scoringu ignoruje. */
  key: string | null;
}

export interface QuizQuestionDef {
  dimension: QuizDimension;
  question: string;
  weight: number;
  options: QuizOptionDef[];
}

const img = (name: string) => `${BASE_PATH}/images/${name}`;

/** 9 otázek v pořadí dle spec §5.2 (klimatické otázky záměrně rozestrčené). */
export const QUIZ_QUESTIONS: QuizQuestionDef[] = [
  {
    dimension: 'vacation_type',
    question: 'Jaká dovolená tě láká nejvíc?',
    weight: 1.35,
    options: [
      { text: 'Dobrodružství a adrenalin', key: 'adventure', img: img('adventure_1.png') },
      { text: 'Památky a kultura', key: 'cultural', img: img('cultural_1.png') },
      { text: 'Pohoda a odpočinek', key: 'relax', img: img('relax_1.png') },
      { text: 'Město a ruch velkoměsta', key: 'city', img: img('city_1.png') },
    ],
  },
  {
    dimension: 'season',
    question: 'Kdy chceš vyrazit?',
    weight: 1.35,
    options: [
      { text: 'Na jaře', key: 'spring', img: img('season_spring.png') },
      { text: 'V létě', key: 'summer', img: img('season_summer.png') },
      { text: 'Na podzim', key: 'autumn', img: img('season_autumn.png') },
      { text: 'V zimě', key: 'winter', img: img('season_winter.png') },
    ],
  },
  {
    dimension: 'duration',
    question: 'Jak dlouho chceš cestovat?',
    weight: 1.35,
    options: [
      { text: 'Jen víkend (2–3 dny)', key: 'weekend', img: img('duration_weekend_3.png') },
      { text: 'Týdenní útěk (4–7 dní)', key: 'short', img: img('duration_short_3.png') },
      { text: 'Pořádná dovolená (8–14 dní)', key: 'mid', img: img('duration_mid_3.png') },
      { text: 'Klidně celý měsíc (15 a víc dní)', key: 'long', img: img('duration_long_3.png') },
    ],
  },
  {
    dimension: 'company',
    question: 'S kým vyrážíš?',
    weight: 0.9,
    options: [
      { text: 'Solo dobrodruh', key: 'solo', img: img('solo_4.png') },
      { text: 'Romantika ve dvou', key: 'couple', img: img('couple_4.png') },
      { text: 'Rodinná výprava', key: 'family', img: img('family_4.png') },
      { text: 'Parta kamarádů', key: 'friends', img: img('friends_4.png') },
    ],
  },
  {
    dimension: 'activity',
    question: 'Co tě baví nejvíc?',
    weight: 1.15,
    options: [
      { text: 'Příroda a výšlapy', key: 'nature', img: img('activity_nature_5.png') },
      { text: 'Památky a muzea', key: 'cultural', img: img('activity_cultural_5.png') },
      { text: 'Jídlo a víno', key: 'food', img: img('activity_food_5.png') },
      { text: 'Bary a večírky', key: 'nightlife', img: img('activity_nightlife_5.png') },
    ],
  },
  {
    dimension: 'budget',
    question: 'Jaký máš rozpočet?',
    weight: 1.15,
    options: [
      { text: 'Low-cost a batoh', key: 'low', img: img('budget_low_2.png') },
      { text: 'Něco mezi — pohodlí za rozumnou cenu', key: 'mid', img: img('budget_mid_2.png') },
      { text: 'Dopřávám si, žádný problém', key: 'high', img: img('budget_high_2.png') },
      { text: 'Neřeším, hlavně zážitky', key: null, img: img('budget_neutral_2.png') },
    ],
  },
  {
    dimension: 'climate',
    question: 'Jaké počasí tě láká?',
    weight: 1.15,
    options: [
      { text: 'Slunce a vedro', key: 'warm', img: img('climate_warm_6.png') },
      { text: 'Příjemné teploty', key: 'mild', img: img('climate_mild_6.png') },
      { text: 'Chládek a horský vzduch', key: 'cool', img: img('climate_cool_6.png') },
      { text: 'Je mi to jedno', key: null, img: img('climate_neutral_6.png') },
    ],
  },
  {
    dimension: 'destination',
    question: 'Kam tě to táhne?',
    weight: 1.15,
    options: [
      { text: 'Pláže a moře', key: 'beach', img: img('destination_beach_7.png') },
      { text: 'Hory a lesy', key: 'nature', img: img('destination_nature_7.png') },
      { text: 'Města a kavárny', key: 'city', img: img('destination_city_7.png') },
      { text: 'Hrady a historie', key: 'cultural', img: img('destination_cultural_7.png') },
    ],
  },
  {
    dimension: 'accommodation',
    question: 'Jak moc řešíš ubytování?',
    weight: 0.9,
    options: [
      { text: 'Luxus a pohodlí', key: 'luxury', img: img('accommodation_luxury_8.png') },
      { text: 'Příjemný hotel', key: 'comfortable', img: img('accommodation_comfortable_8.png') },
      { text: 'Jednoduchý penzion', key: 'mid', img: img('accommodation_mid_8.png') },
      { text: 'Klidně cokoliv', key: 'budget', img: img('accommodation_budget_8.png') },
    ],
  },
];

/** Úrovně shody pro pečeť (spec §6.3); prahy jsou laditelné dle Umami dat. */
export const QUIZ_TIERS = [
  { min: 75, label: 'Skvělá shoda' },
  { min: 55, label: 'Dobrá shoda' },
  { min: 0, label: 'Zajímavý tip' },
] as const;

export const QUIZ_STORAGE_KEY = 'cbm-quiz-answers-v1';
