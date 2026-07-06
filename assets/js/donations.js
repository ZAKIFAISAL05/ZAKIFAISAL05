/* ============================================================
   donations.js — Saweria Integration (UI)
   - Progress target donasi (di section CEK STATUS LAPORAN)
   - Slider donatur terbaru (di section PROYEK GAME KAMI)
   Catatan:
   - Data diambil dari Netlify Function: /.netlify/functions/saweria
   - Polling berkala agar terasa "real-time"
   ============================================================ */

(function () {
  'use strict';

  const API = '/.netlify/functions/saweria';
  // "Real-time" di web statis paling aman pakai polling.
  // Kamu bisa kecilkan nilainya, tapi makin kecil = request makin sering.
  const POLL_MS = 10_000;
  const POLL_LABEL = Math.max(5, Math.round(POLL_MS / 1000));
  const MAX_DONORS = 12;

  // ── Element refs (progress) ──
  const elBarFill = document.getElementById('donationBarFill');
  const elCollected = document.getElementById('donationCollected');
  const elTarget = document.getElementById('donationTarget');
  const elPercent = document.getElementById('donationPercent');
  const elSub = document.getElementById('donationSub');
  const elCtaBottom = document.getElementById('donationCta');
  const elCountdown = document.getElementById('donationCountdown');
  const elDonationCard = document.getElementById('donationCard');
  const elGoalName = document.getElementById('donationGoalName');
  const elGoalText = document.getElementById('donationGoalText');
  const elSupportText = document.getElementById('donationSupportText');

  // ── Element refs (donor slider) ──
  const elStrip = document.getElementById('donorStrip');
  const elTrack = document.getElementById('donorTrack');
  const elEmpty = document.getElementById('donorEmpty');
  const elPrev = document.getElementById('donorPrev');
  const elNext = document.getElementById('donorNext');
  const elCtaTop = document.getElementById('donorCtaTop');

  // Kalau halaman tertentu tidak punya komponen ini, jangan error.
  const hasAnyUI = !!(elBarFill || elTrack);
  if (!hasAnyUI) return;

  // ────────────────────────────────────────────────
  // Static texts (Tujuan / Support) dari dataset HTML
  // ────────────────────────────────────────────────
  function initGoalText() {
    const goalName = safeText(elDonationCard?.dataset?.goalName);
    const goalText = safeText(elDonationCard?.dataset?.goalText);
    if (elGoalName) elGoalName.textContent = goalName || '—';
    if (elGoalText) elGoalText.textContent = goalText || '—';
    if (elSupportText && !safeText(elSupportText.textContent)) {
      elSupportText.textContent = 'Mau support Nusabit Studio? Klik tombol “Dukung via Saweria”.';
    }
  }

  // ────────────────────────────────────────────────
  // Countdown update (biar angka hitung mundur bergerak)
  // ────────────────────────────────────────────────
  let _secondsLeft = POLL_LABEL;
  let _lastOk = false;
  let _subMode = ''; // 'ok' | 'err'
  const _subOkTemplate = elSub ? elSub.innerHTML : '';

  function renderCountdownSub() {
    if (!elSub) return;

    if (_lastOk) {
      if (_subMode !== 'ok') {
        _subMode = 'ok';
        // Kembalikan template awal (yang sudah ada <span id="donationCountdown">..</span>)
        if (_subOkTemplate) elSub.innerHTML = _subOkTemplate;
      }
      const c = document.getElementById('donationCountdown');
      if (c) c.textContent = String(_secondsLeft);
    } else if (_subMode !== 'err') {
      _subMode = 'err';
      elSub.textContent = 'Donasi belum tersambung. Admin bisa set env Saweria di Netlify.';
    }
  }

  function formatRupiah(n) {
    const num = Number(n || 0);
    try {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(num);
    } catch {
      return 'Rp' + (num || 0).toLocaleString('id-ID');
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function safeText(s) {
    return String(s || '').trim();
  }

  function setDonationLink(url) {
    const link = safeText(url);
    if (!link || link === '#') return;
    if (elCtaBottom) elCtaBottom.href = link;
    if (elCtaTop) elCtaTop.href = link;
  }

  // ────────────────────────────────────────────────
  // Render: Progress Target Donasi
  // ────────────────────────────────────────────────
  function renderProgress(data) {
    if (!elBarFill) return;

    const collected = Number(data?.collectedAmount || 0);
    const target = Number(data?.targetAmount || 0);
    const percent = target > 0 ? Math.round((collected / target) * 100) : 0;
    const pctClamped = clamp(percent, 0, 100);

    if (elCollected) elCollected.textContent = formatRupiah(collected);
    if (elTarget) elTarget.textContent = formatRupiah(target);
    if (elPercent) elPercent.textContent = `${pctClamped}%`;
    elBarFill.style.width = `${pctClamped}%`;
  }

  // ────────────────────────────────────────────────
  // Render: Donor Slider
  // ────────────────────────────────────────────────
  function makeDonorCard(d) {
    const name = safeText(d?.name) || 'Anonim';
    const amount = Number(d?.amount || 0);
    const msg = safeText(d?.message) || 'Tanpa pesan';

    const card = document.createElement('article');
    card.className = 'donor-card';
    card.innerHTML = `
      <div class="donor-card-top">
        <div class="donor-name">${escapeHtml(name)}</div>
        <div class="donor-amount">${escapeHtml(formatRupiah(amount))}</div>
      </div>
      <div class="donor-msg">${escapeHtml(msg)}</div>
    `;
    return card;
  }

  // escape sederhana untuk isi card (biar aman)
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  function renderDonors(data) {
    if (!elTrack || !elStrip) return;
    const donors = Array.isArray(data?.donors) ? data.donors.slice(0, MAX_DONORS) : [];

    // Clear track
    elTrack.innerHTML = '';

    if (!donors.length) {
      if (elEmpty) elEmpty.style.display = 'block';
      elStrip.classList.remove('has-donors');
      return;
    }

    if (elEmpty) elEmpty.style.display = 'none';
    elStrip.classList.add('has-donors');

    for (const d of donors) elTrack.appendChild(makeDonorCard(d));
  }

  function initSliderNav() {
    if (!elTrack) return;

    // Geser 1 card width (kurang lebih)
    function scrollByCards(dir) {
      const card = elTrack.querySelector('.donor-card');
      const cardW = card ? (card.getBoundingClientRect().width + 12) : 260;
      elTrack.scrollBy({ left: dir * cardW, behavior: 'smooth' });
    }

    if (elPrev) elPrev.addEventListener('click', () => scrollByCards(-1));
    if (elNext) elNext.addEventListener('click', () => scrollByCards(1));
  }

  // ────────────────────────────────────────────────
  // Data fetch + polling
  // ────────────────────────────────────────────────
  async function fetchDonationData() {
    try {
      const res = await fetch(API, { cache: 'no-store' });
      const json = await res.json();
      return json || { ok: false };
    } catch (e) {
      return { ok: false, error: e?.message || 'fetch gagal' };
    }
  }

  async function refresh() {
    _secondsLeft = POLL_LABEL;
    const data = await fetchDonationData();
    if (data?.donationUrl) setDonationLink(data.donationUrl);

    _lastOk = !!data?.ok;
    renderProgress(data);
    renderDonors(data);
    renderCountdownSub();
  }

  // ── init ──
  initSliderNav();
  initGoalText();
  refresh();
  setInterval(refresh, POLL_MS);

  // tick countdown per detik
  setInterval(() => {
    if (_lastOk && _secondsLeft > 0) _secondsLeft -= 1;
    renderCountdownSub();
  }, 1000);
})();
