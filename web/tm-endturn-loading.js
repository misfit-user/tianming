// ============================================================
//  tm-endturn-loading.js — 过回合电影化加载层
//
//  订阅 TM.Endturn.Progress（tm-endturn-progress.js）的拍事件，
//  在「时移事去」→ hideLoading 的过回合窗口内，以全屏影像 +
//  组叙事标题 + 起居注流水 + 真实拍序进度，顶替旧 #loading 小框。
//  非过回合的 showLoading 调用（开局生成/读档/科举等）不受影响，
//  旧框原样工作。
//
//  设计稿：web/preview/endturn-loading-preview.html（对照预览）
//  场景图：web/assets/etl-scenes/etl-01..34.jpg（随机轮换·owner 拍）
//  层级：z-index 996 与旧 #loading 同层——朝会/史记弹窗(997)天然压上。
//  性能：常驻动效仅 transform/opacity（compositor 合成），无整屏重绘
//  动画；进度数值镜像旧框 #loading-fill（含爬升），不另起一套账。
// ============================================================
(function() {
  'use strict';
  if (!window.TM || !TM.Endturn || !TM.Endturn.Progress) return;

  var SCENE_BASE = 'assets/etl-scenes/';
  var SCENES = [
    { f: 'etl-01.jpg', tone: '内苑传闻' }, { f: 'etl-02.jpg', tone: '阁臣夜议' },
    { f: 'etl-03.jpg', tone: '朝议成案' }, { f: 'etl-04.jpg', tone: '边关急牍' },
    { f: 'etl-05.jpg', tone: '廷议复核' }, { f: 'etl-06.jpg', tone: '守城来报' },
    { f: 'etl-07.jpg', tone: '漕路回传' }, { f: 'etl-08.jpg', tone: '驿路入京' },
    { f: 'etl-09.jpg', tone: '户部清册' }, { f: 'etl-10.jpg', tone: '廷臣聚议' },
    { f: 'etl-11.jpg', tone: '军情火急' }, { f: 'etl-12.jpg', tone: '边镇日暮' },
    { f: 'etl-13.jpg', tone: '水驿邸报' }, { f: 'etl-14.jpg', tone: '案牍封奏' },
    { f: 'etl-15.jpg', tone: '边野侦骑' }, { f: 'etl-16.jpg', tone: '营门传令' },
    { f: 'etl-17.jpg', tone: '内殿会审' }, { f: 'etl-18.jpg', tone: '殿中奏对' },
    { f: 'etl-19.jpg', tone: '禁中夜雨' }, { f: 'etl-20.jpg', tone: '百官朝参' },
    { f: 'etl-21.jpg', tone: '兵部急报' }, { f: 'etl-22.jpg', tone: '烽火边警' },
    { f: 'etl-23.jpg', tone: '关津税报' }, { f: 'etl-24.jpg', tone: '驿路星驰' },
    { f: 'etl-25.jpg', tone: '地方灾报' }, { f: 'etl-26.jpg', tone: '民夫调运' },
    { f: 'etl-27.jpg', tone: '城下军报' }, { f: 'etl-28.jpg', tone: '乡堡点验' },
    { f: 'etl-29.jpg', tone: '市井征收' }, { f: 'etl-30.jpg', tone: '内廷收束' },
    { f: 'etl-31.jpg', tone: '百官候旨' }, { f: 'etl-32.jpg', tone: '夜殿密奏' },
    { f: 'etl-33.jpg', tone: '史馆校书' }, { f: 'etl-34.jpg', tone: '帘内议政' }
  ];

  // 拍 id → 展示名 + 诗行（与拍表引擎 BEATS 一一对应）
  var META = {
    'core-start':     { name: '时移事去',       line: '风雨入阁，诸司回奏。' },
    'step-1':         { name: '整理本回合操作', line: '案牍先清，旧事归档。' },
    'step-2':         { name: '预取辅助资料',   line: '旁证先行，静候主推。' },
    'step-3':         { name: 'AI 主推演',      line: '朝野脉络，归入一问。' },
    'infer-db':       { name: '检索数据库',     line: '故牍翻检，史料就位。' },
    'infer-pack':     { name: '打包数据',       line: '诸司案卷，封函待发。' },
    'ai-think':       { name: 'AI 深度思考',    line: '主机沉吟，天下在抱。' },
    'ai-stream':      { name: 'AI 推演中',      line: '笔走龙蛇，万言将成。' },
    'ai-review':      { name: '深度回顾',       line: '复盘前事，查漏补缺。' },
    'ai-text':        { name: '史官成文',       line: '时政记成，初稿付梓。' },
    'ai-parallel':    { name: '并行推演',       line: '诸路并发，各演其势。' },
    'fu-npc':         { name: 'NPC 全面推演',   line: '群臣各行其志，暗流自生。' },
    'fu-faction':     { name: '势力自主推演',   line: '诸方势力，自谋其局。' },
    'fu-econ':        { name: '经济财政推演',   line: '钱粮流转，市易自衡。' },
    'fu-military':    { name: '军事态势推演',   line: '烽燧相望，兵机自演。' },
    'fu-memory':      { name: 'NPC 记忆回写',   line: '人各有记，恩怨入心。' },
    'fu-tale':        { name: '后人戏说',       line: '稗官野史，后人妄议。' },
    'fu-quality':     { name: '叙事质量审查',   line: '史笔有失，覆核再三。' },
    'fu-cognition':   { name: 'NPC 认知整合',   line: '众人所见，归于一史。' },
    'fu-history':     { name: '历史检查',       line: '史事比对，毫厘必究。' },
    'fu-parse':       { name: '解析推演结果',   line: '结构成形，变更可施。' },
    'step-4':         { name: '应用诏令附效',   line: '诏令落地，官军随动。' },
    'step-5':         { name: '系统结算',       line: '日月折算，诸司分层推进。' },
    'sys-update':     { name: '更新数据',       line: '诸司账簿，逐项更易。' },
    'sys-npc-engine': { name: 'NPC 行为引擎',   line: '群机运转，编年自进。' },
    'sys-territory':  { name: '计算领地产出',   line: '田亩仓廪，岁入有数。' },
    'sys-fiscal':     { name: '财政结算',       line: '钱粮出入，俸饷归簿。' },
    'sys-changes':    { name: '应用决策变动',   line: '变动排队，逐项落库。' },
    'sys-history':    { name: '检查历史事件',   line: '史事将临，先验其期。' },
    'sys-tenure':     { name: '检查职位与寿数', line: '宦海浮沉，寿数有时。' },
    'sys-listeners':  { name: '处理监听队列',   line: '监听余波，关系自衰。' },
    'sys-cache':      { name: '清理回合缓存',   line: '故纸归匣，明日再启。' },
    'step-6':         { name: '生成史记',       line: '史官缀词，卷轴将开。' },
    'render-shiji':   { name: '生成史记弹窗',   line: '万事归卷，一笔定章。' },
    // ── 模式 b · agent 模式拍（复用动画·换拍内容）──
    'agent-engine':   { name: '引擎结算',       line: '硬核先定，钱粮兵甲入账。' },
    'agent-perceive': { name: '亲览局面',       line: '御目所及，天下尽收。' },
    'agent-loop':     { name: '亲裁推演',       line: '乾纲独断，逐事落子。' },
    'agent-narrate':  { name: '撰史定章',       line: '御笔亲裁，史册自成。' }
  };

  var GROUP_TITLES = {
    entry: '时移事去', prep: '整理案牍', prefetch: '史料先行', ai: '朝野推演',
    deepsim: '诸方并演', edict: '诏令落地', systems: '诸司运转', render: '史官缀笔', final: '御览将呈'
  };
  var GROUP_GLYPHS = {
    entry: '起', prep: '牍', prefetch: '驿', ai: '推',
    deepsim: '演', edict: '诏', systems: '司', render: '笔', final: '御'
  };
  var GROUP_NAMES = {
    entry: '起', prep: '整理', prefetch: '预取', ai: 'AI',
    deepsim: '深推', edict: '诏效', systems: '系统', render: '史记', final: '呈览'
  };
  var GROUP_ACCENTS = {
    entry:   ['228, 196, 117', '184, 74, 56'],
    prep:    ['226, 196, 117', '128, 84, 38'],
    prefetch:['196, 176, 120', '94, 108, 86'],
    ai:      ['232, 210, 142', '170, 68, 50'],
    deepsim: ['198, 196, 156', '96, 104, 118'],
    edict:   ['232, 184, 94',  '184, 74, 56'],
    systems: ['186, 205, 174', '115, 76, 42'],
    render:  ['225, 194, 132', '144, 48, 38'],
    final:   ['246, 222, 154', '190, 72, 46']
  };

  var CSS = [
    '#tm-etl{position:fixed;inset:0;z-index:996;display:none;overflow:hidden;isolation:isolate;background:#0a0704;color:#f5ead0;',
    '  --acc:228,196,117;--cin:184,74,56;',
    '  --etl-display:"Source Han Serif SC Heavy","Source Han Serif SC","Noto Serif CJK SC","Noto Serif SC","STZhongsong","SimSun",serif;',
    '  --etl-serif:"Source Han Serif SC","Noto Serif CJK SC","Noto Serif SC","STZhongsong","SimSun",serif;',
    '  --etl-narr:"FangSong","STFangsong","KaiTi","Kaiti SC","SimSun",serif;',
    '  --etl-sans:"Microsoft YaHei UI","Microsoft YaHei","Source Han Sans SC","Noto Sans CJK SC","Segoe UI",sans-serif;',
    '  font-family:var(--etl-serif);}',
    '#tm-etl.show{display:block;}',
    '#tm-etl.is-finishing{transition:opacity 650ms ease;opacity:0;}',
    '#tm-etl.is-court-hidden{visibility:hidden;}',
    '.loading.tm-etl-suppress{display:none!important;}',
    /* 背景影像双缓冲 */
    '.tm-etl-bg,.tm-etl-bg-next{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center;',
    '  filter:saturate(.86) contrast(1.08) brightness(.72);transform:scale(1.055);transform-origin:58% 46%;',
    '  transition:opacity 1400ms ease,transform 2200ms ease;will-change:opacity,transform;',
    '  animation:tm-etl-drift 16s ease-in-out infinite alternate;}',
    '.tm-etl-bg-next{opacity:0;}',
    '#tm-etl.is-swapping .tm-etl-bg{opacity:0;transform:scale(1.075) translate3d(-.35%,.15%,0);}',
    '#tm-etl.is-swapping .tm-etl-bg-next{opacity:1;transform:scale(1.055) translate3d(.2%,-.12%,0);',
    '  -webkit-mask-image:radial-gradient(circle at 44% 50%,black 55%,transparent 74%);mask-image:radial-gradient(circle at 44% 50%,black 55%,transparent 74%);',
    '  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:44% 50%;mask-position:44% 50%;',
    '  animation:tm-etl-inkwipe 1400ms ease forwards;}',
    /* 帷幕暗角（静态·零重绘） */
    '.tm-etl-veil{position:absolute;inset:0;z-index:1;pointer-events:none;background:',
    '  linear-gradient(90deg,rgba(5,4,3,.95) 0%,rgba(8,6,4,.68) 34%,rgba(8,6,4,.22) 62%,rgba(5,4,3,.82) 100%),',
    '  linear-gradient(180deg,rgba(8,6,4,.86) 0%,rgba(8,6,4,.12) 34%,rgba(8,6,4,.94) 100%);}',
    '.tm-etl-grain{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.12;mix-blend-mode:soft-light;background:',
    '  repeating-radial-gradient(circle at 18% 22%,rgba(255,255,255,.24) 0 1px,transparent 1px 7px),',
    '  repeating-radial-gradient(circle at 76% 62%,rgba(0,0,0,.35) 0 1px,transparent 1px 9px);',
    '  background-size:220px 180px,260px 220px;}',
    '.tm-etl-wash{position:absolute;inset:-10%;z-index:1;pointer-events:none;opacity:.5;mix-blend-mode:screen;background:',
    '  linear-gradient(112deg,transparent 0 18%,rgba(var(--acc),.13) 34%,transparent 54%),',
    '  linear-gradient(82deg,rgba(var(--cin),.12),transparent 42%,rgba(var(--acc),.08) 78%,transparent);',
    '  filter:blur(10px);animation:tm-etl-wash 9s ease-in-out infinite;}',
    /* 金尘微粒 */
    '.tm-etl-motes{position:absolute;inset:0;z-index:2;pointer-events:none;mix-blend-mode:screen;}',
    '.tm-etl-mote{position:absolute;left:var(--mx,20%);bottom:-2vh;width:3px;height:3px;border-radius:50%;',
    '  background:rgba(var(--acc),.85);box-shadow:0 0 8px rgba(var(--acc),.55);filter:blur(.4px);opacity:0;',
    '  animation:tm-etl-mote var(--md,13s) linear infinite;animation-delay:var(--mdl,0s);}',
    '.tm-etl-mote:nth-child(2n){width:2px;height:2px;}',
    '.tm-etl-mote:nth-child(3n){width:4px;height:4px;filter:blur(1px);}',
    /* 装裱描金 */
    '.tm-etl-mount{position:absolute;inset:12px clamp(16px,3vw,40px);z-index:3;pointer-events:none;opacity:.5;}',
    '.tm-etl-mount::before,.tm-etl-mount::after{content:"";position:absolute;left:0;right:0;height:1px;',
    '  background:linear-gradient(90deg,transparent,rgba(var(--acc),.5) 18%,rgba(var(--acc),.5) 82%,transparent);}',
    '.tm-etl-mount::before{top:0;}.tm-etl-mount::after{bottom:0;}',
    /* 组巨字水印 */
    '.tm-etl-glyph{position:absolute;right:-1.5vw;top:50%;z-index:2;transform:translateY(-52%) rotate(3deg);pointer-events:none;',
    '  font-family:var(--etl-display);font-size:clamp(280px,46vh,470px);font-weight:900;line-height:1;',
    '  color:rgba(var(--acc),.045);-webkit-text-stroke:1px rgba(var(--acc),.14);text-shadow:0 0 90px rgba(var(--acc),.08);}',
    '#tm-etl.is-title-swap .tm-etl-glyph{animation:tm-etl-glyphpop 760ms cubic-bezier(.3,.7,.2,1) both;}',
    /* 起居注 */
    '.tm-etl-annals{position:absolute;right:clamp(20px,4.6vw,64px);top:50%;z-index:3;transform:translateY(-50%);',
    '  height:min(62vh,560px);max-width:min(300px,23vw);overflow:hidden;pointer-events:none;writing-mode:vertical-rl;',
    '  font-family:var(--etl-narr);font-size:12.5px;font-weight:500;letter-spacing:.14em;line-height:1;',
    '  color:rgba(245,234,208,.38);text-shadow:0 2px 10px rgba(0,0,0,.7);',
    '  -webkit-mask-image:linear-gradient(180deg,transparent,black 9%,black 88%,transparent);mask-image:linear-gradient(180deg,transparent,black 9%,black 88%,transparent);}',
    '.tm-etl-annal{display:block;margin-block-end:13px;white-space:nowrap;}',
    '.tm-etl-annal.is-gs::before{content:"·";color:rgba(var(--cin),.9);font-weight:900;}',
    '.tm-etl-annal.is-fresh{animation:tm-etl-annalin 520ms cubic-bezier(.22,1,.36,1) both;}',
    /* 中轴主栏 */
    '.tm-etl-main{position:relative;z-index:4;display:flex;align-items:center;min-height:100vh;}',
    '.tm-etl-inner{position:relative;width:min(650px,calc(100vw - 36px));margin-left:clamp(22px,10vw,148px);',
    '  padding-left:clamp(0px,1.4vw,20px);transform:translateY(-5vh);animation:tm-etl-arrive 780ms cubic-bezier(.22,1,.36,1) both;}',
    '.tm-etl-inner::before{content:"";position:absolute;left:0;top:10px;bottom:8px;width:1px;pointer-events:none;',
    '  background:linear-gradient(180deg,transparent,rgba(var(--acc),.62) 16%,rgba(var(--cin),.36) 58%,transparent);',
    '  box-shadow:0 0 24px rgba(var(--acc),.2);opacity:.7;}',
    '.tm-etl-inner::after{content:"";position:absolute;left:0;top:10px;width:min(260px,44vw);height:1px;pointer-events:none;',
    '  background:linear-gradient(90deg,rgba(var(--acc),.56),transparent);opacity:.44;}',
    '.tm-etl-date{display:flex;align-items:center;gap:9px;min-height:22px;margin-bottom:12px;color:rgba(var(--acc),.76);',
    '  font-family:var(--etl-sans);font-variant-numeric:tabular-nums;font-size:12px;font-weight:600;letter-spacing:.08em;',
    '  text-shadow:0 2px 12px rgba(0,0,0,.78);transition:color 360ms ease;}',
    '.tm-etl-date::before{content:"";width:46px;height:1px;background:linear-gradient(90deg,rgba(var(--acc),.72),rgba(var(--cin),.24),transparent);}',
    '.tm-etl-title{margin:0;color:transparent;font-family:var(--etl-display);font-size:clamp(56px,8vw,96px);font-weight:900;',
    '  line-height:.92;letter-spacing:.09em;text-indent:.09em;white-space:nowrap;word-break:keep-all;',
    '  background:linear-gradient(180deg,#fff3c8 0%,rgba(var(--acc),.96) 34%,rgba(117,77,34,.98) 74%,#f8e7ad 100%);',
    '  background-size:100% 180%;-webkit-background-clip:text;background-clip:text;',
    '  text-shadow:0 1px 0 rgba(255,248,219,.18),0 22px 52px rgba(0,0,0,.86);',
    '  animation:tm-etl-goldshift 8.4s ease-in-out infinite;}',
    '.tm-etl-title-text{display:inline-block;}',
    '#tm-etl.is-title-swap .tm-etl-title-text{animation:tm-etl-titleswap 760ms cubic-bezier(.3,.7,.2,1) both;}',
    '.tm-etl-line{width:min(500px,100%);margin-top:22px;color:rgba(245,234,208,.9);font-family:var(--etl-narr);',
    '  font-size:clamp(18px,1.7vw,22px);font-weight:500;line-height:1.58;letter-spacing:.035em;',
    '  text-shadow:0 1px 0 rgba(255,239,198,.08),0 3px 16px rgba(0,0,0,.86);transition:color 360ms ease;}',
    /* 进度区 */
    '.tm-etl-pwrap{position:relative;width:min(520px,100%);margin-top:24px;padding-top:10px;}',
    '.tm-etl-pwrap::before{content:"";position:absolute;top:0;left:0;width:100%;height:1px;opacity:.38;',
    '  background:linear-gradient(90deg,rgba(var(--acc),.72),rgba(var(--cin),.28),transparent 76%);}',
    '.tm-etl-pmeta{display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin-bottom:8px;',
    '  color:rgba(var(--acc),.82);font-family:var(--etl-sans);font-variant-numeric:tabular-nums;font-size:11px;font-weight:700;letter-spacing:.04em;}',
    '.tm-etl-pmeta span:first-child{max-width:74%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.tm-etl-pmeta span:last-child{color:rgba(246,234,202,.74);font-size:10px;font-weight:800;}',
    '.tm-etl-bar{position:relative;height:10px;overflow:hidden;background:',
    '  repeating-linear-gradient(90deg,transparent 0 calc((100% / var(--mc,34)) - 1px),rgba(var(--acc),.2) calc((100% / var(--mc,34)) - 1px) calc(100% / var(--mc,34))),',
    '  linear-gradient(90deg,rgba(8,6,4,.88),rgba(18,13,8,.84));',
    '  box-shadow:inset 0 0 0 1px rgba(var(--acc),.2),inset 0 0 18px rgba(0,0,0,.9),0 12px 28px rgba(0,0,0,.42);}',
    '.tm-etl-fill{position:absolute;inset:0 auto 0 0;width:8%;',
    '  background:linear-gradient(90deg,rgba(var(--cin),.72),rgba(var(--acc),.98) 62%,rgba(var(--cin),.9));',
    '  box-shadow:0 0 18px rgba(var(--acc),.3),0 0 1px rgba(255,244,210,.9);transition:width 420ms cubic-bezier(.22,1,.36,1);}',
    '.tm-etl-fill::before{content:"";position:absolute;top:-5px;right:-4px;width:9px;height:20px;',
    '  background:linear-gradient(180deg,rgba(255,244,210,.95),rgba(var(--acc),.85) 55%,rgba(var(--cin),.8));',
    '  clip-path:polygon(50% 0,92% 30%,62% 100%,22% 58%);box-shadow:0 0 16px rgba(var(--acc),.8);}',
    '.tm-etl-fill::after{content:"";position:absolute;inset:0;opacity:.74;',
    '  background:linear-gradient(90deg,transparent,rgba(255,244,210,.65),transparent);transform:translateX(-80%);',
    '  animation:tm-etl-shimmer 2.2s linear infinite;}',
    '.tm-etl-rail{display:grid;grid-template-columns:repeat(var(--mc,34),minmax(0,1fr));gap:2px;width:100%;height:18px;margin-top:8px;}',
    '.tm-etl-cell{position:relative;min-width:0;overflow:hidden;border-top:1px solid rgba(var(--acc),.16);opacity:.5;}',
    '.tm-etl-cell::before{content:"";position:absolute;left:0;right:0;top:5px;height:3px;background:rgba(223,205,166,.16);',
    '  transform-origin:left center;transform:scaleX(.28);transition:transform 320ms ease,background 240ms ease;}',
    '.tm-etl-cell.is-done::before{transform:scaleX(1);background:rgba(var(--acc),.56);}',
    '.tm-etl-cell.is-active{opacity:1;}',
    '.tm-etl-cell.is-active::before{transform:scaleX(1);background:rgba(245,234,208,.92);box-shadow:0 0 13px rgba(var(--acc),.64);',
    '  animation:tm-etl-cellpulse 820ms ease-in-out infinite alternate;}',
    '.tm-etl-queue{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(0,1fr);gap:10px;width:min(520px,100%);margin-top:6px;',
    '  color:rgba(232,217,184,.5);font-family:var(--etl-sans);font-variant-numeric:tabular-nums;font-size:10.5px;font-weight:600;line-height:1.4;letter-spacing:.025em;}',
    '.tm-etl-queue span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.tm-etl-queue span:first-child{color:rgba(var(--acc),.62);font-weight:800;}',
    '.tm-etl-queue .now{color:rgba(246,234,202,.86);font-weight:800;}',
    '.tm-etl-flow{display:grid;grid-template-columns:repeat(var(--fc,9),minmax(0,1fr));gap:2px;width:min(520px,100%);margin-top:12px;}',
    '.tm-etl-step{position:relative;height:23px;padding-top:7px;border-top:1px solid rgba(var(--acc),.13);',
    '  color:rgba(223,205,166,.36);font-family:var(--etl-sans);font-size:10.5px;font-weight:700;line-height:1;letter-spacing:.035em;',
    '  overflow:hidden;white-space:nowrap;transition:color 180ms ease,border-color 180ms ease;}',
    '.tm-etl-step::before{content:"";position:absolute;top:-4px;left:0;width:6px;height:6px;border-radius:50%;',
    '  background:rgba(var(--acc),.22);box-shadow:0 0 0 1px rgba(8,6,4,.7);}',
    '.tm-etl-step.is-done{color:rgba(var(--acc),.5);border-color:rgba(var(--acc),.3);}',
    '.tm-etl-step.is-done::before{content:"讫";width:14px;height:14px;top:-8px;border-radius:2px;',
    '  background:linear-gradient(145deg,rgba(205,79,58,.92),rgba(111,33,26,.94));',
    '  box-shadow:0 0 0 1px rgba(57,12,8,.6),0 2px 6px rgba(0,0,0,.5);color:#ffe9d8;',
    '  font-family:var(--etl-sans);font-size:9px;font-weight:700;line-height:14px;text-align:center;',
    '  transform:rotate(-8deg);animation:tm-etl-stamp 300ms cubic-bezier(.3,.8,.2,1) both;}',
    '.tm-etl-step.is-active{color:rgba(245,234,208,.9);border-color:rgba(245,234,208,.64);text-shadow:0 0 14px rgba(var(--acc),.42);}',
    '.tm-etl-step.is-active::before{background:rgba(var(--acc),.98);box-shadow:0 0 14px rgba(var(--acc),.7);}',
    /* 落印 */
    '.tm-etl-seal{position:absolute;left:50%;top:50%;z-index:6;width:132px;height:132px;display:grid;place-items:center;',
    '  border-radius:8px;opacity:0;pointer-events:none;color:#fff0e2;font-family:var(--etl-display);font-size:30px;font-weight:900;',
    '  letter-spacing:.16em;text-indent:.16em;border:2px solid rgba(57,12,8,.95);',
    '  background:linear-gradient(145deg,rgba(205,79,58,.98),rgba(111,33,26,.98)),#9d3326;',
    '  box-shadow:inset 0 1px 3px rgba(255,225,184,.35),inset 0 -8px 16px rgba(42,7,4,.26),0 18px 70px rgba(79,14,8,.65);',
    '  transform:translate(-50%,-50%) scale(.38) rotate(-8deg);}',
    '.tm-etl-seal::after{content:"";position:absolute;inset:8px;border:1px solid rgba(255,226,184,.34);border-radius:4px;}',
    '#tm-etl.is-sealed .tm-etl-seal{animation:tm-etl-sealpop 940ms cubic-bezier(.3,.8,.2,1) forwards;}',
    '.tm-etl-ink{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;background:',
    '  radial-gradient(circle at 50% 50%,rgba(162,42,28,.22),transparent 24%),',
    '  linear-gradient(90deg,transparent,rgba(var(--acc),.13),transparent);}',
    '#tm-etl.is-sealed .tm-etl-ink{animation:tm-etl-flash 940ms ease-out forwards;}',
    /* 动画 */
    '@keyframes tm-etl-drift{from{transform:scale(1.055) translate3d(-.4%,-.2%,0);}to{transform:scale(1.075) translate3d(.45%,.25%,0);}}',
    '@keyframes tm-etl-inkwipe{from{-webkit-mask-size:10% 10%;mask-size:10% 10%;}to{-webkit-mask-size:340% 340%;mask-size:340% 340%;}}',
    '@keyframes tm-etl-wash{0%,100%{transform:translate3d(-3%,0,0);opacity:.42;}50%{transform:translate3d(1.2%,-.5%,0);opacity:.56;}}',
    '@keyframes tm-etl-mote{0%{opacity:0;transform:translate3d(0,0,0);}12%{opacity:.5;}60%{opacity:.34;}100%{opacity:0;transform:translate3d(var(--ms,2vw),-78vh,0);}}',
    '@keyframes tm-etl-arrive{from{opacity:0;transform:translateY(-3vh) translateX(-10px);}to{opacity:1;transform:translateY(-5vh) translateX(0);}}',
    '@keyframes tm-etl-goldshift{0%,100%{background-position:0 0;}50%{background-position:0 44%;}}',
    '@keyframes tm-etl-titleswap{0%{opacity:1;filter:blur(0);transform:translateY(0);}38%{opacity:0;filter:blur(7px);transform:translateY(3px);}56%{opacity:0;filter:blur(5px);transform:translateY(-2px);}100%{opacity:1;filter:blur(0);transform:translateY(0);}}',
    '@keyframes tm-etl-glyphpop{0%{opacity:1;}38%{opacity:0;}56%{opacity:0;}100%{opacity:1;}}',
    '@keyframes tm-etl-annalin{from{opacity:0;clip-path:inset(0 0 100% 0);filter:blur(3px);}to{opacity:1;clip-path:inset(0 0 0 0);filter:blur(0);}}',
    '@keyframes tm-etl-shimmer{to{transform:translateX(120%);}}',
    '@keyframes tm-etl-cellpulse{from{opacity:.62;}to{opacity:1;}}',
    '@keyframes tm-etl-stamp{from{opacity:0;transform:rotate(-14deg) scale(1.8);}to{opacity:1;transform:rotate(-8deg) scale(1);}}',
    '@keyframes tm-etl-sealpop{0%{opacity:0;transform:translate(-50%,-50%) scale(.25) rotate(-9deg);}30%{opacity:1;transform:translate(-50%,-50%) scale(1.18) rotate(-7deg);}56%{opacity:.96;transform:translate(-50%,-50%) scale(.86) rotate(-5deg);}78%{opacity:.96;transform:translate(-50%,-50%) scale(1.03) rotate(-4deg);}100%{opacity:0;transform:translate(-50%,-50%) scale(1) rotate(-3deg);}}',
    '@keyframes tm-etl-flash{0%,100%{opacity:0;}26%,62%{opacity:1;}}',
    /* 响应式 */
    '@media (max-width:1180px){',
    '  .tm-etl-glyph,.tm-etl-annals,.tm-etl-mount{display:none;}',
    '  .tm-etl-title{font-size:clamp(48px,9vw,86px);}',
    '}',
    '@media (max-width:720px){',
    '  .tm-etl-inner{width:100%;margin-left:0;padding:0 14px;animation:none;}',
    '  .tm-etl-title{font-size:clamp(40px,12vw,54px);letter-spacing:.065em;text-indent:.065em;}',
    '  .tm-etl-line{font-size:17px;}',
    '  .tm-etl-queue{grid-template-columns:1fr 1fr;gap:4px 8px;}',
    '  .tm-etl-queue span:first-child{grid-column:1 / -1;}',
    '  .tm-etl-flow{grid-template-columns:repeat(5,minmax(0,1fr));}',
    '}',
    '@media (prefers-reduced-motion:reduce){',
    '  #tm-etl *,#tm-etl *::before,#tm-etl *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;}',
    '  .tm-etl-motes{display:none;}',
    '}'
  ].join('\n');

  var AMBIENT_MS = 10500;     // 场景随机轮换间隔（真实回合分钟级，慢轮换）
  var CROSSFADE_MS = 1400;
  var TITLE_SWAP_MS = 760;
  var ANNALS_CAP = 12;

  var BEATS = TM.Endturn.Progress.BEATS;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var built = false;
  var builtLen = 0;            // 【模式 b】DOM 当前按几拍建的(切 LLM/agent 拍表时据此判重建)
  var root = null;
  var els = {};
  var deck = [];
  var sceneAt = -1;
  var swapping = false;
  var pendingScene = -1;
  var ambientTimer = 0;
  var mirrorTimer = 0;
  var titleTimer = 0;
  var swapTimer = 0;
  var finishTimer = 0;
  var annalsCount = 0;
  var curGroup = '';
  var lastBeatIdx = -1;
  var groupKeys = [];

  function courtBlocked() {
    // toggle(name, undefined) 会反转类名；未开朝会时必须返回 false，不能把缺省字段传给 220ms 哨兵。
    return !!(typeof GM !== 'undefined' && GM && GM._isPostTurnCourt
      && (!GM._pendingShijiModal || GM._pendingShijiModal.courtDone === false));
  }

  function shuffle(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  function sceneUrl(i) { return SCENE_BASE + SCENES[i].f; }

  function build() {
    if (built) return;
    built = true;
    builtLen = BEATS.length;
    groupKeys.length = 0;   // 【模式 b】重建时清零(切拍表后 start 先 teardown 再 build·防 group 累积)
    if (!document.getElementById('tm-etl-style')) {   // 样式只注一次(重建复用)
      var style = document.createElement('style');
      style.id = 'tm-etl-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    // 组序（拍表出现顺序）+ 呈览收尾签
    var seen = {};
    for (var i = 0; i < BEATS.length; i++) {
      var g = BEATS[i].group;
      if (!seen[g]) { seen[g] = true; groupKeys.push(g); }
    }
    groupKeys.push('final');

    root = document.createElement('div');
    root.id = 'tm-etl';
    var motes = '';
    var moteCfg = [['12%','14s','0s','1.6vw'],['24%','18s','3.4s','-1.2vw'],['37%','12s','6.2s','2.2vw'],['52%','16s','1.8s','-2vw'],['67%','19s','8.4s','1.4vw'],['79%','13s','4.6s','-1.8vw'],['90%','17s','10.2s','1.1vw']];
    for (var m = 0; m < moteCfg.length; m++) {
      motes += '<span class="tm-etl-mote" style="--mx:' + moteCfg[m][0] + ';--md:' + moteCfg[m][1] + ';--mdl:' + moteCfg[m][2] + ';--ms:' + moteCfg[m][3] + ';"></span>';
    }
    var cells = '';
    for (var c = 0; c < BEATS.length; c++) cells += '<span class="tm-etl-cell" data-i="' + c + '"></span>';
    var chips = '';
    for (var f = 0; f < groupKeys.length; f++) chips += '<span class="tm-etl-step" data-g="' + groupKeys[f] + '">' + (GROUP_NAMES[groupKeys[f]] || groupKeys[f]) + '</span>';

    root.innerHTML =
      '<div class="tm-etl-bg"></div><div class="tm-etl-bg-next"></div>' +
      '<div class="tm-etl-veil"></div><div class="tm-etl-grain"></div><div class="tm-etl-wash"></div>' +
      '<div class="tm-etl-motes">' + motes + '</div>' +
      '<div class="tm-etl-mount"></div>' +
      '<div class="tm-etl-glyph" id="tm-etl-glyph">起</div>' +
      '<aside class="tm-etl-annals" id="tm-etl-annals"></aside>' +
      '<div class="tm-etl-main"><div class="tm-etl-inner" id="tm-etl-inner">' +
        '<div class="tm-etl-date" id="tm-etl-date"></div>' +
        '<h1 class="tm-etl-title"><span class="tm-etl-title-text" id="tm-etl-title">时移事去</span></h1>' +
        '<div class="tm-etl-line" id="tm-etl-line">风雨入阁，诸司回奏。</div>' +
        '<div class="tm-etl-pwrap" style="--mc:' + BEATS.length + ';">' +
          '<div class="tm-etl-pmeta"><span id="tm-etl-phase">时移事去</span><span id="tm-etl-pct">0%</span></div>' +
          '<div class="tm-etl-bar"><div class="tm-etl-fill" id="tm-etl-fill"></div></div>' +
          '<div class="tm-etl-rail" id="tm-etl-rail" style="--mc:' + BEATS.length + ';">' + cells + '</div>' +
          '<div class="tm-etl-queue"><span id="tm-etl-qi">推演项 1/' + BEATS.length + '</span><span class="now" id="tm-etl-qn"></span><span id="tm-etl-qx"></span></div>' +
          '<div class="tm-etl-flow" style="--fc:' + groupKeys.length + ';">' + chips + '</div>' +
        '</div>' +
      '</div></div>' +
      '<div class="tm-etl-ink"></div>' +
      '<div class="tm-etl-seal">御览</div>';
    document.body.appendChild(root);

    els = {
      bg: root.querySelector('.tm-etl-bg'),
      bgNext: root.querySelector('.tm-etl-bg-next'),
      glyph: document.getElementById('tm-etl-glyph'),
      annals: document.getElementById('tm-etl-annals'),
      inner: document.getElementById('tm-etl-inner'),
      date: document.getElementById('tm-etl-date'),
      title: document.getElementById('tm-etl-title'),
      line: document.getElementById('tm-etl-line'),
      phase: document.getElementById('tm-etl-phase'),
      pct: document.getElementById('tm-etl-pct'),
      fill: document.getElementById('tm-etl-fill'),
      rail: document.getElementById('tm-etl-rail'),
      qi: document.getElementById('tm-etl-qi'),
      qn: document.getElementById('tm-etl-qn'),
      qx: document.getElementById('tm-etl-qx')
    };
  }

  function setAccent(groupKey) {
    var acc = GROUP_ACCENTS[groupKey] || GROUP_ACCENTS.entry;
    root.style.setProperty('--acc', acc[0]);
    root.style.setProperty('--cin', acc[1]);
  }

  function setTitle(groupKey) {
    var next = GROUP_TITLES[groupKey] || GROUP_TITLES.entry;
    var glyph = GROUP_GLYPHS[groupKey] || GROUP_GLYPHS.entry;
    if (els.title.textContent === next) return;
    if (reduceMotion) {
      els.title.textContent = next;
      els.glyph.textContent = glyph;
      return;
    }
    root.classList.remove('is-title-swap');
    void root.offsetWidth;
    root.classList.add('is-title-swap');
    window.setTimeout(function() {
      els.title.textContent = next;
      els.glyph.textContent = glyph;
    }, Math.round(TITLE_SWAP_MS * 0.42));
    window.clearTimeout(titleTimer);
    titleTimer = window.setTimeout(function() { root.classList.remove('is-title-swap'); }, TITLE_SWAP_MS + 40);
  }

  function setDate(tone) {
    var dateStr = '';
    try {
      if (typeof getTSText === 'function' && typeof GM !== 'undefined' && GM && GM.turn != null) {
        dateStr = String(getTSText(GM.turn) || '');
      }
    } catch (e) {}
    var turnStr = (typeof GM !== 'undefined' && GM && GM.turn != null) ? ('第 ' + GM.turn + ' 回合') : '';
    var parts = [];
    if (tone) parts.push(tone);
    if (dateStr) parts.push(dateStr);
    if (turnStr) parts.push(turnStr);
    els.date.textContent = parts.join(' · ') || '回合推演';
  }

  function preload(i) {
    if (i == null || i < 0) return;
    var img = new Image();
    img.decoding = 'async';
    img.src = sceneUrl(i);
  }

  function nextSceneIndex() {
    if (!deck.length) deck = shuffle(SCENES.length);
    var n = deck.pop();
    if (n === sceneAt && deck.length) n = deck.pop();   // 避免连抽同一张
    return n;
  }

  function setScene(i, instant) {
    if (i == null || i === sceneAt) return;
    if (swapping) { pendingScene = i; return; }
    sceneAt = i;
    setDate(SCENES[i].tone);
    if (deck.length) preload(deck[deck.length - 1]);
    if (instant || reduceMotion) {
      els.bg.style.backgroundImage = "url('" + sceneUrl(i) + "')";
      return;
    }
    swapping = true;
    els.bgNext.style.backgroundImage = "url('" + sceneUrl(i) + "')";
    root.classList.add('is-swapping');
    window.clearTimeout(swapTimer);
    swapTimer = window.setTimeout(function() {
      els.bg.style.backgroundImage = "url('" + sceneUrl(i) + "')";
      root.classList.remove('is-swapping');
      swapping = false;
      if (pendingScene >= 0) { var p = pendingScene; pendingScene = -1; setScene(p); }
    }, CROSSFADE_MS);
  }

  function syncAnnals(uptoIndex) {
    if (uptoIndex < annalsCount) { els.annals.innerHTML = ''; annalsCount = 0; }
    while (annalsCount < uptoIndex) {
      var b = BEATS[annalsCount];
      var meta = META[b.id] || {};
      var span = document.createElement('span');
      var gs = annalsCount === 0 || BEATS[annalsCount - 1].group !== b.group;
      span.className = 'tm-etl-annal' + (gs ? ' is-gs' : '') + ' is-fresh';
      span.textContent = meta.name || b.match;
      els.annals.appendChild(span);
      annalsCount += 1;
    }
    while (els.annals.children.length > ANNALS_CAP) els.annals.removeChild(els.annals.firstChild);
  }

  function setRail(index) {
    var cs = els.rail.children;
    for (var i = 0; i < cs.length; i++) {
      cs[i].classList.toggle('is-active', i === index);
      cs[i].classList.toggle('is-done', i < index);
    }
  }

  function setFlow(groupKey, finished) {
    var at = groupKeys.indexOf(groupKey);
    var chips = root.querySelectorAll('.tm-etl-step');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('is-active', !finished && i === at);
      chips[i].classList.toggle('is-done', finished ? i < chips.length : i < at);
    }
  }

  function triggerSeal() {
    root.classList.remove('is-sealed');
    void root.offsetWidth;
    root.classList.add('is-sealed');
    window.setTimeout(function() { root.classList.remove('is-sealed'); }, 1000);
  }

  // 进度数值镜像旧框 #loading-fill（tm-utils 在维护钳制+爬升那本账），
  // 并兼任朝会哨兵：朝会窗口期开闸的回合，朝会一结束自动上屏
  function startMirror() {
    window.clearInterval(mirrorTimer);
    mirrorTimer = window.setInterval(function() {
      try {
        var blocked = courtBlocked();
        if (!root.classList.contains('show')) {
          if (!blocked && TM.Endturn.Progress.isActive()) reveal();
          return;
        }
        root.classList.toggle('is-court-hidden', blocked);
        var el = document.getElementById('loading-fill');
        if (!el) return;
        var v = parseFloat(el.style.width);
        if (!isFinite(v)) return;
        els.fill.style.width = v + '%';
        els.pct.textContent = (Math.round(v * 10) / 10) + '%';
      } catch (e) {}
    }, 220);
  }

  function startAmbient() {
    window.clearInterval(ambientTimer);
    if (reduceMotion) return;
    ambientTimer = window.setInterval(function() {
      if (document.hidden || swapping) return;
      setScene(nextSceneIndex());
    }, AMBIENT_MS);
  }

  function stopTimers() {
    window.clearInterval(mirrorTimer);
    window.clearInterval(ambientTimer);
    window.clearTimeout(swapTimer);
    window.clearTimeout(titleTimer);
  }

  function start(payload) {
    // 【模式 b】按生效拍表(payload.beats)重建:LLM 路径 payload.beats===BEATS 同引用→不重建(零回归);
    //   agent 拍表不同引用/不同长度→teardown 重建(复用全部动画/视觉·只换拍内容)。
    var nb = (payload && payload.beats) || BEATS;
    if (nb !== BEATS || (built && builtLen !== nb.length)) {
      BEATS = nb;
      if (built) {
        try { if (root && root.parentNode) root.parentNode.removeChild(root); } catch (_) {}
        built = false; root = null; els = {};
      }
    }
    build();
    window.clearTimeout(finishTimer);
    window.clearTimeout(titleTimer);
    root.classList.remove('is-finishing', 'is-swapping', 'is-sealed', 'is-title-swap');
    root.classList.toggle('is-court-hidden', courtBlocked());
    root.style.opacity = '';
    swapping = false;
    pendingScene = -1;
    annalsCount = 0;
    lastBeatIdx = -1;
    curGroup = 'entry';
    els.annals.innerHTML = '';
    els.fill.style.width = '8%';
    els.pct.textContent = '8%';
    setRail(0);
    setFlow('entry', false);
    setAccent('entry');
    els.title.textContent = GROUP_TITLES.entry;
    els.glyph.textContent = GROUP_GLYPHS.entry;
    els.line.textContent = META['core-start'].line;
    els.phase.textContent = META['core-start'].name;
    els.qn.textContent = '正：时移事去';
    els.qx.textContent = '候：' + (META[BEATS[1].id] || {}).name;
    els.qi.textContent = '推演项 1/' + BEATS.length;
    deck = shuffle(SCENES.length);
    setScene(nextSceneIndex(), true);
    startMirror();                       // 哨兵常开：朝会窗口期开闸时由它延迟上屏
    if (!courtBlocked()) reveal();
  }

  // 上屏（带入场动画）：start 的首屏、朝会结束的延迟上屏、暂避后的复出共用
  function reveal() {
    if (root.classList.contains('show')) return;
    root.classList.toggle('is-court-hidden', courtBlocked());
    els.inner.style.animation = 'none';
    void els.inner.offsetWidth;
    els.inner.style.animation = '';
    root.classList.add('show');
    var old = document.getElementById('loading');
    if (old) old.classList.add('tm-etl-suppress');
    startMirror();
    startAmbient();
  }

  function resume() {
    // 中途暂避后回到推演：原状复出，不重置拍面；朝会期间不上屏（哨兵接管）
    if (courtBlocked()) return;
    reveal();
  }

  function onBeat(p) {
    if (!root) return;
    if (!root.classList.contains('show')) resume();
    var beat = p.beat;
    var meta = META[beat.id] || {};
    els.qn.textContent = '正：' + (p.label || meta.name || '');
    if (p.index === lastBeatIdx) return;  // 流式同拍高频回调：只刷现行事文字
    lastBeatIdx = p.index;
    if (beat.group !== curGroup) {
      curGroup = beat.group;
      setAccent(curGroup);
      setTitle(curGroup);
    }
    els.phase.textContent = meta.name || beat.match;
    els.line.textContent = meta.line || '';
    var next = BEATS[p.index + 1];
    els.qx.textContent = next ? ('候：' + ((META[next.id] || {}).name || next.match)) : '候：御览成卷';
    els.qi.textContent = '推演项 ' + (p.index + 1) + '/' + p.total;
    setRail(p.index);
    setFlow(curGroup, false);
    syncAnnals(p.index);
    if (beat.id === 'render-shiji') {
      setTitle('final');
      setAccent('final');
      setFlow('final', false);
      triggerSeal();
    }
  }

  function onLabel(p) {
    if (!root || !p.label) return;
    els.qn.textContent = '正：' + p.label;   // 横插事项（科举/廷推等）只更新现行事，不动拍
  }

  function unsuppress() {
    var old = document.getElementById('loading');
    if (old) old.classList.remove('tm-etl-suppress');
  }

  // 中止/暂避：即刻退场（无 100% 落幕——中止的回合不演完成）
  function hideNow() {
    if (!root) return;
    stopTimers();
    swapping = false;        // 中途打断交叉淡化须复位，否则复出后场景轮换永久卡死
    pendingScene = -1;
    root.classList.remove('show', 'is-finishing', 'is-swapping');
    unsuppress();
  }

  function finish() {
    if (!root) return;
    unsuppress();  // 立即解除抑制：落幕期间若有新加载（科举弹窗等）旧框可正常接管
    els.fill.style.width = '100%';
    els.pct.textContent = '100%';
    setRail(BEATS.length);
    setFlow('final', true);
    syncAnnals(BEATS.length);
    els.qn.textContent = '正：御览成卷';
    els.qx.textContent = '候：待君一阅';
    root.classList.add('is-finishing');
    window.clearTimeout(finishTimer);
    finishTimer = window.setTimeout(function() {
      root.classList.remove('show', 'is-finishing');
      stopTimers();
    }, 680);
  }

  TM.Endturn.Progress.on(function(type, payload) {
    try {
      if (type === 'start') start(payload);
      else if (type === 'beat') onBeat(payload);
      else if (type === 'label') onLabel(payload);
      else if (type === 'done') finish();
      else if (type === 'pause' || type === 'abort') hideNow();
    } catch (e) {
      // 加载层任何异常不允许影响回合推进；出错即退场恢复旧框
      try {
        if (root) { root.classList.remove('show'); stopTimers(); }
        var old = document.getElementById('loading');
        if (old) old.classList.remove('tm-etl-suppress');
      } catch (e2) {}
    }
  });

  TM.Endturn.Loading = {
    isShown: function() { return !!(root && root.classList.contains('show')); }
  };
})();
