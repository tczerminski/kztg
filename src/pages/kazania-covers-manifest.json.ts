import type { APIRoute } from "astro";
import { getSermonsForLocale } from "../lib/sermons";
import { defaultLocale } from "../i18n/utils";

// Consumed by src/scripts/pwa.ts to warm the offline cache with every sermon
// cover image. Covers are small (webp thumbnails) and locale-independent, so
// unlike sermon audio (deliberately left out — many hundreds of MB) they're
// cheap to make fully available offline, similar to the śpiewnik.
export const GET: APIRoute = async () => {
  const sermons = await getSermonsForLocale(defaultLocale);
  const urls = sermons.map((sermon) => sermon.cover).filter((url): url is string => !!url);

  return new Response(JSON.stringify({ urls }), {
    headers: { "Content-Type": "application/json" },
  });
};
