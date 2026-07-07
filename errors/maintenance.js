// ============================================================
//  maintenance.js
//  Logika Deteksi API & Animasi Efek Transition Nusabit
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  // 1. Render Feather Icons Bawaan
  try {
    feather.replace();
  } catch (e) {
    console.error("Gagal memuat feather icons:", e);
  }

  // 2. Event Tombol Cek Lagi / Refresh Manual dengan Animasi Putar
  const refreshBtn = document.getElementById("btn-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      const icon = refreshBtn.querySelector(".feather-refresh-cw");
      if (icon) {
        icon.style.transition = "transform 0.5s ease";
        icon.style.transform = "rotate(360deg)";
      }
      
      // Beri sedikit jeda animasi putar sebelum reload manual dijalankan
      setTimeout(function () {
        location.reload();
      }, 400);
    });
  }

  // 3. Pengecekan Status API Netlify secara berkala & Animasi Fade-Out
  const SETTINGS_API = "/.netlify/functions/site-settings";
  const containerWrapper = document.getElementById("maintenance-wrapper");
  let checkingInterval;

  // Fade-in halus saat halaman siap (biar masuknya tidak patah)
  if (containerWrapper) {
    requestAnimationFrame(function () {
      containerWrapper.classList.add("is-ready");
    });
  }

  function checkMaintenanceStatus() {
    fetch(SETTINGS_API, { method: "GET", cache: "no-store" })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        // Ambil data status maintenance dari server backend
        const isMaintenanceEnabled = !!(
          data &&
          data.ok &&
          data.settings &&
          data.settings.maintenance &&
          data.settings.maintenance.enabled
        );

        // KONDISI 1: JIKA SERVER SUDAH ONLINE (Maintenance di-OFF-kan dari server)
        if (!isMaintenanceEnabled) {
          clearInterval(checkingInterval); // Hentikan auto-cek karena sudah online
          
          if (containerWrapper) {
            // Pasang class CSS fade-out untuk memicu transisi smooth menghilang (0.8 detik)
            containerWrapper.classList.add("fade-out");
            
            // Tunggu animasi transisi CSS selesai, baru kembalikan user ke home utama
            setTimeout(function () {
              window.location.replace("/");
            }, 800);
          } else {
            window.location.replace("/");
          }
        }
        // KONDISI 2: JIKA SERVER MASIH OFF (Maintenance masih ON)
        else {
          console.log("Server masih dalam perbaikan. Tetap di halaman maintenance...");
          // Di sini script sengaja diam (tidak reload layar) supaya tampilan tidak berkedip hitam/putih
        }
      })
      .catch(function (error) {
        // Jika server mati total/error jaringan, biarkan tetap berada di halaman maintenance
        console.log("Menunggu koneksi server kembali stabil...");
      });
  }

  // Jalankan cek status pertama kali saat halaman dibuka
  checkMaintenanceStatus();

  // 🔄 AUTO-REFRESH DIAGNOSTIK DI BALIK LAYAR
  // Disetel ke 5000 (Artinya sistem otomatis nge-cek ke server setiap 5 detik sekali)
  checkingInterval = setInterval(checkMaintenanceStatus, 5000);
});
