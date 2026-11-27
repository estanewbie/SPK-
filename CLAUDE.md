# Proyek: Menu KTK dan Penagihan — Aplikasi LH (PT Nanda Nirwana Elektrik, Bali)

Baca HANDOFF.md dulu. Bahasa kerja: Indonesia.

Aturan penting
- Aplikasi asli = Google Apps Script (folder gas/): React 18 via Babel di browser, Tailwind, google.script.run.
  View ditulis sebagai window.Views.X = (ctx) => ...; sidebar memanggil setCurrentView('x'); router di App.html.
- Menu KTK hanya untuk role: Super Admin, Admin SPK, Admin PK (sheet Data_User).
- Rupiah: harga disimpan sebagai TEKS 10 desimal di Sheet. Hitung dengan BigInt (harga x1e10, volume x1e4,
  mul = (p*v + 5000n)/10000n), tampil 2 desimal (bulatkan half-up). Jangan pakai float.
- Jangan ubah file mockup/ kecuali diminta; itu acuan desain.
- Jangan edit sheet produksi langsung; pakai ktkSetup() untuk membuat sheet Ktk_*.
- TAMPILAN: ikuti gas/DESIGN.md (standar yang sudah disetujui user) untuk SEMUA menu: font Source Sans 3, hanya bobot 400/500,
  tanpa huruf kapital semua, menu samping terang yang bisa diciutkan, header ramping, logo "N" tetap merah magenta #E11D48.
  PRINSIP: satu menu menyelesaikan masalahnya sendiri, user tidak dipaksa pindah menu.
- Server (.js di Apps Script) TIDAK boleh memakai literal BigInt (0n, 5000n): parser Apps Script menolak. Hitungan BigInt hanya
  di browser (KtkMath.html). Satu nama dasar file per modul (jangan ada Code.gs dan Code.js bersamaan). Jalankan clasp dari folder gas.
