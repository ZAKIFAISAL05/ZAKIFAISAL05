/**
 * tiket/script.js — Nusabit Studio
 * Halaman Status Tiket — Logic utama (dipisah dari HTML)
 */

'use strict';

/* ══════════════════════════════════════
   CONSTANTS
══════════════════════════════════════ */
const TICKET_API    = '/.netlify/functions/ticket';
const REFRESH_DELAY = 10_000; // ms (auto-refresh setiap 10 detik jika tiket masih aktif)

const STEP_LABELS = ['Diterima', 'Dilihat', 'Dikonfirmasi', 'Selesai'];

const STATUS_CONFIG = {
  received: {
    icon:  '📥',
    title: 'Laporan Diterima',
    msg:   'Laporanmu sudah masuk ke sistem kami. Tim developer akan segera meninjau.',
    cls:   'status-received',
  },
  seen: {
    icon:  '👀',
    title: 'Sedang Ditinjau',
    msg:   'Developer sudah melihat laporanmu dan sedang mempelajari masalahnya.',
    cls:   'status-seen',
  },
  confirmed: {
    icon:  '🔧',
    title: 'Sedang Dikerjakan',
    msg:   'Laporan dikonfirmasi! Developer sedang aktif mengerjakan perbaikan atau tindak lanjut.',
    cls:   'status-confirmed',
  },
  done: {
    icon:  '✅',
    title: 'Selesai',
    msg:   'Masalah sudah diselesaikan! Terima kasih banyak sudah melaporkan. Tiket ini sekarang ditutup.',
    cls:   'status-done',
  },
  cancelled: {
    icon:  '⛔',
    title: 'Tiket Dibatalkan',
    msg:   'Tiket ini ditutup oleh admin dan tidak akan diproses lebih lanjut. Lihat alasan pembatalan di bawah.',
    cls:   'status-cancelled',
  },
};

/* ══════════════════════════════════════
   UTILITY
══════════════════════════════════════ */

/** Ambil token dari URL query string */
function getTokenFromURL() {
  return new URLSearchParams(window.location.search).get('token');
}

/** Ambil ID tiket (GS-xxxx) dari URL query string */
function getIdFromURL() {
  return new URLSearchParams(window.location.search).get('id');
}

/** Format ISO date ke locale Indonesia */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

/** Escape HTML sederhana */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════
   CHAT (USER ↔ ADMIN)
══════════════════════════════════════ */
let _currentTicket = null;
let _chatFile = null;
let _pendingRating = 0;
let _refreshTimer = null;

function buildStarsText(n) {
  const r = Math.max(0, Math.min(5, parseInt(n || 0, 10) || 0));
  let out = '';
  for (let i = 1; i <= 5; i++) out += (i <= r ? '★' : '☆');
  return out;
}

function buildRatingSection(ticket) {
  const isDone = !!(ticket && ticket.status === 'done');
  if (!isDone) return '';

  const token = getTokenFromURL() || '';
  const ratingNum = parseInt(ticket.rating || 0, 10) || 0;
  const feedback = String(ticket.feedback || '').trim();

  // Sudah ada rating → tampilkan saja
  if (ratingNum >= 1) {
    return `
      <div class="rating-section">
        <div class="section-label">Rating untuk Admin</div>
        <div class="rating-display">
          <span class="rating-stars-text">${buildStarsText(ratingNum)}</span>
          <span class="rating-num">${ratingNum}/5</span>
        </div>
        ${feedback
          ? `<div class="rating-feedback">${esc(feedback).replace(/\n/g,'<br>')}</div>`
          : `<div class="rating-hint">Tanpa feedback.</div>`
        }
      </div>
    `;
  }

  // Kalau user buka via ID (tanpa token), jangan izinkan rating (biar tidak bisa spam)
  if (!token) {
    return `
      <div class="rating-section">
        <div class="section-label">Rating untuk Admin</div>
        <div class="rating-hint">Untuk memberi rating, buka tiket ini dari link yang memakai <b>token</b> (contoh: <code>?token=...</code>).</div>
      </div>
    `;
  }

  return `
    <div class="rating-section" id="rating-section">
      <div class="section-label">Rating untuk Admin</div>
      <div class="rating-hint">Tiket sudah selesai. Bantu kami dengan rating untuk admin yang menyelesaikan tiket ini.</div>

      <div class="rating-stars" id="rating-stars">
        ${[1,2,3,4,5].map(i => `<button class="star-btn" type="button" data-v="${i}" aria-label="Bintang ${i}">★</button>`).join('')}
      </div>

      <textarea id="rating-feedback" class="rating-input" rows="3" placeholder="Tulis feedback (opsional)..."></textarea>

      <div class="rating-actions">
        <button class="btn btn-primary" id="rating-submit" type="button">Kirim Rating</button>
        <div class="rating-msg" id="rating-msg" style="display:none;"></div>
      </div>
    </div>
  `;
}

