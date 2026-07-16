BEGIN;
SELECT plan(39);

-- ── Struktura ────────────────────────────────────────────────
SELECT has_table('public'::name, 'reviews'::name);
SELECT has_table('public'::name, 'review_requests'::name);
SELECT has_function('public'::name, 'refresh_product_rating'::name);
SELECT has_trigger('public'::name, 'reviews'::name, 'trg_reviews_refresh_product_rating'::name);

-- Advisor 0028/0029: trigger-only SECURITY DEFINER funkce nesmi byt spustitelna
-- pres RPC anon/authenticated rolemi; trigger samotny EXECUTE volajiciho nekontroluje
-- (agregacni asserty nize to dokazuji) — migrace 20260716181000
SELECT is( has_function_privilege('anon', 'public.refresh_product_rating()', 'EXECUTE'),
           false, 'anon nema EXECUTE na refresh_product_rating' );
SELECT is( has_function_privilege('authenticated', 'public.refresh_product_rating()', 'EXECUTE'),
           false, 'authenticated nema EXECUTE na refresh_product_rating' );

-- ── Fixtures (jako postgres, RLS bypass) ─────────────────────
INSERT INTO public.products (id, title, description, price, slug)
VALUES ('00000000-0000-0000-0000-00000000000a', 'Test Guide', 'Test description', 100, 'test-guide-reviews');

INSERT INTO public.orders (id, customer_email, total_amount, status)
VALUES ('00000000-0000-0000-0000-00000000000b', 'reviews-test@example.com', 100, 'completed'),
       ('00000000-0000-0000-0000-00000000000c', 'reviews-test2@example.com', 100, 'completed'),
       ('00000000-0000-0000-0000-00000000000d', 'reviews-test3@example.com', 100, 'completed');

-- ── Trigger: pending nemění agregáty ─────────────────────────
INSERT INTO public.reviews (id, product_id, order_id, reviewer_name, rating, review_text)
VALUES ('00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000b',
        'Tester', 4, 'Deset znaku minimalne, super pruvodce.');

SELECT is( (SELECT review_count FROM public.products WHERE id = '00000000-0000-0000-0000-00000000000a'),
           0, 'pending recenze nezvysuje review_count' );

-- ── Trigger: approve prepocita ───────────────────────────────
UPDATE public.reviews SET status = 'approved', approved_at = now()
WHERE id = '00000000-0000-0000-0000-000000000001';

SELECT is( (SELECT review_count FROM public.products WHERE id = '00000000-0000-0000-0000-00000000000a'),
           1, 'approve zvysi review_count na 1' );
SELECT is( (SELECT average_rating FROM public.products WHERE id = '00000000-0000-0000-0000-00000000000a'),
           4.00::numeric(3,2), 'average_rating = 4.00' );

INSERT INTO public.reviews (id, product_id, order_id, reviewer_name, rating, review_text, status, approved_at)
VALUES ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000c',
        'Tester 2', 5, 'Dalsi recenze, taky velmi spokojen.', 'approved', now());

SELECT is( (SELECT average_rating FROM public.products WHERE id = '00000000-0000-0000-0000-00000000000a'),
           4.50::numeric(3,2), 'prumer 4 a 5 = 4.50' );

-- ── Trigger: reject/delete prepocita zpet ────────────────────
UPDATE public.reviews SET status = 'rejected' WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT is( (SELECT review_count FROM public.products WHERE id = '00000000-0000-0000-0000-00000000000a'),
           1, 'reject snizi review_count' );

DELETE FROM public.reviews WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT is( (SELECT review_count FROM public.products WHERE id = '00000000-0000-0000-0000-00000000000a'),
           0, 'delete vrati review_count na 0' );
SELECT is( (SELECT average_rating FROM public.products WHERE id = '00000000-0000-0000-0000-00000000000a'),
           0.00::numeric(3,2), 'average_rating bez recenzi = 0.00' );

-- ── Constrainty ──────────────────────────────────────────────
SELECT throws_ok(
  $$ INSERT INTO public.reviews (product_id, order_id, reviewer_name, rating, review_text)
     VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'X', 6, 'Deset znaku minimalne tady.') $$,
  '23514', NULL, 'rating > 5 odmitnut' );
