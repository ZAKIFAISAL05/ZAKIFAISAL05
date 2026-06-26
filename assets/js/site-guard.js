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

  // Jangan ganggu halaman error & admin panel
  const path = window.location.pathname || '/';
  if (path.startsWith('/admin')) return;
  // Halaman error selain maintenance tidak perlu di-redirect
  if (path.startsWith('/errors/')) return;
  if (path === '/404.html') return;

  // Ambil settings dari server
  fetch(SETTINGS_API, { method: 'GET', cache: 'no-store' })
    .then((r) => r.json())
    .then((data) => {
      if (!data || !data.ok) return;

      window.__SITE_SETTINGS__ = data.settings || {};

      // Redirect kalau maintenance aktif
      const isMaintenance = !!(data.settings && data.settings.maintenance && data.settings.maintenance.enabled);
      const onMaintenancePage =
        path === MAINTENANCE_URL ||
        path === (MAINTENANCE_URL + '/') ||
        path === '/errors/maintenance.html';

      if (isMaintenance && !onMaintenancePage) {
        window.location.replace(MAINTENANCE_URL);
        return;
      }

      // Kalau maintenance sudah OFF, pastikan halaman maintenance balik normal otomatis
      if (!isMaintenance && onMaintenancePage) {
        window.location.replace('/');
      }
    })
    .catch(function () {
      // Kalau fetch gagal, jangan blok user
    });
})();
