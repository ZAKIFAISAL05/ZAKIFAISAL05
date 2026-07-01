'use strict';

// ============================================================
//  reviews.js — Homepage review slider (nama + rating + ulasan)
//  Data source: /.netlify/functions/reviews
// ============================================================

(function () {
  var REVIEWS_API = '/.netlify/functions/reviews';
  var AUTO_SLIDE_MS = 6500;

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clampRating(n) {
    var v = Math.round(Number(n) || 0);
    if (!isFinite(v)) v = 5;
    if (v < 1) v = 1;
    if (v > 5) v = 5;
    return v;
  }

  function starsHtml(rating) {
    var r = clampRating(rating);
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += i <= r ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
    }
    return out;
  }

  // Avatar user:
  // - kalau admin upload JPG/PNG, backend menyimpan `avatar` sebagai Data URL
  // - kalau kosong, JANGAN tampilkan profil (sesuai request: publik tanpa profil)
  function initialsFromName(name) {
    var n = String(name || '').trim();
    if (!n) return '?';
    var parts = n.split(/\s+/).filter(Boolean);
    var a = (parts[0] || '').charAt(0);
    var b = parts.length > 1 ? (parts[parts.length - 1] || '').charAt(0) : '';
    var out = (a + b).toUpperCase();
    return out || '?';
  }

  function avatarHtml(r) {
    var avatar = r && r.avatar ? String(r.avatar) : '';
    if (/^data:image\/(png|jpeg);base64,/i.test(avatar)) {
      return '<img class="review-avatar-img" src="' + escHtml(avatar) + '" alt="" loading="lazy" decoding="async">';
    }
    return '';
  }

  function fallbackReviews() {
    return [
      { name: 'Asep', rating: 5, review: 'Websitenya keren, tampilannya modern dan gampang dipakai.' },
      { name: 'Nadia', rating: 4, review: 'Info gamenya jelas, desainnya enak dilihat. Mantap!' },
      { name: 'Rizky', rating: 5, review: 'Bagian tiket bug/saran membantu banget. Responsnya cepat.' },
    ];
  }

  function getEls() {
    return {
      section: document.getElementById('reviews'),
      track: document.getElementById('reviewTrack'),
      dots: document.getElementById('reviewDots'),
      prev: document.getElementById('reviewPrev'),
      next: document.getElementById('reviewNext'),
      slider: document.querySelector('.review-slider'),
    };
  }

  function initReviewsSlider() {
    var els = getEls();
    if (!els.section || !els.track || !els.dots || !els.prev || !els.next) return;

    var state = {
      idx: 0,
      total: 0,
      timer: null,
      paused: false,
    };

    function stopAuto() {
      if (state.timer) clearInterval(state.timer);
      state.timer = null;
    }

    function startAuto() {
      stopAuto();
      state.timer = setInterval(function () {
        if (state.paused) return;
        goTo(state.idx + 1);
      }, AUTO_SLIDE_MS);
    }

    function setActiveDot() {
      if (!els.dots) return;
      els.dots.querySelectorAll('button').forEach(function (b, i) {
        b.classList.toggle('active', i === state.idx);
        b.setAttribute('aria-current', i === state.idx ? 'true' : 'false');
      });
    }

    function goTo(i) {
      if (!state.total) return;
      var nextIdx = i % state.total;
      if (nextIdx < 0) nextIdx = state.total - 1;
      state.idx = nextIdx;
      els.track.style.transform = 'translateX(' + (-state.idx * 100) + '%)';
      setActiveDot();
    }

    function render(reviews) {
      if (!Array.isArray(reviews) || !reviews.length) {
        els.section.style.display = 'none';
        return;
      }

      state.total = reviews.length;
      state.idx = 0;

      els.track.innerHTML = reviews
        .map(function (r, idx) {
          var name = escHtml(r.name || 'Anonim');
          var rating = clampRating(r.rating);
          var review = escHtml(r.review || '');
          var avatar = avatarHtml(r);
          var avatarBlock = avatar ? '<div class="review-avatar">' + avatar + '</div>' : '';
          return (
            '<div class="review-slide">' +
            '  <article class="review-card">' +
            '    <div class="review-card-top">' +
            '      <div class="review-left">' +
            '        ' + avatarBlock +
            '        <div class="review-name">' + name + '</div>' +
            '      </div>' +
            '      <div class="review-rating" aria-label="Rating ' + rating + ' dari 5">' +
            '        <span class="review-stars">' + starsHtml(rating) + '</span>' +
            '        <span class="review-score">' + rating + '/5</span>' +
            '      </div>' +
            '    </div>' +
            '    <p class="review-text">"' + review + '"</p>' +
            '  </article>' +
            '</div>'
          );
        })
        .join('');

      els.dots.innerHTML = reviews
        .map(function (_, i) {
          return '<button type="button" class="review-dot' + (i === 0 ? ' active' : '') + '" aria-label="Ulasan ' + (i + 1) + '" aria-current="' + (i === 0 ? 'true' : 'false') + '"></button>';
        })
        .join('');

      els.dots.querySelectorAll('button').forEach(function (btn, i) {
        btn.addEventListener('click', function () {
          goTo(i);
          startAuto();
        });
      });

      // Bind controls sekali saja
      if (!els.prev.dataset.bound) {
        els.prev.dataset.bound = '1';
        els.prev.addEventListener('click', function () {
          goTo(state.idx - 1);
          startAuto();
        });
      }
      if (!els.next.dataset.bound) {
        els.next.dataset.bound = '1';
        els.next.addEventListener('click', function () {
          goTo(state.idx + 1);
          startAuto();
        });
      }

      if (els.slider && !els.slider.dataset.bound) {
        els.slider.dataset.bound = '1';
        els.slider.addEventListener('mouseenter', function () {
          state.paused = true;
        });
        els.slider.addEventListener('mouseleave', function () {
          state.paused = false;
        });
        els.slider.addEventListener('focusin', function () {
          state.paused = true;
        });
        els.slider.addEventListener('focusout', function () {
          state.paused = false;
        });
      }

      // Keyboard: panah kiri/kanan saat fokus di section
      if (!els.section.dataset.bound) {
        els.section.dataset.bound = '1';
        els.section.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowLeft') {
            goTo(state.idx - 1);
            startAuto();
            e.preventDefault();
          } else if (e.key === 'ArrowRight') {
            goTo(state.idx + 1);
            startAuto();
            e.preventDefault();
          }
        });
      }

      // Set posisi awal + auto
      goTo(0);
      startAuto();
    }

    function loadAndRender() {
      els.section.style.display = '';
      return fetch(REVIEWS_API, { method: 'GET', cache: 'no-store' })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data && data.ok && Array.isArray(data.reviews) && data.reviews.length) {
            render(data.reviews);
          } else {
            render(fallbackReviews());
          }
        })
        .catch(function () {
          render(fallbackReviews());
        });
    }

    function initPublicReviewForm() {
      var form = document.getElementById('publicReviewForm');
      if (!form || form.dataset.bound) return;
      form.dataset.bound = '1';

      var nameEl = document.getElementById('pr-name');
      var ratingEl = document.getElementById('pr-rating');
      var ratingTextEl = document.getElementById('pr-rating-text');
      var starsValueWrap = document.getElementById('pr-stars-value');
      var hintEl = document.getElementById('pr-stars-hint');
      var starsWrap = document.getElementById('pr-stars');
      var textEl = document.getElementById('pr-text');
      var msgEl = document.getElementById('pr-msg');
      var btnEl = document.getElementById('pr-submit');
      var cancelEl = document.getElementById('pr-cancel');
      var details1 = document.getElementById('pr-details');
      var details2 = document.getElementById('pr-details-2');

      // Popup UI (animasi) — dipakai saat klik kirim
      var popupEl = document.getElementById('uiPopup');
      var popupTitleEl = document.getElementById('uiPopupTitle');
      var popupTextEl = document.getElementById('uiPopupText');
      var popupOkBtn = document.getElementById('uiPopupOk');
      var popupCancelBtn = document.getElementById('uiPopupCancel');
      var popupConfirmBtn = document.getElementById('uiPopupConfirm');
      var popupIconEl = document.getElementById('uiPopupIcon');
      var confirmCb = null;

      function hidePopup() {
        if (!popupEl) return;
        popupEl.classList.remove('open');
        popupEl.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        confirmCb = null;
      }

      function popupMode(mode) {
        // mode: 'ok' | 'confirm'
        var isConfirm = mode === 'confirm';
        if (popupOkBtn) popupOkBtn.hidden = isConfirm;
        if (popupCancelBtn) popupCancelBtn.hidden = !isConfirm;
        if (popupConfirmBtn) popupConfirmBtn.hidden = !isConfirm;
      }

      function showPopup(type, title, text) {
        if (!popupEl) return;
        // Jika sedang mode konfirmasi, jangan ke-reset jadi OK
        popupMode(confirmCb ? 'confirm' : 'ok');
        popupEl.classList.add('open');
        popupEl.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');

        if (popupTitleEl) popupTitleEl.textContent = String(title || 'Info');
        if (popupTextEl) popupTextEl.textContent = String(text || '');

        if (popupIconEl) {
          popupIconEl.className = 'ui-popup-icon ' + (type || '');
          popupIconEl.innerHTML =
            type === 'ok'
              ? '<i class="fa-solid fa-circle-check"></i>'
              : type === 'err'
                ? '<i class="fa-solid fa-triangle-exclamation"></i>'
                : type === 'warn'
                  ? '<i class="fa-solid fa-circle-exclamation"></i>'
                  : '<i class="fa-solid fa-circle-info"></i>';
        }
      }

      function showPopupConfirm(title, text, onConfirm) {
        if (!popupEl) return;
        confirmCb = typeof onConfirm === 'function' ? onConfirm : null;
        showPopup('warn', title, text);
      }

      if (popupEl && !popupEl.dataset.bound) {
        popupEl.dataset.bound = '1';
        if (popupOkBtn) popupOkBtn.addEventListener('click', hidePopup);
        if (popupCancelBtn) popupCancelBtn.addEventListener('click', hidePopup);
        if (popupConfirmBtn) popupConfirmBtn.addEventListener('click', function () {
          if (confirmCb) confirmCb();
          hidePopup();
        });
        popupEl.addEventListener('click', function (e) {
          if (e.target === popupEl) hidePopup();
        });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') hidePopup();
        });
      }

      function setMsg(text, type) {
        if (!msgEl) return;
        msgEl.textContent = String(text || '');
        msgEl.className = 'review-public-msg ' + (type || '');
      }

      function clampRatingLocal(n) {
        var v = Math.round(Number(n) || 0);
        if (!isFinite(v)) v = 0;
        if (v < 1) v = 1;
        if (v > 5) v = 5;
        return v;
      }

      function setDetailsVisible(on) {
        var show = !!on;
        [details1, details2].forEach(function (el) {
          if (!el) return;
          el.classList.toggle('show', show);
          el.setAttribute('aria-hidden', show ? 'false' : 'true');
        });

        // Hindari error validasi required saat elemen masih disembunyiin
        if (nameEl) nameEl.required = show;
        if (textEl) textEl.required = show;
        if (btnEl) btnEl.disabled = !show;
      }

      function setRatingUI(n) {
        var r = Number(n) ? clampRatingLocal(n) : 0;
        if (ratingEl) ratingEl.value = r ? String(r) : '';
        if (ratingTextEl) ratingTextEl.textContent = r ? String(r) : '—';
        if (hintEl) hintEl.style.display = r ? 'none' : '';
        if (starsValueWrap) starsValueWrap.style.opacity = r ? '1' : '0.85';
        if (!starsWrap) return;
        var btns = starsWrap.querySelectorAll('button.pr-star');
        btns.forEach(function (b) {
          var v = parseInt(b.getAttribute('data-v') || '0', 10) || 0;
          var active = r ? v <= r : false;
          b.classList.toggle('active', active);
          b.setAttribute('aria-checked', r && v === r ? 'true' : 'false');
          var icon = b.querySelector('i');
          if (icon) icon.className = active ? 'fa-solid fa-star' : 'fa-regular fa-star';
        });
      }

      function resetForm() {
        if (nameEl) nameEl.value = '';
        if (textEl) textEl.value = '';
        setRatingUI(0);
        setDetailsVisible(false);
        setMsg('', '');
      }

      if (starsWrap && !starsWrap.dataset.bound) {
        starsWrap.dataset.bound = '1';
        starsWrap.querySelectorAll('button.pr-star').forEach(function (b) {
          b.addEventListener('click', function () {
            var v = parseInt(b.getAttribute('data-v') || '5', 10) || 5;
            setRatingUI(v);
            setDetailsVisible(true);
            if (nameEl) nameEl.focus();
          });
        });
      }

      if (cancelEl && !cancelEl.dataset.bound) {
        cancelEl.dataset.bound = '1';
        cancelEl.addEventListener('click', function () {
          resetForm();
        });
      }

      // Set default UI
      setDetailsVisible(false);
      setRatingUI(0);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = (nameEl && nameEl.value ? String(nameEl.value) : '').trim();
        var rating = parseInt(ratingEl && ratingEl.value ? ratingEl.value : '0', 10) || 0;
        var review = (textEl && textEl.value ? String(textEl.value) : '').trim();

        if (!rating) {
          showPopup('warn', 'Rating dulu', 'Pilih bintang 1 sampai 5 dulu, baru lanjut isi nama & ulasan.');
          setMsg('Pilih rating bintang dulu.', 'err');
          return;
        }
        if (!name || !review) {
          showPopup('warn', 'Lengkapi dulu', 'Nama dan ulasan wajib diisi sebelum dikirim.');
          setMsg('Nama dan ulasan wajib diisi.', 'err');
          return;
        }

        // Konfirmasi agar info "tidak bisa dihapus" tampil rapi di popup (bukan jadi teks tetap)
        var confirmText =
          'Setelah dikirim, ulasan tidak bisa dihapus sendiri. Kalau mau hapus/edit, hubungi admin atau CS.\n\n' +
          'Klik "Kirim" untuk lanjut.';

        showPopupConfirm('Yakin kirim ulasan?', confirmText, function () {
          if (btnEl) btnEl.disabled = true;
          setMsg('Mengirim ulasan...', 'info');
          showPopup('info', 'Mengirim...', 'Ulasan kamu sedang dikirim. Tunggu sebentar ya.');

          fetch(REVIEWS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'public_add', name: name, rating: rating, review: review }),
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (!data || !data.ok) throw new Error((data && data.error) || 'Gagal kirim ulasan');
              setMsg('Terima kasih! Ulasan kamu sudah terkirim.', 'ok');
              showPopup('ok', 'Terkirim', 'Terima kasih! Ulasan kamu sudah terkirim.');
              resetForm();
              // Refresh slider biar langsung kelihatan
              return loadAndRender();
            })
            .catch(function (err) {
              showPopup('err', 'Gagal', err && err.message ? err.message : 'Terjadi kesalahan saat mengirim ulasan.');
              setMsg('Gagal: ' + (err && err.message ? err.message : 'Terjadi kesalahan'), 'err');
            })
            .finally(function () {
              if (btnEl) btnEl.disabled = false;
            });
        });

        // fetch akan jalan setelah user klik "Kirim" di popup
      });
    }

    // Load data + bind form
    initPublicReviewForm();
    loadAndRender();
  }

  // Expose agar bisa dipanggil dari index-page.js
  window.initReviewsSlider = initReviewsSlider;
})();
