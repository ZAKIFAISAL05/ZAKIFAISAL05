// ============================================================
//  global-ui.js — Nusabit Studio
//  Fitur:
//  1) Custom Loading Screen global (Light Mode) + fade-out
//  2) Sistem deteksi offline/online global (banner)
//
//  Cara pakai (di setiap HTML, sekali saja):
//  <link rel="stylesheet" href="/assets/css/global-ui.css">
//  <script src="/assets/js/global-ui.js"></script>
// ============================================================

'use strict';

(function () {
  const LOADER_ID = 'ns-global-loading';
  const OFFLINE_ID = 'ns-offline-banner';
  const PAGE_EXIT_CLASS = 'ns-page-exit';

  function el(tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    return node;
  }

  // =========================
  // LOADING SCREEN
  // =========================
  function ensureLoader() {
    if (document.getElementById(LOADER_ID)) return;

    const wrapper = el('div', {
      id: LOADER_ID,
      role: 'status',
      'aria-live': 'polite',
      'aria-label': 'Memuat halaman',
    });

    wrapper.innerHTML = [
      '<div class="ns-load-card">',
      '  <div class="ns-load-top">',
      '    <div class="ns-logo-orb" aria-hidden="true">',
      '      <div class="ns-logo-mark">N</div>',
      '    </div>',
      '    <div class="ns-spinner" aria-hidden="true"></div>',
      '  </div>',
      '  <h2 class="ns-load-title">Memuat Nusabit Studio…</h2>',
      '  <p class="ns-load-sub">Menyiapkan konten dan aset, mohon tunggu sebentar.</p>',
      '  <div class="ns-load-progress" aria-hidden="true"><i></i></div>',
      '</div>',
    ].join('\n');

    // documentElement sudah ada bahkan sebelum <body> selesai
    document.documentElement.appendChild(wrapper);
  }

  function hideLoader() {
    const wrapper = document.getElementById(LOADER_ID);
    if (!wrapper) return;

    // Hindari double-call
    if (wrapper.dataset.hiding === '1') return;
    wrapper.dataset.hiding = '1';

    wrapper.classList.add('is-hidden');
    // tunggu transisi, lalu buang node supaya tidak ganggu klik/tab
    setTimeout(function () {
      try { wrapper.remove(); } catch (e) {}
    }, 520);
  }

  function navigateWithFade(url, delayMs) {
    if (!url) return;

    var wait = typeof delayMs === 'number' ? delayMs : 280;

    try {
      document.documentElement.classList.add(PAGE_EXIT_CLASS);
      if (document.body) document.body.classList.add(PAGE_EXIT_CLASS);
    } catch (e) {}

    window.setTimeout(function () {
      window.location.href = url;
    }, wait);
  }

  // Loader harus muncul sedini mungkin
  ensureLoader();
  // Hilang saat semua aset selesai di-load (sesuai permintaan)
  window.addEventListener('load', function () {
    // Delay kecil biar transisi kelihatan dan tidak terlalu "kedip"
    setTimeout(hideLoader, 90);
  });

  // =========================
  // OFFLINE / ONLINE DETECTOR
  // =========================
  function ensureOfflineBanner() {
    if (document.getElementById(OFFLINE_ID)) return;

    const wrap = el('div', {
      id: OFFLINE_ID,
      role: 'status',
      'aria-live': 'polite',
      'aria-label': 'Status koneksi internet',
    });

    wrap.innerHTML = [
      '<div class="ns-offline-pill">',
      '  <span class="ns-offline-dot" aria-hidden="true"></span>',
      '  <div class="ns-offline-text">',
      '    <strong>Koneksi internet hilang</strong>',
      '    <span>Kami akan mencoba lagi otomatis saat jaringan kembali.</span>',
      '  </div>',
      '  <button class="ns-offline-btn" type="button" id="ns-offline-retry">Coba lagi</button>',
      '</div>',
    ].join('\n');

    document.documentElement.appendChild(wrap);

    const retryBtn = wrap.querySelector('#ns-offline-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        // kalau online, refresh halaman; kalau offline, biarkan banner tetap
        if (navigator.onLine) {
          try { location.reload(); } catch (e) {}
        }
      });
    }
  }

  function setOfflineVisible(visible) {
    ensureOfflineBanner();
    const wrap = document.getElementById(OFFLINE_ID);
    if (!wrap) return;

    if (visible) wrap.classList.add('is-show');
    else wrap.classList.remove('is-show');
  }

  // status awal
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setOfflineVisible(true);
  }

  window.addEventListener('offline', function () {
    setOfflineVisible(true);
  });

  window.addEventListener('online', function () {
    setOfflineVisible(false);
  });

  // Helper global supaya file lain tinggal panggil sekali
  window.nsNavigateWithFade = navigateWithFade;
})();
