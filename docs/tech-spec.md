# Tech Spec

How Sketchy is built, so it can be picked up and maintained without re-deriving it
from scratch. See [vision.md](vision.md) for *why* it works this way.

## High-level architecture

```
┌─────────────┐   POST /api/generate-image    ┌──────────────────┐
│   React SPA │ ─────────────────────────────▶ │   Express server │
│  (client/)  │ ◀───────────────────────────── │   (server/)      │
└─────────────┘   GET  /api/gallery            └──────────────────┘
                                                        │      │
                                        gpt-3.5-turbo   │      │  gpt-image-1
                                     (writes the prompt) │      │ (renders the image)
                                                        ▼      ▼
                                                    OpenAI API
                                                        │
                                        image bytes ────┘
                                                        │
                                       ┌────────────────┴─────────────────┐
                                       ▼                                  ▼
                          dev: server/images/ (disk)          prod: Vercel Blob Store
                          dev: in-memory galleryItems[]        prod: Vercel KV (metadata)
```

Two independent Node projects live in one repo and one Vercel deployment:
`client/` (Create React App) and `server/` (Express, ESM). The root `package.json`
only has convenience scripts that shell out to both.

## Request flow: generating an image

`POST /api/generate-image` (`server/server.js`), given `{ prompt }`:

1. **Prompt → prompt.** If `USE_OPENAI_API=true`, the raw user input (a song or
   artist name) is wrapped in a fixed instruction template and sent to
   `gpt-3.5-turbo` (`openai.chat.completions.create`). The template explicitly asks
   for a vivid, specific, non-explicit visual description under 500 characters that
   calls out concrete details (iconic logos, band imagery) — see the
   `wrappedPrompt` constant in `server.js` for the exact wording. This is the "art
   direction" step described in vision.md. If `USE_OPENAI_API=false`, this step is
   skipped and the raw input is used as-is (mock mode).
2. **Prompt → image.** The generated description is sent to `gpt-image-1`
   (`openai.images.generate`, `quality: "high"`, `size: "1024x1024"`). This model
   returns the image as base64 (`response.data[0].b64_json`), **not** a URL — that's
   a difference from the older `dall-e-3` model this code originally used, and it's
   the reason `saveImage()` takes a `Buffer` rather than fetching a URL. In mock
   mode, a placehold.co URL is generated instead and no image call is made.
3. **Thumbnail.** `createThumbnail()` uses `Jimp` to produce a 300x300 `cover`-fit
   JPEG (quality 80) from the full image buffer.
4. **Persist.** `saveImage()` writes both the full PNG and the JPEG thumbnail to
   whichever storage backend is active (see below) and returns their URLs.
5. **Record metadata.** A metadata object (`originalPrompt`, `generatedPrompt`,
   `imageUrl`, `thumbnailUrl`, `createdAt`) is pushed into the in-memory
   `galleryItems` array *and* written to Vercel KV, keyed by `imageUrl`. Both happen
   unconditionally, in every environment — see "Known inconsistencies" below.
6. The response echoes back `imageUrl`, `thumbnailUrl`, `generatedPrompt`,
   `originalPrompt`, `createdAt`.

## Storage: two backends selected by `NODE_ENV`

There is no explicit "storage mode" setting — it's derived from `NODE_ENV`:

- **`NODE_ENV=production` → Vercel Blob Store + Vercel KV.**
  `USE_BLOB_STORE = true`. Images and thumbnails are uploaded via `@vercel/blob`'s
  `put()` (`access: 'public'`, `addRandomSuffix: false`, so filenames are just
  `<uuid>.png` / `<uuid>_thumb.jpg`). Metadata is stored in Vercel KV
  (`@vercel/kv`), keyed by the blob's public `imageUrl`. The local `images/`
  directory is not created or served in this mode.
- **anything else (local dev) → local disk + in-memory array.**
  `USE_BLOB_STORE = false`. Images are written to `server/images/` and served
  statically at `/api/images/<file>` (`express.static`); metadata lives only in the
  `galleryItems` array in server memory — **it is lost on every server restart** in
  dev mode. `LOCAL_API_URL` (`http://localhost:3001/api`) is hardcoded for building
  local image URLs, so local dev always assumes the server runs on port 3001.

