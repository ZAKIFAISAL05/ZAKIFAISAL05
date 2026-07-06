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

// ────────────────────────────────────────────────
// Chat helpers (user ↔ admin) disimpan di record tiket
// - Untuk list admin, chat di-strip supaya payload ringan
// - Untuk view detail ticket (admin=1&id / token / id), chat ikut dikirim
// ────────────────────────────────────────────────
const MAX_CHAT_MESSAGES = 200;
const MAX_CHAT_ATTACHMENTS = 3;
const MAX_CHAT_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB

function toUpperSafe(s) { return String(s || '').trim().toUpperCase(); }

function normalizeMessages(ticket) {
  const msgs = Array.isArray(ticket?.messages) ? ticket.messages : [];
  // Batasi supaya tidak membengkak
  return msgs.slice(-MAX_CHAT_MESSAGES);
}

function stripChatForAdminList(ticket) {
  if (!ticket) return ticket;
  const msgs = Array.isArray(ticket.messages) ? ticket.messages : [];
  const lastMsg = msgs.length ? (msgs[msgs.length - 1] || null) : null;
  const lastAt = lastMsg && lastMsg.at ? String(lastMsg.at) : null;
  const lastFrom = lastMsg && lastMsg.from ? String(lastMsg.from) : null;

  let lastUserAt = null;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (!m) continue;
    if (m.from !== 'admin' && m.at) { lastUserAt = String(m.at); break; }
  }

  const adminSeenAt = ticket.adminSeenAt ? String(ticket.adminSeenAt) : null;
  const lastUserTs = lastUserAt ? Date.parse(lastUserAt) : NaN;
  const seenTs = adminSeenAt ? Date.parse(adminSeenAt) : NaN;
  const chatUnread = !!lastUserAt && (Number.isNaN(seenTs) || (!Number.isNaN(lastUserTs) && lastUserTs > seenTs));

  const out = {
    ...ticket,
    chatCount: msgs.length,
    chatLastAt: lastAt,
    chatLastFrom: lastFrom,
    chatLastUserAt: lastUserAt,
    adminSeenAt,
    chatUnread,
  };
  delete out.messages;
  return out;
}

function sanitizeMessage(m) {
  const from = (m && m.from === 'admin') ? 'admin' : 'user';
  const at = m && m.at ? String(m.at) : '';
  const text = m && m.text ? String(m.text) : '';
  const attachments = Array.isArray(m && m.attachments)
    ? m.attachments
        .filter(a => a && a.base64 && a.type && String(a.type).startsWith('image/'))
        .map(a => ({ name: String(a.name || 'foto'), type: String(a.type), base64: String(a.base64) }))
    : [];
  return { from, at, text, attachments };
}

