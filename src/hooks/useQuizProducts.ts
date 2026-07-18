import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import logger from '../utils/logger';
import { parseQuizData } from '../lib/quizEngine';
import type { QuizProduct, QuizProductRow } from '../lib/quizEngine';

export type QuizProductsStatus = 'loading' | 'ready' | 'error';

/** Sloupce dle spec §7.2 (vč. sezónních popisů pro pohlednice a ratingu pro remízy). */
const QUIZ_PRODUCT_COLUMNS =
  'id, slug, title, description, price, duration, image_url, average_rating, quiz_data, spring_description, summer_description, autumn_description, winter_description';

export function useQuizProducts(): {
  products: QuizProduct[];
  status: QuizProductsStatus;
  retry: () => void;
} {
  const [products, setProducts] = useState<QuizProduct[]>([]);
  const [status, setStatus] = useState<QuizProductsStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    void (async () => {
      const { data, error } = await supabase
        .from('products')
        .select(QUIZ_PRODUCT_COLUMNS)
        .eq('is_active', true)
        .eq('is_deleted', false);
      if (cancelled) return;
      if (error) {
        logger.error('Kvíz: načtení produktů selhalo', error);
        setStatus('error');
        return;
      }
      const rows = (data ?? []) as unknown as QuizProductRow[];
      const parsed: QuizProduct[] = [];
      for (const rowData of rows) {
        const quizData = parseQuizData(rowData.quiz_data);
        if (!quizData) {
          // logger centrálně přidá Sentry breadcrumb (Task 0) — nevolat Sentry přímo
          logger.warn(`Kvíz: produkt „${rowData.slug}" má nevalidní quiz_data — přeskočen`);
          continue;
        }
        if (!quizData.enabled) continue;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- rest-omit pattern: `_` intentionally discarded to exclude that key from rest
        const { quiz_data: _quizJson, ...rest } = rowData;
        parsed.push({ ...rest, quizData });
      }
      setProducts(parsed);
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { products, status, retry };
}
