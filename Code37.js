/**
 * ============================================================================
 * Code37.js - Cetak Bon Code 3 (pengembalian barang) dan Code 7 (pemakaian) dari Pusat verifikasi.
 * ----------------------------------------------------------------------------
 * Sumber data (aturan yang sama dengan layar: UiKit lhDokumen dan Dokumen.js dokButuh_):
 *   Code 3 = material retur bekas di LH (Data_JSON.returBekas)
 *   Code 7 = material MDU yang catatannya memuat "bekas" atau "ex" (Data_JSON.materialMdu)
 * Setiap cetak MENULIS barisnya ke spreadsheet Code 3 / Code 7 (tab Data_Code3 / Data_Code7, dibuat bila belum ada). Tab template
 * yang sudah ada di spreadsheet itu TIDAK disentuh. Cetak ulang LH yang sama mengganti baris lama (bukan menggandakan).
 * Urutan aman: baris baru ditulis dan DIBACA ULANG dulu, baru baris lama dihapus. Gagal di tengah = data lama tetap utuh.
 * Nomor normalisasi diambil dari daftar material C37_MASTER_ (kode, deskripsi SAP, nama pendek).
 * ============================================================================
 */
const C37_SS_ = {
  code3: { id: '1Vh7xc8mr64XxuoG_eksdTiAFQK_c3K_utUTTB81moH8', tab: 'Data_Code3', nama: 'Code 3', kunci: 'code3' },
  code7: { id: '140-wVrFVLehbFrUXCkvFUm2ONb8JkDOD3QBMlj3R8w0', tab: 'Data_Code7', nama: 'Code 7', kunci: 'code7' }
};
const C37_KOLOM_ = ['Waktu', 'No_Bon', 'ID_LH', 'No_Urut', 'Normalisasi', 'Nama_Barang', 'Satuan', 'Jumlah', 'Terbilang', 'Kondisi', 'Catatan', 'Nama', 'Alamat', 'ID_PK', 'ID_SPK', 'Dicetak_Oleh'];
const C37_ROLES_ = ['Super Admin', 'Admin Code'];
const C37_BARIS_MAKS_ = 40;

// [kode material, deskripsi SAP, nama pendek]
const C37_MASTER_ = [
  ['1030074', 'TRF DIS;D3;20kV/400V;3P;100kVA;YZN5;OD', 'Trafo 100 kVA'], ['1030075', 'TRF DIS;D3;20kV/400V;3P;160kVA;YZN5;OD', 'Trafo 160 kVA'],
  ['1030076', 'TRF DIS;D3;20kV/400V;3P;200kVA;DYN5;OD', 'Trafo 200 kVA'], ['1030097', 'TRF DIS;D3;20kV/400V;3P;50kVA;YZN5;OD', 'Trafo 50 kVA'],
  ['1030114', 'TRF DIS;D3;20kV/400V;3P;400kVA;DYN5;OD', 'Trafo 114 kVA'], ['2040015', 'DS ACC;LIGHTNING ARRESTER 20 KV 10 KA', 'ARESTER'],
  ['2050056', 'CT;20kV;K;20/5-5A;0.5;60VA;ID', 'CT'], ['2190051', 'MTR;kWH M;;3P;220/380V;20-60A;1;DT;4W', 'kWH 3 phs 30 kVA'],
  ['2190112', 'MTR;kWH E;;3P;57.7/100V;5A;0.5;;4W', 'kwh 3 phs skala 0,5 yg muncul di Ago'], ['2190119', 'MTR;kWH M;;1P;220V;5-20A;2;ST;2W', 'KWH 1 PHS CLASS 0,5'],
  ['2190202', 'MTR;kWH E;;3P;57.7/100V;5-10A;0.5;;4W', 'kWH 3 phs skala 0,5'], ['2190218', 'MTR;kWH E;;3P;230/400V;5-80A;1;;4W', 'kWH 3 phs skala 1'],
  ['2190224', 'MTR;kWH E-PR;;1P;230V;5-60A;1;;2W', 'kWH 1 phs skala 1'], ['2190356', 'MTR;kWH E;;3P;220/380V;5-80A;1;;4W', 'daya diatas 41,5 Kva'],
  ['2190438', 'MTR;kWHE;;3P;57.7/100V-230/400;5A;0.5;4W', 'TIDAK MUNCUL DI AGO'], ['3030001', 'POLE;CONCRETE;20kV;CIRCL;11m;200daN;;', 'TIANG BETON 11 M'],
  ['3030002', 'POLE;CONCRETE;20kV;CIRCL;11m;350daN;;', 'TIANG BETON 11 M'], ['3030006', 'POLE;CONCRETE;20kV;CIRCL;13m;350daN;;', 'TIANG BETON 13 M'],
  ['3030018', 'POLE;CONCRETE;220V;CIRCL;9m;200daN;;', 'TIANG BETON 9 M'], ['3040115', 'POLE ACC;GUY WIRE 70mm2', 'TRACK SCORE'],
  ['3040329', 'POLE ACC;STAY SET TM', 'KONTRAMAT TM'], ['3040330', 'POLE ACC;STAY SET TR', 'KONTRAMAT TR'],
  ['3040360', 'POLE ACC;TRAVERS;TMP-STEEL;U80X1800', 'dudukan terminating'], ['3040441', 'POLE ACC;IJZERWERK', 'YZER WERK'],
  ['3050088', 'CONDUCTOR;AAAC-S;70mm2;', 'A3CS'], ['3070152', 'ISOLATOR;LINEPOST;POLYMER;24KV;;12.5kN', 'ISOLATOR TUMPU'],
  ['3110025', 'CABLE PWR;NFA2X;2X10mm2;0.6/1kV;OH', 'SR 10 mm'], ['3110026', 'CABLE PWR;NFA2X;2X16mm2;0.6/1kV;OH', 'SR 16 mm'],
  ['3110086', 'CABLE PWR;MVTIC;3X150+1X95;20kV;OH', 'MVTIC TM'], ['3110516', 'CABLE PWR;NYY;1X150mm2;0.6/1kV;Opstig', 'NYY 150'],
  ['3110542', 'CABLE PWR;NFA2X-T;3X70+1X70;0.6/1kV;OH', 'LVTC'], ['3120034', 'CABLE PWR ACC;DEAD END ASSY ADJ 95mm', 'DEAD END MVTIC'],
  ['3120038', 'CABLE PWR ACC;DEAD END ASSY FIXED 70mm', 'DEAD END ASS TR'], ['3120057', 'CABLE PWR ACC;LARGE ANGLE ASSY 50mm', 'LA ASS TR'],
  ['3120091', 'CABLE PWR ACC;SUSPENSION ASSY 50mm', 'SUSPENSION JTR'], ['3120111', 'CABLE PWR ACC;CABLE SHOE AL-CU 240mm2', 'SKUN SEPATU KABEL'],
  ['3190002', 'CUT OUT;20kV;6-100A;10kA;125kV', 'CO U 160 KVA'], ['3260226', 'LVSB;DIST;3P;400V;630A;4LINE;OD', 'sering di pakai'],
  ['3260237', 'LVSB;DIST;3P;400V;400A;2LINE;OD', 'sering di pakai'], ['3280191', 'CONN;0.6/1kV;CCO;AL;50-70/50-70mm2;PRS;', 'CCO'],
  ['4120051', 'BOX;APPIII COMPLETE;ST PLATE 2mm;', 'LV BOARD 3 PHS KOMPLIT'], ['4120054', 'BOX;APPVI TR;ST PLATE 2mm;', 'KAST TYPE KOSONGAN'],
  ['4120070', 'BOX;APPIII NCBL;ST PLATE 2mm;60X25X7.5cm', 'LV BOARD 3 PHS'], ['4120075', 'BOX;APPVI KHUSUS;ST PLATE 2mm;88X55X28cm', 'APPVI KHUSUS'],
  ['4120101', 'BOX;MER TRIP MODEM MCCB CT TR 41,5KVA EN', 'KAST TYPE VI 41,5 Kva'], ['4120102', 'BOX;MER TRIP MODEM MCCB CT TR 53KVA', 'KAST TYPE VI 53 Kva'],
  ['4120103', 'BOX;MER TRIP MODEM MCCB CT TR 66KVA', 'KAST TYPE VI 66 Kva'], ['4120105', 'BOX;MER TRIP MODEM MCCB CT TR 105KVA', 'KAST TYPE VI 105 Kva'],
  ['4120106', 'BOX;MER TRIP MODEM MCCB CT TR 131KVA', 'KAST TYPE VI 131 Kva'], ['4120113', 'BOX;APPVI KHUSUS LENGKAP;FIBER;', 'KAST TYPE KOMPLIT'],
  ['4120229', 'BOX;APPV TR;ST PLATE 2mm;', 'amr, kast type vi daya 23 kva'], ['4120338', 'BOX;APPVI TR 53 KVA;SPCC PLATE 1.5MM;', 'KAST BERDAYA'],
  ['4120339', 'BOX;APPVI TR 66 KVA;SPCC PLATE 1.5MM;', ''], ['4120340', 'BOX;APPVI TR 82.5KVA;SPCC PLATE 1.5MM;', ''],
  ['4120341', 'BOX;APPVI TR 105 KVA;SPCC PLATE 1.5MM;', ''], ['4120342', 'BOX;APPVI TR 131 KVA;SPCC PLATE 1.5MM;', ''],
  ['4120343', 'BOX;APPVI TR 147 KVA;SPCC PLATE 1.5MM;', ''], ['4120344', 'BOX;APPVI TR 164 KVA;SPCC PLATE 1.5MM;', ''],
  ['4120345', 'BOX;APPVI TR 197 KVA;SPCC PLATE 1.5MM;', ''], ['4120350', 'BOX;APPVI TR 41.5 KVA;AL PLATE 2MM;', 'TIDAK MUNCUL DI AGO'],
  ['4120353', 'BOX;APPVI TR 82.5 KVA;AL PLATE 2MM;', 'TIDAK MUNCUL DI AGO'], ['4120354', 'BOX;APPVI TR 105 KVA;AL PLATE 2MM;', ''],
  ['4120355', 'BOX;APPVI TR 131 KVA;AL PLATE 2MM;', ''], ['4120356', 'BOX;APPVI TR 147 KVA;AL PLATE 2MM;', ''],
  ['4120357', 'BOX;APPVI TR 164 KVA;AL PLATE 2MM;', ''], ['4120358', 'BOX;APPVI TR 197 KVA;AL PLATE 2MM;', ''],
  ['7010059', 'TOOL M;CROSS ARM SADDLE', 'CROSS ARM']
];

