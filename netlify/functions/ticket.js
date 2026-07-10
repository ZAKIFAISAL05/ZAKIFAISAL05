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
//  POST { action:'rate', id, token, rating, feedback } → user beri rating saat tiket selesai
// ============================================================

const { getStore } = require('@netlify/blobs');
const nodemailer = require('nodemailer');

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
  cancelled: { label: 'Dibatalkan',  step: 3 },
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

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isClosedTicket(ticket) {
  return !!(ticket && (ticket.done || ticket.status === 'done' || ticket.status === 'cancelled'));
}

let cachedTransporter = null;
function getGmailTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const user =
    process.env.GMAIL_SMTP_USER ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER ||
    '';
  const pass =
    process.env.GMAIL_SMTP_APP_PASSWORD ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.SMTP_PASS ||
    '';

  if (!user || !pass) return null;

  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return cachedTransporter;
}

async function sendEmail({ to, subject, html }) {
  try {
    const transporter = getGmailTransporter();
    if (!transporter) return false;

    const user =
      process.env.GMAIL_SMTP_USER ||
      process.env.GMAIL_USER ||
      process.env.SMTP_USER ||
      '';
    const fromEnv =
      process.env.MAIL_FROM ||
      process.env.GMAIL_MAIL_FROM ||
      '';
    const from = fromEnv || `Nusabit Studio CS <${user}>`;

    const info = await transporter.sendMail({
      from,
      replyTo: user || undefined,
      to,
      subject,
      html,
    });

    return !!info?.messageId;
  } catch (e) {
    console.error('Ticket email error:', e.message);
    return false;
  }
}

function getNowWIBString() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPublicSiteUrl() {
  return (
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.SITE_URL ||
    ''
  ).replace(/\/$/, '');
}

