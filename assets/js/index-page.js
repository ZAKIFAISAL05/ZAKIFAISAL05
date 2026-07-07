'use strict';

// ============================================================
//  index-page.js
//  Logic khusus homepage / landing page Nusabit Studio
// ============================================================

// ── LANGUAGE TOGGLE ──────────────────────────────────────────
// Language toggle otomatis ditangani oleh `assets/js/lang-auto.js` (global).

// ── PENGUMUMAN WEBSITE (dari Admin Panel) ────────────────────
function initSiteAnnouncement() {
  var box = document.getElementById('site-announcement');
  var textEl = document.getElementById('site-announcement-text');
  var closeBtn = document.getElementById('site-announcement-close');
  if (!box || !textEl) return;

  // Render dari settings → kalau belum ada, banner tetap disembunyikan
  function renderFromSettings(settings) {
    var ann = settings && settings.announcement;
    if (!ann || !ann.enabled || !ann.message) {
      box.style.display = 'none';
      return;
    }

    // Kalau server kasih expiresAt, pakai untuk auto-hide global
    var exp = ann.expiresAt ? Date.parse(ann.expiresAt) : NaN;
    if (!Number.isNaN(exp)) {
      var remainingMs = exp - Date.now();
      if (remainingMs <= 0) {
        box.style.display = 'none';
        return;
      }

      // Auto-hide saat waktu habis (kalau user masih di halaman)
      setTimeout(function () {
        box.style.display = 'none';
      }, remainingMs);
    }

    textEl.textContent = ann.message;
    box.style.display = '';
  }

  // Tombol close (hanya untuk user ini, tidak mematikan global)
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', function () {
      box.style.display = 'none';
    });
  }

  // Ambil settings: prioritas pakai hasil dari site-guard.js (jika sudah ada)
  if (window.__SITE_SETTINGS__) {
    renderFromSettings(window.__SITE_SETTINGS__);
    return;
  }

  // Fallback: fetch sendiri (kalau site-guard gagal / belum keburu)
  fetch('/.netlify/functions/site-settings', { method: 'GET', cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.ok) return;
      window.__SITE_SETTINGS__ = data.settings || {};
      renderFromSettings(window.__SITE_SETTINGS__);
    })
    .catch(function () {
      // ignore
    });
}