function c37Norm_(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

// ---------- daftar nomor normalisasi di Google Sheet (tab Daftar_Normalisasi), dikelola Admin Code dan Super Admin ----------
// Tab dibuat otomatis dan diisi awal dari C37_MASTER_ di atas. Setelah ada, tab itulah sumber kebenarannya. Bila tab tidak terbaca atau kosong,
// daftar di kode dipakai sebagai cadangan agar cetak tidak berhenti.
const C37_NORM_TAB_ = 'Daftar_Normalisasi';
const C37_NORM_KOLOM_ = ['Kode', 'Deskripsi_SAP', 'Nama_Pendek', 'Diubah_Oleh', 'Waktu'];
const C37_NORM_MAKS_ = 5000;
let C37_NORM_CACHE_ = null;   // hanya berlaku dalam satu pemanggilan server

function c37NormSheet_(buat) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(C37_NORM_TAB_);
  if (!sh && buat) {
    sh = ss.insertSheet(C37_NORM_TAB_);
    sh.getRange(1, 1, 1, C37_NORM_KOLOM_.length).setValues([C37_NORM_KOLOM_]).setFontWeight('bold'); sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), 1).setNumberFormat('@');   // kode disimpan sebagai teks supaya angka nol di depan tidak hilang
    const waktu = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm');
    const isi = C37_MASTER_.map(function (m) { return [m[0], m[1], m[2], 'sistem', waktu]; });
    sh.getRange(2, 1, isi.length, C37_NORM_KOLOM_.length).setValues(isi);
    SpreadsheetApp.flush();
  }
  return sh;
}
/** Baca tab: [[kode, deskripsi, nama pendek], ...]; baris dengan kode bukan 7 angka dilewati. */
function c37NormBaca_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const out = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (x) {
    const k = String(x[0] == null ? '' : x[0]).replace(/\s/g, '');
    if (/^\d{7}$/.test(k)) out.push([k, String(x[1] == null ? '' : x[1]).trim(), String(x[2] == null ? '' : x[2]).trim()]);
  });
  return out;
}
/** Daftar yang dipakai pencocokan: dari tab bila ada isinya, kalau tidak dari daftar di kode. */
function c37Daftar_() {
  if (C37_NORM_CACHE_) return C37_NORM_CACHE_;
  let d = [];
  try { d = c37NormBaca_(c37NormSheet_(false)); } catch (e) { d = []; }
  C37_NORM_CACHE_ = d.length ? d : C37_MASTER_;
  return C37_NORM_CACHE_;
}

/**
 * Nomor normalisasi untuk satu nama material. Mengembalikan { kode, status: 'cocok' | 'ambigu' | 'tidak', calon: [kode, ...] }.
 * ketat = true: hanya nama yang PERSIS sama (tanpa peduli huruf besar-kecil dan tanda baca); tanpa ketat, awalan nama yang mirip juga dipakai.
 */
function c37Kode_(nama, ketat) {
  const teks = String(nama == null ? '' : nama);
  const langsung = teks.match(/(?:^|[^0-9])(\d{7})(?:[^0-9]|$)/);   // kode 7 digit yang sudah ditulis di nama
  if (langsung) return { kode: langsung[1], status: 'cocok', calon: [langsung[1]] };
  // buang kata penanda bekas supaya "Tiang beton 9m - ex" tetap cocok
  const n = c37Norm_(teks.replace(/\b(ex|bekas)\b\.?/gi, ''));
  if (!n) return { kode: '', status: 'tidak', calon: [] };
  const D = c37Daftar_();
  let hit = D.filter(function (m) { return c37Norm_(m[2]) === n || c37Norm_(m[1]) === n || m[0] === n; });
  if (!hit.length && !ketat) hit = D.filter(function (m) { const a = c37Norm_(m[2]); return a.length >= 4 && n.length >= 4 && (a.indexOf(n) === 0 || n.indexOf(a) === 0 && a.length >= 6); });
  const kode = {}; hit.forEach(function (m) { kode[m[0]] = 1; });
  const daftar = Object.keys(kode);
  if (daftar.length === 1) return { kode: daftar[0], status: 'cocok', calon: daftar };
  return { kode: '', status: daftar.length > 1 ? 'ambigu' : 'tidak', calon: daftar.slice(0, 8) };
}
/** Deskripsi singkat satu kode untuk ditampilkan sebagai pilihan: "3030001 · TIANG BETON 11 M". */
function c37KodeUraian_(kode) {
  const m = c37Daftar_().filter(function (x) { return x[0] === kode; })[0];
  return m ? (m[2] || m[1]) : '';
}

