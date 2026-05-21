let sentryInitialized = false;

function initSentry() {
  if (sentryInitialized) {
    return;
  }
  sentryInitialized = true;

  import('@sentry/browser')
    .then((Sentry) => {
      Sentry.init({
        dsn: 'https://0b9053c3f5e3b79a065a171e4c31012f@o4511420811509761.ingest.de.sentry.io/4511420815442000',
        environment: process.env.NODE_ENV || 'production',
        sendDefaultPii: true,
        release: require('../package.json').version,
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        integrations: [],
        _metadata: {
          telemetry: { enabled: false },
        },
      });
    })
    .catch(() => {
      sentryInitialized = false;
    });
}

function scheduleSentryInit() {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(
      () => {
        setTimeout(initSentry, 3500);
      },
      { timeout: 7000 },
    );
    return;
  }
  setTimeout(initSentry, 3500);
}

window.addEventListener('load', scheduleSentryInit, { once: true });

import "./metadata.js";
import "./audio-player.js";
import "./contact-form.js";
import "./cookies.js";
import "./sermons.js";
