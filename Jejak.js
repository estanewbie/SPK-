/**
 * ============================================================================
 * Jejak.js - Riwayat akses dan pengerjaan (jejak audit) seluruh aplikasi
 * ----------------------------------------------------------------------------
 * TUJUAN: dapat dipastikan siapa (ID akun) melakukan apa, kapan, pada data apa, dan hasilnya, dari login sampai LH selesai.
 *
 * Satu sheet "Log_Aktivitas", hanya ditambah (tidak pernah diubah atau dihapus oleh aplikasi). Tiap baris:
 *   ID_Log | Waktu | ID_User | Nama | Peran | ID_Login_Asli | Aksi | Objek | ID_Objek | Keterangan | Hasil | Detail | Hash
 *  - ID_User      = akun yang bekerja. ID_Login_Asli = akun yang benar-benar login (berbeda bila Super Admin memakai "Masuk sebagai").
 *  - Hasil        = sukses | gagal (termasuk penolakan peran, validasi, dan kegagalan verifikasi simpan).
 *  - Hash         = SHA-256 berantai (hash baris sebelumnya + isi baris ini). Mengubah atau menghapus satu baris memutus rantai
 *                   dan terdeteksi oleh jejakVerifikasi().
 *
 * Identitas SELALU dari token sesi server (ktkWho_), bukan dari kiriman layar. Fungsi tulis lama yang dulu tidak tahu pelakunya
 * kini dibungkus: sesi harus sah, aksi dijalankan, lalu hasilnya dicatat dengan identitas pelaku. Layar mengirim token otomatis
 * (UiKit: pembungkus google.script.run).
 *
 * Pencatatan dilakukan SESUDAH aksi selesai dan kunci aksi dilepas. Bila pencatatan gagal, aksi tetap berlaku dan jawabannya diberi
 * tanda jejakGagal = true (kasus langka; tidak boleh menggagalkan pekerjaan yang sudah tersimpan).
 * ============================================================================
 */

const JEJAK_SHEET_ = 'Log_Aktivitas';
const JEJAK_H_ = ['ID_Log', 'Waktu', 'ID_User', 'Nama', 'Peran', 'ID_Login_Asli', 'Aksi', 'Objek', 'ID_Objek', 'Keterangan', 'Hasil', 'Detail', 'Hash'];
const JEJAK_BACA_MAKS_ = 10000;     // baris terbaru yang dibaca untuk riwayat
const JEJAK_ROLES_SEMUA_ = ['Super Admin', 'Admin Audit'];   // boleh melihat seluruh log dan memeriksa keutuhan
var JEJAK_PELAKU_ = null;           // pelaku permintaan yang sedang berjalan (diisi pembungkus, dipakai fungsi inti untuk kolom LH)
var JEJAK_EKSTRA_ = null;           // keterangan tambahan dari fungsi inti (mis. { revisi: true })

function jejakWaktu_() { return Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss'); }
function jejakPotong_(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 3) + '...' : s; }

/** Identitas dari token sesi. Mengembalikan { ok, who } atau { ok:false, galat } (kode SESI bila sesi tidak sah/berakhir). */
function jejakWho_(auth) {
  try { return { ok: true, who: ktkWho_(auth) }; }
  catch (e) {
    const m = String((e && e.message) || e);
    return { ok: false, galat: { status: 'error', kode: /Sesi|login ulang|Akun tidak ditemukan/.test(m) ? 'SESI' : 'AKSES', message: m } };
  }
}

function jejakSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID); let sh = ss.getSheetByName(JEJAK_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(JEJAK_SHEET_);
    sh.getRange(1, 1, 1, JEJAK_H_.length).setValues([JEJAK_H_]).setFontWeight('bold').setBackground('#D9D9D9');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), JEJAK_H_.length).setNumberFormat('@');   // teks: tanggal dan ID tidak diubah Sheet
  }
  return sh;
}

function jejakHash_(prev, b) {
  const teks = String(prev) + '|' + [b[1], b[2], b[5], b[6], b[7], b[8], b[9], b[10], b[11]].join('|');
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, teks, Utilities.Charset.UTF_8);
  return d.map(function (x) { return ('0' + (x < 0 ? x + 256 : x).toString(16)).slice(-2); }).join('');
}

/**
 * Tambahkan baris log. daftar: [{ aksi, objek, id, ket, hasil, detail }]. Mengembalikan true bila tercatat.
 * Dikunci (rantai hash tidak boleh bercabang); jangan dipanggil dari dalam kunci lain.
 */
function jejakCatatBanyak_(who, daftar) {
  if (!daftar || !daftar.length) return true;
  const lock = LockService.getScriptLock(); let terkunci = false;
  try {
    lock.waitLock(15000); terkunci = true;
    const sh = jejakSheet_(); const last = sh.getLastRow();
    let prev = last >= 2 ? String(sh.getRange(last, JEJAK_H_.length).getValue()) : 'GENESIS';
    const waktu = jejakWaktu_(); const rows = [];
    daftar.forEach(function (d, i) {
      const b = ['LOG-' + (last + i), waktu, who.id, who.name || '', who.role || '', who.realId || who.id, d.aksi, d.objek || '', d.id == null ? '' : String(d.id),
        jejakPotong_(d.ket, 300), d.hasil || 'sukses', d.detail ? jejakPotong_(typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail), 800) : '', ''];
      b[12] = jejakHash_(prev, b); prev = b[12]; rows.push(b);
    });
    const perlu = last + rows.length;
    if (perlu > sh.getMaxRows() && typeof sh.insertRowsAfter === 'function') sh.insertRowsAfter(sh.getMaxRows(), Math.max(1000, rows.length));
    sh.getRange(last + 1, 1, rows.length, JEJAK_H_.length).setValues(rows);
    SpreadsheetApp.flush();
    return true;
  } catch (e) { try { console.error('Jejak gagal dicatat: ' + e); } catch (x) { /* abaikan */ } return false; }
  finally { if (terkunci) { try { lock.releaseLock(); } catch (x) { /* abaikan */ } } }
}
function jejakCatat_(who, aksi, objek, id, ket, hasil, detail) { return jejakCatatBanyak_(who, [{ aksi: aksi, objek: objek, id: id, ket: ket, hasil: hasil, detail: detail }]); }

