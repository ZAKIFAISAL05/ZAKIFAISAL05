// ============================================================
//  assets/js/site-guard.js — Nusabit Studio
//  Fungsi:
//  1) Cek status maintenance dari server (Netlify Function + Blobs)
//  2) Redirect pengunjung umum ke halaman maintenance saat maintenance ON
//  3) Sediakan Developer Key / Bypass Mode untuk admin
//  4) Simpan hasil settings di window.__SITE_SETTINGS__ untuk dipakai file lain
// ============================================================
'use strict';

(function () {
  const SETTINGS_API = '/.netlify/functions/site-settings';
  const DEV_BYPASS_API = '/.netlify/functions/dev-bypass';
  const MAINTENANCE_URL = '/maintenance';
  const CHECK_INTERVAL_MS = 15000;

  const DEV_BYPASS_STORAGE_KEY = 'developer_bypass_key';

  const path = window.location.pathname || '/';
  const onMaintenancePage = function () {
    const currentPath = window.location.pathname || '/';
    return (
      currentPath === MAINTENANCE_URL ||
      currentPath === (MAINTENANCE_URL + '/') ||
      currentPath === '/errors/maintenance.html'
    );
  };

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  async function validateBypassToken(token) {
    const t = normalizeKey(token);
    if (!t) return false;
    try {
      const url = `${DEV_BYPASS_API}?token=${encodeURIComponent(t)}`;
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      const data = await res.json();
      return !!(data && data.ok && data.valid);
    } catch {
      return false;
    }
  }

  async function hasDeveloperBypass() {
    try {
      const stored = localStorage.getItem(DEV_BYPASS_STORAGE_KEY);
      return validateBypassToken(stored);
    } catch (e) {
      return false;
    }
  }

  function deactivateDeveloperBypass() {
    try {
      localStorage.removeItem(DEV_BYPASS_STORAGE_KEY);
    } catch (e) {}
    window.__DEV_BYPASS__.isActive = false;
  }

  function softRedirect(toUrl) {
    try {
      document.documentElement.classList.add('gs-fade-out');
      document.body && document.body.classList.add('gs-fade-out');
    } catch (e) {}

    setTimeout(function () {
      window.location.replace(toUrl);
    }, 260);
  }

  window.__DEV_BYPASS__ = {
    storageKey: DEV_BYPASS_STORAGE_KEY,
    isActive: false,
    hasValidBypass: hasDeveloperBypass,
    validateToken: validateBypassToken,
    deactivate: deactivateDeveloperBypass,
  };

  // Jangan ganggu halaman admin, 404, dan error lain selain maintenance.
  // Helper di atas tetap tersedia untuk admin panel.
  if (path.startsWith('/admin')) return;
  if (path.startsWith('/errors/') && !onMaintenancePage()) return;
  if (path === '/404.html') return;

  async function applySettings(data) {
    if (!data || !data.ok) return;

    window.__SITE_SETTINGS__ = data.settings || {};

    const bypassActive = await hasDeveloperBypass();
    window.__DEV_BYPASS__.isActive = bypassActive;

    const isMaintenance = !!(data.settings && data.settings.maintenance && data.settings.maintenance.enabled);

    // Jika admin punya bypass valid dan sedang berada di halaman maintenance,
    // langsung kembalikan ke website asli.
    if (bypassActive) {
      if (onMaintenancePage()) {
        softRedirect('/');
      }
      return;
    }

    if (isMaintenance && !onMaintenancePage()) {
      softRedirect(MAINTENANCE_URL);
    }
  }

  async function checkOnce() {
    try {
      const response = await fetch(SETTINGS_API, { method: 'GET', cache: 'no-store' });
      const data = await response.json();
      await applySettings(data);
    } catch (e) {
      // Kalau fetch gagal, jangan blok user
    }
  }

  checkOnce();
  setInterval(checkOnce, CHECK_INTERVAL_MS);
})();
