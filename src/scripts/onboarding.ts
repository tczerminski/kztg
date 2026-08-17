import type { TourDict } from "../i18n/types";

let tourBtn: HTMLButtonElement | null = null;

interface TourStepConfig {
  selector: string | null;
  popoverOverride?: Record<string, unknown>;
}

interface TourProfile {
  storageKey: string;
  tour: TourDict;
  stepConfigs: TourStepConfig[];
  restartStepIndex: number;
}

function getRadioEl(): string {
  return window.innerWidth < 768 ? "#radio-mobile" : "#radioPlayBtn";
}

function getLangSwitcherEl(): string {
  return window.innerWidth < 768 ? ".lang-switcher--hero" : "#siteHeader nav";
}

function getSermonBackLinkEl(): string {
  return window.innerWidth < 768 ? "#sermon-back-link-mobile" : "#sermon-back-link-desktop";
}

function getSongBackLinkEl(): string {
  return window.innerWidth < 768 ? "#song-back-link-mobile" : "#song-back-link-desktop";
}

let driverStylesheetLoaded = false;

/** Inserts driver.js's base stylesheet via a plain <link>, loaded from a
 * build-time-resolved URL (`?url`) rather than a dynamic CSS-module import —
 * the latter relies on the browser's modulepreload machinery, which was
 * silently failing here and made the tour's first click a no-op. */
