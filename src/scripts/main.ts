import { getTour, getSermonTour, locales, defaultLocale, type Locale } from "../i18n/utils";
import { initAudioPlayer } from "./audio-player";
import { initSermonsClient } from "./sermons-client";
import { initContactForm } from "./contact-form";
import { initCookies } from "./cookies";
import { initOnboarding, initSermonOnboarding } from "./onboarding";
import { initBackToTop } from "./back-to-top";

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
initContactForm();
initCookies();
if (document.getElementById("sermon-top")) {
  initSermonOnboarding(getSermonTour(currentLocale()));
} else {
  initOnboarding(getTour(currentLocale()));
}
initBackToTop();

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