// ---------- terbilang (huruf) ----------
function c37Terbilang_(angka) {
  const s = ['', 'SATU', 'DUA', 'TIGA', 'EMPAT', 'LIMA', 'ENAM', 'TUJUH', 'DELAPAN', 'SEMBILAN', 'SEPULUH', 'SEBELAS'];
  function bulat(n) {
    if (n < 12) return s[n];
    if (n < 20) return bulat(n - 10) + ' BELAS';
    if (n < 100) return bulat(Math.floor(n / 10)) + ' PULUH' + (n % 10 ? ' ' + bulat(n % 10) : '');
    if (n < 200) return 'SERATUS' + (n - 100 ? ' ' + bulat(n - 100) : '');
    if (n < 1000) return bulat(Math.floor(n / 100)) + ' RATUS' + (n % 100 ? ' ' + bulat(n % 100) : '');
    if (n < 2000) return 'SERIBU' + (n - 1000 ? ' ' + bulat(n - 1000) : '');
    if (n < 1000000) return bulat(Math.floor(n / 1000)) + ' RIBU' + (n % 1000 ? ' ' + bulat(n % 1000) : '');
    return String(n);
  }
  const x = Number(angka); if (!isFinite(x) || x < 0) return '';
  const t = String(Math.round(x * 1000) / 1000).split('.');
  const b = Number(t[0]);
  let out = b === 0 ? 'NOL' : bulat(b);
  if (t[1]) out += ' KOMA ' + t[1].split('').map(function (d) { return d === '0' ? 'NOL' : s[Number(d)]; }).join(' ');
  return out;
}

function c37Angka_(v) { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; }

/** Susun baris cetak dari Data_JSON satu LH. */
function c37Susun_(jenis, d) {
  const kumpul = jenis === 'code3'
    ? (d.returBekas || []).filter(function (m) { return m && String(m.nama || '').trim() !== ''; })
    : (d.materialMdu || []).filter(function (m) { return m && /bekas|ex/i.test(m.catatan || ''); });
  return kumpul.map(function (m, i) {
    const nama = String(m.nama || '').trim(), cat = String(m.catatan || '').trim();
    const jml = c37Angka_(m.jumlah), k = c37Kode_(nama, true);
    const rusak = jenis === 'code3' && /rusak/i.test(nama + ' ' + cat);
    return {
      no: i + 1, kode: k.kode, kodeStatus: k.status, kodeSumber: k.kode ? 'daftar' : '', namaDasar: nama,
      nama: nama + (cat && jenis === 'code3' ? ' - ' + cat : (cat && jenis === 'code7' ? ' - ' + cat : '')),
      satuan: String(m.satuan || '').trim(), jumlah: jml, terbilang: c37Terbilang_(jml),
      kondisi: jenis === 'code3' ? (rusak ? 1 : 2) : '', catatan: cat
    };
  });
}

/** Baca satu LH dari database: barang bawaan bon, PK, SPK, nama, alamat. Mengembalikan { galat } bila tidak bisa. */
function c37Muat_(jenis, id) {
  const T = C37_SS_[jenis];
  const ssAsal = SpreadsheetApp.openById(SPREADSHEET_ID);
  const shLh = ssAsal.getSheetByName('Data_LH'); if (!shLh) return { galat: "Data LH tidak ditemukan." };
  const dl = shLh.getDataRange().getValues(), hl = dl[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const cId = hl.indexOf('id_lh'), cPk = hl.indexOf('id_pk'), cJs = hl.indexOf('data_json'), cTg = hl.indexOf('tanggal');
  if (cId < 0 || cJs < 0) return { galat: 'Kolom Data_LH tidak lengkap.' };
  let r = null; for (let i = 1; i < dl.length; i++) { if (String(dl[i][cId]).trim() === id) { r = dl[i]; break; } }
  if (!r) return { galat: 'LH ' + id + ' tidak ditemukan.' };
  let d = {}; try { d = r[cJs] ? JSON.parse(r[cJs]) : {}; } catch (e) { d = {}; }
  const baris = c37Susun_(jenis, d);
  // PK dan SPK dibaca dari database, bukan dari kiriman layar
  const idPk = cPk >= 0 ? String(r[cPk] || '').trim() : '';
  let idSpk = '';
  const shPk = ssAsal.getSheetByName('Data_PK');
  if (shPk && idPk) { const dp = shPk.getDataRange().getValues(), hp = dp[0].map(function (h) { return String(h).trim().toLowerCase(); }); const a = hp.indexOf('id_pk'), b = hp.indexOf('id_spk'); for (let i = 1; i < dp.length; i++) { if (String(dp[i][a]).trim() === idPk) { idSpk = b >= 0 ? String(dp[i][b] || '').trim() : ''; break; } } }
  return { baris: baris, idPk: idPk, idSpk: idSpk, nama: String(d.nama_pekerjaan_lh || r[hl.indexOf('uraian')] || '').trim(), alamat: String(d.lokasi_lh || '').trim(), tanggal: cTg >= 0 ? c37Tgl_(r[cTg]) : '', T: T };
}

/** Nama di Convert_material (pokok atau Mungkin_1..3) dan Master_Data (Nama_Item), sudah dinormalkan, untuk pengecekan "material ada atau tidak". */
function c37Rujukan_() {
  const conv = {}, master = {}, masterId = {}, via = {}, grup = {}, masterNama = {};
  // Master_Data dibaca lebih dulu: nama tiap ID dipakai untuk melengkapi kelompok nama di Convert_material
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Master_Data');
    if (sh && sh.getLastRow() > 1) { const v = sh.getDataRange().getValues(); const h = v[0].map(function (x) { return String(x).trim().toLowerCase(); }); const c = h.indexOf('nama_item'), ci = h.indexOf('id_item'); for (let i = 1; i < v.length; i++) { if (c >= 0) { const n = c37Norm_(v[i][c]); if (n) master[n] = 1; } if (ci >= 0 && String(v[i][ci]).trim()) { masterId[String(v[i][ci]).trim()] = 1; if (c >= 0) masterNama[String(v[i][ci]).trim()] = String(v[i][c] || '').trim(); } } }
  } catch (e) { /* abaikan */ }
  // satu baris Convert_material = kelompok nama setara (pokok, mungkin 1-3, Nama_master); ID/Nama_master menunjuk Master_Data
  // grup[nama] = semua nama setara di kelompok itu (termasuk nama Master_Data lewat ID), dipakai mencari nomor normalisasi lewat nama lain
  try { ktkConvertRows_().forEach(function (x) {
    const sama = []; [x[0], x[1], x[2], x[3], x[5], masterNama[String(x[4] || '').trim()]].forEach(function (nm) { const t = String(nm == null ? '' : nm).trim(); if (t && !sama.some(function (e) { return c37Norm_(e) === c37Norm_(t); })) sama.push(t); });
    for (let i = 0; i < 6; i++) { if (i === 4) continue; const n = c37Norm_(x[i]); if (n && !conv[n]) { conv[n] = x[0]; via[n] = { id: String(x[4] || ''), nm: c37Norm_(x[5]) }; } }
    sama.forEach(function (nm) { const n = c37Norm_(nm); const g = grup[n] || (grup[n] = []); sama.forEach(function (o) { if (!g.some(function (e) { return c37Norm_(e) === c37Norm_(o); })) g.push(o); }); });
  }); } catch (e) { /* tabel tidak terbaca: semua dianggap belum ada */ }
  // nama yang tidak ada persis di Master_Data tetap dianggap "ada" bila baris Convert-nya menunjuk ID atau nama Master_Data yang memang ada
  Object.keys(via).forEach(function (n) { const t = via[n]; if (!master[n] && ((t.id && masterId[t.id]) || (t.nm && master[t.nm]))) master[n] = 1; });
  return { conv: conv, master: master, grup: grup };
}

/** Cari nomor normalisasi lewat Convert_material: coba semua nama setara di kelompok yang sama (pokok, mungkin 1-3, nama Master_Data). */
function c37KodeConvert_(dasar, pokok, ruj) {
  const nama = (ruj.grup && ruj.grup[dasar] ? ruj.grup[dasar].slice() : []);
  if (pokok && !nama.some(function (e) { return c37Norm_(e) === c37Norm_(pokok); })) nama.push(pokok);
  const kode = {};
  nama.forEach(function (nm) { const k = c37Kode_(nm, true); (k.status === 'cocok' ? [k.kode] : k.calon).forEach(function (c) { kode[c] = 1; }); });
  const daftar = Object.keys(kode);
  if (daftar.length === 1) return { kode: daftar[0], status: 'cocok', calon: daftar };
  return { kode: '', status: daftar.length > 1 ? 'ambigu' : 'tidak', calon: daftar.slice(0, 8) };
}

