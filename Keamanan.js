/**
 * ============================================================================
 * Keamanan.js - Pengamanan aplikasi dan perlindungan data
 * ----------------------------------------------------------------------------
 * 1. SANDI: disimpan sebagai hash bergaram (bukan teks biasa). Sandi lama yang masih teks biasa tetap bisa dipakai masuk dan
 *    OTOMATIS diubah menjadi hash saat pemiliknya berhasil masuk (dibaca ulang; bila gagal, isi lama dikembalikan).
 * 2. PENGUNCIAN LOGIN: 5 kali salah berturut-turut pada satu akun mengunci akun itu 15 menit (menahan tebak sandi).
 * 3. HAK AKSES DI SERVER: setiap fungsi tulis dicek terhadap peran akun (dari Data_User, bukan kiriman layar).
 * 4. FUNGSI PEMELIHARAAN (setup, perbaikan ID, dll) tidak bisa dipanggil dari browser. Untuk menjalankannya dari editor,
 *    isi dulu Script property PEMELIHARAAN_SAMPAI = waktu batas, mis. 2026-11-20 18:00 (Project Settings > Script properties).
 * 5. PENGHAPUSAN AMAN: PK yang masih punya LH, SPK yang masih punya PK, dan LH yang sudah masuk RAB tidak bisa dihapus.
 *    Setiap baris yang dihapus disalin dulu ke sheet Arsip_Hapus (bisa dipulihkan).
 * 6. SUNTIK RUMUS: teks kiriman layar yang diawali = + - @ diberi spasi di depan supaya Sheet tidak menjalankannya sebagai rumus.
 * 7. CADANGAN: cadanganSekarang() menyalin seluruh spreadsheet ke folder Drive; pasangCadanganHarian() memasang pemicu harian.
 * ============================================================================
 */

// ---------- 3. hak akses fungsi tulis (peran yang diizinkan) ----------
const KMN_SA_ = 'Super Admin', KMN_PK_ = 'Admin PK', KMN_SPK_ = 'Admin SPK', KMN_CODE_ = 'Admin Code', KMN_AUD_ = 'Admin Audit';
const KMN_PERAN_ = {
  saveLhToSheet: [KMN_SA_, KMN_PK_, KMN_SPK_], updateLhInSheet: [KMN_SA_, KMN_PK_, KMN_SPK_], deleteLhFromSheet: [KMN_SA_, KMN_PK_, KMN_SPK_],
  moveLhsToNewPk: [KMN_SA_, KMN_PK_], updateLhRabStatus: [KMN_SA_, KMN_PK_, KMN_SPK_],
  savePkToSheet: [KMN_SA_, KMN_PK_, KMN_SPK_, KMN_CODE_], updatePkInSheet: [KMN_SA_, KMN_PK_, KMN_SPK_, KMN_CODE_], deletePkFromSheet: [KMN_SA_, KMN_PK_, KMN_SPK_],
  allocatePkToSpk: [KMN_SA_, KMN_SPK_], removePkFromSpk: [KMN_SA_, KMN_SPK_], updateStatusCetakPK: [KMN_SA_, KMN_PK_, KMN_SPK_, KMN_CODE_],
  saveSpkToSheet: [KMN_SA_, KMN_SPK_], updateSpkInSheet: [KMN_SA_, KMN_SPK_], deleteSpkFromSheet: [KMN_SA_, KMN_SPK_],
  saveRabToSheet: [KMN_SA_, KMN_PK_, KMN_SPK_], toggleLockRab: [KMN_SA_, KMN_PK_, KMN_SPK_], updateUpahRab: [KMN_SA_, KMN_PK_, KMN_SPK_],
  logLinkPk: [KMN_SA_, KMN_PK_, KMN_SPK_], logSetujuiUsulan: [KMN_SA_, KMN_PK_, KMN_SPK_], logTolakUsulan: [KMN_SA_, KMN_PK_, KMN_SPK_],
  logAjukanSpk: [KMN_SA_, KMN_PK_, KMN_SPK_], logSetujuiSpk: [KMN_SA_, KMN_SPK_], logSaveConfig: [KMN_SA_, KMN_SPK_]
  // ktk*, audit*, lhUnggahDokumen memeriksa peran di dalam fungsinya sendiri.
};
function kmnPeranBoleh_(nama, role) {
  const d = KMN_PERAN_[nama]; if (!d) return true;
  return d.indexOf(String(role)) >= 0;
}

