import openpyxl, json
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L
SRC='/root/.claude/uploads/7435b1aa-c280-5444-b9f2-8e055297190d/d1b9c24b-NANDA_KTK_SPK_0597_fix.xlsx'
ws=openpyxl.load_workbook(SRC,data_only=True)['KTK']
v=lambda r,c: ws.cell(r,c).value
# groups
heads=[(14,'a'),(66,'a'),(90,'a'),(111,'b'),(130,'b'),(156,'b'),(218,'b'),(258,'b'),(328,'b'),(379,'b'),(389,'b'),(400,'b'),(408,'b'),(414,'b'),(420,'b'),(426,'b'),(432,'b'),(444,'b'),(456,'b'),(466,'b'),(475,'b'),(480,'b'),(485,'b'),(490,'b'),(495,'b')]
jum=[65,89,110,129,155,217,257,327,378,388,399,407,413,419,425,431,443,455,465,474,479,484,489,494,499]
pk=[]
for (h,_),j in zip(heads,jum):
    name=(v(h,1) if isinstance(v(h,1),str) and not v(h,2) else v(h,2) or v(h,1)).strip()
    items=[];sub=None
    for r in range(h+1,j):
        a,b,c=v(r,1),v(r,2),v(r,3)
        if c is None and (a is not None or b is not None):
            if isinstance(b,str): items.append(('sub',b.strip()))
            continue
        if c is None: continue
        e,f,d=v(r,5),v(r,6),v(r,4)
        if not (d or isinstance(e,(int,float)) or isinstance(f,(int,float))): continue
        items.append(('item',a if isinstance(a,int) else None,str(b).strip(),str(c).strip(),d or 0,e or 0,f or 0,r))
    pk.append((name,items))
print(len(pk),[sum(1 for i in p[1] if i[0]=='item') for p in pk])
json.dump(pk,open('pk.json','w'))
