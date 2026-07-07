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

  function getSavedLang() {
    return localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
  }

  function setSavedLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
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
      setTimeout(function () { doTranslateTo(targetLang); }, 150);
      return;
    }
    select.value = targetLang;
    select.dispatchEvent(new Event('change'));
    document.documentElement.lang = targetLang;
  }

  function toggleLanguage() {
    var current = getSavedLang();
    var next = current === 'id' ? 'en' : 'id';
    setSavedLang(next);
    setLangLabel(next);
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

  document.addEventListener('DOMContentLoaded', function () {
    ensureHiddenTranslateContainer();
    loadGoogleTranslateScriptOnce();
    setLangLabel(getSavedLang());

    var btn = document.getElementById('langToggle');
    if (btn && !btn.dataset.langBound) {
      btn.dataset.langBound = '1';
      btn.addEventListener('click', toggleLanguage);
    }
  });
})();

