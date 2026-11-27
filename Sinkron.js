// Sinkron ke aplikasi Penagihan (spreadsheet lain). TAHAP 1: hanya MEMBACA, tidak menulis apa pun.
// Jalankan sinkronPeriksa dari editor Apps Script (perlu PEMELIHARAAN_SAMPAI terbuka, sama seperti fungsi pemeliharaan lain).
// Hasilnya dipakai untuk memastikan nama sheet, kolom nama pekerjaan, dan kunci ProjectID sebelum penulisan dibuat.
const SINKRON_SS_ID_ = '1pbulgLKwVkxvjEE0a6-_sz_y9j3uWnCHGzFNbcM_WIs';

const SINKRON_CODE3_ID_ = '1Vh7xc8mr64XxuoG_eksdTiAFQK_c3K_utUTTB81moH8';
const SINKRON_CODE7_ID_ = '140-wVrFVLehbFrUXCkvFUm2ONb8JkDOD3QBMlj3R8w0';
function sinkronPeriksa() { return sinkronPeriksa_(SINKRON_SS_ID_); }
function sinkronPeriksaCode3() { return sinkronPeriksa_(SINKRON_CODE3_ID_); }
function sinkronPeriksaCode7() { return sinkronPeriksa_(SINKRON_CODE7_ID_); }

function sinkronPeriksa_(idSs) {
  const g = kmnGerbang_(); if (g) return g.message;
  const ss = SpreadsheetApp.openById(idSs);
  const hasil = [];
  ss.getSheets().forEach(function (sh) {
    const n = sh.getLastRow(), k = Math.min(sh.getLastColumn(), 30);
    const kepala = k ? sh.getRange(1, 1, 1, k).getDisplayValues()[0] : [];
    const contoh = (n > 1 && k) ? sh.getRange(2, 1, Math.min(3, n - 1), k).getDisplayValues().map(function (r) {
      return r.map(function (v) { v = String(v); return v.length > 40 ? v.slice(0, 40) + '…' : v; });
    }) : [];
    hasil.push({ sheet: sh.getName(), baris: Math.max(0, n - 1), kolom: kepala, contoh: contoh });
  });
  const teks = JSON.stringify(hasil, null, 1);
  Logger.log(teks);
  return teks;
}
