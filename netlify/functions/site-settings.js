// ============================================================
//  netlify/functions/site-settings.js — Nusabit Studio
//  Global site settings (maintenance + announcement)
//
//  GET  → publik: ambil status maintenance & pengumuman
//  POST → admin: update status maintenance & pengumuman (butuh adminToken)
//
//  Storage: Netlify Blobs (name: nusabit-studio)
// ============================================================

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const STORE_KEY = 'site-settings';

// Hash SHA-256 password admin — sama seperti fungsi tiket (ADMIN_TICKET_KEY)
// Jika ADMIN_TICKET_KEY di-set di Netlify env vars, isinya HARUS hash SHA-256.
const ADMIN_PASS_HASH =
  process.env.ADMIN_TICKET_KEY ||
  '821bc6e7ed5ec0007c1d7b88e8ffdd428df9ae1444325fd5c97a372773b31df4';

function createStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;
  const opts = { name: 'nusabit-studio', consistency: 'strong' };
  if (siteID && token) {
    opts.siteID = siteID;
    opts.token = token;
  }
  return getStore(opts);
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyAdmin(adminToken) {
  if (!adminToken) return false;
  try {
    const hash = await sha256(adminToken);
    return hash === ADMIN_PASS_HASH;
  } catch {
    return false;
  }
}

function defaultSettings(nowIso) {
  return {
    maintenance: {
      enabled: false,
      updatedAt: nowIso,
    },
    announcement: {
      enabled: false,
      message: '',
      createdAt: null,
      expiresAt: null,
      updatedAt: nowIso,
    },
  };
}

async function getSettings(store) {
  try {
    const raw = await store.get(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveSettings(store, settings) {
  await store.set(STORE_KEY, JSON.stringify(settings));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let store;
  try {
    store = createStore();
  } catch (e) {
    return {
      statusCode: 503,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: 'Storage tidak tersedia', detail: e.message }),
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // ── GET (public) ──
  if (event.httpMethod === 'GET') {
    let settings = (await getSettings(store)) || defaultSettings(nowIso);

    // Auto-disable announcement kalau sudah lewat expiresAt
    try {
      if (settings.announcement?.enabled && settings.announcement?.expiresAt) {
        const exp = Date.parse(settings.announcement.expiresAt);
        if (!Number.isNaN(exp) && Date.now() > exp) {
          settings.announcement.enabled = false;
          settings.announcement.updatedAt = nowIso;
          await saveSettings(store, settings);
        }
      }
    } catch {
      // ignore
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, now: nowIso, settings }),
    };
  }

  // ── POST (admin) ──
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Body tidak valid' }) };
    }

    const { action, adminToken } = body;
    if (!(await verifyAdmin(adminToken))) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok: false, error: 'Akses ditolak' }) };
    }

    const settings = (await getSettings(store)) || defaultSettings(nowIso);

    if (action === 'setMaintenance') {
      const enabled = !!body.enabled;
      settings.maintenance = settings.maintenance || {};
      settings.maintenance.enabled = enabled;
      settings.maintenance.updatedAt = nowIso;
      await saveSettings(store, settings);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, settings }) };
    }

    if (action === 'setAnnouncement') {
      const message = String(body.message || '').trim();
      const durationMinutes = Math.max(1, Math.min(60 * 24 * 30, parseInt(body.durationMinutes, 10) || 5)); // max 30 hari

      if (!message) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Isi pengumuman tidak boleh kosong' }) };
      }

      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      settings.announcement = {
        enabled: true,
        message,
        createdAt: nowIso,
        expiresAt,
        updatedAt: nowIso,
      };
      await saveSettings(store, settings);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, settings }) };
    }

    if (action === 'clearAnnouncement') {
      settings.announcement = settings.announcement || {};
      settings.announcement.enabled = false;
      settings.announcement.updatedAt = nowIso;
      await saveSettings(store, settings);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, settings }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Action tidak dikenali' }) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method tidak diizinkan' }) };
};

