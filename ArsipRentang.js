/**
 * ============================================================================
 * ArsipRentang.js - Pindahkan LH lama per rentang tanggal ke file spreadsheet lain, dan pulihkan lagi bila perlu.
 * ----------------------------------------------------------------------------
 * Tujuan: Data_LH yang terus membesar dikurangi dengan memotong LH lama ke file arsip (spreadsheet terpisah).
 * Hanya Super Admin. Yang dipindah HANYA baris Data_LH (PK, SPK, RAB, KTK tidak disentuh).
 *
 * Urutan aman pada pemindahan (gagal di tengah = data tidak hilang):
 *   1. Cadangan seluruh database dibuat dulu (kmnCadangkan_). Gagal = tidak ada yang dipindah.
 *   2. Baris disalin ke tab Arsip_LH di file arsip, lalu DIBACA ULANG dan dibandingkan isinya penuh. Beda = salinan dibatalkan.
 *   3. Baru sekarang baris asli dihapus dari Data_LH, dan dicek bahwa semuanya sudah hilang dari sana.
 *   4. Terakhir satu catatan pemindahan ditulis di Arsip_Pindah (dasar tombol Pulihkan).
 * Diulang aman: baris yang sudah ada di arsip tidak disalin dua kali.
 * LH yang ID-nya dibuat HARI INI tidak ikut dipindah (nomor ID baru dibuat dari nomor terbesar hari itu, jadi bisa bentrok bila dipulihkan).
 * Satu proses memindah paling banyak AR_MAKS_ LH (batas waktu eksekusi Apps Script); ulangi sampai habis.
 * ============================================================================
 */
const AR_TAB_FILE_ = 'Arsip_Tujuan';
const AR_KOLOM_FILE_ = ['ID', 'Label', 'ID_Spreadsheet', 'URL', 'Ditambah_Oleh', 'Waktu'];
const AR_TAB_LOG_ = 'Arsip_Pindah';
const AR_KOLOM_LOG_ = ['ID_Batch', 'Waktu', 'Oleh', 'Tgl_Dari', 'Tgl_Sampai', 'ID_File', 'Label_File', 'Jumlah_LH', 'Status', 'Dipulihkan_Waktu', 'Dipulihkan_Oleh'];
const AR_TAB_ISI_ = 'Arsip_LH';
const AR_EKSTRA_ = ['ID_Batch', 'Dipindah_Pada', 'Dipindah_Oleh'];
const AR_MAKS_ = 500;

