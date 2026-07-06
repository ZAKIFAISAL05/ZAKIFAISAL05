// ============================================================
//  netlify/functions/saweria.js — Nusabit Studio
//  Saweria integration untuk:
//  - Progress target donasi (milestone-progress)
//  - Donatur terbaru (transactions)
//
//  Catatan konfigurasi (Netlify Env Vars):
//  - SAWERIA_AUTH           : isi header Authorization dari Saweria (biasanya "Bearer ...")
//  - SAWERIA_DONATION_URL   : link publik Saweria kamu (contoh: https://saweria.co/username)
//  - SAWERIA_TARGET_AMOUNT  : target donasi (angka, contoh: 500000)
//  - SAWERIA_MILESTONE_START: tanggal mulai hitung milestone (dd-mm-yyyy atau yyyy-mm-dd), contoh: 01-01-2026
//
//  Endpoint:
//  GET /.netlify/functions/saweria
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const SAWERIA_BASE = 'https://backend.saweria.co';

function toCamelCase(obj) {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) {
      const ck = k.replace(/([-_][a-z])/g, (m) => m.toUpperCase().replace(/[-_]/, ''));
      out[ck] = toCamelCase(obj[k]);
    }
    return out;
  }
  return obj;
}

function parseStartDate(s) {
  const raw = String(s || '').trim();
  if (!raw) return '';

  // dd-mm-yyyy
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw;

  // yyyy-mm-dd -> dd-mm-yyyy
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}-${m}-${y}`;
  }

  return raw; // fallback
}

function numEnv(name, fallback = 0) {
  const v = parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(v) ? v : fallback;
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { method: 'GET', headers });
  const json = await res.json().catch(() => null);
  return { status: res.status, json: json ? toCamelCase(json) : null };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method tidak diizinkan' }) };
  }

  const auth = String(process.env.SAWERIA_AUTH || process.env.SAWERIA_JWT || '').trim();
  const donationUrl = String(process.env.SAWERIA_DONATION_URL || '').trim();
  const targetAmount = numEnv('SAWERIA_TARGET_AMOUNT', 0);
  const startDate = parseStartDate(process.env.SAWERIA_MILESTONE_START || '');

  // Jika belum dikonfigurasi, kembalikan response aman supaya UI tampil empty state
  if (!auth) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: false,
        donationUrl,
        targetAmount,
        collectedAmount: 0,
        donors: [],
        note: 'SAWERIA_AUTH belum di-set',
      }),
    };
  }

  try {
    // 1) Ambil stream key (dibutuhkan untuk widget milestone-progress)
    const streamKeyRes = await getJson(`${SAWERIA_BASE}/auth/stream-key`, { authorization: auth });
    const streamKey = streamKeyRes?.json?.data?.streamKey || streamKeyRes?.json?.data?.stream_key || '';

    // 2) Ambil progress milestone (jika start date disediakan)
    let collectedAmount = 0;
    if (streamKey && startDate) {
      const progRes = await getJson(
        `${SAWERIA_BASE}/widgets/milestone-progress?start_date=${encodeURIComponent(startDate)}`,
        { authorization: auth, 'stream-key': streamKey },
      );
      const p = Number(progRes?.json?.data?.progress || 0);
      collectedAmount = Number.isFinite(p) ? p : 0;
    }

    // 3) Ambil transaksi terbaru (untuk list donatur)
    const txRes = await getJson(`${SAWERIA_BASE}/transactions?page=1&page_size=12`, { authorization: auth });
    const txs = Array.isArray(txRes?.json?.data?.transactions) ? txRes.json.data.transactions : [];

    const donors = txs
      .filter(t => t && String(t.status || '').toLowerCase() === 'success')
      .map(t => ({
        name: (t.donator && t.donator.firstName) ? String(t.donator.firstName) : 'Anonim',
        amount: Number(t.amountRaw || 0),
        message: String(t.message || ''),
        at: String(t.createdAt || ''),
      }));

    // Fallback: kalau milestone-progress belum di-set, pakai total dari transaksi yang tampil (bukan total keseluruhan).
    if (!collectedAmount) {
      const sum = donors.reduce((n, d) => n + (Number(d.amount) || 0), 0);
      collectedAmount = sum;
    }

    const percent = targetAmount > 0 ? Math.round((collectedAmount / targetAmount) * 100) : 0;

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        donationUrl,
        targetAmount,
        collectedAmount,
        percent,
        donors,
        lastUpdated: new Date().toISOString(),
      }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: false,
        donationUrl,
        targetAmount,
        collectedAmount: 0,
        donors: [],
        error: e && e.message ? e.message : 'Gagal mengambil data Saweria',
      }),
    };
  }
};

