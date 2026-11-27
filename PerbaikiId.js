/**
 * ============================================================================
 * PerbaikiId.js - Pengaman ID unik + perbaikan ID LH yang sudah terlanjur ganda
 * ----------------------------------------------------------------------------
 * 1. withIdLock_(fn)  : simpan/ubah PK, LH, SPK dijalankan satu per satu (kunci skrip), jadi dua orang yang menyimpan
 *                       hampir bersamaan tidak bisa lolos dari pemeriksaan "ID sudah dipakai".
 * 2. lihatPerbaikanIdGandaLH() : HANYA MELIHAT rencana perbaikan (tidak mengubah apa pun). Hasil di Execution log.
 * 3. perbaikiIdGandaLH()       : menjalankan perbaikan. Aturan:
 *      - baris PERTAMA tiap ID ganda tetap memakai ID aslinya (tidak berubah),
 *      - baris berikutnya diberi ID baru: ID-lama-2, ID-lama-3, dst (dijamin belum dipakai di Data_LH),
 *      - sheet Data_LH disalin ke "Data_LH_cadangan_<waktu>" lebih dulu,
 *      - LH yang tadinya sudah masuk KTK lewat ID ganda itu tetap masuk (ID barunya ikut ditambahkan ke KTK yang sama),
 *      - semua perubahan dicatat di sheet "Log_Perbaikan_ID" (baris, ID lama, ID baru).
 *      Tidak ada baris yang dihapus dan tidak ada isi LH yang diubah, hanya kolom ID_LH baris kembar.
 * ============================================================================
 */

/** Jalankan fn dengan kunci skrip (satu per satu). Galat dikembalikan sebagai { status: 'error', message }. */
function withIdLock_(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    return fn();
  } catch (e) { return { status: 'error', message: e.toString() }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}

/** Rencana: daftar { row, old, nw, pk, tanggal } untuk baris kembar (bukan yang pertama). */
function idGandaLhRencana_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
  if (!sh || sh.getLastRow() < 2) return { plan: [], total: 0 };
  const lr = sh.getLastRow();
  const vals = sh.getRange(2, 1, lr - 1, 3).getValues();   // ID_LH, ID_PK, Tanggal
  const used = {}; vals.forEach(function (r) { const k = idKey_(r[0]); if (k) used[k] = true; });
  const seen = {}; const plan = [];
  vals.forEach(function (r, i) {
    const k = idKey_(r[0]); if (!k) return;
    if (!seen[k]) { seen[k] = 1; return; }
    const base = String(r[0]).trim();
    let n = 2, nid = base + '-' + n;
    while (used[idKey_(nid)]) { n++; nid = base + '-' + n; }
    used[idKey_(nid)] = true;
    plan.push({ row: i + 2, old: base, nw: nid, pk: String(r[1] || ''), tanggal: String(r[2] || '') });
  });
  return { plan: plan, total: vals.length };
}

function lihatPerbaikanIdGandaLH() {
  const gerbang = kmnGerbang_(); if (gerbang) return gerbang;   // hanya dari editor, setelah PEMELIHARAAN_SAMPAI diisi (Keamanan.js)
  const p = idGandaLhRencana_();
  const lines = p.plan.map(function (x) { return 'baris ' + x.row + ': ' + x.old + '  ->  ' + x.nw + '   (PK ' + x.pk + ', ' + x.tanggal + ')'; });
  Logger.log(p.plan.length ? ('RENCANA (belum ada yang diubah). ' + p.plan.length + ' baris akan diberi ID baru, baris pertama tiap ID tetap:\n' + lines.join('\n')) : 'Tidak ada ID LH ganda.');
  return p.plan;
}

function perbaikiIdGandaLH() {
  const gerbang = kmnGerbang_(); if (gerbang) return gerbang;
  return withIdLock_(function () {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Data_LH');
    const p = idGandaLhRencana_();
    if (!p.plan.length) { Logger.log('Tidak ada ID LH ganda. Tidak ada yang diubah.'); return { status: 'success', diubah: 0 }; }
    const stamp = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyyMMdd_HHmm');
    // 1. cadangan sheet
    const bak = sh.copyTo(ss); bak.setName('Data_LH_cadangan_' + stamp);
    // 2. ganti ID baris kembar (hanya kolom A)
    p.plan.forEach(function (x) { sh.getRange(x.row, 1, 1, 1).setValues([[x.nw]]); });
    // 3. KTK: LH yang tadinya masuk lewat ID ganda tetap masuk -> tambahkan ID baru ke KTK yang sama
    const byOld = {}; p.plan.forEach(function (x) { (byOld[idKey_(x.old)] = byOld[idKey_(x.old)] || []).push(x.nw); });
    let ktkTambah = 0;
    const pil = ktkRead_('Ktk_Pilihan');
    if (pil.length) {
      const has = {}; pil.forEach(function (r) { if (r[1] === 'LH') has[String(r[0]) + '|' + idKey_(r[2])] = true; });
      const add = [];
      pil.forEach(function (r) {
        if (r[1] !== 'LH') return;
        (byOld[idKey_(r[2])] || []).forEach(function (nid) { const k = String(r[0]) + '|' + idKey_(nid); if (!has[k]) { has[k] = true; add.push([r[0], 'LH', nid, '']); } });
      });
      if (add.length) {
        const bk2 = ss.getSheetByName('Ktk_Pilihan').copyTo(ss); bk2.setName('Ktk_Pilihan_cadangan_' + stamp);
        ktkReplace_('Ktk_Pilihan', KTK_H_PILIH_, pil.concat(add)); ktkTambah = add.length;
      }
    }
    // 4. catatan perbaikan
    let lg = ss.getSheetByName('Log_Perbaikan_ID');
    if (!lg) { lg = ss.insertSheet('Log_Perbaikan_ID'); lg.getRange(1, 1, 1, 7).setValues([['Waktu', 'Sheet', 'Baris', 'ID_Lama', 'ID_Baru', 'ID_PK', 'Catatan']]); }
    const rows = p.plan.map(function (x) { return [new Date(), 'Data_LH', x.row, x.old, x.nw, x.pk, 'Cadangan: Data_LH_cadangan_' + stamp]; });
    lg.getRange(lg.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
    Logger.log('SELESAI. ' + p.plan.length + ' baris Data_LH diberi ID baru. ' + ktkTambah + ' LH ditambahkan ke KTK agar tetap masuk. Cadangan: Data_LH_cadangan_' + stamp + '. Catatan: sheet Log_Perbaikan_ID.');
    return { status: 'success', diubah: p.plan.length, ktkTambah: ktkTambah, cadangan: 'Data_LH_cadangan_' + stamp };
  });
}
