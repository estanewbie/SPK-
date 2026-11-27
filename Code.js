/**
 * ============================================================================
 * CONFIGURATION - PT NANDA ELEKTRIK DATABASE & STORAGE
 * ============================================================================
 */
// Tabel produksi (asli). Untuk mode uji, ganti sementara dengan ID salinan:  1vPkCgpZuG78iFXNRK2kaU17iIQ0Ags8cBMRBp5XzqNk
const SPREADSHEET_ID = '136oHlUKduxrOv4yMdv3AVtg7pRu37p8i1rSpcA5O5pU';
const FOLDER_ID = '1a7xEfi-sOckxIb2GtzqKp697c1FohZZ-';

/**
 * Fungsi utama untuk merender Web App
 */
function doGet(e) {
  // Tahap 1: Kirim halaman loading super ringan dulu (hampir instan tampil)
  var html = HtmlService.createHtmlOutputFromFile('01_Loading');
  
  html.setTitle('Sistem Manajemen SPK - PT Nanda Elektrik')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);   // DEFAULT: halaman tidak bisa disematkan situs lain (mencegah clickjacking)
      
  return html;
}

/**
 * Tahap 2: Dipanggil dari Loading.html via google.script.run
 * untuk menarik seluruh aplikasi besar (Index.html) di background
 */
function getMainAppHtml() {
  var html = HtmlService.createTemplateFromFile('00_Index').evaluate();
  return html.getContent();
}

/**
 * Fungsi include untuk memanggil file eksternal (CSS/JS)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ============================================================================
 * [ AUTO SETUP DATABASE ] 
 * JALANKAN INI SEKALI SAJA:
 * Pilih fungsi "setupDatabase" di menu dropdown atas editor GAS, lalu klik "Run".
 * ============================================================================
 */
function setupDatabase() {
  const gerbang = kmnGerbang_(); if (gerbang) return gerbang;   // tidak bisa dipanggil dari browser (Keamanan.js)
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Definisi Tabel dan Header - DATA_SPK SUDAH DIUPDATE
  const schema = {

    "Data_User": ["Username", "Password", "Nama", "Role"],
    "Data_SPK": ["ID_SPK", "Nama_SPK","Nama_Vendor", "Nominal_Total", "Nominal_Terpakai", "Status", "Tgl_Terbit", "Tgl_Berakhir", "ULP_Wilayah"],
    

    "Data_PK": ["ID_PK", "ID_SPK", "Nama_Pekerjaan", "Jenis_Pekerjaan", "Penyulang", "Vendor", "Tanggal", "Nominal", "Code_3", "Code_7", "AGO", "Butuh_C3", "Butuh_C7", "Pengawas_Vendor", "Nama_Team", "Jumlah_Tenaga", "ULP", "File_Code3", "File_Code7", "File_AGO", "Lokasi"],
    

    "Data_LH": ["ID_LH", "ID_PK", "Tanggal", "Uraian", "Data_JSON", "Foto_URL", "Is_RAB_Created", "Audit_Note", "Code3", "Code7", "AGO", "File_Code3", "File_Code7", "File_AGO"],
    
    "Master_Data": ["ID_Item", "Tipe", "Nama_Item", "Satuan", "Harga"],
    "Data_RAB": ["ID_RAB", "Tanggal_Cetak", "ID_PK", "Nama_Pekerjaan", "Vendor", "Ref_LH", "Total_Material_RAB", "Total_Jasa_RAB", "Grand_Total_RAB", "Pengawas", "Team", "Jml_Orang", "Jasa_Harian", "Transport", "Total_Upah"]
  };


  // Proses pembuatan Sheet otomatis
  for (const sheetName in schema) {
    let sheet = ss.getSheetByName(sheetName);
    const headers = schema[sheetName];

    if (!sheet) {
      // Jika Sheet belum ada, buat baru
      sheet = ss.insertSheet(sheetName);
    } 

    // Selalu update Header di Baris 1 untuk memastikan kolom baru (Tgl_Terbit dll) masuk
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    
    // Styling Header: Bold & Excel Gray (#D9D9D9)
    headerRange.setFontWeight("bold").setBackground("#D9D9D9");
    sheet.setFrozenRows(1);
    
// Auto-resize kolom agar rapi
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }

  // Auto-Fill User Awal jika Data_User masih kosong
  const userSheet = ss.getSheetByName("Data_User");
  if (userSheet.getLastRow() === 1) {
    const initialUsers = [
      ['adminpk', 'nanda123', 'Dodyk PK', 'Admin PK'],
      ['admincode', 'nanda123', 'Agung Code', 'Admin Code'],
      ['adminspk', 'nanda123', 'Putu SPK', 'Admin SPK']
    ];
    userSheet.getRange(2, 1, initialUsers.length, 4).setValues(initialUsers);
  }

  // Auto-Fill Katalog Awal jika tabel Master_Data masih kosong
  const masterSheet = ss.getSheetByName("Master_Data");
  if (masterSheet.getLastRow() === 1) {
    const initialKatalog = [
      ['M001', 'material', 'Tiang Beton 12m', 'btg', 5500000],
      ['M002', 'material', 'Tiang Besi 11m', 'btg', 4800000],
      ['M003', 'material', 'Isolator Tumpu', 'bh', 150000],
      ['M004', 'material', 'Kabel NYY 70mm', 'm', 85000],
      ['M005', 'material', 'Trafo 160kVA', 'bh', 45000000],
      ['J001', 'jasa', 'Galian & Pengecoran Pondasi', 'm3', 150000],
      ['J002', 'jasa', 'Ereksi Tiang Beton 12m', 'btg', 750000]
    ];
      masterSheet.getRange(2, 1, initialKatalog.length, 5).setValues(initialKatalog);
  }

  return "Database Berhasil Di-update! Kolom Tgl_Terbit, Tgl_Berakhir, dan ULP_Wilayah sudah tersedia.";
}

/**
 * FUNGSI RATAKANAN V3: Anti-Crash Date Format
 * Menggunakan getDisplayValues() agar semua data (Tanggal, Angka) otomatis jadi String aman.
 */
function getSheetDataOptimized_(sheetName) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return { headers: [], rows: [] };
  
  // getDisplayValues() MENCEGAH CRASH diam-diam akibat format Date/Angka dari Excel
  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return { headers: data[0] || [], rows: [] };
  
  return {
    headers: data[0],
    rows: data.slice(1)
  };
}

/**
 * ============================================================================
 * FUNGSI CORE ENGINE (CRUD & DATABASE)
 * ============================================================================
 */

/**
 * Mengambil seluruh data awal untuk dimuat ke aplikasi (React)
 */
/**
 * FUNGSI RATAKANAN: Helper Ekstraksi Data Ultra-Cepat
 */

function getSheetDataAsObject_(sheetName) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  // Menggunakan reduce & map tingkat lanjut untuk parsing JSON secepat kilat
  return data.slice(1).map(row => 
    headers.reduce((obj, header, i) => {
      obj[header] = row[i];
      return obj;
    }, {})
  );
}

/**
 * 1. FUNGSI LOGIN (Hanya baca Data_User) - Sangat Ringan & Aman
 */