`server/images/` and the thumbnails in it are git-ignored (`.gitignore`); the
sample images checked into the repo predate that and should probably be pruned
(they're not used by the running app — just filesystem output from earlier local
testing).

### Gallery reads (`GET /api/gallery`)

- Production: lists all blobs (`list()`), filters out anything with `_thumb` in the
  pathname (thumbnails aren't separate gallery items), sorts by `uploadedAt`
  descending, and caps the response at the 20 most recent (`MAX_ITEMS`). For each
  kept blob it looks up the KV metadata by URL; if metadata is missing (shouldn't
  normally happen, but is handled defensively) it falls back to just the blob URL
  and upload time. Response shape: `{ galleryItems, totalItems, returnedItems }`.
- Dev: returns the raw `galleryItems` array directly (no pagination, no cap) — a
  **different response shape** than production (array vs. `{ galleryItems, ... }`
  object). The client (`client/src/App.js`, `fetchGallery`) handles both shapes
  explicitly for that reason — don't "clean up" that branch without keeping dev and
  prod both working, or add a query param / `NODE_ENV` check server-side so both
  environments emit the same shape instead.

### Admin endpoints

`checkApiKey` middleware guards mutation endpoints by comparing
`req.query.api_key` / the `x-api-key` header against `ADMIN_API_KEY`. If
`ADMIN_API_KEY` isn't set at all, these endpoints fail closed (500), not open.

- `DELETE /api/clear-gallery` — deletes every blob + KV entry (prod), or empties
  `galleryItems` (dev).
- `DELETE /api/remove-image` (`{ imageUrl }`) — deletes one blob (path parsed out of
  the URL) + its KV entry (prod), or splices it out of `galleryItems` by exact
  `imageUrl` match (dev). Note: in prod this does **not** also delete the matching
  thumbnail blob — only the exact `imageUrl` passed in is removed. If you extend
  this endpoint, mirror the thumbnail-pairing logic in `reduce-gallery` below.
- `POST /api/reduce-gallery` (`{ count }`) — keeps the `count` most recently
  uploaded *images* and deletes the rest. In prod this has to explicitly filter
  blobs down to main images (excluding `_thumb`) before sorting/slicing, then for
  each deleted main image also find and delete its paired thumbnail blob
  (matched by replacing `.png` with `_thumb.jpg` in the pathname) and its KV entry.
  This pairing logic is easy to accidentally break — treating every blob as one
  "item" would double-count images against thumbnails and can delete one half of a
  pair without the other.

## Client (`client/src/App.js`)

Single-file React app (Create React App, no router — everything is one page):

- State: current prompt, the last generated image + its two prompts, loading/error
  state, the gallery array, an in-memory `cachedImages` map of URL → preloaded
  `Image` objects (avoids a visible pop-in when a gallery thumbnail you've already
  seen is re-rendered), and a "toast" for the copy-to-clipboard confirmation.
- `fetchGallery()` runs on mount and again after every successful generation; it
  normalizes the two possible response shapes from `/api/gallery` (see above).
- `handleSubmit` posts to `/api/generate-image` and populates the right-hand panel;
  `handleGalleryItemClick` re-populates that same panel from a previously-generated
  gallery item (client-side only, no re-fetch).
- `handleShare` copies a link *back into the app itself* — the current page URL
  with the full-resolution `imageUrl` (not the thumbnail) attached as an `?image=`
  query param — rather than the bare image URL. On load, `App` checks for that param
  and immediately shows that image, then fills in its prompt/`createdAt` once the
  gallery response includes a matching item (best-effort: if the image has aged out
  of the capped gallery response, it still displays, just without the prompt text).
- The right-hand panel also shows `createdAt` (from the `/api/generate-image`
  response, or from the matching gallery item), formatted client-side with
  `toLocaleString`.
- `REACT_APP_COMING_SOON=true` short-circuits the whole app to a static
  `coming-soon.html` redirect — useful for putting the site in a "not live yet"
  state via env var alone, without a deploy.
- `API_BASE_URL` comes from `REACT_APP_API_URL`, which differs by build:
  `client/.env.development` → `http://localhost:3001/api`,
  `client/.env.production` → `/api` (relative, since prod serves both client and
  API from the same Vercel deployment/domain).

## Deployment (Vercel)

`vercel.json` defines two builds from one repo:
- `client/package.json` via `@vercel/static-build`, output `build/` (CRA's default).
- `server/server.js` via `@vercel/node` (`maxDuration: 60`s — image generation is
  slow enough that this matters; a request that hits the default lower limit would
  be killed mid-generation).

Routing: any `/api/*` path goes to the server, everything else goes to the built
client. `server.js` does `export default app` for the Vercel Node runtime to use,
and only calls `app.listen()` when *not* running under `NODE_ENV=production` — i.e.
local dev runs a real long-lived server, production runs as a function per request.

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `OPENAI_API_KEY` | server | Required for both the prompt step and the image step. |
| `USE_OPENAI_API` | server | `"true"` to call OpenAI for real; anything else uses the mock text-prompt-as-image-url path (`generateMockImage`) with no API calls — useful for UI work without burning credits. |
| `ADMIN_API_KEY` | server | Gates `clear-gallery` / `remove-image` / `reduce-gallery`. Server refuses those requests with 500 if this isn't set, rather than allowing them unauthenticated. |
| `BLOB_READ_WRITE_TOKEN` | server | Vercel Blob Store token; only exercised when `NODE_ENV=production`. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (+ `KV_REST_API_READ_ONLY_TOKEN`) | server | Vercel KV connection; same production-only usage. |
| `NODE_ENV` | server | Not set explicitly in local dev — its absence is what *selects* dev mode (local disk + in-memory gallery + `app.listen()`). Vercel sets it to `production` automatically at deploy time. |
| `REACT_APP_API_URL` | client (build-time) | Baked in at build time by CRA; see `.env.development` / `.env.production`. |
| `REACT_APP_COMING_SOON` | client (build-time) | `"true"` shows the coming-soon redirect instead of the app. |

Local secrets live in `server/.env` (git-ignored) and, for `vercel dev`/CLI use,
`.env.local` at the repo root (also git-ignored) — both are read by `dotenv`.

## Known inconsistencies / things to check before changing behavior

- **`gpt-image-1` vs. the older `dall-e-3`**: OpenAI's image models are still
  evolving; if `/api/generate-image` starts returning `"model ... does not exist"`
  again, it likely means the model name needs bumping again, and it's worth
  re-checking whether the new model still returns `b64_json` vs. a `url` — the
  `saveImage()` buffer-based path assumes base64 input.
- **Dev and prod `/api/gallery` return different shapes** (array vs. object) —
  handled client-side today; see above.
- **Dev-mode gallery is not persisted** — restarting `node server.js` locally
  loses all generated images' metadata (the files themselves stay on disk in
  `server/images/`, just orphaned from the gallery list).
- **`@vercel/analytics`** is a dependency in the root and would-be client
  `package.json` but isn't wired into any component — earlier commits added and
  then reverted it (see `git log`). Treat it as dead weight, not a real
  integration, unless someone re-adds `<Analytics />` from that package.
- **`data/` and root `images/`** directories in the repo are empty and unused by
  any code path — likely leftovers, not part of the current design.
- Committed sample files under `server/images/` are the result of local testing
  before that directory was git-ignored; they're inert (nothing reads them) and
  safe to delete.

## Local development

```bash
npm run install-all   # installs root, client, and server deps
npm run server         # http://localhost:3001 (Express, NODE_ENV unset ⇒ dev mode)
npm run client          # http://localhost:3000 (CRA dev server, proxies via REACT_APP_API_URL)
```

`server/.env` needs at minimum `OPENAI_API_KEY`; set `USE_OPENAI_API=false` to work
on the UI/gallery without calling OpenAI at all. `ADMIN_API_KEY` is only needed to
exercise the admin endpoints locally (e.g. via `curl -H "x-api-key: ..."`).

If a fresh `npm run server` fails with `Cannot find package '<x>'`, it means
`server/node_modules` is out of sync with `server/package.json` — run
`npm install` inside `server/` (this exact failure mode, for `jimp`, is what broke
generation in production/dev before this doc was written).