// ---------- 6. penetral rumus ----------
function kmnBersih_(v, dalam) {
  dalam = dalam || 0; if (dalam > 8) return v;
  if (typeof v === 'string') return /^[=@]|^[+\-](?=[A-Za-z(@=])/.test(v) ? ' ' + v : v;
  if (Array.isArray(v)) return v.map(function (x) { return kmnBersih_(x, dalam + 1); });
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(function (k) { o[k] = kmnBersih_(v[k], dalam + 1); }); return o; }
  return v;
}

// ---------- 1. sandi ----------
const KMN_ITER_ = 200;
const KMN_FORMAT_ = /^h1\$[0-9a-f]{32}\$[0-9a-f]{64}$/;
function kmnHex_(bytes) { return bytes.map(function (x) { return ('0' + (x < 0 ? x + 256 : x).toString(16)).slice(-2); }).join(''); }
function kmnSha_(t) { return kmnHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8)); }
function kmnHashSandi_(sandi, garam) {
  let h = kmnSha_(garam + '|' + sandi);
  for (let i = 0; i < KMN_ITER_; i++) h = kmnSha_(h + '|' + garam + '|' + sandi);
  return h;
}
function kmnBuatSandiTersimpan_(sandi) {
  const garam = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32);
  return 'h1$' + garam + '$' + kmnHashSandi_(String(sandi), garam);
}
/** Perbandingan yang tidak berhenti di huruf pertama yang beda. */
function kmnSamaAman_(a, b) {
  a = String(a); b = String(b); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
/** { cocok, perluUbah }: perluUbah = sandi tersimpan masih teks biasa dan sebaiknya diubah menjadi hash. */
function kmnPeriksaSandi_(tersimpan, input) {
  const t = String(tersimpan == null ? '' : tersimpan).trim(), x = String(input == null ? '' : input).trim();
  if (!t || !x) return { cocok: false, perluUbah: false };
  if (KMN_FORMAT_.test(t)) { const p = t.split('$'); return { cocok: kmnSamaAman_(kmnHashSandi_(x, p[1]), p[2]), perluUbah: false }; }
  return { cocok: kmnSamaAman_(t, x), perluUbah: true };
}
/** Ubah sandi teks biasa milik satu akun menjadi hash. Dibaca ulang; bila tidak cocok, isi lama dikembalikan. */
function kmnUbahKeHash_(username, sandiTeks) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_User'); if (!sh) return false;
    const v = sh.getDataRange().getValues(); const h = v[0].map(function (x) { return String(x).trim(); });
    const iu = h.indexOf('Username'), ip = h.indexOf('Password'); if (iu < 0 || ip < 0) return false;
    for (let i = 1; i < v.length; i++) {
      if (String(v[i][iu]).trim() !== String(username).trim()) continue;
      if (!kmnSamaAman_(String(v[i][ip]).trim(), String(sandiTeks).trim())) return false;   // isi berubah sejak dibaca: jangan ditimpa
      const lama = v[i][ip], baru = kmnBuatSandiTersimpan_(sandiTeks);
      sh.getRange(i + 1, ip + 1).setNumberFormat('@').setValue(baru); SpreadsheetApp.flush();
      if (String(sh.getRange(i + 1, ip + 1).getValue()) !== baru) { sh.getRange(i + 1, ip + 1).setValue(lama); return false; }
      return true;
    }
  } catch (e) { /* tetap berlaku sandi lama */ }
  return false;
}

// ---------- 2. penguncian login ----------
const KMN_BATAS_SALAH_ = 5, KMN_KUNCI_DETIK_ = 900;
function kmnKunciKey_(u) { return 'lk_' + kmnSha_(String(u == null ? '' : u).trim().toLowerCase()).slice(0, 40); }
function kmnTerkunci_(u) {
  try { const r = CacheService.getScriptCache().get(kmnKunciKey_(u)); return !!r && parseInt(r, 10) >= KMN_BATAS_SALAH_; } catch (e) { return false; }
}
function kmnCatatSalah_(u) {
  try {
    const c = CacheService.getScriptCache(), k = kmnKunciKey_(u); const n = (parseInt(c.get(k), 10) || 0) + 1;
    c.put(k, String(n), KMN_KUNCI_DETIK_); return n;
  } catch (e) { return 0; }
}
function kmnBersihSalah_(u) { try { CacheService.getScriptCache().remove(kmnKunciKey_(u)); } catch (e) { /* abaikan */ } }

