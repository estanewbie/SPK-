/**
 * ============================================================================
 * Pengelolaan.js - Alat khusus Super Admin
 * ----------------------------------------------------------------------------
 *  1. Akun pengguna : tambah akun, ubah nama dan peran, atur ulang sandi (disimpan sebagai hash), nonaktifkan atau aktifkan.
 *                     Dijaga: harus selalu ada minimal satu Super Admin aktif, dan akun sendiri tidak bisa diturunkan atau dinonaktifkan.
 *  2. Pemulihan     : memulihkan LH, PK, SPK yang dihapus (Arsip_Hapus) dan KTK yang dikembalikan (Arsip_KTK). Ditolak bila ID-nya
 *                     sudah dipakai lagi, supaya tidak ada data ganda. Hasil dibaca ulang.
 *  3. Cadangan      : salin seluruh spreadsheet ke Drive sekarang juga.
 * Semua fungsi memeriksa peran Super Admin di server (peran efektif: saat "Masuk sebagai" akun lain, tugas ini tidak tersedia).
 * Sandi tidak pernah dikirim ke layar dan tidak pernah ditulis ke riwayat.
 * ============================================================================
 */

const PGL_ROLES_ = ['Super Admin', 'Admin PK', 'Admin SPK', 'Admin Code', 'Admin Audit', 'Viewer'];

function pglSuper_(auth) {
  const w = jejakWho_(auth); if (!w.ok) return w;
  if (String(w.who.role) !== 'Super Admin') return { ok: false, galat: { status: 'error', kode: 'AKSES', message: 'Hanya Super Admin (dan bukan saat memakai Masuk sebagai akun lain).' } };
  return w;
}

function pglSheetAkun_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_User'); if (!sh) throw new Error('Data akun tidak ditemukan.');
  const v = sh.getDataRange().getValues(); const h = v[0].map(function (x) { return String(x).trim(); });
  const c = { u: h.indexOf('Username'), p: h.indexOf('Password'), n: h.indexOf('Nama'), r: h.indexOf('Role'), s: h.indexOf('Status') };
  if (c.u < 0 || c.p < 0 || c.n < 0 || c.r < 0) throw new Error('Kolom Data_User harus Username, Password, Nama, Role.');
  return { sh: sh, v: v, h: h, c: c };
}
function pglNonaktif_(s) { return String(s == null ? '' : s).trim().toLowerCase() === 'nonaktif'; }

/** Daftar akun TANPA sandi. 'sandi' hanya menyebut cara penyimpanan: hash | teks (belum diamankan) | kosong. */
function akunDaftar(auth) {
  try {
    const w = pglSuper_(auth); if (!w.ok) return w.galat;
    const a = pglSheetAkun_();
    const users = a.v.slice(1).filter(function (r) { return String(r[a.c.u]).trim() !== ''; }).map(function (r) {
      const p = String(r[a.c.p] == null ? '' : r[a.c.p]).trim();
      return { id: String(r[a.c.u]).trim(), nama: String(r[a.c.n] || '').trim(), role: String(r[a.c.r] || '').trim(), status: a.c.s >= 0 && pglNonaktif_(r[a.c.s]) ? 'Nonaktif' : 'Aktif', sandi: !p ? 'kosong' : (KMN_FORMAT_.test(p) ? 'hash' : 'teks') };
    });
    return { status: 'success', users: users, roles: PGL_ROLES_, saya: w.who.realId };
  } catch (e) { return { status: 'error', message: String((e && e.message) || e) }; }
}