function verifyUserLogin(username, password) {
  try {
    const uname = String(username == null ? '' : username).trim();
    if (uname.length > 100 || String(password == null ? '' : password).length > 200) return { status: 'error', message: 'Kredensial tidak valid' };
    if (kmnTerkunci_(uname)) {
      jejakAkses_({ id: uname || '(kosong)', name: '', role: '', realId: uname || '(kosong)' }, 'akses.gagal', 'Akun terkunci sementara karena terlalu banyak percobaan salah', 'gagal');
      return { status: 'error', message: 'Terlalu banyak percobaan masuk yang salah. Akun dikunci 15 menit, coba lagi nanti.' };
    }
    const users = getSheetDataAsObject_('Data_User');
    // Validasi di server: sandi dibandingkan sebagai hash bergaram (sandi lama teks biasa diubah menjadi hash saat berhasil masuk)
    let perluUbah = false;
    const validUser = uname === '' ? null : users.find(u => {
      if (String(u.Username).trim() !== uname) return false;
      const p = kmnPeriksaSandi_(u.Password, password); if (p.cocok) perluUbah = p.perluUbah; return p.cocok;
    });

    if (validUser && String(validUser.Status == null ? '' : validUser.Status).trim().toLowerCase() === 'nonaktif') {
      jejakAkses_({ id: uname, name: String(validUser.Nama || ''), role: String(validUser.Role || ''), realId: uname }, 'akses.gagal', 'Akun nonaktif mencoba masuk', 'gagal');
      return { status: 'error', message: 'Akun ini dinonaktifkan. Hubungi Super Admin.' };
    }
    if (validUser) {
      kmnBersihSalah_(uname);
      if (perluUbah) kmnUbahKeHash_(uname, String(password).trim());
      // username = ID akun (unik) dan token = sesi dibuat server; dipakai menu KTK untuk memisahkan pekerjaan antar admin (KtkAuth.js)
      const idAkun = String(validUser.Username).trim();
      jejakAkses_({ id: idAkun, name: String(validUser.Nama || ''), role: String(validUser.Role || ''), realId: idAkun }, 'akses.masuk', 'Masuk ke aplikasi', 'sukses');   // riwayat akses (Jejak.js)
      return { status: 'success', user: { name: validUser.Nama, role: validUser.Role, username: idAkun }, token: ktkIssueToken_(validUser.Username) };
    }
    kmnCatatSalah_(uname);
    jejakAkses_({ id: String(username == null ? '' : username).trim() || '(kosong)', name: '', role: '', realId: String(username == null ? '' : username).trim() || '(kosong)' }, 'akses.gagal', 'Percobaan masuk gagal: username atau sandi salah', 'gagal');   // sandi TIDAK dicatat
    return { status: 'error', message: 'Kredensial tidak valid' };
  } catch (e) { return { status: 'error', message: 'Terjadi kesalahan di server. Coba lagi.' }; }   // detail galat tidak dibocorkan ke layar login
}

/**
 * AKUN SUPER ADMIN: jalankan buatAkunSuperAdmin() SEKALI dari editor Apps Script (Run), setelah PEMELIHARAAN_SAMPAI diisi.
 * Membuat baris di Data_User: username "superadmin", role "Super Admin", dengan sandi ACAK yang ditampilkan SATU KALI di hasil
 * fungsi ini (disimpan sebagai hash). Catat, lalu segera ganti. Bila akun sudah ada, tidak diubah.
 */
function buatAkunSuperAdmin() {
  const gerbang = kmnGerbang_(); if (gerbang) return gerbang.message;
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_User');
  if (!sh) return 'Data akun tidak ditemukan. Jalankan setup database dulu.';
  const rows = sh.getDataRange().getValues();
  const head = rows[0].map(String);
  const iu = head.indexOf('Username'), ip = head.indexOf('Password'), inm = head.indexOf('Nama'), ir = head.indexOf('Role');
  if (iu < 0 || ip < 0 || inm < 0 || ir < 0) return 'Kolom Data_User harus Username, Password, Nama, Role.';
  for (let i = 1; i < rows.length; i++) if (String(rows[i][iu]).trim() === 'superadmin') return 'Akun superadmin sudah ada (tidak diubah).';
  const row = new Array(head.length).fill('');
  const sandi = (Utilities.getUuid().replace(/-/g, '').slice(0, 12) + 'A#' + Math.floor(Math.random() * 90 + 10));
  row[iu] = 'superadmin'; row[ip] = kmnBuatSandiTersimpan_(sandi); row[inm] = 'Super Admin'; row[ir] = 'Super Admin';
  sh.appendRow(row);
  return 'Akun superadmin dibuat. Sandi sementara (tampil sekali, catat sekarang): ' + sandi;
}

