# 新前端地基 · 施工图（2026-10-05）

同志令：「搭新前端的地基吧」。前情：概念稿四轮已定（甲书房外壳 + 乙立体青绿入图 + 第四轮古风细节），全在 `D:/tianming-ui-rebuild-20260926/concept/`，那里是样稿，这里起是正式仓里的新前端。

## 0. 不变的前提

- 新前端是**完整的新应用**，做完整体切换，不与老界面逐屏共存（09-26 同志令）。三块不重做：创意工坊、剧本工坊、地图编辑器——切换后仍从新界面以独立页打开老实现。
- 游戏 JS 内核原样复用；新界面只经**适配层**读状态、交动作、听变化。
- 美术只归我；Codex 只做勘察、生图执行与后端代码（feedback-gpt-no-art）。
- 两个将来的玩法变化要在地基里留口，不现在实现：
  1. **身份是一等参数**（官本位设计稿：「案头即身份」）——皇帝的御书房、官员的衙署签押房、白身的书斋是同一套场景层的三种房间；地基只建御书房，但路由、场景、顶栏都按身份取用。
  2. **时间控制**（设计稿「即时+结算」）——顶栏的时间件按「日期 + 调速 + 推演结算键 + 自动暂停」设计；内核现在仍是回合制，适配层把「过回合」暴露成 `advance()`，界面不写死「回合」。

## 1. 目录

```
web/ui/                     新前端（切换前老入口不加载它）
  index.html                新入口（开发期直接开它；切换时 web/index.html 让位）
  boot.js                   启动：环境与分档、字体、载入进度、内核、场景、首屏
  core/                     总线 bus、路由 router、设置 settings、分档 quality、计数写法 numerals、时间件模型 clock
  kit/                      界面器物（设计体系）：tokens.css fonts.css ornaments.js qi.css + components/*.js
  scene/                    场景层：stage.js（唯一渲染器）、study/（书房）、map/（舆图）、transitions.js、assets.js
  adapter/                  内核适配层：kernel-loader.js、legacy-shim.js、game.js（对界面的门面）
  screens/                  各页（地基之后做）
  assets/                   二进制资产（图、字、模型；按仓规不进 git），manifest.json 进 git
  dev/                      组件谱 gallery.html、场景台 stage.html、截图脚本
web/vendor/three/           Three.js r171（模块版与用到的 addons，MIT，进 git）
tools/ui-art/               素材管线：Blender 建屋建器物、烘光、降噪、贴图加工、字体子集、资产清单与校验
```

模块一律 ES module + import map，零构建（与仓内零编译一致；Electron file://、Capacitor https://localhost、Pages 都能直接跑）。

## 2. 四层与边界

| 层 | 管什么 | 不许做 |
|---|---|---|
| 适配层 adapter | 加载内核脚本、开局读档存档、`advance()`、五渠道与履职动作、把内核变化转成总线事件、读模型（选择器） | 画任何界面 |
| 场景层 scene | 唯一 WebGL 渲染器；书房（按身份）与舆图两类场景；镜头预设与飞行；入图；后期；分档 | 读 GM/P |
| 器物层 kit | 色板字体动效令牌、回纹云头连珠鱼尾纸纹、漆牌纸笺朱签牙牌印签子册页奏折邸报等组件 | 读 GM/P、碰 WebGL |
| 页面层 screens | 用器物拼页面，从适配层读、向适配层交 | 直接读写 GM/P（守卫：web/ui 下除 adapter/ 外出现 `GM.`/`P.` 即红） |

总线事件名统一 `域:事`（如 `game:advanced`、`memorial:arrived`、`scene:shot`），载荷是纯数据快照，不传内核对象引用。

## 3. 场景层

- `stage.js`：唯一 `WebGLRenderer`（色彩管理、色调映射、像素比按分档）、一个渲染循环（不可见时停）、尺寸与 DPR 自适应、合成（场景 → 后期 → DOM 层）。
- 书房 `study/`：由概念稿 `deskscene.js / desk-room.js / desk-fx.js / desk-textures.js / calligraphy.js` 整理而来：屋子 room.glb + 烘焙光照、器物 props.glb、案上绢图、立轴、匾、楹联、香烟、光柱浮尘；镜头预设 title / desk / court / memorial；身份参数决定房间与陈设（地基只有 sovereign）。
- 舆图 `map/`：由 `lab/map/mapview.js + data.js` 整理：青绿设色、起伏、点叶、远景雾、地名层；数据经适配层取（剧本地块、归属、治所），地形用仓内已有 `web/vendor/shanhe25d/`。
- 转场 `transitions.js`：镜头飞行、入图（案上绢图 → 立体舆图同机位交叉淡换）、展卷（面板出入）、淡入淡出；全部可中断。
- 分档 `core/quality.js`：首启跑一次 GPU 测速定档，设置里可改。
  - 高：烘焙光照 + 面光源 + 后期光柱浮尘 + 舆图全精度；
  - 中：去后期体积光、像素比 1、舆图降精度；
  - 低（安卓、核显）：静帧底图代替实时书房（同机位预渲），舆图最低精度、不点叶。

