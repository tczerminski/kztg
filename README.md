# Church website template 

Church website — single-page app deployed on Cloudflare Workers, with an automated sermon processing pipeline (YouTube → transcription → translation → TTS → R2).

## Architecture overview

```
YouTube → pipeline.py → Cloudflare R2
                              ↓
              generate_metadata.js (build)
                              ↓
                        js/metadata.js
                              ↓
                    Cloudflare Worker (edge)
                    ├── bots → prerendered HTML (49 sermons)
                    └── users → SPA + JS
```

**Directories:**
- `js/` — frontend (vanilla JS, no framework)
- `css/` — Tailwind CSS v4
- `scripts/` — sermon processing pipeline + build tooling
- `dist/` — build artifacts (gitignored)
- `docs/decisions/` — architecture decision records (MADR)

## Commands

```bash
# Frontend
npm run dev           # local dev server via Wrangler
npm run build         # full build: metadata → CSS → JS → dist → SEO
npm run deploy        # build + deploy to Cloudflare

# Individual build steps
npm run build:metadata   # lists R2, generates js/metadata.js
npm run build:css        # Tailwind → dist/style.css
npm run build:js         # esbuild → dist/
npm run build:dist       # webpack copies static assets to dist/
npm run build:seo        # injects JSON-LD into dist/index.html, writes sitemap.xml
```

## Sermon pipeline

```bash
uv run pipeline <yt_url> [<yt_url> ...]   # normal run (skips what's already in R2)
uv run pipeline <yt_url> --force           # delete R2 files for this video and reprocess from scratch
```

`scripts/pipeline.py` checks R2 first and only does what's missing:

1. Resolve video ID from the YouTube URL (no download yet)
2. List existing R2 files for this sermon — skip if already complete
3. **Transcript** — download from R2 if present; otherwise download audio from YouTube (yt-dlp, opus 48k), convert to mono 16kHz MP3 (ffmpeg), split into 15-minute chunks, transcribe (OpenAI `gpt-4o-mini-transcribe`), clean up (GPT-4.1-mini)
4. **Summary** — reuse from R2 `metadata.json` if present; otherwise generate in Polish (GPT-4.1-mini)
5. **Per language** (EN, UK, TA, DE, ES) — skip if TTS file already in R2; otherwise translate title, summary and transcript (GPT-4.1-mini) and generate TTS (ElevenLabs `eleven_multilingual_v2`, opus 48k)
6. Upload only newly created files to Cloudflare R2 (`sermons/{video_id}/`)

`--force` deletes all existing R2 objects for the video before running, forcing a full reprocess.

## Sermon data shape

```typescript
{
  id: string;
  date: string;              // "YYYY-MM-DD"
  preacher: string;
  title: string;             // Polish
  summary: string;           // Polish
  audio: string;             // R2 URL (.opus)
  cover: string;             // cover image URL
  duration: number;          // seconds
  tts: {                     // TTS URL per language
    en?: string; uk?: string; ta?: string; de?: string; es?: string;
  };
  tts_durations: { ... };    // seconds per language
  translations: {            // title + summary per language
    en?: { title, summary };
    // ...
  };
}
```

## Environment variables (`.env`)

| Variable | Description |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_PUBLIC_BASE_URL` | Public CDN URL for R2 |
| `R2_BUCKET` | Bucket name (default: `kztg`) |
| `R2_ENDPOINT` | R2 endpoint (default: `eu.r2.cloudflarestorage.com`) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `SENTRY_AUTH_TOKEN` | Sentry token (source map upload) |
| `SITE_URL` | Canonical site URL (default: `https://kztg.churchy.workers.dev`) |

## AI Act compliance (Art. 50)

Effective 2026-08-02. The site displays:
- `✦ AI` badge next to every AI-generated summary
- Synthetic voice notice in the player when TTS is active for non-Polish languages

See [`docs/decisions/0003-tts-pipeline.md`](docs/decisions/0003-tts-pipeline.md) for details.

## Architecture decision records

- [ADR-0001](docs/decisions/0001-cloudflare-workers-r2.md) — Cloudflare Workers + R2 as the hosting platform
- [ADR-0002](docs/decisions/0002-vanilla-js-spa.md) — Vanilla JS SPA without a framework
- [ADR-0003](docs/decisions/0003-tts-pipeline.md) — Multilingual TTS pipeline (ElevenLabs + OpenAI)
- [ADR-0004](docs/decisions/0004-bot-prerendering.md) — Bot prerendering via Cloudflare HTMLRewriter