/** Daftar pengguna (tanpa sandi) untuk pilihan "Masuk sebagai". Hanya Super Admin yang sungguh login. */
function adminDaftarAkun(auth) {
  try {
    const w = kmnSesi_(auth); if (!w.ok) return w.galat;
    if (w.who.realRole !== 'Super Admin') return { status: 'error', message: 'Hanya Super Admin.' };
    const users = getSheetDataAsObject_('Data_User').filter(u => String(u.Nama || '').trim() && String(u.Role || '').trim())
      .map(u => ({ name: String(u.Nama).trim(), role: String(u.Role).trim(), username: String(u.Username).trim() }));
    return { status: 'success', users: users };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

/**
 * 2. FUNGSI AMBIL DATA UTAMA (Dipanggil HANYA setelah login berhasil)
 */

function getAppData(auth) {
  try {
    const w = kmnSesi_(auth); if (!w.ok) return w.galat;   // data hanya untuk sesi login yang sah
    return {
      status: 'success',
      data: {
        spks: getSheetDataOptimized_('Data_SPK'),
        pks: getSheetDataOptimized_('Data_PK'),
        lhs: getSheetDataOptimized_('Data_LH'),
        masterDb: getSheetDataOptimized_('Master_Data'),
        // tabel Convert ikut dikirim: satu-satunya jembatan nama lama/nama KTK ke Master_Data di semua menu (gagal baca tidak menggagalkan data utama)
        convert: (typeof ktkConvertRows_ === 'function' ? ktkConvertRows_() : []),
        ttd: getSheetDataOptimized_('Data_Penandatangan'), // Menarik tabel tanda tangan baru
        rabs: getSheetDataOptimized_('Data_RAB')
      }
    };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

/**
 * ============================================================================
 * MESIN CRUD PK (FIXED URUTAN KOLOM SESUAI FILE Data_PK.csv)
 * ============================================================================
 */

/** Kunci perbandingan ID: teks, tanpa spasi pinggir, tanpa membedakan huruf besar atau kecil. */
function idKey_(v) { return String(v === null || v === undefined ? '' : v).trim().toLowerCase(); }

/**
 * ID BARU yang dijamin unik: PREFIX-yyMMdd-NNNN (nomor urut per hari = urutan terbesar yang ada + 1).
 * Dipanggil di dalam kunci skrip (withIdLock_), jadi dua penyimpanan bersamaan tidak mendapat nomor yang sama.
 * ID tidak diketik orang dan tidak dibuat di layar.
 */
function idBaru_(sheet, col, prefix) {
  const pre = prefix + '-' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyMMdd') + '-';
  const lr = sheet.getLastRow();
  const vals = lr < 2 ? [] : sheet.getRange(2, col, lr - 1, 1).getValues();
  const preK = pre.toLowerCase(); let max = 0;
  vals.forEach(function (r) { const k = idKey_(r[0]); if (k.indexOf(preK) === 0) { const n = parseInt(k.slice(preK.length), 10); if (n > max) max = n; } });
  let n = max + 1, id = pre + ('000' + n).slice(-4);
  while (idAda_(sheet, col, id)) { n++; id = pre + ('000' + n).slice(-4); }
  return id;
}

/** Ada baris lain (selain baris `exceptRow`, nomor baris sheet) di kolom `col` (1 = kolom A) yang berisi ID ini? */
function idAda_(sheet, col, id, exceptRow) {
  const lr = sheet.getLastRow();
  if (lr < 2) return false;
  const vals = sheet.getRange(2, col, lr - 1, 1).getValues();
  const k = idKey_(id);
  for (let i = 0; i < vals.length; i++) { if (idKey_(vals[i][0]) === k && (i + 2) !== exceptRow) return true; }
  return false;
}

/**
 * Cek ID ganda di Data_PK, Data_LH, Data_RAB, Data_SPK. Jalankan dari editor Apps Script (Run > auditIdGanda),
 * lalu lihat Execution log. ID ganda membuat dokumen tergabung saat cetak; ganti salah satunya.
 */
function auditIdGanda() {
  const gerbang = kmnGerbang_(); if (gerbang) return gerbang;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const cek = { Data_PK: 1, Data_LH: 1, Data_RAB: 1, Data_SPK: 1 };
  const out = {};
  Object.keys(cek).forEach(function (name) {
    const sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
    const vals = sh.getRange(2, cek[name], sh.getLastRow() - 1, 1).getValues();
    const seen = {}, dup = {};
    vals.forEach(function (r, i) { const k = idKey_(r[0]); if (!k) return; (seen[k] = seen[k] || []).push(i + 2); });
    Object.keys(seen).forEach(function (k) { if (seen[k].length > 1) dup[k] = 'baris ' + seen[k].join(', '); });
    if (Object.keys(dup).length) out[name] = dup;
  });
  Logger.log(Object.keys(out).length ? 'ID GANDA DITEMUKAN: ' + JSON.stringify(out, null, 1) : 'Tidak ada ID ganda.');
  return out;
}

// Simpan/ubah PK, LH, SPK lewat kunci skrip (PerbaikiId.js): dua penyimpanan bersamaan tidak bisa sama-sama lolos cek ID ganda.
// Nama publik (savePkToSheet dan seterusnya) ada di Jejak.js: pembungkus yang memeriksa sesi dan mencatat riwayat, lalu memanggil fungsi "...Asli_" ini.
function savePkToSheetAsli_() { const a = arguments; return withIdLock_(function () { return savePkToSheetCore_.apply(null, a); }); }
function updatePkInSheetAsli_() { const a = arguments; return withIdLock_(function () { return updatePkInSheetCore_.apply(null, a); }); }
function saveLhToSheetAsli_() { const a = arguments; return withIdLock_(function () { return saveLhToSheetCore_.apply(null, a); }); }
function updateLhInSheetAsli_() { const a = arguments; return withIdLock_(function () { return updateLhInSheetCore_.apply(null, a); }); }
function saveSpkToSheetAsli_() { const a = arguments; return withIdLock_(function () { return saveSpkToSheetCore_.apply(null, a); }); }

function savePkToSheetCore_(pkData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_PK');
    // ID PK dibuat server bila kosong. ID terisi hanya bila datang dari log harian sumber (nomor PK asli), tetap dicek tidak boleh ganda.
    pkData.id = String(pkData.id || '').trim() || idBaru_(sheet, 1, 'PK');
    if (idAda_(sheet, 1, pkData.id)) return { status: 'error', message: 'ID PK "' + pkData.id + '" sudah dipakai. Gunakan ID lain supaya dokumen tidak tercampur.' };

    // URUTAN WAJIB (21 Kolom): 
    // 1:ID_PK | 2:ID_SPK | 3:Nama | 4:Jenis | 5:Penyulang | 6:Vendor | 7:Tanggal | 8:Nominal | 
    // 9:Code_3 | 10:Code_7 | 11:AGO | 12:Butuh_C3 | 13:Butuh_C7 | 14:Pengawas_Vendor | 
    // 15:Nama_Team | 16:Jml_Tenaga | 17:ULP | 18:File_C3 | 19:File_C7 | 20:File_AGO | 21:Lokasi
    
    sheet.appendRow([
      pkData.id || "",                   // 1. ID_PK
      pkData.spk_id || "",               // 2. ID_SPK
      pkData.nama || "",                 // 3. Nama_Pekerjaan
      pkData.jenis_pekerjaan || "",      // 4. Jenis_Pekerjaan
      pkData.penyulang || "",            // 5. Penyulang
      pkData.vendor || "",               // 6. Vendor
      pkData.tanggal || "",              // 7. Tanggal
      Number(pkData.nominal) || 0,       // 8. Nominal
      pkData.code3 || false,             // 9. Code_3 (Status Gembok)
      pkData.code7 || false,             // 10. Code_7 (Status Gembok)
      pkData.ago || false,               // 11. AGO (Status Gembok)
      pkData.butuh_c3 || false,          // 12. Butuh_C3 (Syarat)
      pkData.butuh_c7 || false,          // 13. Butuh_C7 (Syarat)
      pkData.pengawas || "",             // 14. Pengawas_Vendor
      pkData.team || "",                 // 15. Nama_Team
      pkData.jumlah_tenaga || "",        // 16. Jumlah_Tenaga
      pkData.ulp || "",                  // 17. ULP
      "",                                // 18. File_Code3 (Awal kosong)
      "",                                // 19. File_Code7 (Awal kosong)
      "",                                // 20. File_AGO (Awal kosong)
      pkData.lokasi || "",               // 21. Lokasi
      pkData.sumber_id || ""             // 22. ID_Sumber (ProjectID di tabel log harian; patokan penautan, bukan nomor PK)
    ]);
    if (!String(sheet.getRange(1, 22).getValue() || '').trim()) sheet.getRange(1, 22).setValue('ID_Sumber');

    return { status: 'success', id: pkData.id, message: 'PK ' + pkData.id + ' berhasil didaftarkan!' };
  } catch (error) {
    return { status: 'error', message: error.toString() };
  }
}

function updatePkInSheetCore_(pkData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_PK');
    const data = sheet.getDataRange().getValues();
    
    // 🔥 PENGAMANAN 1: Cari baris data menggunakan ID LAMA agar pasti ketemu!
    const targetId = pkData.old_id || pkData.id; 
    
    if (!String(pkData.id || '').trim()) return { status: 'error', message: 'ID PK tidak boleh kosong.' };
    if (pkData.old_id && idKey_(pkData.id) !== idKey_(pkData.old_id)) return { status: 'error', message: 'ID PK tidak boleh diubah. ID dibuat sistem dan dipakai sebagai rujukan LH, RAB, dan KTK.' };
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(targetId).trim()) { // Kolom 1 (Index 0) adalah ID_PK
        if (idKey_(pkData.id) !== idKey_(targetId) && idAda_(sheet, 1, pkData.id, i + 1)) return { status: 'error', message: 'ID PK "' + pkData.id + '" sudah dipakai PK lain. Pilih ID yang berbeda.' };
        
        // --- 1. UPDATE KTP BARU DAN DATA GLOBAL DI TABEL PK ---
        sheet.getRange(i + 1, 1).setValue(pkData.id); // Ubah jadi KTP Baru
        sheet.getRange(i + 1, 3).setValue(pkData.nama || "");
        sheet.getRange(i + 1, 4).setValue(pkData.jenis_pekerjaan || "");
        sheet.getRange(i + 1, 5).setValue(pkData.penyulang || "");
        sheet.getRange(i + 1, 6).setValue(pkData.vendor || "");
        sheet.getRange(i + 1, 7).setValue(pkData.tanggal || "");
        sheet.getRange(i + 1, 8).setValue(Number(pkData.nominal) || 0);
        sheet.getRange(i + 1, 9).setValue(pkData.code3);
        sheet.getRange(i + 1, 10).setValue(pkData.code7);
        sheet.getRange(i + 1, 11).setValue(pkData.ago);
        sheet.getRange(i + 1, 12).setValue(pkData.butuh_c3);
        sheet.getRange(i + 1, 13).setValue(pkData.butuh_c7);
        sheet.getRange(i + 1, 14).setValue(pkData.pengawas || "");
        sheet.getRange(i + 1, 15).setValue(pkData.team || "");
        sheet.getRange(i + 1, 16).setValue(pkData.jumlah_tenaga || "");
        sheet.getRange(i + 1, 17).setValue(pkData.ulp || "");
        // Kolom 18, 19, 20 di-skip (File Drive) agar aman
        sheet.getRange(i + 1, 21).setValue(pkData.lokasi || "");
        
        // --- 2. 🔥 SISTEM CASCADE UPDATE (Sapu Bersih ke Tabel LH & RAB) ---
        // Jika KTP Bapaknya berubah (old_id tidak sama dengan id baru)
        if (pkData.old_id && pkData.old_id !== pkData.id) {
            
            // A. Cari & Ganti semua KTP Bapak di Tabel LH
            const sheetLh = ss.getSheetByName('Data_LH');
            if (sheetLh) {
                const dataLh = sheetLh.getDataRange().getValues();
                for (let j = 1; j < dataLh.length; j++) {
                    if (String(dataLh[j][1]).trim() === String(pkData.old_id).trim()) { // Kolom 2 (Index 1) adalah ID_PK di LH
                        sheetLh.getRange(j + 1, 2).setValue(pkData.id);
                    }
                }
            }

            // B. Cari & Ganti semua KTP Bapak di Tabel RAB
            const sheetRab = ss.getSheetByName('Data_RAB');
            if (sheetRab) {
                const dataRab = sheetRab.getDataRange().getValues();
                for (let k = 1; k < dataRab.length; k++) {
                    if (String(dataRab[k][2]).trim() === String(pkData.old_id).trim()) { // Kolom 3 (Index 2) adalah ID_PK di RAB
                        sheetRab.getRange(k + 1, 3).setValue(pkData.id);
                    }
                }
            }
        }
        
        return { status: 'success', message: 'PK berhasil diperbarui menjadi ' + pkData.id + '!' };
      }
    }
    return { status: 'error', message: 'Gagal! ID PK lama tidak ditemukan di database.' };
  } catch (e) { 
    return { status: 'error', message: e.toString() }; 
  }
}

