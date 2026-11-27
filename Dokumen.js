/**
 * ============================================================================
 * Dokumen.js - Unggah dokumen Code 3 / Code 7 / AGO per LH (menu Pusat verifikasi)
 * ----------------------------------------------------------------------------
 * Menggantikan uploadCodeVerification (versi lama dinonaktifkan: tanpa cek login, membuat file di Drive sebelum memeriksa apa pun,
 * tanpa batas tipe/ukuran, tanpa memeriksa alur audit).
 *
 * Urutan yang dijamin:
 *  1. Identitas dan peran dicek dari token sesi. Hanya Super Admin dan Admin Code.
 *  2. SEMUA pemeriksaan dilakukan sebelum file dibuat: tipe dokumen, tipe dan ukuran file, LH ada, LH sudah lolos audit,
 *     LH memang membutuhkan dokumen itu, AGO hanya setelah Code 3/Code 7 yang diperlukan selesai, dokumen belum ada (kecuali "ganti").
 *  3. Penulisan dikunci (LockService), lalu DIBACA ULANG dari Sheet. Bila isinya tidak sama, nilai lama dikembalikan dan file di Drive
 *     dibuang ke tempat sampah, lalu pengguna diberi tahu bahwa data TIDAK tersimpan.
 *  4. Setiap unggahan dicatat di sheet Log_Dokumen.
 * ============================================================================
 */

const DOK_ROLES_ = ['Super Admin', 'Admin Code'];
const DOK_TIPE_ = { code3: { status: 'Code3', file: 'File_Code3', nama: 'Code 3' }, code7: { status: 'Code7', file: 'File_Code7', nama: 'Code 7' }, ago: { status: 'AGO', file: 'File_AGO', nama: 'AGO' } };
const DOK_MIME_ = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const DOK_MAKS_BYTE_ = 8 * 1024 * 1024;

function dokBenar_(v) { return v === true || String(v).toLowerCase() === 'true'; }
function dokKol_(headers, nama) { return headers.findIndex(function (h) { return String(h).trim().toLowerCase() === String(nama).toLowerCase(); }); }
function dokGalat_(pesan) { return { status: 'error', message: pesan }; }

/** Pastikan kolom ada di Data_LH (dibuat di kanan bila belum). Mengubah `headers`, mengembalikan indeksnya. */
function dokPastiKol_(sheet, headers, nama) {
  let i = dokKol_(headers, nama);
  if (i >= 0) return i;
  headers.push(nama); i = headers.length - 1;
  sheet.getRange(1, i + 1).setValue(nama).setFontWeight('bold').setBackground('#D9D9D9');
  return i;
}

/** Dokumen yang diperlukan satu LH, dihitung dari isinya (aturan yang sama dengan layar: UiKit lhDokumen). */
function dokButuh_(dataJson) {
  let d = {};
  try { d = dataJson ? JSON.parse(dataJson) : {}; } catch (e) { d = {}; }
  const c3 = (d.returBekas || []).some(function (m) { return m && String(m.nama || '').trim() !== ''; });
  const c7 = (d.materialMdu || []).some(function (m) { return m && /bekas|ex/i.test(m.catatan || ''); });
  return { code3: c3, code7: c7, ago: c3 || c7 };
}

/**
 * Unggah satu dokumen. tipe: 'code3' | 'code7' | 'ago'. ganti = true untuk mengganti dokumen yang sudah ada.
 * Mengembalikan { status:'success', url, terverifikasi:true, ... } atau { status:'error', message }.
 */
