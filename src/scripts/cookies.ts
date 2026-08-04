const COOKIE_KEY = "kztg_cookie_consent";

export function initCookies(): void {
  const banner = document.getElementById("cookieBanner");
  const acceptBtn = document.getElementById("cookieAcceptBtn");
  const rejectBtn = document.getElementById("cookieNecessaryBtn");
  const settingsBtn = document.getElementById("cookieSettingsBtn");
  const mapFrame = document.getElementById("contactMapFrame") as HTMLIFrameElement | null;
  const mapPlaceholder = document.getElementById("contactMapPlaceholder");
  const mapConsentBtn = document.getElementById("contactMapConsentBtn");

  function getConsent(): string | null {
    try {
      return localStorage.getItem(COOKIE_KEY);
    } catch {
      return null;
    }
  }

  function setConsent(value: string): void {
    try {
      localStorage.setItem(COOKIE_KEY, value);
    } catch {
      // Ignore storage errors (private mode/quota), UX still works in-session.
    }
  }

  function applyMap(accepted: boolean): void {
    if (!mapFrame || !mapPlaceholder) return;
    if (accepted) {
      if (!mapFrame.getAttribute("src") || mapFrame.getAttribute("src") === "about:blank") {
        mapFrame.setAttribute("src", mapFrame.dataset.src || "");
      }
      mapFrame.classList.remove("hidden");
      mapPlaceholder.classList.add("hidden");
      return;
    }
    mapFrame.setAttribute("src", "about:blank");
    mapFrame.classList.add("hidden");
    mapPlaceholder.classList.remove("hidden");
  }

  function hideBanner(): void {
    banner?.classList.add("hidden");
  }

  function showBanner(): void {
    banner?.classList.remove("hidden");
  }

  function acceptCookies(): void {
    setConsent("accepted");
    applyMap(true);
    hideBanner();
  }

  function rejectCookies(): void {
    setConsent("rejected");
    applyMap(false);
    hideBanner();
  }

  const savedConsent = getConsent();

  if (!savedConsent) {
    showBanner();
    applyMap(true);
  } else {
    applyMap(savedConsent === "accepted");
  }

  acceptBtn?.addEventListener("click", acceptCookies);
  rejectBtn?.addEventListener("click", rejectCookies);
  mapConsentBtn?.addEventListener("click", acceptCookies);
  settingsBtn?.addEventListener("click", showBanner);
}
