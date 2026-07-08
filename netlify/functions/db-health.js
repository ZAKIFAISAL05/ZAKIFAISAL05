// ============================================================
//  netlify/functions/db-health.js — Nusabit Studio
//  Health check Netlify Blobs (database)
//  Tujuan:
//  - Admin bisa tahu DB sedang OK / bermasalah
//  - Ukur latency read/write sederhana
// ============================================================

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// Sama seperti fungsi lain: adminToken (password) akan di-hash SHA-256
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

function msSince(t0) {
  const diff = Number(process.hrtime.bigint() - t0) / 1e6;
  return Math.round(diff);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method tidak diizinkan' }) };
  }

  const q = event.queryStringParameters || {};
  if (!(await verifyAdmin(q.adminToken))) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok: false, error: 'Akses ditolak' }) };
  }

  let store;
  try {
    store = createStore();
  } catch (e) {
    return {
      statusCode: 503,
      headers: CORS,
      body: JSON.stringify({ ok: false, status: 'down', error: 'Storage tidak tersedia', detail: e.message }),
    };
  }

  const nowIso = new Date().toISOString();
  const probeKey = 'health-probe';
  const probeValue = JSON.stringify({ ts: nowIso, rnd: Math.random().toString(16).slice(2) });

  const details = {
    ok: true,
    status: 'ok',
    now: nowIso,
    writeMs: null,
    readMs: null,
    keys: {},
  };

  try {
    const tWrite = process.hrtime.bigint();
    await store.set(probeKey, probeValue);
    details.writeMs = msSince(tWrite);

    const tRead = process.hrtime.bigint();
    const raw = await store.get(probeKey);
    details.readMs = msSince(tRead);

    details.keys.probe = raw ? 'ok' : 'missing';
  } catch (e) {
    details.ok = false;
    details.status = 'degraded';
    details.error = 'Gagal read/write probe';
    details.detail = e.message;
  }

  // Cek beberapa key penting (read only)
  const importantKeys = {
    games: 'game-catalog',
    reviews: 'reviews',
    tickets: 'tickets',
    reports: 'gs_reports',
    siteSettings: 'site-settings',
    adminLogs: 'admin-logs',
    devBypass: 'dev-bypass-tokens',
  };

  for (const [label, key] of Object.entries(importantKeys)) {
    try {
      await store.get(key);
      details.keys[label] = 'ok';
    } catch (e) {
      details.keys[label] = 'error';
      details.ok = false;
      details.status = 'degraded';
    }
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify(details) };
};