function arWaktu_() { return Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm'); }
function arTgl_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Makassar', 'yyyy-MM-dd') : String(v == null ? '' : v).trim().slice(0, 10); }
function arTglOk_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const p = String(s).split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}
/** Teks yang diawali = akan dibaca Sheets sebagai rumus: tambahkan penanda teks (apostrof) supaya tersimpan apa adanya. */
function arAman_(v) { return (typeof v === 'string' && /^[=]/.test(v)) ? "'" + v : v; }
function arSama_(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/** Tab di database utama (dibuat bila belum ada) dengan kepala kolom. */
function arTabDb_(nama, kolom) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(nama);
  if (!sh) { sh = ss.insertSheet(nama); sh.getRange(1, 1, 1, kolom.length).setValues([kolom]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function arBaca_(sh, n) { return sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, n).getValues(); }
function arFiles_() {
  return arBaca_(arTabDb_(AR_TAB_FILE_, AR_KOLOM_FILE_), AR_KOLOM_FILE_.length).filter(function (x) { return String(x[0]).trim() !== ''; }).map(function (x) {
    return { id: String(x[0]).trim(), label: String(x[1]), idSheet: String(x[2]).trim(), url: String(x[3]), oleh: String(x[4]), waktu: String(x[5]) };
  });
}
function arBatches_() {
  return arBaca_(arTabDb_(AR_TAB_LOG_, AR_KOLOM_LOG_), AR_KOLOM_LOG_.length).filter(function (x) { return String(x[0]).trim() !== ''; }).map(function (x, i) {
    return { baris: i + 2, id: String(x[0]).trim(), waktu: String(x[1]), oleh: String(x[2]), dari: arTgl_(x[3]), sampai: arTgl_(x[4]), idFile: String(x[5]).trim(), labelFile: String(x[6]), jumlah: Number(x[7]) || 0, status: String(x[8]), pulihWaktu: String(x[9]), pulihOleh: String(x[10]) };
  });
}
function arIdSheet_(url) {
  const s = String(url == null ? '' : url).trim();
  const m = /\/d\/([A-Za-z0-9_-]{20,})/.exec(s) || /^([A-Za-z0-9_-]{25,})$/.exec(s);
  return m ? m[1] : '';
}

// ---------- membaca (tanpa mengubah apa pun) ----------
function arsipRentangFileDaftar(auth) {
  try {
    const w = pglSuper_(auth); if (!w.ok) return w.galat;
    const b = arBatches_();
    return { status: 'success', files: arFiles_().map(function (f) { f.aktif = b.filter(function (x) { return x.idFile === f.id && x.status === 'Aktif'; }).length; return f; }), batches: b.slice().reverse().slice(0, 200), maks: AR_MAKS_ };
  } catch (e) { return { status: 'error', message: 'Gagal: ' + String((e && e.message) || e) }; }
}

/** Pilih baris Data_LH yang bertanggal dalam rentang. Mengembalikan { h, baris: [{ n (nomor baris sheet), v (nilai) }], hariIni, kosong }. */
function arPilih_(dari, sampai) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
  if (!sh) return { galat: 'Data LH tidak ditemukan.' };
  const lc = Math.max(sh.getLastColumn(), 1);
  const h = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (x) { return String(x).trim(); });
  const cId = h.indexOf('ID_LH'), cTg = h.indexOf('Tanggal');
  if (cId < 0 || cTg < 0) return { galat: 'Kolom ID_LH atau Tanggal di Data_LH tidak ditemukan.' };
  const hari = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyMMdd');
  const hasil = { h: h, cId: cId, cTg: cTg, baris: [], hariIni: 0, tanpaTanggal: 0 };
  if (sh.getLastRow() < 2) return hasil;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, lc).getValues();
  v.forEach(function (r, i) {
    const id = String(r[cId]).trim(); if (!id) return;
    const t = arTgl_(r[cTg]);
    if (!arTglOk_(t)) { hasil.tanpaTanggal++; return; }
    if (t < dari || t > sampai) return;
    if (id.indexOf('-' + hari + '-') >= 0) { hasil.hariIni++; return; }
    hasil.baris.push({ n: i + 2, v: r, t: t });
  });
  hasil.baris.sort(function (a, b) { return a.t < b.t ? -1 : (a.t > b.t ? 1 : a.n - b.n); });
  return hasil;
}

function arValid_(idFile, dari, sampai) {
  if (!arTglOk_(dari) || !arTglOk_(sampai)) return { galat: 'Tanggal harus berbentuk tahun-bulan-hari yang benar.' };
  if (dari > sampai) return { galat: 'Tanggal awal tidak boleh sesudah tanggal akhir.' };
  const f = arFiles_().filter(function (x) { return x.id === String(idFile); })[0];
  if (!f) return { galat: 'File arsip tidak ditemukan. Tambahkan lebih dulu atau muat ulang daftar.' };
  return { f: f };
}

