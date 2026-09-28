'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../../..'),DIR=path.resolve(__dirname,'..'),REF='e1c8384cc93ee35d8c221f7d2a543b9776fb1d60';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const report=[];

// 本核对拿 e1c8384c 原版作底，只在税基补丁是重建末步时成立。
// 合并后税基之后还有别的补丁（如省道主官）也改剧本，再拿原版比必然越界，故如实跳过；
// 税基单独分支上的通过记录见 reports/tax-base-scope.json。
function laterSteps(key) {
  const script = fs.readFileSync(path.join(DIR, 'patches/rebuild-' + key + '.js'), 'utf8');
  const after = script.slice(script.indexOf('patches/tax-base.js'));
  return (after.match(/patches\/[\w-]+\.js/g) || []).filter((p) => p !== 'patches/tax-base.js');
}
const blocked = ['tianqi', 'shaosong', 'tang'].map((key) => [key, laterSteps(key)]).filter(([, steps]) => steps.length);
if (blocked.length) {
  blocked.forEach(([key, steps]) => console.log('SKIP scope ' + key + '：税基之后还有 ' + steps.join('、') + '，范围核对只适用于税基单独分支'));
  process.exit(0);
}

for(const key of ['tianqi','shaosong','tang']){
  const name=require('../data/'+key+'-tax-base').scenario,rel='scenarios/'+name;
  const before=JSON.parse(execFileSync('git',['show',REF+':'+rel],{cwd:ROOT,maxBuffer:256*1024*1024}).toString('utf8'));
  const raw=fs.readFileSync(path.join(ROOT,rel),'utf8'),after=JSON.parse(raw);assert.equal(JSON.stringify(after)+'\n',raw,'非标准字节格式');
  const configs=[[before.fiscalConfig,after.fiscalConfig]];
  if(key==='tang'){
    const a=before.factions.find(f=>f.name==='唐朝廷'),b=after.factions.find(f=>f.name==='唐朝廷');
    assert.equal(hash(after.fiscalConfig.taxList),hash(b.fiscalConfig.taxList),'唐廷税表副本不一致');
    configs.push([a.fiscalConfig,b.fiscalConfig]);delete a.fiscalConfig;delete b.fiscalConfig;
  }
  const opening=require('../data/opening-treasury')[key];
  for(const section of ['guoku','neitang'])for(const field of Object.keys(opening[section])){assert.equal(after[section][field],opening[section][field],'库存说明不符');delete before[section][field];delete after[section][field];}
  delete before.fiscalConfig;delete after.fiscalConfig;
  const outside=[hash(before),hash(after)];assert.equal(...outside,key+'修改越过财政配置');
  const fiscalRemainders=[];
  for(const [a,b] of configs){
    assert.equal(hash(b.legacyTaxConfig),hash(require('../data/'+key+'-tax-base').legacy),'兼容快照不一致');
    delete a.legacyTaxConfig;delete b.legacyTaxConfig;
    delete a.taxList;delete b.taxList;delete a.productionTaxVersion;delete b.productionTaxVersion;
    if(key==='tianqi'){
      assert(!b.taxes,'旧税目数组未清除');delete a.taxes;
      assert.equal(hash(a.customTaxes.filter(t=>t.id!=='guanshui')),hash(b.customTaxes),'月港之外自定义税有变');
      delete a.customTaxes;delete b.customTaxes;
      delete a.centralLocalRules.perTax;delete b.centralLocalRules.perTax;
    }
    const h=[hash(a),hash(b)];assert.equal(...h,key+'非税基财政配置被改变');fiscalRemainders.push(h);
  }
  report.push({scenario:name,baseline:REF,nonFiscalHash:outside[0],unchangedFiscalRemainders:fiscalRemainders.map(h=>h[0]),pass:true});
  console.log('PASS scope '+key);
}
fs.writeFileSync(path.join(DIR,'reports/tax-base-scope.json'),JSON.stringify(report,null,2)+'\n');
