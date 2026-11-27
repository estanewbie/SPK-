# SPK - versi multi-file (Google Apps Script)

Kode di semua file dipindahkan APA ADANYA dari file lama (tidak ada logika yang diubah).

## Alur muat
doGet -> Loading.html (ringan) -> getMainAppHtml() -> Index.html (+ semua include) -> document.write

## Pasang di Apps Script
1. Code.js        : ganti seluruh isi dengan Code.js di sini (sama dengan milik Anda, tidak diubah).
2. File HTML      : buat dengan nama sama, TANPA ekstensi: Loading, Index, Styles, Helpers, App, Sidebar,
                    LoginScreen, View_* dan Modal_*.
3. Deploy ulang   : Manage deployments > Edit > New version.

## Peta file
- Loading.html : layar loading awal (milik Anda)
- Index.html   : kerangka + urutan include (urutan penting, App terakhir)
- Styles.html  : seluruh CSS
- Helpers.html : helper umum (window.H) - belum dipakai, untuk refactor nanti
- App.html     : semua state & fungsi aksi + router menu + objek ctx
- LoginScreen / Sidebar
- View_*.html  : 1 file per menu   (window.Views.X)
- Modal_*.html : 1 file per modal  (window.Modals.X)

## Menambah variabel baru
Variabel/fungsi baru di App.html otomatis TIDAK ikut ke view. Tambahkan namanya ke objek `ctx` di App.html,
lalu masukkan ke destructuring `const { ... } = ctx;` di view yang memakainya.

## Menu KTK (Tahap 1)
File baru: Ktk.js, KtkSeed.js (backend, tambahkan sebagai file Script), View_Ktk.html (tampilan).
Diubah sedikit: Index.html (include View_Ktk), Sidebar.html (tombol KTK), App.html (router + judul header).
Langkah: 1) tambahkan Ktk.js, KtkSeed.js, View_Ktk.html  2) timpa Index/Sidebar/App.html
3) jalankan fungsi ktkSetup() SEKALI di editor  4) Deploy > New version.
Role yang boleh: Super Admin, Admin SPK, Admin PK (dicek di sidebar, view, dan server).

