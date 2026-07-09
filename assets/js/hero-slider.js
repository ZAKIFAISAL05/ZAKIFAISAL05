// Hero Slider Auto Rotator System
function renderHeroSlider() {
    const container = document.getElementById('hero-slider-container');
    const captionEl = document.getElementById('heroSliderCaption');

    // Validasi data game dari data.js
    if (!container || !siteData.games || siteData.games.length === 0) return;

    const featuredGames = siteData.games;

    // Render slide gambar awal
    let imgElements = '';
    featuredGames.forEach((img, idx) => {
        // Optimasi:
        // - `loading="lazy"` untuk slide selain pertama
        // - `decoding="async"` supaya decode tidak nge-block render
        // - `fetchpriority="high"` untuk gambar pertama (kalau browser support)
        const loading = idx === 0 ? 'eager' : 'lazy';
        const fetchPriority = idx === 0 ? 'high' : 'auto';
        imgElements += `<img src="${img.gambar}" alt="${img.judul}" class="slide-card card-hidden" loading="${loading}" decoding="async" fetchpriority="${fetchPriority}" onerror="this.src='https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800'">`;
    });
    container.innerHTML = imgElements;

    const slides = document.querySelectorAll('.slide-card');
    let currentIndex = 0;
    let autoSlideInterval;

    function updateCaption() {
        if (!captionEl) return;
        const title = (featuredGames[currentIndex] && featuredGames[currentIndex].judul) ? featuredGames[currentIndex].judul : '';
        captionEl.textContent = title || '—';
    }

    // Update class transformasi visual kartu slider
    function updateCards() {
        slides.forEach((slide, i) => {
            slide.className = 'slide-card';
            if (i === currentIndex) {
                slide.classList.add('card-front');
            } else if (i === (currentIndex + 1) % slides.length) {
                slide.classList.add('card-middle');
            } else if (i === (currentIndex + 2) % slides.length) {
                slide.classList.add('card-back');
            } else {
                slide.classList.add('card-hidden');
            }
        });
        updateCaption();
    }

    function nextSlide() {
        if (slides.length > 1) {
            currentIndex = (currentIndex + 1) % slides.length;
            updateCards();
        }
    }

    updateCards();

    // Jalankan interval pergantian otomatis tiap 4 detik
    if(slides.length > 1) {
        autoSlideInterval = setInterval(nextSlide, 4000);
        container.addEventListener('click', () => {
            clearInterval(autoSlideInterval);
            nextSlide();
            autoSlideInterval = setInterval(nextSlide, 4000);
        });
    }

    // Pause animasi saat tab tidak aktif (hemat CPU)
    document.addEventListener('visibilitychange', () => {
        if (!autoSlideInterval) return;
        if (document.hidden) {
            clearInterval(autoSlideInterval);
            autoSlideInterval = null;
            return;
        }
        autoSlideInterval = setInterval(nextSlide, 4000);
    });
}

// Inisialisasi (jangan pakai window.onload biar tidak niban script lain)
window.addEventListener('load', () => {
    // Biar render penting dulu (hero section), slider jalan setelahnya
    const run = () => {
        renderHeroSlider();

        // Setel statistik awal jumlah total game di dalam data.js
        const gameCountStat = document.getElementById('gameCountStat');
        if (gameCountStat && siteData.games) {
            gameCountStat.innerText = siteData.games.length;
        }
    };

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(run, { timeout: 800 });
    } else {
        setTimeout(run, 0);
    }
});