function lhUnggahDokumenAsli_(auth, dataUrl, fileName, lhId, tipe, ganti) {
  const lock = LockService.getScriptLock(); let terkunci = false; let file = null;
  try {
    const who = ktkWho_(auth);
    if (DOK_ROLES_.indexOf(String(who.role)) < 0) return dokGalat_('Hanya Super Admin dan Admin Code yang boleh mengunggah dokumen.');
    const T = DOK_TIPE_[String(tipe)]; if (!T) return dokGalat_('Jenis dokumen tidak dikenal.');
    const id = String(lhId == null ? '' : lhId).trim(); if (!id) return dokGalat_('Nomor LH kosong.');
    // --- file: format, tipe, ukuran (diperiksa sebelum apa pun dibuat) ---
    const s = String(dataUrl || ''); const k = s.indexOf(';base64,');
    if (s.indexOf('data:') !== 0 || k < 0) return dokGalat_('File tidak terbaca. Pilih ulang file.');
    const mime = s.substring(5, k).toLowerCase();
    if (DOK_MIME_.indexOf(mime) < 0) return dokGalat_('Jenis file tidak diizinkan. Gunakan PDF, gambar (JPG, PNG), Word, atau Excel.');
    const b64 = s.substring(k + 8);
    if (b64.length > Math.ceil(DOK_MAKS_BYTE_ * 4 / 3) + 8) return dokGalat_('File terlalu besar. Maksimal 8 MB.');
    const bytes = Utilities.base64Decode(b64);
    if (!bytes || !bytes.length) return dokGalat_('File kosong.');
    if (bytes.length > DOK_MAKS_BYTE_) return dokGalat_('File terlalu besar. Maksimal 8 MB.');
    const nama = String(fileName || 'dokumen').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) || 'dokumen';

    lock.waitLock(20000); terkunci = true;
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
    if (!sheet) return dokGalat_("Data LH tidak ditemukan.");
    const data = sheet.getDataRange().getValues(); const headers = data[0].slice();
    const idCol = headers.findIndex(function (h) { const x = String(h).trim().toLowerCase(); return x === 'id_lh' || x === 'id'; });
    if (idCol < 0) return dokGalat_('Kolom ID LH tidak ditemukan.');
    let baris = -1; for (let i = 1; i < data.length; i++) { if (String(data[i][idCol]).trim() === id) { baris = i; break; } }
    if (baris < 0) return dokGalat_('LH ' + id + ' tidak ditemukan di database.');
    const row = data[baris];
    // --- alur: LH harus sudah lolos audit ---
    const note = dokKol_(headers, 'Audit_Note'), stat = dokKol_(headers, 'Audit_Status');
    if (note >= 0 && String(row[note] == null ? '' : row[note]).trim() !== '') return dokGalat_('LH ' + id + ' masih punya temuan audit dan menunggu revisi. Dokumen belum bisa diunggah.');
    const st = stat >= 0 ? String(row[stat] == null ? '' : row[stat]).trim() : '';
    if (st !== 'Sudah' && st !== 'Revisi') return dokGalat_('LH ' + id + ' belum lolos audit. Dokumen baru bisa diunggah setelah audit.');
    // --- dokumen ini memang diperlukan, dan urutannya benar ---
    const jsonCol = dokKol_(headers, 'Data_JSON');
    const perlu = dokButuh_(jsonCol >= 0 ? row[jsonCol] : '');
    if (!perlu[tipe]) return dokGalat_('LH ' + id + ' tidak membutuhkan ' + T.nama + '.');
    const ada = function (t) { const x = DOK_TIPE_[t]; const a = dokKol_(headers, x.status), b = dokKol_(headers, x.file); return (a >= 0 && dokBenar_(row[a])) || (b >= 0 && String(row[b] || '').trim() !== ''); };
    if (tipe === 'ago' && ((perlu.code3 && !ada('code3')) || (perlu.code7 && !ada('code7')))) return dokGalat_('AGO baru bisa diunggah setelah Code 3 dan Code 7 yang diperlukan selesai.');
    if (ada(tipe) && ganti !== true) return dokGalat_(T.nama + ' untuk LH ' + id + ' sudah ada. Pilih Ganti bila ingin menggantinya.');

    // --- semua pemeriksaan lolos: baru file dibuat ---
    const sCol = dokPastiKol_(sheet, headers, T.status), fCol = dokPastiKol_(sheet, headers, T.file);
    const prevS = sCol < row.length ? row[sCol] : '', prevF = fCol < row.length ? row[fCol] : '';
    file = DriveApp.getFolderById(FOLDER_ID).createFile(Utilities.newBlob(bytes, mime, nama));
    const url = file.getUrl();
    try {
      sheet.getRange(baris + 1, sCol + 1).setValue(true);
      sheet.getRange(baris + 1, fCol + 1).setValue(url);
      SpreadsheetApp.flush();
      // baca ulang dari Sheet: hanya dianggap berhasil bila isinya benar-benar tersimpan
      const cek = sheet.getRange(baris + 1, 1, 1, Math.max(sCol, fCol, idCol) + 1).getValues()[0];
      if (String(cek[idCol]).trim() !== id || !dokBenar_(cek[sCol]) || String(cek[fCol]) !== url) throw new Error('isi database tidak sama setelah ditulis');
    } catch (e) {
      try { sheet.getRange(baris + 1, sCol + 1).setValue(prevS === undefined ? '' : prevS); sheet.getRange(baris + 1, fCol + 1).setValue(prevF === undefined ? '' : prevF); } catch (x) { /* pemulihan terbaik */ }
      try { file.setTrashed(true); } catch (x) { /* abaikan */ }
      return dokGalat_('Penyimpanan tidak terverifikasi, data TIDAK berubah dan file dibatalkan (' + String(e.message || e) + '). Coba lagi.');
    }
    try {   // catatan jejak unggahan; kegagalan mencatat tidak membatalkan unggahan
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID); let lg = ss.getSheetByName('Log_Dokumen');
      if (!lg) { lg = ss.insertSheet('Log_Dokumen'); lg.getRange(1, 1, 1, 8).setValues([['Waktu', 'Username', 'Nama', 'ID_LH', 'Dokumen', 'Nama_File', 'URL', 'Ukuran_Byte']]).setFontWeight('bold'); }
      lg.appendRow([Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm'), who.id, who.name, id, T.nama + (ganti === true ? ' (ganti)' : ''), nama, url, bytes.length]);
    } catch (x) { /* abaikan */ }
    return { status: 'success', terverifikasi: true, lhId: id, tipe: String(tipe), url: url, oleh: who.name, ukuran: bytes.length };
  } catch (e) {
    if (file) { try { file.setTrashed(true); } catch (x) { /* abaikan */ } }
    return dokGalat_('Gagal: ' + String((e && e.message) || e));
  } finally { if (terkunci) { try { lock.releaseLock(); } catch (x) { /* abaikan */ } } }
}
