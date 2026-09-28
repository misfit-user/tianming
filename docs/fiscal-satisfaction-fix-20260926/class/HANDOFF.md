# 阶层压力及开局派生修复交接

生产文件已冻结，以下均在隔离候选树完成。主工作树未改。

## 改动文件

- `web/tm-social-political-signals.js`：军饷、地方民变、腐败的运行期和 AI 结果信号采用身份/经济角色/明确标签选择数值受影响者；忽略长描述与诉求词串。排除显式外方阶层、停用阶层、退役军事身份。地方影响按玩家地区人口覆盖缩放，已知安全地域阶层不扣；纯叙述无可定位实况不制造全国扣分。
- `web/tm-party-class-ecology.js`：数值受影响阶层明确的信号禁止再被议题匹配扩成全体；受影响者的党派议程/关系推断仍保留。
- `web/tm-patches-start.js`：旧版人口剧本也使用 `Renli.prime` 派生，不调用 `endturnTick` 进行启动结算。
- `web/tm-renli.js`：兼容旧剧本 P/GM 区划分离时试点种子只在 P 的情况；prime 按原有种子派生视图，不迁移人口、不衰减地力、不扣满意度或倒计时。
- 新测试 `web/scripts/smoke-class-pressure-scope.js`、`web/scripts/smoke-opening-renli-prime.js`。

未改 class-engine 预算、party-state 凝聚力、loader、版本或基线；这些由其他代理/主代理处理。

## 实测

完整天启官方启动九阶层满意度保持根 JSON 原值。自耕农26，修前12；启动满意度过闸0次。连续prime两次，人口、地力、国库、政策时间、满意度、奏折/信件均未结算变化，役政视图仍已派生。

只给军队欠饷时：官方九阶层仅军户受扣，英语自定义 military 标签与 garrison 角色可正常受扣；foreign 与 retired 明确身份不受本国现役欠饷影响。真实欠饷保留每轮 -5，连续三轮仍生效，清欠后停止。AI发饷 +3 和欠饷 -5 使用同一对象范围。

地方10%人口低民心时：全国农户阶层只承受该覆盖比例，安全西部农户0，东部农户保留完整当地压力；AI地方结果也按10%缩放为-0.5。外方地区低民心不触发玩家国内压力。僧道描述提到“士林”不再被腐败信号扣6；士大夫、缙绅、商人、工匠的真实腐败压力保留。

## 六次社会链隔离对照（非完整回合）

`probe-class-after.cjs` 用完整官方启动，再只运行真实 scheduler 与 SocialFoundation，无玩家操作/无AI调用，无外部经济或军队tick；包含社会链自身反馈。完整逐笔数据在 `class-after-results.json`。

| 阶层 | 开局 | 第1次 | 第3次 | 第6次 |
|---|---:|---:|---:|---:|
| 宗室 | 62 | 60.08 | 56.7 | 55.09 |
| 士大夫 | 30 | 22.9 | 8.7 | 0.9 |
| 缙绅 | 64 | 56.4 | 42.2 | 23.7 |
| 自耕农 | 26 | 22.86 | 16.58 | 11.16 |
| 佃农与流民 | 10 | 6.86 | 0.9 | 0.9 |
| 商人 | 50 | 40.86 | 22.58 | 0.9 |
| 工匠 | 36 | 26.86 | 8.58 | 0.9 |
| 军户 | 22 | 15.9 | 3.7 | 0.9 |
| 僧道·外籍 | 55 | 53.16 | 46.31 | 39.69 |

仅压力扫描的对照里，宗室62和僧道55连续六次均不变；社会链完整子集仍有 actor 的罢工/起事等动作成本、结构回归，受真实腐败和欠饷影响的阶层仍会持续下降。本次修复没有把压力改成零，也未调整这部分难度。

## 已通过的定向检查

```text
node web/scripts/smoke-class-pressure-scope.js
node web/scripts/smoke-opening-renli-prime.js
node web/scripts/smoke-social-political-signals.js
node web/scripts/smoke-party-class-ecology.js
node web/scripts/smoke-class-minxin-bridge.js
node web/scripts/smoke-party-class-action-scheduler.js
node web/scripts/smoke-party-class-tuning.js
node web/scripts/smoke-party-class-closed-loop.js
node web/scripts/smoke-opening-regional-pressure.js   # 83 assertions
node web/scripts/smoke-renli-data-base.js             # 23 assertions
node web/scripts/smoke-renli-pilot-seed.js             # 22 assertions
node web/scripts/smoke-renli-satisfaction-flight.js   # 11 assertions
node web/scripts/smoke-class-satisfaction-guard.js    # 29 assertions, party agent预算版本
```

源码 `node --check` 通过。完整架构/CI门禁交主代理执行。

## 字节与备份

原字节保存在 `docs/fiscal-satisfaction-fix-20260926/backups/class/`。patches-start原文件混合2200个CRLF和31个LF，修后2199个CRLF和31个LF，仅删除一条结算分支。备份SHA256 `149259d2f2972a0131b9f483b6b1b989f157536018ab59ae9f5e6ebc5c1864b2` 与主代理source-snapshot相符。其余三个修改源文件保持原LF。没有添加BOM或转换其余行尾。