/** Masuk, gagal masuk, dan keluar. Gagal masuk dibatasi 1 baris per akun per menit supaya sheet tidak dibanjiri. */
function jejakAkses_(who, aksi, ket, hasil) {
  try {
    if (aksi === 'akses.gagal') {
      const c = CacheService.getScriptCache(); const k = 'jg_' + String(who.id).slice(0, 60);
      if (c.get(k)) return false; c.put(k, '1', 60);
    }
    return jejakCatat_(who, aksi, 'AKUN', who.id, ket, hasil);
  } catch (e) { return false; }
}
function jejakKeluar(auth) {
  const w = jejakWho_(auth); if (!w.ok) return { status: 'success' };   // sesi sudah habis: tidak ada yang perlu dicatat
  jejakAkses_(w.who, 'akses.keluar', 'Keluar dari aplikasi', 'sukses');
  try { CacheService.getScriptCache().remove('ktk_s_' + String(auth.t)); } catch (e) { /* sesi tetap berakhir sendiri */ }   // token dicabut di server: tidak bisa dipakai lagi walau bocor
  return { status: 'success' };
}

// ---------- kolom pelaku pada baris LH (jawaban cepat "siapa yang membuat/mengubah LH ini") ----------
function jejakKolomLh_(sheet, headers, nama) {
  let i = headers.findIndex(function (h) { return String(h).trim().toLowerCase() === nama.toLowerCase(); });
  if (i >= 0) return i;
  headers.push(nama); i = headers.length - 1;
  sheet.getRange(1, i + 1).setValue(nama).setFontWeight('bold').setBackground('#D9D9D9');
  sheet.getRange(2, i + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  return i;
}
/** Dipanggil fungsi inti setelah LH baru ditambahkan (baris terakhir). */
function jejakLhDibuat_(sheet) {
  if (!JEJAK_PELAKU_) return;
  try {
    const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].slice();
    const a = jejakKolomLh_(sheet, headers, 'Dibuat_Oleh'), b = jejakKolomLh_(sheet, headers, 'Dibuat_Tgl'), baris = sheet.getLastRow();
    sheet.getRange(baris, a + 1).setValue(JEJAK_PELAKU_.id); sheet.getRange(baris, b + 1).setValue(jejakWaktu_());
  } catch (e) { try { console.error('Kolom pelaku LH gagal: ' + e); } catch (x) { /* abaikan */ } }
}
/** Dipanggil fungsi inti setelah baris LH diubah. rowNum = nomor baris Sheet (mulai 1). */
function jejakLhDiubah_(sheet, headers, rowNum) {
  if (!JEJAK_PELAKU_) return;
  try {
    const a = jejakKolomLh_(sheet, headers, 'Diubah_Oleh'), b = jejakKolomLh_(sheet, headers, 'Diubah_Tgl');
    sheet.getRange(rowNum, a + 1).setValue(JEJAK_PELAKU_.id); sheet.getRange(rowNum, b + 1).setValue(jejakWaktu_());
  } catch (e) { try { console.error('Kolom pelaku LH gagal: ' + e); } catch (x) { /* abaikan */ } }
}

