// 从修复前的原版晚唐剧本出发，按顺序重跑本目录的晚唐补丁，重新生成真源与报告。
// 各补丁都是确定性的，重跑结果应逐字节相同；改了补丁或数据模块之后，用它整体重建。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/rebuild-tang.js
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '../../..');
const DIR = path.join(REPO, 'docs/scenario-data-repair-20260924');
const SCENARIO_REL = 'scenarios/晚唐·开成五年（官方）.json';
// 人物一刀要增删五常参考档里的条目，重建时一并写回原版
const WUCHANG_REL = 'web/assets/reference/tang840-wuchang.json';

// 晚唐修复开始时，真源最后一次改动的提交；这之后晚唐真源只被本目录的补丁改过
const BASE_COMMIT = 'ffb2db25';

function run(args) {
  const out = execFileSync(process.execPath, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.trim().split('\n').pop();
}

function main() {
  const original = execFileSync('git', ['show', BASE_COMMIT + ':' + SCENARIO_REL], { cwd: REPO, maxBuffer: 256 * 1024 * 1024 });
  fs.writeFileSync(path.join(REPO, SCENARIO_REL), original);
  fs.writeFileSync(path.join(REPO, WUCHANG_REL), execFileSync('git', ['show', BASE_COMMIT + ':' + WUCHANG_REL], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }));
  console.log('已写回原版（' + BASE_COMMIT + '）');
  // 第一刀：死字段清理、格式归一、道长官官称
  console.log('字段清理：' + run([path.join(DIR, 'patches/tang-fields.js'), '--report', path.join(DIR, 'reports/tang-fields.md'), '--write']));
  // 第二刀：唐廷与河朔、昭义四镇道内各州按天宝户重分户口与随人口走的账，开局账按财政引擎重算
  console.log('户口重建：' + run([path.join(DIR, 'patches/tang-households.js'), '--report', path.join(DIR, 'reports/tang-households.md'), '--write']));
  // 第三刀：府州官守、治所与土贡物产，仪州改回开成年间的辽州
  console.log('官守物产：' + run([path.join(DIR, 'patches/tang-offices.js'), '--report', path.join(DIR, 'reports/tang-offices.md'), '--write']));
  // 第四刀之一：人物字段去伪（删抄件与制作用语，personalGoals 改为引擎对象）
  console.log('人物字段：' + run([path.join(DIR, 'patches/tang-people-fields.js'), '--report', path.join(DIR, 'reports/tang-people-fields.md'), '--write']));
  // 第四刀之二：史实人物逐人改正，补开局在任的节帅、观察使与府尹
  console.log('人物改正：' + run([path.join(DIR, 'patches/tang-people.js'), '--report', path.join(DIR, 'reports/tang-people.md'), '--write']));
  // 第四刀之三：删去唐廷与河朔、昭义四镇的批量地方代表，神策军交还两中尉，驻治所的军队归本道长官
  console.log('批量代表：' + run([path.join(DIR, 'patches/tang-local-reps.js'), '--report', path.join(DIR, 'reports/tang-local-reps.md'), '--write']));
  // 第五刀：各道属州按元和志与开成间任命改正（郢州、连州、龚州改挂，丹州并回鄜坊，同州、华州各立一道）
  console.log('各道属州：' + run([path.join(DIR, 'patches/tang-membership.js'), '--report', path.join(DIR, 'reports/tang-membership.md'), '--write']));
  // 第六刀之一：外藩名目与归属（拼盘势力按史实拆散归属，势力、道、地块改用史名，都城指到地块，役属关系）
  console.log('外藩名目：' + run([path.join(DIR, 'patches/tang-foreign-names.js'), '--report', path.join(DIR, 'reports/tang-foreign-names.md'), '--write']));
  // 第六刀之二：外藩人物（删去其余批量地方代表，史实人物改正年龄、官衔、文化与名字写法）
  console.log('外藩人物：' + run([path.join(DIR, 'patches/tang-foreign-people.js'), '--report', path.join(DIR, 'reports/tang-foreign-people.md'), '--write']));
  // 第六刀之三：外藩补入史实人物（回鹘、吐蕃、南诏、黠戛斯、日本、新罗诸人与开成四年末入朝的来使，黠戛斯等写上首领）
  console.log('外藩补人：' + run([path.join(DIR, 'patches/tang-foreign-newpeople.js'), '--report', path.join(DIR, 'reports/tang-foreign-newpeople.md'), '--write']));
  // 第六刀之四：外藩人口重分（每家合计不动；日本按和名抄乡数、新罗按郡县数、渤海按领州数、吐蕃河陇取天宝口，其余按面积与地形估）
  console.log('外藩人口：' + run([path.join(DIR, 'patches/tang-foreign-population.js'), '--report', path.join(DIR, 'reports/tang-foreign-population.md'), '--write']));
  // 第七刀之一：引用与关系（统兵官按别名认人、人名异写统一、势力关系按开局时的实际关系逐条改写并补入原缺的几条）
  console.log('引用关系：' + run([path.join(DIR, 'patches/tang-references.js'), '--report', path.join(DIR, 'reports/tang-references.md'), '--write']));
  // 第七刀之二：外藩各道描述（同一势力内四块改挂，照抄势力总述与改道说明的道逐道重写）
  console.log('各道描述：' + run([path.join(DIR, 'patches/tang-circuit-texts.js'), '--report', path.join(DIR, 'reports/tang-circuit-texts.md'), '--write']));
  // 第九刀：年龄无考的人物按任官年代、亲属等推估开局年龄（须在才具一刀之前：才具按年龄做少、老的折减）
  console.log('人物年龄：' + run([path.join(DIR, 'patches/tang-ages.js'), '--report', path.join(DIR, 'reports/tang-ages.md'), '--write']));
  // 第七刀之三：人物才具与五常（模板值与套用中位数的人逐人按史料重定）
  console.log('才具五常：' + run([path.join(DIR, 'patches/tang-abilities.js'), '--report', path.join(DIR, 'reports/tang-abilities.md'), '--write']));
  // 第八刀：外藩阶层处境（专属某地的行只留在该地，改挂来的通用模板与地貌不合的换成已有的合适一套）
  console.log('阶层处境：' + run([path.join(DIR, 'patches/tang-social.js'), '--report', path.join(DIR, 'reports/tang-social.md'), '--write']));
  // 第十一刀：人物家产（套写的家产与家用按身份分层取锚点中位数，有开局前涉财行迹的乘倍数）
  console.log('人物家产：' + run([path.join(DIR, 'patches/tang-wealth.js'), '--report', path.join(DIR, 'reports/tang-wealth.md'), '--write']));
  // 第十刀：死条目与抄件（环境承载只留引擎按 id 取得到的玩家各道，兵制 effects 由照抄 description 改为结构字段简述）
  console.log('死条目抄件：' + run([path.join(DIR, 'patches/tang-cleanup.js'), '--report', path.join(DIR, 'reports/tang-cleanup.md'), '--write']));
  // 第十二刀：官俸（同类独低、副职与正职同俸的两处改正，会动财政平衡的建议只写进报告）
  console.log('官俸：' + run([path.join(DIR, 'patches/tang-pay.js'), '--report', path.join(DIR, 'reports/tang-pay.md'), '--write']));
}

main();
