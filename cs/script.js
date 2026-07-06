// ============================================================
//  cs/script.js — Nusabit Studio Customer Service Chat
//  CS bisa handle chat AI + laporan bug/saran langsung
// ============================================================
'use strict';

// ── SYNC THEME FROM MAIN SITE ──
(function () {
    var t = localStorage.getItem('gs-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
})();

var CS_ENDPOINT     = '/.netlify/functions/cs-chat';
var REPORT_ENDPOINT = '/.netlify/functions/report';
var currentType     = 'bug';
var chatHistory     = [];
var isWaiting       = false;
// Saat user konfirmasi kirim laporan (dari AI / dari modal), kita lock input agar tidak dobel submit.
var isSubmittingReport = false;
var sessionId       = 'cs_' + Math.random().toString(36).slice(2, 9);
var ttsEnabled      = true;
var soundEnabled    = true;
var pendingFiles    = [];
var MAX_ATTACHMENTS = 5;
var MAX_IMAGE_SIZE  = 3 * 1024 * 1024;
var MAX_VIDEO_SIZE  = 15 * 1024 * 1024;
var MAX_TOTAL_SIZE  = 20 * 1024 * 1024;

// ────────────────────────────────────────────────
//  AI Report Confirmation State
//  (WAJIB: minta konfirmasi ulang sebelum kirim ke admin/dev)
// ────────────────────────────────────────────────
// Format: { payload: {type,game,desc,email,contact,...}, ticketId: 'GS-...' }
var pendingAIReport = null;

function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function isConfirmYes(text) {
    var t = String(text || '').trim().toLowerCase();
    return ['ya', 'y', 'kirim', 'kirim ya', 'oke', 'ok', 'lanjut', 'setuju', 'gas'].includes(t);
}

function isConfirmNo(text) {
    var t = String(text || '').trim().toLowerCase();
    return ['tidak', 'gak', 'ga', 'nggak', 'batal', 'cancel', 'jangan'].includes(t);
}

var QUICK = [
    { label: '🎮 Info Game',        text: 'Ceritain dong game-game dari Nusabit Studio!' },
    { label: '📥 Cara Download',    text: 'Gimana cara download game kalian?' },
    { label: '🐛 Lapor Bug',        text: '__BUG__' },
    { label: '💡 Kirim Saran',      text: '__SARAN__' },
    { label: '📞 Kontak Tim',       text: 'Gimana cara menghubungi tim Nusabit Studio?' },
    { label: '📋 Cek Tiket',        text: '__TIKET__' },
];

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var size = bytes;
    var idx = 0;
    while (size >= 1024 && idx < units.length - 1) {
        size /= 1024;
        idx++;
    }
    return (size >= 10 || idx === 0 ? Math.round(size) : size.toFixed(1)) + ' ' + units[idx];
}

function getFileLimit(file) {
    return file && file.type && file.type.startsWith('video/') ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
}

function setUploadWarning(targetId, messages) {
    var box = document.getElementById(targetId);
    if (!box) return;
    if (!messages || !messages.length) {
        box.style.display = 'none';
        box.textContent = '';
        return;
    }
    box.style.display = 'block';
    box.innerHTML = messages.map(function(msg) { return '<div>' + msg + '</div>'; }).join('');
}

function filterAcceptedFiles(files, currentFiles, warningId) {
    var incoming = Array.from(files || []);
    var existing = Array.isArray(currentFiles) ? currentFiles.slice() : [];
    var accepted = [];
    var warnings = [];

    incoming.forEach(function(file) {
        if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
            warnings.push('Hanya gambar atau video yang bisa dilampirkan.');
            return;
        }

        if ((existing.length + accepted.length) >= MAX_ATTACHMENTS) {
            warnings.push('Maksimal ' + MAX_ATTACHMENTS + ' file per laporan/chat.');
            return;
        }

        var limit = getFileLimit(file);
        if (file.size > limit) {
            warnings.push(file.name + ' terlalu besar. Batas ' + (file.type.startsWith('video/') ? 'video' : 'gambar') + ' adalah ' + formatBytes(limit) + '.');
            return;
        }

        var totalSize = existing.concat(accepted).reduce(function(sum, f) {
            return sum + (f && f.size ? f.size : 0);
        }, 0) + file.size;
        if (totalSize > MAX_TOTAL_SIZE) {
            warnings.push('Total lampiran melebihi ' + formatBytes(MAX_TOTAL_SIZE) + '. Kurangi jumlah atau ukuran file.');
            return;
        }

        accepted.push(file);
    });

    setUploadWarning(warningId, warnings);
    return accepted;
}

function validatePreparedFiles(files, warningId) {
    var warnings = [];
    var totalSize = 0;

    (files || []).forEach(function(file) {
        if (!file) return;
        totalSize += file.size || 0;
        if (file.size > getFileLimit(file)) {
            warnings.push(file.name + ' melewati batas ukuran aman.');
        }
    });

    if ((files || []).length > MAX_ATTACHMENTS) {
        warnings.push('Jumlah file melebihi batas maksimal ' + MAX_ATTACHMENTS + ' file.');
    }
    if (totalSize > MAX_TOTAL_SIZE) {
        warnings.push('Total lampiran melebihi ' + formatBytes(MAX_TOTAL_SIZE) + '.');
    }

    setUploadWarning(warningId, warnings);
    return warnings.length === 0;
}

