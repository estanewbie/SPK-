/**
 * ============================================================================
 * Audit.js - Tanda "sudah diaudit" untuk LH (menu Radar audit)
 * ----------------------------------------------------------------------------
 * Tiga kolom di Data_LH (dibuat otomatis bila belum ada): Audit_Status ("Sudah" atau kosong), Audit_Oleh, Audit_Tgl.
 * Hanya Super Admin dan Admin Audit yang boleh memberi atau mencabut tanda (dicek dari token sesi, bukan dari kiriman layar).
 * LH yang bertanda "Sudah" tidak tampil lagi di daftar kerja auditor. Bila LH diubah (edit LH) atau diberi catatan temuan baru,
 * tandanya dihapus otomatis supaya LH itu diaudit lagi.
 * ============================================================================
 */

const AUDIT_ROLES_ = ['Super Admin', 'Admin Audit'];
const AUDIT_KOLOM_ = ['Audit_Status', 'Audit_Oleh', 'Audit_Tgl'];

function auditKolomIdx_(headers) {
  return AUDIT_KOLOM_.map(function (n) { return headers.findIndex(function (h) { return String(h).trim().toLowerCase() === n.toLowerCase(); }); });
}

function auditKolomIdxNama_(headers, nama) { return headers.findIndex(function (h) { return String(h).trim().toLowerCase() === String(nama).toLowerCase(); }); }

/**
 * Tulis atau hapus catatan temuan satu LH (menggantikan updateAuditNoteDb yang lama: tanpa cek login, tanpa kunci, tanpa verifikasi).
 * Temuan baru berarti LH belum beres, jadi tanda "sudah diaudit" ikut dicabut. teks kosong = hapus temuan (sudah diperbaiki).
 * Hanya Super Admin dan Admin Audit. Hasil ditulis lalu DIBACA ULANG; bila tidak sama, nilai lama dikembalikan.
 */
