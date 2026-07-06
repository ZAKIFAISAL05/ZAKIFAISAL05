// ============================================================
//  assets/js/cs-chat.js
//  CS Chat Widget + Bug Report/Saran Modal — Nusabit Studio
// ============================================================
(function () {
'use strict';

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
var CS_ENDPOINT     = '/.netlify/functions/cs-chat';
var REPORT_ENDPOINT = '/.netlify/functions/report';
var REPORT_STORE    = 'gs_reports';
var MAX_HISTORY     = 20;

var GAMES = [
    'Minecraft Parkun 2D','THE ONE FOR ZOMBIE','Desa Investasi Zombie',
    'Gerbang Parkun 2D','Desa Cipta Karya Ch 2','The Undeads (Roblox)',
    'Frequency Fury Obby (Roblox)'
];

var QUICK_REPLIES = [
    { label: '🎮 Info Game',     text: 'Ceritain dong game-game dari Nusabit Studio!' },
    { label: '📥 Cara Download', text: 'Gimana cara download game kalian?' },
    { label: '🐛 Lapor Bug',     text: '__open_report_bug__' },
    { label: '💡 Kirim Saran',   text: '__open_report_saran__' },
    { label: '📞 Kontak',        text: 'Gimana cara menghubungi tim Nusabit Studio?' },
];

var csHistory = [];
var isTyping  = false;
var csOpen    = false;
var sessionId = 'user_' + Math.random().toString(36).slice(2, 10);
var currentReportType = 'bug';
// Saat konfirmasi/pengiriman laporan, lock supaya tidak double-submit.
var isSubmittingReport = false;

// Untuk laporan yang dibuat oleh AI (tag SUBMIT_REPORT), kita simpan dulu sampai user konfirmasi.
// Format: { payload: {...}, ticketId: 'GS-...' }
var pendingAIReport = null;
var pendingModalPayload = null;

/* safe getElementById — tidak crash kalau null */
var $ = function (id) { return document.getElementById(id); };
function safeVal(id)  { var el = $(id); return el ? el.value : ''; }
function safeText(id, txt) { var el = $(id); if (el) el.textContent = txt; }
function safeHTML(id, html) { var el = $(id); if (el) el.innerHTML = html; }
function safeStyle(id, prop, val) { var el = $(id); if (el) el.style[prop] = val; }
function safePH(id, txt)  { var el = $(id); if (el) el.placeholder = txt; }
function safeClass(id, method, cls) { var el = $(id); if (el) el.classList[method](cls); }
function safeOn(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }

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

function generateTicketId() {
    return 'GS-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
}

/* ══════════════════════════════════════════
   BUILD HTML
══════════════════════════════════════════ */
function buildHTML() {
    // CS Toggle Button
    var toggle = document.createElement('button');
    toggle.id = 'cs-toggle';
    toggle.setAttribute('aria-label', 'Buka CS Chat');
    toggle.innerHTML = '💬<span class="cs-badge" id="cs-badge">1</span>';
    document.body.appendChild(toggle);

    // CS Window
    var win = document.createElement('div');
    win.id = 'cs-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Nusabit Studio Customer Service');
    win.innerHTML =
        '<div class="cs-header">' +
            '<div class="cs-header-avatar"><img src="assets/img/studio_logo.png" alt="CS"></div>' +
            '<div class="cs-header-info">' +
                '<span class="cs-header-name">NUSABIT BOT</span>' +
                '<span class="cs-header-status">Online 24/7</span>' +
            '</div>' +
            '<button class="cs-close-btn" id="cs-close" aria-label="Tutup">✕</button>' +
        '</div>' +
        '<div class="cs-messages" id="cs-messages"></div>' +
        '<div class="cs-quick-btns" id="cs-quick-btns"></div>' +
        '<div class="cs-input-row">' +
            '<textarea id="cs-input" placeholder="Ketik pesan..." rows="1" maxlength="500"></textarea>' +
            '<button id="cs-send" aria-label="Kirim">➤</button>' +
        '</div>' +
        '<button class="cs-report-link" id="cs-report-link">🐛 Laporkan Bug / 💡 Kirim Saran</button>';
    document.body.appendChild(win);

    // Report Modal
    var modal = document.createElement('div');
    modal.id = 'report-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
        '<div class="report-box">' +
            '<button class="report-close" id="report-close" aria-label="Tutup">✕</button>' +
            '<span class="report-title" id="report-title">🐛 LAPORAN BUG / ERROR</span>' +
            '<div class="report-type-tabs">' +
                '<button class="report-type-tab active" data-type="bug">🐛 BUG / ERROR</button>' +
                '<button class="report-type-tab" data-type="saran">💡 SARAN</button>' +
            '</div>' +
            '<div id="report-form">' +
                '<div class="rfield">' +
                    '<label>GAME YANG BERMASALAH</label>' +
                    '<select id="r-game">' +
                        '<option value="">-- Pilih Game --</option>' +
                        GAMES.map(function(g){ return '<option value="'+g+'">'+g+'</option>'; }).join('') +
                        '<option value="Lainnya">Lainnya / Umum</option>' +
                    '</select>' +
                '</div>' +
                '<div class="rfield">' +
                    '<label id="r-desc-label">DESKRIPSI BUG / ERROR *</label>' +
                    '<textarea id="r-desc" rows="4" placeholder="Ceritakan bug yang kamu temukan..." maxlength="1000"></textarea>' +
                '</div>' +
                '<div class="rfield">' +
                    '<label>EMAIL KAMU <span style="font-weight:400;opacity:0.6;">(untuk konfirmasi tiket)</span></label>' +
                    '<input type="email" id="r-email" placeholder="contoh@gmail.com" maxlength="100">' +
                '</div>' +
                '<div class="rfield">' +
                    '<label>KONTAK LAIN <span style="font-weight:400;opacity:0.6;">(opsional — WA / Discord)</span></label>' +
                    '<input type="text" id="r-contact" placeholder="WA / Discord..." maxlength="100">' +
                '</div>' +
                '<button class="btn-report-submit" id="r-submit">▶ KIRIM LAPORAN</button>' +
            '</div>' +
            '<div class="report-result" id="report-result">' +
                '<span class="report-result-icon" id="r-result-icon">✅</span>' +
                '<span class="report-result-title" id="r-result-title">LAPORAN TERKIRIM!</span>' +
                '<span class="report-result-msg" id="r-result-msg">Terima kasih! Notifikasi sudah dikirim ke admin.</span>' +
                '<div class="report-ticket-box" id="report-ticket-box" style="display:none;">' +
                    '<span style="font-size:0.7rem;opacity:0.6;text-transform:uppercase;letter-spacing:1px;">Nomor Tiket</span>' +
                    '<span class="report-ticket-num" id="report-ticket-num">#GS-000000</span>' +
                '</div>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);
}

/* ══════════════════════════════════════════
   CS TOGGLE
══════════════════════════════════════════ */
function bindToggle() {
    var toggle   = $('cs-toggle');
    var win      = $('cs-window');
    var closeBtn = $('cs-close');
    if (!toggle || !win) return;

    toggle.addEventListener('click', function () {
        csOpen = !csOpen;
        win.classList.toggle('open', csOpen);
        toggle.innerHTML = csOpen
            ? '✕<span class="cs-badge" id="cs-badge"></span>'
            : '💬<span class="cs-badge" id="cs-badge">1</span>';
        if (csOpen) {
            var badge = $('cs-badge');
            if (badge) badge.classList.remove('show');
            if (!csHistory.length) sendWelcome();
            setTimeout(function(){ var inp=$('cs-input'); if(inp) inp.focus(); }, 300);
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            csOpen = false;
            win.classList.remove('open');
            toggle.innerHTML = '💬<span class="cs-badge" id="cs-badge"></span>';
        });
    }

    safeOn('cs-report-link', 'click', function () { openReportModal('bug'); });
}

/* ══════════════════════════════════════════
   QUICK REPLIES
══════════════════════════════════════════ */
function buildQuickReplies() {
    var container = $('cs-quick-btns');
    if (!container) return;
    container.innerHTML = '';
    QUICK_REPLIES.forEach(function (qr) {
        var btn = document.createElement('button');
        btn.className = 'cs-quick-btn';
        btn.textContent = qr.label;
        btn.addEventListener('click', function () {
            if (qr.text === '__open_report_bug__')   { openReportModal('bug');   return; }
            if (qr.text === '__open_report_saran__')  { openReportModal('saran'); return; }
            sendUserMessage(qr.text);
        });
        container.appendChild(btn);
    });
}

/* ══════════════════════════════════════════
   MESSAGES
══════════════════════════════════════════ */
function timeStr() {
    return new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}

function appendMsg(role, text, time) {
    var container = $('cs-messages');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'cs-msg ' + role;
    var formatted = text
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/\*([^*]+)\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
    div.innerHTML =
        '<div class="cs-msg-bubble">' + formatted + '</div>' +
        '<div class="cs-msg-time">' + (time || timeStr()) + '</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    var container = $('cs-messages');
    if (!container || isTyping) return;
    isTyping = true;
    var div = document.createElement('div');
    div.id = 'cs-typing-indicator';
    div.className = 'cs-msg bot';
    div.innerHTML = '<div class="cs-typing"><span></span><span></span><span></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function hideTyping() {
    var el = $('cs-typing-indicator');
    if (el) el.remove();
    isTyping = false;
}

function sendWelcome() {
    var welcome = 'Halo! 👋 Aku *Nusabit Bot*, asisten resmi Nusabit Studio.\n\nAda yang bisa aku bantu? Kamu bisa tanya soal game, cara download, atau lapor bug! 🎮';
    appendMsg('bot', welcome, timeStr());
    csHistory.push({ role: 'bot', text: welcome });
}

/* ══════════════════════════════════════════
   SEND MESSAGE
══════════════════════════════════════════ */
function sendUserMessage(text) {
    if (!text || !text.trim() || isTyping || isSubmittingReport) return;
    text = text.trim();

    // Jika ada laporan dari AI yang menunggu konfirmasi, interpretasikan input user.
    if (pendingAIReport) {
        if (isConfirmYes(text)) {
            appendMsg('user', text, timeStr());
            csHistory.push({ role: 'user', text: text });
            confirmPendingAIReport();
            return;
        }
        if (isConfirmNo(text)) {
            appendMsg('user', text, timeStr());
            csHistory.push({ role: 'user', text: text });
            cancelPendingAIReport();
            return;
        }
        // selain ya/tidak: anggap user ingin revisi, jangan kirim laporan lama
        appendMsg('bot', 'Siap. Laporan **belum** saya kirim. Silakan jelaskan revisinya ya (misalnya game yang benar, detail bug, atau rating yang salah).', timeStr());
        pendingAIReport = null;
    }

    appendMsg('user', text, timeStr());
    csHistory.push({ role: 'user', text: text });

    var inp = $('cs-input');
    if (inp) inp.value = '';

    showTyping();

    var payload = {
        text:    text,
        from:    'Pengunjung',
        userId:  sessionId,
        history: csHistory.slice(-10).map(function(h){ return { role: h.role === 'bot' ? 'model' : 'user', text: h.text }; })
    };

    fetch(CS_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
    })
    .then(function(r){ return r.json(); })
    .then(function(data) {
        hideTyping();
        if (data.rateLimited) {
            appendMsg('bot', 'Sabar ya, tunggu beberapa detik sebelum kirim lagi 😄', timeStr());
            return;
        }
        var reply = (data.reply || 'Maaf, coba lagi ya!').trim();
        appendMsg('bot', reply, timeStr());
        csHistory.push({ role: 'bot', text: reply });
        if (csHistory.length > MAX_HISTORY) csHistory = csHistory.slice(-MAX_HISTORY);

        // Jika model minta SUBMIT_REPORT, frontend WAJIB minta konfirmasi user dulu.
        if (data.reportNeedsConfirmation && data.reportPayload) {
            pendingAIReport = { payload: data.reportPayload, ticketId: generateTicketId() };
            setTimeout(function(){ appendAIReportConfirmBubble(pendingAIReport.payload); }, 350);
        }
    })
    .catch(function(err) {
        hideTyping();
        console.error('CS chat error:', err);
        appendMsg('bot', 'Koneksi bermasalah. Coba lagi sebentar ya! 🙏', timeStr());
    });
}

