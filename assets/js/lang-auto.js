/**
 * Language Toggle Otomatis (ID <-> EN)
 * - Tanpa kamus terjemahan manual
 * - Memakai Google Translate Website Translator yang disembunyikan
 * - Menyimpan pilihan bahasa ke localStorage
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
    return safeGetStorage(LANG_KEY, DEFAULT_LANG);
  }

  function setSavedLang(lang) {
    safeSetStorage(LANG_KEY, lang);
  }

  function setLangLabel(lang) {
    var label = document.getElementById('lang-label');
    if (!label) return;
    label.textContent = lang === 'en' ? '🇬🇧 EN' : '🇮🇩 ID';
  }

  function ensureHiddenTranslateContainer() {
    if (document.getElementById('google_translate_element')) return;
    var el = document.createElement('div');
    el.id = 'google_translate_element';
    el.className = 'gtranslate-hidden';
    document.body.appendChild(el);
  }

  function doTranslateTo(targetLang) {
    var select = document.querySelector('select.goog-te-combo');
    if (!select) {
      if (translateRetryCount >= MAX_TRANSLATE_RETRIES) return;
      translateRetryCount += 1;
      setTimeout(function () { doTranslateTo(targetLang); }, 150);
      return;
    }
    translateRetryCount = 0;
    select.value = targetLang;
    select.dispatchEvent(new Event('change'));
    document.documentElement.lang = targetLang;
  }

  function toggleLanguage() {
    var current = getSavedLang();
    var next = current === 'id' ? 'en' : 'id';
    setSavedLang(next);
    setLangLabel(next);
    // Broadcast supaya file lain (contoh: homepage tagline) bisa ikut update
    try {
      document.dispatchEvent(new CustomEvent('gs:lang-changed', { detail: { lang: next } }));
    } catch (e) {
      // Fallback untuk browser lama
      try {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('gs:lang-changed', false, false, { lang: next });
        document.dispatchEvent(evt);
      } catch (e2) {}
    }
    doTranslateTo(next);
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

      var saved = getSavedLang();
      setLangLabel(saved);
      if (saved !== DEFAULT_LANG) doTranslateTo(saved);
    };

    var s = document.createElement('script');
    s.id = 'google-translate-script';
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);
  }

  function initLangAuto() {
    ensureHiddenTranslateContainer();
    loadGoogleTranslateScriptOnce();
    setLangLabel(getSavedLang());

    var btn = document.getElementById('langToggle');
    if (btn && !btn.dataset.langBound) {
      btn.dataset.langBound = '1';
      btn.addEventListener('click', toggleLanguage);
    }
  }

  // Inisialisasi aman walau script dimuat setelah DOMContentLoaded (misalnya pakai defer/late injection)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLangAuto);
  } else {
    initLangAuto();
  }
})();