// 3. FUNGSI HAPUS PK
function deletePkFromSheetAsli_(pkId) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_PK');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(pkId).trim()) {
        sheet.deleteRow(i + 1);
        return { status: 'success', message: 'Pekerjaan ' + pkId + ' dihapus permanen.' };
      }
    }
    return { status: 'error', message: 'ID tidak ditemukan.' };
  } catch (e) { 
    return { status: 'error', message: e.toString() }; 
  }
}


/**
 * Simpan Laporan Harian (LH) & Evaluasi Trigger Barang Bekas
 */
function saveLhToSheetCore_(lhData, lockCode3, lockCode7) {
  try {
    const lhSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
    // ID LH SELALU dibuat server (unik, urut). ID kiriman layar hanya penanda sementara dan diabaikan.
    lhData.id = idBaru_(lhSheet, 1, 'LH');
    lhSheet.appendRow([
      lhData.id, lhData.pk_id, lhData.tanggal, 
      lhData.uraian, JSON.stringify(lhData.data), lhData.fotoUrl || "", false
    ]);
    jejakLhDibuat_(lhSheet);   // kolom Dibuat_Oleh dan Dibuat_Tgl pada baris LH (pelaku dari token sesi, Jejak.js)

    // Jika LH memicu sistem barang bekas, KUNCI Code 3 / Code 7 menjadi FALSE (Butuh Verifikasi)
    if (lockCode3 || lockCode7) {
      const pkSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_PK');
      const pkDataArr = pkSheet.getDataRange().getValues();
      for (let i = 1; i < pkDataArr.length; i++) {
        if (String(pkDataArr[i][0]).trim() === String(lhData.pk_id).trim()) { // (Ganti i menjadi j jika Anda sedang menambal di fungsi updateLhInSheet)
          if (lockCode3) pkSheet.getRange(i + 1, 9).setValue(false);
          if (lockCode7) pkSheet.getRange(i + 1, 10).setValue(false);
          
          // RATAKANAN FINAL: Paksa ubah status Bypass menjadi Verifikasi
          pkSheet.getRange(i + 1, 11).setValue(false); // Kunci AGO (Kolom K = 11)
          pkSheet.getRange(i + 1, 12).setValue(true);  // Ubah Butuh_C3C7 jadi TRUE (Kolom L = 12)
          break;
        }
      }
    }
    return { status: 'success', id: lhData.id, message: 'LH Berhasil Disimpan dengan ID ' + lhData.id + '.' };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

/**
 * Update Data Laporan Harian (Edit LH)
 */
// 🔥 Tambahkan 'oldId' di akhir parameter
function updateLhInSheetCore_(lhData, lockCode3, lockCode7, oldId) {
  try {
    const lhSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
    const data = lhSheet.getDataRange().getValues();
    
    // 🔥 PENTING 1: Ambil nama-nama kolom dari baris paling atas
    const headers = data[0]; 
    // 🔥 PENTING 2: Cari otomatis di kolom ke berapa 'Audit_Note' itu berada
    const noteColIndex = headers.findIndex(h => String(h).trim().toLowerCase() === 'audit_note');
    
    // LOGIKA PINTAR & ANTI SPASI GAIB (.trim)
    const idYangDicari = (oldId ? oldId : lhData.id).toString().trim();
    // ID LH tidak bisa diubah (dibuat sistem). Kolom ID tidak ditulis ulang.
    if (oldId && idKey_(lhData.id) !== idKey_(oldId)) return { status: 'error', message: 'ID LH tidak boleh diubah.' };

    for (let i = 1; i < data.length; i++) {
      let rowIdDiDatabase = data[i][0].toString().trim(); // Bersihkan spasi di database

      if (rowIdDiDatabase === idYangDicari) { 
        
        // ========================================================
        // TIMPA SEMUA KOLOM AGAR UPDATE TOTAL!
        // ========================================================
        // Kolom 1 (A): ID LH tidak ditulis ulang
        lhSheet.getRange(i + 1, 2).setValue(lhData.pk_id);    // Kolom 2 (B): ID PK
        lhSheet.getRange(i + 1, 3).setValue(lhData.tanggal);  // Kolom 3 (C): Tanggal
        lhSheet.getRange(i + 1, 4).setValue(lhData.uraian);   // Kolom 4 (D): Uraian
        lhSheet.getRange(i + 1, 5).setValue(JSON.stringify(lhData.data)); // Kolom 5 (E): Detail Form
        
        // ========================================================
        // 🔥 PENTING 3: SAPU PEMBERSIH CATATAN AUDIT!
        // Kalau kolom Audit_Note ketemu, kita hapus isinya sampai bersih
        // ========================================================
        // ALUR LH (Audit.js): LH yang bertemuan lalu disimpan ulang = revisi selesai, otomatis lanjut ke Admin Code.
        // LH tanpa temuan yang diedit kehilangan tanda audit (harus diaudit lagi).
        const hadNote = noteColIndex !== -1 && String(data[i][noteColIndex] == null ? '' : data[i][noteColIndex]).trim() !== '';
        if (noteColIndex !== -1) {
            lhSheet.getRange(i + 1, noteColIndex + 1).clearContent();
        }
        auditOnLhEdited_(lhSheet, headers, i + 1, hadNote);
        JEJAK_EKSTRA_ = { revisi: hadNote };          // pembungkus riwayat (Jejak.js) mencatat ini sebagai "revisi" atau "ubah"
        jejakLhDiubah_(lhSheet, headers, i + 1);       // kolom Diubah_Oleh dan Diubah_Tgl pada baris LH
        
        // ========================================================
        // Evaluasi Ulang Lock Code PK
        // ========================================================
        if (lockCode3 || lockCode7) {
            const pkSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_PK');
            const pkDataArr = pkSheet.getDataRange().getValues();
            for (let j = 1; j < pkDataArr.length; j++) {
                if (pkDataArr[j][0].toString().trim() === lhData.pk_id.toString().trim()) {
                    if (lockCode3) pkSheet.getRange(j + 1, 9).setValue(false);
                    if (lockCode7) pkSheet.getRange(j + 1, 10).setValue(false);
                    break;
                }
            }
        }
        return { status: 'success', message: 'LH berhasil diperbarui & Catatan Audit otomatis dihapus!' };
      }
    }
    // Jika tidak ketemu, kembalikan pesan error spesifik
    return { status: 'error', message: 'ID Lama (' + idYangDicari + ') tidak ditemukan di database.' };
  } catch (e) { 
    return { status: 'error', message: 'Error Server: ' + e.toString() }; 
  }
}

/**
 * Fungsi Upload Foto Dokumentasi ke Google Drive
 */
// DINONAKTIFKAN (privat): tidak dipakai di mana pun dan bisa menulis file ke Drive tanpa cek login.
function uploadFileToDriveLama_(base64Data, fileName, contentType) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const data = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob = Utilities.newBlob(data, contentType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      status: 'success',
      fileUrl: file.getUrl(),
      fileId: file.getId()
    };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

/**
 * FUNGSI RATAKANAN: Menghapus Dokumen Laporan Harian (LH) dari Database
 */
function deleteLhFromSheetAsli_(lhId) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(lhId).trim()) {
        sheet.deleteRow(i + 1); // Hapus 1 baris
        return { status: 'success', message: 'Dokumen LH ' + lhId + ' dihapus permanen.' };
      }
    }
    return { status: 'error', message: 'ID LH tidak ditemukan.' };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

