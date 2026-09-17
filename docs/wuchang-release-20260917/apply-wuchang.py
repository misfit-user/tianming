from pathlib import Path
import json,hashlib,datetime,copy,os,sys
w=Path(__file__).parent;r=w.parents[1];p=r/'scenarios/晚唐·开成五年（官方）.json'
raw=p.read_bytes();before=json.loads(raw);s=copy.deepcopy(before);cs=s['characters']
profiles=json.loads((w/'profiles.json').read_bytes())
assert len(cs)==len(profiles)==434
for c,v in zip(cs,profiles):
 assert c['id']==v['id'] and c['name']==v['name']
 for k in ['personality','personalGoal','traits','traitIds','historicalFacts','bio']:
  assert c.get(k)==v.get(k),(c['name'],k,'changed since review')
keys=['仁','义','礼','智','信'];levels={'H':'较高','M':'中等','L':'低'}
hist=[json.loads(x) for x in (w/'historical-ratings.ndjson').read_text(encoding='utf-8').splitlines() if x.strip()]
assert len(hist)==len({x[0] for x in hist})==81
hist={name:(values,confidence.replace(' ',''),note) for name,values,confidence,note in hist}
fic=[]
for line in (w/'fictional-ratings.txt').read_text(encoding='utf-8').splitlines():
 if line.strip():
  i,name,vals=line.split('|');fic.append((int(i),name,[int(x) for x in vals.split(',')]))
fiction=[c for c in cs if not c['isHistorical']]
assert len(fic)==len(fiction)==353
for i,(n,name,vals) in enumerate(fic):assert i==n and name==fiction[i]['name']
fic={name:vals for _,name,vals in fic};oldref=json.loads((r/'web/assets/reference/tang840-characters.json').read_bytes())
archive={'schemaVersion':1,'scenarioId':s['id'],'asOf':'开成五年正月十四（剧本开局，非公历840-01-14）','kind':'editorial-game-assessment','notice':'分数是游戏化人物评定，不是史书的数字或对古人的测量；史料不足处依据既有人设并标低置信。后事不计入开局。','dimensions':{'仁':'体恤具体人的处境、节制伤害；不等于只护亲属。','义':'公平、责任与公私边界；不等于忠君或服从权势。','礼':'尊重、节制、程序与边界；不按门第、族属、性别或宗教打分。','智':'辨析、学习与现实判断；不等于善良，也不只看文才。','信':'真实表达、核实信息与履诺；不等于轻信或讨人信任。'},'confidenceLegend':{'H':'有较直接的已发生行迹，数值仍属编者判断。','M':'有相关证据，但从行为到维度有解释空间。','L':'独立证据少，主要依据现有人设或保守起点，可后续修订。','F':'虚构人物：依据已写性格、目标逐人评定，不援引古籍。'},'characters':{}}
extra={'崔珙':[('《旧唐书》卷177','舊唐書/卷177')],'仇士良':[('《资治通鉴》卷245','資治通鑑/卷245')],'鱼弘志':[('《资治通鉴》卷245','資治通鑑/卷245')],'李绅':[('《旧唐书》卷173','舊唐書/卷173')],'史元忠':[('《旧唐书》卷180','舊唐書/卷180')],'藤原绪嗣':[('《续日本后纪》卷13，传中前期事迹须与843当年事项区分','續日本後紀/卷第十三')]}
# This contemporary entry documents the 805 policy debate, without importing later events.
extra['藤原绪嗣'].append(('《日本后纪》卷13·延历二十四年十二月德政相论','日本後紀/卷第十三'))
for c in cs:
 assert not c.get('wuchangOverride') and not c.get('wuchang'),(c['name'],'already rated; review instead of overwrite')
 if c['isHistorical']:
  vals,conf,note=hist[c['name']];assert len(conf)==5 and set(conf)<=set(levels)
  refs=[]
  for q in oldref['characters'][c['id']].get('quotes',[]):
   item={'book':q['book'],'url':q['url']}
   if item not in refs:refs.append(item)
  for title,url in extra.get(c['name'],[]):
   item={'book':title,'url':'https://zh.wikisource.org/wiki/'+url}
   if item not in refs:refs.append(item)
  if not refs:refs=oldref['characters'][c['id']].get('references',[])
  kind='historical-inference'
 else:
  vals=fic[c['name']];conf='FFFFF';kind='fictional-authoring';refs=[]
  note='逐人阅读已写性格与目标后评定；不是按职业、族属、性别或姓名随机生成。性格：'+c.get('personality','')+' 目标：'+c.get('personalGoal','')
 assert len(vals)==5 and all(type(v)is int and 0<=v<=100 for v in vals)
 scores=dict(zip(keys,vals));c['wuchangOverride']=scores
 if c.get('wuchang')=={}:del c['wuchang']
 c['wuchangAssessment']={'version':1,'kind':kind,'confidence':dict(zip(keys,conf)),'reference':'assets/reference/tang840-wuchang.json','key':c['id']}
 archive['characters'][c['id']]={'name':c['name'],'kind':kind,'initialScores':scores,'confidence':dict(zip(keys,conf)),'note':note,'sources':refs}
for a,b in zip(before['characters'],cs):
 aa={k:v for k,v in a.items() if k not in ['wuchang','wuchangOverride','wuchangAssessment']};bb={k:v for k,v in b.items() if k not in ['wuchang','wuchangOverride','wuchangAssessment']}
 assert aa==bb,(b['name'],'unrelated mutation')
assert all(s[k]==before[k] for k in before if k!='characters')
text=raw.decode('utf-8');decoder=json.JSONDecoder();i=1;span=None
while i<len(text):
 while text[i].isspace() or text[i]==',':i+=1
 if text[i]=='}':break
 key,i=decoder.raw_decode(text,i)
 while text[i].isspace():i+=1
 assert text[i]==':';i+=1
 while text[i].isspace():i+=1
 start=i;value,i=decoder.raw_decode(text,i)
 if key=='characters':span=(start,i);break
assert span
new=(text[:span[0]]+json.dumps(cs,ensure_ascii=False,separators=(',',':'))+text[span[1]:]).encode('utf-8')
assert json.loads(new)==s
summary={'characters':434,'historical':81,'fictional':353,'scores':2170,'before':hashlib.sha256(raw).hexdigest(),'after':hashlib.sha256(new).hexdigest(),'inputSha256':{f:hashlib.sha256((w/f).read_bytes()).hexdigest() for f in ['historical-ratings.ndjson','fictional-ratings.txt']},'applied':False}
if '--apply' in sys.argv:
 backup=r/('.bak-wuchang-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));backup.mkdir()
 (backup/p.name).write_bytes(raw)
 asset=r/'web/assets/reference/tang840-wuchang.json';assert not asset.exists(),'Do not overwrite an existing assessment'
 assert p.read_bytes()==raw,'Concurrent source change; retry only after review'
 asset.parent.mkdir(parents=True,exist_ok=True);asset.write_text(json.dumps(archive,ensure_ascii=False,indent=2),encoding='utf-8')
 with p.open('r+b') as stream:stream.write(new);stream.truncate();stream.flush();os.fsync(stream.fileno())
 assert p.read_bytes()==new
 summary.update(applied=True,backup=str(backup))
(w/'wuchang-apply-report.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False),flush=True)