/** Tambahkan hasil pengecekan ke tiap baris: kodeStatus, convert ('ada' | 'tidak'), pokok (nama resmi di Convert_material), master ('ada' | 'tidak'). */
function c37Periksa_(rows, ruj) {
  return rows.map(function (b) {
    const dasar = c37Norm_(String(b.nama || '').replace(/\s-\s.*$/, '').replace(/\b(ex|bekas)\b\.?/gi, ''));
    const pokok = ruj.conv[dasar] || '';
    const o = {}; Object.keys(b).forEach(function (k) { o[k] = b[k]; });
    delete o.kodeCalon;
    if (!o.kode) {
      // urutan dari yang paling pasti: (1) nama persis ada di daftar normalisasi, (2) lewat nama setara di Convert_material, (3) awalan nama yang mirip
      const bersih = String(b.nama || '').replace(/\s-\s.*$/, '');
      const k1 = c37Kode_(bersih, true);
      if (k1.kode) { o.kode = k1.kode; o.kodeStatus = 'cocok'; o.kodeSumber = 'daftar'; }
      else {
        const k2 = c37KodeConvert_(dasar, pokok, ruj);
        if (k2.kode) { o.kode = k2.kode; o.kodeStatus = 'cocok'; o.kodeSumber = 'convert'; }
        else {
          const k3 = c37Kode_(bersih, false);
          if (k3.kode) { o.kode = k3.kode; o.kodeStatus = 'cocok'; o.kodeSumber = 'daftar'; }
          else {
            const calon = []; [k1.calon, k2.calon, k3.calon].forEach(function (a) { (a || []).forEach(function (c) { if (calon.indexOf(c) < 0) calon.push(c); }); });
            o.kodeStatus = calon.length > 1 ? 'ambigu' : 'tidak';
            if (calon.length > 1) o.kodeCalon = calon.slice(0, 8).map(function (c) { return { kode: c, uraian: c37KodeUraian_(c) }; });
          }
        }
      }
    }
    if (o.kode && !o.kodeStatus) o.kodeStatus = 'cocok';
    if (o.kode && !o.kodeSumber) o.kodeSumber = 'ketik';
    o.convert = pokok ? 'ada' : 'tidak'; o.pokok = pokok;
    o.master = ruj.master[dasar] ? 'ada' : 'tidak';
    return o;
  });
}

/**
 * Langkah 1 (hanya membaca): draf isi bon satu LH untuk ditinjau dan disunting di layar sebelum dicetak.
 * Setiap barang dicek ke daftar material (nomor normalisasi), Convert_material, dan Master_Data.
 */
function code37Siapkan(auth, lhId, jenis) {
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Code yang boleh mencetak Code 3 dan Code 7.' };
    const T = C37_SS_[String(jenis)]; if (!T) return { status: 'error', message: 'Jenis dokumen tidak dikenal.' };
    const id = String(lhId == null ? '' : lhId).trim(); if (!id) return { status: 'error', message: 'Nomor LH kosong.' };
    const M = c37Muat_(String(jenis), id); if (M.galat) return { status: 'error', message: M.galat };
    // di draf, nama dan merk/nomor seri dipisah (kolom sendiri); keduanya digabung lagi saat bon disimpan dan dicetak
    const rows = c37Periksa_(M.baris, c37Rujukan_()).map(function (o) { o.nama = o.namaDasar || o.nama; o.catAsli = o.catatan || ''; delete o.namaDasar; return o; });
    // saran nomor bon: nomor LH ini bila sudah pernah dicetak, kalau belum nomor terbesar + 1 (kosong bila spreadsheet tujuan tidak terbaca)
    let saran = '';
    try {
      const sh = SpreadsheetApp.openById(T.id).getSheetByName(T.tab);
      if (sh && sh.getLastRow() > 1) { let maks = 0, lama = ''; sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (x) { const n = parseInt(x[1], 10); if (isFinite(n) && n > maks) maks = n; if (String(x[2]).trim() === id && !lama) lama = String(parseInt(x[1], 10)); }); saran = lama || String(maks + 1); }
    } catch (e) { saran = ''; }
    return { status: 'success', jenis: String(jenis), lhId: id, nama: M.nama, alamat: M.alamat, idPk: M.idPk, idSpk: M.idSpk, saranBon: saran, rows: rows };
  } catch (e) { return { status: 'error', message: 'Gagal: ' + String((e && e.message) || e) }; }
}

/** Periksa ulang nama-nama yang sudah disunting di layar (hanya membaca). Mengembalikan baris dengan urutan yang sama. */
function code37Periksa(auth, jenis, rows) {
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Code yang boleh mencetak Code 3 dan Code 7.' };
    if (!C37_SS_[String(jenis)]) return { status: 'error', message: 'Jenis dokumen tidak dikenal.' };
    if (!Array.isArray(rows) || rows.length > C37_BARIS_MAKS_) return { status: 'error', message: 'Isi tabel tidak valid.' };
    const bersih = rows.map(function (x) { x = x || {}; return { nama: String(x.nama == null ? '' : x.nama).slice(0, 150), kode: /^\d{7}$/.test(String(x.kode || '')) ? String(x.kode) : '' }; });
    return { status: 'success', rows: c37Periksa_(bersih, c37Rujukan_()).map(function (o) { return { kode: o.kode, kodeStatus: o.kodeStatus, kodeSumber: o.kodeSumber || '', kodeCalon: o.kodeCalon || [], convert: o.convert, pokok: o.pokok, master: o.master }; }) };
  } catch (e) { return { status: 'error', message: 'Gagal: ' + String((e && e.message) || e) }; }
}

/** Periksa baris hasil suntingan pengguna (jangan percaya layar): panjang, angka, kode 7 digit, kondisi. Terbilang dihitung ulang di sini. */
function c37Rapikan_(jenis, rows) {
  if (rows.length > C37_BARIS_MAKS_) return { galat: 'Barang terlalu banyak untuk satu bon (' + rows.length + '). Maksimal ' + C37_BARIS_MAKS_ + '.' };
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const x = rows[i] || {}, n = i + 1;
    const nama = String(x.nama == null ? '' : x.nama).trim(), satuan = String(x.satuan == null ? '' : x.satuan).trim(), kode = String(x.kode == null ? '' : x.kode).replace(/\s/g, '');
    if (!nama && !satuan && !kode && !String(x.jumlah == null ? '' : x.jumlah).trim()) continue;   // baris kosong dilewati
    if (!nama) return { galat: 'Baris ' + n + ': nama barang kosong.' };
    if (nama.length > 150) return { galat: 'Baris ' + n + ': nama barang terlalu panjang (maksimal 150 huruf).' };
    if (satuan.length > 12) return { galat: 'Baris ' + n + ': satuan terlalu panjang.' };
    if (kode && !/^\d{7}$/.test(kode)) return { galat: 'Baris ' + n + ': nomor normalisasi harus 7 angka atau dikosongkan.' };
    const jml = c37Angka_(x.jumlah);
    if (!(jml > 0) || jml > 999999) return { galat: 'Baris ' + n + ': jumlah harus lebih dari 0.' };
    let kondisi = '';
    if (jenis === 'code3') { kondisi = parseInt(x.kondisi, 10); if ([1, 2, 3].indexOf(kondisi) < 0) return { galat: 'Baris ' + n + ': kondisi barang harus 1 (rusak), 2 (masih dapat dipergunakan), atau 3 (baru).' }; }
    const cat = String(x.catatan == null ? '' : x.catatan).trim().slice(0, 200);
    // merk/nomor seri selalu ikut tercetak di nama barang (kecuali sudah tertulis di nama)
    const namaCetak = cat && c37Norm_(nama).indexOf(c37Norm_(cat)) < 0 ? nama + ' - ' + cat : nama;
    out.push({ no: out.length + 1, kode: kode, kodeStatus: kode ? 'cocok' : 'tidak', nama: namaCetak, satuan: satuan, jumlah: jml, terbilang: c37Terbilang_(jml), kondisi: kondisi, catatan: cat });
  }
  return { rows: out };
}

