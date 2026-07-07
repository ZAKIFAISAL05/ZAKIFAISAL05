'use strict';

// ============================================================
//  index-page.js
//  Logic khusus homepage / landing page Nusabit Studio
// ============================================================

// ── LANGUAGE TOGGLE ──────────────────────────────────────────
var LANG = localStorage.getItem('gs_lang') || 'id';

var TRANSLATIONS = {
  id: {
    'menu-home': 'HOME',
    'menu-games': 'GAMES',
    'menu-stats': 'STATISTIK',
    'menu-about': 'TENTANG',
    'menu-contact': 'KONTAK',
    'menu-cs': '<i data-feather="message-circle"></i> CUSTOMER SERVICE',
    'nav-tiket': '<i data-feather="tag"></i> TIKET',
    'hero-badge': '<span class="hero-badge-dot"></span><i data-feather="monitor"></i> Studio Game Indie Indonesia',
    'txt-see-games': 'LIHAT SEMUA GAME',
    'txt-cs': 'CUSTOMER SERVICE',
    'stat-released': 'GAME DIRILIS',
    'stat-players': 'TOTAL PEMAIN',
    'stat-platforms': 'PLATFORM',
    'stat-founded': 'TAHUN BERDIRI',
    'sec-games': 'PROYEK GAME KAMI',
    'games-search-label': 'Cari proyek / game',
    'games-search-placeholder': 'Cari judul, genre, atau deskripsi game...',
    'games-empty-text': 'Belum ada game yang cocok dengan pencarian atau filter kamu.',
    'filter-all': 'SEMUA',
    'filter-arcade': 'ARCADE',
    'filter-action': 'ACTION',
    'filter-simulation': 'SIMULASI',
    'filter-platformer': 'PLATFORMER',
    'filter-roblox': 'ROBLOX',
    'game-desc-1': 'Parkour 2D terinspirasi Minecraft. (Mobile)',
    'game-desc-2': 'Aksi bertahan hidup melawan gerombolan zombie. (Mobile)',
    'game-desc-3': 'Manajemen desa dan investasi melawan zombie.',
    'game-desc-4': 'Parkour 2D kompetitif, speedrun challenge. (Mobile & Windows)',
    'game-desc-5': 'Kelanjutan simulasi pembangunan desa. (Mobile)',
    'game-desc-6': 'Game survival zombie populer di Roblox. (PC & Mobile)',
    'game-desc-7': 'Obby parkour menantang, uji ketepatan dan kecepatan.',
    'sec-reviews': 'ULASAN PEMAIN',
    'reviews-sub': 'Apa kata pemain tentang Nusabit Studio',
    'sec-about': 'TENTANG NUSABIT STUDIO',
    'about-desc': 'Kami adalah studio game indie yang bersemangat menciptakan pengalaman bermain yang unik dan menantang. Dari Indonesia, kami fokus pada genre Survival, RPG, dan Strategy — dengan sentuhan cerita yang dalam di setiap gameplay. Semoga game kami menghiburmu!',
    'about-tip': 'Coba ketik',
    'about-tip2': 'untuk easter egg!',
    'btn-bug': '<i data-feather="alert-triangle"></i> LAPORKAN BUG',
    'btn-saran': '<i data-feather="zap"></i> KIRIM SARAN',
    'footer-tagline': 'Menciptakan game digital yang layak untuk dimainkan.',
    'footer-cs': '<i data-feather="message-circle"></i> Customer Service',
    'footer-ticket': '<i data-feather="tag"></i> Cek Status Tiket',
    'footer-copy': '© 2025 Nusabit Studio. All Rights Reserved.',
    'lang-label': '🇮🇩 ID',
    'cek-tiket-title': 'CEK STATUS LAPORAN',
    'cek-tiket-sub': 'Sudah pernah lapor bug atau kirim saran? Pantau statusnya di sini.',
    'btn-cek-tiket': 'CEK TIKET',
    'tiket-placeholder': 'Masukkan nomor tiket (contoh: GS-ABC123...)',
    'tiket-hint': 'Token tiket dikirim via email saat kamu kirim laporan, atau lihat di bubble chat CS.'
  },
  en: {
    'menu-home': 'HOME',
    'menu-games': 'GAMES',
    'menu-stats': 'STATS',
    'menu-about': 'ABOUT',
    'menu-contact': 'CONTACT',
    'menu-cs': '<i data-feather="message-circle"></i> CUSTOMER SERVICE',
    'nav-tiket': '<i data-feather="tag"></i> TICKET',
    'hero-badge': '<span class="hero-badge-dot"></span><i data-feather="monitor"></i> Indonesian Indie Game Studio',
    'txt-see-games': 'VIEW ALL GAMES',
    'txt-cs': 'CUSTOMER SERVICE',
    'stat-released': 'GAMES RELEASED',
    'stat-players': 'TOTAL PLAYERS',
    'stat-platforms': 'PLATFORMS',
    'stat-founded': 'FOUNDED',
    'sec-games': 'OUR GAME PROJECTS',
    'games-search-label': 'Search projects / games',
    'games-search-placeholder': 'Search title, genre, or game description...',
    'games-empty-text': 'No games match your search or filter.',
    'filter-all': 'ALL',
    'filter-arcade': 'ARCADE',
    'filter-action': 'ACTION',
    'filter-simulation': 'SIMULATION',
    'filter-platformer': 'PLATFORMER',
    'filter-roblox': 'ROBLOX',
    'game-desc-1': 'A 2D parkour game inspired by Minecraft. (Mobile)',
    'game-desc-2': 'A survival action game against hordes of zombies. (Mobile)',
    'game-desc-3': 'Village management and investment against zombies.',
    'game-desc-4': 'Competitive 2D parkour with a speedrun challenge. (Mobile & Windows)',
    'game-desc-5': 'The continuation of a village-building simulation. (Mobile)',
    'game-desc-6': 'A popular zombie survival game on Roblox. (PC & Mobile)',
    'game-desc-7': 'A challenging obby parkour game that tests timing and speed.',
    'sec-reviews': 'PLAYER REVIEWS',
    'reviews-sub': 'What players say about Nusabit Studio',
    'sec-about': 'ABOUT NUSABIT STUDIO',
    'about-desc': 'We are an indie game studio passionate about creating unique and challenging gaming experiences. Based in Indonesia, we focus on Survival, RPG, and Strategy genres — with deep storytelling in every gameplay. Hope our games entertain you!',
    'about-tip': 'Try typing',
    'about-tip2': 'for an easter egg!',
    'btn-bug': '<i data-feather="alert-triangle"></i> REPORT A BUG',
    'btn-saran': '<i data-feather="zap"></i> SEND FEEDBACK',
    'footer-tagline': 'Creating digital games worth playing.',
    'footer-cs': '<i data-feather="message-circle"></i> Customer Service',
    'footer-ticket': '<i data-feather="tag"></i> Check Ticket Status',
    'footer-copy': '© 2025 Nusabit Studio. All Rights Reserved.',
    'lang-label': '🇬🇧 EN',
    'cek-tiket-title': 'CHECK REPORT STATUS',
    'cek-tiket-sub': 'Already submitted a bug report or suggestion? Track the status here.',
    'btn-cek-tiket': 'CHECK TICKET',
    'tiket-placeholder': 'Enter your ticket number (example: GS-ABC123...)',
    'tiket-hint': 'Your ticket token is sent by email after submission, or available from the CS chat bubble.'
  }
};

