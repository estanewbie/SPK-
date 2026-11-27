import json, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L
pk=json.load(open('pk.json'))
NAVY='0F2E66'; TINT='E7EDF8'; GREY='FAF9F5'
wb=openpyxl.Workbook()
ws=wb.active; ws.title='Lampiran KTK'
hdr=Font(bold=True,color='FFFFFF',name='Calibri',size=10)
fillN=PatternFill('solid',fgColor=NAVY); fillT=PatternFill('solid',fgColor=TINT); fillG=PatternFill('solid',fgColor=GREY)
thin=Side(style='thin',color='D9D6CC'); box=Border(top=thin,bottom=thin,left=thin,right=thin)
money='#,##0;[Red]-#,##0'; qty='#,##0.##'
ws['A1']='PT PLN (PERSERO) UNIT INDUK DISTRIBUSI BALI'; ws['A2']='UNIT PELAKSANA PELAYANAN PELANGGAN BALI SELATAN'; ws['A4']='LAMPIRAN KERJA TAMBAH KURANG (KTK 71)'
for r,(k,val) in enumerate([('Pekerjaan','Rehabilitasi Jaringan Distribusi Paket 17'),('Lokasi','Wilayah Kerja PT PLN (Persero) UP3 Bali Selatan'),('Vendor','PT. Nanda Nirwana Elektrik'),('Kontrak Rinci No.','0597.SPK/DAN.01.03/F05030000/2025'),('Jenis pekerjaan','71')],start=5):
    ws.cell(r,2,k); ws.cell(r,3,':'); ws.cell(r,4,val)
ws['A1'].font=Font(bold=True,size=12); ws['A4'].font=Font(bold=True,size=12)
# column headings rows 10-11
top=['NO','URAIAN','SAT','VOL','HARGA SATUAN','','NILAI AWAL','','','REALISASI','KERJA (+)','KERJA (-)','NILAI AKHIR','','','KODE']
sub=['','','','','MATERIAL','JASA','MATERIAL','JASA','JUMLAH','(dari Data LH)','','','MATERIAL','JASA','JUMLAH','']
for c,(a,b) in enumerate(zip(top,sub),start=1):
    for rr,val in ((10,a),(11,b)):
        cell=ws.cell(rr,c,val); cell.font=hdr; cell.fill=fillN; cell.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True)
ws.freeze_panes='C12'
r=12; jrows=[]; itemrows=[]; codes={}
for pi,(name,items) in enumerate(pk,start=1):
    ws.cell(r,1,name).font=Font(bold=True,color=NAVY)
    for c in range(1,17): ws.cell(r,c).fill=fillT
    r+=1; first=r
    for it in items:
        if it[0]=='sub':
            ws.cell(r,2,it[1]).font=Font(bold=True,italic=True); r+=1; continue
        _,no,nm,sat,vol,e,f,orow=it
        code=f'P{pi:02d}-{orow:03d}'; codes[(pi,orow)]=code
        ws.cell(r,1,no); ws.cell(r,2,nm); ws.cell(r,3,sat); ws.cell(r,4,vol); ws.cell(r,5,e); ws.cell(r,6,f)
        ws.cell(r,7,f'=D{r}*E{r}'); ws.cell(r,8,f'=D{r}*F{r}'); ws.cell(r,9,f'=G{r}+H{r}')
        ws.cell(r,10,f"=ROUND(SUMIFS('Data LH'!$E:$E,'Data LH'!$D:$D,$P{r}),6)")
        ws.cell(r,11,f'=MAX(J{r}-D{r},0)'); ws.cell(r,12,f'=MAX(D{r}-J{r},0)')
        ws.cell(r,13,f'=J{r}*E{r}'); ws.cell(r,14,f'=J{r}*F{r}'); ws.cell(r,15,f'=M{r}+N{r}'); ws.cell(r,16,code)
        itemrows.append(r); r+=1
    last=r-1
    ws.cell(r,2,'JUMLAH').font=Font(bold=True)
    for col in (7,8,9,13,14,15):
        c=L(col); ws.cell(r,col,f'=SUM({c}{first}:{c}{last})').font=Font(bold=True)
    for c in range(1,17): ws.cell(r,c).fill=fillG
    jrows.append(r); r+=2
# totals
r+=0
tot=r
def refs(col): return '+'.join(f'{col}{j}' for j in jrows)
ws.cell(r,2,'JUMLAH SEMUA PAKET').font=Font(bold=True)
for col in (7,8,9,13,14,15):
    c=L(col); ws.cell(r,col,f'={refs(c)}').font=Font(bold=True)
dpp=r+1; ppn=r+2; gross=r+3; rnd=r+4
ws.cell(dpp,2,'DPP LAIN (x 11/12)'); ws.cell(ppn,2,'PPN 12% (dari DPP Lain)'); ws.cell(gross,2,'JUMLAH + PPN'); ws.cell(rnd,2,'DIBULATKAN')
for col in (7,8,9,13,14,15):
    c=L(col)
    ws.cell(dpp,col,f'={c}{tot}*11/12'); ws.cell(ppn,col,f'={c}{dpp}*12%'); ws.cell(gross,col,f'={c}{tot}+{c}{ppn}'); ws.cell(rnd,col,f'=ROUND({c}{gross},0)')