function c37Tgl_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Makassar', 'yyyy-MM-dd') : String(v == null ? '' : v).slice(0, 10); }

/**
 * Cetak satu LH. jenis: 'code3' | 'code7'. noBon: nomor bon (angka, opsional). Kosong = lanjutan dari nomor terbesar di tab,
 * atau nomor yang sudah dipakai LH ini bila pernah dicetak.
 */
function code37CetakAsli_(auth, lhId, jenis, noBon, rowsEdit, meta) {
  const lock = LockService.getScriptLock(); let terkunci = false;
  const galat = function (p) { return { status: 'error', message: p }; };
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return galat('Hanya Super Admin dan Admin Code yang boleh mencetak Code 3 dan Code 7.');
    const T = C37_SS_[String(jenis)]; if (!T) return galat('Jenis dokumen tidak dikenal.');
    // dokumen manual (di luar LH): nomornya MAN-0001 dst., dipisah dari LH sehingga tidak masuk daftar LH, PK, atau SPK manapun
    const manual = !!(meta && meta.manual === true);
    let id = String(lhId == null ? '' : lhId).trim();
    if (manual) { if (id && !/^MAN-\d{4,7}$/.test(id)) return galat('Nomor dokumen manual tidak valid.'); if (!Array.isArray(rowsEdit)) return galat('Isi bon manual kosong.'); }
    else { if (!id) return galat('Nomor LH kosong.'); if (/^MAN-/i.test(id)) return galat('Nomor itu milik dokumen manual, bukan LH.'); }
    let bon = String(noBon == null ? '' : noBon).trim();
    if (bon !== '' && !/^\d{1,6}$/.test(bon)) return galat('Nomor bon hanya boleh angka, maksimal 6 digit.');

    lock.waitLock(20000); terkunci = true;
    let M;
    if (manual) {
      const nm = String(meta.nama == null ? '' : meta.nama).trim(), al = String(meta.alamat == null ? '' : meta.alamat).trim();
      if (!nm) return galat('Nama pekerjaan wajib diisi untuk Code manual.');
      if (nm.length > 150) return galat('Nama pekerjaan terlalu panjang (maksimal 150 huruf).');
      if (al.length > 200) return galat('Alamat terlalu panjang (maksimal 200 huruf).');
      M = { baris: [], idPk: '', idSpk: '', nama: nm, alamat: al, tanggal: '', T: T };
    } else { M = c37Muat_(String(jenis), id); if (M.galat) return galat(M.galat); }
    let baris = Array.isArray(rowsEdit) ? M.baris : c37Periksa_(M.baris, c37Rujukan_());   // cetak langsung tanpa tinjau: nomor tetap dicari lewat Convert_material
    if (Array.isArray(rowsEdit)) {   // isi tabel yang sudah disesuaikan pengguna: diperiksa ulang di server, terbilang dihitung ulang
      const x = c37Rapikan_(String(jenis), rowsEdit); if (x.galat) return galat(x.galat);
      baris = x.rows;
    }
    if (!baris.length) return galat(Array.isArray(rowsEdit) ? 'Bon tidak punya barang. Isi minimal satu baris.' : 'LH ' + id + ' tidak punya barang untuk ' + T.nama + (jenis === 'code3' ? ' (retur bekas kosong).' : ' (tidak ada material MDU bercatatan bekas atau ex).'));
    if (baris.length > C37_BARIS_MAKS_) return galat('Barang terlalu banyak untuk satu bon (' + baris.length + '). Maksimal ' + C37_BARIS_MAKS_ + '.');
    const idPk = M.idPk, idSpk = M.idSpk, nama = M.nama, alamat = M.alamat, cTg = 0, r = [M.tanggal];

    // --- spreadsheet tujuan ---
    let ss;
    try { ss = SpreadsheetApp.openById(T.id); } catch (e) { return galat('Arsip ' + T.nama + ' tidak bisa dibuka. Pastikan akun pemilik aplikasi punya akses edit. (' + String((e && e.message) || e) + ')'); }
    let sh = ss.getSheetByName(T.tab);
    if (!sh) { sh = ss.insertSheet(T.tab); sh.getRange(1, 1, 1, C37_KOLOM_.length).setValues([C37_KOLOM_]).setFontWeight('bold'); sh.setFrozenRows(1); }
    const kepala = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), C37_KOLOM_.length)).getValues()[0];
    if (C37_KOLOM_.some(function (k, i) { return String(kepala[i]).trim() !== k; })) return galat('Bagian ' + T.tab + ' di arsip ' + T.nama + ' sudah ada tetapi susunan kolomnya berbeda. Ganti namanya atau hapus bagian itu, supaya data lain tidak tertimpa.');
    const n0 = sh.getLastRow();
    const lama = n0 > 1 ? sh.getRange(2, 1, n0 - 1, C37_KOLOM_.length).getValues() : [];
    const iBon = 1, iLh = 2;
    if (manual && !id) { let mx = 0; lama.forEach(function (x) { const mm = /^MAN-(\d{4,7})$/.exec(String(x[iLh]).trim()); if (mm && parseInt(mm[1], 10) > mx) mx = parseInt(mm[1], 10); }); const nx = String(mx + 1); id = 'MAN-' + (nx.length < 4 ? ('0000' + nx).slice(-4) : nx); }
    const barisLama = []; let bonLama = '', maks = 0;
    lama.forEach(function (x, i) { const nb = parseInt(x[iBon], 10); if (isFinite(nb) && nb > maks) maks = nb; if (String(x[iLh]).trim() === id) { barisLama.push(i + 2); if (!bonLama) bonLama = String(x[iBon]); } });
    if (bon === '') bon = bonLama || String(maks + 1);
    // nomor bon tidak boleh dipakai LH lain
    if (lama.some(function (x) { return String(parseInt(x[iBon], 10)) === String(parseInt(bon, 10)) && String(x[iLh]).trim() !== id; })) return galat('Nomor bon ' + bon + ' sudah dipakai LH lain di ' + T.nama + '. Pilih nomor lain.');

    const waktu = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm');
    const nilai = baris.map(function (b) {
      return [waktu, kmnBersih_(String(parseInt(bon, 10))), kmnBersih_(id), b.no, b.kode, kmnBersih_(b.nama), kmnBersih_(b.satuan), b.jumlah, b.terbilang, b.kondisi, kmnBersih_(b.catatan), kmnBersih_(nama), kmnBersih_(alamat), kmnBersih_(idPk), kmnBersih_(idSpk), kmnBersih_(who.id)];
    });
    const awal = Math.max(sh.getLastRow(), 1) + 1;
    sh.getRange(awal, 2, nilai.length, 1).setNumberFormat('@');   // nomor bon dan kode 7 digit disimpan sebagai teks supaya tidak berubah bentuk
    sh.getRange(awal, 5, nilai.length, 1).setNumberFormat('@');
    sh.getRange(awal, 1, nilai.length, C37_KOLOM_.length).setValues(nilai);
    SpreadsheetApp.flush();
    const cek = sh.getRange(awal, 1, nilai.length, C37_KOLOM_.length).getValues();
    const salah = cek.some(function (x, i) { return String(x[iLh]) !== id || String(x[4]) !== String(nilai[i][4]) || String(x[5]) !== String(nilai[i][5]) || String(x[iBon]) !== String(nilai[i][iBon]); });
    if (salah) { try { sh.deleteRows(awal, nilai.length); } catch (e) { /* pemulihan terbaik */ } return galat('Penulisan ke ' + T.nama + ' tidak terverifikasi, data TIDAK berubah. Coba lagi.'); }
    // baru sekarang baris lama (cetak sebelumnya untuk LH ini) dibuang, dari bawah ke atas
    barisLama.sort(function (a, b) { return b - a; }).forEach(function (n) { sh.deleteRow(n); });
    SpreadsheetApp.flush();
    const akhir = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().filter(function (x) { return String(x[iLh]).trim() === id; }).length : 0;
    if (akhir !== nilai.length) return galat('Arsip ' + T.nama + ' berisi ' + akhir + ' baris untuk LH ' + id + ', seharusnya ' + nilai.length + '. Periksa arsip ' + T.nama + ' sebelum mencetak ulang.');

    // merk/nomor seri di LH yang tidak muncul lagi di bon (dihapus atau diganti saat disunting): diberitahukan ke pengguna
    const catatanBeda = M.baris.map(function (b) { return String(b.catatan || '').trim(); }).filter(function (c) {
      return c && !baris.some(function (b) { return c37Norm_(String(b.catatan || '') + ' ' + String(b.nama || '')).indexOf(c37Norm_(c)) >= 0; });
    });
    return {
      status: 'success', terverifikasi: true, manual: manual, catatanBeda: catatanBeda, jenis: String(jenis), lhId: id, noBon: String(parseInt(bon, 10)), tanggal: cTg >= 0 ? c37Tgl_(r[cTg]) : '',
      nama: nama, alamat: alamat, idPk: idPk, idSpk: idSpk, rows: baris, tanpaKode: baris.filter(function (b) { return !b.kode; }).length,
      url: ss.getUrl() + '#gid=' + sh.getSheetId(), oleh: who.name
    };
  } catch (e) {
    return galat('Gagal: ' + String((e && e.message) || e));
  } finally { if (terkunci) { try { lock.releaseLock(); } catch (x) { /* abaikan */ } } }
}