SELECT throws_ok(
  $$ INSERT INTO public.reviews (product_id, order_id, reviewer_name, rating, review_text)
     VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'X', 4, 'kratke') $$,
  '23514', NULL, 'text < 10 znaku odmitnut' );

INSERT INTO public.reviews (product_id, order_id, reviewer_name, rating, review_text)
VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'X', 4, 'Prvni platna recenze na unikat.');
SELECT throws_ok(
  $$ INSERT INTO public.reviews (product_id, order_id, reviewer_name, rating, review_text)
     VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'Y', 5, 'Druha recenze stejne kombinace.') $$,
  '23505', NULL, 'partial UNIQUE index (order_id, product_id) vynucen pro pending/approved' );

-- ── F1: zamitnuta recenze neuzamyka slot (order, product) navzdy ─────
-- Partial unique index kryje jen non-rejected radky: po zamitnuti lze vlozit
-- novou recenzi pro stejnou (order, product) kombinaci; zamitnuty radek
-- zustava jako auditni zaznam (duvod v review_admin_notes). Druha pending/approved duplicita
-- na stejnem slotu porad selze s 23505.
INSERT INTO public.orders (id, customer_email, total_amount, status)
VALUES ('00000000-0000-0000-0000-00000000000e', 'reviews-test4@example.com', 100, 'completed');

INSERT INTO public.reviews (id, product_id, order_id, reviewer_name, rating, review_text)
VALUES ('00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000e',
        'Reject Me', 2, 'Tahle recenze bude zamitnuta administratorem.');
UPDATE public.reviews SET status = 'rejected'
WHERE id = '00000000-0000-0000-0000-000000000003';

SELECT lives_ok(
  $$ INSERT INTO public.reviews (product_id, order_id, reviewer_name, rating, review_text)
     VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000e', 'Try Again', 4, 'Nova recenze po zamitnuti te predchozi.') $$,
  'po zamitnuti puvodni recenze lze vlozit novou pro stejnou (order, product)' );

SELECT is( (SELECT count(*) FROM public.reviews
             WHERE order_id = '00000000-0000-0000-0000-00000000000e'
               AND product_id = '00000000-0000-0000-0000-00000000000a')::int,
           2, 'zamitnuta recenze zustava jako auditni zaznam, nova je pending' );

SELECT throws_ok(
  $$ INSERT INTO public.reviews (product_id, order_id, reviewer_name, rating, review_text)
     VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000e', 'Duplicate', 3, 'Dalsi pokus o duplicitu na stejnem slotu.') $$,
  '23505', NULL, 'druha pending/approved recenze na stejnem slotu porad selze' );

-- ── RLS: anon ────────────────────────────────────────────────
UPDATE public.reviews SET status = 'approved', approved_at = now()
WHERE order_id = '00000000-0000-0000-0000-00000000000b';
-- pending recenze na order d (cerstvy slot bez existujici recenze)
INSERT INTO public.reviews (product_id, order_id, reviewer_name, rating, review_text)
VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d', 'Pending guy', 3, 'Tahle ceka na schvaleni, neverejna.');
-- fixture pro review_requests RLS asserty nize: bez radku by "0 radku" u ne-admina
-- nerozlisilo RLS filtraci od prazdne tabulky
INSERT INTO public.review_requests (order_id, expires_at)
VALUES ('00000000-0000-0000-0000-00000000000b', now() + interval '12 months');

SET LOCAL ROLE anon;
SELECT is( (SELECT count(*) FROM (SELECT id, product_id, reviewer_name, rating, review_text, created_at FROM public.reviews) s)::int,
           1, 'anon vidi jen approved' );
SELECT throws_ok( $$ SELECT * FROM public.reviews $$, '42501', NULL,
           'anon select=* selze (column granty)' );
SELECT throws_ok( $$ SELECT status FROM public.reviews $$, '42501', NULL,
           'anon nema grant na status' );
SELECT throws_ok(
  $$ INSERT INTO public.reviews (product_id, order_id, reviewer_name, rating, review_text)
     VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 'H', 5, 'Pokus o primy insert anonem.') $$,
  '42501', NULL, 'anon INSERT zamitnut' );
SELECT throws_ok( $$ SELECT token FROM public.review_requests $$, '42501', NULL,
           'anon nevidi review_requests' );
RESET ROLE;

