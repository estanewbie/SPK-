/**
 * ============================================================================
 * KtkKelola.js - Mengelola kontrak KTK yang sudah masuk folder + pemantauan oleh Admin Audit
 * ----------------------------------------------------------------------------
 *  - ktkKembalikan   : mengembalikan KTK (status Draf) ke daftar "Perlu dibuat KTK" supaya bisa dibuat ulang.
 *                      Isi kontrak (paket, item, pilihan LH/PK, alias, isian header) DISALIN LENGKAP ke sheet Arsip_KTK dulu,
 *                      baru dihapus dari sheet kerja. Hasil dibaca ulang; bila tidak cocok, semuanya dikembalikan seperti semula.
 *                      Kontrak Final (harga dikunci) ditolak: kunci harus dibuka Super Admin lebih dulu.
 *  - ktkFolderPemilik: memindahkan hak akses satu folder (beserta seluruh kontrak di dalamnya) ke admin lain. Hanya Super Admin.
 *  - auditKtkProgres : ringkasan SEMUA KTK (semua folder) untuk Radar audit, hanya Super Admin dan Admin Audit. Hanya membaca.
 * ============================================================================
 */

const KTK_ARSIP_H_ = ['Waktu', 'ID_User', 'ID_KTK', 'Nomor', 'Keterangan', 'Isi_JSON'];
const KTK_ARSIP_POTONG_ = 40000;   // batas isi satu sel Sheet 50.000 huruf; isi yang lebih besar dipecah ke beberapa baris
const KTK_PEMANTAU_ = ['Super Admin', 'Admin Audit'];

/** Baris yang benar-benar berisi (baris kosong sisa penghapusan tidak dihitung). */
function ktkTerisi_(rows) { return rows.filter(function (r) { return r.some(function (c) { return c !== '' && c !== null && c !== undefined; }); }); }
function ktkSalinSemua_(rows) { return rows.map(function (r) { return r.slice(); }); }

/** Tulis arsip (dipecah bila besar) dan baca ulang. Mengembalikan true bila isinya tersimpan utuh. */
function ktkArsipkan_(who, id, nomor, ket, objek) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID); let sh = ss.getSheetByName('Arsip_KTK');
  if (!sh) { sh = ss.insertSheet('Arsip_KTK'); sh.getRange(1, 1, 1, KTK_ARSIP_H_.length).setValues([KTK_ARSIP_H_]).setFontWeight('bold').setBackground('#D9D9D9'); sh.setFrozenRows(1); }
  const json = JSON.stringify(objek); const bagian = [];
  for (let i = 0; i < json.length; i += KTK_ARSIP_POTONG_) bagian.push(json.slice(i, i + KTK_ARSIP_POTONG_));
  if (!bagian.length) bagian.push('{}');
  const waktu = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
  const awal = sh.getLastRow() + 1;
  const baris = bagian.map(function (b, i) { return [waktu, who.id, id, nomor, ket + ' (bagian ' + (i + 1) + '/' + bagian.length + ')', b]; });
  sh.getRange(awal, 1, baris.length, KTK_ARSIP_H_.length).setNumberFormat('@').setValues(baris);
  SpreadsheetApp.flush();
  const cek = sh.getRange(awal, 6, baris.length, 1).getValues().map(function (r) { return String(r[0]); }).join('');
  return cek === json || (json.length === 0 && cek === '{}');
}

