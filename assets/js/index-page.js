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

  if (typeof window.rerenderFeather === 'function') {
    window.rerenderFeather();
  } else if (typeof feather !== 'undefined') {
    feather.replace();
  }
}

function closeReportModal(type) {
  var bg = document.getElementById('modal-' + type + '-bg');
  if (bg) {
    bg.classList.remove('open');
    document.body.classList.remove('modal-open');
  }
}

// ── SUBMIT REPORT (sinkron dengan CS) ────────────────────────
var REPORT_ENDPOINT = '/.netlify/functions/report';
var _isSubmittingReportIndex = false;

function generateTicketId() {
  return 'GS-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function _safeSetHtml(el, html) { if (el) el.innerHTML = html; }
function _safeSetText(el, txt) { if (el) el.textContent = txt; }

function _makeTicketLabel(ticketNum, ticketId) {
  var num = ticketNum ? ('#' + ticketNum) : '#—';
  var tid = ticketId ? String(ticketId) : '';
  return tid ? (num + ' · ' + tid) : num;
}

function submitReport(type) {
  if (_isSubmittingReportIndex) return;
  type = type === 'bug' ? 'bug' : 'saran';

  var gameEl = document.getElementById(type + '-game');
  var descEl = document.getElementById(type + '-desc');
  var emailEl = document.getElementById(type + '-email');
  var contactEl = document.getElementById(type + '-contact'); // hanya ada di bug modal
  var btn = document.getElementById(type + '-submit');

  var game = gameEl ? String(gameEl.value || '').trim() : '';
  var desc = descEl ? String(descEl.value || '').trim() : '';
  var email = emailEl ? String(emailEl.value || '').trim() : '';
  var contact = contactEl ? String(contactEl.value || '').trim() : '';

  // Validasi minimal (sesuai backend report.js)
  if (!desc || desc.length < 10) {
    if (descEl) {
      descEl.focus();
      descEl.style.borderColor = '#ff3c3c';
      setTimeout(function () { try { descEl.style.borderColor = ''; } catch (e) {} }, 1800);
    }
    alert('Isi deskripsi minimal 10 karakter ya.');
    return;
  }
  if (type === 'bug' && !game) {
    if (gameEl) {
      gameEl.focus();
      gameEl.style.borderColor = '#ff3c3c';
      setTimeout(function () { try { gameEl.style.borderColor = ''; } catch (e) {} }, 1800);
    }
    alert('Pilih game yang bermasalah dulu ya.');
    return;
  }

  // Konfirmasi singkat (biar sync dengan CS yang minta confirm sebelum kirim)
  var confirmText =
    'Konfirmasi kirim ' + (type === 'bug' ? 'laporan bug' : 'saran') + '?\n\n' +
    'Game: ' + (game || '—') + '\n' +
    'Email: ' + (email || '—') + '\n' +
    'Kontak: ' + (contact || '—') + '\n\n' +
    'Detail:\n' + desc;
  if (!confirm(confirmText)) return;

  var ticketId = generateTicketId();
  var payload = {
    type: type,
    game: game,
    desc: desc,
    email: email,
    contact: contact,
    ticketId: ticketId,
  };

  _isSubmittingReportIndex = true;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Mengirim...';
  }

  fetch(REPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.ok) throw new Error((data && data.error) || 'Gagal mengirim laporan');

      // Tampilkan success UI
      var formEl = document.getElementById('modal-' + type + '-form');
      var succEl = document.getElementById('modal-' + type + '-success');
      if (formEl) formEl.style.display = 'none';
      if (succEl) succEl.style.display = '';

      // Isi nomor tiket + tampilkan box (jika ada)
      var ticketBox = document.getElementById(type + '-ticket-box');
      var ticketNumEl = document.getElementById(type + '-ticket-num');
      if (ticketBox) ticketBox.style.display = 'flex';
      _safeSetText(ticketNumEl, _makeTicketLabel(data.ticketNum, data.ticketId || ticketId));

      // Tambah link pantau status (kalau ada)
      if (succEl && data.ticketUrl) {
        // hapus link lama kalau sudah pernah append
        var old = succEl.querySelector('.rmodal-track-link');
        if (old) old.remove();

        var a = document.createElement('a');
        a.className = 'rmodal-track-link';
        a.href = data.ticketUrl.startsWith('http')
          ? data.ticketUrl
          : (window.location.origin + (data.ticketUrl.startsWith('/') ? '' : '/') + data.ticketUrl);
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.cssText = 'display:inline-flex;gap:8px;align-items:center;justify-content:center;margin-top:14px;padding:10px 14px;border-radius:12px;border:1px solid rgba(124,77,255,0.25);background:rgba(124,77,255,0.06);color:#7c4dff;font-weight:800;text-decoration:none;font-size:0.85rem;';
        a.innerHTML = '📋 Pantau Status Tiket →';
        succEl.appendChild(a);
      }

      // Reset input (biar tidak ke-submit ulang)
      if (descEl) descEl.value = '';
    })
    .catch(function (e) {
      alert((e && e.message) ? e.message : 'Gagal mengirim. Coba lagi nanti ya.');
    })
    .finally(function () {
      _isSubmittingReportIndex = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = type === 'bug'
          ? '<i data-feather="alert-triangle"></i> Kirim Laporan Bug'
          : '<i data-feather="zap"></i> Kirim Saran';
      }
      if (typeof window.rerenderFeather === 'function') window.rerenderFeather();
      else if (typeof feather !== 'undefined') feather.replace();
    });
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

  // 🛠️ FIX REDIRECT SINKRON: Mengambil ID murni game dari attribute kartu HTML
  gamesGrid.addEventListener('click', function (e) {
    var card = e.target.closest('.game-card');
    if (!card) return;

    // Mendukung penulisan attribute data-game-id atau data-id pada markup card
    var gameId = card.getAttribute('data-game-id') || card.getAttribute('data-id');

    if (gameId) {
      gameId = gameId.trim();
      e.stopPropagation();

      // Dialihkan langsung menggunakan format query string standard global /game/?id=...
      var targetUrl = window.location.origin + '/game/?id=' + encodeURIComponent(gameId);
      
      if (typeof window.nsNavigateWithFade === 'function') {
        window.nsNavigateWithFade(targetUrl);
        return;
      }
      window.location.href = targetUrl;
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
