(function () {
  const COOKIE_KEY = 'kztg_cookie_consent';
  const banner = document.getElementById('cookieBanner');
  const acceptBtn = document.getElementById('cookieAcceptBtn');
  const rejectBtn = document.getElementById('cookieNecessaryBtn');
  const settingsBtn = document.getElementById('cookieSettingsBtn');
  const mapFrame = document.getElementById('contactMapFrame');
  const mapPlaceholder = document.getElementById('contactMapPlaceholder');
  const mapConsentBtn = document.getElementById('contactMapConsentBtn');

  function getConsent() {
    try {
      return localStorage.getItem(COOKIE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(COOKIE_KEY, value);
    } catch (e) {
      // Ignore storage errors (private mode/quota), UX still works in-session.
    }
  }

  function applyMap(accepted) {
    if (!mapFrame || !mapPlaceholder) return;
    if (accepted) {
      if (!mapFrame.getAttribute('src') || mapFrame.getAttribute('src') === 'about:blank') {
        mapFrame.setAttribute('src', mapFrame.dataset.src);
      }
      mapFrame.classList.remove('hidden');
      mapPlaceholder.classList.add('hidden');
      return;
    }
    mapFrame.setAttribute('src', 'about:blank');
    mapFrame.classList.add('hidden');
    mapPlaceholder.classList.remove('hidden');
  }

  function hideBanner() {
    if (banner) banner.classList.add('hidden');
  }

  function showBanner() {
    if (banner) banner.classList.remove('hidden');
  }
  function acceptCookies() {
    setConsent('accepted');
    applyMap(true);
    hideBanner();
  }

  function rejectCookies() {
    setConsent('rejected');
    applyMap(false);
    hideBanner();
  }

  const savedConsent = getConsent();

  if (!savedConsent) {
    showBanner();
    applyMap(true);
  } else {
    applyMap(savedConsent === 'accepted');
  }

  if (acceptBtn) acceptBtn.addEventListener('click', acceptCookies);
  if (rejectBtn) rejectBtn.addEventListener('click', rejectCookies);
  if (mapConsentBtn) mapConsentBtn.addEventListener('click', acceptCookies);
  if (settingsBtn) settingsBtn.addEventListener('click', showBanner);
})();
