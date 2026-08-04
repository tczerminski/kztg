import { getCollection, getEntry } from "astro:content";
import { getRelativeLocaleUrl } from "astro:i18n";
import type { Locale } from "../i18n/utils";
import { defaultLocale, sermonsPathSegment } from "../i18n/utils";

export interface SermonView {
  id: string;
  slug: string;
  /** Locale-aware relative URL to this sermon's detail page, e.g. "/kazania/slug-id/" or "/en/sermons/slug-id/". */
  href: string;
  date: string;
  dateDisplay: string;
  preacher: string;
  title: string;
  summary: string;
  audio: string;
  cover?: string;
  duration: number;
  durationDisplay: string;
  isTTS: boolean;
  /** All locale titles, used to build the client-side search index. */
  searchTitles: string[];
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Sermons for a given locale, sorted newest-first (matches pipeline.py's write order)
 * and filtered to the "only show sermons with a TTS dub" rule for non-Polish locales.
 */
export async function getSermonsForLocale(locale: Locale): Promise<SermonView[]> {
  const entries = await getCollection("sermons", (entry) => !entry.data.hidden);

  const sorted = entries
    .slice()
    .sort((a, b) => {
      if (a.data.date !== b.data.date) return a.data.date < b.data.date ? 1 : -1;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    });

  const filtered =
    locale === defaultLocale
      ? sorted
      : sorted.filter((entry) => !!entry.data.tts?.[locale]);

  return filtered.map((entry) => {
    const { data, id } = entry;
    const translation = data.translations?.[locale];
    const isURL = data.tts?.[locale];
    const isTTS = locale !== defaultLocale && !!isURL;
    const durationSecs = (isTTS && data.tts_durations?.[locale]) || data.duration;

    const searchTitles = [data.title, ...Object.values(data.translations ?? {}).map((tr) => tr.title)];
    const title = translation?.title || data.title;

    const baseSlug = slugify(title);
    const slug = baseSlug ? `${baseSlug}-${id}` : id;
    const href = getRelativeLocaleUrl(locale, `/${sermonsPathSegment(locale)}/${slug}/`);

    return {
      id,
      slug,
      href,
      date: data.date,
      dateDisplay: formatDate(data.date),
      preacher: data.preacher,
      title,
      summary: translation?.summary || data.summary,
      audio: isURL || data.audio,
      cover: data.cover,
      duration: durationSecs,
      durationDisplay: formatDuration(durationSecs),
      isTTS: isTTS,
      searchTitles,
    };
  });
}

/**
 * Full transcript text for a single sermon, in the given locale (falls back to
 * Polish if untranslated). Fetched separately from getSermonsForLocale() so the
 * site-wide sermon list/search index (embedded as JSON on the homepage) never
 * carries full transcript text for every sermon.
 */
export async function getSermonTranscript(id: string, locale: Locale): Promise<string> {
  const entry = await getEntry("sermons", id);
  if (!entry) return "";
  const { transcript } = entry.data;
  return (locale === defaultLocale ? transcript?.pl : transcript?.[locale] ?? transcript?.pl) || "";
}
