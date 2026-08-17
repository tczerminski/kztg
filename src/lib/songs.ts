import { getCollection } from "astro:content";
import { getRelativeLocaleUrl } from "astro:i18n";
import { defaultLocale } from "../i18n/utils";
import { slugify } from "./slug";

export interface SongVerse {
  lines: string[];
}

export interface SongView {
  id: string;
  /** Number of the song in the physical śpiewnik (hymnal), e.g. for announcing "pieśń nr 245". */
  number: number;
  slug: string;
  /** Locale-aware relative URL to this song's detail page, e.g. "/piesni/slug-id/". */
  href: string;
  title: string;
  verses: SongVerse[];
}

/** All songs, sorted by their śpiewnik (hymnal) number, ascending. */
export async function getSongs(): Promise<SongView[]> {
  const entries = await getCollection("songs");

  const sorted = entries
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id));

  return sorted.map((entry) => {
    const { data, id } = entry;
    const baseSlug = slugify(data.title);
    const slug = baseSlug ? `${baseSlug}-${id}` : id;
    const href = getRelativeLocaleUrl(defaultLocale, `/piesni/${slug}/`);

    return {
      id,
      number: Number(id),
      slug,
      href,
      title: data.title,
      verses: data.verses,
    };
  });
}
