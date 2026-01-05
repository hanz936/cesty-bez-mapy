# 🗺️ ROADMAP - Cesty bez mapy (Full Launch MVP)

**Verze:** 3.5
**Vytvořeno:** 2025-10-30
**Aktualizováno:** 2025-12-22 (přidána FÁZE 2.5: Dynamické produkty + Review systém)
**Pro:** Jana (majitelka) + vývojář (part-time)
**Cíl:** Funkční eshop s blogem, admin panelem, automatickým dodáním PDF

---

## 📊 PROGRESS TRACKING

**Aktuální stav:** FÁZE 2.5 → Dokončení produktového systému

| Fáze | Status | Dokončeno | Poznámky |
|------|--------|-----------|----------|
| **FÁZE 1:** Supabase Setup & Database | ✅ HOTOVO | 100% | Database, RLS, Storage buckets, Auth |
| **FÁZE 2:** Admin Panel - Produkty | ✅ HOTOVO | 95% | CRUD, Upload, Blog, 100% CZ lokalizace, B&W theme |
| **FÁZE 2.5:** Dynamické produkty + Review systém | 🔄 PROBÍHÁ | 0% | **← TEĎKA PRACUJEME** |
| **FÁZE 3:** Stripe + Auto Delivery | ⏸️ ČEKÁ | 0% | Po FÁZI 2.5 |
| **FÁZE 4:** Blog Systém + Admin | ⏳ ČÁSTEČNĚ | 50% | Admin hotov, Frontend chybí |
| **FÁZE 5:** Kvíz Systém | ⏳ ČÁSTEČNĚ | 30% | Možná už existuje na webu |
| **FÁZE 6:** SEO, Analytics & Polish | ⏸️ ČEKÁ | 0% | Po FÁZI 3 |
| **FÁZE 7:** Ecomail + Facturoid | ⏸️ ČEKÁ | 0% | Za ~8 týdnů |
| **FÁZE 8:** Testing, Legal & Launch | ⏸️ ČEKÁ | 0% | Finální fáze |

### ⚠️ Zbývající práce (TODO)

#### FÁZE 2: Co ještě chybí (5%)
**Product template komponenta + Dynamické načítání ze Supabase**
- **Problém:** TravelGuides.jsx má hardcoded produkty (řádek 10-150)
- **Co udělat:**
  1. Vytvořit reusable `<ProductCard />` komponentu
  2. Vytvořit `<ProductDetail />` template komponentu
  3. Připojit TravelGuides.jsx k Supabase (useEffect + fetch)
  4. Nahradit `ALL_ITINERARIES` dynamickým načítáním:
     ```jsx
     const [products, setProducts] = useState([]);
     useEffect(() => {
       // Fetch from Supabase: products table
       // Filter: is_active = true, is_deleted = false
       // Order by: created_at DESC
     }, []);
     ```
  5. Vytvořit dynamickou product detail page (`/produkty/[slug]`)
- **Časový odhad:** 3-4 hodiny
- **Priorita:** 🟡 Nízká - můžeme dokončit později (po FÁZI 3 nebo 4)

#### FÁZE 4: Co ještě chybí (50%)
**Blog Frontend**
- Blog List view (`/blog` nebo `/inspirace`)
- Blog Detail view (`/blog/[slug]`)
- Vyhledávání v blogu
- Newsletter signup integrace (Ecomail)
- **Časový odhad:** 6-8 hodin
- **Priorita:** 🟡 Střední - můžeme přeskočit a vrátit se po FÁZI 5

#### FÁZE 5: Co ještě chybí (70%)
**Kvíz Systém**
- Vyhodnocovací stránka (`/kviz/vysledky`)
- Matching algoritmus (utils/quizMatcher.js)
- Admin panel - kvíz metadata editor
- **Časový odhad:** 3-4 hodiny
- **Priorita:** 🟡 Nízká - není kritické pro MVP

---

### Dashboard Vylepšení - Strategie C
**Kdy:** Po dokončení FÁZE 3 (Stripe integrace)
**Čas:** 12-15 hodin (1 velký update)
**Co zahrnuje:**
- Custom itineráře, Produkty, Blog KPI karty
- Grafy (MonthlyRevenue, OrderChart, TopProducts)
- Comparisons (% změny oproti minulému měsíci)
- PendingOrders seznam
- Responsivní layout (Grid)
- Welcome sekce s personalizací

**DŮVOD:** Grafy budou mít reálná data ze Stripe, má smysl udělat vše najednou.

---

## 🔧 TECHNICKÁ VYLEPŠENÍ & TECH DEBT

*Poznámky z code review (2025-12-22)*

Tato sekce obsahuje doporučení pro zlepšení kvality kódu, výkonu a udržovatelnosti projektu.
Nejsou kritické pro MVP, ale měly by být adresovány postupně.

### 🔴 KRITICKÉ (před launchem)

**1. Dynamické načítání produktů (FÁZE 2 - 5% chybí)**
- ✅ Již zaznamenáno výše v TODO sekci

### 🟡 VYSOKÁ PRIORITA (po FÁZI 3)

**2. TypeScript migrace (Frontend)**
- **Problém:** Frontend je JavaScript, admin je TypeScript - nekonzistence
- **Řešení:** Postupná migrace .jsx → .tsx
- **Benefit:** Type safety, méně runtime bugů, lepší DX
- **Časový odhad:** 8-12 hodin (postupně)
- **Kdy:** Po FÁZI 6, nebo průběžně

**3. Testing setup**
- **Problém:** Žádné unit/integration/E2E testy
- **Řešení:**
  - Unit tests: Vitest + React Testing Library
  - E2E tests: Playwright pro critical paths (checkout, PDF delivery)
- **Časový odhad:** 10-15 hodin (initial setup + kritické testy)
- **Kdy:** FÁZE 8 nebo průběžně
- **Priorita:** Vyšší pro produkci s real payments

### 🟢 STŘEDNÍ PRIORITA (post-launch optimalizace)