// ---------- dokumen manual (Code 3/7 di luar LH) ----------
function c37Waktu_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Makassar', 'yyyy-MM-dd HH:mm') : String(v == null ? '' : v); }

/** Daftar dokumen manual (hanya membaca): dikelompokkan per nomor MAN-xxxx di tab Code 3 dan Code 7. Tidak pernah tercampur dengan LH. */
function code37ManualDaftar(auth) {
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Code yang boleh melihat Code manual.' };
    const out = [];
    ['code3', 'code7'].forEach(function (j) {
      const T = C37_SS_[j]; let sh = null;
      try { sh = SpreadsheetApp.openById(T.id).getSheetByName(T.tab); } catch (e) { return; }
      if (!sh || sh.getLastRow() < 2) return;
      const v = sh.getRange(2, 1, sh.getLastRow() - 1, C37_KOLOM_.length).getValues(), g = {};
      v.forEach(function (x) {
        const id = String(x[2]).trim(); if (!/^MAN-\d{4,7}$/.test(id)) return;
        const e = g[id] || (g[id] = { jenis: j, id: id, bon: String(x[1]), waktu: c37Waktu_(x[0]), nama: String(x[11]), alamat: String(x[12]), n: 0, oleh: String(x[15]) });
        e.n++;
      });
      Object.keys(g).forEach(function (k) { out.push(g[k]); });
    });
    out.sort(function (a, b) { return a.waktu < b.waktu ? 1 : (a.waktu > b.waktu ? -1 : 0); });
    return { status: 'success', rows: out };
  } catch (e) { return { status: 'error', message: 'Gagal: ' + String((e && e.message) || e) }; }
}

/** Isi satu dokumen manual untuk dibuka lagi di layar (hanya membaca). */
function code37ManualMuat(auth, jenis, id) {
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Code yang boleh membuka Code manual.' };
    const T = C37_SS_[String(jenis)]; if (!T) return { status: 'error', message: 'Jenis dokumen tidak dikenal.' };
    id = String(id == null ? '' : id).trim(); if (!/^MAN-\d{4,7}$/.test(id)) return { status: 'error', message: 'Nomor dokumen manual tidak valid.' };
    let sh; try { sh = SpreadsheetApp.openById(T.id).getSheetByName(T.tab); } catch (e) { return { status: 'error', message: 'Arsip ' + T.nama + ' tidak bisa dibuka.' }; }
    if (!sh || sh.getLastRow() < 2) return { status: 'error', message: 'Dokumen ' + id + ' tidak ditemukan.' };
    const v = sh.getRange(2, 1, sh.getLastRow() - 1, C37_KOLOM_.length).getValues().filter(function (x) { return String(x[2]).trim() === id; });
    if (!v.length) return { status: 'error', message: 'Dokumen ' + id + ' tidak ditemukan.' };
    const rows = v.map(function (x) {
      const cat = String(x[10] || '').trim(); let nm = String(x[5] || '');
      if (cat && nm.slice(-(cat.length + 3)) === ' - ' + cat) nm = nm.slice(0, nm.length - cat.length - 3);
      return { nama: nm, catatan: cat, kode: String(x[4] || ''), satuan: String(x[6] || ''), jumlah: x[7], kondisi: x[9] === '' ? '' : Number(x[9]) };
    });
    return { status: 'success', jenis: String(jenis), id: id, bon: String(parseInt(v[0][1], 10)), nama: String(v[0][11]), alamat: String(v[0][12]), rows: rows };
  } catch (e) { return { status: 'error', message: 'Gagal: ' + String((e && e.message) || e) }; }
}

