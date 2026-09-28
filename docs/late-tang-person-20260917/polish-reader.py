from pathlib import Path
import hashlib,json
w=Path(__file__).parent;r=w.parents[1];p=r/'web/tm-renwu-tuzhi.js';old=p.read_bytes();t=old.decode('utf-8')
a=t.index('var _zhiReferenceCache=');b=t.index('function _zhiOfficeTitles(c)');block=t[a:b]
block=block.replace('white-space:pre-wrap;overflow-wrap:anywhere;margin:9px 0','white-space:pre-wrap;overflow-wrap:anywhere;margin:9px 0;font-size:14px;line-height:1.95;color:var(--ink-soft)')
block=block.replace('<h4>','<h4 style="font-family:inherit;font-size:15px;line-height:1.7;margin:16px 0 8px">')
oldlink='style="overflow-wrap:anywhere">\'+esc(url)+\'</a>'
newlink='style="font-family:inherit;font-size:12px;color:var(--cinnabar-d)">查看原始出处 ↗</a>'
assert block.count(oldlink)==1;block=block.replace(oldlink,newlink)
t=t[:a]+block+t[b:]
line="  ms.innerHTML=dossierHead(p)+verdict(p)+zhubiBlock(p)+tabsHtml+'<div class=\"detail\">'+renderTab(p)+'</div>';"
assert t.count(line)==1
extra="\n  var selected=ms.querySelector('.tabs .tab.active'),strip=selected&&selected.parentElement;\n  if(strip&&typeof strip.getBoundingClientRect==='function'&&typeof selected.getBoundingClientRect==='function'){var tr=strip.getBoundingClientRect(),br=selected.getBoundingClientRect();if(br.right>tr.right)strip.scrollLeft+=br.right-tr.right+8;else if(br.left<tr.left)strip.scrollLeft-=tr.left-br.left+8;}"
if '\r\n' in t:extra=extra.replace('\n','\r\n')
t=t.replace(line,line+extra);new=t.encode('utf-8');assert p.read_bytes()==old
(w/'tuzhi-before-reader-polish.bin').write_bytes(old)
with p.open('r+b') as f:f.write(new);f.truncate()
assert p.read_bytes()==new
(w/'reader-polish-report.json').write_text(json.dumps({'path':'web/tm-renwu-tuzhi.js','before':hashlib.sha256(old).hexdigest(),'after':hashlib.sha256(new).hexdigest()},indent=2))
# Keep the review input in step with the installed reader.
(w/'source-reader-final.js.txt').write_text(block,encoding='utf-8')
print('Reader typography and active-tab visibility updated; unrelated styles unchanged.')
