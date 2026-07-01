// animations.js — Nusabit Studio (global)
// - Reveal on scroll untuk elemen umum
(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function uniq(arr) {
    var seen = new Set();
    return arr.filter(function (el) {
      if (!el || seen.has(el)) return false;
      seen.add(el);
      return true;
    });
  }

  function markReveal(el) {
    if (!el || el.classList.contains('gs-reveal')) return;
    el.classList.add('gs-reveal');
  }

  function boot() {
    var candidates = [];
    [
      'section',
      'nav',
      'footer',
      '.game-card',
      '.review-slide',
      '.review-card',
      '.review-public-wrap',
      '.faq-list .item',
      '.ticket-card',
      '.chat-wrap',
      '.login-shell',
      '.panel-box',
      '.state-box',
    ].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { candidates.push(el); });
    });

    candidates = uniq(candidates);
    candidates.forEach(markReveal);

    if (!('IntersectionObserver' in window)) {
      candidates.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    candidates.forEach(function (el) { io.observe(el); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