// ---------- daftar penandatangan (tanda tangan di cetakan), dikelola Admin Code dan Super Admin ----------
const C37_PD_TAB_ = 'Daftar_Penanda_Code';
const C37_PD_KOLOM_ = ['ID', 'Jenis', 'Pengembali', 'Pemeriksa', 'Setuju', 'Kepala_Gudang', 'Diubah_Oleh', 'Waktu'];
const C37_PD_MAKS_ = 100;
// isi awal: daftar dari Admin Code [jenis, pengembali, pemeriksa, setuju, kepala gudang]
const C37_PD_AWAL_ = [
  ['PFK BATAN TM', 'MADE JUNIARTHA', 'GEDE PASEK GUNAWAN', 'I NYOMAN SUGIARTA', 'KADEK WANTARA'],
  ['PFK MGW TR', 'I.B BUJANGGA', 'AGUS DIAN JAYA', 'I NYOMAN SUGIARTA', 'KADEK WANTARA'],
  ['PFK TBN TR', 'DONI HERMAWAN', 'PUTU VIRIYA SAMVARA', 'I NYOMAN SUGIARTA', 'KADEK WANTARA'],
  ['HAR TBN', 'AGUNG ADI WIARTAWAN', 'PUTU VIRIYA SAMVARA', 'I NYOMAN SUGIARTA', 'KADEK WANTARA'],
  ['HAR MGW', 'DEWA WIRA ARSANA', 'AGUS DIAN JAYA', 'I NYOMAN SUGIARTA', 'KADEK WANTARA']
];
function c37PdSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(C37_PD_TAB_);
  if (!sh) {
    sh = ss.insertSheet(C37_PD_TAB_);
    sh.getRange(1, 1, 1, C37_PD_KOLOM_.length).setValues([C37_PD_KOLOM_]).setFontWeight('bold'); sh.setFrozenRows(1);
    const waktu = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm');
    const isi = C37_PD_AWAL_.map(function (x, i) { return ['PTD-' + ('000' + (i + 1)).slice(-3), x[0], x[1], x[2], x[3], x[4], 'sistem', waktu]; });
    sh.getRange(2, 1, isi.length, C37_PD_KOLOM_.length).setValues(isi);
    SpreadsheetApp.flush();
  }
  return sh;
}
function c37PdBaca_(sh) {
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, C37_PD_KOLOM_.length).getValues().filter(function (x) { return String(x[0]).trim() !== ''; }).map(function (x) {
    return { id: String(x[0]).trim(), jenis: String(x[1]), pengembali: String(x[2]), pemeriksa: String(x[3]), setuju: String(x[4]), kepalaGudang: String(x[5]) };
  });
}
function code37Penanda(auth) {
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Code yang boleh membuka daftar penandatangan.' };
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try { return { status: 'success', rows: c37PdBaca_(c37PdSheet_()) }; } finally { try { lock.releaseLock(); } catch (x) { /* abaikan */ } }
  } catch (e) { return { status: 'error', message: 'Gagal: ' + String((e && e.message) || e) }; }
}
/** Tambah (tanpa id) atau ubah (dengan id) satu penandatangan. Ditulis lalu dibaca ulang. */
function code37PenandaSimpanAsli_(auth, item) {
  const lock = LockService.getScriptLock(); let terkunci = false;
  const galat = function (p) { return { status: 'error', message: p }; };
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return galat('Hanya Super Admin dan Admin Code yang boleh mengubah daftar penandatangan.');
    item = item || {};
    const f = function (k, maks) { return String(item[k] == null ? '' : item[k]).replace(/\s+/g, ' ').trim().slice(0, maks); };
    const jenis = f('jenis', 40), pg = f('pengembali', 60), pm = f('pemeriksa', 60), st = f('setuju', 60), kg = f('kepalaGudang', 60);
    if (!jenis) return galat('Nama jenis (misalnya HAR TBN) wajib diisi.');
    if (!pg && !pm && !st && !kg) return galat('Isi minimal satu nama penandatangan.');
    const idIn = String(item.id == null ? '' : item.id).trim();
    if (idIn && !/^PTD-\d{3,}$/.test(idIn)) return galat('Nomor penandatangan tidak valid.');
    lock.waitLock(20000); terkunci = true;
    const sh = c37PdSheet_(); const daftar = c37PdBaca_(sh);
    if (daftar.some(function (d) { return d.id !== idIn && d.jenis.toLowerCase() === jenis.toLowerCase(); })) return galat('Jenis ' + jenis + ' sudah ada di daftar. Ubah yang sudah ada atau pakai nama lain.');
    const waktu = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm');
    const baris = [idIn, kmnBersih_(jenis), kmnBersih_(pg), kmnBersih_(pm), kmnBersih_(st), kmnBersih_(kg), kmnBersih_(who.id), waktu];
    let id = idIn;
    if (idIn) {
      const v = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues(); let n = -1;
      v.forEach(function (x, i) { if (String(x[0]).trim() === idIn) n = i + 2; });
      if (n < 0) return galat('Penandatangan ' + idIn + ' tidak ditemukan. Muat ulang daftar.');
      sh.getRange(n, 1, 1, C37_PD_KOLOM_.length).setValues([baris]);
    } else {
      if (daftar.length >= C37_PD_MAKS_) return galat('Daftar penuh (maksimal ' + C37_PD_MAKS_ + ').');
      let mx = 0; daftar.forEach(function (d) { const m = /^PTD-(\d+)$/.exec(d.id); if (m && parseInt(m[1], 10) > mx) mx = parseInt(m[1], 10); });
      id = 'PTD-' + ('000' + (mx + 1)).slice(-3); baris[0] = id;
      sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, 1, C37_PD_KOLOM_.length).setValues([baris]);
    }
    SpreadsheetApp.flush();
    const akhir = c37PdBaca_(sh), c = akhir.filter(function (d) { return d.id === id; })[0];
    if (!c || c.jenis.trim() !== jenis || c.pengembali.trim() !== pg) return galat('Penyimpanan tidak terverifikasi. Muat ulang daftar lalu periksa.');
    return { status: 'success', terverifikasi: true, id: id, baru: !idIn, jenis: jenis, rows: akhir };
  } catch (e) { return galat('Gagal: ' + String((e && e.message) || e)); }
  finally { if (terkunci) { try { lock.releaseLock(); } catch (x) { /* abaikan */ } } }
}
function code37PenandaHapusAsli_(auth, id) {
  const lock = LockService.getScriptLock(); let terkunci = false;
  const galat = function (p) { return { status: 'error', message: p }; };
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return galat('Hanya Super Admin dan Admin Code yang boleh mengubah daftar penandatangan.');
    id = String(id == null ? '' : id).trim(); if (!/^PTD-\d{3,}$/.test(id)) return galat('Nomor penandatangan tidak valid.');
    lock.waitLock(20000); terkunci = true;
    const sh = c37PdSheet_(); const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : []; let n = -1;
    v.forEach(function (x, i) { if (String(x[0]).trim() === id) n = i + 2; });
    if (n < 0) return galat('Penandatangan ' + id + ' tidak ditemukan.');
    sh.deleteRow(n); SpreadsheetApp.flush();
    const akhir = c37PdBaca_(sh);
    if (akhir.some(function (d) { return d.id === id; })) return galat('Penghapusan tidak terverifikasi. Muat ulang daftar lalu periksa.');
    return { status: 'success', terverifikasi: true, id: id, rows: akhir };
  } catch (e) { return galat('Gagal: ' + String((e && e.message) || e)); }
  finally { if (terkunci) { try { lock.releaseLock(); } catch (x) { /* abaikan */ } } }
}

// ---------- kelola daftar nomor normalisasi (tab Daftar_Normalisasi) ----------
function c37NormTampil_(sh) { return c37NormBaca_(sh).map(function (m) { return { kode: m[0], deskripsi: m[1], pendek: m[2] }; }); }
/** Baca daftar untuk layar. Tab dibuat dan diisi awal bila belum ada. Hanya Super Admin dan Admin Code. */
function code37NormDaftar(auth) {
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Code yang boleh membuka daftar nomor normalisasi.' };
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try { const rows = c37NormTampil_(c37NormSheet_(true)); return { status: 'success', rows: rows, maks: C37_NORM_MAKS_ }; } finally { try { lock.releaseLock(); } catch (x) { /* abaikan */ } }
  } catch (e) { return { status: 'error', message: 'Gagal: ' + String((e && e.message) || e) }; }
}
/**
 * Jalankan dari editor Apps Script (pilih fungsi ini lalu Run) untuk membuat tab Daftar_Normalisasi tanpa membuka aplikasi.
 * Aman diulang: bila tab sudah ada tidak ada yang berubah. Tidak bisa dipanggil dari browser.
 */