function bindAIReportConfirmDelegation() {
    var container = $('cs-messages');
    if (!container || container.dataset.aiConfirmBound) return;
    container.dataset.aiConfirmBound = '1';
    container.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest ? e.target.closest('button[data-report-action]') : null;
        if (!btn) return;
        var action = btn.getAttribute('data-report-action');
        if (action === 'confirm') confirmPendingAIReport();
        if (action === 'cancel')  cancelPendingAIReport();
    });
}

function appendAIReportConfirmBubble(payload) {
    if (!payload) return;
    var container = $('cs-messages');
    if (!container) return;

    var type = String(payload.type || 'saran');
    var typeLabel = type === 'bug' ? '🐛 Bug/Error' : '💡 Saran / Permintaan';
    var game = escHtml(payload.game || '—');
    var desc = escHtml(payload.desc || '').replace(/\\n/g, '<br>');
    var email = escHtml(payload.email || '—');
    var contact = escHtml(payload.contact || '—');

    var div = document.createElement('div');
    div.className = 'cs-msg bot';
    div.innerHTML =
        '<div class="cs-msg-bubble" style="border:1px solid rgba(245,158,11,.45);background:rgba(245,158,11,.08);">' +
            '<div style="font-weight:800;margin-bottom:10px;">Konfirmasi pengiriman</div>' +
            '<div style="font-size:0.82rem;line-height:1.6;opacity:.9;margin-bottom:10px;">' +
                'Sebelum saya teruskan ke admin/tim developer, mohon konfirmasi dulu ya.' +
            '</div>' +
            '<div style="font-size:0.78rem;line-height:1.65;opacity:.9;background:rgba(0,0,0,.12);border:1px solid rgba(255,255,255,.06);padding:10px 12px;border-radius:10px;">' +
                '<div><b>Jenis:</b> ' + typeLabel + '</div>' +
                '<div><b>Game:</b> ' + game + '</div>' +
                '<div style="margin-top:6px;"><b>Detail:</b><br>' + desc + '</div>' +
                '<div style="margin-top:6px;"><b>Email:</b> ' + email + '</div>' +
                '<div><b>Kontak:</b> ' + contact + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">' +
                '<button type="button" data-report-action="confirm" style="flex:1;min-width:150px;padding:10px 12px;border-radius:10px;border:1px solid rgba(124,77,255,.6);background:linear-gradient(135deg,#7c4dff,#5c35cc);color:#fff;font-weight:800;cursor:pointer;">✅ Ya, kirim</button>' +
                '<button type="button" data-report-action="cancel" style="flex:1;min-width:130px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-weight:800;cursor:pointer;">✏️ Batal / Edit</button>' +
            '</div>' +
            '<div style="font-size:0.7rem;opacity:.7;margin-top:10px;line-height:1.5;">Kamu juga bisa ketik: <b>ya</b> / <b>batal</b>.</div>' +
        '</div>' +
        '<div class="cs-msg-time">' + timeStr() + '</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function confirmPendingAIReport() {
    if (!pendingAIReport || !pendingAIReport.payload || isSubmittingReport) return;
    isSubmittingReport = true;
    var payload = pendingAIReport.payload;
    var ticketId = pendingAIReport.ticketId || generateTicketId();
    var type = String(payload.type || 'saran');

    showTyping();
    fetch(REPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: type,
            game: payload.game || '',
            desc: payload.desc || '',
            contact: payload.contact || '',
            email: payload.email || '',
            ticketId: ticketId
        })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
        hideTyping();
        isSubmittingReport = false;
        pendingAIReport = null;

        if (!data || !data.ok) {
            appendMsg('bot', '⚠️ Maaf, laporan gagal terkirim. Coba lagi sebentar ya.', timeStr());
            return;
        }

        var numLabel = data.ticketNum ? '#'+data.ticketNum : '#'+ticketId;
        var relUrl = data.ticketUrl || '';
        var fullUrl = relUrl
            ? (relUrl.startsWith('http') ? relUrl : (window.location.protocol + '//' + window.location.host + (relUrl.startsWith('/') ? '' : '/') + relUrl))
            : '';

        appendMsg('bot',
            '✅ Laporan kamu sudah saya teruskan ke admin/tim developer.\n\n' +
            'Nomor tiket: *' + numLabel + '*\n' +
            (fullUrl ? '<a href="' + fullUrl + '" target="_blank" style="color:#00e5ff;font-weight:700;">📋 Pantau Status Tiket →</a>\n' : '') +
            '\nSimpan nomor/link ini ya.',
            timeStr()
        );
    })
    .catch(function(){
        hideTyping();
        isSubmittingReport = false;
        pendingAIReport = null;
        appendMsg('bot', '⚠️ Koneksi bermasalah saat mengirim laporan. Coba lagi sebentar ya.', timeStr());
    });
}

