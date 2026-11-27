/**
 * ============================================================================
 * Ktk.gs - BACKEND MENU KTK (Kerja Tambah Kurang)  | Tahap 1: Volume kontrak & Paket
 * ----------------------------------------------------------------------------
 * File BARU. Tidak mengubah Code.gs. Pakai SPREADSHEET_ID dan getSheetDataOptimized_ dari Code.gs.
 *
 * Sheet yang dibuat otomatis oleh ktkSetup():
 *   Ktk_Kontrak : ID_KTK | Jenis | No_Kontrak | Nama_Kontrak | Vendor | ID_SPK | Status | Dibuat_Oleh | Diubah
 *   Ktk_Paket   : ID_Paket | ID_KTK | Urutan | Nama_Paket | Dipakai | Kustom
 *   Ktk_Item    : ID_Paket | Urutan | Tipe | Nama | Satuan | Volume | Harga_Material | Harga_Jasa
 * Baris dengan ID_KTK "TPL-71" / "TPL-62" adalah TEMPLATE paket (volume 0) untuk kontrak baru.
 *
 * Semua total (jumlah, DPP, PPN, bulat) TIDAK disimpan. Dihitung dari volume x harga setiap kali dibuka,
 * dengan rumus yang sama persis dengan yang akan dipakai export Excel.
 * ============================================================================
 */

const KTK_ROLES_ = ['Super Admin', 'Admin SPK', 'Admin PK'];

/** Identitas dari token sesi (KtkAuth.js), bukan dari kiriman layar. Mengembalikan { id, name, role }. */
function ktkAuth_(auth) {
  const who = ktkWho_(auth);
  if (KTK_ROLES_.indexOf(String(who.role)) < 0) throw new Error('Menu KTK hanya untuk Super Admin, Admin SPK, dan Admin PK.');
  return who;
}

function ktkSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const r = sh.getRange(1, 1, 1, headers.length);
  r.setValues([headers]).setFontWeight('bold').setBackground('#D9D9D9');
  sh.setFrozenRows(1);
  // Volume & harga disimpan sebagai TEKS agar tidak dipotong float / format Sheet.
  if (name === 'Ktk_Item') sh.getRange(1, 6, sh.getMaxRows(), 3).setNumberFormat('@');
  // Ktk_Pilihan (ID LH, alias, isi header laporan) juga teks, supaya '6.10' atau '0127.SPK/...' tidak diubah Sheet menjadi angka/tanggal.
  if (name === 'Ktk_Pilihan') sh.getRange(1, 1, sh.getMaxRows(), 4).setNumberFormat('@');
  return sh;
}

/** Angka -> teks aman untuk Sheet. dec = jumlah desimal tetap (harga 10); dec null = volume (tanpa nol di belakang). */
function ktkTxt_(v, dec) {
  if (v === '' || v === null || v === undefined) return '';
  let s = (typeof v === 'number') ? (dec === null ? String(v) : v.toFixed(dec)) : String(v).trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) s = '0';
  if (dec === null) return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  const p = s.split('.'); const f = ((p[1] || '') + '0000000000').slice(0, dec);
  return p[0] + '.' + f;
}
/** Baris Ktk_Item: kolom Volume(5), Harga_Material(6), Harga_Jasa(7) dijadikan teks. */
function ktkItemRow_(r) {
  // kolom 9 = Harga_Terhubung: 'L' = harga mengikuti Master_Data; kosong = harga manual (juga untuk data lama)
  if (r[2] !== 'item') return [r[0], r[1], r[2], r[3], r[4], r[5] || '', r[6] || '', r[7] || '', ''];
  return [r[0], r[1], r[2], r[3], r[4], ktkTxt_(r[5], null), ktkTxt_(r[6], 10), ktkTxt_(r[7], 10), r[8] === 'L' ? 'L' : ''];
}

