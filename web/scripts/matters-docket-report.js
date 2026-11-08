#!/usr/bin/env node
// 事的容器（甲1a）案单报告：读一份存档，只读地跑 TM.Matters，写出一份中文案单报告给人读。
//
// 用法：node scripts/matters-docket-report.js <存档.json> [--out <报告.md>] [--period-days 30]
//   存档认三种：桌面自动存档（外面套一层 { __tmAutoSaveEnvelope, data }）、项目整包（含 gameState）、单独导出的 GM。
//   大存档（一两百 MB）用 node --max-old-space-size=6144 跑。
//
// 只读：存档文件不写；内存里的 GM 只多出 matters 一项，跑前跑后对 GM 其余各项算 sha256，必须一致。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const file = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')))[0];
if (!file) {
  console.error('用法：node scripts/matters-docket-report.js <存档.json> [--out <报告.md>] [--period-days 30]');
  process.exit(2);
}
const outFile = flag('--out');
const periodDays = Number(flag('--period-days')) || 30;

const SOURCE_LABEL = {
  edictTracker: '诏令追踪', edictDraft: '诏令草稿', npcCommitment: '承诺', wdRewardPunish: '问对赏罚',
  currentIssue: '时局要务', tinyiTopic: '待议', memorial: '奏疏', activeWar: '战事', activeScheme: '阴谋',
  revoltPrecursor: '民变苗头', routeDisruption: '驿路阻断', foreshadow: '伏笔', candidateEvent: '剧本事件', evtLog: '账本信号'
};
const PART_LABEL = { size: '大小', urgency: '紧迫', relation: '关系', distortion: '失真', handedDown: '交办', novelty: '新异' };
const label = (s) => SOURCE_LABEL[s] || s;

// GM 各项（去掉 matters）的 sha256：逐项序列化，免得把一两百 MB 的整档拼成一个大串
function worldHash(gm) {
  const h = crypto.createHash('sha256');
  Object.keys(gm).sort().forEach((k) => {
    if (k === 'matters') return;
    h.update(k + '\u0000');
    h.update(String(JSON.stringify(gm[k])));
    h.update('\u0001');
  });
  return h.digest('hex');
}

function salienceLine(s) {
  if (!s || !s.parts) return '—';
  const bits = Object.keys(s.parts).filter((k) => s.parts[k].score).map((k) => PART_LABEL[k] + ' ' + s.parts[k].score);
  return s.total + (bits.length ? '（' + bits.join(' + ') + '）' : '');
}

function oneLine(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '｜').replace(/\n/g, ' ');

