/**
 * ============================================================================
 * KtkTemplate.js - Template paket per JENIS KTK (71, 61, 62)
 * ----------------------------------------------------------------------------
 * Tiap jenis punya template sendiri: baris "TPL-<jenis>" di Ktk_Kontrak, paketnya di Ktk_Paket (ID_KTK = TPL-<jenis>) dan
 * materialnya di Ktk_Item. Template jenis 61 dan 62 dibuat kosong otomatis, lalu diisi dari editor KTK
 * (tombol "Simpan ke template" di paket) atau disalin dari jenis lain lewat ruang Template di daftar KTK.
 * Hanya Super Admin dan Admin SPK yang boleh mengubah template. Semua admin KTK boleh memakainya.
 * ============================================================================
 */

const KTK_JENIS_ = ['71', '61', '62'];

/** Pastikan baris template TPL-<jenis> ada (kosong bila baru). Dipanggil di dalam kunci skrip. */
function ktkTemplateEnsure_(jenis) {
  const tpl = 'TPL-' + jenis;
  const kon = ktkRead_('Ktk_Kontrak');
  if (kon.some(function (r) { return r[0] === tpl; })) return;
  kon.push([tpl, String(jenis), 'TEMPLATE', 'Template paket KTK jenis ' + jenis, '', '', 'Template', 'sistem', new Date(), '', '']);
  ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, kon);
}

function ktkTplCanEdit_(who) { return ['Super Admin', 'Admin SPK'].indexOf(String(who.role)) >= 0; }

/** Ringkasan template semua jenis: { '71': { paket: [{ id, nama, nItem }] }, '61': ..., '62': ... } */
function ktkTemplates(auth) {
  return withIdLock_(function () {
    const who = ktkAuth_(auth);
    KTK_JENIS_.forEach(function (j) { ktkTemplateEnsure_(j); });
    // Isi awal template 62 (dari KTK 62.pdf) satu kali saja, hanya bila template 62 masih tanpa paket. Setelah itu tidak diisi ulang otomatis.
    try {
      const props = PropertiesService.getScriptProperties();
      if (!props.getProperty('KTK62_TERISI')) {
        if (!ktkRead_('Ktk_Paket').some(function (p) { return p[1] === 'TPL-62'; })) ktkIsiTemplate62_();
        props.setProperty('KTK62_TERISI', '1');
      }
    } catch (e) { /* gagal mengisi tidak boleh menghalangi daftar template; fungsi ktkIsiTemplate62 tetap bisa dijalankan manual */ }
    const pak = ktkRead_('Ktk_Paket'), itm = ktkRead_('Ktk_Item');
    const n = {}; itm.forEach(function (r) { if (r[2] === 'item') n[r[0]] = (n[r[0]] || 0) + 1; });
    const out = {};
    KTK_JENIS_.forEach(function (j) {
      out[j] = { paket: pak.filter(function (p) { return p[1] === 'TPL-' + j; }).sort(function (a, b) { return a[2] - b[2]; })
        .map(function (p) { return { id: String(p[0]), nama: String(p[3]), nItem: n[p[0]] || 0 }; }) };
    });
    return { status: 'success', data: out, canEdit: ktkTplCanEdit_(who), jenis: KTK_JENIS_ };
  });
}

/**
 * Ubah template. op: 'hapus' { id } | 'nama' { id, nama } | 'salin' { id, ke } (salin paket template ke jenis lain;
 * paket bernama sama di jenis tujuan diganti).
 */
