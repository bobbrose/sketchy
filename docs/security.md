# Security, Abuse & Scalability

What protects Sketchy from abuse today, what doesn't, and why — so it can be picked
up and extended without re-deriving it from scratch. See [tech-spec.md](tech-spec.md)
for how the app is built generally.

**A note on writing this in a public repo:** this repo is public on purpose, and
everything below is already fully readable in `server/server.js` — the rate limit
numbers, the CORS allowlist, the retry logic, all of it. Writing it down here adds
essentially nothing an attacker (or an AI asked to find weaknesses) couldn't
reconstruct from the source in a couple of minutes anyway. What's deliberately
*not* here: actual secrets (obviously, and none are committed — see
`.env`/`.gitignore`), and exact current operational values that live outside the
repo entirely (the real OpenAI spend cap, any Vercel Firewall rules) — those aren't
derivable from source, so they're the one category where writing precise numbers
here would give away something the code doesn't already.

## Rate limiting (`/api/generate-image`)

The only endpoint that costs real money (it calls OpenAI), so it's the one that
matters most. `checkRateLimit()` in `server.js`:

- Per-IP counter via Vercel KV (`kv.incr` + `kv.expire`), **not** an in-memory
  counter — a serverless function instance doesn't persist between invocations, so
  an in-memory count would silently reset on every cold start and protect nothing.
- Defaults: `RATE_LIMIT_MAX_REQUESTS = 8` per `RATE_LIMIT_WINDOW_SECONDS = 600`
  (10 minutes) per IP, both overridable via env var without a code change.
- Client IP comes from `x-forwarded-for` (Vercel sets this at the edge), falling
  back to `req.socket.remoteAddress` for direct/local connections.
- A rejected request gets a `429` and an `{ status: 'error', error: '...' }` event
  in the same NDJSON envelope the success path uses (see tech-spec.md) — the
  client shows it exactly like any other generation error, no special-casing
  needed.
- **Known weakness:** this only limits by IP. A botnet or rotating-proxy attacker
  isn't meaningfully slowed down by it — see "Known gaps" below.

## CORS policy

Replaced the previous `cors()` (allow-all) with an explicit origin allowlist
(`ALLOWED_ORIGIN_PATTERNS` in `server.js`): `localhost:3000` for dev, the
`sketchyai.app` domains, and the Vercel project's own preview/production alias
patterns.

This matters less than it sounds like it should: in production the client always
calls its API same-origin (`REACT_APP_API_URL=/api`, a relative path), so CORS
never even applies to the app's own normal usage — browsers only enforce CORS on
*cross*-origin requests. What it actually stops is some *other* website embedding
a script that fires requests at `sketchyai.app/api/generate-image` using a
visitor's browser (and their residual trust/cookies) as the origin. It does
**not** stop a direct script/curl call to the API — CORS is a browser-enforced
mechanism, not a server-side access control, so it's one layer among several, not
a substitute for the rate limiter above.

## Content-safety fallback chain

Not primarily a security feature, but affects both cost and abuse surface:
`generateImageWithSafetyFallback()` tries the art-directed prompt, then a
simplified one, then one with any named real person stripped out, each only after
the previous is specifically rejected by OpenAI's moderation. A prompt that fails
all three costs up to 3x the OpenAI calls of one that succeeds immediately — worth
knowing if someone were to deliberately spam prompts designed to trip the safety
system repeatedly, since that's a cost-amplification angle the rate limiter above
doesn't specifically account for (it counts requests, not the 1x-vs-3x cost each
one can carry). `moderation: "low"` on the image call (see tech-spec.md) reduces
how often this chain has to run at all.

## Admin endpoint auth

`checkApiKey` middleware guards `clear-gallery` / `remove-image` / `reduce-gallery`
by comparing `req.query.api_key` / `x-api-key` against `ADMIN_API_KEY`, and fails
closed (500) if that env var isn't set at all — never falls open.

**Known weakness:** the comparison is a plain `!==`, not constant-time, so it's
theoretically vulnerable to a timing attack. Low practical risk for a
random-generated key of reasonable length hit over the network (network jitter
alone tends to swamp the timing signal), but a `crypto.timingSafeEqual` swap would
close it if it's ever worth the small added complexity.

## Scalability / cost characteristics

- Vercel functions run with `maxDuration: 60s` (`vercel.json`) — generation
  (GPT prompt + image render + thumbnail + storage) normally finishes well under
  that, but it's the ceiling before a request gets killed mid-generation.
- `/api/generate-image` now **streams** progress (see tech-spec.md), which means
  the HTTP connection — and the serverless function invocation behind it — stays
  open for the *entire* generation, not just a quick request/response. A handful
  of concurrent generations can occupy a meaningful share of your plan's
  concurrent-execution limit; this is a real (if indirect) DoS lever even without
  malicious intent, just from legitimate concurrent traffic.
- `GET /api/gallery` has no rate limit of its own. It's read-only and cheap
  per-call, but at real scale repeated calls still mean repeated Blob `list()` +
  KV reads — lower severity than the generate endpoint, but not free.
- No enforced spend cap in code anywhere — the only backstops are whatever
  spending limits/alerts you've set directly on the OpenAI account and in the
  Vercel dashboard. Check those directly; deliberately not restating exact
  current values here (see the note at the top of this doc).

## What Vercel's platform already covers (not this app's code)

- Baseline volumetric DDoS mitigation is handled by Vercel's edge network — that's
  infrastructure-level, unrelated to anything in this repo, and not something to
  re-implement here.
- Vercel Firewall (WAF, IP blocking, its own rate-limit rules) is a
  dashboard-level feature on Pro+ plans, not currently verified/configured as far
  as this doc's authors checked — worth confirming directly in the Vercel
  dashboard rather than assuming either way.

## Known gaps / not yet done

Ideas worth doing, not commitments — matches the tone of vision.md's "what would
make this better" section:

- **No CAPTCHA/challenge** (e.g. Cloudflare Turnstile) in front of the generate
  button — would meaningfully raise the cost of scripted abuse beyond what
  IP-based rate limiting alone can do.
- **IP-based rate limiting is bypassable** by anyone with access to multiple IPs
  (rotating proxies, a small botnet, or just enough patience to spread requests
  across a residential proxy pool). It stops casual/accidental abuse from a
  single source, not a determined attacker.
- **No rate limit on `GET /api/gallery`** — lower priority since it's read-only
  and not calling paid APIs, but unbounded at real scale.
- **No enforced spend cap in code** — relies entirely on OpenAI/Vercel dashboard
  settings outside this repo. A code-level circuit breaker (e.g. a KV counter of
  total spend/requests per day with a hard cutoff) would be a stronger guarantee
  than trusting external dashboards alone.
- **Admin key comparison isn't constant-time** (see above).
