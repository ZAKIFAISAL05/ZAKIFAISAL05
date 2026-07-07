// ============================================================
//  assets/js/site-guard.js — Nusabit Studio
//  Fungsi:
//  1) Cek status maintenance dari server (Netlify Function + Blobs)
//  2) Kalau maintenance ON, redirect pengunjung ke halaman maintenance
//  3) Simpan hasil settings di window.__SITE_SETTINGS__ untuk dipakai file lain
// ============================================================
'use strict';

(function () {
  const SETTINGS_API = '/.netlify/functions/site-settings';
  // Pakai URL yang rapi (lihat netlify.toml: /maintenance → /errors/maintenance.html)
  const MAINTENANCE_URL = '/maintenance';
  // Interval cek berkala supaya halaman yang sudah kebuka ikut "ngeh" saat maintenance dinyalakan
  const CHECK_INTERVAL_MS = 15000; // 15 detik (aman, tidak terlalu agresif)

  // Jangan ganggu halaman error & admin panel
  const path = window.location.pathname || '/';
  if (path.startsWith('/admin')) return;
  // Halaman error selain maintenance tidak perlu di-redirect
  if (path.startsWith('/errors/')) return;
  if (path === '/404.html') return;

  function softRedirect(toUrl) {
    try {
      // Efek fade-out halus sebelum pindah halaman (kalau CSS global tersedia)
      document.documentElement.classList.add('gs-fade-out');
      document.body && document.body.classList.add('gs-fade-out');
    } catch (e) {}

    // Delay pendek agar transisi terlihat (tanpa bikin terasa lambat)
    setTimeout(function () {
      window.location.replace(toUrl);
    }, 260);
  }

  function applySettings(data) {
    if (!data || !data.ok) return;

    window.__SITE_SETTINGS__ = data.settings || {};

    const isMaintenance = !!(data.settings && data.settings.maintenance && data.settings.maintenance.enabled);
    const currentPath = window.location.pathname || '/';
    const onMaintenancePage =
      currentPath === MAINTENANCE_URL ||
      currentPath === (MAINTENANCE_URL + '/') ||
      currentPath === '/errors/maintenance.html';

    // Redirect kalau maintenance aktif
    if (isMaintenance && !onMaintenancePage) {
      softRedirect(MAINTENANCE_URL);
      return;
    }
  }

  function checkOnce() {
    return fetch(SETTINGS_API, { method: 'GET', cache: 'no-store' })
      .then((r) => r.json())
      .then(applySettings)
      .catch(function () {
        // Kalau fetch gagal, jangan blok user
      });
  }

  // Cek pertama kali
  checkOnce();
  // Cek berkala (supaya halaman lama ikut ter-redirect saat maintenance ON)
  setInterval(checkOnce, CHECK_INTERVAL_MS);
})();
