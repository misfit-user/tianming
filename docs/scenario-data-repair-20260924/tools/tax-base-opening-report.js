'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const D=path.resolve(__dirname,'..'),R=path.join(D,'reports'),fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const names={tianqi:'天启',shaosong:'绍宋',tang:'晚唐'},reports={};
const lines=['## 审查续：开局收支','',
 '开局库存与月流量分开。三部初值没有找到同日同口径的库存总簿，本轮不改数字，已撤销伪引文；逐字原文及检索边界见说明与三部报告。','',
 '| 剧本 | 剧本钱/粮 | 旧开局所见钱/粮 | 新开局所见钱/粮 | 本期天数 | 月入预估（钱） | 月支预估（钱） |',
 '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
for(const key of ['tianqi','shaosong','tang']){
 const a=JSON.parse(fs.readFileSync(path.join(R,'tax-base-opening-'+key+'-after.json'),'utf8')),b=JSON.parse(fs.readFileSync(path.join(R,'tax-base-opening-'+key+'-before.json'),'utf8'));
 for(const k of ['money','grain','cloth'])assert.equal(a.opening.guoku[k].stock,a.authored[k]);assert(a.savedOpeningReentryUnchanged&&a.forecastMatchesCollection);assert.equal(a.periods.length,12);reports[key]=a;
 const pair=r=>fmt(r.guoku.money.stock)+' / '+fmt(r.guoku.grain.stock);
 lines.push(`| ${names[key]}（${key==='tianqi'?'两':'贯'}/石） | ${fmt(a.authored.money)} / ${fmt(a.authored.grain)} | ${pair(b.opening)} | ${pair(a.opening)} | ${a.days} | ${fmt(a.display.income)} | ${fmt(a.display.expense)} |`);
}
lines.push('','旧天启和绍宋在开局T1已征收、扣支，第一次过回合在回合号递增前调用时被幂等标记跳过。新开局不置已结算标记，第一次过回合执行T1，重试跳过，随后T2正常结算。晚唐原来已用预算，但另有官署周转金预拨；现在其开局转拨随首次征收原额交割，失败连同凭据一起回滚。','',
 '严格的同状态“立即结算→延后结算”库存等价、重试、旧档及转拨回滚，由 smoke-opening-treasury-fiscal.js 验证。真实开局还逐期断言 previewRevenue 与实收完全对应，且未过回合的新档重入不动钱粮布。旧存档不追溯退款、不清除既有结算标记。','',
 '旧开局首笔征收发生在全部初始化完成之前：天启旧记录税入389,258两，新完成初始化后的首笔为'+fmt(reports.tianqi.periods[0].income.central.money)+'两。旧开局粮还混有初始化过程的扣用，不能把这两份不同状态的余额硬说成逐分相等；本轮不通过加税或扣回差额来模拟旧早收结果。名义税率、既有损耗未变。','',
 '### 天启12个财政回合的钱粮走势','',
 '从85万两、1300万石出发。月入为中央税入预估；月支沿旧界面口径，包含军饷、俸禄、宗禄和内帑宫廷支出。宫廷先由内帑支付，所以不能把总月支直接全减在国库存银上。轨迹按真实期长依次执行 CascadeTax、FixedExpense，再递增回合号并执行 GuokuEngine、NeitangEngine tick；不调用AI、战争、户口推演及其它系统。负数是既有旧账制残余费用直接扣款形成的账面负值，未修改其处理规则。','',
 '| 结算期 | 国库账面钱（两） | 国库粮（石） | 本期中央税入（两） | 钱欠额（两） |',
 '| --- | ---: | ---: | ---: | ---: |',
 `| 开局 | ${fmt(reports.tianqi.opening.guoku.money.stock)} | ${fmt(reports.tianqi.opening.guoku.grain.stock)} | 尚未征收 | ${fmt(reports.tianqi.opening.guoku.money.deficit)} |`);
for(const p of reports.tianqi.periods)lines.push(`| ${p.turn} | ${fmt(p.after.guoku.money.stock)} | ${fmt(p.after.guoku.grain.stock)} | ${fmt(p.income.central.money)} | ${fmt(p.after.guoku.money.deficit)} |`);
lines.push('','财政危机符合天启末史实背景，本轮不作收支调平。上述走势是固定外部驱动下的财政链试验，不是完整AI游戏年。完整原值、钱粮布、内帑及固定支出后/其它财政tick后的两层余额均在 tax-base-opening-*-after.json。','');
fs.writeFileSync(path.join(R,'tax-base-opening.md'),lines.join('\n'));
const comparison=path.join(R,'tax-base-comparison.md');let text=fs.readFileSync(comparison,'utf8');const marker='## 审查续：开局收支';if(text.includes(marker))text=text.slice(0,text.indexOf(marker));fs.writeFileSync(comparison,text.trimEnd()+'\n\n'+lines.join('\n'));
const doc=path.join(D,'税基重接说明.md');let explanation=fs.readFileSync(doc,'utf8');const next='## 尚未核定和需要后续选择的项';
if(explanation.includes(marker)){const start=explanation.indexOf(marker),end=explanation.indexOf(next,start);assert(end>start);explanation=explanation.slice(0,start)+explanation.slice(end);}
assert(explanation.includes(next));fs.writeFileSync(doc,explanation.replace(next,lines.join('\n')+'\n'+next));
for(const key of ['tianqi','shaosong','tang']){
 const p=path.join(R,'tax-base-'+key+'.md'),a=reports[key],b=JSON.parse(fs.readFileSync(path.join(R,'tax-base-opening-'+key+'-before.json'),'utf8'));let body=fs.readFileSync(p,'utf8');const heading='## 审查续实测';if(body.includes(heading))body=body.slice(0,body.indexOf(heading));
 body+='\n'+heading+'\n\n开局钱：'+fmt(b.opening.guoku.money.stock)+' → '+fmt(a.opening.guoku.money.stock)+'；开局粮：'+fmt(b.opening.guoku.grain.stock)+' → '+fmt(a.opening.guoku.grain.stock)+'。新开局钱粮布均等于剧本 initial 值。\n\n本期'+a.days+'日；月入预估'+fmt(a.display.income)+'，固定月支预估'+fmt(a.display.expense)+'（钱单位沿剧本）。未过回合存档重入不预扣，本期预估与真实征收逐项相符，重试不重复征支。\n\n完整开局、首期及12期财政轨迹见 [开局报告](tax-base-opening.md) 与 tax-base-opening-'+key+'-after.json。\n';
 fs.writeFileSync(p,body);
}
console.log('PASS opening stocks, saved-opening reentry, first-period collection, 12-period report');
