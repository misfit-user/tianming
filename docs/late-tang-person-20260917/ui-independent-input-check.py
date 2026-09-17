# Reference uses each full evidence quote; H013 separate pre-840 display excerpt is not concatenated.
from pathlib import Path
import json,hashlib
w=Path(__file__).parent
books=json.loads((w/'books.json').read_bytes())
rows=[json.loads(line) for p in sorted(w.glob('history-*.ndjson')) for line in p.read_text(encoding='utf-8').splitlines() if line.strip()]
checksum=lambda obj:hashlib.sha256(json.dumps(obj,ensure_ascii=True,sort_keys=True,separators=(',',':')).encode()).hexdigest()
canonical=[]
for index,cid,name,fields,quotes,notes in rows:
    canonical.append([index,cid,name,fields,[[books[b][1],q] for b,q in quotes if q]])
groups=json.loads((w/'skills-groups.json').read_bytes())
f=sorted([[i,g['skills']] for g in groups for i in g['indexes']])
report={'historicalCount':len(rows),'historicalChecksum':checksum(canonical),'historicalExpected':'31c180f6cb194bdb2576433d8fe066365e43143ec64f16a721380e36bd500cca','fictionalCount':len(f),'fictionalChecksum':checksum(f),'fictionalExpected':'b5e04868ca0155bb014d92bc734188b5d702c1bb3fbf1699762e1717c438815d'}
report['ok']=report['historicalChecksum']==report['historicalExpected'] and report['fictionalChecksum']==report['fictionalExpected'] and len(rows)==81 and len(f)==353
(w/'ui-independent-input-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
if not report['ok']:
    print('ROW_HASHES',json.dumps([[r[0],checksum(r)] for r in canonical],separators=(',',':')))
    raise SystemExit(1)
print('PASS data fields and original quotations match the mounted execution MD')
