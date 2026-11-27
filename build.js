const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..','..');
const txt=fs.readFileSync(path.join(root,'data','ktk62_paket.txt'),'utf8').split(/\r?\n/).filter(Boolean);
const num=s=>{s=(s||'').trim();if(!s)return null;return s.replace(/\./g,'').replace(',','.')};
const pak=[];let cur=null;
for(const l of txt){
  if(l.startsWith('## ')){cur={nama:l.slice(3).trim(),items:[]};pak.push(cur);}
  else if(l.startsWith('# ')){cur.items.push(['#',l.slice(2).trim()]);}
  else{const [n,s,m,j]=l.split('|');cur.items.push([n.trim(),(s||'').trim(),0,num(m)??'0',num(j)??'0']);}
}
fs.writeFileSync(path.join(root,'data','ktk62_seed.json'),JSON.stringify(pak));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const tok=s=>new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>1));
const master=JSON.parse(fs.readFileSync(path.join(root,'data','master_normalized.json'),'utf8'));
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'gas','KtkConvert.js'),'utf8').replace(/^const /gm,'var '),ctx);
const conv=ctx.ktkConvertSeed_();
const mset=new Map(master.map(x=>[norm(x),x]));
const cset=new Map();const cnames=[];
conv.forEach(r=>{r.forEach((x,i)=>{if(x){cset.set(norm(x),r[0]);}});cnames.push(r[0]);});
const all=[...new Set([...master,...cnames])];
const rows=[];let ok=0,cv=0,no=0;
pak.forEach(p=>p.items.forEach(it=>{if(it[0]==='#')return;
  const n=norm(it[0]);let st,ref='';
  if(mset.has(n)){st='Cocok Master_Data';ref=mset.get(n);ok++;}
  else if(cset.has(n)){st='Cocok Convert_material';ref=cset.get(n);cv++;}
  else{st='TIDAK DIKENAL';no++;const t=tok(it[0]);let b=0,bn='';for(const c of all){const u=tok(c);let i=0;t.forEach(x=>{if(u.has(x))i++});const sc=i/(t.size+u.size-i||1);if(sc>b){b=sc;bn=c}}ref=bn+(bn?' ('+Math.round(b*100)+'%)':'');}
  rows.push([p.nama,it[0],it[1],it[3],it[4],st,ref]);}));
console.log('paket',pak.length,'item',rows.length,'master',ok,'convert',cv,'tidak',no);
fs.writeFileSync(path.join(root,'data','ktk62_pencocokan.csv'),'\ufeff'+['Paket;Nama di PDF KTK 62;Sat;Harga Material;Harga Jasa;Status;Padanan terdekat'].concat(rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';'))).join('\r\n'));
const bad=rows.filter(r=>r[5]==='TIDAK DIKENAL');
const uniq=new Map();bad.forEach(r=>{if(!uniq.has(r[1]))uniq.set(r[1],r[6])});
console.log('unik tidak dikenal',uniq.size);
[...uniq].slice(0,200).forEach(([a,b])=>console.log(a,' => ',b));
pak.forEach(p=>console.log(p.nama,p.items.filter(i=>i[0]!=='#').length));
