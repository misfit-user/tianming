'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../..');
function edit(file,fn){const p=path.join(root,file),s=fs.readFileSync(p,'utf8'),out=fn(s);if(out===s)throw Error(file);fs.writeFileSync(p,out);}
function one(s,a,b){if(s.split(a).length!==2)throw Error('unique replacement: '+a);return s.replace(a,b);}
edit('web/tm-fiscal-statements.js',s=>{
 s=one(s,"          if(typeof raw[p[0]]!=='number'||!isFinite(raw[p[0]]))return;", "          if(typeof raw[p[0]]!=='number'||!isFinite(raw[p[0]])){\n            led[p[0]]=null;led[p[2]]={};led[p[3]]={};\n            ['turn','monthly','annual'].forEach(function(prefix){view[prefix+suffix+p[1]]=null;});return;\n          }");
 s=one(s,'    view.lastDelta=num(view.turnIncome)-num(view.turnExpense);',"    view.lastDelta=view.turnIncome===null||view.turnExpense===null?null:num(view.turnIncome)-num(view.turnExpense);");
 return one(s,"          if(typeof l[pair[0]]!=='number'||!isFinite(l[pair[0]]))return;\n",'');
});
edit('web/phase8-formal-rightrail.js',s=>{
 s=one(s,"var periodNote = (forecast ? '预计' : '已交割')", "var periodNote = (g.turnIncome === null || g.turnExpense === null ? '交割缺项' : forecast ? '预计' : '已交割')");
 s=one(s,"'fiscal.turnIncome', rightFinanceFirst(g", "'fiscal.turnIncome', statement && g.turnIncome === null ? '待核' : rightFinanceFirst(g");
 s=one(s,"'fiscal.turnExpense', rightFinanceFirst(g", "'fiscal.turnExpense', statement && g.turnExpense === null ? '待核' : rightFinanceFirst(g");
 return one(s,'var net = rightAdminNum(income, 0) - rightAdminNum(expense, 0);',"var net = income === '待核' || expense === '待核' ? '待核' : rightAdminNum(income, 0) - rightAdminNum(expense, 0);");
});
edit('web/tm-guoku-panel.js',s=>{
 s=one(s,'function _guokuFmt(v) {\r\n',"function _guokuFmt(v) {\r\n  if(v===null||v==='待核')return '待核';\r\n");
 const from="g.turnIncome != null ? g.turnIncome : g.monthlyIncome || 0",to="g.turnIncome === null ? '待核' : g.turnIncome != null ? g.turnIncome : g.monthlyIncome || 0";
 if(s.split(from).length!==3)throw Error('income two uses');s=s.split(from).join(to);
 const efrom="g.turnExpense != null ? g.turnExpense : g.monthlyExpense || 0",eto="g.turnExpense === null ? '待核' : g.turnExpense != null ? g.turnExpense : g.monthlyExpense || 0";
 if(s.split(efrom).length!==3)throw Error('expense two uses');s=s.split(efrom).join(eto);
 s=one(s,"var deltaVal = g.lastDelta || 0;","var deltaVal = g.lastDelta === null ? '待核' : g.lastDelta || 0;");
 s=one(s,"'fiscal.annualIncome', g.annualIncome || 0, 'good'", "'fiscal.annualIncome', g.annualIncome === null ? '待核' : g.annualIncome || 0, 'good'");
 s=one(s,"var ti = typeof led.thisTurnIn==='number' ? led.thisTurnIn : (led.lastTurnIn || 0);", "var ti = led.thisTurnIn===null ? null : typeof led.thisTurnIn==='number' ? led.thisTurnIn : (led.lastTurnIn || 0);");
 s=one(s,"var to = typeof led.thisTurnOut==='number' ? led.thisTurnOut : (led.lastTurnOut || 0);", "var to = led.thisTurnOut===null ? null : typeof led.thisTurnOut==='number' ? led.thisTurnOut : (led.lastTurnOut || 0);");
 s=one(s,'    var net = ti - to;',"    var net = ti===null||to===null?null:ti-to;");
 return one(s,"(net >= 0 ? '+' : '') + _guokuFmt(net)","(net !== null && net >= 0 ? '+' : '') + _guokuFmt(net)");
});
