'use strict';

// Restore theme secepat mungkin supaya tidak flash ke tema default.
(function restoreTheme() {
  try {
    const savedTheme = localStorage.getItem('gs-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

// Render ulang icon Feather setelah DOM siap.
document.addEventListener('DOMContentLoaded', function () {
  if (window.feather && typeof window.feather.replace === 'function') {
    window.feather.replace();
  }

  try {
    var origin = window.location.origin || 'https://nusabit.netlify.app';
    var canonical = document.getElementById('canonical-link');
    var ogUrl = document.getElementById('og-url');
    if (canonical) canonical.href = origin + '/';
    if (ogUrl) ogUrl.setAttribute('content', origin + '/');

    [
      { id: 'org-jsonld', replacer: function (data) {
        data.url = origin;
        if (data.logo && typeof data.logo === 'object') {
          data.logo.url = origin + '/assets/img/studio_logo.png';
        }
        if (Array.isArray(data.potentialAction)) {
          data.potentialAction = data.potentialAction.map(function (item) {
            if (!item || typeof item !== 'object') return item;
            if (item.name === 'Games') item.target = origin + '/game/';
            if (item.name === 'Tiket') item.target = origin + '/tiket/';
            return item;
          });
        }
        return data;
      } },
      { id: 'person-jsonld', replacer: function (data) {
        data.url = origin;
        return data;
      } },
      { id: 'website-jsonld', replacer: function (data) {
        data.url = origin;
        if (data.potentialAction && data.potentialAction.target) {
          data.potentialAction.target.urlTemplate = origin + '/?q={search_term_string}';
        }
        return data;
      } }
    ].forEach(function (entry) {
      var el = document.getElementById(entry.id);
      if (!el) return;
      var raw = (el.textContent || '').trim();
      if (!raw) return;
      var parsed = JSON.parse(raw);
      el.textContent = JSON.stringify(entry.replacer(parsed), null, 2);
    });
  } catch (error) {
    // Abaikan error sinkronisasi SEO agar tidak mengganggu render halaman.
  }
});