function ktkRead_(name) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  // Ktk_Kontrak lama belum punya kolom ID_Folder dan ID_Pemilik: lengkapi dengan kosong
  if (name === 'Ktk_Kontrak') v.forEach(function (r) { while (r.length < KTK_H_KONTRAK_.length) r.push(''); });
  if (name === 'Ktk_Paket') v.forEach(function (r) { while (r.length < KTK_H_PAKET_.length) r.push(''); });   // Ktk_Paket lama belum punya kolom ID_PK
  return v;
}

function ktkReplace_(name, headers, rows) {
  const sh = ktkSheet_(name, headers);
  if (name === 'Ktk_Item') rows = rows.map(ktkItemRow_);
  rows = rows.map(function (r) { r = r.slice(0, headers.length); while (r.length < headers.length) r.push(''); return r; });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

const KTK_H_KONTRAK_ = ['ID_KTK', 'Jenis', 'No_Kontrak', 'Nama_Kontrak', 'Vendor', 'ID_SPK', 'Status', 'Dibuat_Oleh', 'Diubah', 'ID_Folder', 'ID_Pemilik'];   // ID_Folder + ID_Pemilik (Username) = kepemilikan, lihat KtkAuth.js
const KTK_H_PAKET_ = ['ID_Paket', 'ID_KTK', 'Urutan', 'Nama_Paket', 'Dipakai', 'Kustom', 'ID_PK'];   // ID_PK hanya terisi di KTK jenis 62: paket itu milik PK tersebut
const KTK_H_PILIH_ = ['ID_KTK', 'Tipe', 'A', 'B'];   // Tipe PK: A = ID PK yang dipilih SPK (KTK jenis 62; semua LH PK itu ikut). Tipe LH: A = ID LH yang dimasukkan ke SPK. Tipe ALIAS: A = nama di LH (dinormalisasi), B = nama di kontrak. Tipe HDR: A = kunci isian header laporan, B = isinya.
const KTK_H_ITEM_ = ['ID_Paket', 'Urutan', 'Tipe', 'Nama', 'Satuan', 'Volume', 'Harga_Material', 'Harga_Jasa', 'Harga_Terhubung'];

/** JALANKAN SEKALI dari editor: membuat sheet, template 71, dan kontrak contoh 0597. Aman diulang (tidak menimpa data). */
function ktkSetup() {
  const gerbang = kmnGerbang_(); if (gerbang) return gerbang.message;   // hanya dari editor (Keamanan.js)
  ktkSheet_('Ktk_Kontrak', KTK_H_KONTRAK_);
  ktkSheet_('Ktk_Paket', KTK_H_PAKET_);
  ktkSheet_('Ktk_Item', KTK_H_ITEM_);
  const kon = ktkRead_('Ktk_Kontrak');
  const has = function (id) { return kon.some(function (r) { return r[0] === id; }); };
  if (!has('TPL-71')) ktkInsertFromSeed_('TPL-71', true);
  if (!has('KTK-0597')) ktkInsertFromSeed_('KTK-0597', false);
  return 'Setup KTK selesai. Template 71 dan kontrak contoh KTK-0597 tersedia.';
}

function ktkInsertFromSeed_(idKtk, asTemplate) {
  const seed = ktkSeedData_();
  const kon = ktkRead_('Ktk_Kontrak'), pak = ktkRead_('Ktk_Paket'), itm = ktkRead_('Ktk_Item');
  kon.push(asTemplate
    ? [idKtk, '71', 'TEMPLATE', 'Template paket KTK jenis 71', '', '', 'Template', 'sistem', new Date()]
    : [idKtk, '71', '0597.SPK/DAN.01.03/F05030000/2025', 'Rehabilitasi Jaringan Distribusi Paket 17 - UP3 Bali Selatan', 'PT Nanda Nirwana Elektrik', '', 'Draf', 'sistem', new Date()]);
  seed.forEach(function (p, pi) {
    const idp = idKtk + '-P' + ('0' + (pi + 1)).slice(-2);
    pak.push([idp, idKtk, pi + 1, p[0], 'Y', 'N']);
    p[1].forEach(function (it, ii) {
      if (it[0] === '#') itm.push([idp, ii + 1, 'sub', it[1], '', '', '', '']);
      else itm.push([idp, ii + 1, 'item', it[0], it[1], asTemplate ? 0 : it[2], it[3], it[4]]);
    });
  });
  ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, kon);
  ktkReplace_('Ktk_Paket', KTK_H_PAKET_, pak);
  ktkReplace_('Ktk_Item', KTK_H_ITEM_, itm);
}

