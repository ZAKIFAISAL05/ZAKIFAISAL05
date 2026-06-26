// ============================================================
//  netlify/functions/ticket.js — Nusabit Studio
//  Sistem tiket laporan bug/saran dengan nomor urut & status bar
//
//  GET  /?token=xxx           → ambil tiket (hanya pemilik token)
//  GET  /?admin=1&id=xxx      → admin: ambil tiket by ID
//  GET  /?admin=1&list=1      → admin: list semua tiket
//  POST { action:'create', ticket:{...} }  → simpan tiket baru
//  POST { action:'update_status', id, status, adminToken } → update status
//  POST { action:'close', id, adminToken }  → tutup tiket (selesai)
// ============================================================

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type':                 'application/json',
};

// Status tiket
const STATUS = {
  received:  { label: 'Diterima',    step: 0 },
  seen:      { label: 'Dilihat',     step: 1 },
  confirmed: { label: 'Dikonfirmasi',step: 2 },
  done:      { label: 'Selesai',     step: 3 },
};

function createStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token  = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;
  const opts   = { name: 'nusabit-studio', consistency: 'strong' };
  if (siteID && token) { opts.siteID = siteID; opts.token = token; }
  return getStore(opts);
}

const COUNTER_KEY = 'ticket-counter';
const TICKETS_KEY = 'ticket-list';   // index: [{id, num, token, status, createdAt, done}]
const DONE_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

async function getCounter(store) {
  try { const raw = await store.get(COUNTER_KEY); return raw ? parseInt(raw) : 0; } catch { return 0; }
}
async function saveCounter(store, n) { await store.set(COUNTER_KEY, String(n)); }