// ---------- pembungkus fungsi tulis ----------
// spec: { ai: indeks argumen token, strip: true bila token dibuang sebelum memanggil fungsi asli, fn: fungsi asli, baris(args, r, ekstra): [{aksi, objek, id, ket, detail}] }
function jejakPanggil_(spec, argsObj) {
  const a = Array.prototype.slice.call(argsObj);
  const w = jejakWho_(a[spec.ai]);
  if (!w.ok) return w.galat;
  // batas ukuran kiriman (dokumen unggahan punya batas sendiri di Dokumen.js): mencegah kiriman raksasa yang memperlambat semua orang
  if (spec.nama !== 'lhUnggahDokumen') { let n = 0; try { n = JSON.stringify(a).length; } catch (e) { n = 0; } if (n > 1000000) return { status: 'error', message: 'Data yang dikirim terlalu besar (maksimal sekitar 1 MB). Kurangi isinya lalu coba lagi.' }; }
  let args = spec.strip ? a.filter(function (x, i) { return i !== spec.ai; }) : a;
  // teks kiriman layar dinetralkan dari awalan rumus (Keamanan.js); objek token (auth) dibiarkan
  args = args.map(function (x, i) { return ((!spec.strip && i === spec.ai) || spec.tanpaBersih) ? x : kmnBersih_(x); });
  let r; JEJAK_PELAKU_ = w.who; JEJAK_EKSTRA_ = null;
  const nama = spec.nama || '';
  if (!kmnPeranBoleh_(nama, w.who.role)) {
    r = { status: 'error', kode: 'AKSES', message: 'Peran ' + w.who.role + ' tidak berhak melakukan ini.' };
  } else {
    const hapus = /^delete(Pk|Spk|Lh)/.test(nama);
    try {
      if (hapus) {
        // penghapusan: dikunci, diperiksa syaratnya, disalin ke Arsip_Hapus dulu (gagal arsip = tidak dihapus)
        r = withIdLock_(function () {
          const tolak = kmnSyaratHapus_(nama, args[0]); if (tolak) return { status: 'error', message: tolak };
          if (!kmnArsipkan_(nama, args[0], w.who)) return { status: 'error', message: 'Salinan arsip sebelum hapus gagal dibuat, jadi tidak ada yang dihapus. Coba lagi.' };
          return spec.fn.apply(null, args);
        });
      } else r = spec.fn.apply(null, args);
    } catch (e) { r = { status: 'error', message: String((e && e.message) || e) }; }
  }
  const ek = JEJAK_EKSTRA_; JEJAK_PELAKU_ = null; JEJAK_EKSTRA_ = null;
  let tercatat = true;
  try {
    const gagal = !r || (typeof r === 'object' && r.status === 'error');
    const daftar = (spec.baris(args, r, ek) || []).map(function (d) { d.hasil = gagal ? 'gagal' : 'sukses'; if (gagal) d.ket = jejakPotong_((d.ket ? d.ket + ' - ' : '') + 'Gagal: ' + ((r && r.message) || 'tanpa pesan'), 300); return d; });
    tercatat = jejakCatatBanyak_(w.who, daftar);
  } catch (e) { tercatat = false; }
  if (!tercatat && r && typeof r === 'object') r.jejakGagal = true;
  return r;
}
const jejakId_ = function (x) { return x == null ? '' : String(x).trim(); };
const jejakDaftar_ = function (x) { return (Array.isArray(x) ? x : [x]).map(jejakId_).filter(Boolean); };
// satu baris log per objek (mis. satu per LH untuk aksi massal)
const jejakPerId_ = function (aksi, objek, ids, ket, detail) { return ids.map(function (id) { return { aksi: aksi, objek: objek, id: id, ket: ket, detail: detail }; }); };

