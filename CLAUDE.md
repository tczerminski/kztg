# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Church website for Kościół Zmartwychwstałego w Tarnowskich Górach (Church of the Risen One in Tarnowskie Góry, Poland). Astro static site deployed on Cloudflare Workers, with sermon metadata committed to the repo and a Python sermon-processing pipeline that uploads media to Cloudflare R2 and writes everything else directly into the repo. Single project, no separate frontend/backend split — the Astro site lives at the repo root; `scripts/` is just the ingestion pipeline feeding it.

## Repository layout

```
kztg/
├── src/
│   ├── content/sermons/*.json     ← sermon metadata + transcripts, committed (NOT generated at build time)
│   ├── content.config.ts          ← zod schema for the `sermons` collection
│   ├── i18n/locales/*.ts          ← translation dictionaries per locale
│   ├── i18n/utils.ts              ← t(locale, key, vars), locales, defaultLocale
│   ├── layouts/BaseLayout.astro   ← <head>, header, footer, cookie banner shell
│   ├── components/                ← .astro components (server-rendered per locale)
│   ├── scripts/                   ← client islands (audio player, sermons search, etc.)
│   ├── lib/sermons.ts             ← getSermonsForLocale(): sorts + filters the collection
│   ├── lib/jsonld.ts              ← builds AudioObject/ItemList JSON-LD per locale
│   ├── styles/global.css          ← Tailwind v4 entry + custom component CSS
│   └── pages/
│       ├── index.astro            ← pl (default locale, unprefixed: `/`)
│       └── [locale]/index.astro   ← en/uk/de/es/ta (`/en/`, `/uk/`, …)
├── public/                 ← static passthrough: images/, fonts/, videos/, images/covers/*.webp
├── dist/                   ← build output (served by Wrangler)
├── package.json, tsconfig.json, astro.config.mjs
├── wrangler.jsonc          ← Cloudflare deployment config (main: ./worker.js)
├── worker.js               ← Cloudflare Worker (referenced from wrangler.jsonc)
├── scripts/                ← Python sermon pipeline
│   └── pipeline.py         ← YouTube → media to R2 + cover conversion; writes the complete sermon record (text + audio/cover/tts URLs) directly into src/content/sermons/*.json and public/images/covers/
├── pyproject.toml
└── .env                    ← secrets (not committed)
```

## Commands

```bash
npm run dev            # astro dev
npm run build          # astro build → dist/
npm run preview        # astro preview (serve built dist/)
npm run dev:worker     # wrangler dev (test /stream, /radio-status, cache headers against dist/)
npm run typecheck      # astro check
npm run deploy         # build + wrangler deploy
```

The site builds and deploys with zero R2 access, purely from committed content — R2 is only touched by `pipeline.py` (Python), which needs `.env` R2 credentials.

### Sermon processing pipeline (Python)

```bash
uv run pipeline <yt_url> [<yt_url> ...]
# or
python scripts/pipeline.py <yt_url>
```

This downloads YouTube audio, transcribes via OpenAI Whisper, generates a summary via GPT-4.1-mini, translates + generates TTS per language, uploads media to R2, converts the cover to webp, and writes the **complete** sermon record directly into the repo (see data flow below) — no separate sync step needed afterward.

## Architecture

### Data flow for sermons

R2 holds **only media**: `sermons/{video_id}/{video_id}.opus` (audio), `sermons/{video_id}/{video_id}.webp` (raw cover), `sermons/{video_id}/{video_id}_{lang}.opus` (TTS audio).

1. `scripts/pipeline.py` downloads a YouTube sermon, transcribes/summarizes/translates it, uploads media to R2, resizes/converts the cover to `public/images/covers/<id>.webp`, and writes the full sermon record — text data (title, summary, translations, transcripts per locale, bible_refs, tts_durations, date, preacher, duration) **and** the resulting public `audio`/`cover`/`tts` URLs — **directly** into `src/content/sermons/<id>.json`. On reruns it reads that same file (not R2) to detect what's already done and avoid redoing work.
2. Astro pages read the collection at build time via `getCollection("sermons")` (see `src/lib/sermons.ts`, which filters out `hidden` entries) — no `window.SERMONS` global, no runtime fetch.