function loadDriverStylesheet(href: string): void {
  if (driverStylesheetLoaded) return;
  driverStylesheetLoaded = true;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function injectDriverCSS(): void {
  if (document.getElementById("driver-custom-css")) return;

  const style = document.createElement("style");
  style.id = "driver-custom-css";
  style.textContent = [
    ".driver-popover-footer button {",
    "  font-family: inherit;",
    "  font-size: 0.875rem;",
    "  font-weight: 600;",
    "  padding: 0.5rem 1.25rem;",
    "  border-radius: 0.75rem;",
    "  border: none;",
    "  cursor: pointer;",
    "  transition: background 0.2s, color 0.2s;",
    "  text-shadow: none;",
    "}",
    ".driver-popover-next-btn {",
    "  background: #fff !important;",
    "  color: #7b8fc4 !important;",
    "  border: 1.5px solid #7b8fc4 !important;",
    "}",
    ".driver-popover-next-btn:hover {",
    "  background: #7b8fc4 !important;",
    "  color: #fff !important;",
    "  border-color: #7b8fc4 !important;",
    "}",
    ".driver-popover-prev-btn {",
    "  background: transparent !important;",
    "  color: #7b8fc4 !important;",
    "  border: 1.5px solid #7b8fc4 !important;",
    "}",
    ".driver-popover-prev-btn:hover {",
    "  background: #7b8fc4 !important;",
    "  color: #fff !important;",
    "  border-color: #7b8fc4 !important;",
    "}",
    ".driver-popover-close-btn {",
    "  color: #6b7280 !important;",
    "}",
    ".driver-popover-close-btn:hover {",
    "  color: #1f2a44 !important;",
    "}",
  ].join("\n");
  document.head.appendChild(style);
}

function startTour(profile: TourProfile): void {
  injectDriverCSS();
  Promise.all([import("driver.js"), import("driver.js/dist/driver.css?url")])
    .then(([mod, css]) => {
      loadDriverStylesheet(css.default);
      const driverFn = mod.driver;

      if (tourBtn) tourBtn.style.display = "none";

      // Skip steps whose target isn't on the page — some sections (radio, songs)
      // only render for certain locales, so their tour steps would otherwise
      // point at a selector that doesn't exist there.
      const steps = profile.tour.steps
        .map((step, i) => {
          const cfg = profile.stepConfigs[i];
          if (cfg?.selector && !document.querySelector(cfg.selector)) return null;

          const popover = { title: step.title, description: step.desc, ...(cfg?.popoverOverride || {}) };
          const stepObj: Record<string, unknown> = { popover };
          if (cfg?.selector) stepObj.element = cfg.selector;
          if (i === profile.restartStepIndex) {
            stepObj.onHighlightStarted = () => {
              if (tourBtn) tourBtn.style.display = "";
            };
          }
          return stepObj;
        })
        .filter((step): step is Record<string, unknown> => step !== null);

      const d = driverFn({
        animate: true,
        smoothScroll: false,
        showProgress: true,
        progressText: profile.tour.progress,
        nextBtnText: profile.tour.next,
        prevBtnText: profile.tour.prev,
        doneBtnText: profile.tour.done,
        steps,
        onDestroyed: () => {
          localStorage.setItem(profile.storageKey, "1");
          if (tourBtn) tourBtn.style.display = "";
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      });

      d.drive();
    })
    .catch((err) => {
      console.error("Failed to load tour", err);
    });
}

function addTourButton(onClick: () => void): void {
  const btn = document.createElement("button");
  btn.id = "tourBtn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Tour");
  btn.style.cssText = [
    "position:fixed",
    "bottom:1.5rem",
    "right:1.5rem",
    "z-index:40",
    "width:2.75rem",
    "height:2.75rem",
    "border-radius:50%",
    "background:#fff",
    "color:#7b8fc4",
    "border:1.5px solid #7b8fc4",
    "cursor:pointer",
    "font-size:1.375rem",
    "font-weight:700",
    "line-height:1",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "transition:background 0.2s, color 0.2s",
  ].join(";");
  btn.textContent = "?";
  btn.addEventListener("mouseover", () => { btn.style.background = "#7b8fc4"; btn.style.color = "#fff"; });
  btn.addEventListener("mouseout", () => { btn.style.background = "#fff"; btn.style.color = "#7b8fc4"; });
  btn.addEventListener("click", onClick);
  tourBtn = btn;
  document.body.appendChild(btn);
}

function waitForCookieDecision(cb: () => void): void {
  const banner = document.getElementById("cookieBanner");
  if (!banner || banner.classList.contains("hidden")) {
    cb();
    return;
  }
  const obs = new MutationObserver(() => {
    if (banner.classList.contains("hidden")) {
      obs.disconnect();
      setTimeout(cb, 400);
    }
  });
  obs.observe(banner, { attributes: true, attributeFilter: ["class"] });
}

function runProfile(profile: TourProfile): void {
  addTourButton(() => startTour(profile));

  if (!localStorage.getItem(profile.storageKey)) {
    waitForCookieDecision(() => {
      setTimeout(() => startTour(profile), 500);
    });
  }
}

/** Homepage tour: radio, sermon search, donations, contact form, etc.
 * The Śpiewnik steps (`tour.songsSteps`) only exist in pl.ts, since that section is
 * pl-only — they're spliced in here rather than living in the shared `steps` array,
 * so other locales' step lists don't need matching (never-shown) dummy entries. */
export function initOnboarding(tour: TourDict): void {
  const baseSteps = tour.steps;
  const baseConfigs: TourStepConfig[] = [
    { selector: null },
    { selector: getLangSwitcherEl() },
    { selector: getRadioEl() },
    { selector: "#sermons-search" },
    { selector: ".sermon-inline-player__toggle" },
    { selector: ".sermon-card-details-link" },
    { selector: "#sermons-nav" },
    { selector: "#darowizny", popoverOverride: { side: "bottom" } },
    { selector: "#contactForm" },
    { selector: "#tourBtn" },
  ];

  const steps = tour.songsSteps
    ? [...baseSteps.slice(0, 7), ...tour.songsSteps, ...baseSteps.slice(7)]
    : baseSteps;
  const stepConfigs = tour.songsSteps
    ? [
        ...baseConfigs.slice(0, 7),
        { selector: "#songs-search" },
        { selector: ".song-row" },
        ...baseConfigs.slice(7),
      ]
    : baseConfigs;

  runProfile({
    storageKey: "kztg-tour-seen",
    tour: { ...tour, steps },
    stepConfigs,
    restartStepIndex: steps.length - 1,
  });
}

/** Sermon detail page tour: back link, player, transcript, restart button.
 * Separate from the homepage tour since none of its target elements exist here. */
export function initSermonOnboarding(tour: TourDict): void {
  runProfile({
    storageKey: "kztg-sermon-tour-seen",
    tour,
    stepConfigs: [
      { selector: null },
      { selector: getSermonBackLinkEl() },
      { selector: ".sermon-inline-player__toggle" },
      { selector: "#sermon-transcript" },
      { selector: "#tourBtn" },
    ],
    restartStepIndex: 4,
  });
}

/** Song detail page tour: back link, number/title, numbered verses, restart button.
 * Separate from the sermon/homepage tours since none of its target elements exist here. */
export function initSongOnboarding(tour: TourDict): void {
  runProfile({
    storageKey: "kztg-song-tour-seen",
    tour,
    stepConfigs: [
      { selector: null },
      { selector: getSongBackLinkEl() },
      { selector: ".song-heading" },
      { selector: ".song-verse" },
      { selector: "#tourBtn" },
    ],
    restartStepIndex: 4,
  });
}
