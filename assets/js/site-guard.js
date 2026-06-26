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
  const MAINTENANCE_URL = '/errors/maintenance.html';

  // Jangan ganggu halaman error & admin panel
  const path = window.location.pathname || '/';
  if (path.startsWith('/admin')) return;
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
      if (isMaintenance && path !== MAINTENANCE_URL) {
        window.location.replace(MAINTENANCE_URL);
      }
    })
    .catch(function () {
      // Kalau fetch gagal, jangan blok user
    });
})();

