// @ts-check
// ═══ 巨石拆分(20260706·第十八拆)：图标/CSS 簇迁出 editor-authoring-agent-ui.js ═══
// 装载序契约(见 lint-split-contracts)：icons 在 origin【之前】装载(icons→origin→render)。
//   icons 是叶子：自带 PANEL_ID/FONT_BASE(复制·同目录同值)，向 TM.__aaUiParts 发布 _icon/injectStyles/_TOOL_ICON。
//   origin 顶部反向 shim 委托这三者·render 静态别名读取。ui-free(不碰共享 ui 对象)。
(function(global) {
  'use strict';
  if (typeof document === 'undefined') return;
  var TM = global.TM = global.TM || {};
  var __aaU = TM.__aaUiParts = TM.__aaUiParts || {};   // dep-graph 可识别的 provide 形(TM.X=)
  var PANEL_ID = 'tm-aa-panel';   // 复制自 origin(同目录·同值·纯常量)
  // 复制自 origin·纯 helper(currentScript 同目录→同值)
  var FONT_BASE = (function () {
    try {
      var s = document.currentScript;
      var src = s && s.src ? String(s.src) : '';
      return src ? src.replace(/[^\/]*(?:[?#].*)?$/, '') : '';
    } catch (e) { return ''; }
  })();
  // ── 单色描边 SVG 图标集（去 emoji·随 currentColor 融入双主题） ──
  var _ICON_PATHS = {
    bars: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
    contrast: '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11"/>',
    pen: '<path d="M9.6 3.4l3 3L6.2 12.8 3 13l.2-3.2z"/>',
    expand: '<path d="M6 3H3v3M10 3h3v3M3 10v3h3M13 10v3h-3"/>',
    restore: '<path d="M5.5 3v2.5H3M10.5 3v2.5H13M3 10.5h2.5V13M13 10.5h-2.5V13"/>',
    close: '<path d="M4 4l8 8M12 4l-8 8"/>',
    pulse: '<path d="M2 8.5h2.6L6.6 4l2.6 8 1.6-3.5H14"/>',
    search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2l3.2 3.2"/>',
    chat: '<path d="M3 4.5h10V11H8.2L5 13.5V11H3z"/>',
    book: '<path d="M8 4c-1.2-.9-3.2-1-5-.4V12c1.8-.6 3.8-.5 5 .4 1.2-.9 3.2-1 5-.4V3.6C11.2 3 9.2 3.1 8 4z"/><path d="M8 4v8.4"/>',
    route: '<circle cx="4.5" cy="4" r="1.7"/><circle cx="11.5" cy="12" r="1.7"/><path d="M4.5 5.7V8a3 3 0 0 0 3 3h2.3"/>',
    scale: '<path d="M8 3v10M4.5 5h7M4.5 5 3 8.2a1.9 1.9 0 0 0 3 0zM11.5 5 10 8.2a1.9 1.9 0 0 0 3 0z"/>',
    save: '<path d="M3.5 3.5h7l2 2v7h-9z"/><path d="M5.5 3.5V7h5V3.5M5.5 12.5V9.5h5v3"/>',
    image: '<rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><path d="m4.5 10.5 2.5-3 2 2.2L11 7l2.5 3.5"/><circle cx="6" cy="6.2" r="1"/>',
    undo: '<path d="M4.5 6.5H10a3 3 0 0 1 0 6H7"/><path d="M6.8 4 4.5 6.5 6.8 9"/>',
    check: '<path d="M3 8.5 6.5 12 13 4.5"/>',
    clip: '<path d="M12.4 7.6 7.8 12.2a3.1 3.1 0 0 1-4.4-4.4l5.2-5.2a2.1 2.1 0 0 1 3 3L6.4 10.8a1.05 1.05 0 0 1-1.5-1.5l4.3-4.3"/>'
  };
  // 工作过程 · 步骤行的工具类别图标（写/读/校/记/完成）
  var _TOOL_ICON = {
    applyEdit: 'pen', applyPush: 'pen', multiEdit: 'pen', bulkAdd: 'pen', renameEntity: 'pen', removeEntity: 'pen', mapAssignOwner: 'pen', renameRegion: 'pen',
    getField: 'search', getFields: 'search', searchEntities: 'search', globalSearch: 'search', findReferences: 'search', listCollection: 'search', describeSchema: 'search', listGaps: 'search', readSource: 'search', grepSource: 'search', listSource: 'search', mapOverview: 'search', genReference: 'search', checkHistory: 'search', fieldContract: 'search',
    validateDraft: 'pulse', preflight: 'pulse', generateImage: 'image',
    note: 'book', todoWrite: 'book', recordConvention: 'book', flagUncertain: 'book', steer: 'chat', macroCompact: 'undo',
    finish: 'check'
  };
  function _icon(name) {
    return '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (_ICON_PATHS[name] || '') + '</svg>';
  }

  function injectStyles() {
    if (document.getElementById('tm-aa-style')) return;
    var css = [
      // ── 自带美术字体（editor.html 未链主 styles.css·面板自声明 @font-face·同名文件随游戏分发）──
      //    站酷小薇=文艺宋体风(显示+回复正文·SIL OFL)·马善政=毛笔楷(朱印「师」)。Windows 无思源宋时不再砸到 SimSun 锯齿。
      '@font-face{font-family:"GS-XiaoWei";src:url("' + FONT_BASE + 'assets/fonts/ZCOOLXiaoWei-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}',
      '@font-face{font-family:"GS-MaShanZheng";src:url("' + FONT_BASE + 'assets/fonts/MaShanZheng-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}',
      // 面板域内钉死盒模型与表单字体继承（宿主 editor.html 有 *{box-sizing:border-box}·此处显式声明保证任何宿主下渲染一致）
      '#' + PANEL_ID + ',#' + PANEL_ID + ' *,#' + PANEL_ID + ' *::before,#' + PANEL_ID + ' *::after{box-sizing:border-box}',
      '#' + PANEL_ID + ' button,#' + PANEL_ID + ' input,#' + PANEL_ID + ' textarea{font-family:inherit;font-size:inherit;line-height:inherit}',
      '#tm-aa-fab,#tm-aa-fab *{box-sizing:border-box}',
      // ── 主题变量（调研自 claude.ai 真 token：珊瑚 #cc785c/激活 #a9583e·画布 #faf9f5·暗面 #181715/#1f1e1b·发丝线 #e6dfd8·墨 #141413）──
      '#' + PANEL_ID + '{--bg:#262624;--surface:#30302e;--sunken:#1f1e1b;--code:#181715;--bubble:#3a3833;',
      '--bd:rgba(250,249,245,.08);--bd2:rgba(250,249,245,.16);--ink:#faf9f5;--tx:#f0eee6;--tx2:#a09d96;--tx3:#807d75;',
      '--ac:#cc785c;--ac-hi:#dd8a6e;--ok:#72c88a;--warn:#d9ad4b;--bad:#e07a72;--danger:#c64545;',
      '--serif:"GS-XiaoWei","TM-ZCOOL-XiaoWei","Noto Serif SC","Source Han Serif SC","KaiTi","楷体",Georgia,serif;',   // 自带小薇打头·思源宋次之·再退楷体(CN Windows 预装·远优于 SimSun)
      '--seal:"GS-MaShanZheng","TM-MaShanZheng","KaiTi","楷体",var(--serif);',   // 朱印「师」=毛笔楷
      '--mono:"JetBrains Mono",ui-monospace,Consolas,"Courier New",monospace;',
      '--shadow:0 18px 60px rgba(0,0,0,.5),0 2px 10px rgba(0,0,0,.35)}',
      '#' + PANEL_ID + '[data-theme="light"]{--bg:#faf9f5;--surface:#fdfdfb;--sunken:#f5f0e8;--code:#f5f0e8;--bubble:#efe9de;',
      '--bd:#ebe6df;--bd2:#e6dfd8;--ink:#141413;--tx:#3d3d3a;--tx2:#6c6a64;--tx3:#8e8b82;',
      '--ac:#cc785c;--ac-hi:#a9583e;--ok:#3f9e58;--warn:#a67c12;--bad:#c64545;--danger:#c64545;',
      '--shadow:0 18px 60px rgba(60,50,35,.18),0 2px 10px rgba(60,50,35,.10)}',
      // 世界类型选择器（史实/虚构·标签隐于气泡提示·药丸自明）
      '#tm-aa-worldkind{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--tx3)}',
      '#tm-aa-worldkind .tm-aa-wk-lab{display:none}',
      '#tm-aa-worldkind .tm-aa-wk-opt{background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:2px 11px;font-size:11px;cursor:pointer;font-family:inherit;line-height:1.5;transition:background .12s,color .12s,border-color .12s}',
      '#tm-aa-worldkind .tm-aa-wk-opt:hover{background:var(--surface);color:var(--tx)}',
      '#tm-aa-worldkind .tm-aa-wk-opt.on{background:var(--ac);color:#fff;border-color:var(--ac)}',
      // 呼出按钮（朱印徽记 + 文字）
      '#tm-aa-fab{position:fixed;right:18px;bottom:18px;z-index:99998;display:inline-flex;align-items:center;gap:8px;background:#2f2d2a;color:#f0eee6;border:1px solid rgba(255,255,255,.14);',
      'border-radius:999px;padding:8px 16px 8px 9px;font-size:13px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35);font-family:inherit;letter-spacing:.06em;transition:transform .12s,box-shadow .12s,background .12s,border-color .12s}',
      '#tm-aa-fab:hover{background:#3a3833;border-color:rgba(217,119,87,.6);transform:translateY(-1px);box-shadow:0 10px 26px rgba(0,0,0,.4)}',
      '#tm-aa-fab .fab-seal{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:linear-gradient(140deg,#cc785c,#a9583e);color:#fff;font-family:"GS-MaShanZheng","TM-MaShanZheng","KaiTi","楷体",serif;font-weight:400;font-size:14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}',
      // 面板窗体（应用级窗口感·开场淡入）
      '#' + PANEL_ID + '{position:fixed;right:18px;bottom:64px;z-index:99999;width:560px;max-width:calc(100vw - 36px);',
      'height:86vh;display:none;flex-direction:column;background:var(--bg);color:var(--tx);border:1px solid var(--bd2);',
      'border-radius:16px;box-shadow:var(--shadow);font-family:-apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;font-size:14px;overflow:hidden}',
      '#' + PANEL_ID + '.open{display:flex;animation:tm-aa-in .18s ease-out}',
      '@keyframes tm-aa-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}',
      '#' + PANEL_ID + ' ::-webkit-scrollbar{width:8px;height:8px}',
      '#' + PANEL_ID + ' ::-webkit-scrollbar-thumb{background:var(--bd2);border-radius:99px;border:2px solid transparent;background-clip:content-box}',
      '#' + PANEL_ID + ' ::-webkit-scrollbar-track{background:transparent}',
      // 顶栏（纤薄·同底色·发丝线）
      '#tm-aa-hd{display:flex;align-items:center;justify-content:space-between;padding:9px 12px 9px 14px;background:var(--bg);border-bottom:1px solid var(--bd);flex:0 0 auto}',
      '#tm-aa-hd .tm-aa-hdbtns{display:flex;align-items:center;gap:2px}',
      '.tm-aa-resize{position:absolute;left:0;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:5}.tm-aa-resize:hover{background:rgba(217,119,87,.3)}',
      '.tm-aa-search{position:sticky;top:-10px;z-index:6;display:flex;align-items:center;gap:4px;margin:-4px -2px 2px;padding:4px 6px;background:var(--sunken);border:1px solid var(--bd);border-radius:9px}',
      '.tm-aa-search[hidden]{display:none}',
      '.tm-aa-search input{flex:1;min-width:0;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:6px;padding:3px 7px;font-size:11px;font-family:inherit;outline:none}',
      '.tm-aa-search .tm-aa-search-n{color:var(--tx3);font-size:10px;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.tm-aa-search button{background:var(--surface);color:var(--tx2);border:none;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;line-height:1.4}.tm-aa-search button:hover{color:var(--tx)}',
      '.tm-aa-hl{background:rgba(229,192,123,.35);color:inherit;border-radius:2px}.tm-aa-hl.active{background:#e5c07b;color:#1a1206}',
      '#tm-aa-hd button{display:inline-flex;align-items:center;justify-content:center;background:none;border:none;color:var(--tx3);cursor:pointer;line-height:1;padding:6px;border-radius:8px;transition:background .12s,color .12s}',
      '#tm-aa-hd button:hover{background:var(--surface);color:var(--tx)}',
      '#tm-aa-hd button svg{display:block}',
      '#tm-aa-hd b{font-size:15px;font-family:var(--serif);font-weight:600;letter-spacing:-0.2px;color:var(--ink)}',   // 显示衬线负字距（Copernicus 规范）
      // 朱印徽记「师」：方印形制（印章为方·非圆）·衬线白文·随处替代 emoji 头像
      '.tm-aa-ava{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:linear-gradient(140deg,#cc785c,#a9583e);color:#fff;font-family:var(--seal);font-weight:400;font-size:16px;margin-right:9px;vertical-align:middle;box-shadow:0 1px 5px rgba(204,120,92,.4),inset 0 0 0 1px rgba(255,255,255,.14);text-shadow:0 1px 1px rgba(0,0,0,.2)}',
      '#tm-aa-hd .sub{font-size:11.5px;color:var(--tx3);margin-left:8px;font-family:inherit;letter-spacing:0}',
      // 侧栏（Claude 桌面端式·全屏下的会话历史栏）
      '#tm-aa-rail{position:absolute;left:0;top:45px;bottom:0;width:236px;display:none;flex-direction:column;gap:4px;background:var(--sunken);border-right:1px solid var(--bd);padding:10px 9px;box-sizing:border-box;z-index:6}',
      '#' + PANEL_ID + '.railon #tm-aa-rail{display:flex}',
      '#' + PANEL_ID + '.railon #tm-aa-body{margin-left:236px}',
      '#tm-aa-railnew{display:flex;align-items:center;gap:7px;background:transparent;color:var(--tx);border:1px solid var(--bd2);border-radius:10px;padding:8px 11px;font-size:13px;cursor:pointer;font-family:inherit;transition:background .12s,border-color .12s}',
      '#tm-aa-railnew:hover{background:var(--surface);border-color:var(--ac)}',
      '#tm-aa-rail .rail-sec{font-size:11px;color:var(--tx3);letter-spacing:.06em;margin:10px 4px 3px}',
      '#tm-aa-raillist{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:2px}',
      '.rail-item{position:relative;padding:7px 24px 7px 9px;border-radius:9px;cursor:pointer;transition:background .12s}',
      '.rail-item:hover{background:var(--surface)}',
      '.rail-item.on{background:var(--surface);box-shadow:inset 2px 0 0 var(--ac)}',   // S5 · 当前会话高亮（Claude 桌面端式左缘线）
      '.rail-item .ri-req{font-size:12.5px;color:var(--tx);line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.rail-item .ri-meta{font-size:10.5px;color:var(--tx3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.rail-item .ri-meta .ri-ok{color:var(--ok)}',
      '.rail-item .ri-meta .ri-file{color:var(--ac)}',   // S5 · 属别的剧本 → 切换徽记
      '.rail-item .ri-del,.rail-item .ri-ren,.rail-item .ri-fork{position:absolute;right:5px;top:6px;display:none;background:none;border:none;color:var(--tx3);font-size:13px;line-height:1;padding:2px 4px;border-radius:6px;cursor:pointer}',
      '.rail-item .ri-ren{right:24px;font-size:11px;top:7px}',
      '.rail-item .ri-fork{right:43px;font-size:11px;top:7px}',
      '.rail-item:hover .ri-del,.rail-item:hover .ri-ren,.rail-item:hover .ri-fork{display:block}',
      '.rail-item .ri-del:hover{color:var(--bad);background:var(--sunken)}',
      '.rail-item .ri-ren:hover,.rail-item .ri-fork:hover{color:var(--tx);background:var(--sunken)}',
      '.rail-empty{font-size:11.5px;color:var(--tx3);padding:8px 6px;line-height:1.6}',
      '#tm-aa-railclear{background:none;border:none;color:var(--tx3);font-size:11px;cursor:pointer;padding:6px;border-radius:8px;font-family:inherit}#tm-aa-railclear:hover{color:var(--bad);background:var(--surface)}',
      '#tm-aa-body{padding:10px 20px 14px;overflow:hidden;display:flex;flex-direction:column;gap:10px;position:relative;flex:1 1 auto;min-height:0;transition:margin-left .15s ease-out;',
      'background:radial-gradient(900px 380px at 82% -6%,rgba(217,119,87,.06),transparent 62%)}',   // 氛围：右上暖光晕·纵深而非平涂
      '#' + PANEL_ID + '[data-theme="light"] #tm-aa-body{background:radial-gradient(900px 380px at 82% -6%,rgba(201,100,66,.05),transparent 62%)}',
      '#' + PANEL_ID + ' button:focus-visible,#' + PANEL_ID + ' textarea:focus-visible{outline:2px solid var(--ac);outline-offset:2px}',
      // 空态（Claude 桌面端招牌）：问候语 + composer 一起居中于画布·有内容后 composer 落底
      '#tm-aa-body.tm-aa-blank{justify-content:center}',
      '#tm-aa-body.tm-aa-blank #tm-aa-composer{order:5;margin-top:6px}',
      '#tm-aa-body.tm-aa-blank .tm-aa-empty{margin:0}',
      // Composer（Claude 式：圆角大卡片·内嵌底行）
      '#tm-aa-composer{display:flex;flex-direction:column;gap:7px;order:80;flex:0 0 auto;z-index:7;background:var(--bg);margin-left:-20px;margin-right:-20px;padding:8px 20px 10px;position:relative}',
      '#tm-aa-req{width:100%;box-sizing:border-box;background:transparent;color:var(--tx);border:none;',
      'border-radius:16px;padding:13px 15px 6px;font-family:inherit;font-size:14px;line-height:1.65;resize:none;min-height:56px;max-height:200px;overflow:auto;display:block;outline:none}',
      '#tm-aa-req::placeholder{color:var(--tx3)}',
      '.tm-aa-charcount{position:absolute;top:6px;right:12px;font-size:10px;color:var(--tx3);pointer-events:none;background:var(--surface);padding:0 5px;border-radius:5px;z-index:1;opacity:.9}',
      '.tm-aa-charcount[hidden]{display:none}',
      '#tm-aa-field{position:relative;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box;background:var(--surface);border:1px solid var(--bd2);border-radius:16px;transition:border-color .15s,box-shadow .15s;box-shadow:0 2px 12px rgba(0,0,0,.10)}',
      '#tm-aa-field:focus-within{border-color:var(--ac);box-shadow:0 0 0 3px rgba(204,120,92,.15),0 2px 14px rgba(0,0,0,.12)}',
      // 输入卡内嵌底行：＋能力菜单 · 世界类型 · 发送
      '.tm-aa-fieldbar{display:flex;align-items:center;gap:7px;padding:5px 7px 7px 8px;flex-wrap:wrap}',
      // 权限模式 pill（问策/共审/放行·CC permission modes 对照）
      '#tm-aa-perm{flex:0 0 auto;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:2px 12px;font-size:11px;cursor:pointer;font-family:inherit;line-height:1.5;transition:color .12s,border-color .12s,background .12s}',
      '#tm-aa-perm:hover{color:var(--tx);background:var(--sunken)}',
      '#tm-aa-perm.pm-auto{color:#fff;background:var(--ac);border-color:var(--ac)}',   // 放行=高权·实底提示
      '#tm-aa-perm.pm-plan{color:var(--ok);border-color:rgba(132,216,165,.45)}',        // 问策=只读·青提示
      '#tm-aa-permpop{position:absolute;left:8px;bottom:calc(100% + 6px);z-index:12;width:300px;max-width:calc(100vw - 40px);background:var(--surface);border:1px solid var(--bd2);border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,.35);padding:9px 8px}',
      '#tm-aa-permpop[hidden]{display:none}',
      '#tm-aa-permpop .mp-h{font-size:12px;color:var(--tx);font-weight:600;margin:2px 5px 7px;letter-spacing:.04em}',
      '.tm-aa-pm{display:block;width:100%;text-align:left;background:none;border:1px solid transparent;color:var(--tx);cursor:pointer;font-size:12.5px;padding:7px 9px;border-radius:9px;font-family:inherit;line-height:1.45}',
      '.tm-aa-pm:hover{background:rgba(204,120,92,.12)}',
      '.tm-aa-pm.on{border-color:var(--ac);background:rgba(204,120,92,.10)}',
      '.tm-aa-pm b{font-weight:600}',
      '.tm-aa-pm .pm-d{display:block;font-size:10.5px;color:var(--tx3);margin-top:1px}',
      '#tm-aa-permpop .pm-danger{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--tx2);margin:8px 6px 2px;cursor:pointer}',
      '#tm-aa-permpop .pm-danger input{cursor:pointer}',
      '#tm-aa-permpop .mp-hint{font-size:10.5px;color:var(--tx3);line-height:1.6;margin:8px 6px 2px;border-top:1px solid var(--bd);padding-top:7px}',
      '.tm-aa-flex{flex:1 1 auto}',
      '#tm-aa-plus{flex:0 0 auto;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:50%;padding:0;cursor:pointer;font-size:16px;line-height:1;transition:background .12s,color .12s,transform .12s}',
      '#tm-aa-plus:hover{background:var(--sunken);color:var(--tx)}',
      '#tm-aa-plus.on{background:var(--ac);border-color:var(--ac);color:#fff;transform:rotate(45deg)}',
      '#tm-aa-attach-btn{flex:0 0 auto;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:50%;padding:0;cursor:pointer;transition:background .12s,color .12s}',
      '#tm-aa-attach-btn:hover{background:var(--sunken);color:var(--tx)}',
      // 附件签行（图片缩略 + 文件名签·发送时随需求交付）
      '#tm-aa-attach{display:flex;flex-wrap:wrap;gap:6px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '#tm-aa-attach[hidden]{display:none}',
      '.att-chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--bd2);border-radius:9px;padding:3px 6px 3px 8px;font-size:11px;color:var(--tx2);max-width:230px}',
      '.att-chip .att-ic{display:inline-flex;color:var(--tx3)}',
      '.att-chip .att-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px}',
      '.att-chip .att-sz{color:var(--tx3);font-size:10px}',
      '.att-chip.att-img{padding:3px}',
      '.att-chip.att-img img{width:40px;height:40px;object-fit:cover;border-radius:6px;display:block}',
      '.att-x{background:none;border:none;color:var(--tx3);cursor:pointer;font-size:13px;line-height:1;padding:0 3px}.att-x:hover{color:var(--bad)}',
      '#' + PANEL_ID + '.tm-aa-drag{outline:2px dashed var(--ac);outline-offset:-6px}',
      '#' + PANEL_ID + '.tm-aa-drag::before{content:"松手把文件 / 截图交给国师";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(204,120,92,.10);color:var(--ac);font-size:15px;font-family:var(--serif);z-index:99;pointer-events:none}',
      '#tm-aa-plusmenu{position:absolute;left:8px;bottom:calc(100% + 6px);z-index:12;min-width:230px;background:var(--surface);border:1px solid var(--bd2);border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,.35);padding:5px;max-height:min(460px,62vh);overflow:auto}',
      '#tm-aa-plusmenu[hidden]{display:none}',
      '.tm-aa-mi{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:none;border:none;color:var(--tx);cursor:pointer;font-size:12.5px;padding:7px 9px;border-radius:8px;font-family:inherit;line-height:1.4}',
      '.tm-aa-mi:hover{background:rgba(217,119,87,.14)}',
      '.tm-aa-mi .mi-ic{flex:0 0 18px;display:inline-flex;align-items:center;justify-content:center;color:var(--tx3)}',
      '.tm-aa-mi:hover .mi-ic{color:var(--ac)}',
      '.tm-aa-mi .mi-ic svg{display:block}',
      '.tm-aa-mi .mi-d{display:block;font-size:10.5px;color:var(--tx3);margin-top:1px}',
      '.tm-aa-mi-sep{height:1px;background:var(--bd);margin:4px 8px}',
      '#tm-aa-go{flex:0 0 auto;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:0;cursor:pointer;font-size:15px;line-height:1;transition:background .12s,transform .08s}',   // 圆角方（claude.ai 发送钮形制·非正圆）
      '#tm-aa-go:hover{background:var(--ac-hi)}#tm-aa-go:active{transform:scale(.92)}',
      '#tm-aa-go:disabled{opacity:.5;cursor:default}',
      '#tm-aa-go.stopbtn{background:var(--danger)}#tm-aa-go.stopbtn:hover{background:#d2554f}',
      '#tm-aa-status{font-size:11.5px;color:var(--tx3);min-height:15px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box;padding:0 4px;line-height:1.5}',
      '.tm-aa-running #tm-aa-status{color:var(--tx2)}',
      '.tm-aa-running #tm-aa-status::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--ac);margin-right:7px;vertical-align:1px;animation:tm-aa-pulse 1.5s ease-in-out infinite}',   // 呼吸朱点（纯 CSS·非 emoji）
      '@keyframes tm-aa-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}',
      '#tm-aa-ctx{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--tx2);background:rgba(217,119,87,.09);border:1px solid rgba(217,119,87,.3);border-radius:8px;padding:3px 9px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '#tm-aa-ctx[hidden]{display:none}',
      '.tm-aa-ctx-txt{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tm-aa-ctx-ico{flex:0 0 auto;opacity:.85}',
      '.tm-aa-ctx-pin{flex:0 0 auto;background:none;border:none;cursor:pointer;font-size:12px;opacity:.6;padding:0 2px;line-height:1}',
      '.tm-aa-ctx-pin:hover,.tm-aa-ctx-pin.on{opacity:1}',
      '#tm-aa-mentions{display:flex;flex-wrap:wrap;gap:4px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '#tm-aa-mentions[hidden]{display:none}',
      '.tm-aa-mchip{display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--tx2);background:var(--surface);border:1px solid var(--bd2);border-radius:999px;padding:1px 4px 1px 8px}',
      '.tm-aa-mx{background:none;border:none;color:var(--tx2);cursor:pointer;font-size:13px;line-height:1;padding:0 2px;opacity:.7}.tm-aa-mx:hover{opacity:1}',
      '#tm-aa-atpop{position:absolute;left:50%;transform:translateX(-50%);width:min(728px,calc(100% - 40px));bottom:calc(100% + 4px);z-index:13;max-height:210px;overflow:auto;background:var(--surface);border:1px solid var(--bd2);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.4);padding:4px}',
      '#tm-aa-atpop[hidden]{display:none}',
      // composer 位于面板上部（空态/无消息）时浮层翻到下方，否则飞出面板顶（@ 与 / 同治·JS 量空间挂 below）
      '#tm-aa-atpop.below,#tm-aa-cmdpop.below{bottom:auto;top:calc(100% + 4px)}',
      '.tm-aa-atitem{display:flex;align-items:center;gap:7px;width:100%;text-align:left;background:none;border:none;color:var(--tx);cursor:pointer;font-size:12px;padding:5px 8px;border-radius:8px;font-family:inherit}',
      '.tm-aa-atitem:hover{background:rgba(217,119,87,.16)}',
      // S6 · / 命令面板（CC slash commands 对照·与 @提及同一浮层语言）
      '#tm-aa-cmdpop{position:absolute;left:50%;transform:translateX(-50%);width:min(728px,calc(100% - 40px));bottom:calc(100% + 4px);z-index:14;max-height:280px;overflow:auto;background:var(--surface);border:1px solid var(--bd2);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.4);padding:4px}',
      '#tm-aa-cmdpop[hidden]{display:none}',
      '.tm-aa-cmdhd{font-size:10.5px;color:var(--tx3);padding:4px 8px 5px;letter-spacing:.04em}',
      '.tm-aa-cmditem{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;background:none;border:none;color:var(--tx);cursor:pointer;font-size:12.5px;padding:6px 8px;border-radius:8px;font-family:inherit}',
      '.tm-aa-cmditem b{font-weight:600;white-space:nowrap}',
      '.tm-aa-cmditem .cmd-d{color:var(--tx3);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tm-aa-cmditem:hover,.tm-aa-cmditem.on{background:rgba(217,119,87,.16)}',
      '.tm-aa-atkind{flex:0 0 auto;font-size:10px;color:var(--tx3);background:var(--sunken);border-radius:5px;padding:1px 5px}',
      '.tm-aa-diff-jump{cursor:pointer;border-bottom:1px dashed rgba(132,216,165,.5)}',
      '.tm-aa-diff-jump:hover{color:var(--ok)}',
      '#tm-aa-meter{font-size:11px;color:var(--tx3);font-variant-numeric:tabular-nums;padding:0 4px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      // 欢迎屏（朱印徽记 + 衬线问候·级联入场·与 composer 一同居中）
      '.tm-aa-empty{order:4;margin:auto 0;background:none;border:none;padding:10px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}',
      '.tm-aa-empty>*{animation:tm-aa-rise .34s ease-out both}',
      '.tm-aa-empty .emp-title{animation-delay:.05s}.tm-aa-empty .emp-sub{animation-delay:.11s}.tm-aa-empty .emp-chips{animation-delay:.17s}',
      '.tm-aa-empty .emp-seal{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:linear-gradient(140deg,#cc785c,#a9583e);color:#fff;font-family:var(--seal);font-weight:400;font-size:34px;box-shadow:0 6px 24px rgba(217,119,87,.35),inset 0 0 0 1.5px rgba(255,255,255,.16);text-shadow:0 1px 2px rgba(0,0,0,.25);margin-bottom:4px}',
      '.tm-aa-empty .emp-title{color:var(--ink);font-size:28px;font-family:var(--serif);font-weight:500;letter-spacing:-0.5px;line-height:1.3}',   // display-sm 负字距
      '.tm-aa-empty .emp-sub{color:var(--tx3);font-size:13px;margin-bottom:10px;line-height:1.6}',
      '.tm-aa-empty .emp-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:440px}',
      '.tm-aa-empty .emp-chip{background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:6px 15px;font-size:12px;cursor:pointer;font-family:inherit;transition:background .12s,color .12s,border-color .12s,transform .12s}.tm-aa-empty .emp-chip:hover{background:var(--surface);color:var(--tx);border-color:var(--ac);transform:translateY(-1px)}',
      '@keyframes tm-aa-rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}',
      '.tm-aa-msg-user,.tm-aa-reply,.tm-aa-think,.tm-aa-msg-ai{animation:tm-aa-rise .22s ease-out}',   // 消息入场微动
      // 会话流（居中栏·Claude 式）
      '.tm-aa-logwrap{position:relative;flex:1 1 0;min-height:0;overflow-y:auto}',
      '.tm-aa-log{padding:4px 2px;font-size:13px;line-height:1.7;max-width:760px;margin:0 auto}',
      '.tm-aa-tobottom{position:absolute;right:9px;bottom:7px;background:var(--surface);color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:3px 11px;font-size:10.5px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);z-index:2}.tm-aa-tobottom:hover{color:var(--tx)}',
      '.tm-aa-tobottom[hidden]{display:none}',
      '.tm-aa-log .ln{color:var(--tx2)}.tm-aa-log .bad{color:var(--bad)}.tm-aa-log .fin{color:var(--ok)}',
      // 工具执行卡（Claude 式折叠 chip·带工具类别图标）
      '.tm-aa-step{margin:2px 0}.tm-aa-step>summary{cursor:pointer;list-style:none;padding:3px 5px;line-height:1.55;outline:none;border-radius:7px;font-size:11.5px;display:flex;align-items:baseline;gap:6px}',
      '.tm-aa-step>summary:hover{background:var(--sunken)}',
      '.tm-aa-step>summary::-webkit-details-marker{display:none}.tm-aa-step>summary::before{content:"▸";color:var(--tx3);flex:0 0 auto}.tm-aa-step[open]>summary::before{content:"▾"}',
      '.tm-aa-step .st-ic{flex:0 0 auto;display:inline-flex;align-self:center;color:var(--tx3)}',
      '.tm-aa-step .st-ic svg{display:block;width:12px;height:12px}',
      '.tm-aa-step .st-tx{flex:1 1 auto;min-width:0}',
      '.tm-aa-step.fin>summary{color:var(--ok)}.tm-aa-step.fin .st-ic{color:var(--ok)}.tm-aa-step.ln>summary{color:var(--tx2)}.tm-aa-step.bad>summary{color:var(--bad)}.tm-aa-step.bad .st-ic{color:var(--bad)}',
      '.tm-aa-step:not([open])>.tm-aa-step-body{display:none}',
      // 工作过程 · 实时活动行（当前在做什么·转环+最新动作/思考）
      '.tm-aa-live{display:flex;align-items:center;gap:8px;margin:8px 0 4px;padding:6px 11px;background:var(--surface);border:1px solid var(--bd);border-radius:11px;font-size:12px;color:var(--tx2);width:fit-content;max-width:100%;box-sizing:border-box}',
      '.tm-aa-live .lv-spin{flex:0 0 auto;width:12px;height:12px;border:2px solid var(--bd2);border-top-color:var(--ac);border-radius:50%;animation:tm-aa-spin .8s linear infinite}',
      '.tm-aa-live .lv-tx{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:560px}',
      '.tm-aa-live .lv-tx.think{font-family:var(--serif);font-style:italic;color:var(--tx3)}',
      '@keyframes tm-aa-spin{to{transform:rotate(360deg)}}',
      // 工作过程 · 顶栏活动条（不确定进度·滑光）
      '#tm-aa-progress{height:2px;background:transparent;position:relative;overflow:hidden;flex:0 0 auto}',
      '.tm-aa-running #tm-aa-progress::after{content:"";position:absolute;left:-30%;top:0;bottom:0;width:30%;background:linear-gradient(90deg,transparent,var(--ac),transparent);animation:tm-aa-slide 1.3s ease-in-out infinite}',
      '@keyframes tm-aa-slide{to{left:100%}}',
      '.tm-aa-think{margin:10px auto 10px 0;background:var(--surface);border:1px solid var(--bd);border-radius:11px;padding:3px 12px;width:fit-content;max-width:100%;box-sizing:border-box}',
      '.tm-aa-think[open]{width:100%}',
      '.tm-aa-think>summary{cursor:pointer;list-style:none;color:var(--tx2);font-size:12px;padding:4px 0;outline:none;white-space:nowrap}',
      '.tm-aa-think>summary::-webkit-details-marker{display:none}.tm-aa-think>summary::before{content:"▸ ";font-style:normal;color:var(--tx3)}.tm-aa-think[open]>summary::before{content:"▾ "}',
      '.tm-aa-running .tm-aa-think:last-of-type>summary .tk-label{background:linear-gradient(90deg,var(--tx3),var(--tx),var(--tx3));background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:tm-aa-sheen 2s linear infinite}',
      '@keyframes tm-aa-sheen{0%{background-position:180% 0}100%{background-position:-20% 0}}',
      '.tm-aa-think:not([open])>.tm-aa-think-body{display:none}',
      '.tm-aa-think-body{padding:2px 0 6px 13px;border-left:2px solid var(--bd2);margin:2px 0 2px 4px}',
      '.tm-aa-think-body .tk-line{color:var(--tx3);font-style:italic;font-size:12px;line-height:1.7;margin:3px 0;white-space:pre-wrap;word-break:break-word;font-family:var(--serif)}',   // 思考=衬线斜体（与回复正文同族）
      '.tm-aa-think[open]>.tm-aa-think-body{max-height:42vh;overflow-y:auto}',   // 长跑不撑爆视口·块内滚
      '.tm-aa-step-body{padding:2px 0 5px 12px;border-left:2px solid var(--bd);margin:2px 0 2px 4px}',
      '.tm-aa-step-body .sb-row{margin:2px 0}.tm-aa-step-body .sb-k{display:inline-block;color:var(--tx3);font-size:10px;margin-right:4px}',
      '.tm-aa-step-body pre{margin:1px 0;white-space:pre-wrap;word-break:break-all;font-family:var(--mono);font-size:10px;line-height:1.5;color:var(--tx3);max-height:120px;overflow:auto;background:var(--code);border-radius:6px;padding:4px 6px}',
      '.tm-aa-checklist{background:var(--surface);border:1px solid var(--bd);border-radius:10px;padding:7px 10px;margin-bottom:6px}',
      '.tm-aa-checklist .cl-head{font-size:11px;color:var(--tx2);font-weight:bold;margin-bottom:3px}',
      '.tm-aa-checklist .cl-item{font-size:11.5px;line-height:1.75;color:var(--tx3);display:flex;gap:6px;align-items:baseline}',
      '.tm-aa-checklist .cl-item .cl-ic{width:12px;text-align:center;flex:none}',
      '.tm-aa-checklist .cl-item.done{color:var(--ok)}.tm-aa-checklist .cl-item.done .cl-ic{color:var(--ok)}',
      '.tm-aa-checklist .cl-item.run{color:var(--warn)}.tm-aa-checklist .cl-item.run .cl-ic{color:var(--warn);display:inline-block;animation:tm-aa-spin 1.1s linear infinite}',   // 进行中 ⟳ 真转
      '.tm-aa-checklist .cl-item.pend{color:var(--tx3)}',
      // 用户消息（软卡片·右对齐）与助手正文（Claude 式：无气泡·直接书于底色上）
      '.tm-aa-msg-user{position:relative;margin:16px 0 12px auto;max-width:82%;width:fit-content;padding:9px 15px;background:var(--bubble);border:none;border-radius:18px 18px 6px 18px;font-size:13.5px;line-height:1.7;color:var(--tx);box-shadow:0 1px 5px rgba(0,0,0,.1)}',
      '.tm-aa-msg-user .mu-who{display:none}',
      '.tm-aa-msg-acts{position:absolute;top:-13px;right:6px;display:none;gap:1px;background:var(--surface);border:1px solid var(--bd2);border-radius:8px;padding:1px 2px;box-shadow:0 4px 12px rgba(0,0,0,.3)}',
      '.tm-aa-msg-user:hover .tm-aa-msg-acts{display:inline-flex}',
      '.tm-aa-msg-ai{position:relative;margin:14px auto 12px 0;max-width:96%;width:fit-content;padding:2px 2px 2px 0;background:none;border:none;font-size:15px;line-height:1.85;color:var(--tx);font-family:var(--serif)}',   // 回复正文=衬线（Tiempos 语义·Claude 签名）
      '.tm-aa-msg-ai .ai-who{color:var(--ac);font-weight:600;font-size:11.5px;display:block;margin-bottom:4px;font-family:var(--serif);letter-spacing:0}',
      '.tm-aa-msg-ai .ai-sev{display:inline-block;background:rgba(229,192,123,.16);color:var(--warn);border-radius:5px;padding:0 6px;font-size:10.5px;margin-right:5px}',
      '.tm-aa-msg-ai .ai-sug{color:var(--ok);margin-top:4px}',
      '.tm-aa-msg-ai .ai-qs{margin-top:3px}.tm-aa-msg-ai .ai-q{line-height:1.8}',
      '.tm-aa-msg-ai .ai-hint{color:var(--tx3);font-size:11px;margin-top:6px;border-top:1px solid var(--bd);padding-top:5px}',
      '.tm-aa-reply{margin:14px 0 12px;padding:0 2px;background:none;border:none;border-radius:0}',
      '.tm-aa-reply .reply-who{display:flex;align-items:center;gap:7px;margin-bottom:7px}',
      '.tm-aa-reply .reply-who .reply-ava{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:linear-gradient(140deg,#cc785c,#a9583e);color:#fff;font-family:var(--seal);font-weight:400;font-size:14px;line-height:1;box-shadow:0 1px 4px rgba(217,119,87,.35),inset 0 0 0 1px rgba(255,255,255,.14);text-shadow:0 1px 1px rgba(0,0,0,.2)}',
      '.tm-aa-reply .reply-who b{color:var(--ac);font-size:12px;font-weight:600;font-family:var(--serif);letter-spacing:0}',
      '.tm-aa-reply .reply-copy{background:none;border:none;color:var(--tx3);cursor:pointer;font-size:12px;padding:2px 7px;border-radius:6px;opacity:0;transition:opacity .12s,color .12s,background .12s;line-height:1.4}',
      '.tm-aa-reply:hover .reply-copy{opacity:1}.tm-aa-reply .reply-copy:hover{color:var(--tx);background:var(--sunken)}',
      '.tm-aa-reply .tm-aa-summary{background:none;padding:0;border-radius:0}',
      '.tm-aa-reply .tm-aa-summary::before{display:none}',
      '.tm-aa-reply.frozen{opacity:.62}',
      '.tm-aa-reply .reply-actions{display:flex;gap:7px;margin-top:10px}',
      '.tm-aa-reply .reply-actions button{flex:1;font-size:12px;padding:7px 8px;border-radius:9px;cursor:pointer;border:1px solid var(--bd2);background:transparent;color:var(--tx2);font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;transition:background .12s,color .12s,border-color .12s}',
      '.tm-aa-reply .reply-actions button:hover{background:var(--surface);color:var(--tx)}',
      '.tm-aa-reply .reply-actions button:first-child{flex:2;background:var(--ac);border-color:var(--ac);color:#fff}',
      '.tm-aa-reply .reply-actions button:first-child:hover{background:var(--ac-hi)}',
      '.tm-aa-reply .reply-actions button:first-child.warn{background:transparent;border-color:var(--warn);color:var(--warn)}',
      '.tm-aa-reply.applied .reply-actions button:first-child{background:transparent;border-color:var(--ok);color:var(--ok)}',
      '.tm-aa-reply .reply-tag{font-size:10.5px;margin-top:6px;display:none}.tm-aa-reply.applied .reply-tag{display:block;color:var(--ok)}.tm-aa-reply.discarded .reply-tag{display:block;color:var(--tx3)}',
      '.mu-act{background:none;border:none;color:var(--tx2);cursor:pointer;font-size:11px;padding:2px 6px;border-radius:6px;line-height:1.5}.mu-act:hover{background:var(--sunken);color:var(--tx)}',
      '.tm-aa-sec{font-size:11px;color:var(--tx3);letter-spacing:.06em;margin-top:2px;width:100%;max-width:760px;margin-left:auto;margin-right:auto;box-sizing:border-box;padding:0 2px}',
      '.tm-aa-sec[data-sec="log"]{display:none}',   // Claude 式：会话流不设小节标（执行块自带「执行过程 · N 步」标签）
      // 改动预览 / 校验 / 动作条（居中栏）
      '.tm-aa-diff{background:var(--surface);border:1px solid var(--bd);border-radius:12px;padding:8px 10px;max-height:190px;overflow:auto;font-size:11.5px;line-height:1.6;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '.tm-aa-diff .add{color:var(--ok)}.tm-aa-diff .rm{color:var(--bad)}.tm-aa-diff .ch{color:var(--warn)}',
      '.tm-aa-diff .uncertain{background:rgba(229,192,123,.08);border-left:2px solid var(--warn);padding-left:5px;margin-left:-7px}',
      '.tm-aa-diff .tm-aa-unc{display:block;color:var(--warn);font-size:10px;margin-top:1px}',
      '.tm-aa-summary{background:none;border:none;border-radius:0;padding:1px 2px;font-size:15px;line-height:1.85;color:var(--tx);width:100%;max-width:760px;margin:0 auto;box-sizing:border-box;font-family:var(--serif)}',   // 回复正文=衬线（Tiempos 语义）
      '.tm-aa-summary::before{content:"国师";display:block;font-size:11px;color:var(--ac);font-weight:600;margin-bottom:5px;font-family:var(--serif);letter-spacing:0}',
      '.tm-aa-summary b{color:var(--tx3);font-size:11px;display:block;margin-bottom:4px;font-weight:600;letter-spacing:.5px;font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}',   // caption 小标回归 sans（正文衬线的对照层）
      '.tm-aa-summary .note{color:var(--tx3);font-size:12px;margin-top:5px}',
      '.tm-aa-summary.tm-aa-clamped{max-height:var(--clamp-max,280px);overflow:hidden;position:relative;flex:0 0 auto}',
      '.tm-aa-summary.tm-aa-clamped::after{content:"";position:absolute;left:0;right:0;bottom:0;height:44px;background:linear-gradient(transparent,var(--bg));pointer-events:none}',
      '.tm-aa-summary.tm-aa-clamp-open{max-height:none;overflow:visible}.tm-aa-summary.tm-aa-clamp-open::after{display:none}',
      '.tm-aa-clamp-btn{align-self:center;background:none;border:none;color:var(--ac);font-size:11.5px;cursor:pointer;padding:2px 0;margin-top:-4px;font-family:inherit}.tm-aa-clamp-btn:hover{text-decoration:underline}',
      '.tm-aa-errcard{background:rgba(192,65,59,.08);border:1px solid rgba(192,65,59,.35);border-left:3px solid var(--danger);border-radius:10px;padding:9px 12px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '.tm-aa-errcard .ec-head{color:var(--bad);font-weight:bold;font-size:11.5px;margin-bottom:3px}',
      '.tm-aa-errcard .ec-msg{color:var(--tx2);font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}',
      '.tm-aa-errcard .ec-acts{display:flex;gap:7px;margin-top:8px}',
      '#tm-aa-panel .tm-aa-recovery-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '#tm-aa-panel .tm-aa-recovery-actions button{appearance:none;background:var(--surface);color:var(--tx);border:1px solid var(--tx2);border-radius:9px;padding:7px 12px;min-height:36px;font-size:12px;line-height:1.5;cursor:pointer;text-align:center;white-space:normal}',
      '#tm-aa-panel .tm-aa-recovery-actions .ec-retry{background:#a9583e;color:#fff;border-color:#a9583e}',
      '#tm-aa-panel .tm-aa-recovery-actions button:hover{background:var(--sunken);border-color:var(--tx)}',
      '#tm-aa-panel .tm-aa-recovery-actions .ec-retry:hover{background:#934a34;border-color:#934a34}',
      '#tm-aa-panel .tm-aa-recovery-actions button:focus-visible{outline:2px solid var(--tx);outline-offset:3px}',
      '#tm-aa-panel .tm-aa-recovery-actions button:disabled{opacity:.65;cursor:not-allowed}',
      '.tm-aa-errcard .ec-copy{background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:4px 12px;font-size:11.5px;cursor:pointer}.tm-aa-errcard .ec-copy:hover{color:var(--tx)}',
      // markdown 渲染
      '.md-p{margin:3px 0;line-height:1.75}.md-h{font-weight:600;color:var(--tx);margin:7px 0 3px;font-family:var(--serif);letter-spacing:.03em}.md-h1{font-size:15px}.md-h2{font-size:14px}.md-h3,.md-h4{font-size:13px}',
      '.md-list{margin:3px 0;padding-left:19px}.md-list li{margin:2px 0;line-height:1.7}',
      '.md-ic{background:rgba(229,192,123,.13);color:var(--warn);padding:0 5px;border-radius:4px;font-family:var(--mono);font-size:11px}',
      '.md-code{background:var(--code);border:1px solid var(--bd);border-radius:0 0 8px 8px;border-top:none;padding:7px 9px;margin:0;overflow:auto;font-family:var(--mono);font-size:11px;line-height:1.55;white-space:pre-wrap;color:var(--tx2)}',
      '.md-codewrap{margin:5px 0;position:relative}',
      '.md-codebar{display:flex;align-items:center;justify-content:space-between;background:var(--sunken);border:1px solid var(--bd);border-radius:8px 8px 0 0;padding:2px 6px 2px 9px}',
      '.md-codebar .md-lang{color:var(--tx3);font-size:10px;font-family:var(--mono);text-transform:lowercase}',
      '.md-codebar .md-copy{background:none;border:none;color:var(--tx3);cursor:pointer;font-size:10px;padding:1px 6px;border-radius:5px;opacity:0;transition:opacity .12s}',
      '.md-codewrap:hover .md-copy{opacity:1}.md-codebar .md-copy:hover{background:var(--surface);color:var(--tx)}',
      '.md-code .tok-str{color:#9ad6a0}.md-code .tok-key{color:#7fb4e8}.md-code .tok-num{color:#e0b863}.md-code .tok-kw{color:#c98ad6}.md-code .tok-punct{color:var(--tx3)}',
      '.md-p strong{color:var(--tx);font-weight:600}.md-p em{color:var(--tx2)}',
      '.md-table{border-collapse:collapse;margin:6px 0;font-size:11.5px;max-width:100%;display:block;overflow:auto}',
      '.md-table th,.md-table td{border:1px solid var(--bd);padding:4px 8px;text-align:left;line-height:1.55}',
      '.md-table th{background:var(--sunken);color:var(--tx);font-weight:600;white-space:nowrap}',
      '.md-table td{color:var(--tx2)}.md-table tbody tr:nth-child(even) td{background:rgba(128,128,128,.04)}',
      '.tm-aa-stream{display:block}',
      '.je-entity-ref{color:var(--ac);text-decoration:underline dotted;text-underline-offset:2px;cursor:pointer}.je-entity-ref:hover{color:var(--ac-hi);text-decoration-style:solid;background:rgba(217,119,87,.1);border-radius:3px}',
      '.tm-aa-caret{display:inline-block;color:var(--ac);font-weight:400;margin-left:1px;animation:tm-aa-blink 1.05s step-end infinite}',
      '@keyframes tm-aa-blink{50%{opacity:0}}',
      '.tm-aa-summary .tm-aa-cl-copy{margin-left:8px;background:var(--sunken);color:var(--tx);border:none;border-radius:6px;padding:1px 9px;font-size:10px;cursor:pointer}',
      '.tm-aa-summary .tm-aa-conv-clear{display:inline-block;margin-top:6px;background:var(--sunken);color:var(--tx2);border:1px solid var(--bd2);border-radius:6px;padding:2px 10px;font-size:10.5px;cursor:pointer;font-family:inherit}',
      '.tm-aa-summary .tm-aa-conv-clear:hover{color:var(--bad);border-color:var(--bad)}',
      '.tm-aa-summary pre.tm-aa-cl{white-space:pre-wrap;margin:5px 0 0;font-family:inherit;font-size:11.5px;line-height:1.65;color:var(--tx2);max-height:200px;overflow:auto}',
      '.tm-aa-sug{margin-top:7px;padding-top:6px;border-top:1px solid var(--bd)}.tm-aa-sug b{color:var(--warn)}',
      '.tm-aa-sug .sug-row{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11.5px;color:var(--tx2)}.tm-aa-sug .sug-row span{flex:1}',
      '.tm-aa-sug .sug-keep{font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:2px 10px;font-size:11px;cursor:pointer}.tm-aa-sug .sug-keep:hover{color:var(--tx)}.tm-aa-sug .sug-keep:disabled{opacity:.6;cursor:default}',
      '.tm-aa-finding{margin-bottom:7px;padding:6px 9px;background:var(--surface);border:1px solid var(--bd);border-left:3px solid var(--bd2);border-radius:8px}',
      '.tm-aa-finding .sev{font-weight:bold;font-size:11px}.tm-aa-finding .sev.rm{color:var(--bad)}.tm-aa-finding .sev.ch{color:var(--warn)}.tm-aa-finding .sev.add{color:var(--ok)}',
      '.tm-aa-finding b{color:var(--tx);font-size:12px}.tm-aa-finding .loc{color:var(--tx3);font-size:10px}',
      '.tm-aa-finding .iss{color:var(--tx2);font-size:11.5px;margin-top:2px;line-height:1.55}.tm-aa-finding .sug{color:var(--tx3);font-size:11.5px;margin-top:2px;line-height:1.55}',
      '.tm-aa-diff-group{margin-bottom:7px;border-bottom:1px solid var(--bd);padding-bottom:4px}.tm-aa-diff-head{display:flex;align-items:center;gap:6px;color:var(--tx);padding:2px 0;font-size:12px}',
      '.tm-aa-diff-head .grp-tog{margin-left:auto;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:1px 9px;font-size:10px;cursor:pointer}.tm-aa-diff-head .grp-tog:hover{color:var(--tx)}',
      '.tm-aa-hunk{display:flex;align-items:flex-start;gap:6px;margin:3px 0}',
      '.tm-aa-hunk .hunk-tog{flex:0 0 auto;width:18px;height:18px;line-height:16px;text-align:center;border-radius:6px;border:1px solid rgba(132,216,165,.4);background:rgba(132,216,165,.12);color:var(--ok);cursor:pointer;font-size:11px;padding:0}',
      '.tm-aa-hunk .hunk-body{flex:1;min-width:0}',
      '.tm-aa-hunk.rejected .hunk-tog{border-color:rgba(239,143,143,.4);background:rgba(239,143,143,.12);color:var(--bad)}',
      '.tm-aa-hunk.rejected .hunk-body{opacity:.42;text-decoration:line-through}',
      '.tm-aa-val{width:100%;max-width:760px;margin:0 auto;box-sizing:border-box;font-size:12px}',
      '.tm-aa-val.ok{color:var(--ok)}.tm-aa-val.bad{color:var(--bad)}',
      '#tm-aa-actions{display:flex;gap:8px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '#tm-aa-apply{flex:1;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:9px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:500;transition:background .12s}',   // 主按钮=圆角方（claude.ai 按钮 8-10px 形制·非药丸）
      '#tm-aa-apply:hover{background:var(--ac-hi)}',
      '#tm-aa-apply.warn{background:transparent;border:1px solid var(--warn);color:var(--warn)}',
      '#tm-aa-discard{flex:1;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:10px;padding:9px;cursor:pointer;font-family:inherit;font-size:13px}',
      '#tm-aa-discard:hover{color:var(--tx);background:var(--surface)}',
      // composer 模型徽（claude.ai 形制：模型选择器在输入卡内右下）——点开 API 连接·模型弹层
      '#tm-aa-model{flex:0 0 auto;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:var(--tx3);background:transparent;border:1px solid var(--bd);border-radius:7px;padding:3px 9px;line-height:1.4;cursor:pointer;font-family:inherit;transition:color .12s,border-color .12s,background .12s}',
      '#tm-aa-model::after{content:" ▾";font-size:8px;color:var(--tx3)}',
      '#tm-aa-model:hover{color:var(--tx);border-color:var(--bd2);background:var(--sunken)}',
      '#tm-aa-model.warn{color:var(--ac);border-color:rgba(204,120,92,.5)}',
      // API 连接·模型弹层（右对齐·与＋菜单同族）
      '#tm-aa-modelpop{position:absolute;right:8px;bottom:calc(100% + 6px);z-index:12;width:320px;max-width:calc(100vw - 40px);background:var(--surface);border:1px solid var(--bd2);border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,.35);padding:11px 13px}',
      '#tm-aa-modelpop[hidden]{display:none}',
      '#tm-aa-modelpop .mp-h{font-size:12px;color:var(--tx);font-weight:600;margin-bottom:6px;letter-spacing:.04em}',
      '#tm-aa-modelpop .mp-lab{display:block;font-size:11px;color:var(--tx3);margin:8px 0 0}',
      '#tm-aa-modelpop input,#tm-aa-modelpop select{display:block;width:100%;box-sizing:border-box;margin-top:4px;background:var(--sunken);color:var(--tx);border:1px solid var(--bd2);border-radius:8px;padding:7px 9px;font-size:12px;font-family:inherit;outline:none;transition:border-color .12s}',
      '#tm-aa-modelpop input:focus,#tm-aa-modelpop select:focus{border-color:var(--ac)}',
      '#tm-aa-modelpop .mp-row{display:flex;align-items:center;gap:8px;margin-top:10px}',
      '#tm-aa-modelpop .mp-row.mp-end{justify-content:flex-end;margin-top:12px}',
      '#tm-aa-api-detect{background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:8px;padding:6px 13px;font-size:12px;cursor:pointer;font-family:inherit;transition:color .12s,border-color .12s}',
      '#tm-aa-api-detect:hover{color:var(--tx);border-color:var(--ac)}',
      '#tm-aa-api-save{background:var(--ac);color:#fff;border:none;border-radius:8px;padding:7px 18px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;transition:background .12s}',
      '#tm-aa-api-save:hover{background:var(--ac-hi)}',
      '#tm-aa-modelpop .mp-st{font-size:11px;color:var(--tx3);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#tm-aa-modelpop .mp-hint{font-size:10.5px;color:var(--tx3);line-height:1.65;margin-top:10px;border-top:1px solid var(--bd);padding-top:8px}',
      // 侧栏搜索与日期分组
      '#tm-aa-railq{width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:9px;padding:6px 10px;font-size:12px;font-family:inherit;outline:none;margin-top:2px}',
      '#tm-aa-railq:focus{border-color:var(--ac)}',
      '#tm-aa-railq::placeholder{color:var(--tx3)}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'tm-aa-style';
    st.textContent = css;
    document.head.appendChild(st);
  }


  // ── 发布给 origin(反向 shim)+render(静态别名)的成员 ──
  __aaU._icon = _icon; __aaU.injectStyles = injectStyles; __aaU._TOOL_ICON = _TOOL_ICON;
})(typeof window !== 'undefined' ? window : this);
