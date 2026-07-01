// ============================================================
//  netlify/functions/reviews.js — Nusabit Studio
//  Reviews / Rating (ulasan + bintang)
//
//  GET  → publik: ambil daftar ulasan
//  POST → admin: add/update/delete/move (butuh adminToken)
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

const STORE_KEY = 'reviews';

// Sama seperti fungsi lain: adminToken (password) akan di-hash SHA-256
// dan dibandingkan dengan env var ADMIN_TICKET_KEY (hash).
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

function defaultReviews(nowIso) {
  return [
    {
      id: 'rev-1',
      name: 'Asep',
      rating: 5,
      review: 'Websitenya keren, tampilannya modern dan gampang dipakai.',
      avatar: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'rev-2',
      name: 'Nadia',
      rating: 4,
      review: 'Info gamenya jelas, desainnya enak dilihat. Mantap!',
      avatar: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'rev-3',
      name: 'Rizky',
      rating: 5,
      review: 'Bagian tiket bug/saran membantu banget. Responsnya cepat.',
      avatar: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

function normalizeReview(item, nowIso, index) {
  const src = item && typeof item === 'object' ? item : {};
  return {
    id: safeText(src.id, 80) || ('rev-fallback-' + index),
    name: safeText(src.name, 40) || 'Anonim',
    rating: clampRating(src.rating),
    review: safeText(src.review, 300) || 'Belum ada isi ulasan.',
    avatar: safeAvatar(src.avatar),
    createdAt: safeText(src.createdAt, 60) || nowIso,
    updatedAt: safeText(src.updatedAt, 60) || nowIso,
  };
}

function normalizeReviewList(list, nowIso) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item, index) => normalizeReview(item, nowIso, index + 1))
    .filter((item) => item.name && item.review);
}

function buildFallbackGetResponse(nowIso, reason) {
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      fallback: true,
      storageAvailable: false,
      reason: reason || 'fallback-default-reviews',
      reviews: defaultReviews(nowIso),
    }),
  };
}

function clampRating(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 5;
  return Math.max(1, Math.min(5, v));
}

function safeText(s, max = 300) {
  return String(s || '').trim().slice(0, max);
}

function safeAvatar(dataUrl, maxLen = 1600000) {
  // Simpan avatar sebagai Data URL (PNG/JPG) di database (Netlify Blobs)
  // Contoh: data:image/png;base64,....
  if (dataUrl === null) return '';
  const s = String(dataUrl || '').trim();
  if (!s) return '';
  if (!/^data:image\/(png|jpeg);base64,/i.test(s)) return '';
  // Batasi ukuran agar payload tidak kebesaran
  if (s.length > maxLen) return '';
  return s;
}

function makeId() {
  try {
    if (crypto.randomUUID) return 'rev-' + crypto.randomUUID();
  } catch {
    // ignore
  }
  const a = new Uint8Array(10);
  crypto.getRandomValues(a);
  return (
    'rev-' +
    Array.from(a)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

async function getReviews(store, nowIso) {
  try {
    const raw = await store.get(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return normalizeReviewList(parsed, nowIso);
    if (parsed && Array.isArray(parsed.reviews)) return normalizeReviewList(parsed.reviews, nowIso);
    return null;
  } catch {
    return null;
  }
}

async function saveReviews(store, reviews) {
  const normalized = normalizeReviewList(reviews, new Date().toISOString());
  await store.set(STORE_KEY, JSON.stringify(normalized));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let store = null;
  let storeError = null;
  try {
    store = createStore();
  } catch (e) {
    storeError = e;
  }

  const nowIso = new Date().toISOString();

  // ── GET (public) ──
  if (event.httpMethod === 'GET') {
    if (!store) {
      return buildFallbackGetResponse(nowIso, storeError && storeError.message);
    }

    let reviews = await getReviews(store, nowIso);
    if (!reviews || !reviews.length) {
      // Jika belum ada data, pakai default supaya section tidak kosong.
      reviews = defaultReviews(nowIso);
      try {
        await saveReviews(store, reviews);
      } catch {
        // ignore — frontend tetap dapat fallback reviews
      }
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, reviews }) };
  }

  // ── POST (admin) ──
  if (event.httpMethod === 'POST') {
    if (!store) {
      return {
        statusCode: 503,
        headers: CORS,
        body: JSON.stringify({
          ok: false,
          error: 'Database ulasan tidak tersedia untuk mode admin',
          detail: storeError ? storeError.message : 'Storage tidak tersedia',
        }),
      };
    }

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

    let reviews = (await getReviews(store, nowIso)) || defaultReviews(nowIso);

    if (action === 'add') {
      const item = {
        id: makeId(),
        name: safeText(body.name, 40),
        rating: clampRating(body.rating),
        review: safeText(body.review, 300),
        avatar: safeAvatar(body.avatar),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      if (!item.name || !item.review) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Nama dan ulasan wajib diisi' }) };
      }
      reviews.unshift(item);
      await saveReviews(store, reviews);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, reviews }) };
    }

    if (action === 'update') {
      const id = String(body.id || '').trim();
      const idx = reviews.findIndex((r) => r.id === id);
      if (idx < 0) {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ ok: false, error: 'Ulasan tidak ditemukan' }) };
      }
      const next = { ...reviews[idx] };
      next.name = safeText(body.name, 40);
      next.rating = clampRating(body.rating);
      next.review = safeText(body.review, 300);
      // Avatar opsional:
      // - jika field "avatar" dikirim: update (bisa '' untuk menghapus)
      // - jika tidak dikirim: pertahankan avatar lama
      if (Object.prototype.hasOwnProperty.call(body, 'avatar')) {
        next.avatar = safeAvatar(body.avatar);
      }
      next.updatedAt = nowIso;
      if (!next.name || !next.review) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Nama dan ulasan wajib diisi' }) };
      }
      reviews[idx] = next;
      await saveReviews(store, reviews);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, reviews }) };
    }

    if (action === 'delete') {
      const id = String(body.id || '').trim();
      reviews = reviews.filter((r) => r.id !== id);
      await saveReviews(store, reviews);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, reviews }) };
    }

    if (action === 'move') {
      const id = String(body.id || '').trim();
      const dir = body.dir === 'down' ? 'down' : 'up';
      const idx = reviews.findIndex((r) => r.id === id);
      if (idx < 0) {
        return { statusCode: 404, headers: CORS, body: JSON.stringify({ ok: false, error: 'Ulasan tidak ditemukan' }) };
      }
      const swapWith = dir === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= reviews.length) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, reviews }) };
      }
      const tmp = reviews[idx];
      reviews[idx] = reviews[swapWith];
      reviews[swapWith] = tmp;
      await saveReviews(store, reviews);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, reviews }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Action tidak dikenali' }) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method tidak diizinkan' }) };
};