function auditSimpanTemuanAsli_(auth, lhId, teks) {
  const lock = LockService.getScriptLock(); let terkunci = false;
  try {
    const who = ktkWho_(auth);
    if (AUDIT_ROLES_.indexOf(String(who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Audit yang boleh menulis temuan.' };
    const id = String(lhId == null ? '' : lhId).trim(); if (!id) return { status: 'error', message: 'Nomor LH kosong.' };
    let catatan = String(teks == null ? '' : teks).replace(/\s+/g, ' ').trim();
    if (/^[=@]|^[+\-](?=[A-Za-z(@=])/.test(catatan)) catatan = 'Temuan: ' + catatan;   // awalan rumus dinetralkan (Keamanan.js)
    if (catatan.length > 1000) return { status: 'error', message: 'Catatan terlalu panjang (maksimal 1000 huruf).' };
    lock.waitLock(20000); terkunci = true;
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
    if (!sheet) return { status: 'error', message: "Data LH tidak ditemukan." };
    const data = sheet.getDataRange().getValues(); const headers = data[0].slice();
    const idCol = headers.findIndex(function (h) { const s = String(h).trim().toLowerCase(); return s === 'id_lh' || s === 'id'; });
    if (idCol < 0) return { status: 'error', message: 'Kolom ID LH tidak ditemukan.' };
    let baris = -1; for (let i = 1; i < data.length; i++) { if (String(data[i][idCol]).trim() === id) { baris = i; break; } }
    if (baris < 0) return { status: 'error', message: 'LH ' + id + ' tidak ditemukan di database.' };
    let noteCol = auditKolomIdxNama_(headers, 'Audit_Note');
    if (noteCol < 0) { headers.push('Audit_Note'); noteCol = headers.length - 1; sheet.getRange(1, noteCol + 1).setValue('Audit_Note'); }
    const cols = auditEnsureCols_(sheet, headers);
    const semua = [noteCol].concat(cols);
    const prev = semua.map(function (c) { const v = data[baris][c]; return v === undefined ? '' : v; });
    try {
      if (catatan) {
        sheet.getRange(baris + 1, noteCol + 1).setValue(catatan);
        cols.forEach(function (c) { sheet.getRange(baris + 1, c + 1).clearContent(); });   // temuan baru: tanda audit dicabut
      } else {
        sheet.getRange(baris + 1, noteCol + 1).clearContent();
      }
      SpreadsheetApp.flush();
      const r = sheet.getRange(baris + 1, 1, 1, Math.max.apply(null, semua.concat([idCol])) + 1).getValues()[0];
      const benar = String(r[idCol]).trim() === id && String(r[noteCol] == null ? '' : r[noteCol]).trim() === catatan && (!catatan || cols.every(function (c) { return String(r[c] == null ? '' : r[c]) === ''; }));
      if (!benar) throw new Error('isi database tidak sama setelah ditulis');
    } catch (e) {
      try { semua.forEach(function (c, k) { sheet.getRange(baris + 1, c + 1).setValue(prev[k]); }); } catch (x) { /* pemulihan terbaik */ }
      return { status: 'error', message: 'Penyimpanan tidak terverifikasi, data dikembalikan seperti semula (' + String(e.message || e) + '). Coba lagi.' };
    }
    return { status: 'success', terverifikasi: true, lhId: id, catatan: catatan };
  } catch (e) { return { status: 'error', message: String((e && e.message) || e) }; }
  finally { if (terkunci) { try { lock.releaseLock(); } catch (x) { /* abaikan */ } } }
}

/** Hapus tanda audit satu baris Data_LH (rowNum = nomor baris di Sheet, mulai 1). Dipanggil saat LH diberi temuan baru. */
function auditClearMark_(sheet, headers, rowNum) {
  auditKolomIdx_(headers).forEach(function (i) { if (i >= 0) sheet.getRange(rowNum, i + 1).clearContent(); });
}

/** Pastikan tiga kolom audit ada di Data_LH (dibuat di kanan bila belum). Mengubah `headers` dan mengembalikan indeks [status, oleh, tgl]. */
function auditEnsureCols_(sheet, headers) {
  const cols = auditKolomIdx_(headers).map(function (c, k) {
    if (c >= 0) return c;
    headers.push(AUDIT_KOLOM_[k]);
    sheet.getRange(1, headers.length).setValue(AUDIT_KOLOM_[k]).setFontWeight('bold').setBackground('#D9D9D9');
    return headers.length - 1;
  });
  cols.forEach(function (c) { sheet.getRange(2, c + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@'); });
  return cols;
}

/**
 * ALUR LH: dipanggil Code.js saat LH disimpan ulang (edit). hadNote = LH sedang punya catatan temuan.
 *  - LH bertemuan lalu direvisi  -> status "Revisi": revisi selesai, LH otomatis lanjut ke Admin Code (tanpa audit ulang).
 *  - LH tanpa temuan yang diedit -> tanda audit dihapus: isi LH berubah, jadi harus diaudit lagi.
 */
function auditOnLhEdited_(sheet, headers, rowNum, hadNote) {
  if (!hadNote) { auditClearMark_(sheet, headers, rowNum); return 'audit'; }
  const c = auditEnsureCols_(sheet, headers);
  sheet.getRange(rowNum, c[0] + 1).setValue('Revisi');
  sheet.getRange(rowNum, c[1] + 1).clearContent();
  sheet.getRange(rowNum, c[2] + 1).setValue(Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm'));
  return 'revisi';
}

/**
 * Beri atau cabut tanda audit. status: 'Sudah' (beri tanda) atau '' (cabut). lhIds: daftar ID LH.
 * Mengembalikan { status, jumlah, oleh, tgl }.
 */
function auditTandaiLhAsli_(auth, lhIds, status) {
  const lock = LockService.getScriptLock();
  try {
    const who = ktkWho_(auth);
    if (AUDIT_ROLES_.indexOf(String(who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Audit yang boleh memberi tanda audit.' };
    const ids = (Array.isArray(lhIds) ? lhIds : [lhIds]).map(function (x) { return String(x).trim(); }).filter(Boolean);
    if (!ids.length) return { status: 'error', message: 'Tidak ada LH yang dipilih.' };
    if (ids.length > 200) return { status: 'error', message: 'Terlalu banyak LH sekaligus (maksimal 200).' };
    const sudah = String(status) === 'Sudah';
    lock.waitLock(20000);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
    if (!sheet) return { status: 'error', message: "Data LH tidak ditemukan." };
    const data = sheet.getDataRange().getValues();
    const headers = data[0].slice();
    const idCol = headers.findIndex(function (h) { const s = String(h).trim().toLowerCase(); return s === 'id_lh' || s === 'id'; });
    if (idCol < 0) return { status: 'error', message: 'Kolom ID LH tidak ditemukan.' };
    // 1. periksa SEMUA LH dulu: tidak ada yang ditulis bila ada satu saja yang bermasalah (tidak ada hasil setengah jadi)
    const noteCol = auditKolomIdxNama_(headers, 'Audit_Note');
    const baris = {}; const hilang = []; const bertemuan = [];
    ids.forEach(function (x) { baris[x] = -1; });
    for (let i = 1; i < data.length; i++) { const id = String(data[i][idCol]).trim(); if (baris[id] === -1) baris[id] = i; }
    ids.forEach(function (x) {
      if (baris[x] < 0) { hilang.push(x); return; }
      if (sudah && noteCol >= 0 && String(data[baris[x]][noteCol] == null ? '' : data[baris[x]][noteCol]).trim() !== '') bertemuan.push(x);
    });
    if (hilang.length) return { status: 'error', message: 'LH tidak ditemukan di database: ' + hilang.slice(0, 5).join(', ') + '. Tidak ada yang diubah.' };
    if (bertemuan.length) return { status: 'error', message: 'LH masih punya temuan: ' + bertemuan.slice(0, 5).join(', ') + '. Hapus temuan dulu (sudah diperbaiki), baru tandai sudah diaudit.' };
    // 2. buat kolom yang belum ada, di kanan kolom terakhir (format teks, agar tanggal tidak diubah Sheet)
    const cols = auditEnsureCols_(sheet, headers);
    const tgl = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm');
    // 3. tulis, simpan nilai lama untuk pemulihan
    const prev = {}; let n = 0;
    try {
      ids.forEach(function (id) {
        const i = baris[id];
        prev[id] = cols.map(function (c) { const v = data[i][c]; return v === undefined ? '' : v; });
        if (sudah) {
          sheet.getRange(i + 1, cols[0] + 1).setValue('Sudah');
          sheet.getRange(i + 1, cols[1] + 1).setValue(who.name);
          sheet.getRange(i + 1, cols[2] + 1).setValue(tgl);
        } else {
          cols.forEach(function (c) { sheet.getRange(i + 1, c + 1).clearContent(); });
        }
        n++;
      });
      SpreadsheetApp.flush();
      // 4. baca ulang: berhasil hanya bila isi Sheet benar-benar sama dengan yang diminta
      const lebar = Math.max(cols[0], cols[1], cols[2], idCol) + 1;
      ids.forEach(function (id) {
        const r = sheet.getRange(baris[id] + 1, 1, 1, lebar).getValues()[0];
        const benar = String(r[idCol]).trim() === id && (sudah ? (String(r[cols[0]]) === 'Sudah' && String(r[cols[1]]) === String(who.name) && String(r[cols[2]]) === tgl)
          : (String(r[cols[0]]) === '' && String(r[cols[1]]) === '' && String(r[cols[2]]) === ''));
        if (!benar) throw new Error('isi database tidak sama setelah ditulis (' + id + ')');
      });
    } catch (e) {
      Object.keys(prev).forEach(function (id) { try { cols.forEach(function (c, k) { sheet.getRange(baris[id] + 1, c + 1).setValue(prev[id][k]); }); } catch (x) { /* pemulihan terbaik */ } });
      return { status: 'error', message: 'Penyimpanan tidak terverifikasi, data dikembalikan seperti semula (' + String(e.message || e) + '). Coba lagi.' };
    }
    return { status: 'success', terverifikasi: true, jumlah: n, oleh: sudah ? who.name : '', tgl: sudah ? tgl : '' };
  } catch (e) { return { status: 'error', message: String(e.message || e) }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}