/** Pratinjau dampak (hanya membaca): berapa LH akan dipindah, berapa yang sudah masuk KTK, dan berapa yang dilewati. */
function arsipRentangPeriksa(auth, idFile, dari, sampai) {
  try {
    const w = pglSuper_(auth); if (!w.ok) return w.galat;
    const k = arValid_(idFile, dari, sampai); if (k.galat) return { status: 'error', message: k.galat };
    const P = arPilih_(dari, sampai); if (P.galat) return { status: 'error', message: P.galat };
    const dipilih = P.baris.slice(0, AR_MAKS_), id = {};
    dipilih.forEach(function (b) { id[String(b.v[P.cId]).trim()] = true; });
    const ktk = {}; ktkRead_('Ktk_Pilihan').forEach(function (r) { if (r[1] === 'LH' && id[String(r[2]).trim()]) ktk[String(r[2]).trim()] = String(r[0]); });
    const cPk = P.h.indexOf('ID_PK'), pk = {};
    if (cPk >= 0) dipilih.forEach(function (b) { const p = String(b.v[cPk]).trim(); if (p) pk[p] = true; });
    return {
      status: 'success', file: k.f.label, total: P.baris.length, akanDipindah: dipilih.length, tersisaSetelahnya: Math.max(P.baris.length - dipilih.length, 0),
      dalamKtk: Object.keys(ktk).length, ktkTerdampak: Object.keys(ktk).map(function (x) { return ktk[x]; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 10),
      pkTerdampak: Object.keys(pk).length, dilewatiHariIni: P.hariIni, tanpaTanggal: P.tanpaTanggal,
      tglPertama: dipilih.length ? dipilih[0].t : '', tglTerakhir: dipilih.length ? dipilih[dipilih.length - 1].t : '', contoh: dipilih.slice(0, 5).map(function (b) { return String(b.v[P.cId]).trim(); })
    };
  } catch (e) { return { status: 'error', message: 'Gagal: ' + String((e && e.message) || e) }; }
}

// ---------- file arsip ----------
function arsipRentangFileTambahAsli_(auth, url, label) {
  return withIdLock_(function () {
    const w = pglSuper_(auth); if (!w.ok) return w.galat;
    const galat = function (p) { return { status: 'error', message: p }; };
    label = String(label == null ? '' : label).replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!label) return galat('Beri nama arsip ini, misalnya "Arsip 2025".');
    const idS = arIdSheet_(url); if (!idS) return galat('Link spreadsheet tidak dikenali. Tempel link lengkap dari Google Sheets.');
    if (idS === SPREADSHEET_ID) return galat('Itu file database aplikasi sendiri. Pakai spreadsheet kosong yang terpisah.');
    const ada = arFiles_();
    if (ada.some(function (f) { return f.idSheet === idS; })) return galat('File itu sudah ada di daftar arsip.');
    if (ada.some(function (f) { return f.label.toLowerCase() === label.toLowerCase(); })) return galat('Nama arsip itu sudah dipakai. Pakai nama lain.');
    let ss; try { ss = SpreadsheetApp.openById(idS); } catch (e) { return galat('File tidak bisa dibuka. Pastikan akun pemilik aplikasi punya akses Editor ke file itu. (' + String((e && e.message) || e) + ')'); }
    try {   // uji tulis: tab Arsip_LH dibuat bila belum ada
      let sh = ss.getSheetByName(AR_TAB_ISI_); if (!sh) { sh = ss.insertSheet(AR_TAB_ISI_); }
      SpreadsheetApp.flush();
      if (!ss.getSheetByName(AR_TAB_ISI_)) return galat('File arsip tidak bisa ditulis. Beri akses Editor.');
    } catch (e) { return galat('File arsip tidak bisa ditulis. Beri akses Editor. (' + String((e && e.message) || e) + ')'); }
    let mx = 0; ada.forEach(function (f) { const m = /^ARF-(\d+)$/.exec(f.id); if (m && parseInt(m[1], 10) > mx) mx = parseInt(m[1], 10); });
    const id = 'ARF-' + ('000' + (mx + 1)).slice(-3);
    const sh = arTabDb_(AR_TAB_FILE_, AR_KOLOM_FILE_);
    sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, 1, AR_KOLOM_FILE_.length).setValues([[id, kmnBersih_(label), idS, 'https://docs.google.com/spreadsheets/d/' + idS, kmnBersih_(w.who.id), arWaktu_()]]);
    SpreadsheetApp.flush();
    if (!arFiles_().some(function (f) { return f.id === id && f.idSheet === idS; })) return galat('Penyimpanan tidak terverifikasi. Muat ulang daftar lalu periksa.');
    return { status: 'success', terverifikasi: true, id: id };
  });
}
function arsipRentangFileHapusAsli_(auth, idFile) {
  return withIdLock_(function () {
    const w = pglSuper_(auth); if (!w.ok) return w.galat;
    const galat = function (p) { return { status: 'error', message: p }; };
    idFile = String(idFile == null ? '' : idFile).trim();
    const f = arFiles_().filter(function (x) { return x.id === idFile; })[0]; if (!f) return galat('File arsip tidak ditemukan.');
    if (arBatches_().some(function (b) { return b.idFile === idFile && b.status === 'Aktif'; })) return galat('File ini masih berisi data yang dipindahkan dan belum dipulihkan. Pulihkan dulu semua pemindahannya, supaya data tidak kehilangan jalur kembali.');
    const sh = arTabDb_(AR_TAB_FILE_, AR_KOLOM_FILE_); const v = arBaca_(sh, 1); let n = -1;
    v.forEach(function (x, i) { if (String(x[0]).trim() === idFile) n = i + 2; });
    if (n < 0) return galat('File arsip tidak ditemukan.');
    sh.deleteRow(n); SpreadsheetApp.flush();
    if (arFiles_().some(function (x) { return x.id === idFile; })) return galat('Penghapusan tidak terverifikasi.');
    return { status: 'success', terverifikasi: true, id: idFile };   // hanya tautan yang dihapus; file spreadsheet-nya tidak disentuh
  });
}