// ---------- 4. gerbang fungsi pemeliharaan ----------
/** null bila pemeliharaan dibuka; selain itu objek galat. */
function kmnGerbang_() {
  let s = ''; try { s = String(PropertiesService.getScriptProperties().getProperty('PEMELIHARAAN_SAMPAI') || '').trim(); } catch (e) { s = ''; }
  const t = s ? new Date(s.replace(' ', 'T') + (s.length <= 16 ? ':00' : '')).getTime() : 0;
  if (t && t > Date.now()) return null;
  return { status: 'error', message: 'Fungsi pemeliharaan terkunci. Untuk menjalankannya dari editor, isi Script property PEMELIHARAAN_SAMPAI dengan waktu batas (mis. 2026-11-20 18:00), lalu jalankan lagi.' };
}

// ---------- 5. penghapusan aman ----------
function kmnBacaSheet_(nama) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(nama); if (!sh) return { sh: null, h: [], v: [] };
  const v = sh.getDataRange().getValues(); return { sh: sh, h: (v[0] || []).map(function (x) { return String(x).trim().toLowerCase(); }), v: v };
}
function kmnKol_(h, daftar) { for (let i = 0; i < daftar.length; i++) { const k = h.indexOf(daftar[i]); if (k >= 0) return k; } return -1; }
/** Syarat sebelum menghapus. Mengembalikan null bila boleh, atau pesan penolakan. */
function kmnSyaratHapus_(nama, id) {
  const sid = String(id == null ? '' : id).trim(); if (!sid) return 'ID kosong.';
  if (nama === 'deletePkFromSheet') {
    const d = kmnBacaSheet_('Data_LH'); const k = kmnKol_(d.h, ['id_pk']);
    const n = k < 0 ? 0 : d.v.slice(1).filter(function (r) { return String(r[k]).trim() === sid; }).length;
    if (n > 0) return 'PK ' + sid + ' masih punya ' + n + ' LH. Pindahkan atau hapus LH-nya dulu supaya tidak ada LH yatim.';
  } else if (nama === 'deleteSpkFromSheet') {
    const d = kmnBacaSheet_('Data_PK'); const k = kmnKol_(d.h, ['id_spk']);
    const n = k < 0 ? 0 : d.v.slice(1).filter(function (r) { return String(r[k]).trim() === sid; }).length;
    if (n > 0) return 'SPK ' + sid + ' masih berisi ' + n + ' PK. Keluarkan PK-nya dulu.';
  } else if (nama === 'deleteLhFromSheet') {
    const d = kmnBacaSheet_('Data_LH'); const ki = kmnKol_(d.h, ['id_lh', 'id']), kr = kmnKol_(d.h, ['is_rab_created']);
    const r = ki < 0 ? null : d.v.slice(1).find(function (x) { return String(x[ki]).trim() === sid; });
    if (r && kr >= 0 && (r[kr] === true || String(r[kr]).toUpperCase() === 'TRUE')) return 'LH ' + sid + ' sudah masuk RAB dan tidak boleh dihapus.';
  }
  return null;
}
/** Salin baris yang akan dihapus ke Arsip_Hapus. Mengembalikan false bila arsip gagal ditulis (penghapusan dibatalkan). */
function kmnArsipkan_(nama, id, who) {
  const peta = { deletePkFromSheet: ['Data_PK', ['id_pk']], deleteSpkFromSheet: ['Data_SPK', ['id_spk']], deleteLhFromSheet: ['Data_LH', ['id_lh', 'id']] }[nama];
  if (!peta) return true;
  try {
    const d = kmnBacaSheet_(peta[0]); if (!d.sh) return true;
    const k = kmnKol_(d.h, peta[1]); if (k < 0) return false;
    const r = d.v.slice(1).find(function (x) { return String(x[k]).trim() === String(id).trim(); });
    if (!r) return true;   // tidak ada yang dihapus
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID); let a = ss.getSheetByName('Arsip_Hapus');
    if (!a) { a = ss.insertSheet('Arsip_Hapus'); a.getRange(1, 1, 1, 6).setValues([['Waktu', 'ID_User', 'Sheet', 'ID', 'Judul_Kolom', 'Isi_Baris']]).setFontWeight('bold'); }
    const baris = [jejakWaktu_(), who.id, peta[0], String(id).trim(), JSON.stringify(d.v[0]), JSON.stringify(r).slice(0, 45000)];
    a.appendRow(baris); SpreadsheetApp.flush();
    return true;
  } catch (e) { return false; }
}