function ktkKembalikanAsli_(idKtk, auth) {
  return withIdLock_(function () {
    const who = ktkAuth_(auth);
    if (['Super Admin', 'Admin SPK'].indexOf(String(who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin atau Admin SPK yang boleh mengembalikan KTK.' };
    const id = String(idKtk == null ? '' : idKtk).trim();
    if (!id || id.indexOf('TPL-') === 0) return { status: 'error', message: 'Kontrak tidak valid.' };
    const kon = ktkRead_('Ktk_Kontrak'); const ki = kon.findIndex(function (r) { return String(r[0]) === id; });
    if (ki < 0) return { status: 'error', message: 'Kontrak tidak ditemukan.' };
    if (!ktkCanSee_(who, kon[ki])) return { status: 'error', message: 'Kontrak ini ada di folder admin lain.' };
    if (String(kon[ki][6]) === 'Final' && String(who.role) !== 'Super Admin') return { status: 'error', message: 'KTK sudah Final (harga dikunci). Hanya Super Admin yang boleh mengembalikannya.' };
    const pak = ktkRead_('Ktk_Paket'), itm = ktkRead_('Ktk_Item'), pil = ktkRead_('Ktk_Pilihan');
    const idP = {}; pak.forEach(function (p) { if (String(p[1]) === id) idP[String(p[0])] = true; });
    const milik = { kontrak: kon[ki], paket: pak.filter(function (p) { return String(p[1]) === id; }), item: itm.filter(function (r) { return idP[String(r[0])]; }), pilihan: pil.filter(function (r) { return String(r[0]) === id; }) };
    const idSpk = String(kon[ki][5] || ''), nomor = String(kon[ki][2] || id);
    // 1. arsip dulu (gagal = tidak ada yang dihapus)
    let arsipOk = false; try { arsipOk = ktkArsipkan_(who, id, nomor, 'Dikembalikan ke Perlu dibuat KTK', milik); } catch (e) { arsipOk = false; }
    if (!arsipOk) return { status: 'error', message: 'Salinan arsip KTK gagal dibuat, jadi tidak ada yang dihapus. Coba lagi.' };
    // 2. hapus dari sheet kerja
    const kon2 = ktkSalinSemua_(kon), pak2 = ktkSalinSemua_(pak), itm2 = ktkSalinSemua_(itm), pil2 = ktkSalinSemua_(pil);
    try {
      ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, kon.filter(function (r) { return String(r[0]) !== id; }));
      ktkReplace_('Ktk_Paket', KTK_H_PAKET_, pak.filter(function (p) { return String(p[1]) !== id; }));
      ktkReplace_('Ktk_Item', KTK_H_ITEM_, itm.filter(function (r) { return !idP[String(r[0])]; }));
      ktkReplace_('Ktk_Pilihan', KTK_H_PILIH_, pil.filter(function (r) { return String(r[0]) !== id; }));
      SpreadsheetApp.flush();
      // 3. baca ulang
      const k3 = ktkTerisi_(ktkRead_('Ktk_Kontrak')), p3 = ktkTerisi_(ktkRead_('Ktk_Paket')), i3 = ktkTerisi_(ktkRead_('Ktk_Item')), l3 = ktkTerisi_(ktkRead_('Ktk_Pilihan'));
      const ok = !k3.some(function (r) { return String(r[0]) === id; }) && k3.length === ktkTerisi_(kon).length - 1 && p3.length === ktkTerisi_(pak).length - milik.paket.length && i3.length === ktkTerisi_(itm).length - milik.item.length && l3.length === ktkTerisi_(pil).length - milik.pilihan.length;
      if (!ok) throw new Error('isi database tidak sama setelah dihapus');
    } catch (e) {
      try { ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, kon2); ktkReplace_('Ktk_Paket', KTK_H_PAKET_, pak2); ktkReplace_('Ktk_Item', KTK_H_ITEM_, itm2); ktkReplace_('Ktk_Pilihan', KTK_H_PILIH_, pil2); } catch (x) { /* pemulihan terbaik; salinan penuh ada di Arsip_KTK */ }
      return { status: 'error', message: 'Pengembalian tidak terverifikasi, data dikembalikan seperti semula (' + String((e && e.message) || e) + '). Coba lagi.' };
    }
    return { status: 'success', terverifikasi: true, id: id, nomor: nomor, idSpk: idSpk, paket: milik.paket.length, lh: milik.pilihan.filter(function (r) { return r[1] === 'LH'; }).length, pk: milik.pilihan.filter(function (r) { return r[1] === 'PK'; }).length };
  });
}

/** Pindahkan hak akses folder ke admin lain (semua kontrak di folder ikut). Hanya Super Admin. */
function ktkFolderPemilikAsli_(idFolder, idPemilikBaru, auth) {
  return withIdLock_(function () {
    const who = ktkAuth_(auth);
    if (String(who.role) !== 'Super Admin') return { status: 'error', message: 'Hanya Super Admin yang boleh memindahkan hak akses folder.' };
    const fl = ktkFolders_(); const fi = fl.findIndex(function (f) { return String(f[0]) === String(idFolder); });
    if (fi < 0) return { status: 'error', message: 'Folder tidak ditemukan.' };
    const baru = ktkUser_(idPemilikBaru);
    if (!baru || KTK_ROLES_.indexOf(String(baru.role)) < 0) return { status: 'error', message: 'Admin tujuan tidak ada atau tidak berhak memakai menu KTK.' };
    if (String(fl[fi][2]) === baru.id) return { status: 'error', message: 'Folder ini sudah milik ' + (baru.name || baru.id) + '.' };
    if (fl.some(function (f, j) { return j !== fi && String(f[2]) === baru.id && KTK_NORM_(f[1]) === KTK_NORM_(fl[fi][1]); })) return { status: 'error', message: (baru.name || baru.id) + ' sudah punya folder bernama sama. Ganti nama folder ini dulu.' };
    const kon = ktkRead_('Ktk_Kontrak'); let n = 0;
    const fl2 = ktkSalinSemua_(fl), kon2 = ktkSalinSemua_(kon);
    fl[fi][2] = baru.id; fl[fi][3] = baru.name || baru.id;
    kon.forEach(function (r) { if (String(r[9]) === String(idFolder)) { r[10] = baru.id; n++; } });
    try {
      ktkReplace_('Ktk_Folder', KTK_H_FOLDER_, fl); ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, kon); SpreadsheetApp.flush();
      const f3 = ktkFolders_().filter(function (f) { return String(f[0]) === String(idFolder); })[0];
      const k3 = ktkRead_('Ktk_Kontrak').filter(function (r) { return String(r[9]) === String(idFolder); });
      if (!f3 || String(f3[2]) !== baru.id || k3.length !== n || k3.some(function (r) { return String(r[10]) !== baru.id; })) throw new Error('isi database tidak sama setelah ditulis');
    } catch (e) {
      try { ktkReplace_('Ktk_Folder', KTK_H_FOLDER_, fl2); ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, kon2); } catch (x) { /* pemulihan terbaik */ }
      return { status: 'error', message: 'Pemindahan tidak terverifikasi, data dikembalikan seperti semula (' + String((e && e.message) || e) + '). Coba lagi.' };
    }
    return { status: 'success', terverifikasi: true, folder: String(fl[fi][1]), pemilik: baru.id, pemilikNama: baru.name, kontrak: n };
  });
}

