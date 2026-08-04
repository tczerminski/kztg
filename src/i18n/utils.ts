import type { LocaleDict, TourDict } from "./types";
import pl from "./locales/pl";
import en from "./locales/en";
import uk from "./locales/uk";
import de from "./locales/de";
import es from "./locales/es";
import ta from "./locales/ta";

export const locales = ["pl", "en", "uk", "de", "es", "ta"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pl";

const dictionaries: Record<Locale, LocaleDict> = { pl, en, uk, de, es, ta };

export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale] ?? dictionaries[defaultLocale];
  let str = dict.strings[key] ?? dictionaries[defaultLocale].strings[key] ?? key;

  if (vars) {
    str = str.replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
    );
  }

  return str;
}

export function getTour(locale: Locale): TourDict {
  return dictionaries[locale]?.tour ?? dictionaries[defaultLocale].tour;
}

export function getSermonTour(locale: Locale): TourDict {
  return dictionaries[locale]?.sermonTour ?? dictionaries[defaultLocale].sermonTour;
}

/** Path prefix for a locale's routes: "" for the default locale, "/xx" otherwise. */
export function localePrefix(locale: Locale): string {
  return locale === defaultLocale ? "" : `/${locale}`;
}

/** Per-locale URL path segment for the sermon detail pages, e.g. /en/sermons/..., /de/predigten/... */
const SERMONS_PATH_SEGMENT: Record<Locale, string> = {
  pl: "kazania",
  en: "sermons",
  uk: "sermons",
  de: "predigten",
  es: "sermones",
  ta: "sermons",
};

export function sermonsPathSegment(locale: Locale): string {
  return SERMONS_PATH_SEGMENT[locale];
}

/**
 * URL path slug for a locale — differs from the (correct, ISO 639-1) language
 * code only for Ukrainian: "uk" is the right code for hreflang/lang, but reads
 * as "United Kingdom" in a URL, so the path uses "ua" instead (astro.config.mjs
 * maps the "ua" path back to the "uk" code via i18n.locales' codes option).
 */
const LOCALE_URL_SLUG: Record<Locale, string> = {
  pl: "pl",
  en: "en",
  uk: "ua",
  de: "de",
  es: "es",
  ta: "ta",
};

export function localeUrlSlug(locale: Locale): string {
  return LOCALE_URL_SLUG[locale];
}
