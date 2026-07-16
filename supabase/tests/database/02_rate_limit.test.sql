BEGIN;
SELECT plan(7);

-- Funkce existuje (::name casty vynutí (schema, function) overload pgTAP)
SELECT has_function('public'::name, 'check_rate_limit'::name);

-- Advisor 0028/0029: SECURITY DEFINER funkci vola jen service_role z edge fn —
-- anon/authenticated nesmi mit EXECUTE (migrace 20260716181000)
SELECT is( has_function_privilege('anon', 'public.check_rate_limit(text, integer, integer)', 'EXECUTE'),
           false, 'anon nema EXECUTE na check_rate_limit' );
SELECT is( has_function_privilege('authenticated', 'public.check_rate_limit(text, integer, integer)', 'EXECUTE'),
           false, 'authenticated nema EXECUTE na check_rate_limit' );

-- Fixed-window: limit 3 / 60 s
SELECT ok( public.check_rate_limit('test:1.1.1.1', 3, 60), 'pozadavek 1 povolen' );
SELECT ok( public.check_rate_limit('test:1.1.1.1', 3, 60), 'pozadavek 2 povolen' );
SELECT ok( public.check_rate_limit('test:1.1.1.1', 3, 60), 'pozadavek 3 povolen (na limitu)' );
SELECT ok( NOT public.check_rate_limit('test:1.1.1.1', 3, 60), 'pozadavek 4 blokovan (nad limit)' );

SELECT * FROM finish();
ROLLBACK;
