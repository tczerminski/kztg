import type { APIRoute } from "astro";
import { getSermonsForLocale } from "../lib/sermons";
import { defaultLocale } from "../i18n/utils";

// Consumed by src/scripts/pwa.ts to warm the offline cache with every
// sermon page (pl only — the pl page count already covers every sermon;
// other locales only add a sermon once it has a TTS dub, and warming every
// locale's pages too would multiply the fetch count for little benefit).
export const GET: APIRoute = async () => {
  const sermons = await getSermonsForLocale(defaultLocale);
  const urls = sermons.map((sermon) => sermon.href);

  return new Response(JSON.stringify({ urls }), {
    headers: { "Content-Type": "application/json" },
  });
};