// ---------- memindahkan ----------
/** Hapus baris sheet (nomor baris) dari bawah ke atas, per kelompok berurutan. */
function arHapusBaris_(sh, nomor) {
  const urut = nomor.slice().sort(function (a, b) { return b - a; }); let i = 0;
  while (i < urut.length) { let j = i; while (j + 1 < urut.length && urut[j + 1] === urut[j] - 1) j++; sh.deleteRows(urut[j], j - i + 1); i = j + 1; }
}
function arSelaraskanKepala_(shArsip, h) {
  const lcA = Math.max(shArsip.getLastColumn(), 0);
  if (shArsip.getLastRow() < 1 || lcA === 0 || String(shArsip.getRange(1, 1, 1, 1).getValues()[0][0]).trim() === '') {
    shArsip.getRange(1, 1, 1, h.length + AR_EKSTRA_.length).setValues([h.concat(AR_EKSTRA_)]); return null;
  }
  const kepala = shArsip.getRange(1, 1, 1, h.length + AR_EKSTRA_.length).getValues()[0].map(function (x) { return String(x).trim(); });
  if (!arSama_(kepala, h.concat(AR_EKSTRA_))) return 'Susunan kolom di file arsip berbeda dengan Data_LH. Pakai file arsip yang lain.';
  return null;
}