function cancelPendingAIReport() {
    if (!pendingAIReport) return;
    pendingAIReport = null;
    appendMsg('bot', 'Siap. Laporan **belum** saya kirim. Kalau mau koreksi detailnya, tulis ulang saja ya.', timeStr());
}

/* ══════════════════════════════════════════
   INPUT BINDING
══════════════════════════════════════════ */
function bindInput() {
    var inp  = $('cs-input');
    var send = $('cs-send');
    if (!inp || !send) return;

    send.addEventListener('click', function(){ sendUserMessage(inp.value); });
    inp.addEventListener('keydown', function(e){
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendUserMessage(inp.value);
        }
    });
    inp.addEventListener('input', function(){
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });
}

/* ══════════════════════════════════════════
   REPORT MODAL
══════════════════════════════════════════ */
function openReportModal(type) {
    currentReportType = type || 'bug';
    var modal = $('report-modal');
    if (!modal) return;

    // Reset form dengan null-safe
    safeStyle('report-form', 'display', 'block');
    safeClass('report-result', 'remove', 'show');
    var rDesc    = $('r-desc');    if (rDesc)    rDesc.value    = '';
    var rContact = $('r-contact'); if (rContact) rContact.value = '';
    var rEmail   = $('r-email');   if (rEmail)   rEmail.value   = '';
    var rGame    = $('r-game');    if (rGame)    rGame.value    = '';
    var rSubmit  = $('r-submit');
    if (rSubmit) { rSubmit.disabled = false; rSubmit.textContent = '▶ KIRIM LAPORAN'; }
    safeStyle('report-ticket-box', 'display', 'none');
    pendingModalPayload = null;

    // Bersihkan elemen dinamis (link tiket / tombol konfirmasi) supaya tidak dobel
    var resultEl = $('report-result');
    if (resultEl) {
        var link = resultEl.querySelector('.report-track-link');
        if (link) link.remove();
        var acts = resultEl.querySelector('.report-confirm-actions');
        if (acts) acts.remove();
    }

    setReportType(currentReportType);
    modal.classList.add('open');

    // Tutup CS window
    csOpen = false;
    var win = $('cs-window');
    if (win) win.classList.remove('open');
}

