(function setupPrivacyFirstAnalytics() {
  'use strict';

  const consentKey = 'booktalkietees:analytics-consent';
  const measurementId = String(window.BOOKTALKIETEES_GA_ID ?? '').trim();
  let analyticsLoaded = false;

  function hasValidMeasurementId() {
    return /^G-[A-Z0-9]+$/i.test(measurementId);
  }

  function readConsent() {
    try {
      const value = localStorage.getItem(consentKey);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch {
      return null;
    }
  }

  function saveConsent(value) {
    try {
      localStorage.setItem(consentKey, value);
    } catch {
      // Consent still applies for this page even if browser storage is unavailable.
    }
  }

  function loadAnalytics() {
    if (analyticsLoaded || !hasValidMeasurementId()) return;
    analyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.append(script);
  }

  function track(name, parameters = {}) {
    if (readConsent() !== 'granted' || !hasValidMeasurementId()) return;
    loadAnalytics();
    window.gtag?.('event', name, parameters);
  }

  function hideDialog() {
    document.querySelector('#analyticsConsent')?.remove();
  }

  function chooseConsent(value) {
    saveConsent(value);
    hideDialog();
    if (value === 'granted') {
      loadAnalytics();
      track('page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
      });
    }
  }

  function showDialog() {
    hideDialog();
    const dialog = document.createElement('section');
    dialog.id = 'analyticsConsent';
    dialog.className = 'consent-banner';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'analyticsConsentTitle');
    dialog.innerHTML = `
      <div class="consent-copy">
        <h2 id="analyticsConsentTitle">Your privacy choice</h2>
        <p>May we use optional Google Analytics to understand how the website is used? It is off unless you accept. We do not use it for advertising or send cart contents, searches, names, or email addresses.</p>
        <a href="privacy.html">Read the Privacy Policy</a>
      </div>
      <div class="consent-actions">
        <button class="button secondary" type="button" data-consent="denied">Reject analytics</button>
        <button class="button" type="button" data-consent="granted">Accept analytics</button>
      </div>`;
    document.body.append(dialog);
    dialog.querySelectorAll('[data-consent]').forEach((button) => {
      button.addEventListener('click', () => chooseConsent(button.dataset.consent));
    });
    dialog.querySelector('[data-consent="denied"]')?.focus();
  }

  window.bookTalkieAnalytics = {
    track,
    showPrivacySettings: showDialog,
    isConfigured: hasValidMeasurementId(),
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-privacy-settings]')) showDialog();
  });

  const consent = readConsent();
  if (consent === 'granted') {
    loadAnalytics();
    track('page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname,
    });
  }
  if (!consent) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showDialog, { once: true });
    else showDialog();
  }
})();