// ---------- 7. cadangan ----------
const KMN_CADANGAN_SIMPAN_ = 14;
/** Salin seluruh spreadsheet ke FOLDER_ID (nama "Cadangan RAB yyyy-MM-dd HHmm"); simpan 14 terakhir, sisanya dibuang ke tempat sampah. */
function kmnCadangkan_() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const nama = 'Cadangan RAB ' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HHmm');
  const salin = DriveApp.getFileById(SPREADSHEET_ID).makeCopy(nama, folder);
  let dibuang = 0;
  try {
    const it = folder.searchFiles("title contains 'Cadangan RAB ' and trashed = false"); const arr = [];
    while (it.hasNext()) arr.push(it.next());
    arr.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
    arr.slice(KMN_CADANGAN_SIMPAN_).forEach(function (f) { try { f.setTrashed(true); dibuang++; } catch (e) { /* abaikan */ } });
  } catch (e) { /* pembersihan tidak wajib */ }
  return { status: 'success', nama: nama, id: salin.getId(), dibuang: dibuang };
}
/** Pemicu harian memanggil ini. Gagal tidak boleh diam: dicatat di log eksekusi. */
function cadanganHarian() {
  try { const r = kmnCadangkan_(); Logger.log('Cadangan dibuat: ' + r.nama); return r; }
  catch (e) { Logger.log('CADANGAN GAGAL: ' + e); throw e; }
}
/** Jalankan dari editor: cadangan sekarang juga. */
function cadanganSekarang() { const g = kmnGerbang_(); if (g) return g; try { return kmnCadangkan_(); } catch (e) { return { status: 'error', message: String((e && e.message) || e) }; } }
/** Jalankan dari editor SEKALI: memasang pemicu cadangan setiap hari pukul 02.00. */
function pasangCadanganHarian() {
  const g = kmnGerbang_(); if (g) return g;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'cadanganHarian') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cadanganHarian').timeBased().everyDays(1).atHour(2).create();
  return { status: 'success', message: 'Cadangan harian dipasang (pukul 02.00).' };
}

// ---------- akun ----------
/** Jalankan dari editor: ubah SEMUA sandi teks biasa di Data_User menjadi hash sekarang (tanpa menunggu pemiliknya masuk). */
function amankanSemuaSandi() {
  const g = kmnGerbang_(); if (g) return g;
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_User'); if (!sh) return { status: 'error', message: 'Data akun tidak ada.' };
  const v = sh.getDataRange().getValues(); const h = v[0].map(function (x) { return String(x).trim(); });
  const iu = h.indexOf('Username'), ip = h.indexOf('Password'); if (iu < 0 || ip < 0) return { status: 'error', message: 'Kolom Username/Password tidak ada.' };
  let diubah = 0, gagal = 0, sudah = 0;
  for (let i = 1; i < v.length; i++) {
    const s = String(v[i][ip] == null ? '' : v[i][ip]).trim(); if (!s) continue;
    if (KMN_FORMAT_.test(s)) { sudah++; continue; }
    if (kmnUbahKeHash_(v[i][iu], s)) diubah++; else gagal++;
  }
  return { status: 'success', diubah: diubah, sudahHash: sudah, gagal: gagal };
}

// ---------- pembacaan data: wajib sesi sah ----------
/** { ok, who } atau { ok:false, galat }. */
function kmnSesi_(auth) { return jejakWho_(auth); }
