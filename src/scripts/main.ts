import { getTour, getSermonTour, getSongTour, locales, defaultLocale, type Locale } from "../i18n/utils";
import { initAudioPlayer } from "./audio-player";
import { initSermonsClient } from "./sermons-client";
import { initSongsClient } from "./songs-client";
import { initContactForm } from "./contact-form";
import { initCookies } from "./cookies";
import { initOnboarding, initSermonOnboarding, initSongOnboarding } from "./onboarding";
import { initBackToTop } from "./back-to-top";
import { initTranscriptToggle } from "./transcript-toggle";
import { registerServiceWorker } from "./pwa";
import { initNetworkStatus } from "./network-status";

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function currentLocale(): Locale {
  const lang = document.documentElement.lang as Locale;
  return locales.includes(lang) ? lang : defaultLocale;
}

document.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-scroll-target]");
  if (!target) return;
  document.getElementById(target.dataset.scrollTarget || "")?.scrollIntoView({ behavior: "smooth" });
});

initAudioPlayer();
initSermonsClient();
initSongsClient();
initContactForm();
initCookies();
initTranscriptToggle();
if (document.getElementById("sermon-top")) {
  initSermonOnboarding(getSermonTour(currentLocale()));
} else if (document.getElementById("song-top")) {
  initSongOnboarding(getSongTour(currentLocale()));
} else {
  initOnboarding(getTour(currentLocale()));
}
initBackToTop();
initNetworkStatus();

let sentryInitialized = false;

function initSentry(): void {
  if (sentryInitialized) return;
  sentryInitialized = true;

  import("@sentry/browser")
    .then((Sentry) => {
      Sentry.init({
        dsn: "https://0b9053c3f5e3b79a065a171e4c31012f@o4511420811509761.ingest.de.sentry.io/4511420815442000",
        environment: import.meta.env.MODE || "production",
        sendDefaultPii: true,
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        integrations: [],
      });
    })
    .catch(() => {
      sentryInitialized = false;
    });
}

function scheduleSentryInit(): void {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => setTimeout(initSentry, 3500), { timeout: 7000 });
    return;
  }
  setTimeout(initSentry, 3500);
}

window.addEventListener("load", scheduleSentryInit, { once: true });
window.addEventListener("load", registerServiceWorker, { once: true });