function ktkTemplateOpAsli_(op, a, auth) {
  return withIdLock_(function () {
    const who = ktkAuth_(auth);
    if (!ktkTplCanEdit_(who)) return { status: 'error', message: 'Hanya Super Admin atau Admin SPK yang boleh mengubah template.' };
    a = a || {};
    let pak = ktkRead_('Ktk_Paket'), itm = ktkRead_('Ktk_Item');
    const idx = pak.findIndex(function (p) { return String(p[0]) === String(a.id) && String(p[1]).indexOf('TPL-') === 0; });
    if (idx < 0) return { status: 'error', message: 'Paket template tidak ditemukan.' };
    const p = pak[idx];
    if (op === 'hapus') {
      pak = pak.filter(function (x) { return String(x[0]) !== String(a.id); });
      itm = itm.filter(function (r) { return String(r[0]) !== String(a.id); });
    } else if (op === 'nama') {
      const nm = String(a.nama || '').trim(); if (!nm) return { status: 'error', message: 'Nama paket wajib diisi.' };
      pak[idx][3] = nm;
    } else if (op === 'salin') {
      const ke = String(a.ke || '');
      if (KTK_JENIS_.indexOf(ke) < 0 || 'TPL-' + ke === String(p[1])) return { status: 'error', message: 'Pilih jenis tujuan yang berbeda.' };
      ktkTemplateEnsure_(ke);
      const same = {}; pak.forEach(function (x) { if (x[1] === 'TPL-' + ke && KTK_NORM_(x[3]) === KTK_NORM_(p[3])) same[x[0]] = true; });
      const keep = pak.filter(function (x) { return !same[x[0]]; });
      const nid = 'TPL-' + ke + '-C' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
      const urut = keep.filter(function (x) { return x[1] === 'TPL-' + ke; }).length + 1;
      const src = itm.filter(function (r) { return String(r[0]) === String(a.id); }).map(function (r) { const c = r.slice(); c[0] = nid; return c; });
      pak = keep.concat([[nid, 'TPL-' + ke, urut, p[3], 'Y', 'Y']]);
      itm = itm.filter(function (r) { return !same[r[0]]; }).concat(src);
    } else return { status: 'error', message: 'Perintah tidak dikenal.' };
    ktkReplace_('Ktk_Paket', KTK_H_PAKET_, pak);
    ktkReplace_('Ktk_Item', KTK_H_ITEM_, itm);
    return { status: 'success' };
  });
}

/**
 * JALANKAN SEKALI dari editor: mengisi template jenis 62 dengan 7 paket dari KTK 62.pdf (KtkSeed62.js), volume 0.
 * Aman diulang: paket yang namanya sudah ada di template 62 dilewati, paket lain tidak disentuh.
 */
function ktkIsiTemplate62() { const gerbang = kmnGerbang_(); if (gerbang) return gerbang.message; return withIdLock_(ktkIsiTemplate62_); }

/** Isi template 62 dari seed (tanpa kunci; dipanggil dari dalam kunci). Mengembalikan pesan hasil. */
function ktkIsiTemplate62_() {
  {
    ktkTemplateEnsure_('62');
    let pak = ktkRead_('Ktk_Paket'), itm = ktkRead_('Ktk_Item');
    const ada = {}; pak.forEach(function (p) { if (p[1] === 'TPL-62') ada[KTK_NORM_(p[3])] = true; });
    let urut = pak.filter(function (p) { return p[1] === 'TPL-62'; }).length;
    const baru = [], lewati = [];
    ktkSeed62_().forEach(function (p, pi) {
      if (ada[KTK_NORM_(p[0])]) { lewati.push(p[0]); return; }
      const idp = 'TPL-62-S' + ('0' + (pi + 1)).slice(-2);
      urut++;
      pak.push([idp, 'TPL-62', urut, p[0], 'Y', 'N']);
      p[1].forEach(function (it, ii) {
        if (it[0] === '#') itm.push([idp, ii + 1, 'sub', it[1], '', '', '', '']);
        else itm.push([idp, ii + 1, 'item', it[0], it[1], 0, it[3], it[4]]);
      });
      baru.push(p[0]);
    });
    ktkReplace_('Ktk_Paket', KTK_H_PAKET_, pak);
    ktkReplace_('Ktk_Item', KTK_H_ITEM_, itm);
    return 'Template 62: ' + baru.length + ' paket ditambahkan' + (lewati.length ? ', ' + lewati.length + ' dilewati (sudah ada): ' + lewati.join('; ') : '') + '.';
  }
}
