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

function injectDriverCSS(): void {
  if (document.getElementById("driver-css")) return;

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
    "  background: #3f568f !important;",
    "  color: #fff !important;",
    "}",
    ".driver-popover-next-btn:hover {",
    "  background: #334577 !important;",
    "}",
    ".driver-popover-prev-btn {",
    "  background: transparent !important;",
    "  color: #3f568f !important;",
    "  border: 1.5px solid #3f568f !important;",
    "}",
    ".driver-popover-prev-btn:hover {",
    "  background: #eef1f8 !important;",
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
  Promise.all([import("driver.js"), import("driver.js/dist/driver.css")]).then(([mod]) => {
    const driverFn = mod.driver;

    if (tourBtn) tourBtn.style.display = "none";

    const steps = profile.tour.steps.map((step, i) => {
      const cfg = profile.stepConfigs[i];
      const popover = { title: step.title, description: step.desc, ...(cfg?.popoverOverride || {}) };
      const stepObj: Record<string, unknown> = { popover };
      if (cfg?.selector) stepObj.element = cfg.selector;
      if (i === profile.restartStepIndex) {
        stepObj.onHighlightStarted = () => {
          if (tourBtn) tourBtn.style.display = "";
        };
      }
      return stepObj;
    });

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
    "background:#3f568f",
    "color:#fff",
    "border:none",
    "cursor:pointer",
    "font-size:1.375rem",
    "font-weight:700",
    "line-height:1",
    "box-shadow:0 4px 12px rgba(0,0,0,0.25)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "transition:background 0.2s",
  ].join(";");
  btn.textContent = "?";
  btn.addEventListener("mouseover", () => { btn.style.background = "#334577"; });
  btn.addEventListener("mouseout", () => { btn.style.background = "#3f568f"; });
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

/** Homepage tour: radio, sermon search, donations, contact form, etc. */
export function initOnboarding(tour: TourDict): void {
  runProfile({
    storageKey: "kztg-tour-seen",
    tour,
    stepConfigs: [
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
    ],
    restartStepIndex: 9,
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
      { selector: "#sermon-back-link" },
      { selector: ".sermon-inline-player__toggle" },
      { selector: "#sermon-transcript" },
      { selector: "#tourBtn" },
    ],
    restartStepIndex: 4,
  });
}
