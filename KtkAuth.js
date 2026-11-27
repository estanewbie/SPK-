/**
 * ============================================================================
 * KtkAuth.js - Identitas pengguna dan FOLDER KTK (pemisahan pekerjaan antar admin)
 * ----------------------------------------------------------------------------
 * Prinsip: yang menentukan siapa memiliki apa adalah ID, bukan nama.
 *   - ID pengguna  = kolom Username di Data_User (unik).
 *   - ID folder    = "FLD-..." (dibuat sistem, tidak pernah dipakai ulang).
 *   - Tiap kontrak KTK menyimpan ID_Folder dan ID_Pemilik (Username pemilik folder).
 * Server memeriksa kepemilikan pada SETIAP pemanggilan KTK. Admin hanya bisa melihat dan mengubah kontrak di folder miliknya.
 * Super Admin melihat semua. Kontrak lama (sebelum fitur folder) tanpa folder hanya terlihat oleh Super Admin sampai dipindahkan.
 *
 * Identitas berasal dari TOKEN SESI yang dibuat server saat login (CacheService, 6 jam, diperpanjang tiap dipakai),
 * bukan dari nama atau role kiriman layar. Super Admin yang memakai "Masuk sebagai" mengirim ID akun tujuan (as).
 * ============================================================================
 */

const KTK_SESSION_TTL_ = 21600;   // detik (batas maksimum CacheService)

/** Cari akun di Data_User berdasarkan Username (ID). Kembalikan { id, name, role } atau null. */
const KTK_USER_CACHE_DETIK_ = 45;   // peran/akun dibaca dari cache sebentar supaya tiap pemanggilan tidak membaca seluruh Data_User; perubahan peran berlaku maksimal 45 detik kemudian
function ktkUser_(username) {
  const u = String(username === null || username === undefined ? '' : username).trim();
  if (!u || u.length > 100) return null;
  let cache = null, key = 'ktk_u_' + u;
  try { cache = CacheService.getScriptCache(); const c = cache.get(key); if (c) return JSON.parse(c); } catch (e) { cache = null; }
  const rows = getSheetDataAsObject_('Data_User');
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].Username).trim() === u) {
      if (String(rows[i].Status == null ? '' : rows[i].Status).trim().toLowerCase() === 'nonaktif') return null;   // akun dinonaktifkan Super Admin: sesi yang berjalan ikut mati
      const hasil = { id: u, name: String(rows[i].Nama || '').trim(), role: String(rows[i].Role || '').trim() };
      try { if (cache) cache.put(key, JSON.stringify(hasil), KTK_USER_CACHE_DETIK_); } catch (e) { /* tanpa cache tetap benar */ }
      return hasil;
    }
  }
  return null;
}

/** Dipanggil verifyUserLogin: buat token sesi untuk Username ini. */
function ktkIssueToken_(username) {
  const tok = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  CacheService.getScriptCache().put('ktk_s_' + tok, JSON.stringify({ u: String(username).trim(), iat: Date.now() }), KTK_SESSION_TTL_);
  return tok;
}
const KTK_SESSION_MAKS_MS_ = 12 * 3600 * 1000;   // batas mutlak satu sesi: setelah 12 jam harus masuk lagi walau terus dipakai

/**
 * Identitas efektif untuk satu pemanggilan. auth = { t: token, as: Username akun tujuan (khusus Super Admin) }.
 * Role SELALU dibaca dari Data_User, tidak dipercaya dari layar.
 */
function ktkWho_(auth) {
  if (!auth || !auth.t) throw new Error('Sesi tidak ditemukan. Silakan login ulang.');
  const cache = CacheService.getScriptCache();
  const key = 'ktk_s_' + String(auth.t);
  const raw = cache.get(key);
  if (!raw) throw new Error('Sesi berakhir. Silakan login ulang.');
  const sesi = JSON.parse(raw);
  if (sesi.iat && Date.now() - sesi.iat > KTK_SESSION_MAKS_MS_) { cache.remove(key); throw new Error('Sesi berakhir. Silakan login ulang.'); }
  const real = ktkUser_(sesi.u);
  if (!real) throw new Error('Akun tidak ditemukan. Silakan login ulang.');
  cache.put(key, raw, KTK_SESSION_TTL_);   // sesi diperpanjang selama dipakai
  let eff = real;
  if (auth.as && String(auth.as).trim() !== real.id) {
    if (real.role !== 'Super Admin') throw new Error('Hanya Super Admin yang boleh bertindak sebagai pengguna lain.');
    eff = ktkUser_(auth.as);
    if (!eff) throw new Error('Akun tujuan tidak ditemukan.');
  }
  return { id: eff.id, name: eff.name, role: eff.role, realId: real.id, realRole: real.role };
}

const KTK_H_FOLDER_ = ['ID_Folder', 'Nama_Folder', 'ID_Pemilik', 'Nama_Pemilik', 'Dibuat'];

function ktkFolders_() {
  return ktkRead_('Ktk_Folder').filter(function (r) { return r[0]; });
}

