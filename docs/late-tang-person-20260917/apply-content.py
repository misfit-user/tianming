from pathlib import Path
import json,hashlib,re,copy,os,sys
w=Path(__file__).parent;r=w.parents[1];target=r/'scenarios/晚唐·开成五年（官方）.json'
BASE='e3a2a5bc66ec49f65573e268cb56c488ff7447e592b0d5cf38968cb0332c7279'
raw=target.read_bytes();assert hashlib.sha256(raw).hexdigest()==BASE,'Source changed: review before retry'
before=json.loads(raw);s=copy.deepcopy(before);cs=s['characters'];byid={c['id']:c for c in cs}
rows=[json.loads(l) for p in sorted(w.glob('history-*.ndjson')) for l in p.read_text(encoding='utf-8').splitlines() if l.strip()]
assert hashlib.sha256(json.dumps(rows,ensure_ascii=True,separators=(',',':')).encode()).hexdigest()=='33cfc65c1931203647c317f372b57e64fb920167002603df9132d35a93d6be35'
books=json.loads((w/'books.json').read_bytes());groups=json.loads((w/'skills-groups.json').read_bytes())
assert len(rows)==81 and len(cs)==434
ref='assets/reference/tang840-characters.json'
archive={'schemaVersion':1,'scenarioId':s['id'],'sourceDocumentSha256':'96619c04de3ed82acc313aeeecf23d90cc9bf923b36a138ee89955e86c7fac10','characters':{}}
blank_text=['appearance','ethnicity','faith','birthplace','birthTime','zi','haoName','familyTier','familyStatus','familyRole','mentor','hobbies','secret','learning','culture']
blank_lists=['familyMembers','redLines','personalGrudges','skills','historicalSources']
def fill(c,k,v):
    if k not in c or c[k] is None or c[k]=='' or c[k]==[]: c[k]=copy.deepcopy(v)
for c in cs:
    for k in blank_text: fill(c,k,'')
    for k in blank_lists: fill(c,k,[])
    c['type']='historical' if c['isHistorical'] else 'fictional';c['isFictional']=not c['isHistorical']
    if not c.get('isPlayer'):
        fill(c,'behaviorMode',c.get('personality',''))
        fill(c,'coreMotivations',[c['personalGoal']] if c.get('personalGoal') else [])
    matches=[f['id'] for f in s['factions'] if f.get('name')==c.get('faction')]
    if len(matches)==1:fill(c,'factionId',matches[0])
for g in groups:
    for i in g['indexes']:
        assert cs[i]['isHistorical'] is False;fill(cs[i],'skills',g['skills'])
        cs[i]['fictionalSources']=['作者虚构角色；技能为既有职业的文字说明，不是历史记载或新增数值加成。']
excluded={7,37,41,47,54,362,367,368,374,381}
def safe_quote(i,j,text):
    if i in excluded or (i,j) in {(28,1),(370,1)}:return ''
    starts={(0,0):'元和九年',(1,0):'元和五年',(2,0):'王氏，邯鄲',(3,0):'郭氏，汾陽'}
    cuts={12:'五年，武宗',14:'會昌初',20:'會昌初',29:'，轉膳部',58:'武宗即位'}
    if (i,j) in starts:text=text[text.index(starts[(i,j)]):]
    if i in cuts and cuts[i] in text:text=text.split(cuts[i])[0]+'〔后文从略〕'
    return text