**4. Performance optimalizace**
- **Co udělat:**
  - React.lazy() pro route-based code splitting
  - Suspense boundaries
  - Image optimization (WebP format, responsive images)
  - Lazy loading pro images (už máš ImageWithFallback, rozšířit)
- **Časový odhad:** 4-6 hodin
- **Kdy:** Po FÁZI 6, během "Polish"
- **Benefit:** Lepší Lighthouse score, rychlejší načítání

**5. SEO vylepšení (rozšíření FÁZE 6)**
- **Co chybí:**
  - Meta tagy (description, OG, Twitter cards) - už plánováno v FÁZI 6
  - Sitemap.xml - už plánováno
  - React Helmet Async - už plánováno
- **Extra doporučení:**
  - Structured data (JSON-LD) pro produkty
  - Breadcrumbs schema
- **Časový odhad:** +2-3 hodiny k FÁZI 6
- **Kdy:** FÁZE 6

**6. Analytics implementace**
- **Problém:** Plausible je v plánu (FÁZE 6), ale není implementován
- **Doporučení:** Nainstalovat TEĎKA, data jsou cenná od začátku
- **Časový odhad:** 30 minut
- **Kdy:** IHNED nebo s FÁZE 3
- **Benefit:** Sledování conversion rate, user behavior od začátku

### ⚪ NÍZKÁ PRIORITA (nice-to-have)

**7. Error monitoring**
- **Doporučení:** Sentry nebo podobný nástroj
- **Benefit:** Automatické zachycení runtime errors v produkci
- **Časový odhad:** 2 hodiny
- **Kdy:** Po soft launch
- **Náklady:** FREE tier existuje

**8. Code quality improvements**
- **Co sledovat:**
  - Některé komponenty používají `any` nebo nespecifikované typy (pokud budete migrovat na TS)
  - ESLint warnings (pokud nějaké jsou)
  - Duplicitní kód (DRY principle)
- **Kdy:** Průběžně během dalšího vývoje
- **Benefit:** Lepší maintainability

---

## 📋 SHRNUTÍ PROJEKTU

**Co vytváříme:**
- ✅ Funkční eshop s ~15 cestovními průvodci (PDF produkty)
- ✅ Custom itineráře na míru (formulář → platba → konzultace → PDF)
- ✅ Kvíz systém pro doporučení vhodných produktů
- ✅ Blog s vyhledáváním a newsletter signup
- ✅ Admin panel pro Janu (produkty, články, obrázky)
- ✅ Automatické dodání PDF po platbě
- ✅ Platby přes Stripe
- ✅ GDPR-friendly analytics (Plausible)
- ✅ **Automatická integrace Ecomail + Facturoid**

---

## 🛠️ TECH STACK

**Frontend:**
- React 19.1.0 + Vite 7.0.6 + Tailwind CSS 4.1.11 (✅ už máš)
- React Router 7.7.1 (✅ už máš)
- React Helmet Async (➕ SEO)
- React Hook Form (➕ admin formuláře)

**Backend:**
- Supabase (Database + Storage + Auth + Edge Functions)
- Supabase RLS (Row Level Security)

**Služby:**
- Stripe (platební brána)
- Resend (transactional emails) nebo Ecomail API
- Ecomail (marketing + newsletter)
- Plausible Analytics (220 Kč/měsíc)
- Facturoid (fakturace, 219 Kč/měsíc)

**Hosting:**
- Vercel (FREE tier → PRO při růstu)
- Custom domain: **cestybezmapy.cz**

---

## 💰 NÁKLADY

**Start (měsíc 1-6):**
```
Vercel: 0 Kč
Supabase: 0 Kč
Resend: 0 Kč
Stripe: 0 Kč (jen % z prodejů: 1.5% + 3 Kč/transakce)
Plausible: 220 Kč
Ecomail: 249 Kč
Facturoid: 219 Kč
────────────────
CELKEM: 688 Kč/měsíc
```

**Po růstu (50k+ visitors/měsíc):**
```
Vercel PRO: 500 Kč
Supabase PRO: 620 Kč
Resend: ~200 Kč
Plausible: 220-440 Kč
Ecomail Marketer+: 549 Kč
Facturoid: 219 Kč
+ Stripe fees (~1.5% z obratu)
────────────────
CELKEM: ~2 300 Kč/měsíc + Stripe fees
```

---

## ⏰ ČASOVÝ PLÁN (Part-time: 10-15h/týden)

**CELKEM: 11-12 týdnů (2.5-3 měsíce)**

---

## 📅 FÁZE 1: Supabase Setup & Database ✅ DOKONČENO

### Tasky:
1. **Supabase projekt setup**
   - Vytvoř nový Supabase projekt
   - Nastav Environment variables (.env.local)
   - Test connection z React app

2. **Database schema design & implementace**
   ```sql
   Tables (11 total):

   Core:
   - customers (id, email, name, phone, ecomail_subscriber_id, total_spent, last_purchase_at)
   - categories (id, name, slug, description, parent_id)
   - products (id, title, description, price, pdf_url, image_url, slug, seo_*, vat_rate,
              quiz_data, is_active, is_deleted, deleted_at)
   - product_categories (product_id, category_id) -- many-to-many

   E-commerce:
   - orders (id, customer_id, customer_email, customer_name, total_amount, currency,
            stripe_payment_id, status, facturoid_invoice_id, facturoid_invoice_number,
            invoice_sent, ecomail_synced)
   - order_items (id, order_id, product_id, quantity, price_at_purchase, vat_rate_at_purchase)
   - download_tokens (id, order_id, token, expires_at)

   Content & Services:
   - blog_posts (id, title, content, excerpt, image_url, slug, seo_*, published_at)
   - custom_itinerary_requests (id, customer_id, customer_email, customer_name, form_data,
                                status, consultation_notes)

   Compliance & Logging:
   - newsletter_consent_log (id, email, consent_given, source, ip_address, user_agent,
                            privacy_policy_version) -- GDPR audit trail
   - integration_logs (id, service, action, status, error_message, metadata)

   Key improvements from original:
   ✅ Normalized customer data (customers table)
   ✅ Multi-item orders support (order_items with price_at_purchase)
   ✅ Category system for filtering & SEO
   ✅ Product soft delete (is_active, is_deleted)
   ✅ GDPR-compliant consent tracking (newsletter_consent_log)
   ```