// Quick reply kontekstual — muncul sesuai konteks percakapan (bergaya Shopee/WA)
var QUICK_CONTEXTS = {
    game: [
        { label: 'Cara download?',      text: 'Gimana cara download game kalian?' },
        { label: 'Game di iOS?',         text: 'Game kalian ada di App Store / iOS gak?' },
        { label: 'Game di PC?',          text: 'Mana aja game yang ada versi PC-nya?' },
        { label: '🐛 Lapor Bug',        text: '__BUG__' },
        { label: '💡 Kirim Saran',      text: '__SARAN__' },
    ],
    download: [
        { label: 'Link Play Store?',     text: 'Kasih link Play Store-nya dong!' },
        { label: 'Ada versi iOS?',       text: 'Apakah game ini tersedia di App Store?' },
        { label: 'Ada versi PC/Steam?',  text: 'Apa ada versi PC atau Steam-nya?' },
        { label: 'Error pas install?',   text: '__BUG__' },
        { label: 'Game lainnya?',        text: 'Game apa lagi yang bisa dicoba?' },
    ],
    bug: [
        { label: '🐛 Lapor Bug',        text: '__BUG__' },
        { label: '📋 Cek Status Tiket', text: '__TIKET__' },
        { label: 'Cara dapat update?',  text: 'Gimana cara dapet update terbaru game-nya?' },
    ],
    saran: [
        { label: '💡 Kirim Saran Lagi', text: '__SARAN__' },
        { label: 'Ada update game?',     text: 'Ada update terbaru game apa?' },
        { label: '🎮 Info Game',        text: 'Ceritain dong game-game dari Nusabit Studio!' },
    ],
    tiket: [
        { label: '🐛 Lapor Bug Baru',   text: '__BUG__' },
        { label: '💡 Kirim Saran',      text: '__SARAN__' },
        { label: 'Info game terbaru?',  text: 'Ada game baru yang lagi dikembangin?' },
    ],
    kontak: [
        { label: 'Discord Nusabit Studio?', text: 'Gimana cara join Discord Nusabit Studio?' },
        { label: 'Email developer?',     text: 'Apa email yang bisa dihubungi?' },
        { label: '🐛 Lapor Bug',        text: '__BUG__' },
    ],
    def: [
        { label: '🎮 Info Game',        text: 'Ceritain dong game-game dari Nusabit Studio!' },
        { label: '📥 Cara Download',    text: 'Gimana cara download game kalian?' },
        { label: '🐛 Lapor Bug',        text: '__BUG__' },
        { label: '💡 Kirim Saran',      text: '__SARAN__' },
        { label: '📋 Cek Tiket',        text: '__TIKET__' },
    ]
};

function detectContext(text) {
    var t = (text || '').toLowerCase();
    if (t.includes('download') || t.includes('instal') || t.includes('cara') || t.includes('link') || t.includes('play store') || t.includes('app store') || t.includes('steam')) return 'download';
    if (t.includes('bug') || t.includes('error') || t.includes('crash') || t.includes('masalah') || t.includes('rusak') || t.includes('gabisa')) return 'bug';
    if (t.includes('saran') || t.includes('masukan') || t.includes('ide') || t.includes('minta')) return 'saran';
    if (t.includes('tiket') || t.includes('ticket') || t.includes('status laporan') || t.includes('laporan')) return 'tiket';
    if (t.includes('kontak') || t.includes('hubungi') || t.includes('discord') || t.includes('email') || t.includes('whatsapp')) return 'kontak';
    if (t.includes('game') || t.includes('main') || t.includes('roblox') || t.includes('zombie') || t.includes('parkun') || t.includes('simulator')) return 'game';
    return 'def';
}

/* ── TIME ── */
function now() {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/* ── NOTIF SUARA ── */
function playPing() {
    if (!soundEnabled) return;
    try {
        var ctx  = new (window.AudioContext || window.webkitAudioContext)();
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
    } catch(e) {}
}

/* ── TTS ── */
function speakText(text) {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var plain = text.replace(/<[^>]+>/g, '').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\n/g, ' ').trim();
    if (!plain) return;
    var utt  = new SpeechSynthesisUtterance(plain);
    utt.lang = 'id-ID'; utt.rate = 1.05; utt.pitch = 1.0;
    var voices  = window.speechSynthesis.getVoices();
    var idVoice = voices.find(function(v) { return v.lang.startsWith('id'); });
    if (idVoice) utt.voice = idVoice;
    window.speechSynthesis.speak(utt);
}

/* ── TOGGLE TTS/SFX ── */
function initToggles() {
    var btnTts   = document.getElementById('btn-tts');
    var btnSound = document.getElementById('btn-sound');
    if (btnTts) {
        btnTts.addEventListener('click', function() {
            ttsEnabled = !ttsEnabled;
            btnTts.title = ttsEnabled ? 'TTS Aktif' : 'TTS Mati';
            btnTts.classList.toggle('off', !ttsEnabled);
            if (!ttsEnabled) window.speechSynthesis && window.speechSynthesis.cancel();
        });
    }
    if (btnSound) {
        btnSound.addEventListener('click', function() {
            soundEnabled = !soundEnabled;
            btnSound.title = soundEnabled ? 'Suara Aktif' : 'Suara Mati';
            btnSound.classList.toggle('off', !soundEnabled);
        });
    }
}