function arsipRentangPindahAsli_(auth, idFile, dari, sampai, konfirmasi) {
  return withIdLock_(function () {
    const w = pglSuper_(auth); if (!w.ok) return w.galat;
    const galat = function (p) { return { status: 'error', message: p }; };
    if (String(konfirmasi) !== 'PINDAHKAN') return galat('Konfirmasi belum benar. Ketik PINDAHKAN untuk melanjutkan.');
    const k = arValid_(idFile, dari, sampai); if (k.galat) return galat(k.galat);
    const P = arPilih_(dari, sampai); if (P.galat) return galat(P.galat);
    const dipilih = P.baris.slice(0, AR_MAKS_);
    if (!dipilih.length) return galat('Tidak ada LH yang bisa dipindah pada rentang itu.' + (P.hariIni ? ' (' + P.hariIni + ' LH dibuat hari ini sengaja dilewati.)' : ''));
    let ssA; try { ssA = SpreadsheetApp.openById(k.f.idSheet); } catch (e) { return galat('File arsip tidak bisa dibuka: ' + String((e && e.message) || e)); }
    let cad; try { cad = kmnCadangkan_(); } catch (e) { return galat('Cadangan database gagal, jadi TIDAK ada yang dipindah: ' + String((e && e.message) || e)); }
    if (!cad || cad.status !== 'success') return galat('Cadangan database gagal, jadi TIDAK ada yang dipindah.');

    let shA = ssA.getSheetByName(AR_TAB_ISI_) || ssA.insertSheet(AR_TAB_ISI_);
    const gk = arSelaraskanKepala_(shA, P.h); if (gk) return galat(gk);
    const nKol = P.h.length + AR_EKSTRA_.length;
    // ID batch berikutnya
    const batches = arBatches_(); let mx = 0; batches.forEach(function (b) { const m = /^ARB-(\d+)$/.exec(b.id); if (m && parseInt(m[1], 10) > mx) mx = parseInt(m[1], 10); });
    const idBatch = 'ARB-' + ('000' + (mx + 1)).slice(-3), waktu = arWaktu_();
    // yang sudah ada di arsip (sisa proses yang terputus) tidak disalin dua kali
    const sudah = {}; if (shA.getLastRow() > 1) shA.getRange(2, 1, shA.getLastRow() - 1, 1).getValues().forEach(function (r) { sudah[String(r[0]).trim().toLowerCase()] = true; });
    const baru = dipilih.filter(function (b) { return !sudah[String(b.v[P.cId]).trim().toLowerCase()]; });
    let awal = 0;
    if (baru.length) {
      const isi = baru.map(function (b) { return b.v.map(arAman_).concat([idBatch, waktu, kmnBersih_(w.who.id)]); });
      awal = Math.max(shA.getLastRow(), 1) + 1;
      shA.getRange(awal, 1, isi.length, nKol).setValues(isi);
      SpreadsheetApp.flush();
      // baca ulang dan bandingkan penuh: beda sedikit saja = salinan dibatalkan, Data_LH tidak disentuh
      const cek = shA.getRange(awal, 1, isi.length, nKol).getValues();
      const salah = baru.some(function (b, i) { return !arSama_(cek[i].slice(0, P.h.length).map(function (x) { return x instanceof Date ? arTgl_(x) + '|d' : String(x); }), b.v.map(function (x) { return x instanceof Date ? arTgl_(x) + '|d' : String(x); })); });
      if (salah) { try { shA.deleteRows(awal, isi.length); } catch (e) { /* pemulihan terbaik */ } return galat('Salinan di file arsip tidak sama dengan aslinya, jadi dibatalkan. Data LH TIDAK berubah.'); }
    }
    // semua LH terpilih kini ada di arsip; baru hapus dari Data_LH
    const shLh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
    const idDipilih = {}; dipilih.forEach(function (b) { idDipilih[String(b.v[P.cId]).trim().toLowerCase()] = b; });
    const arsipId = {}; shA.getRange(2, 1, Math.max(shA.getLastRow() - 1, 1), 1).getValues().forEach(function (r) { arsipId[String(r[0]).trim().toLowerCase()] = true; });
    if (Object.keys(idDipilih).some(function (x) { return !arsipId[x]; })) return galat('Ada LH yang belum terbaca di file arsip. Data LH TIDAK berubah.');
    // pastikan baris yang akan dihapus masih LH yang sama (tidak bergeser oleh perubahan lain)
    const nomor = [];
    const kolId = shLh.getLastRow() < 2 ? [] : shLh.getRange(2, P.cId + 1, shLh.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < dipilih.length; i++) { const b = dipilih[i]; if (String((kolId[b.n - 2] || [''])[0]).trim() !== String(b.v[P.cId]).trim()) return galat('Isi Data_LH berubah selama proses. Tidak ada yang dihapus. Ulangi.'); nomor.push(b.n); }
    arHapusBaris_(shLh, nomor); SpreadsheetApp.flush();
    const sisa = arBaca_(shLh, Math.max(P.cId + 1, 1)).filter(function (r) { return idDipilih[String(r[P.cId]).trim().toLowerCase()]; }).length;
    if (sisa > 0) return { status: 'error', message: 'Penghapusan dari Data_LH tidak lengkap (' + sisa + ' LH masih ada di sana dan juga di file arsip). Ulangi pemindahan yang sama untuk merapikan; data tidak hilang. Cadangan: ' + cad.nama };
    const lg = arTabDb_(AR_TAB_LOG_, AR_KOLOM_LOG_);
    lg.getRange(Math.max(lg.getLastRow(), 1) + 1, 1, 1, AR_KOLOM_LOG_.length).setValues([[idBatch, waktu, kmnBersih_(w.who.id), dari, sampai, k.f.id, kmnBersih_(k.f.label), dipilih.length, 'Aktif', '', '']]);
    SpreadsheetApp.flush();
    if (!arBatches_().some(function (b) { return b.id === idBatch && b.status === 'Aktif'; })) return { status: 'error', message: 'LH sudah dipindah, tetapi catatan pemindahan tidak tersimpan. Data aman di file ' + k.f.label + ' (kolom ID_Batch ' + idBatch + '). Hubungi pengelola sebelum melanjutkan.' };
    return { status: 'success', terverifikasi: true, batch: idBatch, jumlah: dipilih.length, tersisa: Math.max(P.baris.length - dipilih.length, 0), cadangan: cad.nama, file: k.f.label };
  });
}

