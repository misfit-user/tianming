// 绍宋剧本·人物 id 去重（阶段二人物部分第一步）
//
// 原账 char_ss_130 至 char_ss_138 九个 id 被高丽、大夏、高昌回鹘、大越、大宋等不同势力的 25 个人共用，
// 开局按 id 去重只留一人，其余 16 人丢失（lint：ref.char.duplicateId）。剧本其他地方（关系、事件、军队、党派）
// 按人名引用人物，没有引用这九个 id，改名不影响引用。
// 做法：每组保留数组里最早出现的那一人，其余改为 char_ss_<势力简称>_<原编号>，并核对全剧本唯一。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/shaosong-characters.js [--write] [--report <文件>]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '绍宋·建炎元年八月（官方）.json');

// 势力 → id 里的简称（与剧本已有的 char_ss_goryeo_201、char_ss_qidan_202 同式）
const FACTION_TAG = {
  大宋: 'song', 高丽: 'goryeo', 大夏: 'xixia', 高昌回鹘: 'qocho', 大越李朝: 'daiviet', '契丹反金 (耶律余睹部)': 'qidan'
};

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');
  const chars = scenario.characters;

  const seen = new Map();
  const taken = new Set(chars.map((c) => c.id));
  const renames = [];
  chars.forEach((c, index) => {
    if (!seen.has(c.id)) { seen.set(c.id, c); return; }
    const tag = FACTION_TAG[c.faction];
    if (!tag) throw new Error('人物 ' + c.name + ' 的势力 ' + c.faction + ' 没有 id 简称，先在 FACTION_TAG 里补');
    const num = c.id.replace(/^char_ss_/, '');
    const next = 'char_ss_' + tag + '_' + num;
    if (taken.has(next)) throw new Error('新 id 已被占用：' + next);
    taken.add(next);
    renames.push({ index, name: c.name, faction: c.faction, from: c.id, to: next, keeper: seen.get(c.id).name });
    c.id = next;
  });

  // 剧本里不应再有人按旧 id 引用被改名的人物
  const text = JSON.stringify(Object.assign({}, scenario, { characters: null }));
  const dangling = [...new Set(renames.map((r) => r.from))].filter((id) => text.includes('"' + id + '"'));
  if (dangling.length) throw new Error('剧本其他部分引用了重复 id，须先查清指谁：' + dangling.join('、'));
  const ids = chars.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new Error('改名后人物 id 仍有重复');

  const lines = ['# 绍宋·人物 id 去重报告', '',
    '原账 ' + seen.size + ' 个 id 对应 ' + chars.length + ' 人；' + renames.length + ' 人与他人共用 id，开局去重时会丢失，改为新 id（每组保留最早出现的一人）。', '',
    '| 人物 | 势力 | 原 id | 新 id | 原 id 保留给 |', '| --- | --- | --- | --- | --- |'];
  renames.forEach((r) => lines.push('| ' + [r.name, r.faction, r.from, r.to, r.keeper].join(' | ') + ' |'));
  if (reportFile) fs.writeFileSync(reportFile, lines.join('\n') + '\n');
  console.log(lines.slice(0, 3).join('\n'));

  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();