3. **Row Level Security (RLS) policies**
   - Public read pro products a blog_posts
   - Admin only write
   - Secure download tokens

4. **Supabase Storage buckets**
   - `products-pdfs` (private)
   - `products-images` (public)
   - `blog-images` (public)

5. **Admin Auth setup**
   - Vytvoř 2 admin účty (ty + Jana)
   - Nastav role: super-admin, admin

**Časový odhad:** 12-15 hodin
**Měřítko úspěchu:** ✅ Database ready, ✅ Můžeš se připojit z React app, ✅ Auth funguje

---

## 📅 FÁZE 2: Admin Panel - Produkty ✅ DOKONČENO

### Tasky:
1. **Admin layout & routing**
   - `/admin` route (protected)
   - Admin dashboard layout
   - Navigation (Produkty, Blog, Objednávky)

2. **Produkty - List view**
   ```jsx
   /admin/produkty
   - Tabulka s produkty
   - Tlačítko "Přidat produkt"
   - Edit/Delete akce
   - Vyhledávání/filtrování
   ```

3. **Produkty - Add/Edit formulář**
   ```jsx
   Fields:
   - Název produktu
   - Popis (textarea)
   - Cena (Kč)
   - Délka trvání
   - Kategorie (dropdown)
   - Badge (volitelné)
   - Upload PDF souboru
   - Upload obrázku náhledu

   SEO:
   - SEO Title
   - SEO Description
   - SEO Keywords
   - Slug (auto-generate z názvu)

   [Uložit] [Náhled] [Zrušit]
   ```

4. **Image upload komponenta**
   - Drag & drop nebo browse
   - Preview před uploadem
   - Upload do Supabase Storage
   - Validace (formát, velikost)

5. **PDF upload komponenta**
   - Browse soubor
   - Progress bar
   - Upload do Supabase Storage (private bucket)
   - Validace (jen PDF, max 200 MB)

6. **Product template komponenta**
   ```jsx
   <ProductDetailTemplate
     title={title}
     description={description}
     price={price}
     highlights={highlights}
     // atd.
   />
   ```

7. **Delete funkcionalita**
   - Soft delete (flag `is_deleted`)
   - Confirm dialog
   - Možnost "Schovat" místo smazat

**Časový odhad:** 20-25 hodin
**Měřítko úspěchu:** ✅ Jana může přidat/editovat/smazat produkty, ✅ Upload funguje, ✅ Produkty se zobrazují na webu

---

## 📅 FÁZE 2.5: Dynamické produkty + Review systém 🔄 PROBÍHÁ (2 týdny)

**Důvod této fáze:**
- Dokončit FÁZI 2 (dynamické načítání produktů místo hardcoded dat)
- Přidat review systém (social proof je kritický pro konverzi)
- Review systém MUSÍ být před Stripe - zákazníci chtějí vidět recenze před nákupem

### Tasky:

#### **A. Dynamické načítání produktů (KRITICKÉ)**

1. **Nahradit hardcoded ALL_ITINERARIES v TravelGuides.jsx**
   ```jsx
   // Současný stav: Hardcoded array (řádek 9-108)
   const ALL_ITINERARIES = [...]

   // Nový stav: Dynamické načítání ze Supabase
   const [products, setProducts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState(null);

   useEffect(() => {
     async function fetchProducts() {
       const { data, error } = await supabase
         .from('products')
         .select('*')
         .eq('is_active', true)
         .eq('is_deleted', false)
         .order('created_at', { ascending: false });

       if (error) setError(error);
       else setProducts(data);
       setLoading(false);
     }
     fetchProducts();
   }, []);
   ```

2. **Mapování databázové struktury na GuideCard props**
   - `guide.price` → formátovat jako "XXX Kč" z `product.price`
   - `guide.image` → `product.image_url`
   - `guide.alt` → generovat z `product.title` ("Průvodce: {title}")
   - `guide.badge` → `product.badge`
   - `guide.isFree` → `product.price === 0`
   - `guide.rating` → `product.average_rating` (po implementaci reviews)
   - `guide.review_count` → `product.review_count` (po implementaci reviews)

3. **Loading & Error states**
   - Loading spinner při načítání
   - Error message pokud fetch selže
   - Empty state pokud žádné produkty

**Časový odhad:** 2-3 hodiny

---

#### **B. Review systém - Databáze & Backend**

1. **Database migration: reviews tabulka**
   ```sql
   CREATE TABLE reviews (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     product_id UUID REFERENCES products(id) ON DELETE CASCADE,
     customer_id UUID REFERENCES customers(id),
     order_id UUID REFERENCES orders(id),           -- Verified purchase

     rating INTEGER CHECK (rating >= 1 AND rating <= 5),
     title VARCHAR(200),
     comment TEXT,

     is_verified_purchase BOOLEAN DEFAULT false,
     is_approved BOOLEAN DEFAULT false,             -- Jana schválí
     admin_notes TEXT,

     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Přidat do products tabulky
   ALTER TABLE products
     ADD COLUMN average_rating NUMERIC(3,2) DEFAULT 0.00,
     ADD COLUMN review_count INTEGER DEFAULT 0;
   ```

2. **PostgreSQL Trigger pro automatický přepočet ratingu**
   ```sql
   -- Row-level trigger pro simple operace
   CREATE OR REPLACE FUNCTION update_product_rating()
   RETURNS TRIGGER AS $$
   BEGIN
     UPDATE products
     SET
       average_rating = (
         SELECT COALESCE(AVG(rating), 0)
         FROM reviews
         WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
           AND is_approved = true
       ),
       review_count = (
         SELECT COUNT(*)
         FROM reviews
         WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
           AND is_approved = true
       )
     WHERE id = COALESCE(NEW.product_id, OLD.product_id);

     RETURN COALESCE(NEW, OLD);
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER recalculate_rating_after_review
     AFTER INSERT OR UPDATE OR DELETE ON reviews
     FOR EACH ROW
     EXECUTE FUNCTION update_product_rating();
   ```

