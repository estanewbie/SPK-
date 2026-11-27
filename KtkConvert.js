/**
 * ============================================================================
 * KtkConvert.js - Tabel Convert_material (jembatan nama material KTK <-> nama di LH / Master_Data)
 * ----------------------------------------------------------------------------
 * Sheet "Convert_material": Nama_Pokok | Mungkin_1 | Mungkin_2 | Mungkin_3
 *   Nama_Pokok = nama panjang resmi di kontrak PLN / KTK.
 *   Mungkin_n  = nama yang dipakai di LH / Master_Data untuk material yang sama.
 * Dipakai menu KTK: (1) rekomendasi nama panjang saat mengisi KTK, (2) pencocokan otomatis LH -> baris KTK.
 * Sheet dibuat otomatis (dan diisi data awal) saat pertama kali dibaca. Setelah itu isinya dikelola langsung di Sheet.
 * ============================================================================
 */

const KTK_H_CONVERT_ = ['Nama_Pokok', 'Mungkin_1', 'Mungkin_2', 'Mungkin_3'];

/** Baris data awal. Nama pokok yang belum punya padanan dibiarkan kosong di kolom Mungkin. */
function ktkConvertSeed_() {
  const a = [
    ['Arde Jtm Pasangan Dalam', 'Arde JTM Pasangan Dalam', 'ARDE JTM 3 ohm PASANGAN DALAM'],
    ['Arde Jtm Pasangan Luar', 'Arde JTM Pasangan Luar', 'ARDE JTM 3 ohm PASANGAN LUAR'],
    ['Treckschoor Tm', 'Treckschoor TM'],
    ['Kontramast Tm', 'Kontramast TM'],
    ['Druck Schoor Tm', 'Druck Schoor TM'],
    ['Cross Arm Type A.1 2000 Hot Dip Galv.70-100 + Steel Plate', 'Cross arm A1', 'cros arm A1'],
    ['Cross Arm Type A.2 2000 Hot Dip Galv.70-100 + Steel Plate', 'Cross arm A2', 'cros arm A2'],
    ['Cross Arm Type A.3 2000 Hot Dip Galv.70-100 + Steel Plate', 'Cross arm A3', 'cros arm A3'],
    ['Cross Arm Type B.3 / B.2 Hot Dip Galv.70-100 + Steel Plate', 'Cross arm B3', 'cros arm b3'],
    ['Cross arm type B.1 hot dip galv.70-100 + steel plate', 'Cross arm B1', 'cros arm b1'],
    ['Overlenght Tm'],
    ['Dudukan Cut Out / Arrester 2000 Mm Unp 100 Gal Komplit 1 Tiang', 'Dudukan CO 1 Tiang', 'Dudukan FCO 1 Tiang'],
    ['Tiang Besi/Baja 13; 350/350+E Dan', 'Tiang besi/baja 13; 350/350+E daN', 'Tiang Besi 13 m (Crane)'],
    ['Aaacs Uk. 70 Mm2', 'AAACS uk. 70 mm2'],
    ['Aaac-Aaacs Uk. 95-150mm2', 'AAACS uk. 150 mm2'],
    ['Isolator Tumpu/Pinpost 20 Kv Porselin/Polimer +Acc (Line Post)', 'isolator tumpu'],
    ['Isolator Tarik/Tension 20 Kv Porselin/Polimer + Acc (Dead End)', 'isolator tarik'],
    ['Fuse Cut Out 24 Kv 100 A Porselin/Polimer +Acc', 'Fuse Cut Out'],
    ['Arrester 18 Kv-24 Kv; 5-10 Ka Polimer/Porselin +Acc', 'arrester'],
    ['Live Line Connector (Llc) 150-240 Mm2', 'llc'],
    ['Plp Top Ties', 'Plp Top Ties'],
    ['Pengangkutan Material Dari/Ke Gudang', 'Pengangkutan Material Dari/Ke Gudang'],
    ['Gambar As Built Drawing Dengan Koordinat', 'Gambar As Built Drawing Dengan Koordinat'],
    ['Arde Arrester', 'Arde Arrester'],
    ['Bongkar Pasang Aaacs Uk. 70 Mm2', 'Bongkar Pasang AAACS uk. 70 mm2'],
    ['Bongkar Pasang Aaacs Uk. 150 Mm2', 'Bongkar Pasang AAACS uk. 150 mm2'],
    ['Bongkar Pasang Arrester'],
    ['Bongkar Pasang Fuse Cut Out', 'bongkar pasang FCO', 'bongkar pasang co'],
    ['Bongkar Pasang Isolator Tumpu'],
    ['Cco 150/150 Mm2', 'cco 8T8 mm2'],
    ['Cco 70/150 Mm2', 'cco 8T5 mm2'],
    ['CCO 70/70 mm2', 'cco 5T5 mm2'],
    ['Cco 50-70/50-70 Mm2', 'CCO 70/70 mm2'],
    ['Heatshrink Tm'],
    ['Joint Sleeve Al 70 Mm2'],
    ['Joint Sleeve Al 150 Mm2'],
    ['Joint Sleeve Al/Cu 70 Mm2'],
    ['Sepatu Kabel Al/Cu 70 Mm2'],
    ['Sepatu Kabel Al/Cu 150 Mm2'],
    ['Pelurusan Overlenght Tm', 'Pelurusan Overlenght TM'],
    ['Tiang Beton 13 Mtr (Crane)', 'Tiang Beton 13 mtr (Crane)'],
    ['Arde Jtm 3 Ohm Pasangan Luar (Ground Rod)'],
    ['Tiang Beton 11 Mtr (Crane)', 'Tiang Beton 11 mtr (Crane)'],
    ['Tiang Beton 9 Meter (Crane)', 'Tiang Beton 9 meter (Crane)'],
    ['Tiang Besi 9 Meter (Crane)', 'Tiang besi 9 meter (Crane)'],
    ['Tree Guard'],
    ['Pelurusan (Penegakan) Tiang Beton 13;350/350+E Dan', 'Perbaikan/Pelurusan Tiang Beton 13 mtr (Crane)'],
    ['Bongkar Pasang Tiang Beton 13;350/350+E Dan (Crane)', 'Bongkar Pasang Tiang Beton 13 mtr (Crane)'],
    ['Trafo dist- 20 kV 231/400 V 3P 250 kVA OD (Crane)', 'trafo 250 kva (crane)'],
    ['Trafo dist- 20 kV 231/400 V 3P 200 kVA OD (Crane)', 'trafo 200 kva (crane)'],
    ['Trafo dist- 20 kV 231/400 V 3P 160 kVA OD (Crane)', 'trafo 160 kva (crane)'],
    ['Dudukan Cut Out / Arrester 2500 mm UNP 100 Gal Komplit 2 Tiang', 'Dudukan CO 2 Tiang'],
    ['YZER WERK ( PLAT FORM ) GALV 1 Tiang 2 Jurusan', 'Yzer werk 1 Tiang 2 jurusan'],
    ['YZER WERK ( PLAT FORM ) GALV 2 Tiang 4 Jurusan', 'Yzer Werk 2 Tiang 4 Jurusan']
  ];
  // Nama pokok lain dari lembar kontrak (belum punya padanan): ikut jadi rekomendasi nama panjang.
  const tail = [
    'Tiang Beton 11; 200 /200 + E daN (Crane)', 'ARDE JTM PASANGAN LUAR', 'Suspension assembly TM', 'Large angle assembly TM', 'Fixed end assembly TM', 'Adjustable Dead End Assembly',
    'Suspension assembly', 'Large angle assembly', 'Fixed end assembly',
    'Dudukan Terminating Single Core Out Door Galv Komplit', 'Dudukan Joint MVTIC UNP 100 Gal Komplit', 'Tiang besi/baja 13; 350/350+E daN (Crane)',
    'MVTIC 3x150+1x95 mm2', 'Bongkar Pasang MVTIC 3x150+1x95 mm2', 'Bongkar pasang Fixed end assembly TM', 'Bongkar pasang dudukan terminating MVTIC',
    'NA2XSEBY 20kV three core (3 x 150 mm2 - 3 x 300 mm2)', 'Agregat A', 'Agregat B', 'Cutting hotmix /aspal ( 2 sisi )', 'Cutting beton ( 2 sisi )',
    'Perbaikan aspal biasa tebal 10cm', 'Perbaikan aspal hotmix tebal 10cm', 'Perbaikan marka jalan', 'Penggalian kabel pada tanah biasa',
    'Penggalian kabel pada tanah karang/berbatu (limestone)/beton', 'Penggalian kabel pada hotmix', 'Pembuangan tanah galian',
    'Tes kepadatan urugan tanah dan agregat', 'Concrete plate 40x20x6cm', 'Pemasangan tanah urug ( urugan kembali )', 'Pasir urug',
    'Timah tanda kabel (nama penyulang)', 'Patok tanda kabel', 'Box Joint kabel (kotak sambungan kabel)', 'Celana Kabel',
    'Heat Shrink untuk isolasi kabel 20 KV', 'Dudukan Pipa u/Kabel Naik di Tiang',
    'Fuselink', 'AAAC-AAACS uk. 70 mm2', 'LV Board 3 phs 2 jurusan 400A- 1 tiang', 'NYY 1 x 70 mm2 -95 mm2', 'NYY 1 x 150 mm2 -300 mm2',
    'G Type Conn Press ( AL-70-150 mm2)', 'Sepatu kabel AL/CU 70mm2', 'Electroda tembaga 5/8" 2,5 meter',
    'Trafo dist- 20 kV 231/400 V 3P 100 kVA OD (Crane)', 'Trafo dist- 20 kV 231/400 V 3P 50 kVA OD (Crane)',
    'Perisai binatang Untuk Arrester ( atas )', 'Perisai Binatang Untuk Cut Out ( Atas dan Bawah )', 'Perisai Binatang Untuk Bushing Primer Trafo, LBS, Recloser',
    'Perisai Binatang Untuk Bushing Skunder Trafo', 'Penghalang Panjat Binatang', 'Perisai Gardu',
    'Bongkar pasang Trafo 50 kVA (crane)', 'Bongkar Pasang Yzer werk 1 Tiang 2 jurusan', 'Bongkar pasang Pipa Galvanis 3"', 'Bongkar Pasang L-Bow PVC 3"',
    'Bongkar pasang perisai gardu', 'Pipa Galvanis 3"', 'Bongkar pasang NYY 1x70 mm2', 'Bongkar pasang NYY 1x150 mm2',
    'LV Board 3 phs 4 jurusan 630A- 2 tiang', 'Pondasi Gardu 2 Tiang ( 1.5 m3 ) pembetonan bertulang', 'Dudukan LVBoard 2 tiang',
    'Dudukan Pipa jurusan', 'L-Bow PVC 3"', 'Begel 3" (Kanal, mur + baut)', 'Sepatu Kabel CU 150 mm2', 'Sepatu Kabel CU 70 mm2',
    'Bongkar Pasang Dudukan LVBoard 2 Tiang', 'Perbaikan Pondasi Gardu 2 Tiang ( 1.5 m3 ) pembetonan bertulang',
    'Kubikel FG4 > 1.000 kVA / Kubikel FG1A < 1.000 kVA', 'Dudukan Kubikel dengan UNP', 'Arcrilic penutup bawah', 'Power Supply Unit Output 12-24 VDC 10A',
    'Kubikel LBS 24 KV;Kubikel PT 24 KV;Kubikel CB/CT 24 KV; Kubikel F LBS 24 kV ;kubikel metering (CT/PT)', 'CT 20KV 10-20/5-5A s.d 200-400/5-5A class 0.2s',
    'UGB Mobil + mobilisasi non BBM', 'UGB Portable + mobilisasi non BBM', 'UKB + mobilisasi non BBM', 'Panel Junction',
    'SPKLU Home Charging', 'SPKLU Fast Charging', 'SPKLU Ultra Fast Charging', 'LVTC 3x70+1x50 mm2', 'Bongkar pasang LVTC 3x70+1x50 mm2', 'Bongkar LVTC 3x70+1x50 mm2', 'Bongkar Pasang SR'
  ];
  const seen = {}; const out = [];
  a.concat(tail.map(function (t) { return [t]; })).forEach(function (r) {
    const k = String(r[0]).toLowerCase().replace(/\s+/g, '');
    if (seen[k]) return; seen[k] = true;
    out.push([r[0], r[1] || '', r[2] || '', r[3] || '']);
  });
  return out;
}

