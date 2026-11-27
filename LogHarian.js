/**
 * LOG HARIAN - sambungan ke tabel Google Sheets eksternal (log pekerjaan harian dari lapangan).
 * Aplikasi hanya MEMBACA tabel itu. Akun yang men-deploy web app ("Execute as: Me") harus punya akses ke tabelnya.
 * Tidak memakai literal BigInt. Hak akses: Super Admin, Admin PK, Admin SPK.
 */
const LOG_SS_ID_ = '1pbulgLKwVkxvjEE0a6-_sz_y9j3uWnCHGzFNbcM_WIs';
const LOG_ROLES_ = ['Super Admin', 'Admin PK', 'Admin SPK'];
const LOG_PROP_ = 'LOG_HARIAN_CONFIG';

// Peran dibaca dari sesi di server (token), BUKAN dari `role` kiriman layar yang bisa dipalsukan. `role` dipertahankan hanya agar tanda tangan fungsi lama sama.
function logAuth_(role, auth) {
  // fungsi tulis dipanggil lewat pembungkus Jejak.js, yang sudah memeriksa sesi dan menaruh pelaku di JEJAK_PELAKU_
  const w = (auth === undefined && JEJAK_PELAKU_) ? { ok: true, who: JEJAK_PELAKU_ } : jejakWho_(auth); if (!w.ok) throw new Error(w.galat.message);
  if (LOG_ROLES_.indexOf(String(w.who.role)) < 0) throw new Error('Log harian hanya untuk Super Admin, Admin PK, dan Admin SPK.');
}

function logOpen_() {
  try { return SpreadsheetApp.openById(LOG_SS_ID_); }
  catch (e) { throw new Error('Tabel log harian tidak bisa dibuka. Pastikan akun yang men-deploy aplikasi punya akses ke tabel itu. (' + e.message + ')'); }
}

/** Cari baris judul kolom: baris pertama (dalam 10 baris awal) yang terisi >= 3 sel. */
function logHeaderRow_(vals) {
  for (let i = 0; i < Math.min(vals.length, 10); i++) {
    const n = vals[i].filter(function (c) { return String(c).trim() !== ''; }).length;
    if (n >= 3) return i;
  }
  return 0;
}

/**
 * Daftar tab, judul kolom, dan 3 baris contoh. Dipakai layar Pengaturan dan untuk memeriksa koneksi.
 * Bisa juga dijalankan dari editor Apps Script (Run > logInfo) lalu lihat Execution log.
 */