function buildTicketAttachmentGallery(ticket) {
  const attachments = Array.isArray(ticket && ticket.attachments) ? ticket.attachments : [];
  const images = attachments
    .filter(a => a && a.base64 && a.type && String(a.type).startsWith('image/'))
    .map(a => `
      <a class="ticket-attachment-link" href="${buildImgDataUrl(a)}" target="_blank" rel="noopener">
        <img class="ticket-attachment-img" src="${buildImgDataUrl(a)}" alt="${esc(a.name || 'gambar bukti')}">
      </a>
    `)
    .join('');

  if (!images) return '';

  return `
    <div class="field field-attachments">
      <span class="field-label">Gambar Bukti</span>
      <div class="ticket-attachments">${images}</div>
    </div>
  `;
}

function showRatingMsg(msg, type = 'info') {
  const el = document.getElementById('rating-msg');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; el.className = 'rating-msg'; return; }
  el.style.display = 'block';
  el.textContent = msg;
  el.className = 'rating-msg ' + (type === 'err' ? 'is-err' : 'is-ok');
}

function bindRating(ticket) {
  const isDone = !!(ticket && (ticket.done || ticket.status === 'done'));
  const token = getTokenFromURL() || '';
  if (!isDone || ticket.rating || !token) return;

  _pendingRating = 0;
  showRatingMsg('', 'info');

  const starsWrap = document.getElementById('rating-stars');
  const submitBtn = document.getElementById('rating-submit');
  const fbEl = document.getElementById('rating-feedback');
  if (!starsWrap || !submitBtn) return;

  function refreshStars() {
    const btns = starsWrap.querySelectorAll('button.star-btn');
    btns.forEach(btn => {
      const v = parseInt(btn.getAttribute('data-v') || '0', 10);
      btn.classList.toggle('is-active', v <= _pendingRating);
    });
  }

  starsWrap.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('button.star-btn') : null;
    if (!btn) return;
    _pendingRating = parseInt(btn.getAttribute('data-v') || '0', 10) || 0;
    refreshStars();
  });
  refreshStars();

  submitBtn.addEventListener('click', async () => {
    if (!ticket || !ticket.id) return;
    if (_pendingRating < 1 || _pendingRating > 5) {
      showRatingMsg('Pilih bintang 1–5 dulu.', 'err');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Mengirim...';
    try {
      const feedback = fbEl ? String(fbEl.value || '').trim() : '';
      const res = await fetch(TICKET_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rate',
          id: ticket.id,
          token,
          rating: _pendingRating,
          feedback,
        }),
      });
      const data = await res.json();
      if (!data || !data.ok) throw new Error(data?.error || 'Gagal kirim rating');
      showRatingMsg('Terima kasih! Rating kamu sudah tersimpan.', 'ok');
      // Reload tiket supaya tampilan berubah jadi "rating display"
      setTimeout(loadTicket, 600);
    } catch (e) {
      showRatingMsg(e.message || 'Gagal mengirim rating.', 'err');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Kirim Rating';
    }
  });
}

function buildImgDataUrl(att) {
  if (!att || !att.base64 || !att.type) return '';
  return `data:${att.type};base64,${att.base64}`;
}

function renderChatMessages(messages) {
  const msgs = Array.isArray(messages) ? messages : [];
  if (!msgs.length) {
    return `<div class="chat-empty">Belum ada chat. Kamu bisa mulai tanya admin lewat sini.</div>`;
  }

  return msgs.map(m => {
    const from = m.from === 'admin' ? 'admin' : 'user';
    const time = m.at ? formatDate(m.at) : '—';
    const text = (m.text || '').trim();
    const adminName = (from === 'admin' && m && m.adminUser) ? String(m.adminUser).trim() : '';
    const who = from === 'admin' ? (adminName ? `Admin (${esc(adminName)})` : 'Admin') : 'Kamu';
    const images = Array.isArray(m.attachments)
      ? m.attachments
          .filter(a => a && a.base64 && a.type && String(a.type).startsWith('image/'))
          .map(a => `<a class="chat-img-link" href="${buildImgDataUrl(a)}" target="_blank" rel="noopener">
              <img class="chat-img" src="${buildImgDataUrl(a)}" alt="${esc(a.name || 'foto')}">
            </a>`)
          .join('')
      : '';

    return `
      <div class="chat-row ${from}">
        <div class="chat-bubble">
          ${text ? `<div class="chat-text">${esc(text).replace(/\n/g, '<br>')}</div>` : ''}
          ${images ? `<div class="chat-images">${images}</div>` : ''}
          <div class="chat-meta">${who} · ${time}</div>
        </div>
      </div>
    `;
  }).join('');
}