function setReportType(type) {
    currentReportType = type;
    document.querySelectorAll('.report-type-tab').forEach(function(t){
        t.classList.toggle('active', t.getAttribute('data-type') === type);
    });
    if (type === 'bug') {
        safeText('report-title',  '🐛 LAPORAN BUG / ERROR');
        safeText('r-desc-label',  'DESKRIPSI BUG / ERROR *');
        safePH  ('r-desc',        'Ceritakan bug yang kamu temukan, langkah-langkahnya, dan apa yang terjadi...');
        safeText('r-submit',      '▶ KIRIM LAPORAN BUG');
    } else {
        safeText('report-title',  '💡 KIRIM SARAN');
        safeText('r-desc-label',  'ISI SARAN / MASUKAN *');
        safePH  ('r-desc',        'Tulis saran atau masukan kamu untuk game Nusabit Studio...');
        safeText('r-submit',      '▶ KIRIM SARAN');
    }
}

function bindReportModal() {
    // Semua addEventListener dengan null-safe
    safeOn('report-close', 'click', function(){
        safeClass('report-modal', 'remove', 'open');
    });

    var modal = $('report-modal');
    if (modal) {
        modal.addEventListener('click', function(e){
            if (e.target === this) this.classList.remove('open');
        });
    }

    document.querySelectorAll('.report-type-tab').forEach(function(tab){
        tab.addEventListener('click', function(){
            setReportType(this.getAttribute('data-type'));
        });
    });

    safeOn('r-submit', 'click', submitReport);
}

