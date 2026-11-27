const fs=require('fs');
const p=JSON.parse(fs.readFileSync('data/ktk62_seed.json','utf8'));
const conv=a=>a.map(it=>it[0]==='#'?it:[it[0],it[1],0,Number(it[3]),Number(it[4])]);
const data=p.map(x=>[x.nama,conv(x.items)]);
const head=`/**
 * KtkSeed62.js - Data awal paket template KTK jenis 62 (dari KTK 62.pdf, 7 paket). Dihasilkan oleh tools/ktk62/build.js.
 * Format sama dengan KtkSeed.js: [namaPaket, [ [nama, sat, volume, hargaMaterial, hargaJasa] | ['#', namaSubJudul] ]]
 * Volume 0 (template). Nama material ditulis apa adanya seperti di PDF; nama yang belum ada di database tampil bertanda di editor KTK.
 */
function ktkSeed62_() {
  return `;
fs.writeFileSync('gas/KtkSeed62.js',head+JSON.stringify(data)+';\n}\n');
console.log(data.length,data.reduce((a,x)=>a+x[1].filter(i=>i[0]!=='#').length,0));