3. **Performance indexy**
   ```sql
   -- Partial index pro completed orders (RLS performance)
   CREATE INDEX idx_orders_customer_completed
     ON orders(customer_id)
     WHERE status = 'completed';

   -- Index pro rychlé vyhledávání recenzí
   CREATE INDEX idx_reviews_product_approved
     ON reviews(product_id, is_approved);

   -- Partial unique index - max 1 schválená recenze per product per customer
   CREATE UNIQUE INDEX idx_one_approved_review_per_product_customer
     ON reviews(product_id, customer_id)
     WHERE is_approved = true;
   ```

4. **RLS Policies (optimalizované)**
   ```sql
   -- Public může vidět jen schválené recenze
   CREATE POLICY "Public can view approved reviews"
     ON reviews FOR SELECT
     USING (is_approved = true);

   -- Admin vidí všechny
   CREATE POLICY "Admin can manage reviews"
     ON reviews FOR ALL
     USING (auth.jwt() ->> 'role' = 'admin');

   -- Zákazníci mohou vytvořit recenzi (jen pokud koupili)
   -- OPTIMALIZOVÁNO: Vyhnout se korelovanému subquery
   CREATE POLICY "Customers can create reviews for purchased products"
     ON reviews FOR INSERT
     WITH CHECK (
       product_id = ANY (
         SELECT oi.product_id
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.customer_id = auth.uid()
           AND o.status = 'completed'
       )
     );
   ```

**Časový odhad:** 3-5 hodin

---

#### **C. Review systém - Admin Panel**

1. **ReviewList.tsx - Seznam recenzí**
   ```jsx
   // cesty-bez-mapy-admin/src/resources/reviews/ReviewList.tsx

   export const ReviewList = () => (
     <List
       filters={reviewFilters}
       sort={{ field: 'created_at', order: 'DESC' }}
     >
       <Datagrid bulkActionButtons={<BulkApproveButton />}>
         <TextField source="id" />
         <ReferenceField source="product_id" reference="products">
           <TextField source="title" />
         </ReferenceField>
         <ReferenceField source="customer_id" reference="customers">
           <TextField source="name" />
         </ReferenceField>
         <NumberField source="rating" />
         <TextField source="title" />
         <BooleanField source="is_approved" />
         <BooleanField source="is_verified_purchase" />
         <DateField source="created_at" />
         <EditButton />
       </Datagrid>
     </List>
   );

   const reviewFilters = [
     <BooleanInput source="is_approved" alwaysOn />,
     <ReferenceInput source="product_id" reference="products" />,
     <NumberInput source="rating" />
   ];
   ```

2. **ReviewEdit.tsx - Detail & Approve**
   ```jsx
   export const ReviewEdit = () => {
     const notify = useNotify();

     const handleApprove = async (id) => {
       await dataProvider.update('reviews', {
         id,
         data: { is_approved: true }
       });
       notify('Recenze schválena!', { type: 'success' });
     };

     return (
       <Edit>
         <SimpleForm>
           <TextInput source="title" disabled />
           <TextInput source="comment" multiline disabled />
           <NumberInput source="rating" disabled />
           <BooleanInput source="is_verified_purchase" disabled />
           <BooleanInput source="is_approved" />
           <TextInput source="admin_notes" multiline />

           <Toolbar>
             <SaveButton />
             <Button label="Schválit" onClick={() => handleApprove(record.id)} />
           </Toolbar>
         </SimpleForm>
       </Edit>
     );
   };
   ```

3. **Přidat do App.tsx**
   ```jsx
   <Resource
     name="reviews"
     list={ReviewList}
     edit={ReviewEdit}
     icon={ReviewIcon}
   />
   ```

**Časový odhad:** 4-6 hodin

---

#### **D. Review systém - Frontend Display**

1. **ReviewsSection komponenta pro product detail**
   ```jsx
   // src/components/reviews/ReviewsSection.jsx

   export const ReviewsSection = ({ productId }) => {
     const [reviews, setReviews] = useState([]);
     const [avgRating, setAvgRating] = useState(0);
     const [reviewCount, setReviewCount] = useState(0);

     useEffect(() => {
       async function fetchReviews() {
         // Fetch product rating
         const { data: product } = await supabase
           .from('products')
           .select('average_rating, review_count')
           .eq('id', productId)
           .single();

         setAvgRating(product.average_rating);
         setReviewCount(product.review_count);

         // Fetch approved reviews
         const { data: reviewsData } = await supabase
           .from('reviews')
           .select('*, customers(name)')
           .eq('product_id', productId)
           .eq('is_approved', true)
           .order('created_at', { ascending: false });

         setReviews(reviewsData);
       }

       fetchReviews();
     }, [productId]);

     return (
       <section className="my-12">
         <AverageRating rating={avgRating} count={reviewCount} />
         <ReviewsList reviews={reviews} />
       </section>
     );
   };
   ```

2. **React 19 useOptimistic hook (pro budoucí WriteReviewForm)**
   ```jsx
   import { useOptimistic } from 'react';

   const [optimisticReviews, addOptimisticReview] = useOptimistic(
     reviews,
     (state, newReview) => [...state, { ...newReview, status: 'pending' }]
   );
   ```

3. **Zobrazení v TravelGuides.jsx (GuideCard)**
   ```jsx
   // Přidat do GuideCard:
   <div className="flex items-center gap-2">
     <span className="text-sm font-medium">
       {guide.average_rating?.toFixed(1) || '5.0'}
     </span>
     <div className="flex">
       {[1,2,3,4,5].map(star => (
         <StarIcon key={star} filled={star <= (guide.average_rating || 5)} />
       ))}
     </div>
     <span className="text-xs text-gray-500">
       ({guide.review_count || 0})
     </span>
   </div>
   ```