/* ── RENDER MSG ── */
function addMsg(role, text, time, mediaList) {
    var msgs = document.getElementById('messages');
    var row  = document.createElement('div');
    row.className = 'msg-row ' + role;

    var formatted = text
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g,     '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    var avatarHtml = role === 'bot'
        ? '<div class="msg-avatar"><img src="../assets/img/studio_logo.png" alt="CS"></div>'
        : '';

    var nameHtml = role === 'bot'
        ? '<div class="msg-name">Nusabit Bot</div>'
        : '<div class="msg-name">Kamu</div>';

    var ttsBtn = role === 'bot'
        ? '<button class="tts-replay" title="Putar suara" onclick="speakText(\'' + text.replace(/'/g, "\\'").replace(/\n/g,' ') + '\')">▶</button>'
        : '';

    var mediaHtml = '';
    if (mediaList && mediaList.length) {
        mediaHtml = '<div class="bubble-media">';
        mediaList.forEach(function(m) {
            if (m.type === 'image') {
                mediaHtml += '<img class="bubble-img" src="' + m.url + '" alt="bukti" onclick="openLightbox(\'' + m.url + '\')">';
            } else if (m.type === 'video') {
                mediaHtml += '<video class="bubble-video" src="' + m.url + '" controls></video>';
            }
        });
        mediaHtml += '</div>';
    }

    row.innerHTML =
        avatarHtml +
        '<div class="msg-content">' +
            nameHtml +
            '<div class="msg-bubble">' + formatted + mediaHtml + '</div>' +
            '<div class="msg-meta"><span class="msg-time">' + (time || now()) + '</span>' + ttsBtn + '</div>' +
        '</div>';

    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;

    if (role === 'bot') { playPing(); speakText(text); }
}

/* ── LIGHTBOX ── */
function openLightbox(src) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<img src="' + src + '" alt="bukti"><button class="lb-close" onclick="this.parentNode.remove()">✕</button>';
    lb.addEventListener('click', function(e) { if (e.target === lb) lb.remove(); });
    document.body.appendChild(lb);
}

/* ── TYPING ── */
function showTyping() {
    var msgs = document.getElementById('messages');
    var row  = document.createElement('div');
    row.className = 'typing-row'; row.id = 'typing-row';
    row.innerHTML =
        '<div class="msg-avatar"><img src="../assets/img/studio_logo.png" alt="CS"></div>' +
        '<div class="typing-bubble"><span></span><span></span><span></span></div>';
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
}
function hideTyping() {
    var el = document.getElementById('typing-row');
    if (el) el.remove();
}

/* ── QUICK REPLIES ── */
function buildQuick() {
    renderQuickChips(QUICK);
}

function renderQuickChips(chips) {
    var area = document.getElementById('quick-chips');
    if (!area) return;
    area.innerHTML = '';
    chips.forEach(function(q) {
        var btn = document.createElement('button');
        btn.className = 'quick-chip';
        btn.innerHTML = '<span>' + q.label + '</span>';
        btn.onclick = function() {
            if (q.text === '__BUG__')    { hideQuickArea(); openModal('bug');   return; }
            if (q.text === '__SARAN__')  { hideQuickArea(); openModal('saran'); return; }
            if (q.text === '__TIKET__')  { hideQuickArea(); showTicketPrompt(); return; }
            sendMsg(q.text);
            hideQuickArea();
        };
        area.appendChild(btn);
    });
}

function showContextualQuick(botReply) {
    var ctx   = detectContext(botReply);
    var chips = QUICK_CONTEXTS[ctx] || QUICK_CONTEXTS['def'];
    var area  = document.getElementById('quick-chips');
    var qa    = document.getElementById('quick-area');
    if (!area || !qa) return;
    qa.style.display = 'block';
    renderQuickChips(chips);
}

function showTicketPrompt() {
    var siteOrigin = window.location.origin || 'https://nusabit.netlify.app';
    addMsg('bot',
        'Untuk cek status tiket, masukkan link tiket yang kamu dapat setelah laporan dikirim. ' +
        'Formatnya: **' + siteOrigin + '/tiket/?token=XXXXXX**\n\n' +
        'Atau klik tombol **🔍 Pantau Status Tiket** di bubble laporan sebelumnya.',
        now()
    );
}

function hideQuickArea() {
    var qa = document.getElementById('quick-area');
    if (qa) qa.style.display = 'none';
}

/* ── WELCOME ── */
function sendWelcome() {
    setTimeout(function() {
        addMsg('bot',
            'Halo! Selamat datang di **Customer Service Nusabit Studio**.\n\n' +
            'Ada yang bisa aku bantu? Kamu bisa tanya info game, cara download, atau **lapor bug / kirim saran** langsung di sini — ' +
            'aku yang terusin ke tim developer!',
            now()
        );
    }, 600);
}

/* ── FILE HANDLING ── */
function initFileInput() {
    var fileInput    = document.getElementById('file-input');
    var clearBtn     = document.getElementById('upload-clear-btn');
    if (!fileInput) return;

    fileInput.addEventListener('change', function() {
        var accepted = filterAcceptedFiles(fileInput.files, pendingFiles, 'upload-warning');
        accepted.forEach(function(f) { pendingFiles.push(f); });
        fileInput.value = '';
        renderPendingPreviews();
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            pendingFiles = [];
            setUploadWarning('upload-warning');
            renderPendingPreviews();
        });
    }
}

function renderPendingPreviews() {
    var bar   = document.getElementById('upload-preview-bar');
    var inner = document.getElementById('upload-preview-inner');
    if (!bar || !inner) return;
    inner.innerHTML = '';
    if (!pendingFiles.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    pendingFiles.forEach(function(f, i) {
        var item = document.createElement('div');
        item.className = 'preview-item';
        var url  = URL.createObjectURL(f);
        if (f.type.startsWith('image/')) {
            item.innerHTML = '<img src="' + url + '" alt="' + f.name + '">' +
                '<button class="preview-remove" data-i="' + i + '">✕</button>';
        } else {
            item.innerHTML = '<div class="preview-video-icon">' +
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' +
                '<span>' + f.name.slice(0,12) + (f.name.length > 12 ? '…' : '') + '</span></div>' +
                '<button class="preview-remove" data-i="' + i + '">✕</button>';
        }
        inner.appendChild(item);
    });
    inner.querySelectorAll('.preview-remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
            pendingFiles.splice(parseInt(btn.getAttribute('data-i')), 1);
            renderPendingPreviews();
        });
    });
}