/** d = { id, baru: true|false, nama, role, sandi (wajib untuk akun baru; kosong = tidak diubah), status: 'Aktif'|'Nonaktif' } */
function akunSimpanAsli_(auth, d) {
  return withIdLock_(function () {
    const w = pglSuper_(auth); if (!w.ok) return w.galat;
    d = d || {}; const id = String(d.id == null ? '' : d.id).trim();
    if (!/^[A-Za-z0-9._-]{3,40}$/.test(id)) return { status: 'error', message: 'ID akun hanya huruf, angka, titik, garis bawah, atau strip (3 sampai 40 karakter).' };
    const nama = String(d.nama == null ? '' : d.nama).replace(/\s+/g, ' ').trim();
    if (!nama || nama.length > 80) return { status: 'error', message: 'Nama wajib diisi (maksimal 80 huruf).' };
    const role = String(d.role == null ? '' : d.role).trim();
    if (PGL_ROLES_.indexOf(role) < 0) return { status: 'error', message: 'Peran tidak dikenal. Pilihan: ' + PGL_ROLES_.join(', ') + '.' };
    const sandi = d.sandi == null ? '' : String(d.sandi);
    if (sandi && (sandi.length < 8 || sandi.length > 100)) return { status: 'error', message: 'Sandi minimal 8 karakter (maksimal 100).' };
    const mau = String(d.status || 'Aktif') === 'Nonaktif' ? 'Nonaktif' : 'Aktif';
    const a = pglSheetAkun_();
    const ri = a.v.findIndex(function (r, i) { return i > 0 && String(r[a.c.u]).trim().toLowerCase() === id.toLowerCase(); });
    const aktifSA = function (idx) { return a.v.filter(function (r, i) { return i > 0 && (i === idx ? false : String(r[a.c.r]).trim() === 'Super Admin' && !(a.c.s >= 0 && pglNonaktif_(r[a.c.s]))); }).length; };
    if (d.baru === true) {
      if (ri >= 0) return { status: 'error', message: 'ID akun ' + id + ' sudah dipakai.' };
      if (!sandi) return { status: 'error', message: 'Sandi akun baru wajib diisi.' };
      let kol = a.c.s; if (mau === 'Nonaktif' && kol < 0) { kol = a.h.length; a.sh.getRange(1, kol + 1).setValue('Status'); a.h.push('Status'); }
      const row = new Array(a.h.length).fill(''); row[a.c.u] = id; row[a.c.p] = kmnBuatSandiTersimpan_(sandi); row[a.c.n] = nama; row[a.c.r] = role; if (kol >= 0) row[kol] = mau === 'Nonaktif' ? 'Nonaktif' : '';
      a.sh.appendRow(row); SpreadsheetApp.flush();
      const cek = pglSheetAkun_(); const b = cek.v.find(function (r, i) { return i > 0 && String(r[cek.c.u]).trim() === id; });
      if (!b || String(b[cek.c.n]).trim() !== nama || String(b[cek.c.r]).trim() !== role || !KMN_FORMAT_.test(String(b[cek.c.p]))) return { status: 'error', message: 'Akun tidak terverifikasi setelah ditulis. Periksa data akun lalu coba lagi.' };
      return { status: 'success', terverifikasi: true, id: id, baru: true };
    }
    if (ri < 0) return { status: 'error', message: 'Akun ' + id + ' tidak ditemukan.' };
    const saya = String(w.who.realId) === String(a.v[ri][a.c.u]).trim();
    if (saya && (role !== 'Super Admin' || mau === 'Nonaktif')) return { status: 'error', message: 'Akun Anda sendiri tidak bisa diturunkan perannya atau dinonaktifkan. Minta Super Admin lain.' };
    const jadiBukanSA = String(a.v[ri][a.c.r]).trim() === 'Super Admin' && (role !== 'Super Admin' || mau === 'Nonaktif');
    if (jadiBukanSA && aktifSA(ri) < 1) return { status: 'error', message: 'Harus selalu ada minimal satu Super Admin aktif.' };
    const lama = a.v[ri].slice();
    let kol = a.c.s; if (mau === 'Nonaktif' && kol < 0) { kol = a.h.length; a.sh.getRange(1, kol + 1).setValue('Status'); a.h.push('Status'); }
    const baris = ri + 1;
    a.sh.getRange(baris, a.c.n + 1).setValue(nama); a.sh.getRange(baris, a.c.r + 1).setValue(role);
    if (kol >= 0) a.sh.getRange(baris, kol + 1).setValue(mau === 'Nonaktif' ? 'Nonaktif' : '');
    if (sandi) a.sh.getRange(baris, a.c.p + 1).setNumberFormat('@').setValue(kmnBuatSandiTersimpan_(sandi));
    SpreadsheetApp.flush();
    const cek = pglSheetAkun_(); const b = cek.v[ri];
    const benar = String(b[cek.c.u]).trim() === id && String(b[cek.c.n]).trim() === nama && String(b[cek.c.r]).trim() === role && (mau === 'Nonaktif') === (cek.c.s >= 0 && pglNonaktif_(b[cek.c.s])) && (!sandi || KMN_FORMAT_.test(String(b[cek.c.p])));
    if (!benar) {
      try { a.sh.getRange(baris, a.c.n + 1).setValue(lama[a.c.n]); a.sh.getRange(baris, a.c.r + 1).setValue(lama[a.c.r]); a.sh.getRange(baris, a.c.p + 1).setValue(lama[a.c.p]); if (a.c.s >= 0) a.sh.getRange(baris, a.c.s + 1).setValue(lama[a.c.s]); } catch (x) { /* pemulihan terbaik */ }
      return { status: 'error', message: 'Perubahan akun tidak terverifikasi, isi lama dikembalikan. Coba lagi.' };
    }
    try { CacheService.getScriptCache().remove('ktk_u_' + id); } catch (e) { /* cache habis sendiri dalam 45 detik */ }
    return { status: 'success', terverifikasi: true, id: id, baru: false, sandiBaru: !!sandi };
  });
}