4. **Přidat na product detail pages**
   - ItalyRoadtripDetail.jsx
   - (Další product detail pages až budou vytvořeny)

**Časový odhad:** 5-7 hodin

---

### **E. Testing & Dokumentace**

1. **Manual testing checklist**
   - [ ] Produkty se načítají ze Supabase dynamicky
   - [ ] Loading state se zobrazuje správně
   - [ ] Error handling funguje
   - [ ] Jana může přidat recenzi v admin panelu
   - [ ] Jana může schválit/zamítnout recenzi
   - [ ] Trigger přepočítá average_rating automaticky
   - [ ] Frontend zobrazuje recenze správně
   - [ ] RLS policy blokuje neoprávněné akce

2. **Dokumentace pro Janu**
   - Návod: Jak schválit recenzi
   - Návod: Co dělat s fake/spam recenzemi
   - Návod: Jak přidat testovací recenzi

**Časový odhad:** 2-3 hodiny

---

### **📊 Celkový časový odhad FÁZE 2.5**

| Část | Odhad |
|------|-------|
| A. Dynamické produkty | 2-3h |
| B. Review DB & Backend | 3-5h |
| C. Review Admin Panel | 4-6h |
| D. Review Frontend | 5-7h |
| E. Testing & Docs | 2-3h |
| **CELKEM** | **16-24 hodin** |

**Realistický odhad:** 2-3 týdny při 10-15h/týden

---

### **🎯 Měřítko úspěchu FÁZE 2.5**

✅ **Produkty:**
- TravelGuides.jsx načítá produkty ze Supabase
- Jana přidá nový produkt v adminu → zobrazí se na webu automaticky
- Loading a error states fungují

✅ **Reviews:**
- Jana může přidávat testovací recenze v admin panelu
- Jana může schvalovat/zamítat recenze
- Average rating se přepočítá automaticky (trigger)
- Frontend zobrazuje hvězdičky + recenze na product detail
- RLS policies chrání před neoprávněným přístupem

✅ **Performance:**
- Partial indexy fungují (rychlý fetch)
- RLS policies optimalizované (bez slow JOINů)

---

**POZNÁMKA:** WriteReviewForm pro zákazníky (front-end psaní recenzí) je **OPTIONAL** pro tuto fázi. Můžeme to přidat později po FÁZI 3 (Stripe), když budeme mít auth systém pro zákazníky. Zatím Jana může přidávat testovací recenze ručně.

---

## 📅 FÁZE 3: Stripe Integrace + Auto Delivery ⏸️ ČEKÁ (2 týdny)

### Tasky:
1. **Stripe account setup**
   - Vytvoř Stripe account
   - Nastav API keys (test mode)
   - Webhook endpoint konfigurace

2. **Stripe Checkout integrace**
   ```jsx
   /cestovni-pruvodci/[slug]
   [Koupit za 699 Kč] →
     Stripe Checkout Session →
     Success → /objednavka/potvrzeni?session_id=...
   ```

3. **Supabase Edge Function: Stripe Webhook**
   ```typescript
   // functions/stripe-webhook/index.ts

   Event: checkout.session.completed
   →  Vytvoř order v DB
   →  Vygeneruj download_token
   →  Pošli email s download linkem
   ```

4. **Download endpoint**
   ```
   /api/download/[token]
   → Validuj token
   → Vrat PDF ze Supabase Storage
   → Neomezený přístup (no expiry)
   ```

5. **Email templates (Resend/Ecomail)**
   - Template: Order confirmation + download link
   - Template: Custom itinerary purchase + konzultace info
   - Template: Admin notification (nová objednávka)

6. **Order confirmation page**
   ```
   /objednavka/potvrzeni
   - Děkujeme za nákup
   - Email s download linkem byl odeslán
   - Odkaz na stažení (rovnou)
   - Faktura (Facturoid integrace optional)
   ```

7. **Custom itineráře workflow**
   ```
   Formulář → Stripe checkout (999 Kč) →
   Email Janě (+ formdata) →
   Email zákazníkovi (potvrzení + info o konzultaci) →
   Jana vytvoří PDF v adminu →
   Jana klikne "Odeslat" → Auto email s PDF
   ```

8. **Admin: Objednávky view**
   ```jsx
   /admin/objednavky
   - Seznam objednávek
   - Status (paid, delivered, custom_pending)
   - Pro custom: tlačítko "Upload PDF & Send"
   ```

**Časový odhad:** 20-25 hodin
**Měřítko úspěchu:** ✅ Platba funguje, ✅ Email se odesílá automaticky, ✅ PDF download funguje, ✅ Custom workflow hotový

---

## 📅 FÁZE 4: Blog Systém + Admin (1.5 týdne)

### Tasky:
1. **Blog - List view (frontend)**
   ```jsx
   /blog nebo /inspirace
   - Grid článků (3 sloupce)
   - Náhled obrázku, nadpis, perex
   - Vyhledávání (search bar)
   - Kategorie filter
   ```

2. **Blog - Detail view (frontend)**
   ```jsx
   /blog/[slug]
   - Hero obrázek
   - Nadpis, datum, autor
   - Obsah (markdown nebo plain text)
   - Newsletter signup form (Ecomail)
   - Related articles
   ```

3. **Blog article template komponenta**
   ```jsx
   <BlogArticleTemplate
     title={title}
     content={content}
     image={image}
     author="Jana"
     publishedAt={date}
   />
   ```

4. **Admin: Blog - List view**
   ```jsx
   /admin/blog
   - Tabulka článků
   - "Přidat článek"
   - Edit/Delete
   - Vyhledávání
   ```

5. **Admin: Blog - Add/Edit formulář**
   ```jsx
   Fields:
   - Nadpis
   - Perex (krátký popis, 2-3 věty)
   - Obsah (textarea, plain text)
   - Upload obrázku
   - Kategorie (dropdown)

   SEO:
   - SEO Title
   - SEO Description
   - SEO Keywords
   - Slug

   ☑ Zobrazit newsletter signup

   [Publikovat] [Uložit koncept] [Náhled]
   ```