/** Ringkasan semua KTK untuk Radar audit (hanya membaca). LH/PK-nya dikirim sebagai ID; layar menghitung tahap audit dan dokumennya. */
function auditKtkProgres(auth) {
  try {
    const w = jejakWho_(auth); if (!w.ok) return w.galat;
    if (KTK_PEMANTAU_.indexOf(String(w.who.role)) < 0) return { status: 'error', message: 'Hanya Super Admin dan Admin Audit yang boleh memantau KTK.' };
    const kon = ktkRead_('Ktk_Kontrak').filter(function (r) { return String(r[0]).trim() !== '' && String(r[0]).indexOf('TPL-') !== 0; });
    const pak = ktkRead_('Ktk_Paket'), itm = ktkRead_('Ktk_Item'), pil = ktkRead_('Ktk_Pilihan');
    const paketOf = {}; pak.forEach(function (p) { paketOf[String(p[0])] = p; });
    const nPaket = {}; pak.forEach(function (p) { if (String(p[4]) === 'Y') nPaket[String(p[1])] = (nPaket[String(p[1])] || 0) + 1; });
    const baris = {}, nItem = {};
    itm.forEach(function (r) {
      const p = paketOf[String(r[0])]; if (!p || r[2] !== 'item' || String(p[4]) !== 'Y') return;
      (baris[String(p[1])] = baris[String(p[1])] || []).push([ktkTxt_(r[5], null) || '0', ktkTxt_(r[6], 10), ktkTxt_(r[7], 10)]);
      nItem[String(p[1])] = (nItem[String(p[1])] || 0) + 1;
    });
    const lh = {}, pk = {};
    pil.forEach(function (r) { const k = String(r[0]); if (r[1] === 'LH') (lh[k] = lh[k] || []).push(String(r[2])); else if (r[1] === 'PK') (pk[k] = pk[k] || []).push(String(r[2])); });
    const folder = {}; ktkFolders_().forEach(function (f) { folder[String(f[0])] = String(f[1]); });
    const pemilik = {}; ktkFolders_().forEach(function (f) { pemilik[String(f[2])] = String(f[3]); });
    const data = kon.map(function (r) {
      const id = String(r[0]); const d = r[8];
      return { id: id, jenis: String(r[1]), no: String(r[2] || ''), nama: String(r[3] || ''), vendor: String(r[4] || ''), idSpk: String(r[5] || ''), status: String(r[6] || ''),
        folderId: String(r[9] || ''), folderNama: folder[String(r[9] || '')] || '', pemilik: String(r[10] || ''), pemilikNama: pemilik[String(r[10] || '')] || '',
        diubah: d instanceof Date ? Utilities.formatDate(d, 'Asia/Makassar', 'yyyy-MM-dd HH:mm') : String(d || ''), dibuatOleh: String(r[7] || ''),
        nPaket: nPaket[id] || 0, nItem: nItem[id] || 0, baris: baris[id] || [], lhIds: lh[id] || [], pkIds: pk[id] || [] };
    });
    return { status: 'success', data: data };
  } catch (e) { return { status: 'error', message: String((e && e.message) || e) }; }
}