/**
 * Daftar kontrak (tanpa template). Server TIDAK menghitung uang (parser Apps Script tidak mendukung BigInt),
 * jadi tiap kontrak membawa baris ringkas `baris` = [volume, hargaMaterial, hargaJasa] (teks) dari paket yang dipakai.
 * Total dihitung di browser dengan KtkMath (BigInt) - rumus yang sama dengan halaman editor.
 */
function ktkList(auth) {
  try {
    const who = ktkAuth_(auth);
    const kon = ktkRead_('Ktk_Kontrak'), pak = ktkRead_('Ktk_Paket'), itm = ktkRead_('Ktk_Item');
    const paketOf = {}; pak.forEach(function (p) { paketOf[p[0]] = p; });
    const rows = {};
    itm.forEach(function (r) {
      const p = paketOf[r[0]]; if (!p || r[2] !== 'item' || p[4] !== 'Y') return;
      (rows[p[1]] = rows[p[1]] || []).push([ktkTxt_(r[5], null) || '0', ktkTxt_(r[6], 10), ktkTxt_(r[7], 10)]);
    });
    const allFolders = ktkFolders_(); const fname = {}, owner = {};
    allFolders.forEach(function (f) { fname[String(f[0])] = String(f[1]); owner[String(f[2])] = String(f[3]); });
    // hanya kontrak milik pengguna (Super Admin: semua); template paket terlihat semua
    const list = kon.filter(function (r) { return String(r[0]).indexOf('TPL-') === 0 || ktkCanSee_(who, r); }).map(function (r) {
      return { id: r[0], jenis: String(r[1]), no: r[2], nama: r[3], vendor: r[4], idSpk: r[5], status: r[6], baris: rows[r[0]] || [], template: String(r[0]).indexOf('TPL-') === 0, folderId: String(r[9] || ''), folderNama: fname[String(r[9] || '')] || '', pemilik: String(r[10] || ''), pemilikNama: owner[String(r[10] || '')] || '' };
    });
    // SPK yang sudah dikerjakan admin lain: hanya nomor SPK dan nama pemilik yang diberi tahu (isi kontrak tidak)
    const spkTaken = {};
    kon.forEach(function (r) { if (String(r[0]).indexOf('TPL-') === 0 || !r[5] || ktkCanSee_(who, r)) return; spkTaken[KTK_NORM_(r[5])] = owner[String(r[10] || '')] || 'belum masuk folder'; });
    const tplCount = {}; pak.forEach(function (p) { if (String(p[1]).indexOf('TPL-') === 0) tplCount[String(p[1]).slice(4)] = (tplCount[String(p[1]).slice(4)] || 0) + 1; });
    return { status: 'success', tplCount: tplCount, data: list, folders: ktkFoldersOf_(who).map(function (f) { return { id: String(f[0]), nama: String(f[1]), pemilik: String(f[2]), pemilikNama: String(f[3]) }; }), spkTaken: spkTaken, me: { id: who.id, name: who.name, role: who.role }, users: ktkUsers_(who) };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

/** Muat satu kontrak lengkap: paket + item. */
function ktkLoad(idKtk, auth) {
  try {
    const who = ktkAuth_(auth);
    const k = ktkRead_('Ktk_Kontrak').filter(function (r) { return r[0] === idKtk; })[0];
    if (!k) return { status: 'error', message: 'Kontrak tidak ditemukan' };
    if (String(idKtk).indexOf('TPL-') !== 0 && !ktkCanSee_(who, k)) return { status: 'error', message: 'Kontrak ini ada di folder admin lain dan tidak bisa dibuka dari akun Anda.' };
    const pak = ktkRead_('Ktk_Paket').filter(function (r) { return r[1] === idKtk; }).sort(function (a, b) { return a[2] - b[2]; });
    const ids = {}; pak.forEach(function (p) { ids[p[0]] = true; });
    const byP = {};
    ktkRead_('Ktk_Item').forEach(function (r) { if (ids[r[0]]) (byP[r[0]] = byP[r[0]] || []).push(r); });
    const paket = pak.map(function (p) {
      const items = (byP[p[0]] || []).sort(function (a, b) { return a[1] - b[1]; }).map(function (r) {
        return r[2] === 'sub' ? { tipe: 'sub', nama: r[3] } : { tipe: 'item', nama: r[3], sat: r[4], vol: ktkTxt_(r[5], null) || '0', pm: ktkTxt_(r[6], 10) || '0.0000000000', pj: ktkTxt_(r[7], 10) || '0.0000000000', link: r[8] === 'L' };
      });
      return { id: p[0], nama: p[3], dipakai: p[4] === 'Y', kustom: p[5] === 'Y', pkId: String(p[6] || ''), items: items };
    });
    const lhIds = [], pkIds = [], alias = {}, header = {}, lhTaken = {}, pkTaken = {};
    const noOf = {}; ktkRead_('Ktk_Kontrak').forEach(function (r) { noOf[String(r[0])] = String(r[2] || r[0]); });
    ktkRead_('Ktk_Pilihan').forEach(function (r) {
      if (r[0] !== idKtk) {
        // LH yang sudah dipakai KTK lain: tidak boleh muncul lagi di pemilihan LH kontrak ini
        if (r[1] === 'LH') lhTaken[String(r[2])] = noOf[String(r[0])] || String(r[0]);
        else if (r[1] === 'PK') pkTaken[String(r[2])] = noOf[String(r[0])] || String(r[0]);
        return;
      }
      if (r[1] === 'LH') lhIds.push(String(r[2]));
      else if (r[1] === 'PK') pkIds.push(String(r[2]));
      else if (r[1] === 'ALIAS') alias[String(r[2])] = String(r[3]);
      else if (r[1] === 'HDR') header[String(r[2])] = String(r[3]);
    });
    return { status: 'success', data: { id: k[0], folderId: String(k[9] || ''), pemilik: String(k[10] || ''), jenis: String(k[1]), no: k[2], nama: k[3], vendor: k[4], idSpk: k[5], status: k[6], paket: paket, lhIds: lhIds, pkIds: pkIds, alias: alias, header: header, lhTaken: lhTaken, pkTaken: pkTaken, convert: ktkConvertRows_() } };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

/**
 * Kontrak baru jenis 71 (atau 62 bila template ada), SELALU di dalam sebuah folder milik pembuat.
 * meta.folderId = pakai folder yang sudah ada (harus milik Anda), atau meta.folderName = buat folder baru.
 * Satu SPK hanya boleh punya satu KTK; SPK yang sudah dikerjakan admin lain ditolak.
 * Kontrak dibuat KOSONG: admin memilih paket dari template sesudahnya.
 */
function ktkCreateAsli_(meta, auth) {
  const lock = LockService.getScriptLock();
  try {
    const who = ktkAuth_(auth);
    if (!meta || !meta.no) return { status: 'error', message: 'Nomor kontrak wajib diisi' };
    lock.waitLock(20000);
    const jenis = String(meta.jenis || '71');
    if (KTK_JENIS_.indexOf(jenis) < 0) return { status: 'error', message: 'Jenis KTK tidak dikenal. Pilihan: ' + KTK_JENIS_.join(', ') + '.' };
    ktkTemplateEnsure_(jenis);   // template jenis baru (61, 62) dibuat kosong otomatis
    const kon = ktkRead_('Ktk_Kontrak');
    // folder: pakai yang ada (cek pemilik lewat ID) atau buat baru atas nama pembuat
    const fl = ktkFolders_(); let folder = null, newFolder = false;
    if (meta.folderId) {
      folder = fl.filter(function (f) { return String(f[0]) === String(meta.folderId); })[0];
      if (!folder) return { status: 'error', message: 'Folder tidak ditemukan.' };
      if (who.role !== 'Super Admin' && String(folder[2]) !== who.id) return { status: 'error', message: 'Folder ini milik admin lain.' };
    } else {
      const nm = String(meta.folderName || '').trim();
      if (!nm) return { status: 'error', message: 'Buat atau pilih folder dulu sebelum memilih template.' };
      if (fl.some(function (f) { return String(f[2]) === who.id && KTK_NORM_(f[1]) === KTK_NORM_(nm); })) return { status: 'error', message: 'Anda sudah punya folder bernama itu. Pilih folder yang ada.' };
      folder = [ktkNewFolderId_(fl), nm, who.id, who.name, new Date()]; fl.push(folder); newFolder = true;
    }
    if (meta.idSpk) {
      const dupe = kon.filter(function (r) { return String(r[0]).indexOf('TPL-') !== 0 && KTK_NORM_(r[5]) === KTK_NORM_(meta.idSpk); })[0];
      if (dupe) { const ow = fl.filter(function (f) { return String(f[2]) === String(dupe[10]); })[0]; return { status: 'error', message: 'SPK ini sudah punya KTK' + (String(dupe[10]) === who.id ? ' di folder Anda.' : ' yang dikerjakan ' + (ow ? ow[3] : 'admin lain') + '.') }; }
    }
    const id = 'KTK-' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyMMddHHmmss');
    kon.push([id, jenis, meta.no, meta.nama || '', meta.vendor || '', meta.idSpk || '', 'Draf', who.name, new Date(), String(folder[0]), String(folder[2])]);
    if (newFolder) ktkReplace_('Ktk_Folder', KTK_H_FOLDER_, fl); else ktkSheet_('Ktk_Folder', KTK_H_FOLDER_);
    ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, kon);
    return { status: 'success', id: id, folderId: String(folder[0]) };
  } catch (e) { return { status: 'error', message: e.toString() }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}
/**
 * Simpan seluruh isi satu kontrak (paket + item). doc.paket[i] = {id?, nama, dipakai, kustom, toTemplate?, items:[{tipe,nama,sat,vol,pm,pj}]}
 * Paket baru (tanpa id) diberi ID otomatis. Hanya baris milik kontrak ini yang diganti.
 */
function ktkSaveAsli_(doc, auth) {
  const lock = LockService.getScriptLock();
  try {
    const who = ktkAuth_(auth); const role = who.role;
    if (!doc || !doc.id || String(doc.id).indexOf('TPL-') === 0) return { status: 'error', message: 'Kontrak tidak valid' };
    lock.waitLock(20000);
    const kon = ktkRead_('Ktk_Kontrak');
    const ki = kon.findIndex(function (r) { return r[0] === doc.id; });
    if (ki < 0) return { status: 'error', message: 'Kontrak tidak ditemukan' };
    if (!ktkCanSee_(who, kon[ki])) return { status: 'error', message: 'Kontrak ini ada di folder admin lain. Perubahan ditolak.' };
    if (doc.idSpk !== undefined && KTK_NORM_(doc.idSpk) !== KTK_NORM_(kon[ki][5]) && doc.idSpk && kon.some(function (r) { return r[0] !== doc.id && String(r[0]).indexOf('TPL-') !== 0 && KTK_NORM_(r[5]) === KTK_NORM_(doc.idSpk); })) return { status: 'error', message: 'SPK itu sudah punya KTK lain.' };
    kon[ki][8] = new Date();
    if (doc.no) kon[ki][2] = doc.no; if (doc.nama !== undefined) kon[ki][3] = doc.nama; if (doc.vendor !== undefined) kon[ki][4] = doc.vendor; if (doc.idSpk !== undefined) kon[ki][5] = doc.idSpk;
    // STATUS: Draf = harga terhubung ikut Master_Data; Final = harga dibekukan. Hanya Super Admin/Admin SPK yang boleh
    // mengunci; hanya Super Admin yang boleh membuka kunci.
    const wasFinal = String(kon[ki][6]) === 'Final';
    const wantFinal = doc.status === undefined ? wasFinal : String(doc.status) === 'Final';
    if (!wasFinal && wantFinal && ['Super Admin', 'Admin SPK'].indexOf(String(role)) < 0) return { status: 'error', message: 'Hanya Super Admin atau Admin SPK yang boleh mengunci harga.' };
    if (wasFinal && !wantFinal && String(role) !== 'Super Admin') return { status: 'error', message: 'Hanya Super Admin yang boleh membuka kunci harga.' };
    kon[ki][6] = wantFinal ? 'Final' : 'Draf';
    const oldP = ktkRead_('Ktk_Paket'), oldI = ktkRead_('Ktk_Item');
    // Kontrak yang sudah Final: harga baris lama TIDAK boleh berubah (dijaga di server, bukan hanya di layar).
    const frozen = {};
    if (wasFinal && wantFinal) {
      const pid = {}; oldP.forEach(function (p) { if (p[1] === doc.id) pid[p[0]] = true; });
      oldI.forEach(function (r) { if (pid[r[0]] && r[2] === 'item') frozen[r[0] + '|' + r[3]] = [r[6], r[7], r[8]]; });
    }
    const oldIds = {}; oldP.forEach(function (p) { if (p[1] === doc.id) oldIds[p[0]] = true; });
    const pak = oldP.filter(function (p) { return p[1] !== doc.id; });
    const itm = oldI.filter(function (r) { return !oldIds[r[0]]; });
    const tplRows = { p: [], i: [] };
    const tplId = 'TPL-' + kon[ki][1];
    const tplCount = oldP.filter(function (p) { return p[1] === tplId; }).length;
    let t = 0; const rmIds = {};   // paket template lama bernama sama: diganti, bukan digandakan
    doc.paket.forEach(function (p, pi) {
      const idp = p.id || (doc.id + '-N' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'HHmmss') + ('0' + (pi + 1)).slice(-2));
      pak.push([idp, doc.id, pi + 1, p.nama, p.dipakai ? 'Y' : 'N', p.kustom ? 'Y' : 'N', String(p.pkId || '')]);
      p.items.forEach(function (it, ii) {
        if (it.tipe === 'sub') itm.push([idp, ii + 1, 'sub', it.nama, '', '', '', '']);
        else {
          const fz = frozen[idp + '|' + it.nama];
          itm.push([idp, ii + 1, 'item', it.nama, it.sat, ktkTxt_(it.vol, null) || '0', ktkTxt_(fz ? fz[0] : it.pm, 10), ktkTxt_(fz ? fz[1] : it.pj, 10), (fz ? fz[2] === 'L' : it.link) ? 'L' : '']);
        }
      });
      if (p.toTemplate && ['Super Admin', 'Admin SPK'].indexOf(String(role)) >= 0) {
        t++;
        oldP.forEach(function (x) { if (x[1] === tplId && KTK_NORM_(x[3]) === KTK_NORM_(p.nama)) rmIds[x[0]] = true; });
        const tid = tplId + '-C' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyMMddHHmmss') + t;
        tplRows.p.push([tid, tplId, tplCount + t, p.nama, 'Y', 'Y']);
        p.items.forEach(function (it, ii) { tplRows.i.push(it.tipe === 'sub' ? [tid, ii + 1, 'sub', it.nama, '', '', '', ''] : [tid, ii + 1, 'item', it.nama, it.sat, '0', ktkTxt_(it.pm, 10), ktkTxt_(it.pj, 10)]); });
      }
    });
    // LH yang dimasukkan ke SPK dan penyesuaian nama material: hanya Super Admin dan Admin SPK yang boleh mengubah.
    // Isian header laporan (Tipe HDR) boleh diubah semua peran KTK.
    if (doc.lhIds !== undefined || doc.alias !== undefined || doc.header !== undefined || doc.pkIds !== undefined) {
      const can = ['Super Admin', 'Admin SPK'].indexOf(String(role)) >= 0;
      const oldS = ktkRead_('Ktk_Pilihan');
      let mine = oldS.filter(function (r) { return r[0] === doc.id; });
      const others = oldS.filter(function (r) { return r[0] !== doc.id; });
      if (can && (doc.lhIds !== undefined || doc.alias !== undefined || doc.pkIds !== undefined)) {
        // satu LH dan satu PK hanya boleh masuk satu KTK
        const takenBy = {}, pkTakenBy = {};
        others.forEach(function (r) { if (r[1] === 'LH') takenBy[String(r[2])] = String(r[0]); else if (r[1] === 'PK') pkTakenBy[String(r[2])] = String(r[0]); });
        const clash = (doc.lhIds || []).filter(function (x) { return takenBy[String(x)]; });
        if (clash.length) return { status: 'error', message: 'LH sudah dipakai KTK lain: ' + clash.slice(0, 5).join(', ') + (clash.length > 5 ? ', ...' : '') + '. Keluarkan LH itu dari KTK ini.' };
        const pclash = (doc.pkIds || []).filter(function (x) { return pkTakenBy[String(x)]; });
        if (pclash.length) return { status: 'error', message: 'PK sudah dipakai KTK lain: ' + pclash.slice(0, 5).join(', ') + (pclash.length > 5 ? ', ...' : '') + '. Keluarkan PK itu dari KTK ini.' };
        const keepPk = doc.pkIds === undefined ? mine.filter(function (r) { return r[1] === 'PK'; }) : [];   // pkIds tidak dikirim: pilihan PK lama dipertahankan
        mine = mine.filter(function (r) { return r[1] === 'HDR'; }).concat(keepPk);
        (doc.lhIds || []).forEach(function (x) { mine.push([doc.id, 'LH', String(x), '']); });
        (doc.pkIds || []).forEach(function (x) { mine.push([doc.id, 'PK', String(x), '']); });
        Object.keys(doc.alias || {}).forEach(function (k) { mine.push([doc.id, 'ALIAS', k, String(doc.alias[k])]); });
      }
      if (doc.header !== undefined) {
        mine = mine.filter(function (r) { return r[1] !== 'HDR'; });
        Object.keys(doc.header || {}).forEach(function (k) { mine.push([doc.id, 'HDR', String(k), String(doc.header[k] === null || doc.header[k] === undefined ? '' : doc.header[k])]); });
      }
      ktkReplace_('Ktk_Pilihan', KTK_H_PILIH_, others.concat(mine));
    }    ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, kon);
    ktkReplace_('Ktk_Paket', KTK_H_PAKET_, pak.filter(function (x) { return !rmIds[x[0]]; }).concat(tplRows.p));
    ktkReplace_('Ktk_Item', KTK_H_ITEM_, itm.filter(function (r) { return !rmIds[r[0]]; }).concat(tplRows.i));
    return { status: 'success', message: 'Tersimpan' + (t ? ' (' + t + ' paket juga masuk template)' : '') };
  } catch (e) { return { status: 'error', message: e.toString() }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}