for i,cid,name,fields,quotes,notes in rows:
    c=cs[i];assert (c['id'],c['name'],c['isHistorical'])==(cid,name,True)
    for k,v in fields.items():
        if k=='aliases':v=[x for x in v if '后赐' not in x and '后名' not in x]
        fill(c,k,v)
    for k,rel in [('father','父'),('mother','母')]:
        if c.get(k) and not any(m.get('relation')==rel for m in c['familyMembers'] if isinstance(m,dict)):
            m={'name':c[k],'relation':rel,'note':'亲等见史料；未核生卒与在世状态。'}
            matches=[x for x in cs if x['name']==c[k]]
            if len(matches)==1:m['characterId']=matches[0]['id']
            c['familyMembers'].append(m)
    c['historicalSourceRef']=ref;c['historicalSourceKey']=cid
    entry={'name':name,'originalIndex':i,'status':'quoted' if quotes else 'original-pending','quotes':[{'book':books[b][0],'url':books[b][1],'text':q} for b,q in quotes],'note':notes}
    archive['characters'][cid]=entry
    c['historicalSources']=['【史家资料，非人物记忆】'+books[b][0]+'：“'+t+'” 来源：'+books[b][1] for j,(b,q) in enumerate(quotes) if (t:=safe_quote(i,j,q))]
    if not c['historicalSources']:c['historicalSources']=['【原文待核】可靠逐字释读尚未完成；见史料与校勘。' if not quotes else '【时点待核】原文含开局后事或任职日未定，仅在独立史料与校勘页展示，不作为开局履历。']
for c in cs:
    if not c.get('career'):
        c['career']=[{'date':'开成五年正月十四·开局状态','title':c.get('officialTitle') or c.get('role') or '未录','desc':'现状快照，不是任命日期；不据此反推任期。'+('作者虚构的开局安置。' if c['isFictional'] else '史实任次须结合原文与时点校记。'),'milestone':False}]
fixes=json.loads((w/'office-fixes.json').read_bytes())
for i,main,other,honor,note in fixes:
    c=cs[i];old=c.get('officialTitle','');c['officialTitle']=main
    c['officialTitles']=list(dict.fromkeys([main]+other));c['concurrentTitles']=list(dict.fromkeys(other));c['concurrentTitle']='、'.join(c['concurrentTitles'])
    c['honoraryTitles']=honor;c['officeEvidenceNote']=note;c['title']='·'.join(c['officialTitles'])
    for k in ['role','occupation']:
        if c.get(k)==old:c[k]=c['title']
for i in [366,369]:cs[i]['officeRankText']='日本'+('从三位' if i==366 else '从二位')
# Keep original IDs, metrics, chronology and personality; fix only incompatible current context.
z=cs[20];old=z['description'];new='坐镇河中，须兼顾军府事务、河中府政与晋绛观察。先帝丧礼可奉诏议论，但他并非长安现任礼官；桥津、军粮和属州申牒须在本镇办理。'
def replace_strings(v,a,b):
    if isinstance(v,str):return v.replace(a,b)
    if isinstance(v,list):return [replace_strings(x,a,b) for x in v]
    if isinstance(v,dict):return {k:replace_strings(x,a,b) for k,x in v.items()}
    return v
z=replace_strings(z,old,new);z=replace_strings(z,'博学宏词','书判拔萃');z=replace_strings(z,'历太常博士','历太常少卿');cs[20]=z
z['location']='河中府';z['regionId']='河中府';z['locationId']='河中府'
z['economyConfig']['livelihoodType']='governor';z['economyConfig']['livelihoodName']='使府长官家计'
# Existing balances/expense amounts stay unchanged; only explanatory livelihood text follows the corrected post.
z['career'].append({'date':'开局前·月日未详','title':'河中节度使、兼河中尹、晋绛观察等使','desc':'本传记检校礼部尚书为加衔；此任在太子永得罪之后、会昌初召还之前。','milestone':False})
c=cs[19];old=c['description'];new='现任户部侍郎，判本司事，并权判吏部尚书铨事；须核计户部事务与铨选文书。礼学是此前积累的专长，不以泛称礼官替代当前职掌。';cs[19]=replace_strings(c,old,new)
def walk(v):
    if isinstance(v,dict):
        yield v
        for x in v.values():yield from walk(x)
    elif isinstance(v,list):
        for x in v:yield from walk(x)
seats={'office-2da9bdae1f01':17,'office-e89790fddee5':19,'office-43a6e9e38b0c':20};bound=[]
for key in ['officeTree','officeRegistryByFaction']:
    for pos in walk(s[key]):
        if pos.get('id') in seats:
            c=cs[seats[pos['id']]];assert pos.get('holder') in ['',c['name']]
            pos.update(holder=c['name'],holderId=c['id'],occupancyStatus='occupied',vacancyCount=0)
            bound.append([key,pos['id'],c['id']])