/** Folder yang boleh dilihat: Super Admin semua, yang lain hanya miliknya (dicocokkan lewat ID pemilik). */
function ktkFoldersOf_(who) {
  const all = ktkFolders_();
  return who.role === 'Super Admin' ? all : all.filter(function (f) { return String(f[2]) === who.id; });
}

/** Boleh mengakses kontrak ini? (kolom 10 = ID_Pemilik). Kontrak tanpa pemilik (data lama) hanya untuk Super Admin. */
function ktkCanSee_(who, konRow) {
  if (who.role === 'Super Admin') return true;
  return String(konRow[10] || '') !== '' && String(konRow[10]) === who.id;
}

function ktkNewFolderId_(existing) {
  const used = {}; existing.forEach(function (f) { used[String(f[0])] = true; });
  let id;
  do { id = 'FLD-' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyMMddHHmmss') + '-' + Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0'); } while (used[id]);
  return id;
}

const KTK_NORM_ = function (s) { return String(s === null || s === undefined ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); };

/** Ganti nama folder (hanya pemilik atau Super Admin). Nama boleh sama dengan folder pemilik lain, ID yang membedakan. */
function ktkFolderRenameAsli_(idFolder, nama, auth) {
  const lock = LockService.getScriptLock();
  try {
    const who = ktkAuth_(auth);
    const nm = String(nama || '').trim(); if (!nm) return { status: 'error', message: 'Nama folder wajib diisi.' };
    lock.waitLock(20000);
    const fl = ktkFolders_(); const i = fl.findIndex(function (f) { return String(f[0]) === String(idFolder); });
    if (i < 0) return { status: 'error', message: 'Folder tidak ditemukan.' };
    if (who.role !== 'Super Admin' && String(fl[i][2]) !== who.id) return { status: 'error', message: 'Folder ini bukan milik Anda.' };
    if (fl.some(function (f, j) { return j !== i && String(f[2]) === String(fl[i][2]) && KTK_NORM_(f[1]) === KTK_NORM_(nm); })) return { status: 'error', message: 'Sudah ada folder dengan nama itu di akun yang sama.' };
    fl[i][1] = nm;
    ktkReplace_('Ktk_Folder', KTK_H_FOLDER_, fl);
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.toString() }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}

/**
 * Pindahkan kontrak ke folder (khusus Super Admin; dipakai untuk kontrak lama yang belum punya folder).
 * target = ID folder yang ada, atau { folderId } , atau { ownerId: Username admin tujuan, folderName } untuk membuat (atau memakai) folder atas nama admin itu.
 */
function ktkMoveAsli_(idKtk, target, auth) {
  const lock = LockService.getScriptLock();
  try {
    const who = ktkAuth_(auth);
    if (who.role !== 'Super Admin') return { status: 'error', message: 'Hanya Super Admin yang boleh memindahkan kontrak antar folder.' };
    lock.waitLock(20000);
    const t = (target && typeof target === 'object') ? target : { folderId: target };
    const fl = ktkFolders_(); let f = null, newFolder = false;
    if (t.folderId) {
      f = fl.filter(function (x) { return String(x[0]) === String(t.folderId); })[0];
      if (!f) return { status: 'error', message: 'Folder tujuan tidak ditemukan.' };
    } else {
      const owner = ktkUser_(t.ownerId);
      if (!owner || KTK_ROLES_.indexOf(owner.role) < 0) return { status: 'error', message: 'Admin tujuan tidak ditemukan atau tidak berhak memakai menu KTK.' };
      const nm = String(t.folderName || '').trim(); if (!nm) return { status: 'error', message: 'Isi nama folder.' };
      f = fl.filter(function (x) { return String(x[2]) === owner.id && KTK_NORM_(x[1]) === KTK_NORM_(nm); })[0];   // nama sama di akun yang sama: pakai yang ada
      if (!f) { f = [ktkNewFolderId_(fl), nm, owner.id, owner.name, new Date()]; fl.push(f); newFolder = true; }
    }
    const kon = ktkRead_('Ktk_Kontrak'); const k = kon.findIndex(function (r) { return r[0] === idKtk; });
    if (k < 0 || String(idKtk).indexOf('TPL-') === 0) return { status: 'error', message: 'Kontrak tidak ditemukan.' };
    kon[k][9] = f[0]; kon[k][10] = f[2]; kon[k][8] = new Date();
    if (newFolder) ktkReplace_('Ktk_Folder', KTK_H_FOLDER_, fl);
    ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, kon);
    return { status: 'success', folderId: String(f[0]) };
  } catch (e) { return { status: 'error', message: e.toString() }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}

/** Akun yang berhak memakai menu KTK (untuk memilih admin tujuan). Hanya Super Admin. */
function ktkUsers_(who) {
  if (who.role !== 'Super Admin') return [];
  return getSheetDataAsObject_('Data_User').filter(function (u) { return String(u.Username).trim() && KTK_ROLES_.indexOf(String(u.Role).trim()) >= 0; })
    .map(function (u) { return { id: String(u.Username).trim(), name: String(u.Nama || '').trim(), role: String(u.Role).trim() }; });
}