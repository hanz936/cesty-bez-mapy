// src/pages/Privacy.jsx
import Layout from '../components/layout/Layout';

// PrivacyContent is exported separately so it can be unit-tested without Layout.
// NOTE: Legal wording (controller identity, IČO, address) is a placeholder — to be
// completed/approved by the site owner (Jana), see [PLACEHOLDER] markers.
export function PrivacyContent() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose">
      <h1 className="text-3xl sm:text-4xl font-bold text-black mb-6">
        Ochrana osobních údajů
      </h1>

      <p className="text-gray-700">
        Tyto zásady popisují, jaké údaje zpracováváme, proč a s kým je sdílíme.
        Náš web používá <strong>cookieless</strong> (anonymní) analytiku, nepoužíváme
        reklamní cookies, a proto na webu <strong>není potřeba souhlasná cookie lišta</strong>.
      </p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Správce údajů</h2>
      <p className="text-gray-700">
        [PLACEHOLDER — doplní Jana: jméno/firma, IČO, sídlo, kontaktní e-mail.]
        Kontakt: cestybezmapy@gmail.com.
      </p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Úložiště v prohlížeči</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Klíč</th><th className="py-2 pr-4">Účel</th><th className="py-2">Kategorie</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b"><td className="py-2 pr-4">cbm_cart</td><td className="py-2 pr-4">obsah košíku</td><td className="py-2">nezbytné</td></tr>
          <tr className="border-b"><td className="py-2 pr-4">Supabase auth (sb-…-auth-token)</td><td className="py-2 pr-4">anonymní přihlášení k objednávce/formulářům</td><td className="py-2">nezbytné</td></tr>
        </tbody>
      </table>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Služby třetích stran</h2>
      <p className="text-gray-700">
        Při některých akcích se načítají služby třetích stran, které mohou na svých
        doménách použít nezbytné cookies:
      </p>
      <ul className="text-gray-700">
        <li><strong>Stripe</strong> — platba (hostovaná platební brána).</li>
        <li><strong>Cloudflare Turnstile</strong> — ochrana formulářů proti spamu (bezpečnostní).</li>
        <li><strong>YouTube</strong> (režim bez cookies) — videa v blogu; cookies až po přehrání.</li>
      </ul>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Analytika</h2>
      <p className="text-gray-700">
        <strong>Umami</strong> (server v EU) — anonymní statistika návštěvnosti.
        Bez cookies, bez osobních údajů, neidentifikuje jednotlivce.
      </p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Zpracovatelé a lokace dat</h2>
      <p className="text-gray-700">
        V EU: Supabase (Frankfurt), Sentry (EU), náš analytický nástroj (EU), Ecomail (ČR), Fakturoid (ČR).
        Mimo EU (USA, zajištěno SCC/Data Privacy Framework): Stripe, YouTube, Resend.
      </p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Vaše práva</h2>
      <p className="text-gray-700">
        Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost a vznesení
        námitky. Žádosti směřujte na cestybezmapy@gmail.com. Můžete také podat stížnost
        u <a href="https://uoou.gov.cz" target="_blank" rel="noopener noreferrer">Úřadu pro ochranu osobních údajů (ÚOOÚ)</a>.
      </p>

      <p className="text-sm text-gray-500 mt-10">Účinnost: [PLACEHOLDER — datum].</p>
    </main>
  );
}

const Privacy = () => (
  <Layout>
    <PrivacyContent />
  </Layout>
);

Privacy.displayName = 'Privacy';

export default Privacy;
