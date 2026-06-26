/**
 * errors/404.js — Nusabit Studio
 * Countdown auto-redirect untuk halaman 404
 */

'use strict';

(function () {
  const REDIRECT_TO  = '/';
  const TOTAL_SECS   = 10;

  let remaining = TOTAL_SECS;
  const fillEl  = document.getElementById('countdown-fill');
  const secEl   = document.getElementById('sec');
  const card    = document.querySelector('.error-card');
  let timer     = null;

  if (!fillEl || !secEl) return;

  // Update UI countdown supaya angka dan progress bar tetap sinkron
  function renderCountdown() {
    secEl.textContent = String(Math.max(remaining, 0));
    fillEl.style.width = ((Math.max(remaining, 0) / TOTAL_SECS) * 100) + '%';
  }

  // Jalankan countdown redirect dengan kontrol start / stop yang aman
  function startCountdown() {
    if (timer || remaining <= 0) return;

    timer = setInterval(() => {
      remaining--;
      renderCountdown();

      if (remaining <= 0) {
        stopCountdown();
        window.location.href = REDIRECT_TO;
      }
    }, 1000);
  }

  function stopCountdown() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  renderCountdown();
  startCountdown();

  // Pause countdown saat user fokus ke card, lalu lanjut lagi saat mouse keluar
  if (card) {
    card.addEventListener('mouseenter', stopCountdown);
    card.addEventListener('mouseleave', startCountdown);
  }
})();
