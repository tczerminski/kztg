import type { APIRoute } from "astro";
import { getSongs } from "../lib/songs";

// Consumed by public/sw.js to precache every song page for full offline
// availability (songs are lightweight text, unlike sermon audio, so
// precaching the whole śpiewnik up front is cheap).
export const GET: APIRoute = async () => {
  const songs = await getSongs();
  const urls = songs.map((song) => song.href);

  return new Response(JSON.stringify({ urls }), {
    headers: { "Content-Type": "application/json" },
  });
};