const JEJAK_SPEC_ = {
  // --- LH ---
  saveLhToSheet: { ai: 3, strip: true, fn: function () { return saveLhToSheetAsli_.apply(null, arguments); },
    baris: function (a, r) { const l = a[0] || {}; return [{ aksi: 'lh.buat', objek: 'LH', id: (r && r.id) || l.id, ket: 'LH dibuat di PK ' + jejakId_(l.pk_id) + ': ' + jejakPotong_(l.uraian, 120) }]; } },
  updateLhInSheet: { ai: 4, strip: true, fn: function () { return updateLhInSheetAsli_.apply(null, arguments); },
    baris: function (a, r, ek) { const l = a[0] || {}; const rev = !!(ek && ek.revisi); return [{ aksi: rev ? 'lh.revisi' : 'lh.ubah', objek: 'LH', id: a[3] || l.id, ket: rev ? 'Revisi LH disimpan (temuan audit diselesaikan)' : 'LH diubah', detail: { pk: jejakId_(l.pk_id), tanggal: jejakId_(l.tanggal) } }]; } },
  deleteLhFromSheet: { ai: 1, strip: true, fn: function () { return deleteLhFromSheetAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'lh.hapus', objek: 'LH', id: a[0], ket: 'LH dihapus permanen' }]; } },
  moveLhsToNewPk: { ai: 2, strip: true, fn: function () { return moveLhsToNewPkAsli_.apply(null, arguments); },
    baris: function (a) { return jejakPerId_('lh.pindah', 'LH', jejakDaftar_(a[0]), 'LH dipindah ke PK ' + jejakId_(a[1])); } },
  updateLhRabStatus: { ai: 1, strip: true, fn: function () { return updateLhRabStatusAsli_.apply(null, arguments); },
    baris: function (a) { return jejakPerId_('lh.rab', 'LH', jejakDaftar_(a[0]), 'LH masuk RAB'); } },
  // --- PK ---
  savePkToSheet: { ai: 1, strip: true, fn: function () { return savePkToSheetAsli_.apply(null, arguments); },
    baris: function (a, r) { const p = a[0] || {}; return [{ aksi: 'pk.buat', objek: 'PK', id: (r && r.id) || p.id, ket: 'PK dibuat: ' + jejakPotong_(p.nama, 120) }]; } },
  updatePkInSheet: { ai: 1, strip: true, fn: function () { return updatePkInSheetAsli_.apply(null, arguments); },
    baris: function (a) { const p = a[0] || {}; return [{ aksi: 'pk.ubah', objek: 'PK', id: p.id, ket: 'PK diubah: ' + jejakPotong_(p.nama, 120) }]; } },
  deletePkFromSheet: { ai: 1, strip: true, fn: function () { return deletePkFromSheetAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'pk.hapus', objek: 'PK', id: a[0], ket: 'PK dihapus permanen' }]; } },
  allocatePkToSpk: { ai: 2, strip: true, fn: function () { return allocatePkToSpkAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'pk.alokasi', objek: 'PK', id: a[0], ket: 'PK dimasukkan ke SPK ' + jejakId_(a[1]) }]; } },
  removePkFromSpk: { ai: 2, strip: true, fn: function () { return removePkFromSpkAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'pk.keluarkan', objek: 'PK', id: a[0], ket: 'PK dikeluarkan dari SPK ' + jejakId_(a[1]) }]; } },
  updateStatusCetakPK: { ai: 1, strip: true, fn: function () { return updateStatusCetakPKAsli_.apply(null, arguments); },
    baris: function (a) { return jejakPerId_('pk.cetak', 'PK', jejakDaftar_(a[0]), 'Status cetak PK diperbarui'); } },
  // --- SPK ---
  saveSpkToSheet: { ai: 1, strip: true, fn: function () { return saveSpkToSheetAsli_.apply(null, arguments); },
    baris: function (a) { const s = a[0] || {}; return [{ aksi: 'spk.buat', objek: 'SPK', id: s.ID_SPK || s.id, ket: 'SPK dibuat: ' + jejakPotong_(s.Nama_SPK || s.nama, 120) }]; } },
  updateSpkInSheet: { ai: 1, strip: true, fn: function () { return updateSpkInSheetAsli_.apply(null, arguments); },
    baris: function (a) { const s = a[0] || {}; return [{ aksi: 'spk.ubah', objek: 'SPK', id: s.ID_SPK || s.id, ket: 'SPK diubah' }]; } },
  deleteSpkFromSheet: { ai: 1, strip: true, fn: function () { return deleteSpkFromSheetAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'spk.hapus', objek: 'SPK', id: a[0], ket: 'SPK dihapus permanen' }]; } },
  // --- RAB ---
  saveRabToSheet: { ai: 1, strip: true, fn: function () { return saveRabToSheetAsli_.apply(null, arguments); },
    baris: function (a, r) { const x = a[0] || {}; return [{ aksi: 'rab.buat', objek: 'RAB', id: (r && (r.id || r.rabId)) || x.id || x.ID_RAB, ket: 'RAB diterbitkan' }]; } },
  toggleLockRab: { ai: 2, strip: true, fn: function () { return toggleLockRabAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'rab.kunci', objek: 'RAB', id: a[0], ket: 'Status kunci RAB diubah menjadi ' + jejakId_(a[1]) }]; } },
  updateUpahRab: { ai: 2, strip: true, fn: function () { return updateUpahRabAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'rab.upah', objek: 'RAB', id: a[0], ket: 'Upah RAB diperbarui' }]; } },
  // --- Log harian (impor sumber) ---
  logLinkPk: { ai: 3, strip: true, fn: function () { return logLinkPkAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'logharian.hubung', objek: 'PK', id: a[1], ket: 'PK dihubungkan ke sumber log harian ' + jejakId_(a[2]) }]; } },
  logSetujuiUsulan: { ai: 2, strip: true, fn: function () { return logSetujuiUsulanAsli_.apply(null, arguments); },
    baris: function (a) { const x = a[1] || {}; return [{ aksi: 'logharian.setuju_usulan', objek: 'SPK', id: x.id || x.label, ket: 'Usulan SPK dari log harian disetujui' }]; } },
  logTolakUsulan: { ai: 2, strip: true, fn: function () { return logTolakUsulanAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'logharian.tolak_usulan', objek: 'SPK', id: a[1], ket: 'Usulan SPK dari log harian ditolak' }]; } },
  logAjukanSpk: { ai: 2, strip: true, fn: function () { return logAjukanSpkAsli_.apply(null, arguments); },
    baris: function (a) { return jejakPerId_('logharian.ajukan_spk', 'SPK', (a[1] || []).map(function (x) { return jejakId_(x && (x.id || x.label)); }).filter(Boolean), 'SPK diajukan dari log harian'); } },
  logSetujuiSpk: { ai: 3, strip: true, fn: function () { return logSetujuiSpkAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'logharian.keputusan_spk', objek: 'SPK', id: a[1], ket: a[2] ? 'Usulan SPK disetujui' : 'Usulan SPK ditolak' }]; } },
  logSaveConfig: { ai: 2, strip: true, fn: function () { return logSaveConfigAsli_.apply(null, arguments); },
    baris: function () { return [{ aksi: 'logharian.konfigurasi', objek: 'KONFIG', id: 'log_harian', ket: 'Konfigurasi log harian disimpan' }]; } },
  // --- KTK (token sudah menjadi argumen fungsi aslinya, jadi tidak dibuang) ---
  ktkCreate: { ai: 1, strip: false, fn: function () { return ktkCreateAsli_.apply(null, arguments); },
    baris: function (a, r) { const m = a[0] || {}; return [{ aksi: 'ktk.buat', objek: 'KTK', id: (r && r.id) || '', ket: 'KTK jenis ' + jejakId_(m.jenis) + ' dibuat untuk SPK ' + jejakId_(m.idSpk) }]; } },
  ktkSave: { ai: 1, strip: false, fn: function () { return ktkSaveAsli_.apply(null, arguments); },
    baris: function (a) { const d = a[0] || {}; return [{ aksi: 'ktk.simpan', objek: 'KTK', id: d.id, ket: 'KTK disimpan (' + ((d.paket || []).length) + ' paket, ' + ((d.lhIds || []).length) + ' LH, ' + ((d.pkIds || []).length) + ' PK)' + (d.status === 'Final' ? ', harga dikunci' : '') }]; } },
  ktkMove: { ai: 2, strip: false, fn: function () { return ktkMoveAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'ktk.pindah', objek: 'KTK', id: a[0], ket: 'KTK dipindahkan ke folder lain' }]; } },
  ktkFolderRename: { ai: 2, strip: false, fn: function () { return ktkFolderRenameAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'ktk.folder', objek: 'FOLDER', id: a[0], ket: 'Nama folder diganti menjadi ' + jejakPotong_(a[1], 80) }]; } },
  ktkTemplateOp: { ai: 2, strip: false, fn: function () { return ktkTemplateOpAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'ktk.template', objek: 'TEMPLATE', id: (a[1] && a[1].id) || '', ket: 'Template KTK: ' + jejakId_(a[0]) }]; } },
  ktkKembalikan: { ai: 1, strip: false, fn: function () { return ktkKembalikanAsli_.apply(null, arguments); },
    baris: function (a, r) { return [{ aksi: 'ktk.kembalikan', objek: 'KTK', id: a[0], ket: 'KTK dikembalikan ke Perlu dibuat KTK' + (r && r.idSpk ? ' (SPK ' + r.idSpk + ')' : '') + '; isi diarsipkan di Arsip_KTK' }]; } },
  ktkFolderPemilik: { ai: 2, strip: false, fn: function () { return ktkFolderPemilikAsli_.apply(null, arguments); },
    baris: function (a, r) { return [{ aksi: 'ktk.hakfolder', objek: 'FOLDER', id: a[0], ket: 'Hak akses folder dipindah ke ID ' + jejakId_(a[1]) + (r && r.kontrak != null ? ' (' + r.kontrak + ' kontrak ikut)' : '') }]; } },
  // --- alat Super Admin (Pengelolaan.js). Sandi tidak pernah masuk riwayat; tanpaBersih agar sandi tidak diubah penetral rumus ---
  akunSimpan: { ai: 0, strip: false, tanpaBersih: true, fn: function () { return akunSimpanAsli_.apply(null, arguments); },
    baris: function (a, r) { const d = a[1] || {}; return [{ aksi: d.baru === true ? 'akun.baru' : 'akun.ubah', objek: 'AKUN', id: jejakId_(d.id), ket: (d.baru === true ? 'Akun dibuat' : 'Akun diubah') + ': peran ' + jejakId_(d.role) + ', status ' + jejakId_(d.status || 'Aktif') + (d.sandi ? ', sandi ' + (d.baru === true ? 'diisi' : 'diatur ulang') : '') }]; } },
  arsipPulihkan: { ai: 0, strip: false, fn: function () { return arsipPulihkanAsli_.apply(null, arguments); },
    baris: function (a, r) { return [{ aksi: 'sistem.pulihkan', objek: String(a[1]) === 'ktk' ? 'KTK' : 'ARSIP', id: (r && r.id) || a[2], ket: 'Data dipulihkan dari arsip (' + jejakId_(a[1]) + ')' + (r && r.objek ? ': ' + r.objek : '') }]; } },
  cadanganManual: { ai: 0, strip: false, fn: function () { return cadanganManualAsli_.apply(null, arguments); },
    baris: function (a, r) { return [{ aksi: 'sistem.cadangan', objek: 'SISTEM', id: (r && r.nama) || '', ket: 'Cadangan database dibuat sekarang' }]; } },
  code37Cetak: { ai: 0, strip: false, fn: function () { return code37CetakAsli_.apply(null, arguments); },
    baris: function (a, r) { const T = String(a[2]) === 'code7' ? 'Code 7' : 'Code 3'; if (a[5] && a[5].manual === true) return [{ aksi: 'dokumen.cetak_manual', objek: 'CODE_MANUAL', id: (r && r.lhId) || a[1] || '', ket: T + ' manual (di luar LH) dicetak, bon no. ' + jejakId_((r && r.noBon) || a[3] || '') + ', ' + ((r && r.rows && r.rows.length) || 0) + ' barang disimpan ke arsip ' + T, detail: { tipe: String(a[2]) } }]; return [{ aksi: 'dokumen.cetak', objek: 'LH', id: a[1], ket: T + ' dicetak, bon no. ' + jejakId_((r && r.noBon) || a[3] || '') + ', ' + ((r && r.rows && r.rows.length) || 0) + ' barang disimpan ke arsip ' + T + (Array.isArray(a[4]) ? ' (isi disesuaikan di layar)' : ''), detail: { tipe: String(a[2]), tanpaKode: (r && r.tanpaKode) || 0, disunting: Array.isArray(a[4]) } }]; } },
  arsipRentangFileTambah: { ai: 0, strip: false, fn: function () { return arsipRentangFileTambahAsli_.apply(null, arguments); },
    baris: function (a, r) { return [{ aksi: 'arsip.file_tambah', objek: 'ARSIP_FILE', id: (r && r.id) || '', ket: 'File arsip ditambahkan: ' + jejakPotong_(a[2], 40) }]; } },
  arsipRentangFileHapus: { ai: 0, strip: false, fn: function () { return arsipRentangFileHapusAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'arsip.file_hapus', objek: 'ARSIP_FILE', id: String(a[1] || ''), ket: 'Tautan file arsip dihapus dari daftar (file-nya tidak disentuh)' }]; } },
  arsipRentangPindah: { ai: 0, strip: false, fn: function () { return arsipRentangPindahAsli_.apply(null, arguments); },
    baris: function (a, r) { return [{ aksi: 'arsip.pindah', objek: 'ARSIP_BATCH', id: (r && r.batch) || '', ket: ((r && r.jumlah) || 0) + ' LH bertanggal ' + jejakId_(a[2]) + ' s.d. ' + jejakId_(a[3]) + ' dipindah ke file arsip ' + jejakPotong_(r && r.file, 40), detail: { file: String(a[1]), cadangan: (r && r.cadangan) || '' } }]; } },
  arsipRentangPulihkan: { ai: 0, strip: false, fn: function () { return arsipRentangPulihkanAsli_.apply(null, arguments); },
    baris: function (a, r) { return [{ aksi: 'arsip.pulih_rentang', objek: 'ARSIP_BATCH', id: String(a[1] || ''), ket: ((r && r.jumlah) || 0) + ' LH dipulihkan dari file arsip ke Data_LH' }]; } },
  code37PenandaSimpan: { ai: 0, strip: false, fn: function () { return code37PenandaSimpanAsli_.apply(null, arguments); },
    baris: function (a, r) { const d = a[1] || {}; return [{ aksi: 'code.penanda_simpan', objek: 'PENANDA_CODE', id: (r && r.id) || d.id || '', ket: (d.id ? 'Penandatangan diubah: ' : 'Penandatangan ditambah: ') + jejakPotong_(d.jenis, 40) }]; } },
  code37PenandaHapus: { ai: 0, strip: false, fn: function () { return code37PenandaHapusAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'code.penanda_hapus', objek: 'PENANDA_CODE', id: String(a[1] || ''), ket: 'Penandatangan dihapus dari daftar' }]; } },
  code37NormSimpan: { ai: 0, strip: false, fn: function () { return code37NormSimpanAsli_.apply(null, arguments); },
    baris: function (a, r) { const d = a[1] || {}; return [{ aksi: 'code.norm_simpan', objek: 'NORMALISASI_CODE', id: String(d.kode || ''), ket: (d.kodeLama ? 'Nomor normalisasi diubah: ' : 'Nomor normalisasi ditambah: ') + jejakId_(d.kode) + ' ' + jejakPotong_(d.pendek || d.deskripsi, 40) }]; } },
  code37NormHapus: { ai: 0, strip: false, fn: function () { return code37NormHapusAsli_.apply(null, arguments); },
    baris: function (a) { return [{ aksi: 'code.norm_hapus', objek: 'NORMALISASI_CODE', id: String(a[1] || ''), ket: 'Nomor normalisasi ' + jejakId_(a[1]) + ' dihapus dari daftar' }]; } },
  code37NormImpor: { ai: 0, strip: false, fn: function () { return code37NormImporAsli_.apply(null, arguments); },
    baris: function (a, r) { return [{ aksi: 'code.norm_impor', objek: 'NORMALISASI_CODE', id: '', ket: 'Impor nomor normalisasi: ' + ((r && r.ditambah) || 0) + ' ditambah, ' + ((r && r.diubah) || 0) + ' diubah, ' + ((r && r.dilewati) || 0) + ' dilewati' }]; } },
  // --- audit dan dokumen (token adalah argumen pertama) ---
  auditTandaiLh: { ai: 0, strip: false, fn: function () { return auditTandaiLhAsli_.apply(null, arguments); },
    baris: function (a) { const sudah = String(a[2]) === 'Sudah'; return jejakPerId_(sudah ? 'audit.tandai' : 'audit.batal', 'LH', jejakDaftar_(a[1]), sudah ? 'LH ditandai sudah diaudit' : 'Tanda audit dicabut, LH kembali ke daftar audit'); } },
  auditSimpanTemuan: { ai: 0, strip: false, fn: function () { return auditSimpanTemuanAsli_.apply(null, arguments); },
    baris: function (a) { const t = jejakPotong_(a[2], 300); return [{ aksi: t ? 'audit.temuan' : 'audit.hapus_temuan', objek: 'LH', id: a[1], ket: t ? 'Temuan audit: ' + t : 'Temuan dihapus (dinyatakan sudah diperbaiki)' }]; } },
  lhUnggahDokumen: { ai: 0, strip: false, fn: function () { return lhUnggahDokumenAsli_.apply(null, arguments); },
    baris: function (a, r) { const T = { code3: 'Code 3', code7: 'Code 7', ago: 'AGO' }[String(a[4])] || String(a[4]); return [{ aksi: 'dokumen.unggah', objek: 'LH', id: a[3], ket: T + (a[5] === true ? ' diganti' : ' diunggah') + ': ' + jejakPotong_(a[2], 80), detail: { tipe: String(a[4]), url: (r && r.url) || '', byte: (r && r.ukuran) || 0 } }]; } }
};

