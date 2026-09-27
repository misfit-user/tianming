'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../..');
const file=path.join(root,'web/tm-topbar-vars.js'),before=fs.readFileSync(file,'utf8'),eol=before.includes('\r\n')?'\r\n':'\n';
const start=before.indexOf('function _renderGuoku()'),end=before.indexOf('function _renderNeitang()',start);if(start<0||end<0)throw Error('render boundary');
let s=before.slice(start,end);
function replace(a,b){if(s.split(a).length!==2)throw Error('nonunique '+a);s=s.replace(a,b);}
replace('  var prevG = GM._prevGuoku || null;',[
 '  var prevG = GM._prevGuoku || null;',
 '  // 收支采用真实流水报表；旧存档中的估算标量不应覆盖已交割金额。',
 "  var fiscalView = typeof FiscalStatement !== 'undefined' ? FiscalStatement.read({ game:GM, account:g, scope:'central' }) : null;",
 '  var flows = fiscalView ? fiscalView.account : g;',
 '  var periodIncome = flows.turnIncome != null ? flows.turnIncome : (flows.monthlyIncome || 0);',
 '  var periodExpense = flows.turnExpense != null ? flows.turnExpense : (flows.monthlyExpense || 0);'
].join(eol));
replace('  var turnDays = g.turnDays || 30;','  var turnDays = flows.turnDays || 30;');
replace("  var incomeLabel = turnDays === 30 ? '月入' : '回合入';",[
 "  var flowPrefix = fiscalView && fiscalView.forecast ? '预计' : fiscalView && fiscalView.periodStatus === 'previous' ? '上期' : '';",
 "  var incomeLabel = flowPrefix + (turnDays === 30 ? '月入' : '回合入');"
].join(eol));
replace("  var expenseLabel = turnDays === 30 ? '月支' : '回合支';","  var expenseLabel = flowPrefix + (turnDays === 30 ? '月支' : '回合支');");
replace("_barAccountDelta(g, prevG, 'money', (g.turnIncome || g.monthlyIncome || 0) - (g.turnExpense || g.monthlyExpense || 0))","_barAccountDelta(g, prevG, 'money', periodIncome - periodExpense)");
replace("_barReported('fiscal.turnIncome', g.turnIncome || g.monthlyIncome || 0, 'good')","_barReported('fiscal.turnIncome', periodIncome, 'good')");
replace("_barReported('fiscal.turnExpense', g.turnExpense || g.monthlyExpense || 0, 'bad')","_barReported('fiscal.turnExpense', periodExpense, 'bad')");
replace("_barReported('fiscal.annualIncome', g.annualIncome || 0, 'good')","_barReported('fiscal.annualIncome', flows.annualIncome || 0, 'good')");
const back=path.join(__dirname,'backups/root/tm-topbar-vars.js.bak');fs.mkdirSync(path.dirname(back),{recursive:true});if(!fs.existsSync(back))fs.copyFileSync(file,back);
fs.writeFileSync(file,before.slice(0,start)+s+before.slice(end));