function buildTicketStatusEmailHtml(ticket, mode = 'done') {
  const isCancelled = mode === 'cancelled';
  const title = isCancelled ? 'Tiket Dibatalkan' : 'Tiket Berhasil Diselesaikan';
  const accent = isCancelled ? '#ef4444' : '#22c55e';
  const badgeText = isCancelled ? 'DIBATALKAN' : 'SELESAI';
  const lead = isCancelled
    ? 'Tiket kamu telah dibatalkan oleh admin. Detail alasan pembatalan ada di bawah ini.'
    : 'Kabar baik, tiket kamu sudah berhasil diselesaikan oleh admin Nusabit Studio.';
  const reasonBox = isCancelled
    ? `
      <div class="field">
        <label>Alasan Pembatalan</label>
        <p>${escapeHtml(ticket.cancelReason || 'Tidak ada alasan yang diberikan admin.').replace(/\n/g, '<br>')}</p>
      </div>`
    : '';
  const noteBox = ticket.devNote
    ? `
      <div class="field">
        <label>Catatan Admin</label>
        <p>${escapeHtml(ticket.devNote).replace(/\n/g, '<br>')}</p>
      </div>`
    : '';
  const actorLabel = isCancelled ? 'Dibatalkan oleh' : 'Diselesaikan oleh';
  const closedAtText = ticket.closedAt || ticket.updatedAt || new Date().toISOString();
  const siteUrl = getPublicSiteUrl();
  const path = ticket.token ? `/tiket/?token=${encodeURIComponent(ticket.token)}` : `/tiket/?id=${encodeURIComponent(ticket.id)}`;
  const statusUrl = siteUrl ? `${siteUrl}${path}` : path;

  return `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f4f4f7; color:#1a1a2e; margin:0; padding:0; }
  .wrap { max-width:560px; margin:32px auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.10); }
  .header { background:linear-gradient(135deg, ${accent}, #1f2937); padding:28px 32px; text-align:center; }
  .header h1 { color:#fff; margin:0; font-size:1.35rem; letter-spacing:0.6px; }
  .header p  { color:rgba(255,255,255,0.88); margin:8px 0 0; font-size:0.9rem; }
  .body { padding:28px 32px; }
  .ticket { background:#f8fafc; border:2px solid ${accent}; border-radius:12px; padding:16px 24px; text-align:center; margin-bottom:24px; }
  .ticket-label { font-size:0.72rem; color:${accent}; text-transform:uppercase; letter-spacing:1px; display:block; }
  .ticket-num   { font-size:1.5rem; font-weight:800; color:${accent}; letter-spacing:1.6px; display:block; margin-top:4px; }
  .ticket-badge { display:inline-block; margin-top:10px; padding:6px 12px; border-radius:999px; background:${accent}; color:#fff; font-size:0.72rem; font-weight:700; letter-spacing:0.8px; }
  .intro { margin:0 0 20px; line-height:1.7; color:#334155; font-size:0.95rem; }
  .field  { margin-bottom:14px; }
  .field label { font-size:0.72rem; color:#888; text-transform:uppercase; letter-spacing:0.8px; display:block; margin-bottom:4px; font-weight:600; }
  .field p { margin:0; background:#f7f7fa; border:1px solid #e8e8f0; border-radius:8px; padding:10px 14px; font-size:0.92rem; line-height:1.6; color:#1a1a2e; }
  .cta { display:block; text-align:center; background:${accent}; color:#fff !important; text-decoration:none; padding:13px 24px; border-radius:10px; font-weight:700; font-size:0.95rem; margin:22px 0 0; }
  .footer { border-top:1px solid #eee; padding:18px 32px; font-size:0.78rem; color:#999; text-align:center; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🎫 ${title}</h1>
    <p>Nusabit Studio Ticket Update</p>
  </div>
  <div class="body">
    <div class="ticket">
      <span class="ticket-label">Nomor Tiket</span>
      <span class="ticket-num">${escapeHtml(ticket.id)}</span>
      <span class="ticket-badge">${badgeText}</span>
    </div>
    <p class="intro">${lead}</p>
    <div class="field"><label>Game</label><p>${escapeHtml(ticket.game || 'Tidak disebutkan')}</p></div>
    <div class="field"><label>Jenis Laporan</label><p>${ticket.type === 'bug' ? '🐛 Bug / Error' : '💡 Saran'}</p></div>
    <div class="field"><label>${actorLabel}</label><p>${escapeHtml(ticket.closedBy || 'Admin Nusabit Studio')}</p></div>
    <div class="field"><label>Waktu Update</label><p>${escapeHtml(getNowWIBString())}</p></div>
    ${reasonBox}
    ${noteBox}
    <div class="field"><label>Ringkasan Laporan</label><p>${escapeHtml(ticket.desc || '—').replace(/\n/g, '<br>')}</p></div>
    <a class="cta" href="${statusUrl}">Lihat Status Tiket</a>
  </div>
  <div class="footer">
    Update sistem tercatat pada ${escapeHtml(new Date(closedAtText).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }))}.
  </div>
</div>
</body></html>`;
}

async function sendTicketStatusEmail(ticket, mode = 'done') {
  const email = String(ticket?.email || '').trim();
  if (!email || !email.includes('@')) return false;
  const subject = mode === 'cancelled'
    ? `Tiket ${ticket.id} dibatalkan`
    : `Tiket ${ticket.id} berhasil diselesaikan`;
  const html = buildTicketStatusEmailHtml(ticket, mode);
  return sendEmail({ to: email, subject, html });
}