Sermon content shape (`src/content.config.ts`):
```
{ date, preacher, title, summary, audio, cover?, duration,
  transcript?: { pl, en?, uk?, ta?, de?, es? },  // full per-locale transcripts, written directly by pipeline.py
  tts?: { en, uk, ta, de, es },       // TTS audio URLs from R2 (files named {id}_{lang}.opus)
  tts_durations?: { en, uk, ta, de, es },
  translations?: { en, uk, ta, de, es: { title, summary } },
  bible_refs?: { pl, en, uk, ta, de, es: string[] },
  hidden?: boolean }             // excludes the entry from getSermonsForLocale(); no media required
```
Entry `id` = filename = sermon id.

### i18n and routing

Supported locales: `pl` (default, unprefixed `/`), `en`, `uk`, `de`, `es`, `ta` (prefixed `/en/`, `/uk/`, …), configured in `astro.config.mjs`'s `i18n` block. Each locale is a real static route generated at build time — no client-side language swap, no `localStorage`-based redirect.

- `src/i18n/locales/*.ts` — flat dotted-key dictionaries per locale, plus a `tour` sub-object for the onboarding walkthrough copy.
- `src/i18n/utils.ts` — `t(locale, key, vars?)` (pl fallback → key fallback → `{var}` substitution), `locales`, `defaultLocale`, `localePrefix(locale)`.
- **Non-Polish sermon filtering**: `getSermonsForLocale()` only returns sermons that have `tts[locale]` set for non-`pl` locales — a sermon without a TTS dub in a given language simply isn't listed on that locale's page.
- `LangSwitcher.astro` renders plain `<a href>` links via `getRelativeLocaleUrl` — switching language is a normal page navigation.
- Tamil requires the Google Fonts stylesheet for Noto Sans Tamil; loaded via a `<link>` in the `ta` styling (see `BaseLayout.astro`/`global.css`).

### Client-side islands (`src/scripts/`)

Plain TypeScript modules, all wired up from `main.ts` (loaded once in `BaseLayout.astro`), using event delegation — no `window.X` globals, no inline `onclick=`:
- `audio-player.ts` — shared `<audio>` element; delegates clicks on `[data-radio-toggle]` (radio) and `[data-sermon-play]` (sermon cards); Web Audio visualizer with reconnect backoff for the radio stream.
- `sermons-client.ts` — pagination + Fuse.js search over the sermon list serialized into the page as `<script type="application/json" id="sermons-data">`; re-renders the grid client-side (identical markup to `SermonCard.astro`) on search/pagination interactions.
- `contact-form.ts` — submits to web3forms; reads localized button labels from `data-label-*` attributes on the form (rendered server-side per locale) rather than a client `t()`.
- `cookies.ts` — cookie banner + Google Maps consent gate for the contact section.
- `onboarding.ts` — driver.js product tour; step copy comes from the locale's `tour` dictionary, passed in from `main.ts`.

Card markup (`sermon-inline-player__toggle`, `[data-sermon-progress]`, `[data-current-time]`, etc.) must stay in sync between `SermonCard.astro` (initial server render) and `sermons-client.ts`'s template string (client re-render) — same DOM contract, `audio-player.ts` queries it via `closest()`/`querySelector` regardless of which one produced it.

### Deployment

`worker.js` is a thin Cloudflare Worker in front of the `ASSETS` binding (the `dist/` directory Astro builds):
- `/radio-status`, `/stream` — Shoutcast radio proxy.
- `env.BUCKET.get("site/index.html")` — manual R2 override escape hatch for `/`/`/index.html` (operational kill-switch, independent of the Astro build).
- Cache-Control headers by file extension on the `ASSETS` fallback.

There is no bot-detection or request-time HTML rewriting — every locale route is already a fully-rendered static page (real markup, JSON-LD, hreflang) produced at build time by Astro, so there's no special-casing needed for crawlers. `sitemap.xml` is generated by `@astrojs/sitemap` and served as a static file.

### Build tools

- Astro (`output: "static"`) builds `dist/`; `worker.js` is unrelated to Astro's own build and stays the Workers request entrypoint (not using the `@astrojs/cloudflare` SSR adapter).
- Tailwind CSS v4 via `@tailwindcss/vite` (no separate CLI build step).
- `@astrojs/sitemap` for `sitemap.xml`.
- Static assets (`fonts/`, `videos/`, `images/`) live under `public/` and are copied as-is by Astro.

### Environment variables

Required in `.env` at the project root:
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — Cloudflare R2 credentials (only needed by `pipeline.py`)
- `R2_PUBLIC_BASE_URL` — public CDN base URL for R2 assets
- `OPENAI_API_KEY` — used by `pipeline.py` for transcription and summaries
- `R2_BUCKET` (optional, defaults to `kztg`)