function fileToBase64(file) {
    return new Promise(function(resolve, reject) {
        var r = new FileReader();
        r.onload  = function() { resolve(r.result.split(',')[1]); };
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

function scrollChatToBottom() {
    var msgs = document.getElementById('messages');
    if (!msgs) return;
    requestAnimationFrame(function() {
        msgs.scrollTop = msgs.scrollHeight;
    });
}

function initMobileViewportFix() {
    var input = document.getElementById('msg-input');
    var wrap = document.querySelector('.input-area-wrap');
    if (!input || !wrap) return;

    function syncViewportHeight() {
        var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty('--app-vh', vh + 'px');
        scrollChatToBottom();
    }

    syncViewportHeight();

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewportHeight);
        window.visualViewport.addEventListener('scroll', syncViewportHeight);
    } else {
        window.addEventListener('resize', syncViewportHeight);
    }

    input.addEventListener('focus', function() {
        setTimeout(function() {
            wrap.scrollIntoView({ block: 'end', behavior: 'smooth' });
            scrollChatToBottom();
        }, 180);
    });
}

/* ── SEND MSG ── */
function sendMsg(text, forcedFiles) {
    var files = forcedFiles || pendingFiles.slice();
    text = (text || '').trim();

    // Jika sedang ada konfirmasi laporan dari AI, maka input user dipakai sebagai keputusan (ya/batal).
    // Laporan TIDAK akan dikirim sebelum user konfirmasi.
    if (pendingAIReport && !files.length && text) {
        if (isConfirmYes(text)) {
            addMsg('user', text, now());
            confirmPendingAIReport();
            return;
        }
        if (isConfirmNo(text)) {
            addMsg('user', text, now());
            cancelPendingAIReport();
            return;
        }

        // User mengetik sesuatu yang bukan ya/tidak: anggap user ingin revisi.
        addMsg('bot', 'Siap. Laporan **belum** saya kirim. Silakan jelaskan revisinya ya (misalnya game yang benar, detail bug, atau rating yang salah).', now());
        pendingAIReport = null;
        // lanjut proses kirim pesan ke AI (untuk revisi)
    }

    if ((!text || !text.trim()) && !files.length) return;
    if (isWaiting || isSubmittingReport) return;
    if (!validatePreparedFiles(files, 'upload-warning')) return;

    var mediaList = files.map(function(f) {
        return { type: f.type.startsWith('image/') ? 'image' : 'video', url: URL.createObjectURL(f), file: f };
    });

    addMsg('user', text, now(), mediaList);
    chatHistory.push({ role: 'user', text: text + (files.length ? '\n[Melampirkan ' + files.length + ' file bukti]' : '') });

    var inp = document.getElementById('msg-input');
    if (inp) { inp.value = ''; inp.style.height = 'auto'; }

    pendingFiles = [];
    renderPendingPreviews();

    isWaiting = true;
    var sendBtn = document.getElementById('send-btn');
    if (sendBtn) sendBtn.disabled = true;
    showTyping();

    var filePromises = mediaList.map(function(m) {
        return fileToBase64(m.file).then(function(b64) {
            return { name: m.file.name, type: m.file.type, base64: b64 };
        });
    });

    Promise.all(filePromises).then(function(attachments) {
        return fetch(CS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                from: 'Pengunjung Web',
                userId: sessionId,
                history: chatHistory.slice(-10).map(function(h) {
                    return { role: h.role === 'bot' ? 'model' : 'user', text: h.text };
                }),
                attachments: attachments
            })
        });
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        hideTyping();
        isWaiting = false;
        if (sendBtn) sendBtn.disabled = false;

        if (data.rateLimited) {
            addMsg('bot', 'Sabar ya, tunggu beberapa detik sebelum kirim pesan lagi.', now());
            return;
        }

        var reply = (data.reply || 'Maaf, coba lagi ya!').trim();
        addMsg('bot', reply, now());
        chatHistory.push({ role: 'bot', text: reply });
        if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

        // Tampilkan quick reply kontekstual setelah bot balas
        showContextualQuick(reply);

        // Jika model mengeluarkan tag SUBMIT_REPORT, backend akan mengembalikan payload
        // dan frontend WAJIB minta konfirmasi user sebelum memanggil endpoint /report.
        if (data.reportNeedsConfirmation && data.reportPayload) {
            pendingAIReport = {
                payload: data.reportPayload,
                ticketId: generateTicket()
            };
            setTimeout(function() { postAIReportConfirmBubble(pendingAIReport.payload); }, 450);
        }
    })
    .catch(function() {
        hideTyping();
        isWaiting = false;
        if (sendBtn) sendBtn.disabled = false;
        addMsg('bot', 'Koneksi bermasalah. Coba refresh halaman atau hubungi kami via Discord/Email ya.', now());
    });
}

/* ── INPUT ── */
function initInput() {
    var inp = document.getElementById('msg-input');
    var btn = document.getElementById('send-btn');
    if (!inp || !btn) return;
    btn.addEventListener('click', function() { sendMsg(inp.value); hideQuickArea(); });
    inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMsg(inp.value);
            hideQuickArea();
        }
    });
    inp.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

/* ── TICKET GENERATOR ── */
function generateTicket() {
    return 'GS-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
}

/* ══════════════════════════════════════════
   AI REPORT CONFIRMATION (WAJIB)
══════════════════════════════════════════ */
function initAIReportConfirmDelegation() {
    var msgs = document.getElementById('messages');
    if (!msgs || msgs.dataset.aiConfirmBound) return;
    msgs.dataset.aiConfirmBound = '1';
    msgs.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest ? e.target.closest('button[data-report-action]') : null;
        if (!btn) return;
        var action = btn.getAttribute('data-report-action');
        if (action === 'confirm') confirmPendingAIReport();
        if (action === 'cancel')  cancelPendingAIReport();
    });
}