6. **Vyhledávání v blogu**
   - Full-text search v nadpisech a obsahu
   - Supabase text search nebo client-side filter

7. **Newsletter signup integrace**
   - Ecomail API or embeded form
   - GDPR consent checkbox
   - Potvrzovací email

**Časový odhad:** 15-18 hodin
**Měřítko úspěchu:** ✅ Jana může psát články, ✅ Blog funguje na frontendu, ✅ Vyhledávání funguje, ✅ Newsletter signup funguje

---

## 📅 FÁZE 5: Kvíz Systém (0.5 týdne)

### Tasky:

1. **Analýza existujícího kvízu**
   - Zkontroluj stávající kvíz kód
   - Definuj strukturu userAnswers
   - Navrhni quiz_data schema pro produkty

2. **Database - kvíz metadata pro produkty**
   - Už připraveno v FÁZI 1: products.quiz_data (JSONB)
   - Optional: quiz_submissions table pro analytics

3. **Admin panel - kvíz metadata editor**
   - Formulář v /admin/produkty/[id]/edit
   - Nastavení matching kritérií pro produkt
   - Preview/test tlačítko

4. **Vyhodnocovací stránka**
   ```jsx
   /kviz/vysledky (nebo /najdi-pruvodce/vysledky)

   - Přijmi userAnswers z kvízu
   - Matching algoritmus (podle tvé logiky)
   - Zobraz TOP 3 doporučené produkty
   - Rank + % shoda zobrazení
   - Fallback na Custom itinerář
   ```

5. **Matching algoritmus**
   - utils/quizMatcher.js
   - Funkce pro výpočet skóre
   - Seřazení produktů podle relevance
   - Exclusions handling (pokud potřeba)

6. **ProductCard komponenta pro výsledky**
   - Rank badge (1, 2, 3)
   - Match percentage
   - CTA tlačítko "Zobrazit detail"

7. **Testing kvíz flow**
   - Test různé kombinace odpovědí
   - Zkontroluj správné doporučení
   - Edge cases (žádný match → Custom itinerář)

**Časový odhad:** 4-6 hodin
**Měřítko úspěchu:** ✅ Kvíz vyhodnocuje správně, ✅ Doporučuje relevantní produkty, ✅ Fallback funguje

---

## 📅 FÁZE 6: SEO, Analytics & Polish (1 týden)

### Tasky:
1. **React Helmet Async setup**
   ```jsx
   // Každá stránka má:
   <Helmet>
     <title>{seo_title}</title>
     <meta name="description" content={seo_description} />
     <meta name="keywords" content={seo_keywords} />
     <meta property="og:title" content={seo_title} />
     <meta property="og:description" content={seo_description} />
     <meta property="og:image" content={image_url} />
     <meta property="og:url" content={canonical_url} />
   </Helmet>
   ```

2. **Plausible Analytics integrace**
   - Přidej Plausible script do `index.html`
   - Nastav domain v Plausible dashboard
   - Test tracking

3. **Sitemap.xml generování**
   - Automatický sitemap pro produkty a blog
   - Submit do Google Search Console

4. **robots.txt**
   ```
   User-agent: *
   Allow: /
   Disallow: /admin
   Sitemap: https://cestybezmapy.cz/sitemap.xml
   ```

5. **404 stránka vylepšení**
   - Lepší design
   - Navigační odkazy
   - Vyhledávání

6. **Performance optimalizace**
   - Image lazy loading
   - Code splitting
   - Lighthouse audit (cíl: 90+ score)

7. **Accessibility audit**
   - ARIA labels check
   - Keyboard navigation test
   - Screen reader test

8. **Mobile responsiveness test**
   - Test na iOS/Android
   - Opravy layoutu kde potřeba

**Časový odhad:** 10-12 hodin
**Měřítko úspěchu:** ✅ SEO funguje, ✅ Analytics trackuje, ✅ Lighthouse 90+, ✅ Mobile friendly

---

## 📅 FÁZE 7: Automatizace Ecomail + Facturoid (1.5 týdne)

### Tasky:

#### **A. Ecomail Automatizace**

1. **Ecomail API setup**
   - Získej API key z Ecomail účtu
   - Nastav ENV variable: `VITE_ECOMAIL_API_KEY`
   - Vytvoř seznam (list) pro zákazníky v Ecomail
   - Nastav tagy pro segmentaci

2. **Automatické přidávání zákazníků po nákupu**
   ```typescript
   // Supabase Edge Function: stripe-webhook-ecomail

   Po successful payment:
   1. Přidej zákazníka do Ecomail listu
   2. Nastavit tagy:
      - "customer"
      - "product-{product_slug}"
      - "purchased-{date}"
   3. Custom fields:
      - last_purchase_date
      - total_spent
      - product_name
   ```

3. **Segmentace podle produktů**
   - Tag zákazníky podle koupeného produktu
   - Umožní cílené email kampane později
   - Např: zákazníci kteří koupili "Itálie" → pošli tip na "Dolomity"

4. **Welcome email série** (optional pro v2)
   - Automatická welcome série po prvním nákupu
   - Trigger v Ecomail (nastavíš v dashboardu)

5. **Newsletter signup - rozšíření**
   - Už máš základní signup na blogu
   - Přidej source tracking (odkud se přihlásil)
   - Tag podle zájmu (např. "blog-reader", "product-interested")

6. **Admin panel rozšíření**
   ```jsx
   /admin/marketing
   - Počet subscribers v Ecomailu (API call)
   - Poslední kampane
   - Stats (open rate, click rate)
   - Quick link na Ecomail dashboard
   ```

#### **B. Facturoid Automatizace**

1. **Facturoid API setup**
   - Vytvoř API token v Facturoid účtu
   - Nastav ENV variables:
     ```
     VITE_FACTUROID_SLUG=your_account_slug
     VITE_FACTUROID_API_TOKEN=your_token
     ```
   - Test connection