function main() {
  const t0 = Date.now();
  const size = fs.statSync(file).size;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const tRead = Date.now();
  const shell = raw && raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw;
  const GM = (shell.gameState && typeof shell.gameState === 'object') ? shell.gameState : (shell.GM && typeof shell.GM === 'object' ? shell.GM : shell);
  if (!GM || typeof GM !== 'object' || GM.turn == null) throw new Error('认不出存档里的 GM（缺 turn）');
  const scen = (Array.isArray(shell.scenarios) ? shell.scenarios : []).filter((s) => s && s.id === GM.sid)[0];
  const scenName = (scen && scen.name) || GM.sid || '（剧本名不详）';

  // 沙箱里只加载 tm-matters.js
  const sandbox = { console, TM: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const modPath = path.join(__dirname, '..', 'tm-matters.js');
  vm.runInContext(fs.readFileSync(modPath, 'utf8'), sandbox, { filename: modPath });
  const M = sandbox.TM.Matters;

  const hadMatters = !!GM.matters;
  const before = worldHash(GM);
  const tFile0 = Date.now();
  const opts = { periodDays };
  const info = M.inspect(GM, opts);
  const stats = M.file(GM, opts);
  const dk = M.docket(GM, opts);
  const tFile = Date.now() - tFile0;
  const after = worldHash(GM);
  const heapMB = Math.round(process.memoryUsage().heapUsed / 1048576);
  const store = GM.matters;
  const matters = Object.keys(store.byId).map((id) => store.byId[id]);

  // 各来源计数
  const bySource = {};
  const bump = (s, k) => { (bySource[s] = bySource[s] || { cand: 0, settled: 0, merged: 0, filed: 0, notFiled: 0 })[k]++; };
  info.candidates.forEach((c) => { bump(c.origin.source, 'cand'); if (c.status !== 'open') bump(c.origin.source, 'settled'); });
  matters.forEach((m) => { bump(m.origin.source, 'filed'); (m.materials || []).forEach((x) => bump(x.source, 'merged')); });
  info.notFiled.concat(stats.skippedItems || []).forEach((x) => bump(x.source, 'notFiled'));

  const L = [];
  L.push('# 案单报告·' + scenName + '·第 ' + GM.turn + ' 回合', '');
  L.push('- 存档：`' + file + '`（' + (size / 1048576).toFixed(1) + ' MB）');
  L.push('- 剧本：' + scenName + (GM.sid ? '（' + GM.sid + '）' : ''));
  L.push('- 这次推演按 ' + periodDays + ' 日算：择办名额 ' + dk.quota + ' 件');
  L.push('- 耗时：读档 ' + ((tRead - t0) / 1000).toFixed(1) + ' 秒，立案 ' + (tFile / 1000).toFixed(2) + ' 秒；堆内存 ' + heapMB + ' MB');
  if (hadMatters) L.push('- 存档里原本就有 GM.matters，本报告在它的基础上又立了一次');
  L.push('', '## 一、各来源', '');
  L.push('| 来源 | 候选 | 其中已结 | 并进别件 | 立案 | 没立 |', '|---|---:|---:|---:|---:|---:|');
  Object.keys(bySource).sort((a, b) => label(a).localeCompare(label(b), 'zh')).forEach((s) => {
    const r = bySource[s];
    L.push('| ' + label(s) + ' | ' + r.cand + ' | ' + r.settled + ' | ' + r.merged + ' | ' + r.filed + ' | ' + r.notFiled + ' |');
  });
  L.push('', '并案：' + stats.merged + ' 条并进别件。立案：新立 ' + stats.filed + '，更新 ' + stats.updated + '，结掉 ' + stats.closed + '。' + (stats.notes.length ? '另：' + stats.notes.join('；') + '。' : ''));
  L.push('', '只计数、不立案（人物上场时的材料）：' + Object.keys(info.countOnly).map((k) => k + ' ' + info.countOnly[k]).join('，') + '。');

  L.push('', '## 二、必办（' + dk.must.length + ' 件）', '');
  if (!dk.must.length) L.push('（没有。玩家这回合还没下诏，也没有待办的承诺。）');
  dk.must.forEach((m, i) => {
    L.push('### ' + (i + 1) + '. ' + m.narrative.title + '　`' + m.id + '`', '');
    L.push('- 来源：' + label(m.origin.source) + ' · ' + m.origin.ref + '（' + m.kind + '）');
    L.push('- 显著度：' + salienceLine(m.salience));
    if (m.stakeholders.length) L.push('- 利害人：' + m.stakeholders.map((s) => s.ref).join('、'));
    if (m.materials.length) {
      L.push('- 并进来的材料：');
      m.materials.forEach((x) => L.push('  - ' + label(x.source) + '：' + x.title + '（' + x.why + '）'));
    }
    L.push('- 摘要：' + oneLine(m.narrative.summary, 160), '');
  });

  L.push('## 三、择办（选上 ' + dk.optional.length + ' 件，名额 ' + dk.quota + '）', '');
  if (dk.optional.length) {
    L.push('| # | 标题 | 来源 | 显著度 | 并进来的材料 |', '|---:|---|---|---|---|');
    dk.optional.forEach((m, i) => L.push('| ' + (i + 1) + ' | ' + cell(m.narrative.title) + ' | ' + label(m.origin.source) + ' | ' + cell(salienceLine(m.salience)) + ' | ' + cell(m.materials.map((x) => label(x.source) + '：' + x.title).join('；') || '—') + ' |'));
  } else L.push('（没有。）');
  if (dk.notChosen.length) {
    L.push('', '落选的前 ' + Math.min(10, dk.notChosen.length) + ' 件（共 ' + dk.notChosen.length + ' 件，这次不动，留在案上）：', '');
    L.push('| 标题 | 来源 | 显著度 |', '|---|---|---|');
    dk.notChosen.slice(0, 10).forEach((m) => L.push('| ' + cell(m.narrative.title) + ' | ' + label(m.origin.source) + ' | ' + cell(salienceLine(m.salience)) + ' |'));
  }

  L.push('', '## 四、留案头（' + dk.desk.length + ' 件，玩家没批的待议、奏疏）', '');
  const deskGroups = {};
  dk.desk.forEach((m) => { (deskGroups[m.origin.source] = deskGroups[m.origin.source] || []).push(m); });
  if (!dk.desk.length) L.push('（没有。）');
  Object.keys(deskGroups).forEach((s) => {
    const g = deskGroups[s];
    L.push('- **' + label(s) + '** ' + g.length + ' 件：' + g.slice(0, 30).map((m) => m.narrative.title).join('；') + (g.length > 30 ? '……' : ''));
  });

  L.push('', '## 五、逾期（' + dk.overdue.length + ' 件）', '');
  L.push(dk.overdue.length ? dk.overdue.map((m) => '- ' + m.narrative.title + '（限第 ' + m.deadline.turn + ' 回合）').join('\n') : '（没有。）');

  const unfiled = info.notFiled.concat(stats.skippedItems || []);
  L.push('', '## 六、没立案的条目（' + unfiled.length + ' 条）', '');
  if (unfiled.length) {
    L.push('| 来源 | 标题 | 原因 |', '|---|---|---|');
    unfiled.slice(0, 80).forEach((x) => L.push('| ' + label(x.source) + ' | ' + cell(oneLine(x.title, 30)) + ' | ' + cell(x.reason) + ' |'));
    if (unfiled.length > 80) L.push('', '……另有 ' + (unfiled.length - 80) + ' 条从略。');
  } else L.push('（没有。）');

  L.push('', '## 七、只读核验', '');
  L.push('- 跑前，GM 去掉 matters 后的 sha256：`' + before + '`');
  L.push('- 跑后：`' + after + '`');
  L.push('- 结论：' + (before === after ? '**一致**，除 GM.matters 外没有改动任何东西。' : '**不一致**——有东西被改了，这是错误。'));
  L.push('- GM.matters：未结 ' + matters.length + ' 件，已结摘要 ' + store.closed.length + ' 条，案头索引 ' + Object.keys(store.byDocket).length + ' 人。');

  const text = L.join('\n') + '\n';
  if (outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, text, 'utf8');
  } else process.stdout.write(text);
  console.error('[matters-docket-report] ' + scenName + ' T' + GM.turn + '：必办 ' + dk.must.length + '，择办 ' + dk.optional.length + '/' + dk.quota + '，落选 ' + dk.notChosen.length + '，留案头 ' + dk.desk.length + '，没立 ' + unfiled.length + '，只读核验 ' + (before === after ? '一致' : '不一致') + (outFile ? ' → ' + outFile : ''));
  if (before !== after) process.exitCode = 1;
}

try { main(); } catch (e) { console.error('[matters-docket-report] 出错：' + (e && e.stack || e)); process.exitCode = 1; }