function sanitizeWhatsAppNumber(phoneNumber) {
  const digitsOnly = String(phoneNumber || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  if (digitsOnly.startsWith('0')) return `62${digitsOnly.slice(1)}`;
  return digitsOnly;
}

async function sendWhatsAppNotification(toPhoneNumber, messageText) {
  try {
    const cleanNumber = sanitizeWhatsAppNumber(toPhoneNumber);
    const phoneNumberId = String(process.env.WA_PHONE_NUMBER_ID || '').trim();
    const accessToken = String(process.env.META_ACCESS_TOKEN || '').trim();
    const bodyText = String(messageText || '').trim();

    if (!cleanNumber || !bodyText || !phoneNumberId || !accessToken) return false;

    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'text',
        text: {
          preview_url: true,
          body: bodyText,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Meta WhatsApp error:', errorText);
      return false;
    }

    const data = await response.json().catch(() => null);
    return !!(data?.messages?.[0]?.id || data?.message_id);
  } catch (e) {
    console.error('Meta WhatsApp send error:', e.message);
    return false;
  }
}

function buildAdminNewTicketWhatsAppMessage(ticket) {
  const adminUrl = 'https://nusabit.netlify.app/admin';
  const lines = [
    'Halo Admin Nusabit Studio,',
    '',
    'Ada tiket baru yang baru saja dibuat.',
    '',
    `ID Tiket: ${ticket.id}`,
    `Nomor Antrian: #${ticket.num}`,
    `Jenis: ${ticket.type === 'bug' ? 'Bug / Error' : 'Saran'}`,
    `Game: ${ticket.game || '—'}`,
    `Kontak User: ${ticket.contact || '-'}`,
    `Email User: ${ticket.email || '-'}`,
    `Waktu Masuk: ${getNowWIBString()}`,
    '',
    'Ringkasan Laporan:',
    String(ticket.summary || ticket.desc || '—'),
    '',
    'Deskripsi Lengkap:',
    String(ticket.desc || '—'),
    '',
    `Panel Admin: ${adminUrl}`,
  ];

  return lines.join('\n');
}

function buildTicketStatusWhatsAppMessage(ticket) {
  const statusLabel = STATUS[ticket.status]?.label || ticket.status || 'Tidak diketahui';
  const lines = [
    'Halo, tiket kamu sudah diperbarui oleh admin Nusabit Studio.',
    '',
    `ID Tiket: ${ticket.id}`,
    `Status: ${statusLabel}`,
    `Game: ${ticket.game || '—'}`,
    `Waktu Update: ${getNowWIBString()}`,
  ];

  if (ticket.devNote) {
    lines.push('', 'Catatan Admin:', String(ticket.devNote));
  }

  if (ticket.status === 'cancelled' && ticket.cancelReason) {
    lines.push('', 'Alasan Pembatalan:', String(ticket.cancelReason));
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────────
// Chat helpers (user ↔ admin) disimpan di record tiket
// - Untuk list admin, chat di-strip supaya payload ringan
// - Untuk view detail ticket (admin=1&id / token / id), chat ikut dikirim
// ────────────────────────────────────────────────
const MAX_CHAT_MESSAGES = 200;
const MAX_CHAT_ATTACHMENTS = 3;
const MAX_CHAT_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB

function toUpperSafe(s) { return String(s || '').trim().toUpperCase(); }
function sanitizeAdminUser(u) {
  // Nama admin hanya untuk label UI (bukan autentikasi).
  // Batasi karakter agar aman ditampilkan.
  const s = String(u || '').trim().slice(0, 40);
  if (!s) return '';
  return s.replace(/[^\w.\- @]/g, '');
}

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
  const adminUser = from === 'admin' && m && m.adminUser ? sanitizeAdminUser(m.adminUser) : '';
  const attachments = Array.isArray(m && m.attachments)
    ? m.attachments
        .filter(a => a && a.base64 && a.type && String(a.type).startsWith('image/'))
        .map(a => ({ name: String(a.name || 'foto'), type: String(a.type), base64: String(a.base64) }))
    : [];
  return { from, at, text, attachments, ...(adminUser ? { adminUser } : {}) };
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
    const isExpiredDone = isClosedTicket(ticket) && !Number.isNaN(doneAt) && (Date.now() - doneAt >= DONE_RETENTION_MS);

    if (isExpiredDone) {
      await deleteTicketRecord(store, entry.id);
      changed = true;
      continue;
    }

    // Jika tiket sudah selesai: hapus chat secara otomatis supaya tidak bisa lanjut chat
    // (sekalian rapikan badge chat agar tidak misleading).
    if (isClosedTicket(ticket)) {
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
          closedAt: ticket.closedAt || null,
          closedBy: ticket.closedBy || '',
          cancelReason: ticket.cancelReason || '',
          cancelledAt: ticket.cancelledAt || null,
          rating: ticket.rating || 0,
          feedback: ticket.feedback || '',
          ratedAt: ticket.ratedAt || null,
          messages: normalizeMessages(ticket).map(sanitizeMessage),
        };

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ticket: safeById }) };
      }

      const entry = idx.find(e => String(e.token || '').toUpperCase() === tokenQ);
      if (!entry) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan atau token tidak valid' }) };
      const ticket = await getTicket(store, entry.id);
      if (!ticket) {
        // Jika index masih ada tapi record sudah terhapus (retensi), tampilkan state closed sederhana.
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, expired: true, num: entry.num }) };
      }
      // Sembunyikan info sensitif dari user
      const safe = { id: ticket.id, num: ticket.num, type: ticket.type, game: ticket.game,
        desc: ticket.desc, status: ticket.status, statusLabel: STATUS[ticket.status]?.label || ticket.status,
        statusStep: STATUS[ticket.status]?.step ?? 0, createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt, done: ticket.done, devNote: ticket.devNote || '',
        closedAt: ticket.closedAt || null,
        closedBy: ticket.closedBy || '',
        cancelReason: ticket.cancelReason || '',
        cancelledAt: ticket.cancelledAt || null,
        rating: ticket.rating || 0,
        feedback: ticket.feedback || '',
        ratedAt: ticket.ratedAt || null,
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
        closedAt: ticket.closedAt || null,
        closedBy: ticket.closedBy || '',
        cancelReason: ticket.cancelReason || '',
        cancelledAt: ticket.cancelledAt || null,
        rating: ticket.rating || 0,
        feedback: ticket.feedback || '',
        ratedAt: ticket.ratedAt || null,
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
        closedAt: null,
        closedBy: '',
        cancelReason: '',
        cancelledAt: null,
        rating: 0,
        feedback: '',
        ratedAt: null,
        adminSeenAt: null,
        messages: [],
      };

      await saveTicket(store, ticket);

      // Update index
      const idx = await getIndex(store);
      idx.unshift({ id, num, token, status: 'received', createdAt: now, done: false });
      await saveIndex(store, idx);

      await sendWhatsAppNotification(process.env.ADMIN_WA_NUMBER, buildAdminNewTicketWhatsAppMessage(ticket));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, num, token, ticketUrl: '/tiket/?token=' + token }) };
    }

    // Tambah pesan chat (user ↔ admin) + optional foto (max 5MB per file)
    if (action === 'add_message') {
      const { id, text, token, adminToken, attachments, adminUser } = body || {};
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'ID tiket wajib diisi' }) };

      const ticket = await getTicket(store, id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };

      // Jika tiket sudah selesai, chat ditutup total (admin & user tidak bisa kirim lagi)
      if (isClosedTicket(ticket)) {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Tiket sudah ditutup. Chat ditutup dan tidak bisa mengirim pesan lagi.' }) };
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
      if (isAdmin) {
        const au = sanitizeAdminUser(adminUser);
        if (au) msg.adminUser = au;
      }

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
      const { id, status, adminToken, devNote, adminUser, cancelReason } = body;
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

      const au = sanitizeAdminUser(adminUser);
      if (au) ticket.lastUpdatedBy = au;

      // Jika status di-set ke done, perlakukan sama seperti "close"
      if (status === 'done' || status === 'cancelled') {
        ticket.done = true;
        ticket.closedAt = ticket.updatedAt;
        if (au) ticket.closedBy = au;
        if (status === 'cancelled') {
          ticket.cancelReason = String(cancelReason || ticket.cancelReason || '').trim().slice(0, 1000);
          ticket.cancelledAt = ticket.updatedAt;
        }
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

      if (ticket.contact) {
        await sendWhatsAppNotification(ticket.contact, buildTicketStatusWhatsAppMessage(ticket));
      }

      if (status === 'done') {
        ticket.emailSent = await sendTicketStatusEmail(ticket, 'done');
      } else if (status === 'cancelled') {
        ticket.emailSent = await sendTicketStatusEmail(ticket, 'cancelled');
      }

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ticket, emailSent: !!ticket.emailSent }) };
    }

    // Tutup tiket (selesai)
    if (action === 'close') {
      const { id, adminToken, adminUser } = body;
      if (!(await verifyAdmin(adminToken))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };

      const ticket = await getTicket(store, id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };

      ticket.messages = normalizeMessages(ticket);

      ticket.status      = 'done';
      ticket.statusLabel = 'Selesai';
      ticket.done        = true;
      ticket.updatedAt   = new Date().toISOString();
      ticket.closedAt    = ticket.updatedAt;
      const au = sanitizeAdminUser(adminUser);
      if (au) ticket.closedBy = au;

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

      const emailSent = await sendTicketStatusEmail(ticket, 'done');
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, closed: true, emailSent }) };
    }

    // Batalkan tiket (hanya admin, wajib isi alasan)
    if (action === 'cancel') {
      const { id, adminToken, adminUser, reason, devNote } = body || {};
      if (!(await verifyAdmin(adminToken))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Akses ditolak' }) };
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'ID tiket wajib diisi' }) };
      const cleanReason = String(reason || '').trim().slice(0, 1000);
      if (!cleanReason) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Alasan pembatalan wajib diisi' }) };

      const ticket = await getTicket(store, id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };
      if (isClosedTicket(ticket)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Tiket sudah ditutup sebelumnya' }) };
      }

      ticket.messages = normalizeMessages(ticket);
      ticket.status = 'cancelled';
      ticket.statusLabel = STATUS.cancelled.label;
      ticket.done = true;
      ticket.updatedAt = new Date().toISOString();
      ticket.closedAt = ticket.updatedAt;
      ticket.cancelledAt = ticket.updatedAt;
      ticket.cancelReason = cleanReason;
      if (devNote !== undefined) ticket.devNote = String(devNote || '').trim();
      const au = sanitizeAdminUser(adminUser);
      if (au) ticket.closedBy = au;
      ticket.messages = [];
      ticket.adminSeenAt = null;
      await saveTicket(store, ticket);

      const idx = await getIndex(store);
      const ei = idx.findIndex(e => e.id === id);
      if (ei !== -1) {
        idx[ei].status = 'cancelled';
        idx[ei].done = true;
        idx[ei].updatedAt = ticket.updatedAt;
        idx[ei].closedAt = ticket.closedAt;
        await saveIndex(store, idx);
      }

      const emailSent = await sendTicketStatusEmail(ticket, 'cancelled');
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, cancelled: true, emailSent, ticket }) };
    }

    // User kasih rating saat tiket sudah selesai
    if (action === 'rate') {
      const { id, token, rating, feedback } = body || {};
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'ID tiket wajib diisi' }) };
      if (!token) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Token wajib diisi untuk memberi rating' }) };
      const r = parseInt(rating, 10);
      if (!r || r < 1 || r > 5) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Rating harus 1 sampai 5' }) };

      const ticket = await getTicket(store, id);
      if (!ticket) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Tiket tidak ditemukan' }) };

      // Hanya pemilik token yang boleh rating
      if (toUpperSafe(ticket.token) !== toUpperSafe(token)) {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Token tidak valid' }) };
      }

      // Rating hanya saat tiket selesai
      if (!(ticket.status === 'done')) {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Rating hanya bisa dikirim setelah tiket selesai' }) };
      }

      const fb = String(feedback || '').trim().slice(0, 800);
      ticket.rating = r;
      ticket.feedback = fb;
      ticket.ratedAt = new Date().toISOString();
      // Jangan ubah updatedAt supaya tidak mengubah sorting list admin hanya karena rating
      await saveTicket(store, ticket);

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, rating: ticket.rating, feedback: ticket.feedback }) };
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
