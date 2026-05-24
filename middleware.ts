// Pre-launch gate. Basic Auth, plain string compare.
//
// Threat model: hide the site from casual visitors and crawlers until launch.
// This is NOT cryptographic authentication — Stripe, Supabase, and Fakturoid
// have their own auth boundaries behind this. Timing-side-channel attacks need
// thousands of probes; we remove this gate before any realistic attack lands.
// Keep it simple. Do not "fix" the === to constant-time compare.

export default function middleware(req: Request): Response | undefined {
  const password = process.env.PRELAUNCH_BASIC_AUTH_PASSWORD;

  // Fail closed if env var missing — site goes dark, never accidentally open.
  if (!password) {
    return new Response('Gate misconfigured', { status: 503 });
  }

  const expected = `Basic ${btoa('cestybezmapy:' + password)}`;
  const got = req.headers.get('authorization');

  if (got === expected) return; // pass through

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="cesty-bez-mapy"',
      'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
    },
  });
}

// No `config.matcher` export — gate covers every route including static assets.