// ---------- pemulihan ----------
function arsipDaftar(auth) {
  try {
    const w = pglSuper_(auth); if (!w.ok) return w.galat;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID); const out = [];
    const ah = ss.getSheetByName('Arsip_Hapus');
    if (ah && ah.getLastRow() >= 2) {
      const v = ah.getRange(2, 1, ah.getLastRow() - 1, 6).getValues();
      v.forEach(function (r, i) {
        if (String(r[3]).trim() === '') return;
        let ringkas = ''; try { ringkas = JSON.parse(r[5]).filter(function (x) { return x !== '' && x !== null; }).slice(0, 4).map(function (x) { return String(x).slice(0, 40); }).join(' · '); } catch (e) { ringkas = ''; }
        out.push({ jenis: 'hapus', kunci: String(i + 2), waktu: String(r[0]), user: String(r[1]), objek: String(r[2]).replace('Data_', ''), id: String(r[3]), ringkas: ringkas });
      });
    }
    const ak = ss.getSheetByName('Arsip_KTK');
    if (ak && ak.getLastRow() >= 2) {
      const v = ak.getRange(2, 1, ak.getLastRow() - 1, 6).getValues();
      // satu arsip = beberapa baris berurutan; yang bertanda "bagian 1/N" adalah awalnya. kunci = ID_KTK|nomor baris awal
      v.forEach(function (r, i) { if (String(r[2]).trim() === '' || String(r[4]).indexOf('(bagian 1/') < 0) return; out.push({ jenis: 'ktk', kunci: String(r[2]) + '|' + (i + 2), waktu: String(r[0]), user: String(r[1]), objek: 'KTK', id: String(r[2]), ringkas: String(r[3]) }); });
    }
    out.sort(function (a, b) { return String(b.waktu).localeCompare(String(a.waktu)); });
    return { status: 'success', data: out.slice(0, 300), total: out.length };
  } catch (e) { return { status: 'error', message: String((e && e.message) || e) }; }
}

