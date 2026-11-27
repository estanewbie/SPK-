import json, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L
pk=json.load(open('pk.json'))
SRC='/root/.claude/uploads/7435b1aa-c280-5444-b9f2-8e055297190d/d1b9c24b-NANDA_KTK_SPK_0597_fix.xlsx'
orig=openpyxl.load_workbook(SRC,data_only=True)['KTK']
jum=[65,89,110,129,155,217,257,327,378,388,399,407,413,419,425,431,443,455,465,474,479,484,489,494,499]
# verify extraction vs original package totals
for (name,items),j in zip(pk,jum):
    m=sum(i[4]*i[5] for i in items if i[0]=='item'); s=sum(i[4]*i[6] for i in items if i[0]=='item')
    om,os_=orig.cell(j,7).value or 0, orig.cell(j,8).value or 0
    flag='' if abs(m-om)<1 and abs(s-os_)<1 else '  <<< BEDA dengan Excel asli: asli M=%.0f J=%.0f'%(om,os_)
    print(name[:50].ljust(52), round(m), round(s), flag)
