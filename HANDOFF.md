# Handoff: Menu KTK dan Penagihan

## Tujuan
Menu baru di aplikasi GAS "Sistem Manajemen SPK" untuk (1) KTK = Kerja Tambah Kurang, jenis pekerjaan 71
(jenis 62 belum didefinisikan), dan (2) Penagihan. Hanya Super Admin / Admin SPK / Admin PK.
Gaya visual: aplikasi gudang, hijau diganti biru tua #0F2E66. Font Plus Jakarta Sans, tipografi kecil (11-12px), layar lebar.
Pengguna ingin SEMUA dikerjakan di dalam aplikasi sendiri (tanpa pindah halaman/aplikasi), datanya di Google Sheet.

## Konsep paket
- Template paket = daftar nama material + harga dari Master_Data. TANPA volume dan TANPA realisasi.
- Dipakai di kontrak: nama boleh diganti/diketik agar cocok dengan kontrak PLN; volume diisi hanya di kontrak.
- Material diganti lewat dropdown/picker dari Master_Data.
- Harga bisa diedit langsung. Idle tampil 2 desimal (",00"); saat diklik tampil penuh (mis. 7.340,024398).
- Harga kontrak = snapshot saat template dipakai (ASUMSI, belum dikonfirmasi).
- 25 paket, 396 item di data/pk.json (item: ['item',no,nama,sat,vol,pm,pj,row]; ['sub',nama]).
- Materi harga: pm = harga material, pj = harga jasa.

## Angka acuan kontrak 0597 (harus cocok persis)
Material 67.895.763,26 | Jasa 158.405.451,77 | Jumlah 226.301.215,03 | DPP (x11/12) 207.442.780,45 |
PPN 12% dari DPP 24.893.133,65 | Jumlah+PPN 251.194.348,69 | Dibulatkan 251.194.349 |
Nilai amandemen (realisasi) 16.365.302 | Rekap RAB 484.820.137.
Rumus: DPP=round(jum*11/12), PPN=round(DPP*12/100), gross=jum+PPN, bulat=round(gross).
Menjumlah nilai baris yang sudah dibulatkan 2 desimal selisih 0,08 dari jumlah eksak -> hitung eksak, bulatkan di akhir.

## Desain (folder mockup/, file .dc.html)
Format .dc.html butuh runtime khusus kanvas Claude (support.js) dan TIDAK bisa dibuka langsung di browser.
Pakai sebagai referensi: struktur HTML, warna, tata letak, dan logika di <script data-dc-script> (renderVals, helper BigInt).
Layar: KtkDaftar, KtkInput (Volume kontrak), KtkPaket (Template paket), KtkLampiran, KtkCek, KtkRab, KtkRekap,
KtkExport, Main + Rancang (Penagihan), Sidebar (komponen). Alternatif B: KtkAlt (KTK gaya Excel), PenagihanAlt (kanban).
KTK saat ini terpecah di 8 layar; pengguna ingin SATU halaman kerja per kontrak:
kiri outline paket, tengah tabel gaya Excel (nama, VOL, harga editable), kanan inspector + cek Master_Data,
tab dalam halaman: Lampiran / Cek LH per PK / RAB / Rekap. Template = tombol "Ambil dari template" di halaman itu.
(Bentuk satu-halaman ini baru diusulkan; belum digambar dan belum disetujui.)

## Backend (folder gas/)
Tahap 1 sudah ada: Ktk.gs (ktkSetup, ktkList, ktkLoad, ktkCreate, ktkSave, ktkHitung_, ktkAuth_),
KtkSeed.gs (25 paket), View_Ktk.html (masih UI paket LAMA, perlu disesuaikan dengan desain akhir), dan patch
Index.html / Sidebar.html / App.html. README.md = cara pasang.
Sheet baru: Ktk_Kontrak [ID_KTK,Jenis,No_Kontrak,Nama_Kontrak,Vendor,ID_SPK,Status,Dibuat_Oleh,Diubah];
Ktk_Paket [ID_Paket,ID_KTK,Urutan,Nama_Paket,Dipakai,Kustom]; Ktk_Item [ID_Paket,Urutan,Tipe,Nama,Satuan,Volume,Harga_Material,Harga_Jasa].
Template memakai ID_KTK "TPL-71". Kolom harga/volume simpan sebagai teks.
Sumber data: Master_Data (ID_Item,Tipe,Nama_Item,Satuan,Harga,HARGA JASA,HARGA BONGKAR); Data_LH.Data_JSON
(uraianPasang/uraianBongkar: id,nama,satuan,jumlah,pln,pemb,harga,catatan; materialMdu, returBekas, returBaru).

## Temuan data
- Master_Data punya 3 kolom harga + baris "Bongkar ..." terpisah; pengguna sempat menyebut hanya kolom E/F. PERLU DIKONFIRMASI.
- Dari 195 nama material di kontrak 0597, 176 baris tidak cocok persis dengan Master_Data (lihat data/Cek_Nama_Material_LH_vs_Master.xlsx).
  Pola: spasi pada ukuran, "Penomoran/Penomeran", nama LH lebih panjang, item tak ada di master (trafo 100/160/250 kVA, Heat Shrink).
- 95 nama material punya lebih dari satu pasang harga (pasang vs bongkar).

## Pertanyaan terbuka
1. Struktur harga Master_Data & penamaan varian pasang/bongkar.
2. Harga kontrak snapshot atau ikut update Master_Data?
3. pln = volume PLN, pemb = volume pembangunan?
4. Konsep KTK 62.
5. Empat bug lama frontend GAS: nominalTerpakai TDZ di View_SpkList; userRole tak terdeklarasi di handleKunciDB;
   setQueriedPks tak ada di View_AntreanPK; ID_SPK vs id di handleCreateSpk. Dan celah backend: terbitkanRAB,
   updatePkStatus tidak ada, queryDataPks duplikat. Perilaku terbitkanRAB belum ditentukan.

## Langkah berikut
1. Gambar/setujui halaman kerja KTK satu halaman.
2. Ubah gas/View_Ktk.html: template + paket kontrak, picker Master_Data, nama & harga editable, matematika BigInt.
3. Lanjut tahap: Lampiran + Cek LH, RAB/Rekap, Export Excel (ROUND(...;10)), Penagihan.

## Status terbaru (standar desain + menu KTK satu menu)
- Standar tampilan disetujui: lihat DESIGN.md (Source Sans 3, bobot 400/500, tanpa kapital semua, menu samping terang yang bisa
  diciutkan, header ramping, logo N tetap merah magenta). Komponen bersama: UiKit.html (window.UI). Aturan global di Index.html/Styles.html.
- View_Ktk.html: satu menu dengan 4 tab (Lampiran, Cek LH per PK, RAB, Rekapitulasi). Di tab Cek: koreksi volume LH di tempat
  (updateLhInSheet) dan "Tambah ke kontrak" (kerja tambah; paket "Kerja tambah"). Pasang dan bongkar dipisah saat mencocokkan nama.
- Belum: Export Excel, Penagihan, KTK 62, tanda "PK sudah dicek", penerapan standar ke menu lama (baru lewat override global).
- Asumsi menunggu konfirmasi: volume LH = pln + pemb (jumlah dihitung sebagai Pemb); sumber volume (pasang/MDU/bongkar).
