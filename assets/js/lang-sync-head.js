/**
 * Sinkronisasi bahasa awal untuk semua halaman.
 * Tujuan:
 * - membaca pilihan bahasa dari localStorage secepat mungkin
 * - menyamakan atribut `lang` pada `<html>`
 * - menulis cookie `googtrans` agar halaman lain mengikuti bahasa aktif
 */
'use strict';

(function () {
  var LANG_KEY = 'gs_lang';
  var DEFAULT_LANG = 'id';

  function safeGetSavedLang() {
    try {
      return localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
    } catch (err) {
      return DEFAULT_LANG;
    }
  }

  function setTranslateCookie(lang) {
    var value = lang === 'en' ? '/id/en' : '/id/id';
    var maxAge = 60 * 60 * 24 * 365;
    var secure = window.location.protocol === 'https:' ? '; Secure' : '';
    var hostname = window.location.hostname || '';

    document.cookie = 'googtrans=' + value + '; path=/; max-age=' + maxAge + '; SameSite=Lax' + secure;

    if (hostname && hostname.indexOf('.') !== -1 && hostname !== 'localhost') {
      document.cookie = 'googtrans=' + value + '; domain=.' + hostname + '; path=/; max-age=' + maxAge + '; SameSite=Lax' + secure;
    }
  }

  var lang = safeGetSavedLang();
  document.documentElement.lang = lang;
  document.documentElement.setAttribute('data-gs-lang', lang);
  window.__GS_LANG__ = lang;
  setTranslateCookie(lang);
})();