/**
 * FUNGSI RATAKANAN: Update Dokumen Laporan Harian (LH) dari Database
 */ 
function updateLhRabStatusAsli_(lhIdsArray) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
    const data = sheet.getDataRange().getValues();
    
    // Kita loop dari bawah ke atas agar lebih aman, dan update statusnya menjadi TRUE
    let updatedCount = 0;
    for (let i = 1; i < data.length; i++) {
      if (lhIdsArray.includes(data[i][0])) {
        // Kolom G (indeks 7) adalah kolom Is_RAB_Created
        sheet.getRange(i + 1, 7).setValue(true);
        updatedCount++;
      }
    }
  return { status: 'success', message: `${updatedCount} LH resmi digabungkan jadi RAB.` };
  }
   catch (e) { 
    return { status: 'error', message: e.toString() }; 
  }
}

// DINONAKTIFKAN (privat): versi lama tanpa cek login/tipe/ukuran dan membuat file sebelum memeriksa apa pun. Gunakan lhUnggahDokumen (Dokumen.js).
function uploadCodeVerificationLama_(fileData, fileName, lhId, type) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const contentType = fileData.substring(5, fileData.indexOf(';'));
    const bytes = Utilities.base64Decode(fileData.substr(fileData.indexOf('base64,') + 7));
    const blob = Utilities.newBlob(bytes, contentType, fileName);
    
    // 1. BIKIN FILE DI DRIVE
    const file = folder.createFile(blob);
    
    // 🔥 BARIS PEMBUAT ERROR SUDAH SAYA BUANG! (Karena foldernya sudah kita setting manual)
    
    const fileUrl = file.getUrl();

    // 2. BUKA EXCEL
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_LH');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const findIdx = (name) => headers.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase());
    const idIdx = headers.findIndex(h => ["id_lh", "id"].includes(String(h).trim().toLowerCase()));
    const targetStatusCol = findIdx(type); 
    const targetFileCol = findIdx('file_' + type); 

    if (targetStatusCol === -1 || targetFileCol === -1) {
      return { status: 'error', message: `Radar gagal! Kolom '${type}' atau 'file_${type}' tidak ada di Excel.` };
    }

    let ketemu = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]).trim() === String(lhId).trim()) {
        // 3. TULIS KE EXCEL
        sheet.getRange(i + 1, targetStatusCol + 1).setValue(true);
        sheet.getRange(i + 1, targetFileCol + 1).setValue(fileUrl);
        ketemu = true;
        break;
      }
    }

    if (!ketemu) return { status: 'error', message: `ID LH ${lhId} tidak ada di tabel!` };

    return { status: 'success', message: `Berhasil tersimpan di Excel!` };

  } catch (e) {
    return { status: 'error', message: "System Error: " + e.toString() };
  }
}
/**
 * SERVER-SIDE QUERY: Mesin Pencari Cepat di Sisi Server (Google)
 * Hanya mengambil data yang dibutuhkan saja (Hemat RAM Browser)
 */
function queryDataPksLama1_(searchParams, limit = 100) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_PK');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    // Logika Filter di Server
    let filtered = data.filter(row => {
      const isUnallocated = row[1] === "" || row[1] === null; // Hanya yang belum di SPK
      const matchTanggal = searchParams.tanggal ? row[6] === searchParams.tanggal : true;
      const matchPengawas = searchParams.pengawas ? String(row[10]).toLowerCase().includes(searchParams.pengawas.toLowerCase()) : true;
      const matchPekerjaan = searchParams.pekerjaan ? String(row[2]).toLowerCase().includes(searchParams.pekerjaan.toLowerCase()) : true;
      
      return isUnallocated && matchTanggal && matchPengawas && matchPekerjaan;
    });

    // VIRTUAL LIMIT: Hanya kirim 100 data teratas (Bisa diatur)
    const paginated = filtered.slice(0, limit);
    
    return {
      status: 'success',
      headers: headers,
      rows: paginated,
      totalCount: filtered.length
    };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

/**
 * SERVER-SIDE QUERY (VERSI ANTI-ERROR): Menangani Pencarian Masif
 * Ditempel di bagian paling bawah file codegs-6.txt / Code.gs
 */
