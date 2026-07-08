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
  const VERSION_URL = '/version.json';
  const VERSION_KEY = 'ns_site_version';
  const VERSION_LOCK_KEY = 'ns_site_version_lock';

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
      '  <p class="ns-load-sub" id="ns-load-sub">Menyiapkan konten dan aset, mohon tunggu sebentar.</p>',
      '  <div class="ns-load-meta" aria-hidden="true">',
      '    <span class="ns-load-percent" id="ns-load-percent">0%</span>',
      '    <span class="ns-load-sep">•</span>',
      '    <span class="ns-load-tip" id="ns-load-tip">Mengambil versi terbaru…</span>',
      '  </div>',
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

  function setLoadTip(text, percent) {
    try {
      const tip = document.getElementById('ns-load-tip');
      const pct = document.getElementById('ns-load-percent');
      if (tip && typeof text === 'string') tip.textContent = text;
      if (pct && typeof percent === 'number' && Number.isFinite(percent)) {
        const p = Math.max(0, Math.min(100, Math.round(percent)));
        pct.textContent = p + '%';
      }
    } catch (e) {}
  }

  function startFakeProgress() {
    // progress simulasi supaya user merasa "ada gerakan"
    var start = Date.now();
    var max = 92;
    var tips = [
      'Mengambil versi terbaru…',
      'Memuat tampilan…',
      'Menyiapkan data…',
      'Hampir siap…',
    ];
    var tipIndex = 0;
    var tipTick = 0;

    function tick() {
      // kalo loader sudah hilang, stop
      var wrap = document.getElementById(LOADER_ID);
      if (!wrap) return;

      var t = Date.now() - start;
      // kurva logaritmik: cepat di awal, melambat mendekati max
      var p = Math.min(max, (Math.log(1 + t / 140) / Math.log(1 + 2400 / 140)) * max);
      setLoadTip(tips[tipIndex], p);

      tipTick++;
      if (tipTick % 22 === 0) {
        tipIndex = (tipIndex + 1) % tips.length;
      }

      window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);
  }

  function fetchJsonNoStore(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var t = window.setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('timeout'));
      }, typeof timeoutMs === 'number' ? timeoutMs : 2000);

      fetch(url, { cache: 'no-store' })
        .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('bad_status')); })
        .then(function (json) {
          if (done) return;
          done = true;
          window.clearTimeout(t);
          resolve(json);
        })
        .catch(function (err) {
          if (done) return;
          done = true;
          window.clearTimeout(t);
          reject(err);
        });
    });
  }

  function clearRuntimeCachesBestEffort() {
    // optional: hapus cache API (kalau ada)
    try {
      if (typeof caches !== 'undefined' && caches && typeof caches.keys === 'function') {
        caches.keys().then(function (keys) {
          (keys || []).forEach(function (k) {
            try { caches.delete(k); } catch (e) {}
          });
        });
      }
    } catch (e) {}

    // optional: unregister service worker (kalau ada di masa depan)
    try {
      if (navigator && navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          (regs || []).forEach(function (r) {
            try { r.unregister(); } catch (e) {}
          });
        });
      }
    } catch (e) {}
  }

  function applyNewVersionAndReload(newVersion) {
    // mencegah reload loop: 1 versi hanya reload 1x per tab
    try {
      var lock = sessionStorage.getItem(VERSION_LOCK_KEY) || '';
      if (lock === String(newVersion || '')) return;
      sessionStorage.setItem(VERSION_LOCK_KEY, String(newVersion || ''));
    } catch (e) {}

    try { localStorage.setItem(VERSION_KEY, String(newVersion || '')); } catch (e) {}
    clearRuntimeCachesBestEffort();

    // force reload dengan query param khusus
    try {
      var u = new URL(window.location.href);
      u.searchParams.set('u', String(newVersion || ''));
      window.location.replace(u.toString());
    } catch (e) {
      try { window.location.reload(); } catch (e2) {}
    }
  }

  function checkVersionAndAutoUpdate() {
    // Jangan jalan di file:// atau environment tanpa fetch
    if (typeof fetch !== 'function') return;

    fetchJsonNoStore(VERSION_URL, 1800)
      .then(function (data) {
        var remote = data && data.version ? String(data.version) : '';
        if (!remote) return;

        var local = '';
        try { local = localStorage.getItem(VERSION_KEY) || ''; } catch (e) {}

        // pertama kali: set aja (tidak perlu reload)
        if (!local) {
          try { localStorage.setItem(VERSION_KEY, remote); } catch (e) {}
          setLoadTip('Memuat aset…', 18);
          return;
        }

        // kalau versi beda: reload otomatis ke versi baru
        if (local !== remote) {
          setLoadTip('Versi baru terdeteksi, memperbarui…', 35);
          applyNewVersionAndReload(remote);
        }
      })
      .catch(function () {
        // silent: kalau gagal ambil versi, lanjut load normal
      });
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
  startFakeProgress();
  checkVersionAndAutoUpdate();
  // Hilang saat semua aset selesai di-load (sesuai permintaan)
  window.addEventListener('load', function () {
    // Delay kecil biar transisi kelihatan dan tidak terlalu "kedip"
    setLoadTip('Selesai', 100);
    setTimeout(hideLoader, 180);
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
