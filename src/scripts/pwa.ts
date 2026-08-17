export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("/sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      const warmUp = () => {
        warmCache("/piesni-manifest.json", { headers: { Accept: "text/html" } });
        warmCache("/kazania-manifest.json", { headers: { Accept: "text/html" } });
        warmCache("/kazania-covers-manifest.json");
      };
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(warmUp, { timeout: 15000 });
      } else {
        setTimeout(warmUp, 5000);
      }
    })
    .catch(() => {});
}

const WARM_CONCURRENCY = 6;

// Fetches every URL from a manifest (once the SW is confirmed active) so
// content is available offline without the visitor having to open each page
// first — used for the whole śpiewnik and every sermon cover image. Driven
// from here rather than the service worker's install/activate handlers —
// hundreds of fetches risked exceeding those lifecycle events' background
// -execution budget on real devices. Each fetch is a normal page-initiated
// request, so sw.js's existing fetch handler (network-first for pages,
// cache-first for images) picks it up exactly like a real visit would —
// no separate caching path to keep in sync. Sermon *audio* is deliberately
// left out of this warm-up — many hundreds of MB, cached only on actual play.
async function warmCache(manifestUrl: string, fetchInit?: RequestInit): Promise<void> {
  try {
    const res = await fetch(manifestUrl);
    if (!res.ok) return;
    const { urls } = (await res.json()) as { urls: string[] };

    let index = 0;
    async function worker(): Promise<void> {
      while (index < urls.length) {
        const url = urls[index++];
        try {
          if (await caches.match(url)) continue;
          await fetch(url, fetchInit);
        } catch {
          // best-effort background warm-up — one failed fetch shouldn't stop the rest
        }
      }
    }

    await Promise.all(Array.from({ length: WARM_CONCURRENCY }, worker));
  } catch {
    // manifest fetch failed (e.g. offline) — nothing to warm this run
  }
}