function queryDataPksTakTerpakai_(searchParams) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_PK');
    
    // Safety Check: Jika sheet tidak ketemu
    if (!sheet) return { status: 'error', message: 'Data PK tidak ditemukan!' };
    
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    data.reverse();
    // --- LOGIK NORMALISASI TANGGAL (KUNCI AGAR TIDAK HILANG) ---
    const getIsoDate = (val) => {
      if (!val) return "";
      const d = new Date(val);
      // Jika format tanggal valid, ubah ke YYYY-MM-DD agar sama dengan browser
      return isNaN(d.getTime()) ? String(val).trim() : d.toISOString().split('T')[0];
    };

    const targetTgl = searchParams.tanggal; // format dari browser: YYYY-MM-DD

    let filtered = data.filter(row => {
      // 1. Cek apakah PK belum dialokasikan ke SPK (Kolom index 1)
      const isUnallocated = row[1] === "" || row[1] === null;
      
      // 2. Bandingkan Tanggal (Kolom index 6) dengan format ISO
      const rowTgl = getIsoDate(row[6]);
      const matchTanggal = targetTgl ? rowTgl === targetTgl : true;
      
      // 3. Filter Pengawas (Kolom index 10) & Nama Pekerjaan (Kolom index 2)
      const matchPengawas = searchParams.pengawas ? String(row[10]).toLowerCase().includes(searchParams.pengawas.toLowerCase()) : true;
      const matchPekerjaan = searchParams.pekerjaan ? String(row[2]).toLowerCase().includes(searchParams.pekerjaan.toLowerCase()) : true;
      
      return isUnallocated && matchTanggal && matchPengawas && matchPekerjaan;
    });

    // Pastikan selalu mengembalikan objek, jangan null
    return { 
      status: 'success', 
      headers: headers, 
      rows: filtered || [] 
    };

  } catch (e) { 
    return { status: 'error', message: e.toString() }; 
  }
}

/**
 * FUNGSI RATAKANAN V6.1: Menyimpan Arsip RAB Super Lengkap
 */
/**
 * 1. FUNGSI SIMPAN & UPDATE RAB (DENGAN SENSOR GEMBOK)
 */
function saveRabToSheetAsli_(rabData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_RAB');
    const data = sheet.getDataRange().getValues();
    
    let targetRow = -1;
    let existingIdRab = rabData.id_rab;
    let isLocked = false; // Sensor gembok

    // CEK ANTI-DOUBLE & CEK GEMBOK
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][5]).trim() === String(rabData.ref_lh).trim()) { // Cek Kolom 6 (Ref_LH)
        targetRow = i + 1;
        existingIdRab = data[i][0];
        
        // CEK GEMBOK DI KOLOM 16 (Indeks array 15)
        if (data[i][15] === 'LOCKED') {
          isLocked = true;
        }
        break;
      }
    }

    // JIKA TERKUNCI, TOLAK MENTAH-MENTAH!
    if (isLocked) {
      return { 
        status: 'error', 
        message: 'DITOLAK: RAB ini sudah "Dikunci ke DB". Silakan hubungi Super Admin untuk membuka kunci jika ingin melakukan revisi/update.' 
      };
    }

    // JIKA TIDAK TERKUNCI, LANJUTKAN UPDATE / INSERT
    if (targetRow !== -1) {
      // MODE UPDATE (Hanya Data, tidak menyentuh kolom upah/gembok)
      sheet.getRange(targetRow, 1).setValue(existingIdRab);
      sheet.getRange(targetRow, 2).setValue(rabData.tanggal_cetak);
      sheet.getRange(targetRow, 3).setValue(rabData.id_pk);
      sheet.getRange(targetRow, 4).setValue(rabData.nama_pekerjaan);
      sheet.getRange(targetRow, 5).setValue(rabData.vendor);
      sheet.getRange(targetRow, 6).setValue(rabData.ref_lh);
      
      sheet.getRange(targetRow, 7).setValue(Number(rabData.total_material) || 0);
      sheet.getRange(targetRow, 8).setValue(Number(rabData.total_jasa) || 0);
      sheet.getRange(targetRow, 9).setValue(Number(rabData.grand_total) || 0);
      
      sheet.getRange(targetRow, 10).setValue(rabData.pengawas);
      sheet.getRange(targetRow, 11).setValue(rabData.team);
      sheet.getRange(targetRow, 12).setValue(rabData.jml_orang);
      
      return { status: 'success', message: 'RAB Diperbarui (Arsip LH sudah ada).' };
      
    }
     else {
      // MODE INSERT BARU (Otomatis status awal = UNLOCKED)
      sheet.appendRow([
        rabData.id_rab, rabData.tanggal_cetak, rabData.id_pk, 
        rabData.nama_pekerjaan, rabData.vendor, rabData.ref_lh, 
        Number(rabData.total_material) || 0, 
        Number(rabData.total_jasa) || 0, 
        Number(rabData.grand_total) || 0, 
        rabData.pengawas, rabData.team, rabData.jml_orang, 
        0, 0, 0, // Kolom 13, 14, 15 (Upah)
        'UNLOCKED' // KOLOM 16: Status Gembok
      ]);
      
     }

     // TAHAP 2: MESIN AUTO-SYNC KE TABEL PK
     try {
      const sheetPK = ss.getSheetByName('Data_PK'); //pastikan nama sheet PK
      if (sheetPK) {
        const dataPK = sheetPK.getDataRange().getValues();
        for(let row =1; row < dataPK.length; row++){
          // cari baris yang ID_PK sama (Asumsi ID_PK di A/Index 0)
          if (String(dataPK[row][0]).trim() === String(rabData.id_pk).trim()){
            // Pastikan Angka 5 sesuai urutan kolom (e=5)
            sheetPK.getRange(row + 1, 8).setValue(Number(rabData.grand_total) || 0);

            break; // selesai Update, Hentikan pencarian
          }
        }
      }
     } catch (errSync) {
      console. log("gagal Singkronisasi ke PK:" + errSync);
     }
      return { status: 'Success', message:'Data RAB & Nilai Anggaran PK Berhasil Diperbaharui!'};
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }

}

/**
 * 2. FUNGSI UNTUK MENGUNCI ATAU MEMBUKA KUNCI RAB (HANYA VIA TOMBOL UI)
 */
function toggleLockRabAsli_(rabId, newStatus) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_RAB');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(rabId).trim()) {
        // Tulis status ke Kolom 16 (P)
        sheet.getRange(i + 1, 16).setValue(newStatus); 
        return { 
          status: 'success', 
          message: newStatus === 'LOCKED' ? 'RAB Terkunci! Data aman di database.' : 'Kunci Terbuka! RAB sekarang bisa diupdate.' 
        };
      }
    }
    return { status: 'error', message: 'RAB tidak ditemukan.' };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

/**
 * FUNGSI RATAKANAN V6.1: Update Realisasi Biaya Upah
 */
function updateUpahRabAsli_(rabId, upahData) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_RAB');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(rabId).trim()) {
        
        // Kolom L=12 (Jml Orang), M=13 (Jasa Harian), N=14 (Transport), O=15 (Total Upah)
        // RATAKANAN: Kita bungkus pakai Number() agar murni jadi Angka/Rupiah di Database
        sheet.getRange(i + 1, 12).setValue(Number(upahData.jml_orang) || 0);
        sheet.getRange(i + 1, 13).setValue(Number(upahData.jasa_harian) || 0);
        sheet.getRange(i + 1, 14).setValue(Number(upahData.transport) || 0);
        sheet.getRange(i + 1, 15).setValue(Number(upahData.total_upah) || 0);
        
        return { status: 'success', message: 'Biaya jasa tenaga kerja berhasil dikunci di server.' };
      }
    }
    return { status: 'error', message: 'RAB tidak ditemukan.' };
  } catch (e) { 
    return { status: 'error', message: e.toString() }; 
  }
}

/**
 * ============================================================================
 * FUNGSI RATAKANAN V7.8: CRUD SPK KONTRAK (FIXED URUTAN KOLOM)
 * ============================================================================
 */

