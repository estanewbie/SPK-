# Standar desain aplikasi (disetujui)

Berlaku untuk SEMUA menu. KTK adalah implementasi acuan pertama (`View_Ktk.html`, `Sidebar.html`).
Mock up persetujuan: artifact "Mock up KTK" (papan A, B, C). Bila ragu, ikuti dokumen ini.

## Prinsip
1. **Satu menu menyelesaikan masalahnya sendiri.** User tidak boleh dipaksa pindah menu untuk menyelesaikan satu pekerjaan
   (koreksi data, tambah, cek, hitung, cetak/export dilakukan di dalam menu yang sama). Bila butuh data menu lain, tampilkan
   dan ubah di tempat (panel geser, baris yang bisa dibuka), jangan arahkan user pergi.
2. **Bersih, modern, terasa dibuat manusia.** Latar krem hangat, garis tipis, sedikit kotak, bahasa sehari-hari.
3. **Lebar.** Isi sampai 1.560 px. Jangan menjejalkan tiga panel permanen.
4. **Hierarki lewat ukuran dan warna, bukan lewat ketebalan.**

## Huruf
Font: **Source Sans 3** (Google Fonts), hanya bobot 400 dan 500. Angka memakai `font-variant-numeric: tabular-nums`.

| Nama | Ukuran / tinggi baris | Bobot | Dipakai untuk |
|---|---|---|---|
| Angka besar | 28 / 36 | 400, biru tinta | total nilai, angka ringkasan |
| Judul halaman | 22 / 30 | 500 | satu per halaman |
| Judul bagian | 16 / 24 | 500 | ringkasan, daftar |
| Judul baris | 14 / 20 | 500 | nama paket, nama PK |
| Isi dan tabel | 13 / 20 | 400 | teks umum, sel tabel, tombol |
| Keterangan | 12 / 18 | 400, redup | penjelasan, judul kolom |
| Label kecil | 11 / 16 | 400, redup | catatan kaki |

Aturan keras:
- TIDAK ADA huruf tebal (bold/extrabold/semibold dipetakan ke 500 secara global).
- TIDAK ADA huruf kapital semua dan TIDAK ADA `uppercase` / `letter-spacing` lebar. Hanya huruf pertama kalimat yang kapital,
  plus nama dan singkatan (PLN, SUTM, UP3, kVA). Data berhuruf besar dari spreadsheet diubah ke huruf kecil saat tampil
  (`sentence()` di View_Ktk.html), data di Sheet tidak diubah.
- Tidak ada teks di bawah 11 px.
- Angka rata kanan, dua desimal, titik ribuan, koma desimal.

## Warna
| Nama | Hex | Pakai |
|---|---|---|
| Kertas | #FAF9F6 | latar halaman |
| Permukaan | #FFFFFF | panel, tabel |
| Garis | #E8E4DC | pemisah (hairline: #F0ECE4) |
| Teks | #23211E | teks utama |
| Teks redup | #6B665E | keterangan |
| Biru tinta | #1F3A6E | tombol utama, tautan, angka besar |
| Magenta logo | #E11D48 | HANYA logo "N" (ciri khas), bukan tombol/status |
| Merah galat | #B42318 | masalah, melebihi |
| Kuning | #C77700 / #9A5B00 | draf, peringatan |
| Hijau | #1B7A3E | sesuai, berhasil |

Status memakai titik berwarna + kata ("● Draf"), bukan pil berhuruf kapital.

## Tata letak
- **Menu samping**: terang (putih), 208 px, bisa diciutkan jadi 64 px berisi ikon saja (tombol di bawah, status disimpan di
  browser). Saat ciut: judul grup jadi garis tipis, label hilang, badge jadi titik, nama muncul sebagai tooltip.
- **Header**: satu bilah tipis 44 px (breadcrumb kiri, sapaan "Selamat pagi, Nama" kanan). Judul halaman, status, dan total
  berada dalam satu blok ramping di atas isi, bukan kartu besar.
- Tab: teks biasa, aktif ditandai garis bawah biru tinta 2 px.
- Panel tambahan (detail, edit) berupa panel geser dari kanan, hanya muncul saat diminta.
- Tabel: baris 44 px, garis tipis, judul kolom 12 px redup (tanpa kapital), kolom isian memakai garis bawah.
- Sudut 8 px (panel 12 px), hampir tanpa bayangan; hanya panel melayang yang berbayang lembut.

## Bahasa
Kalimat sehari-hari: "Belum ada kontrak. Mulai dengan kontrak baru." Bukan "Data tidak ditemukan".

## Implementasi
- Token & aturan global: `Index.html` (konfigurasi Tailwind) dan `Styles.html` (override bobot/kapital/ukuran minimum, sehingga
  menu lama otomatis ikut aturan).
- Komponen bersama: `UiKit.html` (`window.UI`).
- Menu baru wajib memakai Source Sans 3, palet di atas, dan prinsip satu menu.

## Perubahan ukuran teks (terbaru)
Ukuran asli aplikasi dikecilkan: kecil -2 px, sedang -3 px, besar -4 px, batas bawah 10 px (aturan di 10_Styles.html). Dasar body 11 px. Isi aplikasi dibuat selebar layar (tanpa batas lebar).

## Tema terang lembut: biru, ungu, putih (terbaru, menggantikan krem dan biru tinta)
- Latar #F7F8FC, kartu putih, garis #E6E9F2, aksen biru #3A62B0 (hover #2F5399), logo N tetap merah magenta.
- C3 biru #3A62B0, C7 ungu #7E57C2, AGO biru keunguan #5A7FD0. Status: hijau #3C8A5E, kuning #B7791F, merah #B5524F, abu #8A93A3 (titik dan kata).
- Pola daftar (acuan: 31_View_AntreanPK.html): baris kartu tanpa geser samping, tab status di atas, kotak angka kecil + bar bersegmen untuk kelengkapan.
