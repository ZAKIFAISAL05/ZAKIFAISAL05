'use strict';

// ============================================================
//  index-page.js
//  Logic khusus homepage / landing page Nusabit Studio
// ============================================================

// ── PENGUMUMAN WEBSITE (dari Admin Panel) ────────────────────
function initSiteAnnouncement() {
  var box = document.getElementById('site-announcement');
  var textEl = document.getElementById('site-announcement-text');
  var closeBtn = document.getElementById('site-announcement-close');
  if (!box || !textEl) return;

  function renderFromSettings(settings) {
    var ann = settings && settings.announcement;
    if (!ann || !ann.enabled || !ann.message) {
      box.style.display = 'none';
      return;
    }

    var exp = ann.expiresAt ? Date.parse(ann.expiresAt) : NaN;
    if (!Number.isNaN(exp)) {
      var remainingMs = exp - Date.now();
      if (remainingMs <= 0) {
        box.style.display = 'none';
        return;
      }

      setTimeout(function () {
        box.style.display = 'none';
      }, remainingMs);
    }

    textEl.textContent = ann.message;
    box.style.display = '';
  }

  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = '1';
    closeBtn.addEventListener('click', function () {
      box.style.display = 'none';
    });
  }

  if (window.__SITE_SETTINGS__) {
    renderFromSettings(window.__SITE_SETTINGS__);
    return;
  }

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
  var inputEl = document.getElementById('tiket-input');
  if (!inputEl) return;

  var raw = (inputEl.value || '').trim();
  if (!raw) {
    shakeInput();
    return;
  }

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
    if (/^GS-[A-Z0-9]+/i.test(raw)) id = raw.toUpperCase();
    else token = raw;
  }

  var targetUrl = id
    ? '/tiket/?id=' + encodeURIComponent(id)
    : '/tiket/?token=' + encodeURIComponent(token);

  if (typeof window.nsNavigateWithFade === 'function') {
    window.nsNavigateWithFade(targetUrl);
    return;
  }

  window.location.href = targetUrl;
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

// ── LOGIKA FILTER, PENCARIAN, DAN REDIRECT URL GAME ──────────
function initGamesFilter() {
  var searchInput = document.getElementById('game-search');
  var clearBtn = document.getElementById('game-search-clear');
  var tabs = document.querySelectorAll('.filter-tab, .games-tab-btn');
  var emptyState = document.getElementById('games-empty-state');
  var gamesGrid = document.getElementById('games-grid');

  if (!gamesGrid) return;

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
    var cards = gamesGrid.querySelectorAll('.game-card');
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

    if (emptyState) {
      if (!isInitialLoad && gamesFoundCount === 0) {
        emptyState.removeAttribute('hidden');
        emptyState.style.display = 'block';
      } else {
        emptyState.setAttribute('hidden', '');
        emptyState.style.display = 'none';
      }
    }
  }

  // 🛠️ PERBAIKAN LOGIKA KLIK: DIPAKSA RE-DIRECT LANGSUNG KE URL UTAMA
  gamesGrid.addEventListener('click', function (e) {
    var card = e.target.closest('.game-card');
    if (!card) return;

    var gameId = card.getAttribute('data-id');

    if (gameId) {
      gameId = gameId.trim();
      // Mengarahkan window aktif langsung ke domain + slug folder target
<<<<<<< HEAD
      var targetUrl = window.location.origin + '/' + gameId;
      if (typeof window.nsNavigateWithFade === 'function') {
        window.nsNavigateWithFade(targetUrl);
        return;
      }
      window.location.href = targetUrl;
=======
      window.location.href = window.location.origin + '/' + gameId;
>>>>>>> 5cedeb8cf4ed30e18de1126e0537e47ffbd59987
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      if (clearBtn) {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
      }
      filterGames(false);
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

  filterGames(true);
}

// ── INIT HOMEPAGE ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  var ticketInput = document.getElementById('tiket-input');
  if (ticketInput) {
    ticketInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (typeof window.cekTiket === 'function') window.cekTiket();
      }
    });
  }

  ['modal-bug-bg', 'modal-saran-bg'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function(e) {
      if (e.target === el) {
        var modalType = el.id.replace('modal-', '').replace('-bg', '');
        if (typeof window.closeReportModal === 'function') window.closeReportModal(modalType);
      }
    });
  });

  initSiteAnnouncement();
  initGamesFilter(); 
  if (typeof window.initReviewsSlider === 'function') window.initReviewsSlider();
});
    