function submitReport() {
    var rDesc = $('r-desc');
    if (!rDesc) return;
    var desc    = rDesc.value.trim();
    var game    = safeVal('r-game');
    var contact = safeVal('r-contact').trim();
    var email   = safeVal('r-email').trim();
    var btn     = $('r-submit');

    if (!desc || desc.length < 10) {
        rDesc.focus();
        rDesc.style.borderColor = '#ff3c3c';
        setTimeout(function(){ rDesc.style.borderColor = ''; }, 2000);
        return;
    }

    var ticketId = 'GS-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
    if (btn) { btn.disabled = true; btn.textContent = '▶ MENGIRIM...'; }

    var payload = {
        type:     currentReportType,
        game:     game,
        desc:     desc,
        contact:  contact,
        email:    email,
        ticketId: ticketId
    };

    // WAJIB: minta konfirmasi ulang sebelum kirim data apa pun ke admin/dev.
    pendingModalPayload = payload;
    showModalReportConfirm(payload);
}

function showModalReportConfirm(payload) {
    if (!payload) return;
    safeStyle('report-form', 'display', 'none');
    safeClass('report-result', 'add', 'show');

    safeText('r-result-icon', '❓');
    safeText('r-result-title', 'KONFIRMASI');

    var typeLabel = payload.type === 'bug' ? 'Bug/Error' : 'Saran';
    var html =
        'Sebelum dikirim ke admin/tim developer, mohon konfirmasi dulu ya.<br><br>' +
        '<b>Jenis:</b> ' + escHtml(typeLabel) + '<br>' +
        '<b>Game:</b> ' + escHtml(payload.game || '—') + '<br>' +
        '<b>Detail:</b><br>' + escHtml(payload.desc || '').replace(/\\n/g,'<br>') + '<br><br>' +
        '<b>Email:</b> ' + escHtml(payload.email || '—') + '<br>' +
        '<b>Kontak:</b> ' + escHtml(payload.contact || '—');
    safeHTML('r-result-msg', html);

    var resultEl = $('report-result');
    if (!resultEl) return;
    var actions = document.createElement('div');
    actions.className = 'report-confirm-actions';
    actions.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap;';
    actions.innerHTML =
        '<button type="button" class="btn-report-submit" id="r-confirm-send" style="min-width:160px;">✅ YA, KIRIM</button>' +
        '<button type="button" class="btn-report-submit" id="r-confirm-cancel" style="min-width:160px;background:transparent;border:1px solid rgba(255,255,255,.18);">✏️ BATAL / EDIT</button>';
    resultEl.appendChild(actions);

    var btnYes = $('r-confirm-send');
    var btnNo  = $('r-confirm-cancel');
    if (btnYes) btnYes.addEventListener('click', function(){ sendModalReportPayload(); });
    if (btnNo) btnNo.addEventListener('click', function(){
        pendingModalPayload = null;
        safeStyle('report-form', 'display', 'block');
        safeClass('report-result', 'remove', 'show');
        actions.remove();
        var btn = $('r-submit');
        if (btn) { btn.disabled = false; btn.textContent = currentReportType === 'bug' ? '▶ KIRIM LAPORAN BUG' : '▶ KIRIM SARAN'; }
    });
}

