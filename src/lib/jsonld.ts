import type { SermonView } from "./sermons";

const SITE_NAME = "Kościół Zmartwychwstałego w Tarnowskich Górach";
const ORG_DESC =
  "Chrześcijańska wspólnota z pasją do Boga i ludzi. Nabożeństwa na żywo i online, kazania, modlitwa i wsparcie w Tarnowskich Górach.";

function isoDuration(seconds: number): string | undefined {
  if (!seconds) return undefined;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return "PT" + (h ? h + "H" : "") + (m ? m + "M" : "") + (s ? s + "S" : "");
}

function buildAudioObject(s: SermonView, siteUrl: string, url: string, locale: string): Record<string, unknown> {
  const coverUrl = s.cover ? (s.cover.startsWith("http") ? s.cover : siteUrl + s.cover) : undefined;
  const obj: Record<string, unknown> = {
    "@type": "AudioObject",
    name: s.title,
    description: s.summary,
    contentUrl: s.audio,
    url,
    uploadDate: s.date,
    inLanguage: locale,
    publisher: { "@id": siteUrl + "/#organization" },
  };
  if (coverUrl) obj.thumbnailUrl = coverUrl;
  const duration = isoDuration(s.duration);
  if (duration) obj.duration = duration;
  if (s.preacher) obj.author = { "@type": "Person", name: s.preacher };
  return obj;
}

export function buildJsonLd(sermons: SermonView[], siteUrl: string, sermonsAnchor: string, locale: string): string {
  const org = {
    "@type": ["Organization", "Church"],
    "@id": siteUrl + "/#organization",
    name: SITE_NAME,
    description: ORG_DESC,
    url: siteUrl,
    logo: { "@type": "ImageObject", url: siteUrl + "/images/icons/icon-48x48.png" },
    address: {
      "@type": "PostalAddress",
      streetAddress: "Generała Andersa 61",
      postalCode: "42-600",
      addressLocality: "Tarnowskie Góry",
      addressCountry: "PL",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 50.44441097062951,
      longitude: 18.876954211011448,
    },
  };

  const audioObjects = sermons.map((s) =>
    buildAudioObject(s, siteUrl, s.href ? siteUrl + s.href : sermonsAnchor, locale),
  );

  return JSON.stringify([
    { "@context": "https://schema.org", ...org },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Kazania — " + SITE_NAME,
      url: sermonsAnchor,
      numberOfItems: sermons.length,
      itemListElement: audioObjects.map((obj, i) => ({ "@type": "ListItem", position: i + 1, item: obj })),
    },
  ]);
}

export function buildSermonJsonLd(sermon: SermonView, siteUrl: string, pageUrl: string, locale: string): string {
  const obj = buildAudioObject(sermon, siteUrl, pageUrl, locale);
  obj["@context"] = "https://schema.org";
  obj.mainEntityOfPage = pageUrl;
  return JSON.stringify(obj);
}
