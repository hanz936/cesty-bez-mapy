BEGIN;
SELECT plan(5);

-- Funkce existuje (::name casty vynutí (schema, function) overload pgTAP)
SELECT has_function('public'::name, 'check_rate_limit'::name);

-- Fixed-window: limit 3 / 60 s
SELECT ok( public.check_rate_limit('test:1.1.1.1', 3, 60), 'pozadavek 1 povolen' );
SELECT ok( public.check_rate_limit('test:1.1.1.1', 3, 60), 'pozadavek 2 povolen' );
SELECT ok( public.check_rate_limit('test:1.1.1.1', 3, 60), 'pozadavek 3 povolen (na limitu)' );
SELECT ok( NOT public.check_rate_limit('test:1.1.1.1', 3, 60), 'pozadavek 4 blokovan (nad limit)' );

SELECT * FROM finish();
ROLLBACK;
