# Cache Buster + Netlify

File utama solusi ini:

- `cache-buster.js`
- `package.json`
- `netlify.toml`

## Cara menaruh file

1. Simpan `cache-buster.js` di root proyek, sejajar dengan `package.json` dan `netlify.toml`.
2. Tambahkan script `cache:bust` dan ubah script `build` di `package.json`.
3. Pastikan `netlify.toml` punya header `Cache-Control = "public, max-age=0, must-revalidate"` untuk `/*`, `/assets/css/*`, dan `/assets/js/*`.
4. Jalankan build seperti biasa dengan `npm run build`.

## Cara kerja

- `cache-buster.js` membaca semua file `.html`.
- Script mendeteksi `<link rel="stylesheet">` dan `<script src="...">`.
- Semua asset lokal `.css` dan `.js` otomatis diberi atau diperbarui parameter `?v=HASH`.
- Hash dihitung dari isi file asset, jadi versi berubah otomatis saat file CSS/JS diubah.
- Asset eksternal seperti CDN tidak diubah.

## Contoh hasil

Sebelum:

```html
<link rel="stylesheet" href="assets/css/style.css" />
<script src="assets/js/main.js"></script>
```

Sesudah:

```html
<link rel="stylesheet" href="assets/css/style.css?v=6a2f8c1b4e" />
<script src="assets/js/main.js?v=8d913af0c2"></script>
```

## Catatan penting

- Solusi ini mengubah file HTML secara langsung saat build dijalankan.
- Untuk situs statis Netlify seperti proyek ini, pendekatan ini aman dan sederhana.
- Header `must-revalidate` memaksa browser mengecek ulang ke server, sementara query `?v=` memastikan browser mengambil asset terbaru saat isi CSS/JS berubah.
