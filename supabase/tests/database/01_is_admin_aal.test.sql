BEGIN;
SELECT plan(4);

-- AAL2 admin → je admin
SET LOCAL request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
SELECT ok( public.is_admin(), 'aal2 admin je admin' );

-- AAL1 admin (heslo bez TOTP) → NENÍ admin (SEC-01 vynucení)
SET LOCAL request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal1"}';
SELECT ok( NOT public.is_admin(), 'aal1 admin NENI admin (MFA vynuceno)' );

-- AAL2 ne-admin → není admin
SET LOCAL request.jwt.claims = '{"is_admin": false, "is_anonymous": false, "aal": "aal2"}';
SELECT ok( NOT public.is_admin(), 'ne-admin neni admin' );

-- Chybějící aal → deny (fail-closed)
SET LOCAL request.jwt.claims = '{"is_admin": true, "is_anonymous": false}';
SELECT ok( NOT public.is_admin(), 'chybejici aal -> deny (fail closed)' );

SELECT * FROM finish();
ROLLBACK;
