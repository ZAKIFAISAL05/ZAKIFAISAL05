const FAQ_QUICK_ACTIONS = [
    {
        label: "Cara download",
        fill: "download",
        icon: `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v10m0 0l4-4m-4 4l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `
    },
    {
        label: "Cek tiket",
        fill: "tiket",
        icon: `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 010 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 010-4V7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                <path d="M9 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `
    },
    {
        label: "Lapor bug",
        fill: "bug",
        icon: `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 17h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                <path d="M10.3 4.7a3 3 0 013.4 0l5.8 3.3a3 3 0 011.5 2.6v6.8a3 3 0 01-1.5 2.6l-5.8 3.3a3 3 0 01-3.4 0l-5.8-3.3A3 3 0 013 17.4v-6.8A3 3 0 014.5 8l5.8-3.3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            </svg>
        `
    }
];

const FAQ_INFO_CARDS = [
    {
        title: "Download & Instalasi",
        desc: "Panduan download, instal, update, dan link platform.",
        meta: "3 topik",
        fill: "download instal Itch.io TapTap"
    },
    {
        title: "Tiket & Status Laporan",
        desc: "Cara cek status tiket, link tiket, dan alur laporan.",
        meta: "2 topik",
        fill: "tiket status token laporan"
    },
    {
        title: "Bug / Error",
        desc: "Solusi masalah umum dan cara melapor yang benar.",
        meta: "2 topik",
        fill: "bug error crash lag"
    },
    {
        title: "Platform (Android / PC)",
        desc: "Info ketersediaan Android, PC, dan perangkat.",
        meta: "2 topik",
        fill: "android TapTap pc itch.io"
    },
    {
        title: "Game Roblox",
        desc: "Daftar game Roblox dan info link/detail.",
        meta: "1 topik",
        fill: "roblox undeads frequency fury"
    },
    {
        title: "Kontak",
        desc: "Cara menghubungi tim dan kanal resmi.",
        meta: "1 topik",
        fill: "kontak email discord whatsapp"
    }
];

// Tinggal edit array ini kalau mau ganti pertanyaan
const FAQ_ITEMS = [
    {
        q: "Gimana cara download game Nusabit Studio?",
        tags: "cara download game TapTap Itch.io pc instal install update",
        a:
            'Untuk <strong>Android</strong>, download lewat <strong>TapTap</strong> (bukan Play Store). ' +
            'Kalau di <strong>PC</strong>, biasanya via <strong>itch.io</strong> (belum tersedia di Steam).<br><br>' +
            '<strong>Cara download TapTap:</strong> buka link ini lalu install aplikasinya: ' +
            '<a href="https://www.taptap.io/download" target="_blank" rel="noopener noreferrer">https://www.taptap.io/download</a>. ' +
            'Setelah TapTap terpasang, cari nama game-nya lalu tekan tombol download/install.'
    },
    {
        q: "Kenapa game Nusabit belum tersedia di Play Store atau Steam?",
        tags: "kenapa belum tersedia play store playstore steam biaya developer kecil",
        a:
            "Karena saat ini Nusabit Studio masih developer kecil, jadi biaya rilis dan pengelolaan di platform tertentu (seperti Play Store/Steam) belum jadi prioritas. " +
            "Untuk sekarang, rilisnya fokus ke platform yang lebih memungkinkan: <strong>TapTap</strong> (Android) dan <strong>itch.io</strong> (PC)."
    },
    {
        q: "Di mana link download resminya?",
        tags: "download link TapTap Itch.io pc",
        a:
            "Link resmi tergantung platform game-nya. " +
            "Untuk <strong>Android</strong>, biasanya ada di <strong>TapTap</strong> (bukan Play Store). " +
            "Untuk <strong>PC</strong>, biasanya ada di <strong>itch.io</strong> (belum tersedia di Steam). " +
            "Kalau kamu sebut nama game-nya, CS bisa bantu kirim link yang tepat."
    },
    {
        q: "Gimana cara dapat update terbaru?",
        tags: "update versi terbaru patch",
        a:
            "Update biasanya mengikuti platform tempat kamu download. " +
            "Kalau kamu install dari <strong>TapTap</strong>, update lewat TapTap. " +
            "Kalau kamu download dari <strong>itch.io</strong>, update biasanya lewat halaman itch.io game tersebut. " +
            "Kalau bingung, sebut nama game-nya ke CS AI."
    },
    {
        q: "Kalau ada bug / error, lapornya ke mana?",
        tags: "lapor bug error crash masalah tidak bisa login lag",
        a: 'Klik tombol <strong>Menuju CS AI</strong>, lalu kirim deskripsi bug + lampiran bukti (gambar/video). Nanti kamu bisa dapat <strong>nomor tiket</strong> untuk memantau status.'
    },
    {
        q: "Gimana cara cek status tiket laporan?",
        tags: "cek tiket status laporan token tiket",
        a: "Setelah laporan terkirim, kamu biasanya mendapat <strong>link tiket</strong>. Buka link itu untuk cek status. Kalau link-nya hilang, minta bantuan CS AI."
    },
    {
        q: "Ada versi Android / TapTap?",
        tags: "android TapTap",
        a:
            'Kalau versi Android tersedia, biasanya rilisnya lewat <strong>TapTap</strong> (bukan Play Store). ' +
            'Untuk install TapTap, pakai link ini: <a href="https://www.taptap.io/download" target="_blank" rel="noopener noreferrer">https://www.taptap.io/download</a>. ' +
            "Sebut nama game-nya ke CS AI kalau kamu mau link game yang tepat."
    },
    {
        q: "Ada versi PC / Itch.io?",
        tags: "pc Itch.io",
        a:
            "Kalau versi PC tersedia, biasanya rilis lewat <strong>itch.io</strong> (belum tersedia di Steam). " +
            "Sebut nama game-nya di CS AI, nanti kami cek status rilis dan kirim link yang tepat."
    },
    {
        q: "Game Roblox Nusabit Studio apa saja?",
        tags: "roblox undeads frequency fury obby",
        a: "Kamu bisa cek daftar game di beranda. Kalau kamu butuh link Roblox tertentu, tanya CS AI dan sebut nama gamenya."
    },
    {
        q: "Gimana cara menghubungi tim Nusabit Studio?",
        tags: "kontak email discord whatsapp",
        a: "Kamu bisa minta kanal resmi (Discord/email) lewat CS AI. Pilih yang paling nyaman untuk follow-up."
    },
    {
        q: "Aku mau kasih saran / ide fitur, bisa?",
        tags: "saran masukan ide fitur request",
        a: 'Bisa. Klik tombol <strong>Menuju CS AI</strong>, lalu pilih opsi <strong>Kirim Saran</strong> dan tulis idenya sejelas mungkin.'
    }
];