function postAIReportConfirmBubble(payload) {
    if (!payload) return;
    var msgs = document.getElementById('messages');
    if (!msgs) return;

    var type = String(payload.type || 'saran');
    var typeLabel = type === 'bug' ? '🐛 Bug/Error' : '💡 Saran / Permintaan';
    var game = escHtml(payload.game || '—');
    var desc = escHtml(payload.desc || '').replace(/\n/g, '<br>');
    var email = escHtml(payload.email || '—');
    var contact = escHtml(payload.contact || '—');

    var row = document.createElement('div');
    row.className = 'msg-row bot';
    row.innerHTML =
        '<div class="msg-avatar"><img src="../assets/img/studio_logo.png" alt="CS"></div>' +
        '<div class="msg-content">' +
            '<div class="msg-name">Nusabit Bot</div>' +
            '<div class="msg-bubble" style="border:1px solid rgba(243,156,18,.45);background:rgba(243,156,18,.08);">' +
                '<div style="font-weight:800;margin-bottom:10px;">Konfirmasi pengiriman</div>' +
                '<div style="font-size:0.86rem;line-height:1.55;opacity:.9;margin-bottom:10px;">' +
                    'Sebelum saya teruskan ke admin/tim developer, mohon konfirmasi dulu ya.' +
                '</div>' +
                '<div style="font-size:0.82rem;line-height:1.6;opacity:.9;background:rgba(0,0,0,.12);border:1px solid rgba(255,255,255,.06);padding:10px 12px;border-radius:10px;">' +
                    '<div><strong>Jenis:</strong> ' + typeLabel + '</div>' +
                    '<div><strong>Game:</strong> ' + game + '</div>' +
                    '<div style="margin-top:6px;"><strong>Detail:</strong><br>' + desc + '</div>' +
                    '<div style="margin-top:6px;"><strong>Email:</strong> ' + email + '</div>' +
                    '<div><strong>Kontak:</strong> ' + contact + '</div>' +
                '</div>' +
                '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">' +
                    '<button type="button" data-report-action="confirm" style="flex:1;min-width:160px;padding:10px 12px;border-radius:10px;border:1px solid rgba(124,77,255,.6);background:linear-gradient(135deg,#7c4dff,#5c35cc);color:#fff;font-weight:800;cursor:pointer;">✅ Ya, kirim</button>' +
                    '<button type="button" data-report-action="cancel" style="flex:1;min-width:140px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-weight:800;cursor:pointer;">✏️ Batal / Edit</button>' +
                '</div>' +
                '<div style="font-size:0.72rem;opacity:.7;margin-top:10px;line-height:1.5;">' +
                    'Kamu juga bisa ketik: <strong>ya</strong> untuk kirim, atau <strong>batal</strong> untuk batal.' +
                '</div>' +
            '</div>' +
            '<div class="msg-meta"><span class="msg-time">' + now() + '</span></div>' +
        '</div>';

    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    playPing();
}

function confirmPendingAIReport() {
    if (!pendingAIReport || !pendingAIReport.payload || isSubmittingReport) return;
    isSubmittingReport = true;
    hideQuickArea();

    addMsg('bot', 'Oke, saya teruskan laporannya sekarang. Tunggu sebentar ya…', now());
    showTyping();

    var payload = pendingAIReport.payload;
    var ticketId = pendingAIReport.ticketId || generateTicket();
    var hasEmail = !!(payload.email && String(payload.email).includes('@'));
    var typeOverride = payload.type || 'saran';

    fetch(REPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: typeOverride,
            game: payload.game || '',
            desc: payload.desc || '',
            contact: payload.contact || '',
            email: payload.email || '',
            ticketId: ticketId
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        hideTyping();
        isSubmittingReport = false;
        pendingAIReport = null;

        var ok = !!(data && data.ok);
        postTicketBubble(ok, !ok, ticketId, data && data.ticketNum, data && data.ticketUrl, hasEmail, typeOverride);
        if (ok) {
            addMsg('bot', '✅ Sip! Laporan kamu sudah saya teruskan ke admin/tim developer. Terima kasih ya.', now());
        }
    })
    .catch(function() {
        hideTyping();
        isSubmittingReport = false;
        pendingAIReport = null;
        addMsg('bot', '⚠️ Maaf, pengiriman laporan gagal karena koneksi/server. Coba lagi sebentar ya.', now());
    });
}

function cancelPendingAIReport() {
    if (!pendingAIReport) return;
    pendingAIReport = null;
    addMsg('bot', 'Siap. Laporan **belum** saya kirim. Kalau mau koreksi detailnya, tulis ulang saja ya.', now());
}

/* ══════════════════════════════════════════
   REPORT MODAL — Form lengkap + kirim ke WA
══════════════════════════════════════════ */
var modalFiles = [];
var pendingModalReport = null;

function openModal(type) {
    currentType = type || 'bug';
    switchType(currentType);

    // Reset form
    document.getElementById('modal-form').style.display   = 'block';
    document.getElementById('modal-success').classList.remove('show');
    document.getElementById('r-desc').value    = '';
    document.getElementById('r-contact').value = '';
    document.getElementById('r-email').value   = '';
    document.getElementById('r-game').value    = '';
    var submitBtn = document.getElementById('r-submit');
    submitBtn.disabled    = false;
    submitBtn.textContent = currentType === 'bug' ? 'Kirim Laporan Bug' : 'Kirim Saran';

    // Reset file preview modal
    modalFiles = [];
    var mPrev = document.getElementById('modal-upload-preview');
    if (mPrev) mPrev.innerHTML = '';
    setUploadWarning('modal-upload-warning');

    // Bersihkan error highlight
    ['r-desc','r-email'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) { el.style.borderColor = ''; el.style.boxShadow = ''; }
    });

    document.getElementById('modal-bg').classList.add('open');
}

function closeModal() {
    document.getElementById('modal-bg').classList.remove('open');
}