function sendModalReportPayload() {
    if (!pendingModalPayload || isSubmittingReport) return;
    isSubmittingReport = true;
    var payload = pendingModalPayload;
    var ticketId = payload.ticketId;
    var type = String(payload.type || currentReportType || 'saran');
    var game = payload.game || '';
    var desc = payload.desc || '';
    var contact = payload.contact || '';
    var email = payload.email || '';

    safeText('r-result-icon', '⏳');
    safeText('r-result-title', 'MENGIRIM...');
    safeText('r-result-msg', 'Sedang mengirim laporan. Tunggu sebentar ya.');

    fetch(REPORT_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
    })
    .then(function(r){ return r.json(); })
    .then(function(data) {
        saveReportLocal({
            id:      ticketId,
            type:    type,
            game:    game || 'Tidak disebutkan',
            desc:    desc,
            contact: contact,
            email:   email,
            summary: data.summary || desc,
            time:    new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
            done:    false
        });

        if (data.ok) {
            safeText('r-result-icon',  type === 'bug' ? '🐛✅' : '💡✅');
            safeText('r-result-title', type === 'bug' ? 'BUG DILAPORKAN!' : 'SARAN TERKIRIM!');
            var titleEl = $('r-result-title');
            if (titleEl) titleEl.style.color = type === 'bug' ? '#00ff41' : '#ffe600';
            safeText('r-result-msg', '✅ Laporan kamu sudah diteruskan ke admin/tim developer. Terima kasih!');

            var rtb = $('report-ticket-box');
            if (rtb) {
                rtb.style.display = 'flex';
                var numLabel = data.ticketNum ? '#' + data.ticketNum + ' — ' + ticketId : '#' + ticketId;
                safeText('report-ticket-num', numLabel);
            }

            // Tambahkan link tiket kalau ada
            if (data.ticketUrl) {
                var tUrl = data.ticketUrl.startsWith('http')
                    ? data.ticketUrl
                    : window.location.protocol + '//' + window.location.host + data.ticketUrl;
                var trackEl = document.createElement('a');
                trackEl.className = 'report-track-link';
                trackEl.href = tUrl;
                trackEl.target = '_blank';
                trackEl.style.cssText = 'display:block;margin-top:12px;text-align:center;color:#7c4dff;font-size:0.85rem;font-weight:700;text-decoration:none;';
                trackEl.textContent = '📋 Pantau Status Tiket →';
                var resultEl = $('report-result');
                if (resultEl) resultEl.appendChild(trackEl);
            }

            // Notifikasi juga di chat (biar konsisten dengan flow AI CS)
            appendMsg('bot', '✅ Laporan kamu sudah diteruskan ke admin/tim developer. Terima kasih ya!', timeStr());
        } else {
            safeText('r-result-icon',  '⚠️');
            safeText('r-result-title', 'GAGAL MENGIRIM');
            var titleEl2 = $('r-result-title');
            if (titleEl2) titleEl2.style.color = '#ff3c3c';
            safeText('r-result-msg', 'Coba lagi nanti, atau hubungi kami via Discord/Email.');
        }

        setTimeout(function(){ safeClass('report-modal', 'remove', 'open'); }, 3500);
        pendingModalPayload = null;
        isSubmittingReport = false;
    })
    .catch(function(err) {
        isSubmittingReport = false;
        pendingModalPayload = null;
        console.error('Report error:', err);
        saveReportLocal({
            id:      Date.now(),
            type:    type,
            game:    game || 'Tidak disebutkan',
            desc:    desc,
            contact: contact,
            summary: desc,
            time:    new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
            done:    false,
            offline: true
        });

        safeStyle('report-form', 'display', 'none');
        safeClass('report-result', 'add', 'show');
        safeText('r-result-icon',  '📦');
        safeText('r-result-title', 'LAPORAN TERSIMPAN');
        var titleEl3 = $('r-result-title');
        if (titleEl3) titleEl3.style.color = '#ffe600';
        safeText('r-result-msg', 'Laporan tersimpan lokal. Koneksi server bermasalah.');
        setTimeout(function(){ safeClass('report-modal', 'remove', 'open'); }, 3000);
    });
}