ws.cell(rnd,2).font=Font(bold=True)
ws.cell(rnd+2,5,'TOTAL NILAI KONTRAK AWAL').font=Font(bold=True); ws.cell(rnd+2,9,f'=I{rnd}').font=Font(bold=True)
ws.cell(rnd+2,11,'TOTAL NILAI AMANDEMEN (realisasi LH)').font=Font(bold=True); ws.cell(rnd+2,15,f'=O{rnd}').font=Font(bold=True)
for rr in range(12,rnd+3):
    for col in range(1,17):
        cell=ws.cell(rr,col)
        if col in (5,6,7,8,9,13,14,15): cell.number_format=money
        if col in (4,10,11,12): cell.number_format=qty
for col,w in zip('ABCDEFGHIJKLMNOP',(6,62,7,9,15,13,16,14,16,12,10,10,16,14,16,11)): ws.column_dimensions[col].width=w
# Data LH
dl=wb.create_sheet('Data LH')
for c,t in enumerate(['No. LH','PK / Lokasi','Tanggal','Kode item kontrak','Volume','Uraian (di LH)','Ada di kontrak?'],start=1):
    cell=dl.cell(1,c,t); cell.font=hdr; cell.fill=fillN
K=lambda orow: codes[(1,orow)]
lines=[(20,[('P. KERAMBITAN - CURAH',1)]),(21,[('KA0427 - CANGGU',1),('KA1153 - BUMBAK',1)]),(25,[('P. KERAMBITAN - CURAH',1)]),(26,[('KA1153 - BUMBAK',1)]),
 (28,[('KA0427 - CANGGU',32),('KA1153 - BUMBAK',10),('P. NYANYI - BERABAN',10),('P. NYITDAH - KEDUNGU',10),('P. BATURITI - LUWUS',10)]),
 (29,[('KA0788 - BRAWA',30),('KA1153 - BUMBAK',30),('P. NYANYI - BERABAN',20),('P. NYITDAH - KEDUNGU',20)]),
 (30,[('P. KERAMBITAN - CURAH',3),('KA1153 - BUMBAK',2),('P. BATURITI - LUWUS',1)]),(31,[('KA0427 - CANGGU',3),('P. NYITDAH - KEDUNGU',1)]),
 (32,[('KA0427 - CANGGU',3),('KA1153 - BUMBAK',2),('P. BATURITI - LUWUS',1)]),(33,[('KA0427 - CANGGU',3),('KA1153 - BUMBAK',2),('P. NYITDAH - KEDUNGU',2),('P. BATURITI - LUWUS',1)]),
 (34,[('KA0788 - BRAWA',3),('KA1153 - BUMBAK',2),('P. BATURITI - LUWUS',1)]),(38,[('KA0788 - BRAWA',0.5),('KA0788 - BRAWA',0.25),('KA0788 - BRAWA',0.25)])]
names={}
for it in pk[0][1]:
    if it[0]=='item': names[it[7]]=it[2]
n=1; row=2
import datetime
for orow,ls in lines:
    for (p,q) in ls:
        dl.cell(row,1,f'LH-{500+n:04d}'); dl.cell(row,2,p); dl.cell(row,3,datetime.date(2026,9,1)+datetime.timedelta(days=n)); dl.cell(row,4,K(orow)); dl.cell(row,5,q); dl.cell(row,6,names[orow])
        dl.cell(row,7,f"=IF(COUNTIF('Lampiran KTK'!$P:$P,D{row})>0,\"Ya\",\"TIDAK ADA DI KONTRAK\")"); dl.cell(row,3).number_format='dd/mm/yyyy'; n+=1; row+=1
dl.cell(row,1,f'LH-{500+n:04d}'); dl.cell(row,2,'KA0427 - CANGGU'); dl.cell(row,3,datetime.date(2026,9,17)); dl.cell(row,3).number_format='dd/mm/yyyy'; dl.cell(row,4,'X-001'); dl.cell(row,5,8); dl.cell(row,6,'Sepatu kabel AL/CU 70mm2')
dl.cell(row,7,f"=IF(COUNTIF('Lampiran KTK'!$P:$P,D{row})>0,\"Ya\",\"TIDAK ADA DI KONTRAK\")")
lastlh=row
for col,w in zip('ABCDEFG',(11,28,12,17,10,62,24)): dl.column_dimensions[col].width=w
dl.freeze_panes='A2'
# Cek hitungan
ck=wb.create_sheet('Cek hitungan')
for c,t in enumerate(['Pemeriksaan','Nilai di aplikasi','Nilai di Excel (rumus)','Selisih','Status'],start=1):
    cell=ck.cell(1,c,t); cell.font=hdr; cell.fill=fillN
