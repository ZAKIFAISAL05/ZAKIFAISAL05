// assets/js/gameData.js
// Data semua game Nusabit Studio

const gameData = [
    {
        id: 'Minecraft-Parkour-2D',
        title: 'Minecraft Parkun 2D',
        logo: 'assets/img/mc_parkun_logo.png',
        thumb: 'assets/img/mc_parkun_thumb.jpg',
        desc: 'Petualangan parkour seru dalam format 2D yang terinspirasi dari dunia Minecraft. Lompat, hindari rintangan, dan selesaikan tantangan secepat mungkin!',
        genre: 'Arcade',
        gallery: [
            'assets/img/mc_parkun_ss1.jpg',
            'assets/img/mc_parkun_ss2.jpg',
            'assets/img/mc_parkun_ss3.jpg',
            'assets/img/mc_parkun_ss4.jpg'
        ],
        platforms: [
            { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/236072?utm_medium=share&utm_source=copylink', cls: 'btn-taptap' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'The-One-For-Zombie',
        title: 'THE ONE FOR ZOMBIE',
        logo: 'assets/img/one_zombie_logo.png',
        thumb: 'assets/img/one_zombie_thumb.jpg',
        desc: 'Game aksi bertahan hidup melawan gerombolan zombie. Kumpulkan senjata dan selamatkan yang tersisa. Hanya satu yang akan bertahan!',
        genre: 'Action',
        gallery: [
            'assets/img/one_zombie_ss1.jpg',
            'assets/img/one_zombie_ss2.jpg',
            'assets/img/one_zombie_ss3.jpg'
        ],
        platforms: [
            { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/346358?utm_medium=share&utm_source=copylink', cls: 'btn-taptap' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'Desa-Karya-Investasi-Zombie',
        title: 'DESA KARYA INVESTASI ZOMBIE',
        logo: 'assets/img/desa_invest_logo.png',
        thumb: 'assets/img/desa_invest_thumb.jpg',
        desc: 'Gabungan unik antara manajemen desa, investasi, dan pertahanan melawan serangan zombie. Kelola sumber daya Anda dengan bijak.',
        genre: 'Simulation',
        gallery: [
            'assets/img/desa_invest_ss1.jpg',
            'assets/img/desa_invest_ss2.jpg',
            'assets/img/desa_invest_ss3.jpg',
            'assets/img/desa_invest_ss4.jpg'
        ],
        platforms: [
            { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/33703520', cls: 'btn-taptap' },
            { name: 'Itch.io (Mobile)', url: 'https://zakifaisalofficial.itch.io/desa-cipta-karya-invensi-zombie', cls: 'btn-itchio' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'Gerbang-Parkun-2D',
        title: 'Gerbang Parkun 2D',
        logo: 'assets/img/gerbang_parkun_logo.png',
        thumb: 'assets/img/gerbang_parkun_thumb.jpg',
        desc: 'Parkour 2D dengan level yang menantang dan speedrun yang kompetitif. Buka gerbang menuju level berikutnya dengan skill lompatan sempurna.',
        genre: 'Platformer',
        gallery: [
            'assets/img/gerbang_parkun_ss1.jpg',
            'assets/img/gerbang_parkun_ss2.jpg',
            'assets/img/gerbang_parkun_ss3.jpg'
        ],
        platforms: [
            { name: 'Itch.io (Mobile/Windows)', url: 'https://zakifaisalofficial.itch.io/gerbang-parkun-2d', cls: 'btn-itchio' },
            { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/33618770', cls: 'btn-taptap' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'Desa-Cipta-Karya-Ch2',
        title: 'Desa Cipta Karya Chapter 2',
        logo: 'assets/img/cipta_karya2_logo.png',
        thumb: 'assets/img/cipta_karya2_thumb.jpg',
        desc: 'Kelanjutan dari kisah pembangunan desa dan simulasi kehidupan. Hadapi tantangan baru dan kembangkan desa hingga makmur.',
        genre: 'Simulation',
        gallery: [
            'assets/img/cipta_karya2_ss1.jpg',
            'assets/img/cipta_karya2_ss2.jpg',
            'assets/img/cipta_karya2_ss3.jpg',
            'assets/img/cipta_karya2_ss4.jpg'
        ],
        platforms: [
            { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/33752652?share_id=d04b5dd55ff9&utm_medium=share&utm_source=copylink', cls: 'btn-taptap' },
            { name: 'Itch.io (Mobile)', url: 'https://zakifaisalofficial.itch.io/desa-karya-chapter-2', cls: 'btn-itchio' },
            { name: 'Amazon (Mobile)', url: 'https://www.amazon.com/gp/product/B0DH53XXFR', cls: 'btn-amazon' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'Frequency-Fury-Obby',
        title: 'Frequency Fury Obby (Roblox)',
        logo: 'assets/img/frequency_fury_logo.png',
        thumb: 'assets/img/frequency_fury_thumb.jpg',
        desc: 'Adu nyali dan kecepatanmu dalam Frequency Fury Obby — tantangan rintangan yang menguji ketepatan dan kecepatan sebelum frekuensi bass menghantammu.',
        genre: 'Arcade, Platformer',
        gallery: [
            'assets/img/frequency_fury_ss1.jpg',
            'assets/img/frequency_fury_ss2.jpg',
            'assets/img/frequency_fury_ss3.jpg'
        ],
        platforms: [
            { name: 'Play on Roblox', url: 'https://www.roblox.com/id/games/113175281404228/Frequency-Fury-Obby', cls: 'btn-roblox' }
        ],
        developer: 'Nusabit Studio'
    }
];

// ─────────────────────────────────────────────────────────
//  LEGACY LOCAL PREVIEW MERGE
//  Ada versi lama panel admin yang pernah menyimpan katalog ke
//  localStorage. Sebelumnya data itu mengganti seluruh game bawaan,
//  akibatnya game asli bisa hilang dan halaman detail jadi
//  "Game tidak ditemukan". Sekarang data lokal hanya dipakai untuk
//  menimpa / menambah entry, bukan menghapus game bawaan.
// ─────────────────────────────────────────────────────────
(function mergeLegacyAdminData() {
    var STORAGE_KEY = 'gs_catalog_games';
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
    if (!raw) return;

    var adminGames;
    try { adminGames = JSON.parse(raw); } catch (e) { return; }
    if (!Array.isArray(adminGames) || !adminGames.length) return;

    var byId = {};
    gameData.forEach(function (g) {
        byId[g.id] = Object.assign({}, g);
    });

    adminGames.forEach(function (ag) {
        if (!ag || !ag.id) return;

        var existing = byId[ag.id] || {};
        var nextPlatforms = Array.isArray(ag.platforms)
            ? ag.platforms
            : (Array.isArray(existing.platforms) ? existing.platforms : []);
        var nextGallery = Array.isArray(ag.gallery) && ag.gallery.length
            ? ag.gallery
            : (Array.isArray(existing.gallery) ? existing.gallery : []);

        byId[ag.id] = {
            id: ag.id,
            title: ag.title || existing.title || ag.id,
            logo: ag.logo || ag.icon || existing.logo || 'assets/img/studio_logo.png',
            thumb: ag.thumb || ag.icon || existing.thumb || existing.logo || 'assets/img/studio_logo.png',
            desc: ag.desc || existing.desc || '',
            genre: ag.genre || existing.genre || 'Other',
            gallery: nextGallery,
            platforms: nextPlatforms,
            developer: existing.developer || 'Nusabit Studio'
        };
    });

    gameData.length = 0;
    Object.keys(byId).forEach(function (id) {
        gameData.push(byId[id]);
    });
})();

// ─────────────────────────────────────────────────────────
//  GLOBAL ACCESSOR + ID HELPERS
//  Semua halaman harus ambil katalog + pencarian ID dari sini
//  supaya kalau `id` di gameData.js diubah, link dan lookup ikut
//  sinkron otomatis.
// ─────────────────────────────────────────────────────────
(function exposeGameCatalog(global) {
    function normalizeGameId(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    function getGameCatalog() {
        return Array.isArray(gameData) ? gameData : [];
    }

    function findGameById(value) {
        var rawValue = String(value || '').trim();
        if (!rawValue) return null;

        var normalizedNeedle = normalizeGameId(rawValue);
        if (!normalizedNeedle) return null;

        return getGameCatalog().find(function (game) {
            if (!game) return false;

            var normalizedId = normalizeGameId(game.id);
            var normalizedTitle = normalizeGameId(game.title);

            return normalizedId === normalizedNeedle || normalizedTitle === normalizedNeedle;
        }) || null;
    }

    function buildGameUrl(id) {
        return '/game/?id=' + encodeURIComponent(String(id || '').trim());
    }

    global.gameData = gameData;
    global.getGameCatalog = getGameCatalog;
    global.normalizeGameId = normalizeGameId;
    global.findGameById = findGameById;
    global.buildGameUrl = buildGameUrl;
})(typeof window !== 'undefined' ? window : globalThis);