function buildChatSection(ticket) {
  const isDone = !!(ticket && (ticket.done || ticket.status === 'done' || ticket.status === 'cancelled'));
  return `
    <div class="chat-section" aria-label="Chat tiket">
      <div class="section-label">Chat dengan Admin</div>
      <div class="chat-hint">${isDone ? (ticket && ticket.status === 'cancelled' ? 'Tiket dibatalkan. Chat ditutup.' : 'Tiket sudah selesai. Chat ditutup.') : 'Kamu bisa kirim pesan atau foto bukti (maks 5MB).'}</div>

      <div class="chat-box" id="ticket-chat-box">
        ${renderChatMessages(ticket && ticket.messages)}
      </div>

      ${isDone ? '' : `
        <div class="chat-compose">
          <label class="chat-attach" for="chat-file" title="Kirim foto bukti (maks 5MB)">📎</label>
          <input id="chat-file" type="file" accept="image/*" style="display:none">
          <textarea id="chat-input" class="chat-input" rows="1" placeholder="Tulis pesan untuk admin..."></textarea>
          <button class="chat-send" id="chat-send" type="button">Kirim</button>
        </div>
        <div class="chat-file-note" id="chat-file-note" style="display:none;"></div>
        <div class="chat-warn" id="chat-warn" style="display:none;"></div>
      `}
    </div>
  `;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function showChatWarn(msg) {
  const w = document.getElementById('chat-warn');
  if (!w) return;
  if (!msg) { w.style.display = 'none'; w.textContent = ''; return; }
  w.style.display = 'block';
  w.textContent = msg;
}

function bindChat(ticket) {
  const fileEl = document.getElementById('chat-file');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const noteEl = document.getElementById('chat-file-note');

  if (!fileEl || !inputEl || !sendBtn) return;

  fileEl.addEventListener('change', () => {
    showChatWarn('');
    const f = fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      _chatFile = null;
      fileEl.value = '';
      if (noteEl) { noteEl.style.display = 'none'; noteEl.textContent = ''; }
      showChatWarn('Ukuran foto maksimal 5MB. Tolong kompres / kirim ulang versi lebih kecil.');
      return;
    }
    _chatFile = f;
    if (noteEl) {
      noteEl.style.display = 'block';
      noteEl.textContent = `Terpilih: ${f.name} (${Math.ceil(f.size / 1024)} KB)`;
    }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  sendBtn.addEventListener('click', async () => {
    if (!ticket || !ticket.id) return;
    showChatWarn('');

    const text = (inputEl.value || '').trim();
    if (!text && !_chatFile) {
      showChatWarn('Tulis pesan dulu atau pilih foto.');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Mengirim...';

    try {
      const token = getTokenFromURL();
      const atts = [];
      if (_chatFile) {
        const b64 = await fileToBase64(_chatFile);
        atts.push({ name: _chatFile.name, type: _chatFile.type, base64: b64 });
      }

      const res = await fetch(TICKET_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_message',
          id: ticket.id,
          token: token || '',
          text,
          attachments: atts,
        }),
      });
      const data = await res.json();
      if (!data || !data.ok) throw new Error(data?.error || 'Gagal kirim pesan');

      // Reset compose
      inputEl.value = '';
      _chatFile = null;
      fileEl.value = '';
      if (noteEl) { noteEl.style.display = 'none'; noteEl.textContent = ''; }

      // Refresh tiket untuk ambil chat terbaru
      await loadTicket();
    } catch (e) {
      showChatWarn(e.message || 'Gagal mengirim pesan.');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Kirim';
    }
  });
}

function clearAutoRefresh() {
  if (_refreshTimer) {
    clearTimeout(_refreshTimer);
    _refreshTimer = null;
  }
}

