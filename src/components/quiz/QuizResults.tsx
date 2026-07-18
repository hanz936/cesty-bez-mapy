import { Link } from 'react-router-dom';
import { ROUTES, SEASONS } from '../../constants';
import type { QuizProduct, QuizResultSet } from '../../lib/quizEngine';
import SealBadge from './SealBadge';

interface QuizResultsProps {
  resultSet: QuizResultSet;
  /** Klíč zvoleného ročního období ('spring'…) nebo null. */
  chosenSeason: string | null;
  onRestart: () => void;
  onResultClick: (slug: string, position: number) => void;
  onCustomClick: () => void;
}

type SeasonField = 'spring_description' | 'summer_description' | 'autumn_description' | 'winter_description';

/** Popisek pohlednice: sezónní popis dle zvoleného období, fallback obecný (spec §4.3). */
const postcardNote = (product: QuizProduct, chosenSeason: string | null): string => {
  if (chosenSeason) {
    const season = SEASONS.find((s) => s.key === chosenSeason);
    const seasonal = season ? product[season.dbField as SeasonField] : null;
    if (seasonal) return seasonal;
  }
  return product.description;
};

const productPath = (slug: string) => `${ROUTES.TRAVEL_GUIDES}/${slug}`;

const PostcardPhoto = ({ product, aspect }: { product: QuizProduct; aspect: string }) =>
  product.image_url ? (
    <div className={`relative ${aspect} w-full`}>
      <img src={product.image_url} alt="" className="h-full w-full object-cover" />
      {/* vnitřní linka rámečku jako overlay — inset shadow přímo na <img> překryjí pixely fotky */}
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
        aria-hidden="true"
      />
    </div>
  ) : (
    <div className={`${aspect} w-full bg-green-800/10`} aria-hidden="true" />
  );

const CustomItineraryNote = ({ prominent = false, onCustomClick }: { prominent?: boolean; onCustomClick: () => void }) => (
  <div
    className={`mx-auto mt-7 max-w-md rotate-[0.8deg] rounded border-t-[14px] border-green-800/15 bg-[#fffef7] p-5 shadow-[0_10px_26px_rgba(0,0,0,0.4)] ${
      prominent ? 'ring-2 ring-green-800' : ''
    }`}
  >
    <p className="mb-2.5 text-sm font-semibold leading-relaxed text-[#2d3d33]">
      Nesedlo ti nic z toho? Nevadí — sestavím ti itinerář na míru, přesně podle tebe.
    </p>
    <Link
      to={ROUTES.CUSTOM_ITINERARY_DETAIL}
      onClick={onCustomClick}
      className="inline-block rounded-lg border-2 border-green-800 px-4 py-2 text-sm font-bold text-green-800"
    >
      Chci itinerář na míru
    </Link>
  </div>
);

const QuizResults = ({ resultSet, chosenSeason, onRestart, onResultClick, onCustomClick }: QuizResultsProps) => {
  const [winner, ...alternatives] = resultSet.results;
  const heading =
    winner === undefined
      ? 'Zatím nemám co doporučit'
      : resultSet.backfilled
        ? 'Nejblíž tvým odpovědím'
        : 'Tvoje příští cesta';
  const subtitle =
    winner === undefined
      ? null
      : resultSet.backfilled
        ? 'Přesnou shodu s termínem a délkou teď v nabídce nemám — tohle jsou nejbližší cesty.'
        : 'vybraná podle tvých devíti odpovědí';

  return (
    <div>
      <p className="mb-1.5 text-center text-xs font-bold tracking-[3px] text-white/75">VÝSLEDEK KVÍZU</p>
      <h1 className="mb-1 text-center text-3xl font-extrabold tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.5)]">
        {heading}
      </h1>
      {subtitle && <p className="mb-7 text-center text-sm font-semibold text-[#d9e8d9]">{subtitle}</p>}

      {winner === undefined ? (
        <>
          <p className="mx-auto max-w-md text-center text-sm text-white/90">
            V katalogu teď není žádný itinerář zařazený do kvízu.{' '}
            <Link to={ROUTES.TRAVEL_GUIDES} className="font-bold underline">
              Mrkni na všechny průvodce
            </Link>
            .
          </p>
          <CustomItineraryNote prominent onCustomClick={onCustomClick} />
        </>
      ) : (
        <>
          {resultSet.backfilled && <CustomItineraryNote prominent onCustomClick={onCustomClick} />}

          <div className="relative mx-auto mt-6 max-w-xl -rotate-[1.3deg] rounded-md bg-[#fbf9f3] p-3 pb-4 shadow-[0_14px_34px_rgba(0,0,0,0.45)]">
            <SealBadge variant="score" tier={winner.tier} score={winner.score} size="lg" className="absolute -right-5 -top-6 w-[118px]" />
            <PostcardPhoto product={winner.product} aspect="aspect-[16/7.5]" />
            <div className="flex items-end gap-3 px-1.5 pt-3">
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold tracking-tight text-[#1c2b21]">{winner.product.title}</h2>
                <p className="mt-0.5 line-clamp-2 text-sm font-medium text-[#3d5c46]">
                  {postcardNote(winner.product, chosenSeason)}
                </p>
              </div>
              <div className="ml-auto shrink-0 text-right">
                {winner.product.duration && (
                  <span className="block text-xs font-semibold text-[#6b7c6f]">{winner.product.duration}</span>
                )}
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#6b7c6f]">
                  kompletní itinerář
                </span>
                <span className="text-base font-extrabold text-green-800">{Math.round(winner.product.price)} Kč</span>
              </div>
            </div>
            <Link
              to={productPath(winner.product.slug)}
              onClick={() => onResultClick(winner.product.slug, 1)}
              className="mt-3 block rounded-lg bg-green-800 px-4 py-2.5 text-center text-sm font-bold text-white shadow-lg"
            >
              Zobrazit itinerář
            </Link>
          </div>

          {alternatives.length > 0 && (
            <div className="mx-auto mt-6 grid max-w-xl gap-4 sm:grid-cols-2">
              {alternatives.map((match, i) => (
                <div
                  key={match.product.id}
                  className={`relative rounded-md bg-[#fbf9f3] p-2 pb-3 shadow-[0_14px_34px_rgba(0,0,0,0.45)] ${
                    i === 0 ? 'rotate-[1.4deg]' : 'rotate-[-0.9deg]'
                  }`}
                >
                  <SealBadge variant="score" tier={match.tier} score={match.score} size="sm" className="absolute -right-3.5 -top-5 w-[88px]" />
                  <PostcardPhoto product={match.product} aspect="aspect-[16/8]" />
                  <div className="px-1 pt-2">
                    <h2 className="text-base font-extrabold text-[#1c2b21]">{match.product.title}</h2>
                    <p className="line-clamp-2 text-xs font-medium text-[#3d5c46]">
                      {postcardNote(match.product, chosenSeason)}
                    </p>
                    <span className="text-sm font-extrabold text-green-800">{Math.round(match.product.price)} Kč</span>
                    <Link
                      to={productPath(match.product.slug)}
                      onClick={() => onResultClick(match.product.slug, i + 2)}
                      className="mt-1.5 block text-center text-sm font-bold text-green-800 underline underline-offset-2"
                    >
                      Zobrazit itinerář
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!resultSet.backfilled && <CustomItineraryNote onCustomClick={onCustomClick} />}
        </>
      )}

      <div className="mt-7 text-center">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-lg border-2 border-white/55 bg-white/10 px-5 py-2.5 text-sm font-bold text-white"
        >
          ↻ Zkusit znovu
        </button>
      </div>
    </div>
  );
};

export default QuizResults;