async function getIndex(store) {
  try { const raw = await store.get(TICKETS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
async function saveIndex(store, arr) { await store.set(TICKETS_KEY, JSON.stringify(arr)); }

async function getTicket(store, id) {
  try { const raw = await store.get('ticket:' + id); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
async function saveTicket(store, ticket) { await store.set('ticket:' + ticket.id, JSON.stringify(ticket)); }
async function deleteTicketRecord(store, id) {
  try {
    if (typeof store.delete === 'function') await store.delete('ticket:' + id);
  } catch {
    // ignore
  }
}

// Hash SHA-256 password admin — bisa di-override via ADMIN_TICKET_KEY di Netlify env vars
// Jika ADMIN_TICKET_KEY diset, isinya HARUS berupa SHA-256 hash dari password admin kamu
const ADMIN_PASS_HASH = process.env.ADMIN_TICKET_KEY || '821bc6e7ed5ec0007c1d7b88e8ffdd428df9ae1444325fd5c97a372773b31df4';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdmin(adminToken) {
  if (!adminToken) return false;
  try {
    const hash = await sha256(adminToken);
    return hash === ADMIN_PASS_HASH;
  } catch { return false; }
}

async function cleanupExpiredTickets(store, indexInput) {
  const idx = Array.isArray(indexInput) ? indexInput : await getIndex(store);
  const cleaned = [];
  let changed = false;

  for (const entry of idx) {
    if (!entry || !entry.id) {
      changed = true;
      continue;
    }

    const ticket = await getTicket(store, entry.id);
    if (!ticket) {
      changed = true;
      continue;
    }

    const doneAt = Date.parse(ticket.closedAt || ticket.updatedAt || entry.updatedAt || entry.createdAt || '');
    const isExpiredDone = !!ticket.done && !Number.isNaN(doneAt) && (Date.now() - doneAt >= DONE_RETENTION_MS);

    if (isExpiredDone) {
      await deleteTicketRecord(store, entry.id);
      changed = true;
      continue;
    }

    cleaned.push({
      id: ticket.id,
      num: ticket.num,
      token: ticket.token,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      closedAt: ticket.closedAt || null,
      done: !!ticket.done,
    });
  }

  if (changed || cleaned.length !== idx.length) {
    await saveIndex(store, cleaned);
  }

  return cleaned;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let store;
  try { store = createStore(); }
  catch (e) { return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'Storage tidak tersedia', detail: e.message }) }; }

  // ── GET ──
  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    const idx = await cleanupExpiredTickets(store);

    // Admin: list semua tiket
    if (q.admin === '1' && q.list === '1') {
      if (!(await verifyAdmin(q.adminToken))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };
      // Ambil detail tiket untuk setiap index entry
      const tickets = await Promise.all(idx.map(async (entry) => {
        const t = await getTicket(store, entry.id);
        return t || entry;
      }));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, tickets }) };
    }

    // Admin: ambil tiket by ID
    if (q.admin === '1' && q.id) {
      if (!(await verifyAdmin(q.adminToken))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };
      const ticket = await getTicket(store, q.id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ticket }) };
    }

    // User: lihat tiket dengan token rahasia
    if (q.token) {
      const tokenQ = String(q.token || '').trim().toUpperCase();

      // Fallback: banyak user paste ID tiket (GS-xxxx) ke parameter `token`
      // Tetap layani sebagai ID agar halaman tiket tidak dianggap hilang.
      if (/^GS-[A-Z0-9]+$/i.test(tokenQ)) {
        const ticket = await getTicket(store, tokenQ);
        if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };

        const safeById = {
          id: ticket.id,
          num: ticket.num,
          type: ticket.type,
          game: ticket.game,
          desc: ticket.desc,
          status: ticket.status,
          statusLabel: STATUS[ticket.status]?.label || ticket.status,
          statusStep: STATUS[ticket.status]?.step ?? 0,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          done: ticket.done,
          devNote: ticket.devNote || '',
        };

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ticket: safeById }) };
      }

      const entry = idx.find(e => String(e.token || '').toUpperCase() === tokenQ);
      if (!entry) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan atau token tidak valid' }) };
      if (entry.done) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, expired: true, num: entry.num }) };
      const ticket = await getTicket(store, entry.id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };
      // Sembunyikan info sensitif dari user
      const safe = { id: ticket.id, num: ticket.num, type: ticket.type, game: ticket.game,
        desc: ticket.desc, status: ticket.status, statusLabel: STATUS[ticket.status]?.label || ticket.status,
        statusStep: STATUS[ticket.status]?.step ?? 0, createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt, done: ticket.done, devNote: ticket.devNote || '' };
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ticket: safe }) };
    }

    // User: lihat tiket via ID (GS-xxxx) — biar fitur "cek tiket" tidak selalu error "tidak ditemukan"
    // Catatan: yang dibuka hanya data aman (tanpa token / email / kontak).
    if (q.id) {
      const id = String(q.id || '').trim();
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Parameter tidak valid' }) };

      const ticket = await getTicket(store, id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };

      const safe = {
        id: ticket.id,
        num: ticket.num,
        type: ticket.type,
        game: ticket.game,
        desc: ticket.desc,
        status: ticket.status,
        statusLabel: STATUS[ticket.status]?.label || ticket.status,
        statusStep: STATUS[ticket.status]?.step ?? 0,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        done: ticket.done,
        devNote: ticket.devNote || '',
      };
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ticket: safe }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Parameter tidak valid' }) };
  }

  // ── POST ──
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Body tidak valid' }) }; }

    const { action } = body;
    await cleanupExpiredTickets(store);

    // Buat tiket baru
    if (action === 'create') {
      const { id, type, game, desc, email, contact, summary } = body.ticket || {};
      if (!id || !type || !desc) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Data tidak lengkap' }) };

      const counter = await getCounter(store);
      const num     = counter + 1;
      await saveCounter(store, num);

      // Token rahasia unik untuk user
      const tokenArr = new Uint8Array(20);
      // pakai crypto jika ada, fallback ke random
      const token = Array.from({ length: 20 }, () =>
        Math.floor(Math.random() * 36).toString(36)
      ).join('').toUpperCase();

      const now    = new Date().toISOString();
      const ticket = {
        id, num, token, type, game: game || '—', desc, email: email || '', contact: contact || '',
        summary: summary || desc, status: 'received', statusLabel: 'Diterima',
        createdAt: now, updatedAt: now, done: false, devNote: ''
      };

      await saveTicket(store, ticket);

      // Update index
      const idx = await getIndex(store);
      idx.unshift({ id, num, token, status: 'received', createdAt: now, done: false });
      await saveIndex(store, idx);

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, num, token, ticketUrl: '/tiket/?token=' + token }) };
    }

    // Update status tiket (hanya admin / WA bot)
    if (action === 'update_status') {
      const { id, status, adminToken, devNote } = body;
      if (!(await verifyAdmin(adminToken))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };
      if (!id || !status || !STATUS[status]) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Data tidak valid' }) };

      const ticket = await getTicket(store, id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };

      ticket.status      = status;
      ticket.statusLabel = STATUS[status].label;
      ticket.updatedAt   = new Date().toISOString();
      if (devNote !== undefined) ticket.devNote = devNote;
      await saveTicket(store, ticket);

      // Update index entry
      const idx = await getIndex(store);
      const ei  = idx.findIndex(e => e.id === id);
      if (ei !== -1) {
        idx[ei].status = status;
        idx[ei].updatedAt = ticket.updatedAt;
        await saveIndex(store, idx);
      }

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ticket }) };
    }

    // Tutup tiket (selesai)
    if (action === 'close') {
      const { id, adminToken } = body;
      if (!(await verifyAdmin(adminToken))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };

      const ticket = await getTicket(store, id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };

      ticket.status      = 'done';
      ticket.statusLabel = 'Selesai';
      ticket.done        = true;
      ticket.updatedAt   = new Date().toISOString();
      ticket.closedAt    = ticket.updatedAt;
      await saveTicket(store, ticket);

      // Update index
      const idx = await getIndex(store);
      const ei  = idx.findIndex(e => e.id === id);
      if (ei !== -1) {
        idx[ei].status = 'done';
        idx[ei].done = true;
        idx[ei].updatedAt = ticket.updatedAt;
        idx[ei].closedAt = ticket.closedAt;
        await saveIndex(store, idx);
      }

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, closed: true }) };
    }

    // Hapus tiket manual dari admin
    if (action === 'delete') {
      const { id, adminToken } = body;
      if (!(await verifyAdmin(adminToken))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'ID tiket wajib diisi' }) };

      await deleteTicketRecord(store, id);
      const idx = await getIndex(store);
      await saveIndex(store, idx.filter(e => e.id !== id));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, deleted: true }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Action tidak dikenali' }) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method tidak diizinkan' }) };
};
