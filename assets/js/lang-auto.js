/**
 * Language Toggle Otomatis (ID <-> EN)
 * - Tanpa kamus terjemahan manual
 * - Memakai Google Translate Website Translator yang disembunyikan
 * - Menyimpan pilihan bahasa ke localStorage
 * - Menyinkronkan bahasa antar halaman HTML
 *
 * Catatan:
 * - Script ini aman dijalankan di semua halaman. Jika tombol `#langToggle`
 *   tidak ada, script hanya menerapkan bahasa tersimpan (jika perlu).
 */
'use strict';

(function () {
  var LANG_KEY = 'gs_lang';
  var DEFAULT_LANG = 'id';
  var MAX_TRANSLATE_RETRIES = 20;
  var translateRetryCount = 0;
  var retryTimer = null;
  var mutationTimer = null;
  var bodyObserver = null;

  function safeGetStorage(key, fallbackValue) {
    try {
      var value = localStorage.getItem(key);
      return value || fallbackValue;
    } catch (err) {
      return fallbackValue;
    }
  }

  function safeSetStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      // ignore storage errors (private mode / blocked storage)
    }
  }

  function getSavedLang() {
    var saved = safeGetStorage(LANG_KEY, DEFAULT_LANG);
    return saved === 'en' ? 'en' : DEFAULT_LANG;
  }

  function setSavedLang(lang) {
    safeSetStorage(LANG_KEY, lang === 'en' ? 'en' : DEFAULT_LANG);
  }

  function setTranslateCookie(lang) {
    var targetLang = lang === 'en' ? 'en' : DEFAULT_LANG;
    var value = targetLang === 'en' ? '/id/en' : '/id/id';
    var maxAge = 60 * 60 * 24 * 365;
    var secure = window.location.protocol === 'https:' ? '; Secure' : '';
    var hostname = window.location.hostname || '';

    document.cookie = 'googtrans=' + value + '; path=/; max-age=' + maxAge + '; SameSite=Lax' + secure;

    if (hostname && hostname.indexOf('.') !== -1 && hostname !== 'localhost') {
      document.cookie = 'googtrans=' + value + '; domain=.' + hostname + '; path=/; max-age=' + maxAge + '; SameSite=Lax' + secure;
    }
  }

  function applyHtmlLangState(lang) {
    var targetLang = lang === 'en' ? 'en' : DEFAULT_LANG;
    document.documentElement.lang = targetLang;
    document.documentElement.setAttribute('data-gs-lang', targetLang);
    window.__GS_LANG__ = targetLang;
    setTranslateCookie(targetLang);
  }

  function setLangLabel(lang) {
    var label = document.getElementById('lang-label');
    if (!label) return;
    label.textContent = lang === 'en' ? '🇬🇧 EN' : '🇮🇩 ID';
  }

  function emitLangChanged(lang) {
    var detail = { lang: lang === 'en' ? 'en' : DEFAULT_LANG };
    try {
      document.dispatchEvent(new CustomEvent('gs:lang-changed', { detail: detail }));
    } catch (e) {
      try {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('gs:lang-changed', false, false, detail);
        document.dispatchEvent(evt);
      } catch (e2) {}
    }
  }

  function ensureHiddenTranslateContainer() {
    if (document.getElementById('google_translate_element')) return;
    var el = document.createElement('div');
    el.id = 'google_translate_element';
    el.className = 'gtranslate-hidden';
    document.body.appendChild(el);
  }

  function doTranslateTo(targetLang) {
    var nextLang = targetLang === 'en' ? 'en' : DEFAULT_LANG;
    applyHtmlLangState(nextLang);

    var select = document.querySelector('select.goog-te-combo');
    if (!select) {
      if (translateRetryCount >= MAX_TRANSLATE_RETRIES) return;
      translateRetryCount += 1;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(function () {
        doTranslateTo(nextLang);
      }, 150);
      return;
    }

    translateRetryCount = 0;

    if (select.value !== nextLang) {
      select.value = nextLang;
      select.dispatchEvent(new Event('change'));
      return;
    }

    select.dispatchEvent(new Event('change'));
  }

  function syncSavedLanguage(options) {
    var opts = options || {};
    var lang = getSavedLang();
    applyHtmlLangState(lang);
    setLangLabel(lang);
    if (opts.emit !== false) emitLangChanged(lang);
    doTranslateTo(lang);
  }

  function scheduleResync(delay, options) {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(function () {
      syncSavedLanguage(options);
    }, typeof delay === 'number' ? delay : 0);
  }

  function startMutationObserver() {
    if (bodyObserver || !document.body) return;

    bodyObserver = new MutationObserver(function (mutations) {
      if (getSavedLang() !== 'en') return;

      var shouldResync = mutations.some(function (mutation) {
        return mutation.type === 'childList' && mutation.addedNodes && mutation.addedNodes.length;
      });

      if (!shouldResync) return;
      scheduleResync(120, { emit: false });
    });

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function loadGoogleTranslateScriptOnce() {
    if (document.getElementById('google-translate-script')) return;

    window.googleTranslateElementInit = function () {
      // eslint-disable-next-line no-undef
      new google.translate.TranslateElement(
        {
          pageLanguage: 'id',
          includedLanguages: 'id,en',
          autoDisplay: false
        },
        'google_translate_element'
      );

      syncSavedLanguage({ emit: false });
    };

    var s = document.createElement('script');
    s.id = 'google-translate-script';
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);
  }

  function bindEvents() {
    var btn = document.getElementById('langToggle');
    if (btn && !btn.dataset.langBound) {
      btn.dataset.langBound = '1';
      btn.addEventListener('click', function () {
        var current = getSavedLang();
        var next = current === 'id' ? 'en' : 'id';
        setSavedLang(next);
        syncSavedLanguage();
      });
    }

    if (!window.__gsLangStorageBound) {
      window.__gsLangStorageBound = true;
      window.addEventListener('storage', function (event) {
        if (event.key && event.key !== LANG_KEY) return;
        scheduleResync(0);
      });

      window.addEventListener('pageshow', function () {
        scheduleResync(0, { emit: false });
      });

      window.addEventListener('load', function () {
        scheduleResync(0, { emit: false });
      });

      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) scheduleResync(0, { emit: false });
      });
    }
  }

  function initLangAuto() {
    applyHtmlLangState(getSavedLang());
    ensureHiddenTranslateContainer();
    setLangLabel(getSavedLang());
    bindEvents();
    startMutationObserver();
    loadGoogleTranslateScriptOnce();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLangAuto);
  } else {
    initLangAuto();
  }
})();