function scheduleAutoRefresh() {
  clearAutoRefresh();
  _refreshTimer = setTimeout(() => {
    loadTicket({ silent: true });
  }, REFRESH_DELAY);
}

/* ══════════════════════════════════════
   RENDER: LOADING
══════════════════════════════════════ */
function renderLoading() {
  document.getElementById('ticket-card').innerHTML = `
    <div class="state-wrap">
      <div class="spinner"></div>
      <div class="state-title">Memuat tiket...</div>
      <div class="state-msg">Sedang mengambil data dari server</div>
    </div>`;
  document.getElementById('refresh-hint').style.display = 'none';
}

/* ══════════════════════════════════════
   RENDER: STEPPER
══════════════════════════════════════ */
function buildStepper(step, isDone) {
  return STEP_LABELS.map((label, i) => {
    let cls = '';
    const isLastStep = (i === STEP_LABELS.length - 1);

    if (isDone) {
      cls = 'is-complete'; // semua hijau jika done
    } else if (i < step) {
      cls = 'is-done';
    } else if (i === step) {
      cls = 'is-active-step';
    }

    const dotContent = (i < step || isDone) ? '✓' : (i + 1);
    return `
      <div class="step-item ${cls}">
        <div class="step-dot">${dotContent}</div>
        <div class="step-label">${label}</div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   RENDER: TICKET
══════════════════════════════════════ */
function renderTicket(ticket) {
  const card   = document.getElementById('ticket-card');
  const step   = ticket.statusStep ?? 0;
  const isCancelled = ticket.status === 'cancelled';
  const isDone = ticket.done || ticket.status === 'done' || isCancelled;
  const cfg    = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.received;
  const closedByHtml = isDone && ticket.closedBy
    ? `<div class="resolved-by">${isCancelled ? 'Dibatalkan oleh' : 'Diselesaikan oleh'} <b>${esc(ticket.closedBy)}</b></div>`
    : '';
  const cancelReasonHtml = isCancelled
    ? `<div class="cancel-reason-box">
        <span class="cancel-reason-label">Alasan pembatalan</span>
        ${esc(ticket.cancelReason || 'Admin tidak memberikan alasan tambahan.').replace(/\n/g, '<br>')}
       </div>`
    : '';

  const typeBadge = ticket.type === 'bug'
    ? '<span class="badge badge-bug">🐛 Laporan Bug</span>'
    : '<span class="badge badge-suggestion">💡 Saran</span>';

  const gameBadge = ticket.game && ticket.game !== '—'
    ? `<span class="badge badge-game">🎮 ${esc(ticket.game)}</span>`
    : '';

  const devNoteHtml = ticket.devNote
    ? `<div class="dev-note-box">
        <span class="dev-note-label">📝 Catatan Developer</span>
        ${esc(ticket.devNote).replace(/\n/g, '<br>')}
       </div>`
    : '';

  const updatedHtml = (ticket.updatedAt && ticket.updatedAt !== ticket.createdAt)
    ? `<div class="field">
        <span class="field-label">Terakhir Diperbarui</span>
        <span class="field-value timestamp">${formatDate(ticket.updatedAt)}</span>
       </div>`
    : '';

  const ratingHtml = isCancelled ? '' : buildRatingSection(ticket);
  const chatHtml = buildChatSection(ticket);

  card.innerHTML = `
    <!-- HEADER -->
    <div class="ticket-header">
      <div class="ticket-header-top">
        <div>
          <span class="ticket-num-label">Nomor Tiket</span>
          <div class="ticket-id-display">${esc(ticket.id)}</div>
        </div>
        <span class="ticket-num-badge">#${ticket.num}</span>
      </div>
      <div class="ticket-badges">
        ${typeBadge}
        ${gameBadge}
      </div>
    </div>

    <!-- PROGRESS -->
    <div class="progress-section">
      <div class="section-label">Progress Penanganan</div>
      <div class="stepper">
        ${buildStepper(step, isDone)}
      </div>
      <div class="status-note ${cfg.cls}">
        <span class="status-note-icon">${cfg.icon}</span>
        <div class="status-note-text">
          <span class="status-note-title">${cfg.title}</span>
          ${cfg.msg}
        </div>
      </div>
      ${closedByHtml}
      ${cancelReasonHtml}
      ${devNoteHtml}
    </div>

    <!-- DETAIL -->
    <div class="detail-section">
      <div class="section-label">Detail Laporan</div>
      <div class="detail-grid">
        <div class="field">
          <span class="field-label">Game</span>
          <span class="field-value">${esc(ticket.game || '—')}</span>
        </div>
        <div class="field">
          <span class="field-label">Tanggal Laporan</span>
          <span class="field-value timestamp">${formatDate(ticket.createdAt)}</span>
        </div>
        ${updatedHtml}
        <div class="field field-desc">
          <span class="field-label">Isi Laporan</span>
          <div class="desc-box">${esc(ticket.desc || '—').replace(/\n/g, '<br>')}</div>
        </div>
        ${buildTicketAttachmentGallery(ticket)}
      </div>
    </div>

    ${ratingHtml}

    ${chatHtml}

    <!-- FOOTER ACTIONS -->
    <div class="card-footer">
      <a href="../cs/" class="btn btn-ghost">← Kembali ke CS</a>
      ${!isDone ? `<button class="btn btn-ghost" onclick="loadTicket()">↺ Refresh Status</button>` : ''}
    </div>
  `;

  // Tunjukkan/sembunyikan refresh hint
  document.getElementById('refresh-hint').style.display = isDone ? 'none' : 'block';

  if (!isDone) bindChat(ticket);
  if (ticket.status === 'done') bindRating(ticket);
}

/* ══════════════════════════════════════
   RENDER: CLOSED / EXPIRED
══════════════════════════════════════ */
function renderClosed(num) {
  document.getElementById('ticket-card').innerHTML = `
    <div class="state-wrap">
      <div class="closed-icon-wrap">🎉</div>
      <div class="state-title" style="color: var(--green); font-size: 1.05rem;">Tiket #${num} Selesai!</div>
      <div class="state-msg" style="margin-top: 10px; max-width: 300px; margin-inline: auto;">
        Masalah pada tiket ini sudah berhasil diselesaikan oleh developer.<br><br>
        Tiket telah ditutup. Terima kasih sudah membantu Nusabit Studio menjadi lebih baik! 🙌
      </div>
      <div style="margin-top: 24px;">
        <a href="../cs/" class="btn btn-ghost">← Kembali ke CS</a>
      </div>
    </div>`;
  document.getElementById('refresh-hint').style.display = 'none';
}

/* ══════════════════════════════════════
   RENDER: ERROR (custom per kode)
══════════════════════════════════════ */
const ERROR_TYPES = {
  not_found: {
    icon:  '🔍',
    code:  'TIKET TIDAK DITEMUKAN',
    title: 'Token Tidak Valid',
    msg:   'Tiket tidak ditemukan di sistem kami. Pastikan kamu pakai link/token yang benar, atau masukkan ID tiket (contoh: GS-XXXX).',
  },
  network: {
    icon:  '🌐',
    code:  'KONEKSI GAGAL',
    title: 'Tidak Dapat Terhubung',
    msg:   'Gagal terhubung ke server kami. Periksa koneksi internetmu dan coba lagi.',
  },
  server: {
    icon:  '⚠️',
    code:  'ERROR SERVER',
    title: 'Server Bermasalah',
    msg:   'Terjadi kesalahan pada server kami. Tim sedang memperbaiki, coba lagi dalam beberapa menit.',
  },
  no_token: {
    icon:  '🔑',
    code:  'TIDAK ADA PARAMETER',
    title: 'Link Tidak Lengkap',
    msg:   'URL ini tidak mengandung token atau ID tiket. Gunakan link yang kamu terima setelah membuat laporan, atau masukkan ID tiket secara manual.',
  },
};

function renderError(type = 'not_found', customMsg = '') {
  const cfg = ERROR_TYPES[type] || ERROR_TYPES.not_found;
  const msg = customMsg || cfg.msg;

  document.getElementById('ticket-card').innerHTML = `
    <div class="state-wrap">
      <div class="error-icon-wrap">${cfg.icon}</div>
      <div class="error-code">${cfg.code}</div>
      <div class="state-title" style="color: var(--red);">${cfg.title}</div>
      <div class="state-msg" style="max-width: 340px; margin-inline: auto;">${esc(msg)}</div>

      <!-- Manual Token Input -->
      <div class="manual-input-section">
        <span class="manual-input-label">Punya kode tiket? Masukkan di sini:</span>
        <div class="manual-input-row">
          <input
            type="text"
            id="manual-token"
            class="manual-input"
            placeholder="Contoh: A1B2C3D4E5..."
            maxlength="80"
            autocomplete="off"
            spellcheck="false">
          <button class="manual-search-btn" onclick="cekManual()">🔍 CEK</button>
        </div>
      </div>

      <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
        <a href="../cs/" class="btn btn-ghost">← Kembali ke CS</a>
        <button class="btn btn-ghost" onclick="loadTicket()">↺ Coba Lagi</button>
      </div>
    </div>`;

  document.getElementById('refresh-hint').style.display = 'none';

  // Enter key di input
  setTimeout(() => {
    const inp = document.getElementById('manual-token');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') cekManual(); });
  }, 100);
}

/* ══════════════════════════════════════
   MANUAL TOKEN CHECK
══════════════════════════════════════ */
function cekManual() {
  const raw = (document.getElementById('manual-token')?.value || '').trim();
  if (!raw) return;

  // Kalau user paste link penuh, ekstrak token / id
  const matchToken = raw.match(/[?&]token=([^&#]+)/i);
  const matchId    = raw.match(/[?&]id=([^&#]+)/i);
  const extracted  = matchToken ? decodeURIComponent(matchToken[1]) : (matchId ? decodeURIComponent(matchId[1]) : raw);

  // Kalau bentuknya ID tiket (mis. GS-XXXX), pakai mode id biar tidak "tidak ditemukan"
  const looksLikeId = /^GS-[A-Z0-9]+/i.test(extracted);
  if (looksLikeId) {
    window.location.href = `/tiket/?id=${encodeURIComponent(extracted.toUpperCase())}`;
    return;
  }

  window.location.href = `/tiket/?token=${encodeURIComponent(extracted)}`;
}

// Expose ke window (dipanggil dari onclick HTML)
window.cekManual = cekManual;

/* ══════════════════════════════════════
   LOAD TICKET (main function)
══════════════════════════════════════ */
async function loadTicket(options = {}) {
  const token = getTokenFromURL();
  const id    = getIdFromURL();
  const silent = !!options.silent;
  clearAutoRefresh();

  if (!token && !id) {
    renderError('no_token');
    return;
  }

  if (!silent) renderLoading();

  try {
    const normalizedId = !id && token && /^GS-[A-Z0-9]+$/i.test(String(token).trim())
      ? String(token).trim().toUpperCase()
      : '';

    // Kalau user buka link salah format seperti `?token=GS-XXXX`, otomatis normalkan ke `?id=GS-XXXX`
    if (normalizedId) {
      const targetUrl = `/tiket/?id=${encodeURIComponent(normalizedId)}`;
      if (window.location.search !== `?id=${encodeURIComponent(normalizedId)}`) {
        window.history.replaceState({}, '', targetUrl);
      }
    }

    const qs = normalizedId
      ? `id=${encodeURIComponent(normalizedId)}`
      : (token ? `token=${encodeURIComponent(token)}` : `id=${encodeURIComponent(id)}`);

    const res = await fetch(`${TICKET_API}?${qs}`);

    // Server error (5xx)
    if (res.status >= 500) {
      clearAutoRefresh();
      renderError('server');
      return;
    }

    const data = await res.json();

    if (!data.ok) {
      clearAutoRefresh();
      // Tiket tidak ditemukan (404 atau token salah)
      renderError('not_found', data.error);
      return;
    }

    if (data.expired) {
      clearAutoRefresh();
      renderClosed(data.num);
      return;
    }

    renderTicket(data.ticket);

    // Auto-refresh jika tiket masih aktif
    if (!(data.ticket.done || data.ticket.status === 'done' || data.ticket.status === 'cancelled')) {
      scheduleAutoRefresh();
    } else {
      clearAutoRefresh();
    }

  } catch (err) {
    clearAutoRefresh();
    // Network / parse error
    renderError('network');
  }
}

window.loadTicket = loadTicket;

/* ══════════════════════════════════════
   ANNOUNCEMENT BANNER
══════════════════════════════════════ */
function initAnnouncement() {
  const banner = document.getElementById('announcement-banner');
  if (!banner) return;

  // Cek apakah user sudah close banner ini
  const dismissed = sessionStorage.getItem('ann-tiket-v1');
  if (dismissed) { banner.style.display = 'none'; return; }

  document.getElementById('ann-close')?.addEventListener('click', () => {
    banner.style.display = 'none';
    sessionStorage.setItem('ann-tiket-v1', '1');
  });
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initAnnouncement();
  loadTicket();
});
