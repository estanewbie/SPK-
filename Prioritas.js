/**
 * ============================================================================
 * Prioritas.js - Skala prioritas pembuatan dokumen Code 3 / Code 7 / AGO (menu Pusat verifikasi)
 * ----------------------------------------------------------------------------
 * LH yang sudah dimasukkan ke sebuah KTK (langsung per LH, atau lewat PK untuk KTK jenis 62) adalah yang paling mendesak,
 * karena kontraknya sedang disusun. Admin Code tidak punya hak KTK, jadi fungsi ini hanya memberi RINGKASAN
 * (nomor kontrak, SPK, jenis, status, dan LH/PK yang masuk), bukan isi kontrak, harga, atau paketnya.
 * Identitas dicek dari token sesi (KtkAuth.js).
 * ============================================================================
 */

const PRIORITAS_ROLES_ = ['Super Admin', 'Admin SPK', 'Admin PK', 'Admin Code', 'Admin Audit'];

/**
 * Mengembalikan { status, kontrak: { idKtk: { id, no, nama, jenis, idSpk, status } }, lh: { idLh: idKtk }, pk: { idPk: idKtk } }.
 * Template (TPL-...) tidak ikut.
 */
function lhPrioritasKtk(auth) {
  try {
    const who = ktkWho_(auth);
    if (PRIORITAS_ROLES_.indexOf(String(who.role)) < 0) return { status: 'error', message: 'Peran Anda tidak boleh melihat prioritas KTK.' };
    const kontrak = {};
    ktkRead_('Ktk_Kontrak').forEach(function (r) {
      if (!r[0] || String(r[0]).indexOf('TPL-') === 0) return;
      kontrak[String(r[0])] = { id: String(r[0]), jenis: String(r[1]), no: String(r[2]), nama: String(r[3] || ''), idSpk: String(r[5] || ''), status: String(r[6] || '') };
    });
    const lh = {}, pk = {};
    ktkRead_('Ktk_Pilihan').forEach(function (r) {
      const k = String(r[0]); if (!kontrak[k]) return;
      if (r[1] === 'LH') lh[String(r[2])] = k; else if (r[1] === 'PK') pk[String(r[2])] = k;
    });
    return { status: 'success', kontrak: kontrak, lh: lh, pk: pk };
  } catch (e) { return { status: 'error', message: String(e.message || e) }; }
}