LK="'Lampiran KTK'!"
orig=dict(M=67895763.25901598,J=158405451.77312282)
app_mat=orig['M']; app_jas=orig['J']; app_jum=app_mat+app_jas; app_dpp=app_jum*11/12; app_ppn=app_dpp*0.12; app_gross=app_jum+app_ppn
# akhir (aplikasi): hitung dari data mock
items1={it[7]:it for it in pk[0][1] if it[0]=='item'}
real={20:1,21:2,25:1,26:1,28:72,29:100,30:6,31:4,32:6,33:8,34:6,38:1}
bm=sum(real[o]*items1[o][5] for o in real); bj=sum(real[o]*items1[o][6] for o in real)
akhir=round((bm+bj)+(bm+bj)*11/12*0.12)
rows=[
 ('Jumlah material (seluruh kontrak)',app_mat,f'={LK}G{tot}'),
 ('Jumlah jasa (seluruh kontrak)',app_jas,f'={LK}H{tot}'),
 ('Jumlah material + jasa',app_jum,f'={LK}I{tot}'),
 ('DPP Lain (x 11/12)',app_dpp,f'={LK}I{dpp}'),
 ('PPN 12% dari DPP Lain',app_ppn,f'={LK}I{ppn}'),
 ('Jumlah + PPN',app_gross,f'={LK}I{gross}'),
 ('TOTAL NILAI KONTRAK AWAL (dibulatkan)',251194349,f'={LK}I{rnd}'),
 ('TOTAL NILAI AMANDEMEN / realisasi LH (dibulatkan)',akhir,f'={LK}O{rnd}'),
]
ri=2
for lab,app,fm in rows:
    ck.cell(ri,1,lab); ck.cell(ri,2,app); ck.cell(ri,3,fm); ck.cell(ri,4,f'=ROUND(C{ri}-B{ri},2)'); ck.cell(ri,5,f'=IF(ABS(D{ri})<0.5,"COCOK","BEDA - PERIKSA")'); ri+=1
# kontrol silang
first_item=min(itemrows); last_item=max(itemrows)
ck.cell(ri,1,'Kontrol silang nilai awal: SUMPRODUCT(Vol x Harga) vs jumlah semua paket'); ck.cell(ri,2,f'=SUMPRODUCT({LK}D{first_item}:D{last_item},{LK}E{first_item}:E{last_item}+{LK}F{first_item}:F{last_item})'); ck.cell(ri,3,f'={LK}I{tot}'); ck.cell(ri,4,f'=ROUND(C{ri}-B{ri},2)'); ck.cell(ri,5,f'=IF(ABS(D{ri})<0.5,"COCOK","BEDA - PERIKSA")'); ri+=1
ck.cell(ri,1,'Kontrol silang nilai akhir: SUMPRODUCT(Realisasi x Harga) vs jumlah semua paket'); ck.cell(ri,2,f'=SUMPRODUCT({LK}J{first_item}:J{last_item},{LK}E{first_item}:E{last_item}+{LK}F{first_item}:F{last_item})'); ck.cell(ri,3,f'={LK}O{tot}'); ck.cell(ri,4,f'=ROUND(C{ri}-B{ri},2)'); ck.cell(ri,5,f'=IF(ABS(D{ri})<0.5,"COCOK","BEDA - PERIKSA")'); ri+=1
ck.cell(ri,1,'Baris LH yang kodenya tidak ada di kontrak (harus 0)'); ck.cell(ri,2,0); ck.cell(ri,3,f"=COUNTIF('Data LH'!G2:G{lastlh},\"TIDAK*\")"); ck.cell(ri,4,f'=C{ri}-B{ri}'); ck.cell(ri,5,f'=IF(D{ri}=0,"COCOK","PERIKSA: "&C{ri}&" baris LH di luar kontrak")'); ri+=1
ck.cell(ri,1,'Volume LH yang masuk ke kontrak = jumlah volume di Data LH (tanpa yang di luar kontrak)'); ck.cell(ri,2,f"=SUMIFS('Data LH'!E2:E{lastlh},'Data LH'!G2:G{lastlh},\"Ya\")"); ck.cell(ri,3,f'=SUM({LK}J{first_item}:J{last_item})'); ck.cell(ri,4,f'=ROUND(C{ri}-B{ri},4)'); ck.cell(ri,5,f'=IF(ABS(D{ri})<0.001,"COCOK","BEDA - PERIKSA")'); ri+=1
for rr in range(2,ri):
    for c in (2,3,4): ck.cell(rr,c).number_format='#,##0.00'
ck.cell(ri+1,1,'Semua angka di Lampiran KTK memakai rumus. Jumlah per paket = SUM tepat pada baris item paket itu; total seluruh paket menjumlahkan sel JUMLAH tiap paket. Kolom "Nilai di aplikasi" adalah angka yang tampil di aplikasi saat export.')
ck.column_dimensions['A'].width=88
for c in 'BCD': ck.column_dimensions[c].width=22
ck.column_dimensions['E'].width=36
wb.save('KTK_71_0597_contoh_export.xlsx')
print('saved; item rows',len(itemrows),'tot row',tot,'rnd',rnd)