// ── CEK TIKET WIDGET ─────────────────────────────────────────
function cekTiket() {
  var raw = (document.getElementById('tiket-input').value || '').trim();
  if (!raw) {
    shakeInput();
    return;
  }

  // Bisa input:
  // - Link tiket (…/tiket/?token=XXXX) atau (…/tiket/?id=GS-XXXX)
  // - Token saja
  // - ID tiket saja (GS-XXXX) → biar tidak "tiket tidak ditemukan"
  var token = '';
  var id = '';

  var mToken = raw.match(/[?&]token=([^&#]+)/i);
  if (mToken) {
    token = mToken[1];
    try { token = decodeURIComponent(token); } catch (e) {}
  }

  var mId = raw.match(/[?&]id=([^&#]+)/i);
  if (mId) {
    id = mId[1];
    try { id = decodeURIComponent(id); } catch (e) {}
  }

  if (!token && !id) {
    // kalau user input "GS-..." anggap sebagai id
    if (/^GS-[A-Z0-9]+/i.test(raw)) id = raw.toUpperCase();
    else token = raw;
  }

  window.location.href = id
    ? '/tiket/?id=' + encodeURIComponent(id)
    : '/tiket/?token=' + encodeURIComponent(token);
}

function shakeInput() {
  var inp = document.getElementById('tiket-input');
  if (!inp) return;
  inp.classList.add('shake');
  inp.focus();
  setTimeout(function () {
    inp.classList.remove('shake');
  }, 500);
}

// ── REPORT MODAL ─────────────────────────────────────────────
function openReportModal(type) {
  var bg = document.getElementById('modal-' + type + '-bg');
  if (bg) {
    bg.classList.add('open');
    document.body.classList.add('modal-open');
  }

  var form = document.getElementById('modal-' + type + '-form');
  var succ = document.getElementById('modal-' + type + '-success');
  if (form) form.style.display = '';
  if (succ) succ.style.display = 'none';

  var btn = document.getElementById(type + '-submit');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = type === 'bug'
      ? '<i data-feather="alert-triangle"></i> Kirim Laporan Bug'
      : '<i data-feather="zap"></i> Kirim Saran';
  }

  rerenderFeather();
}

function closeReportModal(type) {
  var bg = document.getElementById('modal-' + type + '-bg');
  if (bg) {
    bg.classList.remove('open');
    document.body.classList.remove('modal-open');
  }
}

async function submitReport(type) {
  var game = (document.getElementById(type + '-game')?.value || '').trim();
  var desc = (document.getElementById(type + '-desc')?.value || '').trim();
  var email = (document.getElementById(type + '-email')?.value || '').trim();
  var contact = (document.getElementById(type + '-contact')?.value || '').trim();
  var btn = document.getElementById(type + '-submit');

  if (!desc) {
    alert('Deskripsi tidak boleh kosong.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Mengirim...';
  }

  try {
    var res = await fetch('/.netlify/functions/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, game: game || 'Tidak disebutkan', desc, email, contact })
    });

    var data = await res.json();
    var form = document.getElementById('modal-' + type + '-form');
    var succ = document.getElementById('modal-' + type + '-success');

    if (form) form.style.display = 'none';
    if (succ) succ.style.display = '';

    if (data.ticketId && type === 'bug') {
      var ticketBox = document.getElementById('bug-ticket-box');
      var ticketNum = document.getElementById('bug-ticket-num');
      if (ticketBox) ticketBox.style.display = '';
      if (ticketNum) ticketNum.textContent = data.ticketNum ? ('Tiket #' + data.ticketNum) : ('#' + data.ticketId);
    }

    rerenderFeather();
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = type === 'bug'
        ? '<i data-feather="alert-triangle"></i> Kirim Laporan Bug'
        : '<i data-feather="zap"></i> Kirim Saran';
    }
    rerenderFeather();
    alert('Gagal mengirim. Coba lagi.');
  }
}

// ── LOGIKA FILTER DAN PENCERIAN GAME (FIXED INITIAL PREVENT) ──
function initGamesFilter() {
  var searchInput = document.getElementById('game-search');
  var clearBtn = document.getElementById('game-search-clear');
  var tabs = document.querySelectorAll('.filter-tab, .games-tab-btn');
  var emptyState = document.getElementById('games-empty-state');

  // Sembunyikan empty state sejak awal inisialisasi agar tidak mengintip keluar
  if (emptyState) {
    emptyState.setAttribute('hidden', '');
    emptyState.style.display = 'none';
  }

  function filterGames(isInitialLoad) {
    var activeTab = document.querySelector('.filter-tab.active, .games-tab-btn.active');
    
    var category = 'all';
    if (activeTab) {
      category = (activeTab.getAttribute('data-genre') || activeTab.getAttribute('data-filter') || 'all').toLowerCase();
    }
    
    var q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    var cards = document.querySelectorAll('.game-card');
    var gamesFoundCount = 0;

    cards.forEach(function (card) {
      var cardGenre = (card.getAttribute('data-genre') || card.getAttribute('data-category') || '').toLowerCase();
      var title = card.querySelector('.game-title') ? card.querySelector('.game-title').textContent.toLowerCase() : '';
      var desc = card.querySelector('.game-description') ? card.querySelector('.game-description').textContent.toLowerCase() : '';
      var tags = (card.getAttribute('data-tags') || '').toLowerCase();

      var matchCat = (category === 'all' || cardGenre.indexOf(category) !== -1);
      var matchQuery = (!q || title.indexOf(q) !== -1 || desc.indexOf(q) !== -1 || tags.indexOf(q) !== -1);

      if (matchCat && matchQuery) {
        card.style.display = '';
        gamesFoundCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Jalankan logika empty state hanya jika ini BUKAN load pertama kali website dibuka
    if (emptyState && !isInitialLoad) {
      if (gamesFoundCount === 0) {
        emptyState.removeAttribute('hidden');
        emptyState.style.display = 'block';
      } else {
        emptyState.setAttribute('hidden', '');
        emptyState.style.display = 'none';
      }
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      if (clearBtn) {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
      }
      filterGames(false); // false berarti user sedang mengetik (bukan load awal)
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      searchInput.focus();
      filterGames(false);
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      filterGames(false);
    });
  });

  // Jalankan filter pertama kali dengan status 'true' (Initial Load) supaya aman tersembunyi
  filterGames(true);
}

// ── INIT HOMEPAGE ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  var ticketInput = document.getElementById('tiket-input');
  if (ticketInput) {
    ticketInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') cekTiket();
    });
  }

  ['modal-bug-bg', 'modal-saran-bg'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function(e) {
      if (e.target === el) closeReportModal(el.id.replace('modal-', '').replace('-bg', ''));
    });
  });

  initSiteAnnouncement();
  initGamesFilter(); 
  if (typeof window.initReviewsSlider === 'function') window.initReviewsSlider();
});