function switchType(type) {
    currentType = type;
    document.querySelectorAll('.type-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-type') === type);
    });
    var isBug = type === 'bug';
    var isReview = type === 'review';

    // Icon: untuk review, pakai style saran agar tidak blank (CSS-nya sudah ada)
    document.getElementById('modal-icon').className = 'modal-icon ' + (isReview ? 'saran' : type);

    document.getElementById('modal-title').textContent =
        isBug ? 'Laporan Bug / Error' : (isReview ? 'Edit / Hapus Ulasan' : 'Kirim Saran');

    document.getElementById('r-desc-label').textContent =
        isBug ? 'Deskripsi bug / error *' : (isReview ? 'Detail permintaan *' : 'Isi saran / masukan *');

    document.getElementById('r-desc').placeholder = isBug
        ? 'Ceritakan bug yang kamu temukan...'
        : (isReview
            ? 'Tulis detail edit/hapus ulasan kamu:\n' +
              '- Mau edit atau hapus?\n' +
              '- Nama yang dipakai saat ulasan\n' +
              '- Rating/isi ulasan lama (atau perkiraan waktu kirim)\n' +
              '- Jika edit: tulis rating/isi ulasan yang baru\n' +
              '- Alasan (opsional)'
            : 'Tulis saran atau masukan kamu...');

    document.getElementById('r-submit').textContent =
        isBug ? 'Kirim Laporan Bug' : (isReview ? 'Kirim Permintaan' : 'Kirim Saran');

    // Game select: untuk review, kunci ke "Ulasan Website"
    var gameEl = document.getElementById('r-game');
    if (gameEl) {
        gameEl.disabled = isReview;
        if (isReview) gameEl.value = 'Ulasan Website';
    }
}

/* ── MODAL FILE UPLOAD ── */
function initModalFileInput() {
    var mInput = document.getElementById('modal-file-input');
    if (!mInput) return;
    mInput.addEventListener('change', function() {
        var accepted = filterAcceptedFiles(mInput.files, modalFiles, 'modal-upload-warning');
        accepted.forEach(function(f) { modalFiles.push(f); });
        mInput.value = '';
        renderModalPreviews();
    });
}

function renderModalPreviews() {
    var mPreview = document.getElementById('modal-upload-preview');
    if (!mPreview) return;
    mPreview.innerHTML = '';
    modalFiles.forEach(function(f, i) {
        var item = document.createElement('div');
        item.className = 'preview-item-sm';
        var url = URL.createObjectURL(f);
        if (f.type.startsWith('image/')) {
            item.innerHTML = '<img src="' + url + '" alt="' + f.name + '"><button class="preview-remove" data-i="' + i + '">✕</button>';
        } else {
            item.innerHTML = '<div class="preview-video-icon-sm">' + f.name.slice(0,10) + '…</div>' +
                '<button class="preview-remove" data-i="' + i + '">✕</button>';
        }
        mPreview.appendChild(item);
    });
    mPreview.querySelectorAll('.preview-remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
            modalFiles.splice(parseInt(btn.getAttribute('data-i')), 1);
            renderModalPreviews();
        });
    });
}

/* ── SUBMIT REPORT (kirim ke backend → WA + Email) ── */
function submitReport() {
    var desc    = document.getElementById('r-desc').value.trim();
    var game    = document.getElementById('r-game').value;
    var contact = document.getElementById('r-contact').value.trim();
    var email   = document.getElementById('r-email').value.trim();
    var btn     = document.getElementById('r-submit');

    // Validasi deskripsi
    if (!desc || desc.length < 10) {
        var descEl = document.getElementById('r-desc');
        descEl.focus();
        descEl.style.borderColor = '#e74c3c';
        descEl.style.boxShadow   = '0 0 0 3px rgba(231,76,60,0.15)';
        setTimeout(function() { descEl.style.borderColor = ''; descEl.style.boxShadow = ''; }, 2000);
        return;
    }
    if (!validatePreparedFiles(modalFiles, 'modal-upload-warning')) return;

    var ticketId = generateTicket();

    // Mapping mode UI → payload API (backend hanya kenal bug/saran).
    var apiType = currentType === 'bug' ? 'bug' : 'saran';
    var apiGame = currentType === 'review' ? 'Ulasan Website' : game;

    pendingModalReport = {
        uiType: currentType,
        apiType: apiType,
        game: apiGame,
        desc: desc,
        contact: contact,
        email: email,
        ticketId: ticketId,
        files: modalFiles.slice(),
    };
    showModalConfirm(pendingModalReport);
}

function showModalConfirm(r) {
    if (!r) return;

    // Tampilkan layar konfirmasi di modal (WAJIB sebelum kirim ke admin/dev)
    document.getElementById('modal-form').style.display = 'none';
    var s = document.getElementById('modal-success');
    s.classList.add('show');

    // Sembunyikan box tiket pada fase konfirmasi
    var ticketBox = document.getElementById('ticket-box');
    if (ticketBox) ticketBox.style.display = 'none';

    var titleEl = document.getElementById('success-title');
    var msgEl   = document.getElementById('success-msg');
    if (titleEl) titleEl.textContent = 'Konfirmasi Pengiriman';
    if (msgEl) {
        var uiTypeLabel = r.uiType === 'review' ? 'Edit/Hapus Ulasan' : (r.uiType === 'bug' ? 'Bug/Error' : 'Saran');
        msgEl.innerHTML =
            'Sebelum dikirim ke admin/tim developer, mohon konfirmasi dulu ya.<br><br>' +
            '<b>Jenis:</b> ' + escHtml(uiTypeLabel) + '<br>' +
            '<b>Game:</b> ' + escHtml(r.game || '—') + '<br>' +
            '<b>Detail:</b><br>' + escHtml(r.desc || '').replace(/\n/g, '<br>') + '<br><br>' +
            '<b>Email:</b> ' + escHtml(r.email || '—') + '<br>' +
            '<b>Kontak:</b> ' + escHtml(r.contact || '—');
    }

    // Render tombol konfirmasi (dibuat sekali saja)
    var actions = document.getElementById('modal-confirm-actions');
    if (!actions) {
        actions = document.createElement('div');
        actions.id = 'modal-confirm-actions';
        actions.style.cssText = 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:14px;';
        actions.innerHTML =
            '<button type="button" id="modal-confirm-send" class="submit-btn" style="min-width:160px;">✅ Ya, kirim</button>' +
            '<button type="button" id="modal-confirm-cancel" class="submit-btn" style="min-width:160px;background:transparent;border:1px solid rgba(255,255,255,.18);">✏️ Batal / Edit</button>';
        s.appendChild(actions);

        var btnYes = document.getElementById('modal-confirm-send');
        var btnNo  = document.getElementById('modal-confirm-cancel');
        if (btnYes) btnYes.addEventListener('click', sendConfirmedModalReport);
        if (btnNo) btnNo.addEventListener('click', cancelModalConfirm);
    }
    // Pastikan muncul saat mode konfirmasi (bisa saja sebelumnya disembunyiin oleh layar sukses).
    if (actions) actions.style.display = 'flex';
}