(function () {
    var quickWrap = document.getElementById("quick-grid");
    var infoWrap = document.getElementById("info-grid");
    var list = document.getElementById("faq-list");
    var count = document.getElementById("faq-count");
    var input = document.getElementById("faq-search");

    if (!quickWrap || !infoWrap || !list || !count || !input) return;

    function normalize(s) {
        // Biar pencarian "nyambung" walau user ngetik: "itch io", "playstore", "taptap", dll
        // (hapus tanda baca jadi spasi)
        return (s || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function renderQuickActions() {
        quickWrap.innerHTML = FAQ_QUICK_ACTIONS.map(function (item) {
            return `
                <button class="quick-btn" type="button" data-fill="${item.fill}">
                    <div class="quick-ico" aria-hidden="true">${item.icon}</div>
                    <div class="quick-label">${item.label}</div>
                </button>
            `;
        }).join("");
    }

    function renderInfoCards() {
        infoWrap.innerHTML = FAQ_INFO_CARDS.map(function (item) {
            return `
                <div class="info-card" role="button" tabindex="0" data-fill="${item.fill}">
                    <div class="info-title">${item.title}</div>
                    <p class="info-desc">${item.desc}</p>
                    <span class="info-meta"><span class="dot"></span> ${item.meta}</span>
                </div>
            `;
        }).join("");
    }

    function renderFaqItems(items) {
        list.innerHTML = items.map(function (item) {
            return `
                <details class="faq-item" data-q="${item.tags}">
                    <summary>${item.q} <span class="chev" aria-hidden="true"></span></summary>
                    <div class="faq-answer">${item.a}</div>
                </details>
            `;
        }).join("");
    }

    function applyFilter(q) {
        var query = normalize(q);
        var visible = 0;
        var items = Array.from(list.querySelectorAll(".faq-item"));

        items.forEach(function (it) {
            it.open = false;
            var hay = normalize((it.getAttribute("data-q") || "") + " " + it.innerText);
            var ok = !query || hay.indexOf(query) !== -1;
            it.style.display = ok ? "" : "none";
            if (ok) visible++;
        });

        count.textContent = visible + " pertanyaan ditemukan";
    }

    function jumpWith(q) {
        input.value = q || "";
        applyFilter(input.value);
        try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
        list.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    renderQuickActions();
    renderInfoCards();
    renderFaqItems(FAQ_ITEMS);
    applyFilter("");

    input.addEventListener("input", function () {
        applyFilter(input.value);
    });

    document.addEventListener("click", function (e) {
        var target = e.target.closest("[data-fill]");
        if (!target) return;
        jumpWith(target.getAttribute("data-fill") || "");
    });

    document.addEventListener("keydown", function (e) {
        var target = e.target.closest("[data-fill]");
        if (!target) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            jumpWith(target.getAttribute("data-fill") || "");
        }
    });
})();