/** Sheet Convert_material; dibuat + diisi data awal bila belum ada. */
function ktkConvertSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  // cari sheet dengan nama longgar (Convert_material / Convert material / convert_Material), supaya sheet buatan sendiri tetap terbaca
  const all = ss.getSheets();
  for (let i = 0; i < all.length; i++) {
    if (String(all[i].getName()).toLowerCase().replace(/[^a-z0-9]/g, '') === 'convertmaterial') return all[i];
  }
  let sh = ss.insertSheet('Convert_material');
  sh.getRange(1, 1, 1, 4).setValues([KTK_H_CONVERT_]).setFontWeight('bold').setBackground('#D9D9D9');
  sh.setFrozenRows(1);
  sh.getRange(1, 1, sh.getMaxRows(), 4).setNumberFormat('@');
  sh.setColumnWidth(1, 380); sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 260); sh.setColumnWidth(4, 260);
  const rows = ktkConvertSeed_();
  sh.getRange(2, 1, rows.length, 4).setValues(rows);
  return sh;
}

/** Isi Convert_material sebagai [[pokok, m1, m2, m3], ...]; baris tanpa nama pokok dilewati. Tidak pernah menggagalkan ktkLoad. */
function ktkConvertRows_() {
  try {
    const sh = ktkConvertSheet_();
    if (sh.getLastRow() < 1) return [];
    const nk = Math.max(4, Math.min(sh.getLastColumn(), 10));
    const v = sh.getRange(1, 1, sh.getLastRow(), nk).getValues();
    // Susunan kolom dibaca dari judul: bentuk lama (Nama_Pokok, Mungkin_1..3) atau bentuk baru (ID, Nama_master, Nama Material Pokok, mungkin 1..3).
    // ID dan Nama_master menunjuk baris Master_Data yang sesuai.
    const kunci = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
    const h = v[0].map(kunci); let cId = -1, cMaster = -1, cPokok = 0; const cMk = [];
    h.forEach(function (x, i) { if (x === 'id' || x === 'iditem') cId = i; else if (x === 'namamaster' || x === 'namaitem') cMaster = i; else if (/pokok/.test(x)) cPokok = i; else if (/^mungkin/.test(x)) cMk.push(i); });
    const baru = cId >= 0 || cMaster >= 0;
    if (!baru) { cPokok = 0; cMk.length = 0; cMk.push(1, 2, 3); } else { while (cMk.length < 3) cMk.push(-1); }
    const s = function (r, c) { return c >= 0 && c < r.length ? String(r[c] == null ? '' : r[c]).trim() : ''; };
    return v.map(function (r) { const master = s(r, cMaster); return [s(r, cPokok) || master, s(r, cMk[0]), s(r, cMk[1]), s(r, cMk[2]), s(r, cId), master]; })
      // baris judul dan baris tanpa nama dilewati
      .filter(function (r) { return r[0] && !/^nama[_ ]*(material[_ ]*)?pokok$/i.test(r[0]); });
  } catch (e) { return []; }
}

/** Baca ulang Convert_material saja (tombol refresh di menu KTK): cepat, tidak memuat ulang kontrak. */
function ktkConvert(auth) {
  try {
    ktkAuth_(auth);
    return { status: 'success', data: ktkConvertRows_() };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

/** Jalankan manual dari editor bila ingin membuat sheet Convert_material sebelum membuka menu KTK. */
function ktkConvertSetup() {
  const gerbang = kmnGerbang_(); if (gerbang) return gerbang.message;
  ktkConvertSheet_();
  return 'Data Convert material siap (' + ktkConvertRows_().length + ' baris).';
}