-- ── RLS: authenticated ne-admin (anonymni session z checkoutu) ─
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"is_admin": false, "is_anonymous": true, "aal": "aal1"}';
SELECT is( (SELECT count(*) FROM public.reviews)::int, 1,
           'authenticated ne-admin vidi jen approved (plny select grant, RLS filtruje)' );
-- Pozn.: data-modifying CTE nejde do scalar subquery -> UPDATE spustime samostatne
-- (RLS USING is_admin() nespaaruje zadny radek) a overime, ze approved radek prezil.
UPDATE public.reviews SET status = 'rejected' WHERE status = 'approved';
SELECT is( (SELECT count(*) FROM public.reviews WHERE status = 'approved')::int,
           1, 'ne-admin UPDATE nezasahl zadny radek (USING is_admin)' );
-- authenticated ma na review_requests plny SELECT grant, ale RLS policy pousti
-- jen admina -> ne-admin dostane prazdnou mnozinu (0 radku), zadna chyba.
SELECT is( (SELECT count(*) FROM public.review_requests)::int, 0,
           'ne-admin authenticated vidi 0 radku review_requests (RLS empty set, bez chyby)' );

-- ── RLS: admin aal2 ──────────────────────────────────────────
SET LOCAL request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
SELECT is( (SELECT count(*) FROM public.reviews)::int, 5, 'admin vidi vse vc. pending a rejected' );
SELECT lives_ok(
  $$ UPDATE public.reviews SET status = 'approved', approved_at = now()
     WHERE status = 'pending' $$,
  'admin muze UPDATE status/approved_at' );
SELECT throws_ok(
  $$ UPDATE public.reviews SET review_text = 'prepsany text recenze zlym adminem' WHERE status = 'approved' $$,
  '42501', NULL, 'admin NEMUZE menit review_text (column grant)' );
SELECT is( (SELECT count(*) FROM public.review_requests)::int, 1,
           'admin review_requests SELECT projde (vidi fixture radek)' );
RESET ROLE;

-- ── RLS: review_admin_notes ──────────────────────────────────
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
SELECT lives_ok(
  $$ INSERT INTO public.review_admin_notes (review_id, notes)
     VALUES ('00000000-0000-0000-0000-000000000003', 'Zamitnuto pro spam obsah.') $$,
  'admin muze INSERT poznamku k recenzi' );
SELECT is( (SELECT count(*) FROM public.review_admin_notes
             WHERE review_id = '00000000-0000-0000-0000-000000000003')::int,
           1, 'admin vidi svou poznamku' );
-- Constrainty na notes: CHECK char_length BETWEEN 1 AND 2000 + NOT NULL.
-- Recenze 002 zatim poznamku nema (PK = review_id), takze PK nezasahne driv.
SELECT throws_ok(
  $$ INSERT INTO public.review_admin_notes (review_id, notes)
     VALUES ('00000000-0000-0000-0000-000000000002', '') $$,
  '23514', NULL, 'prazdna poznamka odmitnuta (CHECK char_length >= 1)' );
SELECT throws_ok(
  $$ INSERT INTO public.review_admin_notes (review_id, notes)
     VALUES ('00000000-0000-0000-0000-000000000002', NULL) $$,
  '23502', NULL, 'NULL poznamka odmitnuta (NOT NULL)' );

SET LOCAL request.jwt.claims = '{"is_admin": false, "is_anonymous": true, "aal": "aal1"}';
SELECT is( (SELECT count(*) FROM public.review_admin_notes)::int, 0,
           'ne-admin SELECT review_admin_notes vraci 0 radku (RLS skryje, bez chyby)' );
SELECT throws_ok(
  $$ INSERT INTO public.review_admin_notes (review_id, notes)
     VALUES ('00000000-0000-0000-0000-000000000002', 'pokus ne-admina') $$,
  '42501', NULL, 'ne-admin INSERT do review_admin_notes selze (RLS)' );
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok( $$ SELECT * FROM public.review_admin_notes $$, '42501', NULL,
           'anon nema vubec grant na review_admin_notes' );
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
DELETE FROM public.reviews WHERE id = '00000000-0000-0000-0000-000000000003';
SELECT is( (SELECT count(*) FROM public.review_admin_notes
             WHERE review_id = '00000000-0000-0000-0000-000000000003')::int,
           0, 'review_admin_notes kaskadove smazana s review (ON DELETE CASCADE)' );
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