Object.keys(JEJAK_SPEC_).forEach(function (k) { JEJAK_SPEC_[k].nama = k; });   // nama fungsi dipakai untuk pemeriksaan peran (Keamanan.js)

// ---------- membaca riwayat ----------
function jejakBaca_(idObjek) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(JEJAK_SHEET_);
  if (!sh || sh.getLastRow() < 2) return [];
  // riwayat satu objek: cari barisnya langsung lewat TextFinder (cepat, tidak membaca puluhan ribu baris), maksimal 200 baris terbaru
  if (idObjek && typeof sh.getRange(2, 9).createTextFinder === 'function') {
    try {
      const hit = sh.getRange(2, 9, sh.getLastRow() - 1, 1).createTextFinder(String(idObjek)).matchEntireCell(true).findAll();
      const nomor = hit.map(function (c) { return c.getRow(); }).sort(function (a, b) { return a - b; }).slice(-200);
      return nomor.map(function (n) { return sh.getRange(n, 1, 1, JEJAK_H_.length).getValues()[0]; });
    } catch (e) { /* jatuh ke pembacaan biasa di bawah */ }
  }
  const akhir = sh.getLastRow(), awal = Math.max(2, akhir - JEJAK_BACA_MAKS_ + 1);
  return sh.getRange(awal, 1, akhir - awal + 1, JEJAK_H_.length).getValues();
}
function jejakObj_(r) { return { id: String(r[0]), waktu: String(r[1]), user: String(r[2]), nama: String(r[3]), peran: String(r[4]), loginAsli: String(r[5]), aksi: String(r[6]), objek: String(r[7]), idObjek: String(r[8]), ket: String(r[9]), hasil: String(r[10]), detail: String(r[11]) }; }

