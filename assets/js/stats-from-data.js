// Auto-sync angka "GAME DIRILIS" dari `gameData`
// Jadi kalau kamu nambah game di `assets/js/gameData.js`, angka ikut nambah otomatis.
(function () {
  var count = Array.isArray(window.gameData) ? window.gameData.length : 0;
  var el = document.getElementById('statReleasedNumber');
  if (!el) return;

  // Set target untuk animasi counter (dipakai oleh assets/js/extras.js)
  el.setAttribute('data-target', String(count || 0));

  // Reset display biar animasi hitung dari 0 saat section masuk viewport
  // (kalau kamu scroll ke stats lagi, observer di extras.js cuma jalan sekali)
  el.textContent = '0';
})();

