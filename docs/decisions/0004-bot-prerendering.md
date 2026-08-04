# ADR-0004: Bot prerendering via Cloudflare HTMLRewriter

* Status: accepted
* Date: 2026-07

## Context and problem statement

The site is a single-page app — the sermon list is rendered by JavaScript from `window.SERMONS`. Bots that do not execute JS (some crawlers, link previews in Slack/Telegram) see an empty `#sermons-grid`. Googlebot does execute JS, but in two phases: it first indexes the raw HTML, then renders the JS version. Titles and summaries of 49 sermons are invisible in the raw HTML.

## Considered options

* **Prerendering in the Cloudflare Worker** — Worker detects bots and serves HTML with the sermon list injected
* **External prerendering service** (Prerender.io, Rendertron) — proxy that renders JS on demand for bots
* **Static HTML injection at build time** — `generate_seo.js` injects a `<ul>` into `dist/index.html` permanently (for all visitors)
* **SSR / Astro** — migrating the frontend to a framework with SSR

## Decision outcome

Prerendering in the Cloudflare Worker via `HTMLRewriter`.

## Rationale

- **No external dependencies**: Cloudflare Workers has a built-in `HTMLRewriter` — no additional services, costs, or SLAs.
- **Data already available at the edge**: `sermons-list.json` (generated at build time) is stored as a static asset — the Worker fetches it locally via `env.ASSETS.fetch`, without any external requests.
- **No impact on regular user UX**: bots get the prerender, users get the SPA as before.
- **Static injection was rejected**: injecting the list into HTML for all visitors would slow down parsing for users and duplicate content visible in the DOM (once in the pre-rendered list, once after JS renders).
- **Prerender.io was rejected**: additional cost, latency, and another external dependency.
- **SSR/Astro was rejected**: too large a refactor for the current scope of the site (see ADR-0002).

## Implementation

```
Worker.fetch(request)
  └── isBot(User-Agent)?
        ├── YES: ASSETS.fetch("/index.html") + ASSETS.fetch("/sermons-list.json")
        │         → HTMLRewriter injects <article> per sermon into #sermons-grid
        │         → Cache-Control: max-age=300 (short TTL — sermons change)
        └── NO: ASSETS.fetch(request) → normal response + cache headers
```

Bot detection: User-Agent regex covering Googlebot, Bingbot, Facebookbot, Twitterbot, LinkedIn, Slack, Telegram, WhatsApp and others.

## Cloudflare configuration

Requires two non-obvious options in `wrangler.jsonc`:
```json
"assets": {
  "directory": "./dist",
  "binding": "ASSETS",        // Worker can access assets via env.ASSETS
  "run_worker_first": true    // Worker runs BEFORE Cloudflare serves static files
}
```

Without `run_worker_first: true`, Cloudflare serves `index.html` directly from the edge cache, bypassing the Worker entirely.

## Consequences

* Every request going through the Worker adds minimal latency compared to direct asset serving (~1–5 ms at the edge). Acceptable for a church website.
* `sermons-list.json` must be regenerated on every build (done by `build:seo`).
* Bot regex detection is a heuristic — false positives (e.g. someone with "bot" in their UA) receive a prerender instead of the SPA, which is safe.
* Bot cache is set to 5 minutes — after adding a new sermon and deploying, bots will see the updated list shortly after.