function saveSpkToSheetCore_(spkData) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_SPK');
    if (!String(spkData.ID_SPK || '').trim()) return { status: 'error', message: 'ID SPK tidak boleh kosong.' };
    if (idAda_(sheet, 1, spkData.ID_SPK)) return { status: 'error', message: 'ID SPK "' + spkData.ID_SPK + '" sudah dipakai. Gunakan ID lain supaya dokumen tidak tercampur.' };
    // SUSUNAN 9 KOLOM (Langsung tembak sesuai nama Schema resmi)
    sheet.appendRow([
      spkData.ID_SPK,           // 1. A
      spkData.Nama_SPK,         // 2. B
      spkData.Nama_Vendor,      // 3. C
      Number(spkData.Nominal_Total) || 0,     // 4. D
      Number(spkData.Nominal_Terpakai) || 0,  // 5. E
      spkData.Status || 'In Progress',        // 6. F
      spkData.Tgl_Terbit,       // 7. G
      spkData.Tgl_Berakhir,     // 8. H
      spkData.ULP_Wilayah,      // 9. I
      spkData.Pos_Anggaran      //10. J
    ]);
    
    return { status: 'success', message: 'Wadah SPK ' + spkData.ID_SPK + ' berhasil dibuat!' };
  } catch (error) { 
    return { status: 'error', message: error.toString() }; 
  }
}

function updateSpkInSheetAsli_(spkData) {
  try {
    // Sesuaikan nama sheet-nya dengan nama sheet SPK Bos
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_SPK');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      // 🔥 MENGGUNAKAN ID_SPK (Sesuai dengan yang dikirim dari React)
      if (String(data[i][0]).trim() === String(spkData.ID_SPK).trim()) {
        
        const row = i + 1;
        
        // SINKRONISASI KOLOM 100% SAMA DENGAN APPENDROW (A-J)
        sheet.getRange(row, 2).setValue(spkData.Nama_SPK);           // B (2) = Nama SPK
        sheet.getRange(row, 3).setValue(spkData.Nama_Vendor);        // C (3) = Vendor
        sheet.getRange(row, 4).setValue(Number(spkData.Nominal_Total)); // D (4) = Nominal Total
        
        // Catatan: Kolom 5 (E) adalah Nominal Terpakai. Biasanya tidak di-set ulang 
        // saat edit SPK agar perhitungan kapasitas tidak reset jadi 0.
        
        sheet.getRange(row, 6).setValue(spkData.Status);             // F (6) = Status
        sheet.getRange(row, 7).setValue(spkData.Tgl_Terbit);         // G (7) = Tgl Terbit
        sheet.getRange(row, 8).setValue(spkData.Tgl_Berakhir);       // H (8) = Tgl Exp
        sheet.getRange(row, 9).setValue(spkData.ULP_Wilayah);        // I (9) = ULP Wilayah
        
        // 🔥 DAN INI DIA BINTANG UTAMANYA!
        sheet.getRange(row, 10).setValue(spkData.Pos_Anggaran);      // J (10) = Pos Anggaran (Code SPK)
        
        return { status: 'success', message: 'SPK ' + spkData.ID_SPK + ' berhasil diperbarui!' };
      }
    }
    return { status: 'error', message: 'ID SPK tidak ditemukan di database.' };
  } catch (e) { 
    return { status: 'error', message: e.toString() }; 
  }
}

function deleteSpkFromSheetAsli_(spkId) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_SPK');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(spkId).trim()) {
        sheet.deleteRow(i + 1);
        return { status: 'success', message: 'Wadah SPK ' + spkId + ' dihapus permanen.' };
      }
    }
    return { status: 'error', message: 'ID tidak ditemukan.' };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}


// 2. Fungsi untuk Mengambil (Membaca) Data SPK untuk ditampilkan ke Tabel
function getSpkDataTakTerpakai_() {   // dulu publik tanpa cek login; tidak dipakai layar, jadi dijadikan privat
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Data_SPK');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Abaikan baris judul

    const spks = [];
    
    // Looping tarik data dari rak (Mulai dari baris ke-2 / index 1)
    for (let i = 1; i < data.length; i++) {
      spks.push({
        // KUNCI: NOMOR INDEX INI JANGAN SAMPAI TERTUKAR LAGI BOS!
        ID_SPK: data[i][0] || '-',                       // Kolom A (0)
        Nama_SPK: data[i][1] || '-',                     // Kolom B (1)
        Nama_Vendor: data[i][2] || '-',                  // Kolom C (2) -> Harusnya ambil 'kertas'
        Nominal_Total: Number(data[i][3]) || 0,          // Kolom D (3)
        Nominal_Terpakai: Number(data[i][4]) || 0,       // Kolom E (4)
        Status: data[i][5] || 'Aktif',                   // Kolom F (5)
        Tgl_Terbit: data[i][6] || '-',                   // Kolom G (6)
        Tgl_Berakhir: data[i][7] || '-',                 // Kolom H (7)
        ULP_Wilayah: data[i][8] || 'ULP BELUM DIATUR'    // Kolom I (8) -> Harusnya ambil 'ULP Denpasar'
      });
    }
    
    return spks.reverse(); 
  } catch (error) {
    return []; 
  }
}

/**
 * FUNGSI REVERSE PK (Mengeluarkan PK dari Wadah SPK)
 */