## 4. 器物层

由 `concept/shared/guofeng.css + guofeng.js` 与第四轮各页的样式提炼：令牌（色板、字族、字号阶、间距、阴影、动效时长曲线）→ 纹样（回纹九宫、云头、连珠、鱼尾、纸纹，SVG 生成 CSS 变量）→ 组件（工厂函数返回 DOM，不用框架）：

漆牌面板、纸笺面板、册页（竖排分栏）、奏折（经折）、邸报刻本页、朱签角标、牙牌按钮、漆牌按钮、签子页签（竖签）、印（sealCanvas）、小立轴人像、账目格（汉字记数 + 亏盈）、九品刻度、时间件、展卷对话框、签条提示、滚动卷、输入（笺上书写）、开关与滑杆（器物化）。

组件谱 `dev/gallery.html` 把每个组件的各状态摆出来，供审阅与截图回归。

## 5. 适配层（依勘察结果定稿）

Codex 三路只读勘察（报告在 `E:/tianming-tmp/newui-survey/`）：启动与生命周期、状态与玩家动作、老界面功能总账。我自己的静态统计：479 个启动脚本里 315 个（19.3 万行）零 DOM 访问，35 个低度，63 个混合（7.3 万行），66 个纯界面（5.7 万行）。

方向（勘察回来后定细节）：
- 新入口按清单加载脚本：内核与混合脚本照加载；纯界面脚本不加载；内核调用到的界面函数由 `legacy-shim.js` 接住转成总线事件（进度、弹窗、确认、提示）。
- 混合脚本里内核依赖的 DOM 节点，由 shim 提供一个不显示的最小骨架兜住，逐个登记、逐个消掉。
- 对界面的门面 `game.js`：`boot()`、`newGame(scenarioId, opts)`、`load(slot)`、`save(slot)`、`advance()`、`act.*`（五渠道与履职）、`select.*`（只读选择器，返回冻结快照）、`on(event, fn)`。

## 6. 素材管线

- 二进制资产（jpg/png/webp/ttf/woff2/hdr）按仓规不进 git；`web/ui/assets/manifest.json` 进 git，逐件记 路径、字节、sha256、来源脚本、源件位置。
- 源件常驻 `D:/tianming-ui-rebuild-20260926/art`（生图原图、公有领域画作）与 `fonts/`（字体原件），不放 Temp；成品都能由 `tools/ui-art/` 的脚本从源件重建。
- 字体：书法字与刻本字子集化 + woff2（现原件 237MB 不可接受）；界面正文字保全字集但切 unicode-range 分片。
- 模型与光照：room.glb、props.glb 走 meshopt 压缩；光照 HDR 转 RGBE PNG 或 KTX2（实测择一）。
- `tools/ui-art/check-assets.cjs`：按清单核对存在与哈希，进发版前置检查（避免 1.3.4.9 那种漏资产）。

## 7. 验收

- 每片：`node web/scripts/lint-arch-all.js` 全绿，外加会扫全仓 js 的 lint（localstorage、empty-catch、catch-console、timer-leaks、namespace、naming）全绿。
- 截图回归：`web/ui/dev/shoot.cjs` 拍组件谱、场景台各镜头，我逐张看。
- 适配层：浏览器内跑「开天启 → 读快照 → 推进一回合（无密钥路径）→ 存 → 读」的冒烟。
- 分支 `claude/newui-foundation-20261005`（已 unset upstream），本地逐片提交；推 main 等全部门禁绿、且同志点头。

## 8. 分片

1. **F1 骨架与器物**：worktree、three 入 vendor、`web/ui/` 骨架、kit 令牌纹样组件、组件谱。
2. **F2 场景层**：stage、书房（屋子器物光照立轴匾联烟）、舆图、镜头与转场，场景台复现概念稿四镜。
3. **F3 素材管线**：tools/ui-art 收编 Blender 与贴图脚本、字体子集、模型压缩、清单与校验。
4. **F4 适配层**：按勘察定稿；新入口开局、推进、存读档冒烟。
5. **F5 应用壳**：boot 载入（题签式进度）、路由、设置（分档、汉字/阿拉伯数字开关、动效）、时间件、启幕 → 御案 → 入图 → 奏折 串通。