// ---------- memulihkan ----------
function arsipRentangPulihkanAsli_(auth, idBatch) {
  return withIdLock_(function () {
    const w = pglSuper_(auth); if (!w.ok) return w.galat;
    const galat = function (p) { return { status: 'error', message: p }; };
    idBatch = String(idBatch == null ? '' : idBatch).trim();
    const b = arBatches_().filter(function (x) { return x.id === idBatch; })[0];
    if (!b) return galat('Catatan pemindahan tidak ditemukan.');
    if (b.status !== 'Aktif') return galat('Pemindahan ' + idBatch + ' sudah dipulihkan.');
    const f = arFiles_().filter(function (x) { return x.id === b.idFile; })[0]; if (!f) return galat('Tautan file arsip untuk pemindahan ini sudah tidak ada.');
    let ssA; try { ssA = SpreadsheetApp.openById(f.idSheet); } catch (e) { return galat('File arsip tidak bisa dibuka: ' + String((e && e.message) || e)); }
    const shA = ssA.getSheetByName(AR_TAB_ISI_); if (!shA || shA.getLastRow() < 2) return galat('Tab ' + AR_TAB_ISI_ + ' di file arsip kosong atau hilang.');
    const lcA = shA.getLastColumn(); const hA = shA.getRange(1, 1, 1, lcA).getValues()[0].map(function (x) { return String(x).trim(); });
    const cBatch = hA.indexOf('ID_Batch'); if (cBatch < 0) return galat('Kolom ID_Batch di file arsip tidak ditemukan.');
    const vA = shA.getRange(2, 1, shA.getLastRow() - 1, lcA).getValues(), ambil = [];
    vA.forEach(function (r, i) { if (String(r[cBatch]).trim() === idBatch) ambil.push({ n: i + 2, v: r }); });
    if (!ambil.length) return galat('Isi pemindahan ' + idBatch + ' tidak ditemukan di file arsip.');
    const shLh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH'); if (!shLh) return galat('Data LH tidak ditemukan.');
    const lc = Math.max(shLh.getLastColumn(), 1), h = shLh.getRange(1, 1, 1, lc).getValues()[0].map(function (x) { return String(x).trim(); });
    const cId = h.indexOf('ID_LH'); if (cId < 0) return galat('Kolom ID_LH di Data_LH tidak ditemukan.');
    const peta = h.map(function (nm) { return hA.indexOf(nm); });
    const baris = ambil.map(function (a) { return peta.map(function (k) { return k >= 0 ? a.v[k] : ''; }); });
    // bentrok: ID sudah ada lagi di Data_LH. Isi sama persis = sisa pemulihan yang terputus, boleh dilewati; beda = berhenti.
    const ada = {}; arBaca_(shLh, lc).forEach(function (r) { ada[String(r[cId]).trim().toLowerCase()] = r; });
    const bentrok = []; const tulis = [];
    baris.forEach(function (r) {
      const e = ada[String(r[cId]).trim().toLowerCase()];
      if (!e) { tulis.push(r); return; }
      if (!arSama_(e.map(function (x) { return x instanceof Date ? arTgl_(x) + '|d' : String(x); }), r.map(function (x) { return x instanceof Date ? arTgl_(x) + '|d' : String(x); }))) bentrok.push(String(r[cId]).trim());
    });
    if (bentrok.length) return galat('ID ini sudah dipakai LH lain di Data_LH, jadi pemulihan dihentikan agar tidak menimpa: ' + bentrok.slice(0, 6).join(', ') + (bentrok.length > 6 ? ', ...' : '') + '.');
    if (tulis.length) {
      const awal = Math.max(shLh.getLastRow(), 1) + 1;
      shLh.getRange(awal, 1, tulis.length, lc).setValues(tulis.map(function (r) { return r.map(arAman_); }));
      SpreadsheetApp.flush();
      const cek = shLh.getRange(awal, 1, tulis.length, lc).getValues();
      const salah = tulis.some(function (r, i) { return !arSama_(cek[i].map(function (x) { return x instanceof Date ? arTgl_(x) + '|d' : String(x); }), r.map(function (x) { return x instanceof Date ? arTgl_(x) + '|d' : String(x); })); });
      if (salah) { try { shLh.deleteRows(awal, tulis.length); } catch (e) { /* pemulihan terbaik */ } return galat('Data yang ditulis kembali tidak sama dengan arsip, jadi dibatalkan. Data di file arsip tetap utuh.'); }
    }
    // sudah kembali di Data_LH dan terverifikasi; baru bersihkan dari file arsip
    arHapusBaris_(shA, ambil.map(function (a) { return a.n; })); SpreadsheetApp.flush();
    const sisaA = shA.getLastRow() < 2 ? 0 : shA.getRange(2, cBatch + 1, shA.getLastRow() - 1, 1).getValues().filter(function (r) { return String(r[0]).trim() === idBatch; }).length;
    const lg = arTabDb_(AR_TAB_LOG_, AR_KOLOM_LOG_);
    if (sisaA > 0) return galat('LH sudah kembali ke Data_LH, tetapi ' + sisaA + ' baris di file arsip belum terhapus. Ulangi Pulihkan untuk merapikan; data tidak hilang.');
    lg.getRange(b.baris, 9, 1, 3).setValues([['Dipulihkan', arWaktu_(), kmnBersih_(w.who.id)]]); SpreadsheetApp.flush();
    if (arBatches_().filter(function (x) { return x.id === idBatch; })[0].status !== 'Dipulihkan') return galat('LH sudah kembali, tetapi catatan belum diperbarui. Muat ulang daftar.');
    return { status: 'success', terverifikasi: true, batch: idBatch, jumlah: ambil.length };
  });
}