function removePkFromSpkAsli_(pkId, spkId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 1. Kosongkan SPK_ID di Data_PK (Kembalikan ke antrean)
    const sheetPk = ss.getSheetByName('Data_PK');
    const dataPk = sheetPk.getDataRange().getValues();
    let nominalPk = 0;
    
    for (let i = 1; i < dataPk.length; i++) {
      if (String(dataPk[i][0]).trim() === String(pkId).trim()) { // Index 0 adalah ID_PK
        nominalPk = Number(dataPk[i][7]) || 0; // Ambil nominal (Kolom H / index 7)
        sheetPk.getRange(i + 1, 2).setValue(""); // Kosongkan ID_SPK (Kolom B / index 1)
        break;
      }
    }
    
    // 2. Kurangi Nominal_Terpakai di Data_SPK (Kembalikan kapasitas)
    if (nominalPk > 0) {
      const sheetSpk = ss.getSheetByName('Data_SPK');
      const dataSpk = sheetSpk.getDataRange().getValues();
      
      for (let j = 1; j < dataSpk.length; j++) {
        if (String(dataSpk[j][0]).trim() === String(spkId).trim()) { // Index 0 adalah ID_SPK
          let currentTerpakai = Number(dataSpk[j][4]) || 0; // Kolom E / index 4
          let newTerpakai = Math.max(0, currentTerpakai - nominalPk);
          sheetSpk.getRange(j + 1, 5).setValue(newTerpakai);
          break;
        }
      }
    }
    
    return { status: 'success', message: `PK ${pkId} berhasil dikembalikan ke antrean.` };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

/**
 * ============================================================================
 * FUNGSI ALOKASI PK KE WADAH SPK (DARI ANTREAN)
 * ============================================================================
 */
function allocatePkToSpkAsli_(pkId, spkId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. Tulis nama SPK di data PK & Ambil Nominalnya
    const sheetPk = ss.getSheetByName('Data_PK');
    const dataPk = sheetPk.getDataRange().getValues();
    let nominalPk = 0;
    let pkFound = false;

    for (let i = 1; i < dataPk.length; i++) {
      if (String(dataPk[i][0]).trim() === String(pkId).trim()) { // Index 0 adalah Kolom A (ID_PK)
        nominalPk = Number(dataPk[i][7]) || 0; // Index 7 adalah Kolom H (Nominal)
        sheetPk.getRange(i + 1, 2).setValue(spkId); // Tulis SPK_ID ke Kolom B
        pkFound = true;
        break;
      }
    }

    if (!pkFound) {
      return { status: 'error', message: 'Data PK tidak ditemukan di database.' };
    }

    // 2. Tambahkan Nominal_Terpakai di Wadah SPK
    if (nominalPk > 0) {
      const sheetSpk = ss.getSheetByName('Data_SPK');
      const dataSpk = sheetSpk.getDataRange().getValues();

      for (let j = 1; j < dataSpk.length; j++) {
        if (String(dataSpk[j][0]).trim() === String(spkId).trim()) { // Index 0 adalah Kolom A (ID_SPK)
          let currentTerpakai = Number(dataSpk[j][4]) || 0; // Index 4 adalah Kolom E (Terpakai)
          sheetSpk.getRange(j + 1, 5).setValue(currentTerpakai + nominalPk);
          break;
        }
      }
    }

    return { status: 'success', message: `PK ${pkId} berhasil masuk ke wadah ${spkId}.` };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

// 🔥 MESIN BACKEND UNTUK MEMINDAHKAN LH KE PK BARU
function moveLhsToNewPkAsli_(lhIds, newPkId) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // ⚠️ SESUAIKAN NAMA SHEET DI BAWAH INI DENGAN NAMA SHEET DATABASE LH BOS
    // (Misal: "Data_LH", "Database LH", atau "LH")
    var sheetLh = ss.getSheetByName("Data_LH"); 
    
    if (!sheetLh) {
      return { status: 'error', message: 'Data LH tidak ditemukan di database!' };
    }

    var data = sheetLh.getDataRange().getValues();
    var barisDiubah = 0;

    // Looping mencari LH yang mau dipindah (Mulai dari 1 karena baris 0 biasanya Header)
    for (var i = 1; i < data.length; i++) {
      
      // ⚠️ SESUAIKAN INDEX KOLOM DI BAWAH INI:
      // data[i][0] artinya membaca Kolom A. (0=A, 1=B, 2=C, dst)
      var idLhDiDatabase = data[i][0]; // Asumsi ID LH ada di Kolom A
      
      // Jika ID LH di baris ini termasuk dalam daftar yang dicentang Bos
      if (lhIds.indexOf(idLhDiDatabase) !== -1) {
        
        // ⚠️ SESUAIKAN KOLOM PK_ID DI BAWAH INI:
        // getRange(baris, kolom). Kolom 1=A, 2=B, 3=C, dst.
        // Asumsi ID PK tersimpan di Kolom B, maka tulis angka 2.
        sheetLh.getRange(i + 1, 2).setValue(newPkId); 
        
        barisDiubah++;
      }
    }

    if (barisDiubah > 0) {
      return { status: 'success', message: 'Berhasil memindahkan ' + barisDiubah + ' LH ke PK baru di Database!' };
    } else {
      return { status: 'error', message: 'Data LH tidak ditemukan di database.' };
    }

  } catch (error) {
    return { status: 'error', message: 'Gagal memindahkan LH: ' + error.toString() };
  }
}

/**
 * FUNGSI UPDATE STATUS CETAK PK (DARI "BELUM" JADI "SUDAH")
 * Dipanggil oleh tombol "Cetak Lampiran PLN" di aplikasi React
 */
function updateStatusCetakPKAsli_(pkIdsArray) {
  try {
    // 1. Buka Sheet Data_PK
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Data_PK");
    
    if (!sheet) {
      throw new Error("Gagal: Data PK tidak ditemukan!");
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // 2. Cari Lokasi Kolom ID PK (Bisa ID_PK atau ID)
    const idColIndex = headers.findIndex(h => {
      const head = String(h).trim().toLowerCase();
      return head === 'id_pk' || head === 'id';
    });

    if (idColIndex === -1) {
      throw new Error("Gagal: Kolom ID_PK tidak ditemukan di database.");
    }

    // 3. Cari Lokasi Kolom Status_Cetak (Kalau belum ada, otomatis dibuatkan)
    let statusColIndex = headers.findIndex(h => String(h).trim().toLowerCase() === 'status_cetak');
    
    if (statusColIndex === -1) {
      // Buat kolom baru di paling ujung kanan
      statusColIndex = headers.length;
      sheet.getRange(1, statusColIndex + 1).setValue("Status_Cetak");
      // Beri style bold pada header baru
      sheet.getRange(1, statusColIndex + 1).setFontWeight("bold");
    }

    // 4. Proses Stempel "Sudah"
    let totalUpdated = 0;
    
    // Looping mulai dari baris kedua (index 1) karena baris pertama adalah header
    for (let i = 1; i < data.length; i++) {
      const rowId = String(data[i][idColIndex]).trim();
      
      // Jika ID di baris ini termasuk dalam daftar PK yang sedang dicetak
      if (pkIdsArray.includes(rowId)) {
        // i + 1 karena index array mulai dari 0 sedangkan baris sheet mulai dari 1
        // statusColIndex + 1 karena index array mulai dari 0 sedangkan kolom sheet mulai dari 1
        sheet.getRange(i + 1, statusColIndex + 1).setValue("Sudah");
        totalUpdated++;
      }
    }

    // Kembalikan laporan sukses ke React
    return { 
      status: "success", 
      message: "Berhasil update " + totalUpdated + " status PK menjadi 'Sudah'." 
    };

  } catch (error) {
    // Jika ada error, kirim pesan errornya ke React
    return { 
      status: "error", 
      message: error.toString() 
    };
  }
}

/**
 * FUNGSI MENYIMPAN CATATAN AUDIT KE DALAM DATA LH
 */
// DINONAKTIFKAN (privat): versi lama tanpa cek login, tanpa kunci, tanpa verifikasi. Gunakan auditSimpanTemuan (Audit.js).
function updateAuditNoteDbLama_(lhId, noteText) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Data_LH");
    if (!sheet) throw new Error("Gagal: Data LH tidak ditemukan!");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Cari kolom ID LH
    const idColIndex = headers.findIndex(h => String(h).trim().toLowerCase() === 'id_lh' || String(h).trim().toLowerCase() === 'id');
    if (idColIndex === -1) throw new Error("Kolom ID LH tidak ditemukan.");

    // Cari/Buat kolom Audit_Note
    let noteColIndex = headers.findIndex(h => String(h).trim().toLowerCase() === 'audit_note');
    if (noteColIndex === -1) {
      noteColIndex = headers.length;
      sheet.getRange(1, noteColIndex + 1).setValue("Audit_Note");
    }

    // Cari baris yang cocok dan timpa catatannya
    let isFound = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]).trim() === String(lhId).trim()) {
        
        // ========================================================
        // 🔥 LOGIKA PINTAR: CEK APAKAH AUDITOR MENGHAPUS CATATAN?
        // ========================================================
        if (!noteText || String(noteText).trim() === "") {
            // Kalau catatannya kosong, kita bersihkan sel-nya sampai akar
            sheet.getRange(i + 1, noteColIndex + 1).clearContent();
        } else {
            // Kalau ada isinya, kita tulis catatannya. Temuan baru berarti LH belum beres: tanda "sudah diaudit" dicabut.
            sheet.getRange(i + 1, noteColIndex + 1).setValue(noteText);
            auditClearMark_(sheet, headers, i + 1);
        }
        
        isFound = true;
        break; // Stop loop kalau sudah ketemu
      }
    }

    if (!isFound) throw new Error("LH dengan ID " + lhId + " tidak ditemukan di database.");

    return { status: "success", message: "Catatan audit berhasil diperbarui/dihapus." };
  } catch (error) {
    return { status: "error", message: error.toString() };
  }
}
