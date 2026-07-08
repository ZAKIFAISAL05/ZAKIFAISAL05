// ============================================================
//  netlify/functions/dev-bypass.js — Nusabit Studio
//  Developer Bypass Token:
//  - ISSUE  (admin) : buat token acak + simpan ke storage
//  - REVOKE (admin) : hapus token dari storage
//  - VALIDATE (public): cek token valid & belum expired
// ============================================================

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const STORE_KEY = 'dev-bypass-tokens';

// Sama seperti site-settings.js (password admin di-hash di server)
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
    const hash = await sha256(String(adminToken));
    return hash === ADMIN_PASS_HASH;
  } catch {
    return false;
  }
}

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function randomToken() {
  // token panjang, susah ditebak
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  const hex = Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
  return 'nbdev_' + hex;
}

async function loadTokens(store) {
  const raw = await store.get(STORE_KEY);
  const data = safeJsonParse(raw, { tokens: [] });
  data.tokens = Array.isArray(data.tokens) ? data.tokens : [];

  // bersihkan yang expired
  const now = Date.now();
  data.tokens = data.tokens.filter((t) => {
    const exp = Date.parse(t.expiresAt || '');
    return Number.isFinite(exp) ? exp > now : false;
  });
  return data;
}

async function saveTokens(store, data) {
  await store.set(STORE_KEY, JSON.stringify(data));
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

  // ── VALIDATE (public) ──
  if (event.httpMethod === 'GET') {
    const token = String((event.queryStringParameters && event.queryStringParameters.token) || '').trim();
    if (!token) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, valid: false }) };

    try {
      const data = await loadTokens(store);
      const found = data.tokens.find((t) => t.token === token);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, valid: !!found }) };
    } catch (e) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, valid: false }) };
    }
  }

  // ── ISSUE / REVOKE (admin) ──
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Body tidak valid' }) };
    }

    const action = String(body.action || '').trim();
    const adminToken = body.adminToken;

    if (!(await verifyAdmin(adminToken))) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok: false, error: 'Akses ditolak' }) };
    }

    const data = await loadTokens(store);

    if (action === 'issue') {
      const ttlMinutes = Math.max(5, Math.min(60 * 24 * 7, parseInt(body.ttlMinutes, 10) || 120)); // max 7 hari
      const token = randomToken();
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

      data.tokens.push({ token, createdAt: nowIso(), expiresAt });
      await saveTokens(store, data);

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, token, expiresAt }) };
    }

    if (action === 'revoke') {
      const token = String(body.token || '').trim();
      if (!token) return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Token kosong' }) };

      const before = data.tokens.length;
      data.tokens = data.tokens.filter((t) => t.token !== token);
      await saveTokens(store, data);

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, removed: before - data.tokens.length }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Action tidak dikenali' }) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method tidak diizinkan' }) };
};

