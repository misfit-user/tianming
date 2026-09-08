'use strict';
// Specific player-feedback fixture probe, not a general scenario validator.
// The supplied export is intentionally not committed. Run with the locked Electron.
// Disposable userData, blocked network, unchanged input JSON and production main.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { app, session, net } = require('electron');
const root = path.resolve(__dirname, '..'), source = process.argv[2] || process.env.TM_WORKSHOP_CONFIG_INPUT;
if (!source) throw Error('usage: electron scripts/verify-workshop-config-fixture.cjs SCENARIO_JSON');
const out = path.join(root, 'web/dev-tools/workshop-config-2026-09-08');
fs.mkdirSync(out, { recursive: true });
const label = process.env.TM_WORKSHOP_PROBE_LABEL || 'electron-report.json';
if (!/^[a-z0-9-]+\.json$/i.test(label)) throw Error('invalid report label');
const temp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tm-workshop-config-'));
app.setPath('userData', temp); app.setPath('sessionData', path.join(temp, 'session')); app.getAppPath = () => root;
const deny = () => { throw Error('workshop-probe-network-denied'); };
for (const k of ['http','https']) { require(k).request = deny; require(k).get = deny; } net.request = deny; net.fetch = deny; global.fetch = deny;
const report = { root, complete: false, sourceSha256: null, versions: process.versions, checks: [], failures: [], temporaryUserData: temp };
let done = false;
function finish(error) {
  if (done) return; done = true;
  if (error) report.failures.push(String(error.stack || error));
  report.complete = true; report.ok = !report.failures.length && report.checks.every(c => c.ok);
  fs.writeFileSync(path.join(out, label), JSON.stringify(report, null, 2));
  const s=report.state;
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks, failures: report.failures, state: s&&{init:s.init,guoku:s.guoku,neitang:s.neitang,minxin:s.minxin,daysPerTurn:s.daysPerTurn,departmentCount:s.offices.length,monthlyExpense:s.expense.totalMoney} }, null, 2)); app.exit(report.ok ? 0 : 1);
}
process.on('uncaughtException', finish); process.on('unhandledRejection', finish); setTimeout(() => finish(Error('workshop probe timeout')), 90000);
app.whenReady().then(() => session.defaultSession.webRequest.onBeforeRequest({ urls:['http://*/*','https://*/*','ws://*/*','wss://*/*'] }, (_d, cb) => cb({ cancel: true })));
app.on('browser-window-created', (_e, win) => {
  win.show = () => {}; win.setFullScreen = () => {};
  win.webContents.on('preload-error', (_e, _f, error) => finish(error));
  win.webContents.on('render-process-gone', (_e, data) => finish(Error(data.reason)));
  win.webContents.once('did-finish-load', async () => {
    try {
      const raw = fs.readFileSync(source, 'utf8'); report.sourceSha256 = crypto.createHash('sha256').update(raw).digest('hex');
      await win.webContents.executeJavaScript(`window.__configScenario=JSON.parse(${JSON.stringify(raw)});true`);
      report.state = await win.webContents.executeJavaScript(`(async()=>{
        if(P.ai?.key||P.ai?.secondary?.key)throw Error('unexpected credential');
        P.scenarios.push(__configScenario);P.conf.fixedSeed='workshop-config-electron';window.__configInit={};const sourceSnapshot=JSON.stringify(__configScenario);
        for(const pair of [[GuokuEngine,'guoku'],[NeitangEngine,'neitang']]){const old=pair[0].initFromDynasty;pair[0].initFromDynasty=function(...args){const result=old.apply(this,args);const g=GM[pair[1]];__configInit[pair[1]]={balance:g.balance,money:g.money,stock:g.ledgers.money.stock};return result;};}
        doActualStart(__configScenario.id);await _tmAwaitLoadBarrier();await new Promise(r=>setTimeout(r,500));
        const offices=GM.officeTree.map(n=>({name:n.name,seats:(n.positions||[]).map(p=>({name:p.name,holder:p.holder,actualNames:(p.actualHolders||[]).map(h=>h.name)}))}));
        return {init:__configInit,turn:GM.turn,daysPerTurn:P.time.daysPerTurn,guoku:{balance:GM.guoku.balance,money:GM.guoku.money,stock:GM.guoku.ledgers.money.stock,income:GM.guoku.monthlyIncome,expense:GM.guoku.monthlyExpense},neitang:{balance:GM.neitang.balance,money:GM.neitang.money,stock:GM.neitang.ledgers.money.stock},minxin:GM.minxin.trueIndex,offices,expense:FixedExpense.preview({turnDays:30}),sourceUnchanged:JSON.stringify(__configScenario)===sourceSnapshot};
      })()`, true);
      const s = report.state, add = (name, ok) => report.checks.push({ name, ok });
      add('real sandbox bridge', await win.webContents.executeJavaScript('tianming.isDesktop===true&&tianming.turnDataProtocolVersion===2&&typeof require==="undefined"'));
      add('guoku initial authored amount', s.init.guoku.balance === 3000000 && s.init.guoku.stock === 3000000);
      add('neitang initial authored amount', s.init.neitang.balance === 800000 && s.init.neitang.stock === 800000);
      add('guoku scalar synchronized at init boundary', s.init.guoku.money === 3000000);
      add('neitang scalar synchronized at init boundary', s.init.neitang.money === 800000);
      add('authored minxin survives new game', s.minxin === 85);
      add('all six ministries have real positions', ['吏部','户部','礼部','兵部','刑部','工部'].every(n => s.offices.some(o => o.name === n && o.seats.length > 0)));
      add('named minister bound to intended seat', s.offices.find(o => o.name === '吏部').seats.some(p => p.name === '吏部尚书' && p.actualNames.includes('郑明远')));
      add('money mirrors match after startup', ['guoku','neitang'].every(k => s[k].balance === s[k].money && s[k].money === s[k].stock));
      add('authored turn length honored', s.daysPerTurn === 90);
      add('input file remains byte-identical', crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex') === report.sourceSha256);
      finish();
    } catch (error) { finish(error); }
  });
});
require(path.join(root, 'main.js'));
