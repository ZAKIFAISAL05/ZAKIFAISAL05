/**
 * tiket/script.js — Nusabit Studio
 * Halaman Status Tiket — Logic utama (dipisah dari HTML)
 */

'use strict';

/* ══════════════════════════════════════
   CONSTANTS
══════════════════════════════════════ */
const TICKET_API    = '/.netlify/functions/ticket';
const REFRESH_DELAY = 30_000; // ms (auto-refresh setiap 30 detik jika belum selesai)

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
};

/* ══════════════════════════════════════
   UTILITY
══════════════════════════════════════ */

/** Ambil token dari URL query string */
function getTokenFromURL() {
  return new URLSearchParams(window.location.search).get('token');
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
  const isDone = ticket.done || ticket.status === 'done';
  const cfg    = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.received;

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
      </div>
    </div>

    <!-- FOOTER ACTIONS -->
    <div class="card-footer">
      <a href="../cs/" class="btn btn-ghost">← Kembali ke CS</a>
      ${!isDone ? `<button class="btn btn-ghost" onclick="loadTicket()">↺ Refresh Status</button>` : ''}
    </div>
  `;

  // Tunjukkan/sembunyikan refresh hint
  document.getElementById('refresh-hint').style.display = isDone ? 'none' : 'block';
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
    msg:   'Token tidak ditemukan di sistem kami. Pastikan kamu menggunakan link yang dikirim saat laporan dibuat.',
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
    code:  'TIDAK ADA TOKEN',
    title: 'Link Tidak Lengkap',
    msg:   'URL ini tidak mengandung token tiket. Gunakan link yang kamu terima setelah membuat laporan.',
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

  // Kalau user paste link penuh, ekstrak token-nya
  const match = raw.match(/[?&]token=([^&#]+)/);
  const token = match ? decodeURIComponent(match[1]) : raw;

  window.location.href = `/tiket/?token=${encodeURIComponent(token)}`;
}

// Expose ke window (dipanggil dari onclick HTML)
window.cekManual = cekManual;

/* ══════════════════════════════════════
   LOAD TICKET (main function)
══════════════════════════════════════ */
async function loadTicket() {
  const token = getTokenFromURL();

  if (!token) {
    renderError('no_token');
    return;
  }

  renderLoading();

  try {
    const res = await fetch(`${TICKET_API}?token=${encodeURIComponent(token)}`);

    // Server error (5xx)
    if (res.status >= 500) {
      renderError('server');
      return;
    }

    const data = await res.json();

    if (!data.ok) {
      // Tiket tidak ditemukan (404 atau token salah)
      renderError('not_found', data.error);
      return;
    }

    if (data.expired) {
      renderClosed(data.num);
      return;
    }

    renderTicket(data.ticket);

    // Auto-refresh setiap 30 detik jika tiket belum selesai
    if (!data.ticket.done) {
      setTimeout(loadTicket, REFRESH_DELAY);
    }

  } catch (err) {
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
