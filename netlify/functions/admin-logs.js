// ============================================================
//  netlify/functions/admin-logs.js — Nusabit Studio
//  Simpan activity log admin ke Netlify Blobs
//  Retensi otomatis: hapus log yang lebih lama dari 30 hari
// ============================================================

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const STORE_KEY = 'admin-logs';
const LOG_RETENTION_DAYS = 30;
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

async function getLogs(store) {
  try {
    const raw = await store.get(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLogs(store, logs) {
  await store.set(STORE_KEY, JSON.stringify(logs));
}

function cleanupLogs(logs) {
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return (Array.isArray(logs) ? logs : []).filter((item) => {
    const ts = Date.parse(item && item.createdAt);
    if (Number.isNaN(ts)) return false;
    return ts >= cutoff;
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

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

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    if (!(await verifyAdmin(q.adminToken))) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok: false, error: 'Akses ditolak' }) };
    }

    let logs = await getLogs(store);
    const cleaned = cleanupLogs(logs);
    if (cleaned.length !== logs.length) {
      logs = cleaned;
      await saveLogs(store, logs);
    } else {
      logs = cleaned;
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, logs }),
    };
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Body tidak valid' }) };
    }

    if (!(await verifyAdmin(body.adminToken))) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok: false, error: 'Akses ditolak' }) };
    }

    const message = String(body.message || '').trim();
    const type = String(body.type || 'evt').trim();
    if (!message) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Pesan log kosong' }) };
    }

    let logs = cleanupLogs(await getLogs(store));
    logs.push({
      ts: new Date().toLocaleTimeString('id-ID', { hour12: false, timeZone: 'Asia/Jakarta' }),
      createdAt: new Date().toISOString(),
      message,
      type,
    });

    // Biar ukuran tetap aman, simpan maksimal 1000 log terbaru
    logs = logs.slice(-1000);
    await saveLogs(store, logs);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, logs }),
    };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method tidak diizinkan' }) };
};