/**
 * Riwayat. f = { objek, id, user, aksi (awalan, mis. 'audit.'), hasil, dari, sampai (yyyy-MM-dd), q, batas (maks 500) }.
 * Riwayat SATU objek (mis. LH) boleh dilihat semua pengguna sah. Seluruh log hanya Super Admin dan Admin Audit.
 * Untuk objek LH disertakan ringkasan pelaku dari kolom pada baris LH.
 */
function jejakRiwayat(auth, f) {
  try {
    const w = jejakWho_(auth); if (!w.ok) return w.galat;
    f = f || {};
    const perObjek = !!(f.objek && f.id);
    if (!perObjek && JEJAK_ROLES_SEMUA_.indexOf(String(w.who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Audit yang boleh melihat seluruh riwayat.' };
    const batas = Math.min(Math.max(parseInt(f.batas, 10) || 300, 1), 500);
    const q = String(f.q || '').toLowerCase().trim();
    const baris = jejakBaca_(perObjek ? f.id : ''); const out = []; let total = 0;
    for (let i = baris.length - 1; i >= 0; i--) {
      const r = baris[i];
      if (perObjek && (String(r[7]) !== String(f.objek) || String(r[8]).trim() !== String(f.id).trim())) continue;
      if (f.user && String(r[2]) !== String(f.user)) continue;
      if (f.aksi && String(r[6]).indexOf(String(f.aksi)) !== 0) continue;
      if (f.hasil && String(r[10]) !== String(f.hasil)) continue;
      const tgl = String(r[1]).slice(0, 10);
      if (f.dari && tgl < String(f.dari)) continue;
      if (f.sampai && tgl > String(f.sampai)) continue;
      if (q && [r[2], r[3], r[6], r[7], r[8], r[9]].join(' ').toLowerCase().indexOf(q) < 0) continue;
      total++; if (out.length < batas) out.push(jejakObj_(r));
    }
    const res = { status: 'success', data: out, total: total, terpotong: total > out.length };
    if (perObjek && String(f.objek) === 'LH') {
      try {
        const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
        if (sh) {
          const d = sh.getDataRange().getValues(); const h = d[0];
          const idc = h.findIndex(function (x) { const s = String(x).trim().toLowerCase(); return s === 'id_lh' || s === 'id'; });
          const kol = function (n) { return h.findIndex(function (x) { return String(x).trim().toLowerCase() === n.toLowerCase(); }); };
          const row = d.find(function (x, i) { return i > 0 && String(x[idc]).trim() === String(f.id).trim(); });
          if (row) { const g = function (n) { const c = kol(n); return c >= 0 && row[c] != null ? String(row[c]) : ''; };
            res.ringkas = { dibuatOleh: g('Dibuat_Oleh'), dibuatTgl: g('Dibuat_Tgl'), diubahOleh: g('Diubah_Oleh'), diubahTgl: g('Diubah_Tgl'), auditStatus: g('Audit_Status'), auditOleh: g('Audit_Oleh'), auditTgl: g('Audit_Tgl') }; }
        }
      } catch (e) { /* ringkasan tidak wajib */ }
    }
    return res;
  } catch (e) { return { status: 'error', message: String((e && e.message) || e) }; }
}

/** Periksa keutuhan rantai hash seluruh log. Hanya Super Admin dan Admin Audit. */
function jejakVerifikasi(auth) {
  try {
    const w = jejakWho_(auth); if (!w.ok) return w.galat;
    if (JEJAK_ROLES_SEMUA_.indexOf(String(w.who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Audit yang boleh memeriksa keutuhan riwayat.' };
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(JEJAK_SHEET_);
    if (!sh || sh.getLastRow() < 2) return { status: 'success', jumlah: 0, utuh: true, pesan: 'Belum ada riwayat.' };
    const semua = sh.getRange(2, 1, sh.getLastRow() - 1, JEJAK_H_.length).getValues();
    let prev = 'GENESIS';
    for (let i = 0; i < semua.length; i++) {
      const b = semua[i];
      if (jejakHash_(prev, b) !== String(b[12])) return { status: 'success', jumlah: semua.length, utuh: false, barisRusak: i + 2, idLog: String(b[0]), pesan: 'Rantai terputus pada baris ' + (i + 2) + ' (' + b[0] + '). Isi riwayat diubah atau ada baris yang dihapus.' };
      prev = String(b[12]);
    }
    return { status: 'success', jumlah: semua.length, utuh: true, pesan: 'Seluruh ' + semua.length + ' baris riwayat utuh.' };
  } catch (e) { return { status: 'error', message: String((e && e.message) || e) }; }
}

// ---------- fungsi yang dipanggil layar (nama publik; token ikut sebagai argumen terakhir yang dikirim pembungkus layar) ----------
function saveLhToSheet() { return jejakPanggil_(JEJAK_SPEC_.saveLhToSheet, arguments); }
function updateLhInSheet() { return jejakPanggil_(JEJAK_SPEC_.updateLhInSheet, arguments); }
function deleteLhFromSheet() { return jejakPanggil_(JEJAK_SPEC_.deleteLhFromSheet, arguments); }
function moveLhsToNewPk() { return jejakPanggil_(JEJAK_SPEC_.moveLhsToNewPk, arguments); }
function updateLhRabStatus() { return jejakPanggil_(JEJAK_SPEC_.updateLhRabStatus, arguments); }
function savePkToSheet() { return jejakPanggil_(JEJAK_SPEC_.savePkToSheet, arguments); }
function updatePkInSheet() { return jejakPanggil_(JEJAK_SPEC_.updatePkInSheet, arguments); }
function deletePkFromSheet() { return jejakPanggil_(JEJAK_SPEC_.deletePkFromSheet, arguments); }
function allocatePkToSpk() { return jejakPanggil_(JEJAK_SPEC_.allocatePkToSpk, arguments); }
function removePkFromSpk() { return jejakPanggil_(JEJAK_SPEC_.removePkFromSpk, arguments); }
function updateStatusCetakPK() { return jejakPanggil_(JEJAK_SPEC_.updateStatusCetakPK, arguments); }
function saveSpkToSheet() { return jejakPanggil_(JEJAK_SPEC_.saveSpkToSheet, arguments); }
function updateSpkInSheet() { return jejakPanggil_(JEJAK_SPEC_.updateSpkInSheet, arguments); }
function deleteSpkFromSheet() { return jejakPanggil_(JEJAK_SPEC_.deleteSpkFromSheet, arguments); }
function saveRabToSheet() { return jejakPanggil_(JEJAK_SPEC_.saveRabToSheet, arguments); }
function toggleLockRab() { return jejakPanggil_(JEJAK_SPEC_.toggleLockRab, arguments); }
function updateUpahRab() { return jejakPanggil_(JEJAK_SPEC_.updateUpahRab, arguments); }
function logLinkPk() { return jejakPanggil_(JEJAK_SPEC_.logLinkPk, arguments); }
function logSetujuiUsulan() { return jejakPanggil_(JEJAK_SPEC_.logSetujuiUsulan, arguments); }
function logTolakUsulan() { return jejakPanggil_(JEJAK_SPEC_.logTolakUsulan, arguments); }
function logAjukanSpk() { return jejakPanggil_(JEJAK_SPEC_.logAjukanSpk, arguments); }
function logSetujuiSpk() { return jejakPanggil_(JEJAK_SPEC_.logSetujuiSpk, arguments); }
function logSaveConfig() { return jejakPanggil_(JEJAK_SPEC_.logSaveConfig, arguments); }
function ktkCreate() { return jejakPanggil_(JEJAK_SPEC_.ktkCreate, arguments); }
function ktkSave() { return jejakPanggil_(JEJAK_SPEC_.ktkSave, arguments); }
function ktkMove() { return jejakPanggil_(JEJAK_SPEC_.ktkMove, arguments); }
function ktkFolderRename() { return jejakPanggil_(JEJAK_SPEC_.ktkFolderRename, arguments); }
function ktkTemplateOp() { return jejakPanggil_(JEJAK_SPEC_.ktkTemplateOp, arguments); }
function akunSimpan() { return jejakPanggil_(JEJAK_SPEC_.akunSimpan, arguments); }
function arsipPulihkan() { return jejakPanggil_(JEJAK_SPEC_.arsipPulihkan, arguments); }
function cadanganManual() { return jejakPanggil_(JEJAK_SPEC_.cadanganManual, arguments); }
function ktkKembalikan() { return jejakPanggil_(JEJAK_SPEC_.ktkKembalikan, arguments); }
function ktkFolderPemilik() { return jejakPanggil_(JEJAK_SPEC_.ktkFolderPemilik, arguments); }
function auditTandaiLh() { return jejakPanggil_(JEJAK_SPEC_.auditTandaiLh, arguments); }
function auditSimpanTemuan() { return jejakPanggil_(JEJAK_SPEC_.auditSimpanTemuan, arguments); }
function code37Cetak() { return jejakPanggil_(JEJAK_SPEC_.code37Cetak, arguments); }
function arsipRentangFileTambah() { return jejakPanggil_(JEJAK_SPEC_.arsipRentangFileTambah, arguments); }
function arsipRentangFileHapus() { return jejakPanggil_(JEJAK_SPEC_.arsipRentangFileHapus, arguments); }
function arsipRentangPindah() { return jejakPanggil_(JEJAK_SPEC_.arsipRentangPindah, arguments); }
function arsipRentangPulihkan() { return jejakPanggil_(JEJAK_SPEC_.arsipRentangPulihkan, arguments); }
function code37PenandaSimpan() { return jejakPanggil_(JEJAK_SPEC_.code37PenandaSimpan, arguments); }
function code37PenandaHapus() { return jejakPanggil_(JEJAK_SPEC_.code37PenandaHapus, arguments); }
function code37NormSimpan() { return jejakPanggil_(JEJAK_SPEC_.code37NormSimpan, arguments); }
function code37NormHapus() { return jejakPanggil_(JEJAK_SPEC_.code37NormHapus, arguments); }
function code37NormImpor() { return jejakPanggil_(JEJAK_SPEC_.code37NormImpor, arguments); }
function lhUnggahDokumen() { return jejakPanggil_(JEJAK_SPEC_.lhUnggahDokumen, arguments); }