function base64SizeBytes(base64) {
  // Rough estimate: base64 length * 3/4 - padding
  const s = String(base64 || '');
  let padding = 0;
  if (s.endsWith('==')) padding = 2;
  else if (s.endsWith('=')) padding = 1;
  return Math.floor((s.length * 3) / 4) - padding;
}

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

    // Jika tiket sudah selesai: hapus chat secara otomatis supaya tidak bisa lanjut chat
    // (sekalian rapikan badge chat agar tidak misleading).
    if (ticket.done || ticket.status === 'done') {
      const hadMessages = Array.isArray(ticket.messages) && ticket.messages.length > 0;
      const hadSeen = !!ticket.adminSeenAt;
      if (hadMessages || hadSeen) {
        ticket.messages = [];
        ticket.adminSeenAt = null;
        await saveTicket(store, ticket);
      }
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
        return t ? stripChatForAdminList({ ...t, messages: normalizeMessages(t) }) : entry;
      }));
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, tickets }) };
    }

    // Admin: ambil tiket by ID
    if (q.admin === '1' && q.id) {
      if (!(await verifyAdmin(q.adminToken))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };
      const ticket = await getTicket(store, q.id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };
      ticket.messages = normalizeMessages(ticket);
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
          messages: normalizeMessages(ticket).map(sanitizeMessage),
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
        updatedAt: ticket.updatedAt, done: ticket.done, devNote: ticket.devNote || '',
        messages: normalizeMessages(ticket).map(sanitizeMessage) };
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
        messages: normalizeMessages(ticket).map(sanitizeMessage),
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
        createdAt: now, updatedAt: now, done: false, devNote: '',
        adminSeenAt: null,
        messages: [],
      };

      await saveTicket(store, ticket);

      // Update index
      const idx = await getIndex(store);
      idx.unshift({ id, num, token, status: 'received', createdAt: now, done: false });
      await saveIndex(store, idx);

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, num, token, ticketUrl: '/tiket/?token=' + token }) };
    }

    // Tambah pesan chat (user ↔ admin) + optional foto (max 5MB per file)
    if (action === 'add_message') {
      const { id, text, token, adminToken, attachments } = body || {};
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'ID tiket wajib diisi' }) };

      const ticket = await getTicket(store, id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };

      // Jika tiket sudah selesai, chat ditutup total (admin & user tidak bisa kirim lagi)
      if (ticket.done || ticket.status === 'done') {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Tiket sudah selesai. Chat ditutup dan tidak bisa mengirim pesan lagi.' }) };
      }

      const isAdmin = await verifyAdmin(adminToken);
      const isOwnerByToken = token ? (toUpperSafe(ticket.token) === toUpperSafe(token)) : false;

      // Mode tanpa token: izinkan jika user hanya punya ID (tiket biasanya dibagikan manual)
      const allowed = isAdmin || isOwnerByToken || (!token && !adminToken);
      if (!allowed) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };

      const cleanText = String(text || '').trim();
      const rawAtt = Array.isArray(attachments) ? attachments.slice(0, MAX_CHAT_ATTACHMENTS) : [];

      const cleanAtt = [];
      for (const a of rawAtt) {
        if (!a || !a.base64 || !a.type) continue;
        const type = String(a.type || '');
        if (!type.startsWith('image/')) continue;
        const base64 = String(a.base64 || '');
        const sizeBytes = base64SizeBytes(base64);
        if (sizeBytes > MAX_CHAT_ATTACHMENT_BYTES) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ukuran foto maksimal 5MB per file' }) };
        }
        cleanAtt.push({
          name: String(a.name || 'foto'),
          type,
          base64,
        });
      }

      if (!cleanText && !cleanAtt.length) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Pesan kosong' }) };
      }

      const msg = {
        from: isAdmin ? 'admin' : 'user',
        text: cleanText,
        at: new Date().toISOString(),
        attachments: cleanAtt,
      };

      ticket.messages = normalizeMessages(ticket);
      ticket.messages.push(msg);
      ticket.updatedAt = new Date().toISOString();

      // Jika admin yang kirim pesan, anggap admin sudah "membaca" chat hingga titik ini
      if (isAdmin) {
        ticket.adminSeenAt = msg.at;
      }

      await saveTicket(store, ticket);

      // Update index entry
      const idx = await getIndex(store);
      const ei  = idx.findIndex(e => e.id === id);
      if (ei !== -1) {
        idx[ei].updatedAt = ticket.updatedAt;
        await saveIndex(store, idx);
      }

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, message: sanitizeMessage(msg) }) };
    }

    // Tandai chat sudah dilihat admin (untuk badge "ada chat baru")
    if (action === 'admin_seen') {
      const { id, adminToken } = body || {};
      if (!(await verifyAdmin(adminToken))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'ID tiket wajib diisi' }) };

      const ticket = await getTicket(store, id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };

      // Jangan ubah updatedAt supaya tidak mengganggu sorting "terakhir diupdate"
      ticket.messages = normalizeMessages(ticket);
      ticket.adminSeenAt = new Date().toISOString();
      await saveTicket(store, ticket);

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, seenAt: ticket.adminSeenAt }) };
    }

    // Update status tiket (hanya admin / WA bot)
    if (action === 'update_status') {
      const { id, status, adminToken, devNote } = body;
      if (!(await verifyAdmin(adminToken))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };
      if (!id || !status || !STATUS[status]) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Data tidak valid' }) };

      const ticket = await getTicket(store, id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };

      // Pastikan field chat tidak hilang
      ticket.messages = normalizeMessages(ticket);

      ticket.status      = status;
      ticket.statusLabel = STATUS[status].label;
      ticket.updatedAt   = new Date().toISOString();
      if (devNote !== undefined) ticket.devNote = devNote;

      // Jika status di-set ke done, perlakukan sama seperti "close"
      if (status === 'done') {
        ticket.done = true;
        ticket.closedAt = ticket.updatedAt;
        ticket.messages = [];      // hapus chat otomatis
        ticket.adminSeenAt = null; // reset badge
      }

      await saveTicket(store, ticket);

      // Update index entry
      const idx = await getIndex(store);
      const ei  = idx.findIndex(e => e.id === id);
      if (ei !== -1) {
        idx[ei].status = status;
        if (status === 'done') {
          idx[ei].done = true;
          idx[ei].closedAt = ticket.closedAt || idx[ei].closedAt || null;
        }
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

      ticket.messages = normalizeMessages(ticket);

      ticket.status      = 'done';
      ticket.statusLabel = 'Selesai';
      ticket.done        = true;
      ticket.updatedAt   = new Date().toISOString();
      ticket.closedAt    = ticket.updatedAt;

      // Hapus chat otomatis saat tiket ditutup
      ticket.messages = [];
      ticket.adminSeenAt = null;
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
