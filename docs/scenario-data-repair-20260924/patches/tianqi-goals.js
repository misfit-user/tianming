// 天启剧本·人物个人目标改为引擎要的对象
//
// 引擎的 personalGoals 是 {id, type, longTerm, shortTerm, progress, priority} 对象数组（tm-endturn-prompt 读 g.longTerm）。
// 天启有 118 人的 personalGoals 含字符串（多是 merge-tianqi-historical-supplement.js 补人时写的 [personalGoal]），推演提示里便成了
// 「某某：undefined(0%)」，而且因为「已有目标」，AI 也不会替他们另立。皇太极另多一条与已有对象重复的字符串。
// 本补丁：
//   - 与已有对象 longTerm 相同的字符串删去；
//   - 其余字符串改为对象（type 按引擎通用的 custom，优先级取引擎默认 5）；
//   - 下列 20 人的「个人志向」写的是身份标签（「后金宗室长兄」「汉人谋主」「襁褓·无自觉」），不是目标，
//     不转成目标，personalGoals 清空，让推演按引擎本来的做法替无目标的人立目标。个人志向字段本身不动。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/tianqi-goals.js [--write]
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '天启七年·九月（官方）.json');

const IDENTITY_LABELS = new Set([
  '代善', '多尔衮', '阿敏', '范文程', '莽古尔泰', '济尔哈朗', '阿济格', '多铎', '佟养性', '李永芳', '林丹汗',
  '仁祖李倧', '郑芝龙', '王嘉胤', '高迎祥', '李自成', '张献忠', '郑成功', '李定国', '孙可望'
]);

function main() {
  const write = process.argv.includes('--write');
  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');

  const counts = { converted: 0, duplicate: 0, cleared: 0 };
  scenario.characters.forEach((c) => {
    if (!Array.isArray(c.personalGoals) || !c.personalGoals.some((g) => typeof g === 'string')) return;
    if (IDENTITY_LABELS.has(c.name)) { c.personalGoals = []; counts.cleared++; return; }
    const objects = c.personalGoals.filter((g) => g && typeof g === 'object');
    const taken = new Set(objects.map((g) => g.longTerm));
    let next = objects.length + 1;
    c.personalGoals = c.personalGoals.flatMap((g) => {
      if (typeof g !== 'string') return [g];
      if (taken.has(g)) { counts.duplicate++; return []; }
      counts.converted++;
      return [{ id: 'goal_' + next++, type: 'custom', longTerm: g, shortTerm: '', progress: 0, priority: 5 }];
    });
  });
  if (counts.cleared !== IDENTITY_LABELS.size) throw new Error('身份标签名单与剧本对不上：' + counts.cleared + ' / ' + IDENTITY_LABELS.size);

  console.log('字符串目标改对象 ' + counts.converted + ' 人，重复字符串删去 ' + counts.duplicate + ' 条，身份标签清空 ' + counts.cleared + ' 人');
  if (write) {
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('已写入 ' + path.relative(REPO, SCENARIO_FILE));
  }
}

main();
