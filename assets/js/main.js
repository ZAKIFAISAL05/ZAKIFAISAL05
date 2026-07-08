// assets/js/main.js
// Nusabit Studio — Main Script

(function () {
    'use strict';

    // ────────────────────────────────────────────────
    // HOMEPAGE GAME CATALOG (DYNAMIC RENDER)
    // Sumber data:
    // - `window.NUSABIT_GAMES` (format baru: downloadLinks, image, icon, tags, dll)
    // - fallback: `window.gameData` / `gameData` (format lama: platforms, thumb, logo, dll)
    // ────────────────────────────────────────────────
    function _cleanUrl(url) {
        // Kadang data disimpan pakai backtick (`...`) seperti contoh user
        return String(url || '').trim().replace(/^`|`$/g, '');
    }

    function _guessPlatformCls(url, key) {
        const u = String(url || '').toLowerCase();
        const k = String(key || '').toLowerCase();
        if (u.includes('roblox.com')) return 'btn-roblox';
        if (u.includes('amazon.')) return 'btn-amazon';
        if (u.includes('itch.io')) return 'btn-itchio';
        if (u.includes('taptap')) return 'btn-taptap';
        if (u.includes('play.google.com') || k === 'android') return 'btn-taptap';
        return 'btn-platform-generic';
    }

    function _platformLabelFromKey(key) {
        const k = String(key || '').toLowerCase();
        if (k === 'android') return 'Google Play (Android)';
        if (k === 'ios') return 'App Store (iOS)';
        if (k === 'windows') return 'Windows';
        if (k === 'roblox') return 'Play on Roblox';
        return key || 'Download';
    }

    function _buildPlatformsFromDownloadLinks(downloadLinks) {
        const links = downloadLinks && typeof downloadLinks === 'object' ? downloadLinks : {};
        const out = [];
        Object.keys(links).forEach(function (key) {
            const url = _cleanUrl(links[key]);
            if (!url || url === '#' || url === 'null' || url === 'undefined') return;
            out.push({
                name: _platformLabelFromKey(key),
                url: url,
                cls: _guessPlatformCls(url, key)
            });
        });
        return out;
    }

    function _toCardDesc(text) {
        const t = String(text || '').trim();
        if (!t) return '';
        if (t.length <= 110) return t;
        return t.slice(0, 107).trim() + '...';
    }

    function _guessCategoryFromGenre(genreText) {
        const g = String(genreText || '').toLowerCase();
        const known = ['arcade', 'action', 'simulation', 'platformer', 'roblox'];
        for (let i = 0; i < known.length; i++) {
            if (g.includes(known[i])) return known[i];
        }
        return '';
    }

    function _normalizeGame(raw) {
        if (!raw) return null;

        // Format baru (NUSABIT_GAMES)
        const hasNewShape = raw.downloadLinks || raw.image || raw.icon || raw.tags || raw.descriptionId;
        if (hasNewShape) {
            const id = raw.id || '';
            const title = raw.title || id;
            const genreText = raw.genre || raw.category || 'Other';
            const platforms = _buildPlatformsFromDownloadLinks(raw.downloadLinks);
            const thumb = raw.image || raw.thumb || raw.logo || 'assets/img/studio_logo.png';
            const logo = raw.icon || raw.logo || thumb;
            const desc = raw.description || raw.desc || '';
            const tags = raw.tags || '';

            const isRoblox = (raw.category && String(raw.category).toLowerCase().includes('roblox'))
                || (String(raw.genre || '').toLowerCase().includes('roblox'))
                || platforms.some(p => String(p.cls).includes('roblox'));

            return {
                id,
                title,
                logo,
                thumb,
                desc,
                genre: genreText,
                developer: raw.developer || 'Nusabit Studio',
                gallery: Array.isArray(raw.gallery) && raw.gallery.length ? raw.gallery : [thumb],
                platforms: platforms,
                // untuk filter homepage
                _filterGenre: (isRoblox ? 'roblox ' : '') + String(genreText || ''),
                _filterCategory: raw.category || '',
                _filterTags: String(tags || '')
            };
        }

        // Format lama (gameData.js existing)
        const id = raw.id || '';
        const title = raw.title || id;
        const genreText = raw.genre || 'Other';
        const platforms = Array.isArray(raw.platforms) ? raw.platforms : [];
        const isRoblox = platforms.some(p => String(p.cls || '').includes('roblox')) || String(id).includes('roblox');
        const cat = _guessCategoryFromGenre(genreText) || (isRoblox ? 'roblox' : '');

        return {
            id,
            title,
            logo: raw.logo || raw.icon || 'assets/img/studio_logo.png',
            thumb: raw.thumb || raw.image || raw.logo || 'assets/img/studio_logo.png',
            desc: raw.desc || raw.description || '',
            genre: genreText,
            developer: raw.developer || 'Nusabit Studio',
            gallery: Array.isArray(raw.gallery) && raw.gallery.length ? raw.gallery : [raw.thumb || raw.logo || 'assets/img/studio_logo.png'],
            platforms: platforms,
            _filterGenre: (isRoblox ? 'roblox ' : '') + String(genreText || ''),
            _filterCategory: cat,
            _filterTags: (title + ' ' + genreText + ' ' + (isRoblox ? 'roblox' : '')).trim()
        };
    }

    const __RAW_CATALOG__ = (window.NUSABIT_GAMES && Array.isArray(window.NUSABIT_GAMES))
        ? window.NUSABIT_GAMES
        : (typeof window.getGameCatalog === 'function')
            ? window.getGameCatalog()
        : (window.gameData && Array.isArray(window.gameData))
            ? window.gameData
            : (typeof gameData !== 'undefined' && Array.isArray(gameData))
                ? gameData
                : [];

    const CATALOG = __RAW_CATALOG__.map(_normalizeGame).filter(Boolean);

    function _getGameUrl(id) {
        if (typeof window.buildGameUrl === 'function') {
            return window.buildGameUrl(id);
        }
        return '/game/?id=' + encodeURIComponent(id);
    }

    function renderHomepageGames() {
        const grid = document.getElementById('games-grid') || document.querySelector('.games-grid');
        if (!grid) return;

        grid.innerHTML = '';

        CATALOG.forEach(function (g) {
            const card = document.createElement('a');
            card.className = 'game-card';
            card.href = _getGameUrl(g.id);
            card.setAttribute('data-game-id', g.id);
            card.setAttribute('data-genre', String(g._filterGenre || g.genre || '').toLowerCase());
            if (g._filterCategory) card.setAttribute('data-category', String(g._filterCategory).toLowerCase());
            if (g._filterTags) card.setAttribute('data-tags', String(g._filterTags).toLowerCase());
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', g.title);

            card.innerHTML = `
                <div class="game-image-wrapper">
                    <img
                        src="${g.thumb}"
                        alt="${g.title}"
                        class="game-image"
                        loading="lazy"
                    />
                </div>
                <div class="game-info">
                    <h3 class="game-title">${g.title}</h3>
                    <p class="game-description">${_toCardDesc(g.desc) || ''}</p>
                    <p class="game-dev">Dev: ${g.developer || 'Nusabit Studio'} | Genre: ${g.genre || '-'}</p>
                </div>
            `;

            grid.appendChild(card);
        });
    }

    // Render dulu agar script lain (filter, animasi, observer) bekerja pada DOM final
    renderHomepageGames();

    // ────────────────────────────────────────────────
    // ELEMENTS
    // ────────────────────────────────────────────────
    const heroSection      = document.getElementById('hero');
    const menuOverlay      = document.getElementById('menuOverlay');
    const menuButton       = document.getElementById('menuButton');
    const menuCloseBtn     = document.querySelector('.menu-close-btn');
    const menuLinks        = document.querySelectorAll('.menu-links a');
    const modal            = document.getElementById('gameModal');
    const closeModalBtn    = document.getElementById('closeModalBtn');
    const prevSlide        = document.getElementById('prevSlide');
    const nextSlide        = document.getElementById('nextSlide');
    const typingEl         = document.getElementById('typing-text');
    const cursorEl         = document.querySelector('.cursor');
    const heroTitle        = document.querySelector('.hero-title');
    const primaryBtn       = document.querySelector('.btn-primary-scroll');

    let currentSlide = 0;

    // ────────────────────────────────────────────────
    // UTILITY
    // ────────────────────────────────────────────────
    const lockScroll  = () => document.body.classList.add('modal-open');
    const unlockScroll = () => document.body.classList.remove('modal-open');

    // ────────────────────────────────────────────────
    // HERO FADE-IN
    // ────────────────────────────────────────────────
    if (heroSection) {
        setTimeout(() => heroSection.classList.add('loaded'), 100);
    }

    // ────────────────────────────────────────────────
    // HERO TAGLINE (sinkron dengan pilihan bahasa)
    // ────────────────────────────────────────────────
    const HERO_TAGLINES = {
        id: 'Studio pengembangan game indie, berkomitmen pada kualitas dan gameplay. Fokus pada Survival, RPG, dan Strategy dengan sentuhan cerita yang memikat.',
        en: 'An indie game development studio committed to quality and gameplay. Focused on Survival, RPG, and Strategy with immersive storytelling.'
    };

    function renderHeroTagline(lang) {
        if (!typingEl) return;
        typingEl.textContent = HERO_TAGLINES[lang] || HERO_TAGLINES.id;
        if (cursorEl) cursorEl.style.display = 'none';
        if (heroTitle) heroTitle.classList.add('fade-loop');
        if (primaryBtn) primaryBtn.classList.add('fade-loop');
    }

    setTimeout(() => {
        renderHeroTagline(localStorage.getItem('gs_lang') || 'id');
    }, 300);

    document.addEventListener('gs:lang-changed', function (event) {
        renderHeroTagline(event && event.detail ? event.detail.lang : (localStorage.getItem('gs_lang') || 'id'));
    });

    // ────────────────────────────────────────────────
    // HAMBURGER MENU
    // ────────────────────────────────────────────────
    const closeMenu = () => {
        if (!menuOverlay) return;
        menuOverlay.classList.remove('open');
        unlockScroll();
    };

    if (menuButton && menuOverlay) menuButton.addEventListener('click', () => {
        menuOverlay.classList.add('open');
        lockScroll();
    });
    if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenu);
    menuLinks.forEach(l => l.addEventListener('click', closeMenu));
    if (menuOverlay) menuOverlay.addEventListener('click', e => {
        if (e.target === menuOverlay) closeMenu();
    });

    // ────────────────────────────────────────────────
    // SMOOTH SCROLL
    // ────────────────────────────────────────────────
    if (primaryBtn) {
        primaryBtn.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(primaryBtn.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // ────────────────────────────────────────────────
    // GALLERY SLIDER
    // ────────────────────────────────────────────────
    const showSlide = (index) => {
        const slidesWrap = document.getElementById('gallery-slides');
        const slides = document.querySelectorAll('#gallery-slides .gallery-slide');
        const dots   = document.querySelectorAll('#gallery-dots .gallery-dot');
        if (!slides.length || !slidesWrap) return;

        currentSlide = (index + slides.length) % slides.length;
        slidesWrap.style.transform = `translateX(${-currentSlide * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
    };

    const renderGallery = (game, screenshots) => {
        const slidesEl = document.getElementById('gallery-slides');
        const dotsEl   = document.getElementById('gallery-dots');
        if (!slidesEl || !dotsEl) return;
        slidesEl.innerHTML = '';
        dotsEl.innerHTML   = '';

        screenshots.forEach((src, i) => {
            const slide = document.createElement('div');
            slide.className = 'gallery-slide';
            slide.innerHTML = `<img src="${src}" alt="${game.title} Screenshot ${i + 1}" loading="lazy">`;
            slidesEl.appendChild(slide);

            const dot = document.createElement('span');
            dot.className = 'gallery-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => showSlide(i));
            dotsEl.appendChild(dot);
        });

        showSlide(0);
    };

    if (prevSlide) prevSlide.addEventListener('click', () => showSlide(currentSlide - 1));
    if (nextSlide) nextSlide.addEventListener('click', () => showSlide(currentSlide + 1));

    // ────────────────────────────────────────────────
    // PLATFORM BUTTONS
    // ────────────────────────────────────────────────
    const renderPlatformButtons = (platforms) => {
        const container = document.getElementById('platform-buttons');
        if (!container) return;
        container.innerHTML = '';

        platforms.forEach(p => {
            const btn = document.createElement('a');
            btn.href    = p.url;
            btn.target  = '_blank';
            btn.rel     = 'noopener noreferrer';
            btn.className = `btn-platform ${p.cls}`;
            btn.textContent = p.name.toLowerCase().startsWith('play')
                ? p.name.toUpperCase()
                : `DOWNLOAD — ${p.name.toUpperCase()}`;
            container.appendChild(btn);
        });
    };

    // ────────────────────────────────────────────────
    // OTHER GAMES
    // ────────────────────────────────────────────────
    const renderOtherGames = (currentId) => {
        const grid      = document.getElementById('other-games-grid');
        const container = document.getElementById('other-games-container');
        if (!grid || !container) return;
        const others    = CATALOG.filter(g => g.id !== currentId);

        grid.innerHTML = '';
        container.style.display = others.length ? 'block' : 'none';

        // Shuffle
        const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);

        shuffled.forEach(game => {
            const card = document.createElement('div');
            card.className = 'other-game-card';
            card.setAttribute('data-game-id', game.id);
            card.innerHTML = `
                <div class="game-image-wrapper">
                    <img src="${game.thumb}" alt="${game.title}" class="game-image" loading="lazy">
                </div>
                <div class="game-info" style="padding:10px;">
                    <h3 class="game-title" style="font-size:.85rem;">${game.title}</h3>
                </div>`;
            card.addEventListener('click', () => {
                showGameDetails(game.id);
                modal.scrollTo(0, 0);
            });
            grid.appendChild(card);
        });
    };

    // ────────────────────────────────────────────────
    // TAB SWITCHING
    // ────────────────────────────────────────────────
    const switchTab = (tabName) => {
        document.querySelectorAll('.modal-tab').forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
            t.setAttribute('aria-selected', t.getAttribute('data-tab') === tabName);
        });
        document.querySelectorAll('.modal-tab-content').forEach(c => {
            c.classList.toggle('active', c.id === `tab-${tabName}`);
        });
    };

    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });

    // ────────────────────────────────────────────────
    // SHOW GAME MODAL
    // ────────────────────────────────────────────────
    function showGameDetails(gameId) {
        const game = CATALOG.find(g => g.id === gameId);
        if (!game || !modal) return;

        const modalLogo = document.getElementById('modal-logo');
        const modalTitle = document.getElementById('modal-title');
        const modalDescription = document.getElementById('modal-description');
        if (!modalLogo || !modalTitle || !modalDescription) return;

        currentSlide = 0;
        modalLogo.src = game.logo;
        modalTitle.textContent = game.title;
        modalDescription.textContent = game.desc;

        const genreBadge = document.getElementById('modal-genre-badge');
        const genreText  = document.getElementById('modal-genre-text');
        if (genreBadge) genreBadge.textContent = game.genre || '';
        if (genreText)  genreText.textContent  = game.genre || '-';

        const devEl = document.getElementById('modal-developer');
        if (devEl) devEl.textContent = game.developer || 'Nusabit Studio';

        renderGallery(game, game.gallery);
        renderPlatformButtons(game.platforms);
        renderOtherGames(gameId);

        // Always open on INFO tab
        switchTab('info');

        modal.classList.add('active');
        lockScroll();
        modal.scrollTo(0, 0);
    }

    // ────────────────────────────────────────────────
    // HOMEPAGE CARD ACTIONS
    // Klik card → buka modal (kalau modal ada). Tetap ada href sebagai fallback.
    // ────────────────────────────────────────────────
    function bindHomepageCardActions() {
        if (!modal) return;
        document.querySelectorAll('.game-card').forEach(function (card) {
            if (card.dataset.boundClick) return;
            card.dataset.boundClick = '1';
            card.addEventListener('click', function (e) {
                const id = card.getAttribute('data-game-id');
                if (!id) return;
                e.preventDefault();
                showGameDetails(id);
            });
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    const id = card.getAttribute('data-game-id');
                    if (!id) return;
                    e.preventDefault();
                    showGameDetails(id);
                }
            });
        });
    }

    bindHomepageCardActions();

    // ────────────────────────────────────────────────
    // LEGACY LOCALSTORAGE GUARD
    // Sinkronisasi hapus game via localStorage lama dinonaktifkan
    // karena bisa membuat game bawaan ikut hilang dari homepage
    // saat data browser lama / korup masih tersimpan.
    // Sumber katalog utama sekarang dari file + backend.
    // ────────────────────────────────────────────────
    (function normalizeLegacyHiddenCards() {
        document.querySelectorAll('.game-card').forEach(function(card) {
            if (card.style.display === 'none') card.style.display = '';
        });
    })();

    // Cards are now <a> links — no click listener needed
    // (onclick modal removed; each card links to its dedicated page)

    // Close modal
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        unlockScroll();
    });
    if (modal) modal.addEventListener('click', e => {
        if (e.target === modal) {
            modal.classList.remove('active');
            unlockScroll();
        }
    });
    document.addEventListener('keydown', e => {
        if (modal && e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
            unlockScroll();
        }
    });

    // ────────────────────────────────────────────────
    // SCROLL FADE-IN (IntersectionObserver)
    // ────────────────────────────────────────────────
    const observer = new IntersectionObserver(
        (entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('show');
                    obs.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1 }
    );

    document.querySelectorAll('.scroll-animate').forEach((el, i) => {
        el.style.transitionDelay = `${i * 0.08}s`;
        observer.observe(el);
    });

    // Mark section headers + cards for animation
    const sectionTitle = document.querySelector('#games .section-header-title');
    if (sectionTitle) {
        sectionTitle.classList.add('scroll-animate');
        observer.observe(sectionTitle);
    }

    document.querySelectorAll('.game-card').forEach((card, i) => {
        card.classList.add('scroll-animate');
        card.style.transitionDelay = `${i * 0.1}s`;
        observer.observe(card);
    });

})();