function rerenderFeather() {
  if (window.feather && typeof window.feather.replace === 'function') {
    window.feather.replace();
  }
}

function applyLang(lang) {
  var t = TRANSLATIONS[lang] || TRANSLATIONS.id;

  document.querySelectorAll('[data-id]').forEach(function(el) {
    var key = el.getAttribute('data-id');
    if (t[key] !== undefined) el.innerHTML = t[key];
  });

  document.querySelectorAll('[data-placeholder-id]').forEach(function (el) {
    var key = el.getAttribute('data-placeholder-id');
    if (t[key] !== undefined) el.setAttribute('placeholder', t[key]);
  });

  var langLabel = document.getElementById('lang-label');
  if (langLabel) langLabel.textContent = t['lang-label'];

  document.documentElement.lang = lang;
  document.dispatchEvent(new CustomEvent('gs:lang-changed', { detail: { lang: lang } }));
  rerenderFeather();
}

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

// ── LOGIKA FILTER DAN PENCERIAN GAME (AUTO-DETEKSI TARGET) ──
function initGamesFilter() {
  var searchInput = document.getElementById('game-search');
  var clearBtn = document.getElementById('game-search-clear');
  // Mendukung kelas .filter-tab atau .games-tab-btn
  var tabs = document.querySelectorAll('.filter-tab, .games-tab-btn');

  function filterGames() {
    var activeTab = document.querySelector('.filter-tab.active, .games-tab-btn.active');
    
    // Ambil attribute filter game secara fleksibel
    var category = 'all';
    if (activeTab) {
      category = (activeTab.getAttribute('data-genre') || activeTab.getAttribute('data-filter') || 'all').toLowerCase();
    }
    
    var q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    var cards = document.querySelectorAll('.game-card');
    var gamesFoundCount = 0;

    cards.forEach(function (card) {
      // Baca multi-attribute (data-genre atau data-category)
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

    var emptyState = document.getElementById('games-empty-state');
    if (emptyState) {
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
      filterGames();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      searchInput.focus();
      filterGames();
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      filterGames();
    });
  });
}

// ── INIT HOMEPAGE ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  var langToggle = document.getElementById('langToggle');
  if (langToggle) {
    langToggle.addEventListener('click', function () {
      LANG = LANG === 'id' ? 'en' : 'id';
      localStorage.setItem('gs_lang', LANG);
      applyLang(LANG);
    });
  }

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

  applyLang(LANG);
  initSiteAnnouncement();
  initGamesFilter(); // Jalankan filter dengan penyesuaian selektor baru
  if (typeof window.initReviewsSlider === 'function') window.initReviewsSlider();
});