function cancelModalConfirm() {
    pendingModalReport = null;
    document.getElementById('modal-form').style.display = 'block';
    document.getElementById('modal-success').classList.remove('show');
    var btn = document.getElementById('r-submit');
    if (btn) { btn.disabled = false; btn.textContent = currentType === 'bug' ? 'Kirim Laporan Bug' : 'Kirim Saran'; }
}

function sendConfirmedModalReport() {
    if (!pendingModalReport || isSubmittingReport) return;
    isSubmittingReport = true;

    var r = pendingModalReport;
    var ticketId = r.ticketId;
    var files = Array.isArray(r.files) ? r.files.slice() : [];

    // Indikator mengirim
    var titleEl = document.getElementById('success-title');
    var msgEl   = document.getElementById('success-msg');
    if (titleEl) titleEl.textContent = 'Mengirim...';
    if (msgEl) msgEl.textContent = 'Sedang mengirim laporan. Tunggu sebentar ya.';

    // Konversi file ke base64 baru dilakukan setelah user konfirmasi (lebih efisien)
    var filePromises = files.map(function(f) {
        return fileToBase64(f).then(function(b64) {
            return { name: f.name, type: f.type, base64: b64 };
        });
    });

    Promise.all(filePromises).then(function(attachments) {
        return fetch(REPORT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type:        r.apiType,
                game:        r.game,
                desc:        r.desc,
                contact:     r.contact,
                email:       r.email,
                ticketId:    ticketId,
                attachments: attachments
            })
        });
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
        saveReportLocal({
            id: ticketId, type: r.type,
            game: r.game || '—', desc: r.desc,
            contact: r.contact, email: r.email,
            summary: data.summary || r.desc,
            time: new Date().toLocaleString('id-ID'), done: false
        });

        pendingModalReport = null;
        modalFiles = [];
        isSubmittingReport = false;
        var emailSent = data && data.email ? data.email.userSent : undefined;
        showSuccess(!!data.ok, false, ticketId, !!r.email, data.ticketNum, data.ticketUrl, emailSent);
    })
    .catch(function() {
        saveReportLocal({
            id: ticketId, type: r.type,
            game: r.game || '—', desc: r.desc,
            contact: r.contact, email: r.email,
            summary: r.desc,
            time: new Date().toLocaleString('id-ID'), done: false, offline: true
        });

        pendingModalReport = null;
        modalFiles = [];
        isSubmittingReport = false;
        showSuccess(false, true, ticketId, false, null, null, false);
    });
}

function showSuccess(ok, offline, ticketId, hasEmail, ticketNum, ticketUrl, emailSent) {
    document.getElementById('modal-form').style.display = 'none';
    var s = document.getElementById('modal-success');
    s.classList.add('show');

    // Pastikan tombol konfirmasi tidak tampil di layar sukses
    var actions = document.getElementById('modal-confirm-actions');
    if (actions) actions.style.display = 'none';

    var ticketBox  = document.getElementById('ticket-box');
    var ticketNum_ = document.getElementById('ticket-number');
    var ticketNote = document.getElementById('ticket-note');

    if (ok) {
        document.getElementById('success-title').textContent =
            currentType === 'bug'
                ? '🐛 Bug Dilaporkan!'
                : (currentType === 'review' ? '✏️ Permintaan Diterima!' : '💡 Saran Terkirim!');
        document.getElementById('success-msg').textContent   = '✅ Laporan kamu sudah diteruskan ke admin/tim developer. Terima kasih!';
        if (ticketId) {
            ticketBox.style.display = 'flex';
            ticketNum_.textContent  = ticketNum ? 'Tiket #' + ticketNum : '#' + ticketId;
            var emailOk = hasEmail && emailSent !== false;
            var noteText = hasEmail
                ? (emailOk ? 'Konfirmasi + link tiket dikirim ke email kamu.' : 'Catatan: email konfirmasi belum terkirim (cek Spam / konfigurasi).')
                : 'Simpan nomor tiket ini untuk follow-up.';
            if (ticketUrl) {
                ticketNote.innerHTML = noteText + ' <a href="' + ticketUrl + '" target="_blank" style="color:var(--accent);text-decoration:none;font-weight:600;">Pantau Status →</a>';
            } else {
                ticketNote.textContent = noteText;
            }
        }
    } else if (offline) {
        document.getElementById('success-title').textContent = '📦 Tersimpan Lokal';
        document.getElementById('success-msg').textContent   = 'Laporan tersimpan. Koneksi server bermasalah — coba kirim ulang nanti.';
        if (ticketId) { ticketBox.style.display = 'flex'; ticketNum_.textContent = '#' + ticketId; ticketNote.textContent = 'Nomor tiket lokal.'; }
    } else {
        document.getElementById('success-title').textContent = '⚠️ Gagal Mengirim';
        document.getElementById('success-msg').textContent   = 'Coba lagi nanti atau hubungi kami via Discord.';
    }

    // Kirim juga bubble konfirmasi ke chat setelah modal tertutup
    var delay = ok ? 7500 : 3500;
    setTimeout(function() {
        closeModal();
        // Jangan bilang "link tiket dikirim ke email" kalau ternyata SMTP gagal.
        var emailOk = hasEmail && emailSent !== false;
        postTicketBubble(ok, offline, ticketId, ticketNum, ticketUrl, emailOk, currentType);
    }, delay);
}