function logInfo(role, auth) {
  try {
    if (role === undefined && auth === undefined) { const g = kmnGerbang_(); if (g) return g; }   // dari editor: hanya saat pemeliharaan dibuka
    else logAuth_(role, auth);
    const ss = logOpen_();
    const sheets = ss.getSheets().map(function (sh) {
      const lr = sh.getLastRow(), lc = sh.getLastColumn();
      let headers = [], sample = [], hrow = 0;
      if (lr > 0 && lc > 0) {
        const top = sh.getRange(1, 1, Math.min(lr, 14), lc).getDisplayValues();
        hrow = logHeaderRow_(top);
        headers = top[hrow].map(function (h) { return String(h).trim(); });
        sample = top.slice(hrow + 1, hrow + 4);
      }
      return { name: sh.getName(), rows: Math.max(0, lr - hrow - 1), cols: lc, headerRow: hrow + 1, headers: headers, sample: sample };
    });
    if (role === undefined && auth === undefined) Logger.log(JSON.stringify(sheets, null, 1));
    return { status: 'success', title: ss.getName(), sheets: sheets };
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}

/**
 * Baca satu tab. Mengembalikan judul kolom dan baris TERBARU (baris paling bawah dulu), maksimal `limit` baris.
 * Setiap baris: { n: nomor baris di sheet, v: [nilai teks per kolom] }.
 */
function logRead(role, sheetName, limit, auth) {
  try {
    logAuth_(role, auth);
    const ss = logOpen_();
    const sh = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
    if (!sh) return { status: 'error', message: 'Bagian "' + sheetName + '" tidak ada di tabel log.' };
    const lr = sh.getLastRow(), lc = sh.getLastColumn();
    if (lr < 2 || lc < 1) return { status: 'success', sheet: sh.getName(), headers: [], rows: [], total: 0 };
    const top = sh.getRange(1, 1, Math.min(lr, 10), lc).getDisplayValues();
    const hrow = logHeaderRow_(top);
    const headers = top[hrow].map(function (h) { return String(h).trim(); });
    const first = hrow + 2; // baris data pertama (nomor baris sheet, mulai 1)
    const total = Math.max(0, lr - first + 1);
    const max = Math.min(Number(limit) || 2000, 5000);
    const start = Math.max(first, lr - max + 1);
    const data = total > 0 ? sh.getRange(start, 1, lr - start + 1, lc).getDisplayValues() : [];
    const rows = [];
    for (let i = data.length - 1; i >= 0; i--) {
      const v = data[i];
      if (v.every(function (c) { return String(c).trim() === ''; })) continue;
      rows.push({ n: start + i, v: v.map(function (c) { return String(c); }) });
    }
    return { status: 'success', sheet: sh.getName(), headers: headers, rows: rows, total: total, shown: rows.length };
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}

/**
 * Ambil beberapa tab sekaligus untuk alur "SPK > PK > log harian > buat LH".
 * Tab dicari tanpa membedakan huruf besar/kecil dan garis bawah. Tiap tab: { name, headers, rows } dengan rows = larik nilai teks,
 * baris TERBARU dulu. Tab yang tidak ada dilaporkan di `missing`.
 */
function logBundle(role, auth) {
  try {
    logAuth_(role, auth);
    const ss = logOpen_();
    const want = { Contracts: 3000, PK_Drafts: 3000, Projects: 3000, Project_Logs: 6000, Project_Materials: 8000, Project_Bongkaran: 4000, Inventory: 5000 };
    const byKey = {};
    ss.getSheets().forEach(function (sh) { byKey[sh.getName().toLowerCase().replace(/[^a-z0-9]/g, '')] = sh; });
    const out = {}, missing = [];
    Object.keys(want).forEach(function (name) {
      const sh = byKey[name.toLowerCase().replace(/[^a-z0-9]/g, '')];
      if (!sh) { missing.push(name); return; }
      const lr = sh.getLastRow(), lc = sh.getLastColumn();
      if (lr < 2 || lc < 1) { out[name] = { name: sh.getName(), headers: [], rows: [] }; return; }
      const top = sh.getRange(1, 1, Math.min(lr, 10), lc).getDisplayValues();
      const hrow = logHeaderRow_(top);
      const headers = top[hrow].map(function (h) { return String(h).trim(); });
      const first = hrow + 2;
      const start = Math.max(first, lr - want[name] + 1);
      const data = lr >= first ? sh.getRange(start, 1, lr - start + 1, lc).getDisplayValues() : [];
      const rows = [];
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].every(function (c) { return String(c).trim() === ''; })) continue;
        rows.push(data[i].map(function (c) { return String(c); }));
      }
      out[name] = { name: sh.getName(), headers: headers, rows: rows };
    });
    return { status: 'success', title: ss.getName(), tabs: out, missing: missing };
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}

/**
 * Tautkan PK aplikasi ke ProjectID tabel log (kolom 22 "ID_Sumber" di Data_PK). Patokan penautan = ID, bukan nomor PK.
 * sumberId kosong = lepas tautan. Satu ProjectID hanya boleh melekat pada satu PK.
 */
function logLinkPkAsli_(role, pkId, sumberId) {
  try {
    if (['Super Admin', 'Admin PK'].indexOf(String(role)) < 0) throw new Error('Hanya Super Admin dan Admin PK yang boleh menautkan PK.');
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_PK');
    if (!sh) throw new Error('Data PK tidak ditemukan.');
    if (!String(sh.getRange(1, 22).getValue() || '').trim()) sh.getRange(1, 22).setValue('ID_Sumber');
    const lr = sh.getLastRow();
    if (lr < 2) throw new Error('Data_PK kosong.');
    const ids = sh.getRange(2, 1, lr - 1, 1).getValues(), src = sh.getRange(2, 22, lr - 1, 1).getValues();
    let row = -1;
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(pkId).trim()) row = i;
      if (sumberId && String(src[i][0]).trim() === String(sumberId).trim() && String(ids[i][0]).trim() !== String(pkId).trim()) throw new Error('Pekerjaan ini sudah tertaut ke PK ' + ids[i][0] + '.');
    }
    if (row < 0) throw new Error('PK ' + pkId + ' tidak ditemukan.');
    sh.getRange(row + 2, 22).setValue(sumberId || '');
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}

