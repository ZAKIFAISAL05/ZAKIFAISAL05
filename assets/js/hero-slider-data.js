// Adapter data untuk Hero Slider:
// slider membutuhkan `siteData.games[] = { gambar, judul }`
// sedangkan website ini sudah punya `gameData[] = { thumb, title, ... }`
(function () {
  var catalog =
    typeof gameData !== 'undefined' && Array.isArray(gameData) ? gameData : [];

  window.siteData = window.siteData || {};
  window.siteData.games = catalog
    .filter(function (g) {
      return g && (g.thumb || g.logo);
    })
    .map(function (g) {
      return {
        gambar: g.thumb || g.logo,
        judul: g.title || g.id || 'Game'
      };
    });
})();