/* ── BUBBLE TIKET DI CHAT ── */
function postTicketBubble(ok, offline, ticketId, ticketNum, ticketUrl, hasEmail, typeOverride) {
    var msgs = document.getElementById('messages');
    if (!msgs) return;

    var row = document.createElement('div');
    row.className = 'msg-row bot';

    var numLabel = ticketNum ? 'Tiket #' + ticketNum : (ticketId ? '#' + ticketId : '');
    var typeForLabel = String(typeOverride || currentType || 'saran');

    // Pastikan URL selalu absolute
    var fullUrl = '';
    if (ticketUrl) {
        if (ticketUrl.startsWith('http')) {
            fullUrl = ticketUrl;
        } else {
            fullUrl = window.location.protocol + '//' + window.location.host + (ticketUrl.startsWith('/') ? '' : '/') + ticketUrl;
        }
    }

    var inner = '';
    if (ok && ticketId) {
        var topLabel =
            typeForLabel === 'bug'
                ? '🐛 Laporan Bug Diterima!'
                : (typeForLabel === 'review' ? '✏️ Permintaan Ulasan Diterima!' : '💡 Laporan / Saran Diterima!');
        inner =
            '<div style="font-weight:700;margin-bottom:10px;font-size:0.95rem;">' + topLabel + '</div>' +
            '<div style="background:linear-gradient(135deg,rgba(124,77,255,.3),rgba(0,229,255,.15));' +
            'border:1px solid rgba(124,77,255,.5);border-radius:12px;padding:14px 16px;margin:6px 0;text-align:center;">' +
                '<div style="font-size:0.65rem;opacity:.65;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Nomor Tiket Kamu</div>' +
                '<div style="font-size:1.5rem;font-weight:800;letter-spacing:3px;color:#fff;">' + numLabel + '</div>' +
            '</div>' +
            (fullUrl
                ? '<a href="' + fullUrl + '" target="_blank" style="display:block;text-align:center;' +
                  'background:linear-gradient(135deg,#7c4dff,#5c35cc);color:#fff;' +
                  'text-decoration:none;padding:11px 16px;border-radius:10px;font-weight:700;font-size:0.9rem;' +
                  'margin-top:8px;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(124,77,255,.4);">' +
                  '🔍 Pantau Status Tiket →</a>'
                : '') +
            '<div style="font-size:0.72rem;opacity:.55;margin-top:10px;line-height:1.5;">' +
            (hasEmail ? '📧 Link tiket juga dikirim ke emailmu.' : '🔒 Bookmark link ini — hanya kamu yang bisa akses tiket ini.') +
            '</div>';
    } else if (offline) {
        inner = '📦 Laporanmu tersimpan lokal. ' + (numLabel ? 'ID sementara: <strong>' + numLabel + '</strong>. ' : '') + 'Coba kirim ulang saat koneksi stabil ya.';
    } else {
        inner = '⚠️ Laporan gagal terkirim. Coba lagi atau hubungi kami via Discord/Email.';
    }

    row.innerHTML =
        '<div class="msg-avatar"><img src="../assets/img/studio_logo.png" alt="CS"></div>' +
        '<div class="msg-content">' +
            '<div class="msg-name">Nusabit Bot</div>' +
            '<div class="msg-bubble">' + inner + '</div>' +
            '<div class="msg-meta"><span class="msg-time">' + now() + '</span></div>' +
        '</div>';

    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    playPing();
}

/* ── LOCAL STORAGE ── */
function saveReportLocal(r) {
    try {
        var all = JSON.parse(localStorage.getItem('gs_reports') || '[]');
        all.unshift(r);
        localStorage.setItem('gs_reports', JSON.stringify(all.slice(0, 100)));
    } catch(e) {}
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
    buildQuick();
    initInput();
    initToggles();
    initFileInput();
    initModalFileInput();
    initMobileViewportFix();
    initAIReportConfirmDelegation();
    sendWelcome();

    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = function() { window.speechSynthesis.getVoices(); };
    }

    // Modal backdrop close
    document.getElementById('modal-bg').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    // Tombol Bug di topbar
    var btnReportTop = document.getElementById('btn-report-top');
    if (btnReportTop) btnReportTop.addEventListener('click', function() { openModal('bug'); });

    // Kartu cepat di quick area
    var btnOpenBug = document.getElementById('btn-open-bug');
    if (btnOpenBug) btnOpenBug.addEventListener('click', function() {
        hideQuickArea();
        openModal('bug');
    });

    var btnOpenSaran = document.getElementById('btn-open-saran');
    if (btnOpenSaran) btnOpenSaran.addEventListener('click', function() {
        hideQuickArea();
        openModal('saran');
    });

    // Type toggle di dalam modal
    document.querySelectorAll('.type-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { switchType(btn.getAttribute('data-type')); });
    });

    // Tombol close modal
    var closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Submit report
    var submitBtn = document.getElementById('r-submit');
    if (submitBtn) submitBtn.addEventListener('click', submitReport);
});