const LOG_TOLAK_ = 'SPK_USULAN_DITOLAK';
function logDitolak_() {
  try { const raw = PropertiesService.getScriptProperties().getProperty(LOG_TOLAK_); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}
function logKey_(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

/**
 * Setujui usulan SPK dari tabel log: SPK ditulis ke Data_SPK dengan status Aktif. Hanya Super Admin dan Admin SPK.
 * item: { id, nama, nominal, tgl, ulp, vendor }
 */
function logSetujuiUsulanAsli_(role, item) {
  try {
    if (['Super Admin', 'Admin SPK'].indexOf(String(role)) < 0) throw new Error('Hanya Admin SPK yang boleh menyetujui SPK.');
    const id = String((item && item.id) || '').trim();
    if (!id) throw new Error('Nomor SPK kosong.');
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_SPK');
    if (!sh) throw new Error('Data SPK tidak ditemukan.');
    const lr = sh.getLastRow();
    if (lr > 1) {
      const vals = sh.getRange(2, 1, lr - 1, 1).getValues();
      for (let i = 0; i < vals.length; i++) if (logKey_(vals[i][0]) === logKey_(id)) throw new Error('SPK ' + id + ' sudah ada di Ruangan SPK.');
    }
    sh.appendRow([id, String(item.nama || '').trim() || 'Tanpa uraian', String(item.vendor || 'PT. NANDA NIRWANA ELEKTRIK'), Number(item.nominal) || 0, 0, 'Aktif', String(item.tgl || ''), '', String(item.ulp || ''), '']);
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}

/** Tolak usulan SPK dari tabel log: nomornya dicatat agar tidak muncul lagi. Hanya Super Admin dan Admin SPK. */
function logTolakUsulanAsli_(role, spkId) {
  try {
    if (['Super Admin', 'Admin SPK'].indexOf(String(role)) < 0) throw new Error('Hanya Admin SPK yang boleh menolak usulan.');
    const d = logDitolak_(); d[logKey_(spkId)] = String(spkId);
    PropertiesService.getScriptProperties().setProperty(LOG_TOLAK_, JSON.stringify(d));
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}

/**
 * Rekomendasi SPK untuk Ruangan SPK: nomor SPK unik dari tab Contracts tabel log (terbaru dulu).
 * Kolom dikenali dari judulnya (spk, customer/pelanggan, region/ulp, date/tanggal, nominal).
 */
function logSpkSaran(role, auth) {
  try {
    logAuth_(role, auth);
    const ss = logOpen_();
    let sh = null;
    ss.getSheets().forEach(function (s) { if (s.getName().toLowerCase().replace(/[^a-z0-9]/g, '') === 'contracts') sh = s; });
    if (!sh) return { status: 'success', list: [], note: 'Bagian Contracts tidak ditemukan di tabel log.' };
    const lr = sh.getLastRow(), lc = sh.getLastColumn();
    if (lr < 2 || lc < 1) return { status: 'success', list: [] };
    const all = sh.getRange(1, 1, lr, lc).getDisplayValues();
    const hrow = logHeaderRow_(all);
    const norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
    const heads = all[hrow].map(norm);
    const find = function (exact, part) {
      for (let i = 0; i < heads.length; i++) if (exact.indexOf(heads[i]) >= 0) return i;
      for (let j = 0; j < heads.length; j++) for (let k = 0; k < part.length; k++) if (heads[j].indexOf(part[k]) >= 0) return j;
      return -1;
    };
    const iSpk = find(['spk', 'nospk', 'nomorspk'], ['spk']);
    if (iSpk < 0) return { status: 'success', list: [], note: 'Kolom SPK tidak ditemukan di bagian Contracts.' };
    const iCus = find(['customer', 'pelanggan'], ['customer', 'pelanggan']);
    const iReg = find(['region', 'ulp', 'wilayah'], ['region']);
    const iDat = find(['date', 'tanggal'], ['date', 'tanggal']);
    const iNom = find(['nominal'], ['nominal']);
    const ditolak = logDitolak_();
    const seen = {}, list = [];
    for (let r = all.length - 1; r > hrow; r--) {
      const row = all[r];
      const id = String(row[iSpk]).trim();
      if (id.length < 3 || /^[-–—.]+$/.test(id)) continue;
      const k = norm(id); if (seen[k] || ditolak[k]) continue; seen[k] = true;
      list.push({ id: id, nama: iCus >= 0 ? String(row[iCus]).trim() : '', ulp: iReg >= 0 ? String(row[iReg]).trim() : '', tgl: iDat >= 0 ? String(row[iDat]).trim() : '', nominal: iNom >= 0 ? (Number(String(row[iNom]).replace(/[^0-9]/g, '')) || 0) : 0 });
      if (list.length >= 500) break;
    }
    return { status: 'success', list: list };
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}

/**
 * Ajukan SPK dari tabel log ke Ruangan SPK. Masuk dengan status "Menunggu persetujuan"; Admin SPK yang menyetujui.
 * list: [{ id, nama, nominal, tgl, ulp, vendor }]. SPK yang nomornya sudah ada dilewati.
 */
function logAjukanSpkAsli_(role, list) {
  try {
    logAuth_(role);
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_SPK');
    if (!sh) throw new Error('Data SPK tidak ditemukan.');
    const lr = sh.getLastRow();
    const have = {};
    if (lr > 1) sh.getRange(2, 1, lr - 1, 1).getValues().forEach(function (r) { have[String(r[0]).trim().toLowerCase()] = true; });
    const added = [];
    (list || []).slice(0, 300).forEach(function (x) {
      const id = String(x.id || '').trim();
      if (!id || have[id.toLowerCase()]) return;
      have[id.toLowerCase()] = true;
      sh.appendRow([id, String(x.nama || '').trim() || 'Tanpa uraian', String(x.vendor || 'PT. NANDA NIRWANA ELEKTRIK'), Number(x.nominal) || 0, 0, 'Menunggu persetujuan', String(x.tgl || ''), '', String(x.ulp || ''), '']);
      added.push(id);
    });
    return { status: 'success', added: added, skipped: (list || []).length - added.length };
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}

/** Setujui (status jadi Aktif) atau tolak (baris dihapus) usulan SPK. Hanya Super Admin dan Admin SPK. */
function logSetujuiSpkAsli_(role, spkId, setuju) {
  try {
    if (['Super Admin', 'Admin SPK'].indexOf(String(role)) < 0) throw new Error('Hanya Admin SPK yang boleh menyetujui SPK.');
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_SPK');
    const lr = sh.getLastRow();
    const vals = lr > 1 ? sh.getRange(2, 1, lr - 1, 6).getValues() : [];
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]).trim() !== String(spkId).trim()) continue;
      if (String(vals[i][5]).toLowerCase().indexOf('menunggu') !== 0) throw new Error('SPK ini bukan usulan yang menunggu persetujuan.');
      if (setuju) sh.getRange(i + 2, 6).setValue('Aktif'); else sh.deleteRow(i + 2);
      return { status: 'success' };
    }
    throw new Error('SPK ' + spkId + ' tidak ditemukan.');
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}

/** Pengaturan bersama (tab yang dipakai + pemetaan kolom), disimpan di Script Properties. */
function logGetConfig(role, auth) {
  try {
    logAuth_(role, auth);
    const raw = PropertiesService.getScriptProperties().getProperty(LOG_PROP_);
    return { status: 'success', config: raw ? JSON.parse(raw) : null };
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}

function logSaveConfigAsli_(role, config) {
  try {
    logAuth_(role);
    if (!config || typeof config !== 'object') return { status: 'error', message: 'Pengaturan tidak valid' };
    PropertiesService.getScriptProperties().setProperty(LOG_PROP_, JSON.stringify(config));
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.message || String(e) }; }
}
