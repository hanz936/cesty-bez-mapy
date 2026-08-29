import Layout from '../components/layout/Layout';
import SeoTags from '../components/common/SeoTags';
import { buildPageMeta } from '../utils/pageSeo';
import { ROUTES } from '../constants';
import { REVIEWS_DISCLOSURE } from '../components/reviews/disclosure';

/**
 * Povinná informace dle § 5a odst. 5 zákona č. 634/1992 Sb. — zda a JAK recenze
 * ověřujeme. Stojí na samostatné stránce, na kterou vede odkaz z patičky:
 * rozhodnutí usera 2026-08-29, po průzkumu české praxe (samostatná stránka
 * „Ověřování recenzí" + odkaz v patičce je vzor, který má Shoptet i desítky
 * e-shopů). ČOI přitom doporučuje informaci uvést přímo u recenzí, popř. na ni
 * odtud odkázat — patička je proto rozšířený, ale měkčí výklad; zaznamenáno.
 *
 * Obsah popisuje SKUTEČNÝ mechanismus (viz migrace 20260711130000): jeden token
 * na zaplacenou objednávku, e-mail +21 dní po platbě, platnost 12 měsíců,
 * refund token ruší. Kdyby se mechanismus změnil, musí se změnit i tenhle text.
 * Finální znění schvaluje Jana.
 */
export function ReviewsVerificationContent() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold text-black mb-6">Jak ověřujeme recenze</h1>

      <p className="text-lg text-gray-700 mb-10">{REVIEWS_DISCLOSURE}</p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Kdo může recenzi napsat</h2>
      <p className="text-gray-700 mb-4">
        Odkaz na napsání recenze posíláme e-mailem, a to jen na adresu z dokončené objednávky.
        Chodí 21 dní po zaplacení, aby byl čas průvodce opravdu použít, a platí 12 měsíců.
      </p>
      <p className="text-gray-700 mb-4">
        Bez toho odkazu recenzi vložit nejde — na webu není žádný veřejný formulář, do kterého
        by mohl napsat kdokoli. Když je objednávka vrácená, odkaz přestane platit.
      </p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Co s recenzí děláme, než ji zveřejníme</h2>
      <p className="text-gray-700 mb-4">
        Každou recenzi si před zveřejněním přečteme. Kontrolujeme jen spam a vulgarity —
        hodnocení ani text neupravujeme a kritickou recenzi nesmažeme.
      </p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Označení u recenzí</h2>
      <p className="text-gray-700 mb-4">
        Protože takhle vzniká každá zveřejněná recenze, uvidíš u všech odznak
        „Ověřeno nákupem“.
      </p>

      <p className="text-sm text-gray-500 mt-10">
        Tuto informaci uvádíme podle § 5a odst. 5 zákona č. 634/1992 Sb., o ochraně spotřebitele.
      </p>
    </div>
  );
}

const ReviewsVerification = () => (
  <Layout ready>
    <SeoTags meta={buildPageMeta(ROUTES.REVIEWS_VERIFICATION)} />
    <ReviewsVerificationContent />
  </Layout>
);

ReviewsVerification.displayName = 'ReviewsVerification';

export default ReviewsVerification;