function siapkanDaftarNormalisasi() {
  const gerbang = kmnGerbang_(); if (gerbang) return gerbang;
  const sh = c37NormSheet_(true);
  return { status: 'success', spreadsheet: SpreadsheetApp.openById(SPREADSHEET_ID).getUrl(), tab: sh.getName(), baris: Math.max(sh.getLastRow() - 1, 0) };
}
/** Posisi baris (nomor baris di sheet) tiap kode. */
function c37NormPosisi_(sh) {
  const pos = {}; if (sh.getLastRow() < 2) return pos;
  sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (x, i) { const k = String(x[0] == null ? '' : x[0]).replace(/\s/g, ''); if (/^\d{7}$/.test(k) && !pos[k]) pos[k] = i + 2; });
  return pos;
}
function c37NormRapi_(item) {
  const f = function (k, maks) { return String(item[k] == null ? '' : item[k]).replace(/\s+/g, ' ').trim().slice(0, maks); };
  return { kode: String(item.kode == null ? '' : item.kode).replace(/\s/g, ''), deskripsi: f('deskripsi', 150), pendek: f('pendek', 100) };
}
/** Tambah (tanpa kodeLama) atau ubah (dengan kodeLama) satu nomor normalisasi. Ditulis lalu dibaca ulang. */
function code37NormSimpanAsli_(auth, item) {
  const lock = LockService.getScriptLock(); let terkunci = false;
  const galat = function (p) { return { status: 'error', message: p }; };
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return galat('Hanya Super Admin dan Admin Code yang boleh mengubah daftar nomor normalisasi.');
    item = item || {};
    const x = c37NormRapi_(item), lama = String(item.kodeLama == null ? '' : item.kodeLama).replace(/\s/g, '');
    if (!/^\d{7}$/.test(x.kode)) return galat('Nomor normalisasi harus 7 angka.');
    if (lama && !/^\d{7}$/.test(lama)) return galat('Nomor lama tidak valid.');
    if (!x.deskripsi && !x.pendek) return galat('Isi deskripsi atau nama pendek material.');
    lock.waitLock(20000); terkunci = true;
    const sh = c37NormSheet_(true), pos = c37NormPosisi_(sh);
    const waktu = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm');
    const baris = [x.kode, kmnBersih_(x.deskripsi), kmnBersih_(x.pendek), kmnBersih_(who.id), waktu];
    let n;
    if (lama) {
      n = pos[lama]; if (!n) return galat('Nomor ' + lama + ' tidak ditemukan. Muat ulang daftar.');
      if (x.kode !== lama && pos[x.kode]) return galat('Nomor ' + x.kode + ' sudah ada di daftar.');
    } else {
      if (pos[x.kode]) return galat('Nomor ' + x.kode + ' sudah ada di daftar. Ubah yang sudah ada.');
      if (Object.keys(pos).length >= C37_NORM_MAKS_) return galat('Daftar penuh (maksimal ' + C37_NORM_MAKS_ + ').');
      n = Math.max(sh.getLastRow(), 1) + 1;
    }
    sh.getRange(n, 1, 1, 1).setNumberFormat('@');
    sh.getRange(n, 1, 1, C37_NORM_KOLOM_.length).setValues([baris]);
    SpreadsheetApp.flush(); C37_NORM_CACHE_ = null;
    const cek = sh.getRange(n, 1, 1, 3).getValues()[0];
    if (String(cek[0]).trim() !== x.kode || String(cek[1]).trim() !== String(baris[1]).trim() || String(cek[2]).trim() !== String(baris[2]).trim()) return galat('Penyimpanan tidak terverifikasi. Muat ulang daftar lalu periksa.');
    return { status: 'success', terverifikasi: true, kode: x.kode, baru: !lama, rows: c37NormTampil_(sh) };
  } catch (e) { return galat('Gagal: ' + String((e && e.message) || e)); }
  finally { if (terkunci) { try { lock.releaseLock(); } catch (z) { /* abaikan */ } } }
}
function code37NormHapusAsli_(auth, kode) {
  const lock = LockService.getScriptLock(); let terkunci = false;
  const galat = function (p) { return { status: 'error', message: p }; };
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return galat('Hanya Super Admin dan Admin Code yang boleh mengubah daftar nomor normalisasi.');
    kode = String(kode == null ? '' : kode).replace(/\s/g, ''); if (!/^\d{7}$/.test(kode)) return galat('Nomor normalisasi tidak valid.');
    lock.waitLock(20000); terkunci = true;
    const sh = c37NormSheet_(true), n = c37NormPosisi_(sh)[kode];
    if (!n) return galat('Nomor ' + kode + ' tidak ditemukan.');
    sh.deleteRow(n); SpreadsheetApp.flush(); C37_NORM_CACHE_ = null;
    if (c37NormPosisi_(sh)[kode]) return galat('Penghapusan tidak terverifikasi. Muat ulang daftar lalu periksa.');
    return { status: 'success', terverifikasi: true, kode: kode, rows: c37NormTampil_(sh) };
  } catch (e) { return galat('Gagal: ' + String((e && e.message) || e)); }
  finally { if (terkunci) { try { lock.releaseLock(); } catch (z) { /* abaikan */ } } }
}
/**
 * Impor banyak sekaligus dari teks yang ditempel (salinan dari Excel: kolom dipisah tab atau titik koma): Kode, Deskripsi, Nama pendek.
 * Kode yang sudah ada diperbarui, yang belum ada ditambahkan. Baris tidak valid dilewati dan dilaporkan (10 pertama).
 */
function code37NormImporAsli_(auth, teks) {
  const lock = LockService.getScriptLock(); let terkunci = false;
  const galat = function (p) { return { status: 'error', message: p }; };
  try {
    const who = ktkWho_(auth);
    if (C37_ROLES_.indexOf(String(who.role)) < 0) return galat('Hanya Super Admin dan Admin Code yang boleh mengubah daftar nomor normalisasi.');
    const baris = String(teks == null ? '' : teks).split(/\r?\n/).filter(function (s) { return s.trim() !== ''; });
    if (!baris.length) return galat('Tidak ada baris untuk diimpor.');
    if (baris.length > 2000) return galat('Terlalu banyak baris sekaligus (' + baris.length + '). Maksimal 2000; bagi menjadi beberapa kali impor.');
    const baru = [], tolak = []; const lihat = {};
    baris.forEach(function (s, i) {
      const k = s.split(/\t|;/); const kode = String(k[0] || '').replace(/\s/g, '');
      if (!/^\d{7}$/.test(kode)) { if (i > 0 || /\d/.test(kode)) tolak.push('Baris ' + (i + 1) + ': nomor "' + String(k[0] || '').slice(0, 20) + '" bukan 7 angka'); return; }   // baris judul (pertama, tanpa angka) dilewati tanpa laporan
      const x = c37NormRapi_({ kode: kode, deskripsi: k[1], pendek: k[2] });
      if (!x.deskripsi && !x.pendek) { tolak.push('Baris ' + (i + 1) + ': deskripsi dan nama pendek kosong'); return; }
      lihat[kode] = x;   // kode ganda di tempelan: yang terakhir dipakai
    });
    Object.keys(lihat).forEach(function (k) { baru.push(lihat[k]); });
    if (!baru.length) return galat('Tidak ada baris valid. Format: Kode (7 angka) [tab atau ;] Deskripsi [tab atau ;] Nama pendek. ' + tolak.slice(0, 3).join('; '));
    lock.waitLock(20000); terkunci = true;
    const sh = c37NormSheet_(true), pos = c37NormPosisi_(sh);
    const waktu = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm');
    const tambah = [], ubah = [];
    baru.forEach(function (x) { const b = [x.kode, kmnBersih_(x.deskripsi), kmnBersih_(x.pendek), kmnBersih_(who.id), waktu]; if (pos[x.kode]) ubah.push({ n: pos[x.kode], b: b }); else tambah.push(b); });
    if (Object.keys(pos).length + tambah.length > C37_NORM_MAKS_) return galat('Daftar akan melebihi ' + C37_NORM_MAKS_ + ' baris. Tidak ada yang diubah.');
    ubah.forEach(function (u) { sh.getRange(u.n, 1, 1, 1).setNumberFormat('@'); sh.getRange(u.n, 1, 1, C37_NORM_KOLOM_.length).setValues([u.b]); });
    if (tambah.length) { const awal = Math.max(sh.getLastRow(), 1) + 1; sh.getRange(awal, 1, tambah.length, 1).setNumberFormat('@'); sh.getRange(awal, 1, tambah.length, C37_NORM_KOLOM_.length).setValues(tambah); }
    SpreadsheetApp.flush(); C37_NORM_CACHE_ = null;
    const akhir = c37NormPosisi_(sh);
    const hilang = baru.filter(function (x) { return !akhir[x.kode]; });
    if (hilang.length) return galat('Impor tidak terverifikasi: ' + hilang.length + ' nomor tidak ditemukan sesudah ditulis. Muat ulang daftar lalu periksa.');
    return { status: 'success', terverifikasi: true, ditambah: tambah.length, diubah: ubah.length, dilewati: tolak.length, catatan: tolak.slice(0, 10), rows: c37NormTampil_(sh) };
  } catch (e) { return galat('Gagal: ' + String((e && e.message) || e)); }
  finally { if (terkunci) { try { lock.releaseLock(); } catch (z) { /* abaikan */ } } }
}
