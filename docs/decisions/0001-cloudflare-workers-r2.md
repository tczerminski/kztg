# ADR-0001: Cloudflare Workers + R2 as the hosting platform

* Status: accepted
* Date: 2025-01

## Context and problem statement

The church website needs:
- Static file hosting (HTML, JS, CSS, fonts)
- Storage for sermon audio files (large .opus files, up to ~100 MB per sermon)
- Serving cover images (.webp) and metadata (JSON)
- Low cost at very low traffic volumes

## Considered options

* **Cloudflare Workers + R2** — Worker as edge proxy, R2 as object storage
* **Vercel + S3/R2** — popular combination for SPAs
* **GitHub Pages + CDN** — simplest option, but no server-side logic possible
* **VPS (e.g. Hetzner)** — full control, but fixed costs and maintenance overhead

## Decision outcome

Cloudflare Workers + R2.

## Rationale

- **Cost**: R2 has no egress fees, which is critical for streaming audio files. S3/GCS charge ~$0.09/GB egress.
- **Edge network**: Workers run in ~300 locations — minimal latency for users in Poland and the diaspora (UK, DE, UA).
- **Single ecosystem**: storage, CDN, compute, and SSL in one place, without stitching together different providers.
- **Free tier**: Workers Free allows 100k requests/day, R2 Free 10 GB — sufficient to start.
- **HTMLRewriter**: built-in API for modifying HTML at the edge, used for bot prerendering (see ADR-0004).

## Consequences

* The Worker must explicitly handle all routing — every request passes through `worker.js` (`run_worker_first: true`).
* Audio files in R2 have a public URL via Cloudflare CDN (`pub-*.r2.dev`) — covers and audio are accessible without authentication.
* `generate_metadata.js` lists R2 on every build, requiring R2 credentials in the build environment.
