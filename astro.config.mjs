import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://kztg.pl",
  output: "static",
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: "pl",
        locales: {
          pl: "pl-PL",
          en: "en-US",
          ua: "uk-UA",
          de: "de-DE",
          es: "es-ES",
          ta: "ta-IN",
        },
      },
    }),
  ],
  i18n: {
    defaultLocale: "pl",
    // Ukrainian: URL path is "ua" (avoids reading as "United Kingdom"), but the
    // actual language code stays the correct ISO 639-1 "uk" for hreflang/lang.
    locales: ["pl", "en", { path: "ua", codes: ["uk"] }, "de", "es", "ta"],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