assert len(bound)==6,bound
archive['characters'][cs[55]['id']]['references']=[{'book':'敦煌研究院·莫高窟第17窟（现代资料；非碑文原引）','url':'https://www.dha.ac.cn/info/1425/3608.htm'}]
archive['characters'][cs[358]['id']]['references']=[{'book':'Siddham INIG932铭文目录；完整释读待核，不与Mihirakula碑混同','url':'https://siddham.network/inscription/inig932-gwalior-fort-inscription-of-vs-932/'}]
for c in cs:
    fill(c,'dialogues',[])
    if c['isFictional']:assert not c['historicalSources']
changed=[]
for a,b in zip(before['characters'],cs):
    keys=[k for k in set(a)|set(b) if a.get(k)!=b.get(k) or (k in a)!=(k in b)]
    changed.append({'id':b['id'],'name':b['name'],'fields':sorted(keys)})
assert len([x for x in changed if x['fields']])==434
untouched=[k for k in s if k not in ['characters','officeTree','officeRegistryByFaction']]
assert all(s[k]==before[k] for k in untouched)
for a,b in zip(before['characters'],cs):
    for k in ['id','name','age','alive','isPlayer','portrait','resources','loyalty','ambition','intelligence','valor','military','administration','management','charisma','diplomacy','benevolence','integrity','health','stress','relations','traitIds','partyIds']:
        assert a.get(k)==b.get(k),(b['name'],k)
assert cs[0]['_memory']==before['characters'][0]['_memory']
for k in ['personality','personalGoal','innerThought','stance']:assert k not in cs[0]
assert len({c['id'] for c in cs})==434
# Replace only three top-level value spans; map/portraits outside characters keep their original bytes.
text=raw.decode('utf-8');dec=json.JSONDecoder();p=1;spans={}
while True:
    while text[p].isspace() or text[p]==',':p+=1
    if text[p]=='}':break
    key,p=dec.raw_decode(text,p)
    while text[p].isspace():p+=1
    assert text[p]==':';p+=1
    while text[p].isspace():p+=1
    start=p;value,p=dec.raw_decode(text,p);spans[key]=(start,p)
    del value
for key in sorted(['characters','officeTree','officeRegistryByFaction'],key=lambda k:spans[k][0],reverse=True):
    a,b=spans[key];text=text[:a]+json.dumps(s[key],ensure_ascii=False,separators=(',',':'))+text[b:]
newraw=text.encode('utf-8');assert json.loads(newraw)==s
newhash=hashlib.sha256(newraw).hexdigest()
report={'sourceBefore':BASE,'sourceAfter':newhash,'characters':434,'historical':81,'fictional':353,'originalQuotes':sum(len(x[4]) for x in rows),'quotedPeople':79,'originalPending':2,'changed':changed,'officeChanges':fixes,'seatBindings':bound,'unchangedTopLevel':untouched,'archive':ref,'applied':False}
if '--apply' in sys.argv:
    assert hashlib.sha256(target.read_bytes()).hexdigest()==BASE,'Concurrent edit detected'
    ap=r/'web'/ref;assert not ap.exists(),'Archive already exists: review before overwriting'
    ap.parent.mkdir(parents=True,exist_ok=True)
    ar=json.dumps(archive,ensure_ascii=False,indent=2).encode('utf-8');tmp=target.with_name(target.name+'.tang-edit.tmp')
    tmp.write_bytes(newraw);assert hashlib.sha256(tmp.read_bytes()).hexdigest()==newhash
    assert hashlib.sha256(target.read_bytes()).hexdigest()==BASE,'Concurrent source edit detected'
    ap.write_bytes(ar);os.replace(tmp,target);report['applied']=True
(w/'content-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('CONTENT',json.dumps({k:v for k,v in report.items() if k not in ['changed','officeChanges','unchangedTopLevel']},ensure_ascii=False))
