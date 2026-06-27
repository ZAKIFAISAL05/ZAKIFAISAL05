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
  // - kalau kosong, pakai inisial sebagai fallback (bukan NFT/random)
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
    var ini = initialsFromName(r && r.name);
    return '<div class="review-avatar-fallback" aria-hidden="true">' + escHtml(ini) + '</div>';
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
          return (
            '<div class="review-slide">' +
            '  <article class="review-card">' +
            '    <div class="review-card-top">' +
            '      <div class="review-left">' +
            '        <div class="review-avatar">' + avatarHtml(r) + '</div>' +
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

    // Load data
    els.section.style.display = '';
    fetch(REVIEWS_API, { method: 'GET', cache: 'no-store' })
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

  // Expose agar bisa dipanggil dari index-page.js
  window.initReviewsSlider = initReviewsSlider;
})();
