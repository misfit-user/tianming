// 晚唐剧本·死条目与抄件（阶段三第十刀）
//
// 1. 环境承载：environmentConfig.initialCarrying.byRegion 与 initialScars.byRegion 各 428 条。环境引擎按「顶级省道」建账
//    （tm-economy-engine.js：环境仍以顶级省/路为单位），开局时只按玩家各道的 id 取配置；其余 383 条是按州名、外藩地块、
//    河朔诸镇的道与「·分片1」之类旧键存的，任何代码路径都读不到，删去；玩家 45 道的配置原样保留。
//    另：实测开局后 45 道的环境账都是同一组默认值，这 45 条配置目前也没有被引擎读进去（引擎问题，另报，不在本补丁改）。
// 2. 兵制：military.militarySystem 12 条的 effects 一字不差照抄 description。游戏不读 effects（只在编辑器兵制表单里显示），
//    改为按引擎在读的结构字段（募兵方式、给饷、平时职守、调发迟速、军心所系）写一句简述；缺 type、era 的 4 条补上。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tang-cleanup.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '晚唐·开成五年（官方）.json');
const TABLES = ['initialCarrying', 'initialScars'];

// 兵制结构字段的中文说法（取值见 tm-engine-constants.js 与剧本）
const RECRUIT = { paid: '募兵', retainer: '私属亲随', rotation: '轮番', levy: '征调' };
const SALARY = { central: '中央给饷', local: '本地给饷', private: '主将私给', communal: '部众自备', mixed: '诸军分给' };
const ROLE = { guard: '平时宿卫', garrison: '平时驻守', escort: '平时随护', pastoral: '平时放牧', campaign: '随行营出征', reserve: '休整轮换' };
const DELAY = ['即日可发', '调发稍缓', '调发需时', '调发最缓'];
const LOYALTY = { leader: '军心系于首领', local: '军心系于本地', commander: '军心系于主将', state: '军心系于朝廷', throne: '军心系于王室' };

function systemSummary(m) {
  const pick = (table, key, field) => {
    if (!(key in table)) throw new Error(m.name + ' 的 ' + field + '「' + key + '」没有中文说法');
    return table[key];
  };
  const delay = Math.max(0, Math.min(DELAY.length - 1, Math.round(Number(m.mobilizationDelay) || 0)));
  return [pick(RECRUIT, m.recruitmentType, 'recruitmentType'), pick(SALARY, m.salaryType, 'salaryType'), pick(ROLE, m.peacetimeRole, 'peacetimeRole'),
    DELAY[delay], pick(LOYALTY, m.loyaltyAttribution, 'loyaltyAttribution')].join('·');
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  // ---- 1. 环境承载死条目 ----
  const env = scenario.environmentConfig;
  const live = new Set(scenario.adminHierarchy.player.divisions.map((c) => c.id));
  const leafIds = new Set();
  const circuitIds = new Set();
  Object.keys(scenario.adminHierarchy).forEach((k) => scenario.adminHierarchy[k].divisions.forEach((c) => {
    circuitIds.add(c.id);
    (c.children || []).forEach((l) => leafIds.add(l.id));
  }));
  const envRows = TABLES.map((table) => {
    const by = env[table].byRegion;
    const kinds = { 州或地块: 0, 他势力之道: 0, 旧键: 0 };
    const kept = {};
    Object.keys(by).forEach((key) => {
      if (live.has(key)) { kept[key] = by[key]; return; }
      if (leafIds.has(key)) kinds.州或地块 += 1;
      else if (circuitIds.has(key)) kinds.他势力之道 += 1;
      else kinds.旧键 += 1;
    });
    const missing = [...live].filter((id) => !(id in kept));
    if (missing.length) throw new Error(table + ' 缺玩家道的配置：' + missing.join('、'));
    const before = Object.keys(by).length;
    env[table].byRegion = kept;
    return '| ' + table + ' | ' + before + ' | ' + Object.keys(kept).length + ' | ' + Object.keys(kinds).map((k) => k + ' ' + kinds[k]).join('、') + ' |';
  });

  // ---- 2. 兵制 effects 抄件 ----
  const sysRows = scenario.military.militarySystem.map((m) => {
    if (m.effects !== m.description) throw new Error(m.name + ' 的 effects 已不是 description 抄件，核对后再改');
    const added = [];
    if (!m.type) { m.type = m.name; added.push('type'); }
    if (!m.era) { m.era = '晚唐'; added.push('era'); }
    m.effects = systemSummary(m);
    return '| ' + m.name + ' | ' + m.effects + ' | ' + (added.join('、') || '') + ' |';
  });

  const report = ['# 晚唐·死条目与抄件报告', '',
    '环境承载只保留环境引擎按 id 取得到的玩家 ' + live.size + ' 道；兵制 ' + sysRows.length + ' 条的 effects 由照抄 description 改为结构字段简述。',
    '实测开局后 45 道的环境账是同一组默认值，这些配置目前也未被引擎读入（引擎问题，另报）。', '',
    '## 环境承载', '', '| 表 | 原条数 | 保留 | 删去 |', '| --- | --- | --- | --- |', ...envRows, '',
    '## 兵制', '', '| 兵制 | effects 改为 | 补上的字段 |', '| --- | --- | --- |', ...sysRows];
  if (reportFile) fs.writeFileSync(reportFile, report.join('\n') + '\n');
  console.log(report.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();
