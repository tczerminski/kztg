# ADR-0002: Vanilla JS SPA without a framework

* Status: accepted
* Date: 2025-01

## Context and problem statement

The site has a single page with several sections (hero, radio stream, sermons, contact). It requires:
- A dynamic sermon list with pagination and search (Fuse.js)
- An audio player (radio + sermons) with shared state
- Language switching (i18n, 6 languages) with lazy-loading of the Tamil font

## Considered options

* **Vanilla JS (ES modules + IIFE)** — no framework, esbuild as bundler
* **React / Vue / Svelte** — popular choice for interactive SPAs
* **Astro** — static + islands hybrid

## Decision outcome

Vanilla JS with esbuild.

## Rationale

- **Simplicity**: the page has a limited scope of interactivity — a player, a search box, a language switcher. React would be over-engineering.
- **Bundle size**: vanilla JS produces a minimal bundle with no framework runtime. Important for slow mobile connections.
- **No runtime dependencies**: no framework = no breaking changes between versions, no security advisories from frontend dependencies.
- **Cloudflare Workers edge**: the Worker modifies HTML (ADR-0004) — with React/Next SSR, the integration would be significantly more complex.

## Consequences

* JS code uses a mixed style: `js/index.js` uses ES modules, other files use IIFE/ES5 — a deliberate trade-off between modernity and compatibility.
* No reactive state management — language changes are propagated via `CustomEvent('i18n:change')`, pagination via manual innerHTML re-rendering.
* Fuse.js is lazy-loaded on first search to avoid blocking the main bundle.
* If interactive complexity grows beyond ~5 components, migrating to Svelte or Astro Islands is worth considering.
