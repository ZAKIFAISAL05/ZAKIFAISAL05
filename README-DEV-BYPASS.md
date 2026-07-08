# Setup Developer Key / Bypass Mode

## File yang sudah diubah

- `assets/js/site-guard.js`
- `errors/maintenance.html`
- `errors/maintenance.js`
- `admin/admin.html`
- `admin/script.js`

## Penyebab CSS / JS maintenance sebelumnya rusak

Halaman maintenance dibuka lewat URL `/maintenance`, tetapi file `errors/maintenance.html` sebelumnya memanggil:

- `maintenance.css`
- `maintenance.js`

dengan path relatif. Akibatnya browser mencoba membuka:

- `/maintenance.css`
- `/maintenance.js`

bukan:

- `/errors/maintenance.css`
- `/errors/maintenance.js`

Sekarang path tersebut sudah diperbaiki menjadi absolute path.

## Cara mengaktifkan Developer Key (versi token acak otomatis)

Sistem ini tidak butuh SHA-256 di frontend. Token bypass dibuat otomatis dari server saat admin menekan tombol di panel admin.

Endpoint baru:

- `/.netlify/functions/dev-bypass`

Cara pakai:

1. Login ke `/admin`
2. Di blok `Website status` klik `Aktifkan Mode Testing`
3. Token acak otomatis akan:
   - dibuat oleh server
   - disimpan ke `localStorage` browser admin
   - otomatis di-copy ke clipboard (jika izin browser mengizinkan)
4. Untuk menonaktifkan, klik `Matikan Mode Testing` (token dihapus dari browser dan dicabut dari server)

## Cara pakai

### Dari panel admin

- Login ke `/admin`
- Buka blok `Website status`
- Klik `Aktifkan Mode Testing`

Ini akan menyimpan token bypass ke `localStorage` browser admin tersebut.

### Copy token

Di panel admin ada tombol `Copy` untuk menyalin token yang tersimpan di browser saat ini.

## Catatan keamanan

- Jangan gunakan kunci pendek atau mudah ditebak.
- Pakai string panjang acak minimal 32 karakter.
- Token bypass ini divalidasi ke server (`dev-bypass` function), jadi tidak cukup hanya “set localStorage” saja.
- Kalau token bocor, klik `Matikan Mode Testing` untuk mencabut token dari server, atau tunggu token expired.