2. **Rozšíření database schema**
   ```sql
   ALTER TABLE orders ADD COLUMN facturoid_invoice_id VARCHAR;
   ALTER TABLE orders ADD COLUMN facturoid_invoice_number VARCHAR;
   ALTER TABLE orders ADD COLUMN invoice_sent BOOLEAN DEFAULT false;

   ALTER TABLE products ADD COLUMN vat_rate INTEGER DEFAULT 21;
   -- nebo 0 pokud nejste plátci DPH
   ```

3. **Automatické generování faktury po platbě**
   ```typescript
   // Supabase Edge Function: stripe-webhook-facturoid

   Po successful payment:
   1. Vytvoř fakturu v Facturoid API
   2. Ulož invoice_id do orders table
   3. Facturoid automaticky pošle fakturu na email

   Invoice data:
   - subject_name: customer name
   - subject_email: customer email
   - lines: [{
       name: product_title,
       quantity: 1,
       unit_price: price,
       vat_rate: product.vat_rate
     }]
   - payment_method: "card"
   - paid_on: current_date (už zaplaceno)
   ```

4. **Faktura s custom itinerářem**
   - Pro custom itineráře (999 Kč):
   - Faktura se vytvoří hned po platbě
   - Jana dostane notifikaci
   - Zákazník dostane fakturu automaticky

5. **Admin panel - fakturace view**
   ```jsx
   /admin/objednavky/[id]
   - Zobrazit Facturoid invoice number
   - Tlačítko "Zobrazit fakturu" (link na Facturoid)
   - Status faktury (paid/unpaid)
   - Možnost ručně vygenerovat fakturu (fallback)
   ```

6. **Email template update**
   ```
   Order confirmation email:

   Děkujeme za nákup!

   📄 Stáhnout průvodce: [Download link]
   🧾 Faktura: Již byla odeslána na váš email
      (nebo připojit PDF faktury přímo)

   ✨ Pro custom itinerář: Konzultace info...
   ```

7. **Sync objednávek do Facturoid**
   - Pro historické objednávky (pokud už nějaké máte)
   - Admin tlačítko: "Sync s Facturoid"
   - Bulk vytvoření faktur

#### **C. Error Handling & Monitoring**

1. **Retry logic pro API selhání**
   ```typescript
   // Pokud Ecomail API selže:
   - Retry 3x s exponential backoff
   - Ulož do error_log table
   - Pošli admin notification
   - Nezablokuj hlavní flow (PDF delivery)

   // Pokud Facturoid API selže:
   - Stejný retry mechanismus
   - Jana dostane email: "Fakturu vytvoř ručně"
   - Order status: "invoice_pending"
   ```

2. **Admin notifikace**
   ```
   Email pro tebe/Janu když:
   - Ecomail API selhalo 3x
   - Facturoid API selhalo 3x
   - Obsahuje order details
   - Návod jak vyřešit ručně
   ```

3. **Admin dashboard - integrace status**
   ```jsx
   /admin/nastaveni/integrace

   ✅ Ecomail: Connected (1,234 subscribers)
   ✅ Facturoid: Connected (Last sync: 2 min ago)
   ✅ Stripe: Connected
   ⚠️ Test Connection buttons
   ```

4. **Logging & debugging**
   - Log všechny API calls do Supabase
   - Table: `integration_logs` (service, action, status, error_message)
   - Pomůže debugovat problémy

#### **D. Testing**

1. **Test Ecomail integrace**
   - Testovací nákup
   - Zkontroluj že zákazník je v Ecomail listu
   - Zkontroluj správné tagy
   - Test newsletter signup z blogu

2. **Test Facturoid integrace**
   - Testovací nákup (Stripe test mode)
   - Zkontroluj že faktura vznikla
   - Zkontroluj email s fakturou
   - Zkontroluj správné DPH

3. **Test error scenarios**
   - Vypni Ecomail API (špatný key)
   - Zkontroluj retry logic
   - Zkontroluj admin notification
   - Zkontroluj že PDF delivery funguje i tak

4. **Load testing** (optional)
   - Simuluj 10 objednávek najednou
   - Zkontroluj že všechny faktury vznikly
   - Zkontroluj že Ecomail neselže

**Časový odhad:** 12-18 hodin
**Měřítko úspěchu:**
- ✅ Každý zákazník automaticky v Ecomail
- ✅ Každá objednávka má fakturu
- ✅ Retry logic funguje při selhání
- ✅ Jana nemusí nic dělat ručně

---

## 📅 FÁZE 8: Testing, Legal & Launch (1 týden)

### Tasky:

#### **A. End-to-End Testing**

1. **Kompletní nákupní flow testing**
   - Test celého procesu od výběru produktu po dodání PDF
   - Ověř všechny kroky: kvíz → produkty → košík → platba → email → download
   - Test na mobilním zařízení i desktopu
   - Test různých produktů (standard PDF + custom itinerář)

2. **Test všech integrací**
   - Stripe test payments → Ecomail → Facturoid → PDF delivery
   - Verify retry logic při selhání
   - Test admin notifikací
   - Newsletter signup z blogu

3. **Cross-browser testing**
   - Chrome, Firefox, Safari, Edge
   - iOS Safari + Android Chrome
   - Responsive design na různých zařízeních

4. **Performance testing**
   - Lighthouse audit (target: 90+)
   - Page load speed < 3s
   - Image optimization check
   - Bundle size analysis

#### **B. Legal & GDPR**

1. **Obchodní podmínky**
   - Vytvoř stránku `/obchodni-podminky`
   - Pokryj: vrácení peněz, reklamace, autorská práva PDF
   - Odkaz v checkoutu + footeru

2. **Zásady ochrany osobních údajů**
   - Vytvoř stránku `/ochrana-udaju`
   - Pokryj: cookies (Plausible), platby (Stripe), Ecomail
   - GDPR compliance
   - Odkaz v footeru

3. **Cookie banner** (optional pro Plausible)
   - Plausible nepotřebuje consent banner (cookieless)
   - Ale můžeš přidat info o Plausible do Privacy Policy

#### **C. Produkční Setup**