/* ══════════════════════════════════════════
   LOCAL REPORT STORAGE
══════════════════════════════════════════ */
function saveReportLocal(report) {
    try {
        var all = getReportsLocal();
        all.unshift(report);
        if (all.length > 100) all = all.slice(0, 100);
        localStorage.setItem(REPORT_STORE, JSON.stringify(all));
    } catch(e) { console.error('Save report local:', e); }
}

function getReportsLocal() {
    try { return JSON.parse(localStorage.getItem(REPORT_STORE)) || []; }
    catch(_) { return []; }
}

window.GS_Reports = {
    getAll:   getReportsLocal,
    markDone: function(id) {
        var all = getReportsLocal().map(function(r){ return r.id === id ? Object.assign({}, r, {done:true}) : r; });
        try { localStorage.setItem(REPORT_STORE, JSON.stringify(all)); } catch(e) {}
    },
    remove: function(id) {
        var all = getReportsLocal().filter(function(r){ return r.id !== id; });
        try { localStorage.setItem(REPORT_STORE, JSON.stringify(all)); } catch(e) {}
    }
};

/* expose global */
window.openReportModal = openReportModal;

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
function init() {
    try {
        buildHTML();
        bindToggle();
        buildQuickReplies();
        bindInput();
        bindReportModal();
        bindAIReportConfirmDelegation();
    } catch(e) {
        console.error('CS Widget init error:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

}());