function arsipPulihkanAsli_(auth, jenis, kunci) {
  return withIdLock_(function () {
    const w = pglSuper_(auth); if (!w.ok) return w.galat;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (jenis === 'hapus') {
      const ah = ss.getSheetByName('Arsip_Hapus'); const n = parseInt(kunci, 10);
      if (!ah || !(n >= 2) || n > ah.getLastRow()) return { status: 'error', message: 'Catatan arsip tidak ditemukan.' };
      const r = ah.getRange(n, 1, 1, 6).getValues()[0]; const nama = String(r[2]), id = String(r[3]).trim();
      if (['Data_LH', 'Data_PK', 'Data_SPK'].indexOf(nama) < 0) return { status: 'error', message: 'Jenis arsip tidak dikenal.' };
      let hLama, isi; try { hLama = JSON.parse(r[4]).map(function (x) { return String(x).trim(); }); isi = JSON.parse(r[5]); } catch (e) { return { status: 'error', message: 'Isi arsip rusak atau terpotong, tidak bisa dipulihkan otomatis.' }; }
      const sh = ss.getSheetByName(nama); if (!sh) return { status: 'error', message: 'Data ' + nama + ' tidak ditemukan.' };
      const v = sh.getDataRange().getValues(); const h = v[0].map(function (x) { return String(x).trim(); });
      if (v.slice(1).some(function (x) { return String(x[0]).trim().toLowerCase() === id.toLowerCase(); })) return { status: 'error', message: id + ' sudah ada lagi di ' + nama + ', jadi tidak dipulihkan (mencegah data ganda).' };
      const baris = h.map(function (hh) { const k = hLama.indexOf(hh); return k >= 0 && isi[k] != null ? isi[k] : ''; });
      sh.appendRow(baris); SpreadsheetApp.flush();
      const cek = sh.getRange(sh.getLastRow(), 1, 1, 1).getValues()[0][0];
      if (String(cek).trim() !== id) return { status: 'error', message: 'Pemulihan tidak terverifikasi. Periksa data ' + nama + '.' };
      return { status: 'success', terverifikasi: true, objek: nama.replace('Data_', ''), id: id };
    }
    if (jenis === 'ktk') {
      const ak = ss.getSheetByName('Arsip_KTK'); const p = String(kunci).split('|'); const id = p[0], awal = parseInt(p[1], 10);
      if (!ak || ak.getLastRow() < 2 || !(awal >= 2) || awal > ak.getLastRow()) return { status: 'error', message: 'Arsip KTK tidak ditemukan.' };
      const kepala = ak.getRange(awal, 1, 1, 6).getValues()[0]; const mm = String(kepala[4]).match(/\(bagian 1\/(\d+)\)/);
      if (String(kepala[2]) !== id || !mm) return { status: 'error', message: 'Catatan arsip KTK tidak ditemukan.' };
      const v = ak.getRange(awal, 1, Math.min(parseInt(mm[1], 10), ak.getLastRow() - awal + 1), 6).getValues();
      if (v.length !== parseInt(mm[1], 10) || v.some(function (r) { return String(r[2]) !== id; })) return { status: 'error', message: 'Arsip KTK tidak lengkap, tidak bisa dipulihkan.' };
      let o; try { o = JSON.parse(v.map(function (r) { return String(r[5]); }).join('')); } catch (e) { return { status: 'error', message: 'Isi arsip KTK rusak atau terpotong.' }; }
      const kon = ktkRead_('Ktk_Kontrak'), pak = ktkRead_('Ktk_Paket'), itm = ktkRead_('Ktk_Item'), pil = ktkRead_('Ktk_Pilihan');
      const k = o.kontrak; if (!k) return { status: 'error', message: 'Isi arsip KTK tidak lengkap.' };
      if (kon.some(function (r) { return String(r[0]) === id; })) return { status: 'error', message: 'KTK ' + id + ' sudah ada lagi, jadi tidak dipulihkan.' };
      if (k[5] && kon.some(function (r) { return String(r[0]).indexOf('TPL-') !== 0 && KTK_NORM_(r[5]) === KTK_NORM_(k[5]); })) return { status: 'error', message: 'SPK ' + k[5] + ' sudah punya KTK lain. Kembalikan KTK itu dulu sebelum memulihkan yang ini.' };
      const dipakai = {}; pil.forEach(function (r) { if (r[1] === 'LH' || r[1] === 'PK') dipakai[r[1] + '|' + r[2]] = String(r[0]); });
      const bentrok = (o.pilihan || []).filter(function (r) { return (r[1] === 'LH' || r[1] === 'PK') && dipakai[r[1] + '|' + r[2]]; }).map(function (r) { return r[1] + ' ' + r[2]; });
      if (bentrok.length) return { status: 'error', message: 'Sebagian LH/PK sudah dipakai KTK lain: ' + bentrok.slice(0, 6).join(', ') + '. Lepaskan dulu dari KTK itu.' };
      const kon2 = ktkSalinSemua_(kon), pak2 = ktkSalinSemua_(pak), itm2 = ktkSalinSemua_(itm), pil2 = ktkSalinSemua_(pil);
      try {
        ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, ktkTerisi_(kon).concat([k])); ktkReplace_('Ktk_Paket', KTK_H_PAKET_, ktkTerisi_(pak).concat(o.paket || []));
        ktkReplace_('Ktk_Item', KTK_H_ITEM_, ktkTerisi_(itm).concat(o.item || [])); ktkReplace_('Ktk_Pilihan', KTK_H_PILIH_, ktkTerisi_(pil).concat(o.pilihan || []));
        SpreadsheetApp.flush();
        const k3 = ktkTerisi_(ktkRead_('Ktk_Kontrak')), p3 = ktkTerisi_(ktkRead_('Ktk_Paket')), i3 = ktkTerisi_(ktkRead_('Ktk_Item')), l3 = ktkTerisi_(ktkRead_('Ktk_Pilihan'));
        if (k3.length !== ktkTerisi_(kon).length + 1 || p3.length !== ktkTerisi_(pak).length + (o.paket || []).length || i3.length !== ktkTerisi_(itm).length + (o.item || []).length || l3.length !== ktkTerisi_(pil).length + (o.pilihan || []).length) throw new Error('isi database tidak sama setelah ditulis');
      } catch (e) {
        try { ktkReplace_('Ktk_Kontrak', KTK_H_KONTRAK_, kon2); ktkReplace_('Ktk_Paket', KTK_H_PAKET_, pak2); ktkReplace_('Ktk_Item', KTK_H_ITEM_, itm2); ktkReplace_('Ktk_Pilihan', KTK_H_PILIH_, pil2); } catch (x) { /* pemulihan terbaik */ }
        return { status: 'error', message: 'Pemulihan KTK tidak terverifikasi, data dikembalikan seperti semula (' + String((e && e.message) || e) + ').' };
      }
      const folderAda = ktkFolders_().some(function (f) { return String(f[0]) === String(k[9]); });
      return { status: 'success', terverifikasi: true, objek: 'KTK', id: id, folderHilang: !folderAda && !!k[9] };
    }
    return { status: 'error', message: 'Jenis arsip tidak dikenal.' };
  });
}

function cadanganManualAsli_(auth) {
  const w = pglSuper_(auth); if (!w.ok) return w.galat;
  try { return kmnCadangkan_(); } catch (e) { return { status: 'error', message: 'Cadangan gagal: ' + String((e && e.message) || e) }; }
}