1. **Domain setup**
   - Nakonfiguruj cestybezmapy.cz na Vercel
   - Verify DNS propagation
   - SSL certifikát (automatický přes Vercel)
   - Test všech URL paths

2. **Stripe LIVE mode**
   - Přepni z test API keys na live keys
   - Verify webhook endpoint na produkční URL
   - Test platbu s reálnou kartou (malá částka)
   - Verify PDF delivery + faktura

3. **Email konfigurace**
   - Verify Resend domain authentication
   - Test transactional emails z produkce
   - Verify Ecomail live API

4. **Supabase production**
   - Review RLS policies (security audit)
   - Backup strategy setup
   - Monitor usage limits
   - Connection pooling check

#### **D. Jana Onboarding**

1. **Admin dokumentace**
   - Návod jak přidat produkt
   - Návod jak přidat blog článek
   - Návod jak nahrát obrázek
   - Troubleshooting common issues

2. **Live training session**
   - Projeď admin panel s Janou
   - Ukázka: přidání produktu, blog post, obrázek
   - Ukázka: kontrola objednávek
   - Odpověz na dotazy

3. **Emergency contact**
   - Sdílej kontakt pro urgentní problémy
   - Nastav monitoring alerts na tvůj email

#### **E. Backup & Monitoring**

1. **Backup strategy**
   - Supabase auto-backup je included (FREE tier)
   - Export databáze ručně před launch
   - Backup PDF souborů ze Storage

2. **Monitoring setup**
   - Plausible Analytics živé
   - Supabase dashboard pro monitoring
   - Stripe dashboard pro platby
   - Email alerts pro chyby (Resend failures, Stripe issues)

#### **F. Launch Checklist**

**Pre-launch:**
- [ ] Všechny testy prošly
- [ ] Legal docs živé (podmínky, privacy)
- [ ] Domain nastaven a funguje
- [ ] Stripe LIVE mode aktivní a otestovaný
- [ ] Všechny produkty nahrány s PDF soubory
- [ ] Blog má alespoň 3-5 článků
- [ ] SEO meta tagy všude
- [ ] Favicon + OG images
- [ ] 404 error page
- [ ] Robots.txt + sitemap.xml
- [ ] Jana proškolená

**Soft Launch (1-3 dny):**
- [ ] Spusť web pouze pro Janu a blízké přátele
- [ ] Testuj reálné nákupy
- [ ] Sbírej feedback
- [ ] Fix kritické bugy

**GO LIVE:**
- [ ] Oznámení na sociálních sítích
- [ ] Email kampaň přes Ecomail
- [ ] Monitor first 48 hodin intenzivně
- [ ] Reaguj na bug reports rychle

**Časový odhad:** 8-10 hodin
**Měřítko úspěchu:**
- ✅ Zero kritických bugů na produkci
- ✅ První reálný prodej úspěšný
- ✅ Jana zvládá admin sama
- ✅ Všechny integrace fungují spolehlivě

---

## 🎯 PRIORITY

**MUST-HAVE (MVP):**
- ✅ Produkty eshop + Stripe platby
- ✅ Automatické dodání PDF
- ✅ Admin panel (produkty, blog)
- ✅ Blog základní
- ✅ SEO meta tagy
- ✅ Custom itineráře workflow
- ✅ **Ecomail automatizace** (zákazníci, newsletter)
- ✅ **Facturoid automatizace** (faktury)

**NICE-TO-HAVE (v2 později):**
- ⏳ WYSIWYG editor pro blog
- ⏳ Draft/Publish workflow
- ⏳ Advanced analytics (funnels)
- ⏳ User accounts pro zákazníky
- ⏳ Automatická Facturoid integrace
- ⏳ Product reviews/ratings
- ⏳ Affiliate system

---

## 📊 MĚŘÍTKA ÚSPĚCHU

**Technické:**
- ✅ Web načítání < 3s
- ✅ Lighthouse score 90+
- ✅ Zero kritických bugů
- ✅ Mobile responsive
- ✅ GDPR compliant

**Business:**
- ✅ První prodej do 2 týdnů po launch
- ✅ Jana zvládá admin sama
- ✅ 0 complaints o platebním procesu
- ✅ Email delivery rate 95%+

---

## ⚠️ RIZIKA & MITIGATION

| Riziko | Pravděpodobnost | Dopad | Mitigation |
|--------|----------------|-------|------------|
| Stripe webhook fails | Střední | Vysoký | Retry logic + admin notifikace |
| Email delivery issues | Nízká | Vysoký | Resend má 99.9% uptime + fallback na Ecomail |
| Supabase Storage limit | Nízká | Střední | Monitor usage, upgrade při 80% |
| PDF soubory příliš velké | Střední | Nízký | Komprese PDF před upload |
| Jana nemůže spravovat sama | Nízká | Vysoký | Dobrý onboarding + dokumentace |

---

## 📝 POZNÁMKY

- **Part-time vývoj:** Počítám s 10-15h týdně → realisticky 11-12 týdnů
- **Flexibilní deadline:** Není rush, kvalita > rychlost
- **Iterativní přístup:** Můžeš spustit po FÁZI 6 (bez automatizace a kvízu), FÁZI 7 dodělat po soft launch
- **Upgrade path:** Všechno lze vylepšit postupně (WYSIWYG, user accounts, atd.)
- **Automatizace:** FÁZE 7 (Automatizace) lze přeskočit a vrátit se k ní později, ale je silně doporučená pro profesionální dojem
- **Kvíz:** FÁZE 5 (Kvíz Systém) je optional, můžeš ji přeskočit a přidat později

---

## 🚀 NEXT STEPS

1. **Začni FÁZÍ 1:** Supabase setup
2. **Weekly check-ins:** Kontroluj progress každý týden
3. **Stay flexible:** Pokud narazíš na blocker, uprav plán
4. **Communicate s Janou:** Ukaž jí progress, sbírej feedback

---

**Hodně štěstí s projektem! 💪**

*Vytvořeno s pomocí Claude (AI Assistant)*
