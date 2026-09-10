// phase8-formal-drafts-message-panels.js — 第二十六拆·御案·百官奏疏(zou-yuan)+鸿雁(yan-yuan)面板
//   split from phase8-formal-drafts.js·2026-07-06·第二十六拆(范式②b origin-first 双向 bucket)
//   装载于 phase8-formal-drafts.js【之后】·勿动位置·第二十六拆·bucket=window.TM.__p8DraftsMsgPanels
//   body 0 改动：迁出段=原 phase8-formal-drafts.js 行 2351..3061 逐字节
(function(){
  'use strict';
  var __p8mp = (window.TM && window.TM.__p8DraftsMsgPanels) || {};
  var bridge = __p8mp.bridge;
  var state = __p8mp.state;
  var esc = __p8mp.esc;
  var attr = __p8mp.attr;
  var personKey = __p8mp.personKey;
  var getPeople = __p8mp.getPeople;
  var firstArray = __p8mp.firstArray;
  var compactText = __p8mp.compactText;
  var getMemorials = __p8mp.getMemorials;
  var getLetters = __p8mp.getLetters;
  var tmfRenwuPortrait = __p8mp.tmfRenwuPortrait;
  var fullHongyanText = __p8mp.fullHongyanText;
  var restoreFormalDraftsFromGM = __p8mp.restoreFormalDraftsFromGM;
  var handleModuleAction = __p8mp.handleModuleAction;
  var openDeskOverlay = __p8mp.openDeskOverlay;
  var actionChip = __p8mp.actionChip;
  var actionBtn = __p8mp.actionBtn;
  var openHongyanPreviewPanel = __p8mp.openHongyanPreviewPanel;

  // ===== BODY BEGIN (verbatim phase8-formal-drafts.js 2351..3061·body 0 改动) =====
  function memorialGroupKey(m){
    var s = String((m && m.status) || '').toLowerCase();
    if (/done|approved|rejected|annotated|referred|court_debate|已批|已决|准|驳|批示|转|廷议/.test(s)) return 'done';
    if (/pending_review|hold|held|留中/.test(s)) return 'held';
    return /急|urgent|high/.test(String((m && ((m.priority || '') + (m.status || '') + (m.title || '') + (m.text || ''))) || '')) ? 'urgent' : 'pending';
  }

  function memorialMatchesFormal(filter, m){
    if (!filter || filter === 'all') return true;
    return memorialGroupKey(m) === filter;
  }

  function memorialReadingCss(css){
    // Preserve each role's original size/hierarchy; only text scales, not the desk.
    // This is confined to the memorial stylesheet, never the sibling letter CSS.
    css = css.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, function(_match, size){
      return 'font-size:calc(' + size + 'px * var(--tm-memorial-font-scale,1))';
    });
    return css + [
      'body.tm-phase8-formal .zou-yuan{--tm-memorial-font-scale:calc(var(--tm-font-global-scale,1) * var(--tm-size-memorial,1));--ink:var(--tm-memorial-ink,#241d15);--ink-soft:var(--tm-memorial-ink-soft,#493b2a);--ink-faint:var(--tm-memorial-ink-muted,#62523c);}',
      'body.tm-phase8-formal .zou-yuan .aside .card{background:#f7f0df;}',
      'body.tm-phase8-formal .zou-yuan .aside .piaoni{color:var(--ink-soft)!important;background:rgba(255,253,245,.86);}',
      'body.tm-phase8-formal .zou-yuan .aside :is(.hd-note,.who-info span,.chain-row p,.imp-pending){font-size:calc(13px * var(--tm-memorial-font-scale,1));}',
      'body.tm-phase8-formal .zou-yuan .read,body.tm-phase8-formal .zou-yuan .zouben{min-width:0;}',
      'body.tm-phase8-formal .zou-yuan .zouben{overflow-y:auto;scrollbar-width:thin;}',
      'body.tm-phase8-formal .zou-yuan .ben-body{min-height:120px;}',
      'body.tm-phase8-formal .zou-yuan .ben-text{color:var(--ink);}'
    ].join('\n');
  }

  function installMemorialYuanStyles(){
    var st = document.getElementById('tm-memorial-yuan-style');
    if (!st) { st = document.createElement('style'); st.id = 'tm-memorial-yuan-style'; document.head.appendChild(st); }
    var __css = 'body.tm-phase8-formal .zou-yuan{--desk-1:#dccca6;--desk-2:#c6b083;--desk-3:#a78f68;  --silk-hi:#fffdf3;--silk:#f6efda;--silk-lo:#ece1c6;--silk-edge:#dcc99c;  --silk-shadow:rgba(120,90,36,0.1);  --ink:#241d15;--ink-soft:#574733;--ink-faint:#9c8b6b;  --gold-hi:#d8b96a;--gold:#a8833a;--gold-d:#7d5e22;  --cinnabar:#a83228;--cinnabar-hi:#c64a3e;--cinnabar-d:#7a2018;  --wood-1:#6b4a28;--wood-2:#3f2a14;--wood-edge:#2a1b0c;--knob:#241810;  --jade:#557f6f;--jade-hi:#6fa291;  --indigo:#4a5e8a;--violet:#8e6aa8;--amber:#b98b2f;  --font:"STKaiti","KaiTi","楷体","Noto Serif SC","Source Han Serif CN","STSong",serif;  --font-doc:"FangSong","STFangsong","仿宋","Noto Serif SC",serif;  --font-song:"STSong","SimSun","宋体",serif;}body.tm-phase8-formal .zou-yuan *{box-sizing:border-box;margin:0;padding:0;}body.tm-phase8-formal .zou-yuan{font-family:var(--font);color:var(--ink);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow:hidden;  background:    radial-gradient(46% 36% at 50% -4%, rgba(255,238,196,0.5), transparent 70%),    radial-gradient(60% 50% at 18% 24%, rgba(120,100,70,0.13), transparent 60%),    radial-gradient(52% 60% at 86% 76%, rgba(80,60,40,0.16), transparent 55%),    radial-gradient(120% 120% at 50% 28%, var(--desk-1), var(--desk-2) 54%, var(--desk-3) 100%);;height:100%;display:flex;flex-direction:column;padding:14px 18px;}body.tm-phase8-formal .zou-yuan::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0.6;  background:    radial-gradient(58% 40% at 50% 0%, rgba(255,236,188,0.32), transparent 66%),    radial-gradient(150% 120% at 50% 42%, transparent 54%, rgba(58,42,22,0.5) 100%),    repeating-linear-gradient(91deg, rgba(92,68,40,0.05) 0 2px, transparent 2px 7px),    repeating-linear-gradient(106deg, rgba(80,60,36,0.03) 0 3px, transparent 3px 9px);}body.tm-phase8-formal .zou-yuan .zou-titlebar{flex:0 0 auto;position:relative;display:flex;align-items:center;justify-content:center;  padding:6px 0 12px;margin-bottom:10px;}body.tm-phase8-formal .zou-yuan .zou-titlebar::after{content:"";position:absolute;left:6%;right:6%;bottom:2px;height:1px;  background:linear-gradient(90deg,transparent,rgba(216,185,106,0.75) 22%,rgba(216,185,106,0.75) 78%,transparent);}body.tm-phase8-formal .zou-yuan .zou-titlebar::before{content:"";position:absolute;left:6%;right:6%;bottom:5px;height:1px;  background:linear-gradient(90deg,transparent,rgba(168,131,58,0.32) 30%,rgba(168,131,58,0.32) 70%,transparent);}body.tm-phase8-formal .zou-yuan .zt-center{text-align:center;position:relative;}body.tm-phase8-formal .zou-yuan .zt-center::before{content:"";position:absolute;left:50%;top:50%;width:88px;height:88px;transform:translate(-50%,-56%);  pointer-events:none;z-index:0;opacity:0.42;background:no-repeat center/contain;  background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cg fill=\'none\' stroke=\'%23a8833a\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'44\' stroke-width=\'1.4\' stroke-opacity=\'0.5\'/%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'37\' stroke-width=\'2.6\' stroke-opacity=\'0.34\'/%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'30\' stroke-width=\'1\' stroke-opacity=\'0.4\' stroke-dasharray=\'2 4\'/%3E%3C/g%3E%3C/svg%3E");}body.tm-phase8-formal .zou-yuan .zt-main{position:relative;z-index:1;font-size:25px;font-weight:bold;letter-spacing:0.32em;color:var(--ink);line-height:1.05;  text-shadow:0 1px 0 rgba(255,255,255,0.7),0 2px 4px rgba(120,90,36,0.26),0 0 16px rgba(216,185,106,0.24);}body.tm-phase8-formal .zou-yuan .zt-main::before,body.tm-phase8-formal .zou-yuan .zt-main::after{content:"";display:inline-block;width:30px;height:1px;vertical-align:0.34em;margin:0 16px;background:linear-gradient(90deg,transparent,var(--gold));}body.tm-phase8-formal .zou-yuan .zt-main::after{background:linear-gradient(90deg,var(--gold),transparent);}body.tm-phase8-formal .zou-yuan .zt-sub{font-size:12.5px;color:var(--ink-faint);letter-spacing:0.34em;margin-top:5px;}body.tm-phase8-formal .zou-yuan .zt-sub::before,body.tm-phase8-formal .zou-yuan .zt-sub::after{content:"◆";font-size:9px;color:var(--gold);opacity:0.62;vertical-align:0.22em;margin:0 11px;letter-spacing:0;}body.tm-phase8-formal .zou-yuan .zou-chips{position:absolute;right:2px;top:8px;display:flex;gap:7px;}body.tm-phase8-formal .zou-yuan .chip{font-size:11.5px;letter-spacing:0.06em;padding:3px 11px;border-radius:11px;border:1px solid var(--gold-d);  background:rgba(255,250,235,0.7);color:var(--ink-soft);white-space:nowrap;}body.tm-phase8-formal .zou-yuan .chip.hot{border-color:var(--cinnabar);color:#fff;background:linear-gradient(160deg,var(--cinnabar),var(--cinnabar-d));box-shadow:0 1px 5px rgba(122,32,24,0.4);}body.tm-phase8-formal .zou-yuan .chip.green{border-color:var(--jade);color:#23463a;background:rgba(111,162,145,0.22);}body.tm-phase8-formal .zou-yuan .zou-body{flex:1;min-height:0;display:flex;gap:16px;}body.tm-phase8-formal .zou-yuan .shelf{flex:0 0 286px;min-height:0;display:flex;flex-direction:column;position:relative;  border:1px solid rgba(168,131,58,0.4);border-radius:6px;overflow:hidden;  background:    linear-gradient(180deg,rgba(255,253,243,0.5),rgba(245,236,210,0.32)),    linear-gradient(135deg,rgba(58,40,22,0.04),rgba(40,28,15,0.07));  box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),0 10px 26px rgba(50,32,14,0.22);}body.tm-phase8-formal .zou-yuan .shelf-hd{flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:11px 13px 9px;border-bottom:1px solid rgba(168,131,58,0.3);}body.tm-phase8-formal .zou-yuan .shelf-seal{width:32px;height:32px;flex:0 0 auto;display:grid;place-items:center;border-radius:5px;font-size:17px;color:#fff;font-weight:bold;  background:linear-gradient(155deg,var(--cinnabar-hi),var(--cinnabar-d));border:1px solid rgba(122,32,24,0.6);  box-shadow:0 2px 6px rgba(122,32,24,0.4),inset 0 1px 0 rgba(255,255,255,0.28);}body.tm-phase8-formal .zou-yuan .shelf-hd b{font-size:15px;letter-spacing:0.12em;color:var(--ink);display:block;}body.tm-phase8-formal .zou-yuan .shelf-hd span{font-size:12px;color:var(--ink-faint);letter-spacing:0.06em;}body.tm-phase8-formal .zou-yuan .filters{flex:0 0 auto;display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 11px;border-bottom:1px solid rgba(168,131,58,0.22);}body.tm-phase8-formal .zou-yuan .filter{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 9px;cursor:pointer;font-family:var(--font);  border:1px solid rgba(168,131,58,0.28);border-radius:4px;background:rgba(255,252,240,0.5);color:var(--ink-soft);  font-size:12.5px;letter-spacing:0.04em;transition:all .15s;}body.tm-phase8-formal .zou-yuan .filter:first-child{grid-column:1 / -1;}body.tm-phase8-formal .zou-yuan .filter:hover{background:rgba(168,131,58,0.12);border-color:var(--gold);}body.tm-phase8-formal .zou-yuan .filter.active{color:#fff;background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));border-color:var(--cinnabar-d);box-shadow:0 2px 7px rgba(122,32,24,0.35);}body.tm-phase8-formal .zou-yuan .filter .fc{font-size:11.5px;min-width:18px;height:16px;padding:0 5px;border-radius:8px;display:inline-grid;place-items:center;  background:rgba(120,90,40,0.16);color:var(--ink-soft);}body.tm-phase8-formal .zou-yuan .filter.active .fc{background:rgba(255,255,255,0.26);color:#fff;}body.tm-phase8-formal .zou-yuan .shelf-scroll{flex:1;min-height:0;overflow-y:auto;padding:10px 11px 4px;scrollbar-width:none;}body.tm-phase8-formal .zou-yuan .shelf-scroll::-webkit-scrollbar{width:0;height:0;}body.tm-phase8-formal .zou-yuan .shelf-group{margin-bottom:12px;}body.tm-phase8-formal .zou-yuan .shelf-group-t{font-size:11.5px;letter-spacing:0.16em;color:var(--ink-faint);margin:0 0 7px 2px;display:flex;align-items:center;gap:7px;}body.tm-phase8-formal .zou-yuan .shelf-group-t::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 2px rgba(168,131,58,0.2);}body.tm-phase8-formal .zou-yuan .shelf-group-t small{color:var(--ink-faint);opacity:0.7;letter-spacing:0;}body.tm-phase8-formal .zou-yuan .zou-folder{position:relative;display:block;width:100%;text-align:left;cursor:pointer;font-family:var(--font);  margin-bottom:8px;padding:9px 11px 9px 15px;border-radius:4px;border:1px solid rgba(168,131,58,0.3);  background:linear-gradient(180deg,var(--silk-hi),var(--silk) 70%,var(--silk-lo));  box-shadow:0 2px 7px rgba(60,40,20,0.13),inset 0 1px 0 rgba(255,255,255,0.5);transition:transform .16s,box-shadow .16s,border-color .16s;overflow:hidden;}body.tm-phase8-formal .zou-yuan .zou-folder::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--tc,var(--gold));}body.tm-phase8-formal .zou-yuan .zou-folder::after{content:"";position:absolute;right:26%;top:0;bottom:0;width:1px;background:rgba(120,90,40,0.1);}body.tm-phase8-formal .zou-yuan .zou-folder:hover{transform:translateX(3px);box-shadow:0 4px 12px rgba(60,40,20,0.2);border-color:var(--gold);}body.tm-phase8-formal .zou-yuan .zou-folder.active{border-color:var(--cinnabar);box-shadow:-2px 0 0 var(--cinnabar),0 6px 16px rgba(60,40,20,0.26);transform:translateX(4px);  background:linear-gradient(180deg,#fffef7,#fbf4e0);}body.tm-phase8-formal .zou-yuan .zf-top{display:flex;align-items:center;gap:6px;margin-bottom:4px;}body.tm-phase8-formal .zou-yuan .zf-type{font-size:11.5px;font-weight:bold;letter-spacing:0.05em;padding:1px 7px;border-radius:3px;color:#fff;background:var(--tc,var(--gold));white-space:nowrap;}body.tm-phase8-formal .zou-yuan .zf-sub{font-size:11px;letter-spacing:0.04em;color:var(--ink-faint);padding:1px 6px;border-radius:3px;border:1px solid rgba(168,131,58,0.32);background:rgba(255,255,255,0.4);}body.tm-phase8-formal .zou-yuan .zf-sub.mi{color:var(--cinnabar-d);border-color:rgba(122,32,24,0.4);background:rgba(168,50,40,0.08);}body.tm-phase8-formal .zou-yuan .zf-urgent{margin-left:auto;width:7px;height:7px;border-radius:50%;background:var(--cinnabar);box-shadow:0 0 0 3px rgba(168,50,40,0.18);animation:zmy-pulse 1.8s ease-in-out infinite;}body.tm-phase8-formal .zou-yuan .zf-title{font-size:13.5px;color:var(--ink);line-height:1.35;font-weight:bold;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}body.tm-phase8-formal .zou-yuan .zf-meta{font-size:12px;color:var(--ink-faint);margin-top:3px;letter-spacing:0.02em;display:flex;align-items:center;gap:6px;}body.tm-phase8-formal .zou-yuan .zf-meta .dot{opacity:0.5;}body.tm-phase8-formal .zou-yuan .zf-rel{font-size:10.5px;letter-spacing:0;}body.tm-phase8-formal .zou-yuan .zf-rel i{font-style:normal;color:var(--gold);}body.tm-phase8-formal .zou-yuan .zf-rel i.off{color:rgba(120,90,40,0.25);}body.tm-phase8-formal .zou-yuan .zou-folder.done{opacity:0.78;}body.tm-phase8-formal .zou-yuan .zou-folder.done .zf-title{font-weight:normal;}body.tm-phase8-formal .zou-yuan .zf-stamp{position:absolute;right:7px;bottom:6px;font-size:10.5px;color:var(--cinnabar-d);opacity:0.7;border:1px solid rgba(122,32,24,0.4);border-radius:3px;padding:0 4px;transform:rotate(-7deg);}body.tm-phase8-formal .zou-yuan .zf-remote{font-size:10.5px;font-style:normal;width:16px;height:16px;display:inline-grid;place-items:center;border-radius:3px;color:var(--indigo);border:1px solid rgba(74,94,138,0.45);background:rgba(74,94,138,0.1);}body.tm-phase8-formal .zou-yuan .zf-held{margin-top:5px;font-size:11px;letter-spacing:0.03em;color:var(--ink-faint);}body.tm-phase8-formal .zou-yuan .zf-held.warn{color:var(--cinnabar-d);font-weight:bold;}body.tm-phase8-formal .zou-yuan .transit{flex:0 0 auto;border-top:1px solid rgba(168,131,58,0.3);padding:10px 12px 11px;background:rgba(58,40,22,0.04);}body.tm-phase8-formal .zou-yuan .transit-t{font-size:11.5px;letter-spacing:0.14em;color:var(--ink-faint);margin-bottom:7px;display:flex;align-items:center;gap:6px;}body.tm-phase8-formal .zou-yuan .transit-t::before{content:"⛟";font-size:12px;color:var(--gold);}body.tm-phase8-formal .zou-yuan .transit-row{font-size:12px;color:var(--ink-soft);padding:5px 0 6px 12px;position:relative;border-bottom:1px dashed rgba(168,131,58,0.22);}body.tm-phase8-formal .zou-yuan .transit-row:last-child{border-bottom:0;}body.tm-phase8-formal .zou-yuan .transit-row::before{content:"";position:absolute;left:0;top:9px;width:5px;height:5px;border-radius:50%;border:1px solid var(--gold);background:rgba(168,131,58,0.2);}body.tm-phase8-formal .zou-yuan .transit-row b{color:var(--ink);font-size:11.5px;}body.tm-phase8-formal .zou-yuan .transit-row em{font-style:normal;color:var(--ink-faint);float:right;font-size:11px;}body.tm-phase8-formal .zou-yuan .read{flex:1;min-height:0;display:flex;justify-content:center;position:relative;}body.tm-phase8-formal .zou-yuan .zouben{flex:1;max-width:760px;min-height:0;position:relative;display:flex;flex-direction:column;  background:    radial-gradient(80% 22% at 50% 0%, rgba(255,255,255,0.6), transparent 60%),    radial-gradient(42% 50% at 16% 26%, rgba(198,162,98,0.09), transparent 70%),    radial-gradient(46% 56% at 86% 76%, rgba(150,116,60,0.1), transparent 72%),    linear-gradient(180deg,var(--silk-hi),var(--silk) 38%,var(--silk-lo) 100%);  border:1px solid var(--silk-edge);border-radius:5px;  box-shadow:0 18px 44px rgba(50,32,14,0.32),0 0 36px rgba(120,90,40,0.14),inset 0 1px 0 rgba(255,255,255,0.55),inset 0 0 110px var(--silk-shadow);  overflow:hidden;animation:zmy-benIn .5s cubic-bezier(.2,.72,.28,1) both;}body.tm-phase8-formal .zou-yuan .zouben::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:0.46;mix-blend-mode:multiply;z-index:0;  background-image:    url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'240\' height=\'240\'%3E%3Cfilter id=\'fib\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.012 0.55\' numOctaves=\'3\' seed=\'9\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type=\'linear\' slope=\'0.5\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23fib)\'/%3E%3C/svg%3E"),    repeating-linear-gradient(0deg, rgba(120,90,40,0.04) 0 1px, transparent 1px 4px);  background-size:240px 240px, auto;}body.tm-phase8-formal .zou-yuan .zouben > *{position:relative;z-index:1;}body.tm-phase8-formal .zou-yuan .ben-head{flex:0 0 auto;padding:16px 30px 13px;border-bottom:1px solid rgba(168,131,58,0.36);position:relative;}body.tm-phase8-formal .zou-yuan .ben-head::after{content:"";position:absolute;left:24px;right:24px;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(216,185,106,0.6) 20%,rgba(216,185,106,0.6) 80%,transparent);}body.tm-phase8-formal .zou-yuan .bh-row{display:flex;align-items:flex-start;gap:14px;}body.tm-phase8-formal .zou-yuan .bh-seal{flex:0 0 auto;width:52px;height:64px;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;  color:#fff;background:linear-gradient(155deg,var(--tc,var(--gold)),color-mix(in srgb,var(--tc,var(--gold)) 64%,#000));  border:1px solid rgba(0,0,0,0.25);box-shadow:0 3px 9px rgba(40,28,15,0.34),inset 0 1px 0 rgba(255,255,255,0.3);position:relative;}body.tm-phase8-formal .zou-yuan .bh-seal::after{content:"";position:absolute;inset:3px;border:1px solid rgba(255,255,255,0.32);border-radius:3px;}body.tm-phase8-formal .zou-yuan .bh-seal b{font-size:18px;font-weight:bold;line-height:1;letter-spacing:0.02em;}body.tm-phase8-formal .zou-yuan .bh-seal span{font-size:10px;letter-spacing:0.04em;opacity:0.92;}body.tm-phase8-formal .zou-yuan .bh-main{flex:1;min-width:0;}body.tm-phase8-formal .zou-yuan .bh-title{font-size:21px;font-weight:bold;letter-spacing:0.04em;color:var(--ink);line-height:1.3;  text-shadow:0 1px 0 rgba(255,255,255,0.6);}body.tm-phase8-formal .zou-yuan .bh-author{font-size:13px;color:var(--ink-soft);margin-top:6px;letter-spacing:0.03em;}body.tm-phase8-formal .zou-yuan .bh-author b{color:var(--ink);font-size:14px;}body.tm-phase8-formal .zou-yuan .bh-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;}body.tm-phase8-formal .zou-yuan .bh-tag{font-size:12px;letter-spacing:0.04em;padding:2px 9px;border-radius:11px;border:1px solid rgba(168,131,58,0.4);background:rgba(255,252,240,0.6);color:var(--ink-soft);}body.tm-phase8-formal .zou-yuan .bh-tag.mi{color:var(--cinnabar-d);border-color:rgba(122,32,24,0.45);background:rgba(168,50,40,0.07);}body.tm-phase8-formal .zou-yuan .bh-tag.impeach{color:#fff;border-color:var(--cinnabar-d);background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));font-weight:bold;box-shadow:0 1px 4px rgba(122,32,24,0.3);}body.tm-phase8-formal .zou-yuan .bh-tag.remote{color:var(--indigo);border-color:rgba(74,94,138,0.5);background:rgba(74,94,138,0.09);}body.tm-phase8-formal .zou-yuan .bh-tag .rel-d{color:var(--jade-hi);}body.tm-phase8-formal .zou-yuan .bh-tag .rel-d.lo{color:var(--cinnabar);}body.tm-phase8-formal .zou-yuan .bh-status{position:absolute;top:14px;right:30px;}body.tm-phase8-formal .zou-yuan .ben-body{flex:1;min-height:0;overflow-y:auto;padding:20px 32px 16px;scrollbar-width:none;position:relative;}body.tm-phase8-formal .zou-yuan .ben-body::-webkit-scrollbar{width:0;height:0;}body.tm-phase8-formal .zou-yuan .ben-paper{position:relative;padding:18px 22px 20px;border:1px double rgba(168,50,40,0.42);border-radius:2px;  background:    repeating-linear-gradient(90deg, transparent 0 calc(2.05em - 1px), rgba(168,50,40,0.12) calc(2.05em - 1px) 2.05em),    linear-gradient(180deg, rgba(255,252,242,0.55), rgba(248,240,222,0.4));  box-shadow:inset 0 0 24px rgba(168,131,58,0.08);}body.tm-phase8-formal .zou-yuan .ben-paper::before,body.tm-phase8-formal .zou-yuan .ben-paper::after{content:"";position:absolute;left:8px;right:8px;height:1px;background:rgba(168,50,40,0.4);}body.tm-phase8-formal .zou-yuan .ben-paper::before{top:7px;box-shadow:0 3px 0 rgba(168,50,40,0.18);}body.tm-phase8-formal .zou-yuan .ben-paper::after{bottom:7px;box-shadow:0 -3px 0 rgba(168,50,40,0.18);}body.tm-phase8-formal .zou-yuan .bp-open{font-size:14.5px;letter-spacing:0.04em;color:var(--ink-soft);margin-bottom:10px;}body.tm-phase8-formal .zou-yuan .bp-open b{color:var(--ink);}body.tm-phase8-formal .zou-yuan .ben-text{font-family:var(--font-doc);font-size:15.5px;line-height:2.05;color:var(--ink);letter-spacing:0.02em;text-align:justify;white-space:pre-wrap;  text-indent:2em;}body.tm-phase8-formal .zou-yuan .ben-text.collapsed{display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden;}body.tm-phase8-formal .zou-yuan .bp-close{font-family:var(--font-doc);font-size:14px;color:var(--ink-soft);margin-top:12px;text-align:right;letter-spacing:0.04em;}body.tm-phase8-formal .zou-yuan .ben-toggle{display:inline-block;margin-top:8px;font-size:12.5px;color:var(--cinnabar-d);cursor:pointer;border:none;background:none;font-family:var(--font);letter-spacing:0.06em;}body.tm-phase8-formal .zou-yuan .ben-toggle:hover{color:var(--cinnabar);text-decoration:underline;}body.tm-phase8-formal .zou-yuan .ben-sealed{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:40px;}body.tm-phase8-formal .zou-yuan .ben-empty{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:40px;text-align:center;}body.tm-phase8-formal .zou-yuan .ben-empty-seal{width:64px;height:64px;display:grid;place-items:center;border-radius:9px;font-size:31px;font-weight:bold;color:#fff;background:linear-gradient(155deg,var(--gold-hi),var(--gold-d));box-shadow:0 4px 13px rgba(125,94,34,0.38),inset 0 1px 0 rgba(255,255,255,0.3);opacity:0.82;margin-bottom:8px;}body.tm-phase8-formal .zou-yuan .ben-empty h3{font-size:19px;letter-spacing:0.32em;color:var(--ink-soft);font-weight:bold;}body.tm-phase8-formal .zou-yuan .ben-empty p{font-size:13px;color:var(--ink-faint);letter-spacing:0.08em;}body.tm-phase8-formal .zou-yuan .ben-empty small{font-size:12px;color:var(--ink-faint);opacity:0.72;letter-spacing:0.04em;margin-top:5px;}body.tm-phase8-formal .zou-yuan .wax{width:118px;height:118px;border-radius:50%;position:relative;display:grid;place-items:center;cursor:pointer;  background:radial-gradient(circle at 38% 32%, var(--cinnabar-hi), var(--cinnabar) 45%, var(--cinnabar-d) 100%);  box-shadow:0 8px 22px rgba(122,32,24,0.5),inset 0 3px 8px rgba(255,180,160,0.4),inset 0 -8px 14px rgba(60,10,6,0.5);  border:2px solid rgba(80,16,10,0.6);transition:transform .2s;animation:zmy-waxBreath 3s ease-in-out infinite;}body.tm-phase8-formal .zou-yuan .wax:hover{transform:scale(1.05);}body.tm-phase8-formal .zou-yuan .wax::before{content:"";position:absolute;inset:-9px;border-radius:50%;border:1px dashed rgba(122,32,24,0.4);}body.tm-phase8-formal .zou-yuan .wax b{font-size:30px;color:#ffe8df;font-weight:bold;text-shadow:0 2px 3px rgba(60,10,6,0.6);letter-spacing:0.05em;transform:rotate(-6deg);}body.tm-phase8-formal .zou-yuan .sealed-hint{text-align:center;color:var(--ink-soft);}body.tm-phase8-formal .zou-yuan .sealed-hint h4{font-size:16px;letter-spacing:0.16em;color:var(--cinnabar-d);margin-bottom:6px;}body.tm-phase8-formal .zou-yuan .sealed-hint p{font-size:12.5px;color:var(--ink-faint);letter-spacing:0.04em;}body.tm-phase8-formal .zou-yuan .ben-foot{flex:0 0 auto;padding:13px 30px 16px;border-top:1px solid rgba(168,131,58,0.36);position:relative;background:linear-gradient(180deg,transparent,rgba(168,131,58,0.05));}body.tm-phase8-formal .zou-yuan .pizhu-lbl{display:flex;align-items:center;gap:8px;margin-bottom:7px;}body.tm-phase8-formal .zou-yuan .pizhu-lbl b{font-size:14px;letter-spacing:0.16em;color:var(--cinnabar-d);}body.tm-phase8-formal .zou-yuan .pizhu-lbl::before{content:"御 笔";font-size:11px;letter-spacing:0.1em;color:#fff;background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));padding:2px 7px;border-radius:3px;}body.tm-phase8-formal .zou-yuan .pizhu-lbl small{margin-left:auto;font-size:11.5px;color:var(--ink-faint);}body.tm-phase8-formal .zou-yuan .pizhu-quick{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;}body.tm-phase8-formal .zou-yuan .qphrase{font-family:var(--font);font-size:11.5px;letter-spacing:0.05em;color:var(--cinnabar-d);cursor:pointer;  padding:2px 10px;border-radius:12px;border:1px solid rgba(122,32,24,0.34);background:rgba(168,50,40,0.05);transition:all .14s;}body.tm-phase8-formal .zou-yuan .qphrase:hover{background:var(--cinnabar);color:#fff;border-color:var(--cinnabar);}body.tm-phase8-formal .zou-yuan .pizhu-ta{width:100%;min-height:54px;resize:vertical;font-family:var(--font);font-size:15px;line-height:1.7;letter-spacing:0.04em;  color:var(--cinnabar);padding:9px 13px;border:1px solid rgba(122,32,24,0.3);border-radius:4px;  background:    repeating-linear-gradient(0deg, transparent 0 calc(1.7em - 1px), rgba(168,50,40,0.08) calc(1.7em - 1px) 1.7em),    rgba(255,252,244,0.7);  box-shadow:inset 0 1px 3px rgba(120,40,30,0.1);outline:none;transition:border-color .15s,box-shadow .15s;}body.tm-phase8-formal .zou-yuan .pizhu-ta::placeholder{color:rgba(168,50,40,0.4);}body.tm-phase8-formal .zou-yuan .pizhu-ta:focus{border-color:var(--cinnabar);box-shadow:inset 0 1px 3px rgba(120,40,30,0.12),0 0 0 3px rgba(168,50,40,0.1);}body.tm-phase8-formal .zou-yuan .pizhu-acts{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px;}body.tm-phase8-formal .zou-yuan .pact{font-family:var(--font);font-size:13px;letter-spacing:0.08em;cursor:pointer;padding:7px 16px;border-radius:5px;  border:1px solid var(--gold-d);background:#fbf4e2;color:var(--ink-soft);transition:all .15s;display:inline-flex;align-items:center;gap:4px;  box-shadow:0 1px 3px rgba(80,56,24,0.12);}body.tm-phase8-formal .zou-yuan .pact:hover{background:#fff;border-color:var(--gold);color:var(--ink);transform:translateY(-1px);}body.tm-phase8-formal .zou-yuan .pact.primary{color:#fff;background:linear-gradient(155deg,var(--cinnabar-hi),var(--cinnabar-d));border-color:var(--cinnabar-d);box-shadow:0 2px 8px rgba(122,32,24,0.34);}body.tm-phase8-formal .zou-yuan .pact.primary:hover{background:linear-gradient(155deg,#d2564a,var(--cinnabar));color:#fff;}body.tm-phase8-formal .zou-yuan .pact.jade{border-color:var(--jade);color:#23463a;background:rgba(111,162,145,0.18);}body.tm-phase8-formal .zou-yuan .pact.jade:hover{background:rgba(111,162,145,0.32);color:#16302a;}body.tm-phase8-formal .zou-yuan .pact.danger{border-color:rgba(122,32,24,0.5);color:var(--cinnabar-d);}body.tm-phase8-formal .zou-yuan .pact.danger:hover{background:rgba(168,50,40,0.1);}body.tm-phase8-formal .zou-yuan .pact-sep{flex:0 0 1px;align-self:stretch;margin:2px 3px;background:rgba(168,131,58,0.3);}body.tm-phase8-formal .zou-yuan .aside{flex:0 0 250px;min-height:0;display:flex;flex-direction:column;gap:12px;overflow-y:auto;scrollbar-width:none;}body.tm-phase8-formal .zou-yuan .aside::-webkit-scrollbar{width:0;}body.tm-phase8-formal .zou-yuan .card{flex:0 0 auto;border:1px solid rgba(168,131,58,0.38);border-radius:6px;overflow:hidden;  background:linear-gradient(180deg,rgba(255,253,243,0.55),rgba(245,236,210,0.34));  box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),0 6px 16px rgba(50,32,14,0.16);}body.tm-phase8-formal .zou-yuan .card-hd{display:flex;align-items:center;gap:7px;padding:9px 13px;border-bottom:1px solid rgba(168,131,58,0.28);  font-size:13.5px;letter-spacing:0.1em;color:var(--ink);background:linear-gradient(90deg,rgba(168,131,58,0.1),transparent);}body.tm-phase8-formal .zou-yuan .card-hd .ci{width:20px;height:20px;flex:0 0 auto;display:grid;place-items:center;border-radius:4px;font-size:12px;color:#fff;  background:linear-gradient(150deg,var(--gold-hi),var(--gold-d));}body.tm-phase8-formal .zou-yuan .card-bd{padding:11px 13px 13px;}body.tm-phase8-formal .zou-yuan .piaoni{font-family:var(--font-doc);font-size:13.5px;line-height:1.85;color:var(--ink-soft);letter-spacing:0.02em;  padding:9px 11px;border-radius:4px;border:1px dashed rgba(120,90,40,0.34);background:rgba(255,250,235,0.5);position:relative;}body.tm-phase8-formal .zou-yuan .piaoni::before{content:"拟";position:absolute;right:8px;top:6px;font-size:24px;color:rgba(120,90,40,0.1);font-weight:bold;}body.tm-phase8-formal .zou-yuan .piaoni .pn-from{display:block;font-family:var(--font);font-size:12px;color:var(--ink-faint);margin-top:7px;letter-spacing:0.04em;}body.tm-phase8-formal .zou-yuan .piaoni-take{margin-top:9px;width:100%;font-family:var(--font);font-size:12px;letter-spacing:0.08em;cursor:pointer;  padding:6px;border-radius:4px;border:1px solid var(--gold-d);background:#fbf4e2;color:var(--gold-d);transition:all .14s;}body.tm-phase8-formal .zou-yuan .piaoni-take:hover{background:var(--gold);color:#fff;border-color:var(--gold);}body.tm-phase8-formal .zou-yuan .who{display:flex;align-items:center;gap:11px;}body.tm-phase8-formal .zou-yuan .who-face{width:46px;height:56px;flex:0 0 auto;border-radius:4px;display:grid;place-items:center;font-size:22px;font-weight:bold;color:var(--ink);  background:linear-gradient(160deg,#efe3c4,#d9c79d);border:1px solid rgba(168,131,58,0.5);box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),0 2px 6px rgba(60,40,20,0.18);}body.tm-phase8-formal .zou-yuan .who-info b{font-size:14.5px;color:var(--ink);display:block;letter-spacing:0.03em;}body.tm-phase8-formal .zou-yuan .who-info span{font-size:11.5px;color:var(--ink-faint);display:block;margin-top:2px;letter-spacing:0.02em;}body.tm-phase8-formal .zou-yuan .who-meta{display:grid;grid-template-columns:auto 1fr;gap:5px 9px;margin-top:11px;font-size:12px;}body.tm-phase8-formal .zou-yuan .who-meta dt{color:var(--ink-faint);letter-spacing:0.06em;}body.tm-phase8-formal .zou-yuan .who-meta dd{color:var(--ink);text-align:right;}body.tm-phase8-formal .zou-yuan .relbar{display:inline-flex;align-items:center;gap:2px;}body.tm-phase8-formal .zou-yuan .relbar i{width:14px;height:4px;border-radius:2px;background:rgba(120,90,40,0.18);}body.tm-phase8-formal .zou-yuan .relbar i.on{background:var(--jade);}body.tm-phase8-formal .zou-yuan .relbar i.on.bad{background:var(--cinnabar);}body.tm-phase8-formal .zou-yuan .chain{display:flex;flex-direction:column;gap:0;font-size:12px;}body.tm-phase8-formal .zou-yuan .chain-row{display:flex;align-items:flex-start;gap:9px;padding:5px 0;position:relative;}body.tm-phase8-formal .zou-yuan .chain-row:not(:last-child)::after{content:"";position:absolute;left:9px;top:21px;bottom:-3px;width:1px;background:rgba(168,131,58,0.3);}body.tm-phase8-formal .zou-yuan .chain-dot{flex:0 0 auto;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:10px;color:#fff;margin-top:1px;  background:linear-gradient(150deg,var(--gold-hi),var(--gold-d));}body.tm-phase8-formal .zou-yuan .chain-row b{color:var(--ink);font-size:12px;letter-spacing:0.04em;}body.tm-phase8-formal .zou-yuan .chain-row p{color:var(--ink-faint);font-size:12px;line-height:1.5;margin-top:1px;}body.tm-phase8-formal .zou-yuan .impact{display:grid;gap:8px;}body.tm-phase8-formal .zou-yuan .imp-row{display:flex;align-items:center;justify-content:space-between;font-size:12px;padding:5px 9px;border-radius:4px;background:rgba(255,250,235,0.5);border:1px solid rgba(168,131,58,0.22);}body.tm-phase8-formal .zou-yuan .imp-row span{color:var(--ink-faint);letter-spacing:0.04em;}body.tm-phase8-formal .zou-yuan .imp-row b{color:var(--ink);}body.tm-phase8-formal .zou-yuan .imp-row b.up{color:var(--jade);}body.tm-phase8-formal .zou-yuan .imp-row b.dn{color:var(--cinnabar);}body.tm-phase8-formal .zou-yuan .imp-foot{margin-top:8px;font-size:11.5px;color:var(--ink-faint);letter-spacing:0.04em;text-align:right;font-style:italic;}body.tm-phase8-formal .zou-yuan .imp-pending{font-size:12px;color:var(--ink-faint);line-height:1.78;letter-spacing:0.03em;}body.tm-phase8-formal .zou-yuan .imp-pending b{color:var(--ink-soft);}body.tm-phase8-formal .zou-yuan .imp-note{display:inline-block;margin-top:7px;padding:1px 8px;border-radius:10px;font-size:11.5px;color:var(--cinnabar-d);background:rgba(168,50,40,0.06);border:1px dashed rgba(122,32,24,0.3);letter-spacing:0.03em;}body.tm-phase8-formal .zou-yuan .imp-relay{margin-top:9px;padding:7px 10px;font-size:11.5px;line-height:1.6;color:var(--indigo);background:rgba(74,94,138,0.07);border:1px dashed rgba(74,94,138,0.35);border-radius:4px;letter-spacing:0.03em;}body.tm-phase8-formal .zou-yuan .imp-relay b{color:var(--indigo);}body.tm-phase8-formal .zou-yuan .held-banner{flex:0 0 auto;margin:9px 30px 0;padding:8px 14px;font-size:12px;letter-spacing:0.03em;color:var(--ink-soft);background:rgba(168,131,58,0.1);border-left:3px solid var(--gold);border-radius:0 4px 4px 0;}body.tm-phase8-formal .zou-yuan .held-banner b{color:var(--ink);}body.tm-phase8-formal .zou-yuan .held-banner.warn{color:var(--cinnabar-d);background:rgba(168,50,40,0.07);border-left-color:var(--cinnabar);}body.tm-phase8-formal .zou-yuan .held-banner.warn b{color:var(--cinnabar-d);}body.tm-phase8-formal .zou-yuan .card-hd .hd-note{margin-left:auto;font-size:11.5px;font-weight:normal;letter-spacing:0.04em;color:var(--ink-faint);padding:1px 8px;border-radius:9px;background:rgba(120,90,40,0.08);}@keyframes zmy-pulse{0%,100%{box-shadow:0 0 0 3px rgba(168,50,40,0.18);}50%{box-shadow:0 0 0 5px rgba(168,50,40,0.05);}}@keyframes zmy-waxBreath{0%,100%{box-shadow:0 8px 22px rgba(122,32,24,0.5),inset 0 3px 8px rgba(255,180,160,0.4),inset 0 -8px 14px rgba(60,10,6,0.5);}50%{box-shadow:0 8px 28px rgba(122,32,24,0.62),inset 0 3px 8px rgba(255,180,160,0.5),inset 0 -8px 14px rgba(60,10,6,0.5);}}@keyframes zmy-headDrop{from{opacity:0;transform:translateY(-14px);}to{opacity:1;transform:translateY(0);}}@keyframes zmy-bodyRise{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}@keyframes zmy-benIn{from{opacity:0;transform:translateY(10px) scale(0.99);}to{opacity:1;transform:translateY(0) scale(1);}}body.tm-phase8-formal .zou-yuan .stamp-fx{position:absolute;left:50%;top:50%;width:120px;height:120px;transform:translate(-50%,-50%) scale(2.4) rotate(-12deg);  opacity:0;pointer-events:none;z-index:30;border-radius:8px;border:3px solid var(--cinnabar);  display:grid;place-items:center;font-size:30px;font-weight:bold;color:var(--cinnabar);  box-shadow:0 0 0 4px rgba(168,50,40,0.2);}body.tm-phase8-formal .zou-yuan .stamp-fx.go{animation:zmy-stampDrop .6s cubic-bezier(.3,1.4,.5,1) forwards;}@keyframes zmy-stampDrop{0%{opacity:0;transform:translate(-50%,-50%) scale(2.4) rotate(-12deg);}40%{opacity:0.95;transform:translate(-50%,-50%) scale(1) rotate(-12deg);}100%{opacity:0;transform:translate(-50%,-50%) scale(1.05) rotate(-12deg);}}';
    __css = memorialReadingCss(__css);
    if (st.__tmCss !== __css) { st.__tmCss = __css; st.textContent = __css; }
  }
  function installHongyanYuanStyles(){
    var st = document.getElementById('tm-hongyan-yuan-style');
    if (!st) { st = document.createElement('style'); st.id = 'tm-hongyan-yuan-style'; document.head.appendChild(st); }
    var __css = 'body.tm-phase8-formal .yan-yuan{--desk-1:#dccca6;--desk-2:#c6b083;--desk-3:#a78f68;  --silk-hi:#fffdf3;--silk:#f6efda;--silk-lo:#ece1c6;--silk-edge:#dcc99c;  --silk-shadow:rgba(120,90,36,0.1);  --paper-hi:#fffefb;--paper:#fcf7ec;--paper-lo:#f3ecd9;  --ink:#241d15;--ink-soft:#574733;--ink-faint:#9c8b6b;  --gold-hi:#d8b96a;--gold:#a8833a;--gold-d:#7d5e22;  --cinnabar:#a83228;--cinnabar-hi:#c64a3e;--cinnabar-d:#7a2018;  --wood-1:#6b4a28;--wood-2:#3f2a14;--wood-edge:#2a1b0c;--knob:#241810;  --jade:#557f6f;--jade-hi:#6fa291;  --indigo:#4a5e8a;--indigo-hi:#6a7eaa;--violet:#7c6a90;--amber:#b98b2f;  --route:#9a7536;  --font:"STKaiti","KaiTi","楷体","Noto Serif SC","Source Han Serif CN","STSong",serif;  --font-doc:"FangSong","STFangsong","仿宋","Noto Serif SC",serif;  --font-song:"STSong","SimSun","宋体",serif;}body.tm-phase8-formal .yan-yuan *{box-sizing:border-box;margin:0;padding:0;}body.tm-phase8-formal .yan-yuan{font-family:var(--font);color:var(--ink);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow:hidden;  background:    radial-gradient(46% 36% at 50% -4%, rgba(255,238,196,0.5), transparent 70%),    radial-gradient(60% 50% at 18% 24%, rgba(120,100,70,0.13), transparent 60%),    radial-gradient(52% 60% at 86% 76%, rgba(80,60,40,0.16), transparent 55%),    radial-gradient(120% 120% at 50% 28%, var(--desk-1), var(--desk-2) 54%, var(--desk-3) 100%);;height:100%;display:flex;flex-direction:column;padding:14px 18px;}body.tm-phase8-formal .yan-yuan::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0.55;  background:    radial-gradient(66% 48% at 50% -2%, rgba(255,239,196,0.38), transparent 60%),    radial-gradient(150% 130% at 50% 50%, transparent 58%, rgba(48,34,18,0.46) 100%);}body.tm-phase8-formal .yan-yuan .yan-titlebar{flex:0 0 auto;position:relative;display:flex;align-items:center;justify-content:center;padding:6px 0 12px;margin-bottom:10px;}body.tm-phase8-formal .yan-yuan .yan-titlebar::after{content:"";position:absolute;left:6%;right:6%;bottom:2px;height:1px;  background:linear-gradient(90deg,transparent,rgba(216,185,106,0.75) 22%,rgba(216,185,106,0.75) 78%,transparent);}body.tm-phase8-formal .yan-yuan .yan-titlebar::before{content:"";position:absolute;left:6%;right:6%;bottom:5px;height:1px;  background:linear-gradient(90deg,transparent,rgba(168,131,58,0.32) 30%,rgba(168,131,58,0.32) 70%,transparent);}body.tm-phase8-formal .yan-yuan .yt-center{text-align:center;position:relative;}body.tm-phase8-formal .yan-yuan .yt-center::before{content:"";position:absolute;left:50%;top:50%;width:92px;height:92px;transform:translate(-50%,-56%);  pointer-events:none;z-index:0;opacity:0.4;background:no-repeat center/contain;  background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cg fill=\'none\' stroke=\'%23a8833a\' stroke-opacity=\'0.5\'%3E%3Cpath d=\'M14 40 Q26 30 38 40 Q50 30 62 40 Q74 30 86 40\' stroke-width=\'1.6\'/%3E%3Cpath d=\'M20 52 Q32 44 44 52 Q56 44 68 52\' stroke-width=\'1.2\' stroke-opacity=\'0.34\'/%3E%3C/g%3E%3C/svg%3E");}body.tm-phase8-formal .yan-yuan .yt-main{position:relative;z-index:1;font-size:25px;font-weight:bold;letter-spacing:0.32em;color:var(--ink);line-height:1.05;  text-shadow:0 1px 0 rgba(255,255,255,0.7),0 2px 4px rgba(120,90,36,0.26),0 0 16px rgba(216,185,106,0.24);}body.tm-phase8-formal .yan-yuan .yt-main::before,body.tm-phase8-formal .yan-yuan .yt-main::after{content:"";display:inline-block;width:30px;height:1px;vertical-align:0.34em;margin:0 16px;background:linear-gradient(90deg,transparent,var(--gold));}body.tm-phase8-formal .yan-yuan .yt-main::after{background:linear-gradient(90deg,var(--gold),transparent);}body.tm-phase8-formal .yan-yuan .yt-sub{font-size:12.5px;color:var(--ink-faint);letter-spacing:0.34em;margin-top:5px;}body.tm-phase8-formal .yan-yuan .yt-sub::before,body.tm-phase8-formal .yan-yuan .yt-sub::after{content:"✦";font-size:9px;color:var(--gold);opacity:0.62;vertical-align:0.22em;margin:0 11px;letter-spacing:0;}body.tm-phase8-formal .yan-yuan .yan-chips{position:absolute;right:2px;top:8px;display:flex;gap:7px;}body.tm-phase8-formal .yan-yuan .chip{font-size:11.5px;letter-spacing:0.06em;padding:3px 11px;border-radius:11px;border:1px solid var(--gold-d);  background:rgba(255,250,235,0.7);color:var(--ink-soft);white-space:nowrap;}body.tm-phase8-formal .yan-yuan .chip.hot{border-color:var(--cinnabar);color:#fff;background:linear-gradient(160deg,var(--cinnabar),var(--cinnabar-d));box-shadow:0 1px 5px rgba(122,32,24,0.4);}body.tm-phase8-formal .yan-yuan .chip.green{border-color:var(--jade);color:#23463a;background:rgba(111,162,145,0.22);}body.tm-phase8-formal .yan-yuan .chip.indigo{border-color:var(--indigo);color:#2b3a5c;background:rgba(74,94,138,0.16);}body.tm-phase8-formal .yan-yuan .yan-body{flex:1;min-height:0;display:flex;gap:18px;}body.tm-phase8-formal .yan-yuan .roster{flex:0 0 274px;min-height:0;display:flex;flex-direction:column;position:relative;  border:1px solid rgba(168,131,58,0.22);border-radius:12px;overflow:hidden;  background:linear-gradient(180deg,rgba(255,253,243,0.46),rgba(245,236,210,0.24));  box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),0 16px 38px -20px rgba(50,32,14,0.46);}body.tm-phase8-formal .yan-yuan .roster-hd{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:15px 16px 12px;border-bottom:1px solid rgba(168,131,58,0.18);}body.tm-phase8-formal .yan-yuan .roster-seal{width:32px;height:32px;flex:0 0 auto;display:grid;place-items:center;border-radius:8px;font-size:17px;color:#fff;font-weight:bold;  background:linear-gradient(155deg,var(--gold-hi),var(--gold-d));border:1px solid rgba(125,94,34,0.6);  box-shadow:0 2px 6px rgba(125,94,34,0.4),inset 0 1px 0 rgba(255,255,255,0.28);}body.tm-phase8-formal .yan-yuan .roster-hd b{font-size:15px;letter-spacing:0.12em;color:var(--ink);display:block;}body.tm-phase8-formal .yan-yuan .roster-hd span{font-size:12px;color:var(--ink-faint);letter-spacing:0.06em;}body.tm-phase8-formal .yan-yuan .roster-tools{flex:0 0 auto;padding:9px 11px;border-bottom:1px solid rgba(168,131,58,0.22);display:flex;flex-direction:column;gap:8px;}body.tm-phase8-formal .yan-yuan .yan-search{position:relative;}body.tm-phase8-formal .yan-yuan .yan-search input{width:100%;font-family:var(--font);font-size:12.5px;letter-spacing:0.03em;color:var(--ink);  padding:8px 11px 8px 30px;border:1px solid rgba(168,131,58,0.3);border-radius:8px;background:rgba(255,252,242,0.66);outline:none;transition:border-color .15s;}body.tm-phase8-formal .yan-yuan .yan-search input::placeholder{color:var(--ink-faint);}body.tm-phase8-formal .yan-yuan .yan-search input:focus{border-color:var(--gold);}body.tm-phase8-formal .yan-yuan .yan-search::before{content:"⌕";position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:15px;color:var(--ink-faint);}body.tm-phase8-formal .yan-yuan .multi-bar{display:flex;align-items:center;gap:8px;}body.tm-phase8-formal .yan-yuan .multi-toggle{font-family:var(--font);font-size:12px;letter-spacing:0.06em;cursor:pointer;padding:6px 12px;border-radius:13px;  border:1px solid var(--gold-d);background:#fbf4e2;color:var(--ink-soft);transition:all .15s;white-space:nowrap;}body.tm-phase8-formal .yan-yuan .multi-toggle:hover{border-color:var(--gold);color:var(--ink);}body.tm-phase8-formal .yan-yuan .multi-toggle.on{color:#fff;background:linear-gradient(155deg,var(--cinnabar),var(--cinnabar-d));border-color:var(--cinnabar-d);box-shadow:0 1px 5px rgba(122,32,24,0.35);}body.tm-phase8-formal .yan-yuan .multi-hint{font-size:11.5px;color:var(--ink-faint);letter-spacing:0.02em;line-height:1.4;}body.tm-phase8-formal .yan-yuan .roster-scroll{flex:1;min-height:0;overflow-y:auto;padding:10px 11px 6px;scrollbar-width:none;}body.tm-phase8-formal .yan-yuan .roster-scroll::-webkit-scrollbar{width:0;height:0;}body.tm-phase8-formal .yan-yuan .region-group{margin-bottom:14px;}body.tm-phase8-formal .yan-yuan .region-t{font-size:11.5px;letter-spacing:0.2em;color:var(--ink-faint);margin:2px 0 7px 4px;display:flex;align-items:center;gap:7px;}body.tm-phase8-formal .yan-yuan .region-t::before{content:"";width:4px;height:4px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 2px rgba(168,131,58,0.18);}body.tm-phase8-formal .yan-yuan .contact{position:relative;display:flex;align-items:center;gap:11px;width:100%;text-align:left;cursor:pointer;font-family:var(--font);  margin-bottom:3px;padding:10px 12px;border-radius:10px;border:1px solid transparent;  background:transparent;transition:background .18s,box-shadow .18s,border-color .18s;}body.tm-phase8-formal .yan-yuan .contact:hover{background:rgba(255,253,243,0.62);}body.tm-phase8-formal .yan-yuan .contact.active{border-color:rgba(168,50,40,0.26);background:linear-gradient(180deg,#fffdf6,#fbf4e2);box-shadow:0 8px 20px -10px rgba(60,40,20,0.4);}body.tm-phase8-formal .yan-yuan .contact.active::before{content:"";position:absolute;left:0;top:11px;bottom:11px;width:2.5px;border-radius:2px;background:linear-gradient(180deg,var(--cinnabar),var(--cinnabar-d));}body.tm-phase8-formal .yan-yuan .contact-face{width:38px;height:44px;flex:0 0 auto;border-radius:8px;display:grid;place-items:center;font-size:17px;font-weight:bold;color:var(--ink-soft);  background:linear-gradient(160deg,#efe3c4,#dcca9f);border:1px solid rgba(168,131,58,0.34);box-shadow:inset 0 1px 0 rgba(255,255,255,0.5);}body.tm-phase8-formal .yan-yuan .contact-face,body.tm-phase8-formal .yan-yuan .cmp-face,body.tm-phase8-formal .yan-yuan .inc-seal{overflow:hidden;position:relative;}body.tm-phase8-formal .yan-yuan .pt-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;display:block;filter:sepia(0.1) saturate(0.97) contrast(1.01);}body.tm-phase8-formal .yan-yuan .has-portrait::after{content:attr(data-glyph);display:none;position:absolute;inset:0;place-items:center;font-family:var(--font);font-weight:bold;}body.tm-phase8-formal .yan-yuan .has-portrait.fallback::after{display:grid;}body.tm-phase8-formal .yan-yuan .has-portrait.fallback .pt-img{display:none;}body.tm-phase8-formal .yan-yuan .cmp-face .pt-img{object-position:center 18%;}body.tm-phase8-formal .yan-yuan .inc-seal .pt-img{object-position:center 14%;}body.tm-phase8-formal .yan-yuan .contact.active .contact-face{color:var(--cinnabar-d);border-color:rgba(168,50,40,0.38);}body.tm-phase8-formal .yan-yuan .contact-main{flex:1;min-width:0;}body.tm-phase8-formal .yan-yuan .contact-main b{font-size:14px;color:var(--ink);letter-spacing:0.03em;display:block;line-height:1.32;}body.tm-phase8-formal .yan-yuan .contact-main span{font-size:11.5px;color:var(--ink-faint);display:block;line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.tm-phase8-formal .yan-yuan .contact-main i{font-size:11px;color:var(--route);font-style:normal;}body.tm-phase8-formal .yan-yuan .contact-counts{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:3px;}body.tm-phase8-formal .yan-yuan .cc{min-width:18px;height:16px;padding:0 5px;border-radius:8px;font-size:11px;display:inline-grid;place-items:center;letter-spacing:0;}body.tm-phase8-formal .yan-yuan .cc.unread{background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));color:#fff;box-shadow:0 1px 3px rgba(122,32,24,0.3);}body.tm-phase8-formal .yan-yuan .cc.road{background:rgba(154,117,54,0.18);color:var(--route);border:1px solid rgba(154,117,54,0.3);}body.tm-phase8-formal .yan-yuan .cc.lost{background:rgba(168,50,40,0.14);color:var(--cinnabar-d);border:1px solid rgba(168,50,40,0.32);}body.tm-phase8-formal .yan-yuan .cc.today{background:rgba(168,131,58,0.16);color:var(--gold-d);font-size:11px;}body.tm-phase8-formal .yan-yuan .contact-msel{flex:0 0 auto;width:20px;height:20px;border-radius:50%;border:1px solid rgba(168,131,58,0.5);display:grid;place-items:center;font-size:12px;color:var(--ink-faint);background:rgba(255,255,255,0.5);}body.tm-phase8-formal .yan-yuan .contact.multi-sel .contact-msel{background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));color:#fff;border-color:var(--cinnabar-d);}body.tm-phase8-formal .yan-yuan .roster-empty{padding:30px 10px;text-align:center;color:var(--ink-faint);font-size:12.5px;letter-spacing:0.06em;}body.tm-phase8-formal .yan-yuan .deskmain{flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none;}body.tm-phase8-formal .yan-yuan .deskmain::-webkit-scrollbar{width:0;height:0;display:none;}body.tm-phase8-formal .yan-yuan .compose{flex:0 0 auto;position:relative;display:flex;flex-direction:column;  border:1px solid rgba(220,201,156,0.55);border-radius:12px;overflow:hidden;  background:    radial-gradient(90% 30% at 50% 0%, rgba(255,255,255,0.5), transparent 62%),    linear-gradient(180deg,var(--paper-hi),var(--paper) 50%,var(--paper-lo) 100%);  box-shadow:0 22px 50px -26px rgba(50,32,14,0.5),inset 0 1px 0 rgba(255,255,255,0.6);  animation:zhy-yanIn .5s cubic-bezier(.2,.72,.28,1) both;}body.tm-phase8-formal .yan-yuan .compose::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:0.2;mix-blend-mode:multiply;z-index:0;  background-image:    url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'240\' height=\'240\'%3E%3Cfilter id=\'fb\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.013 0.5\' numOctaves=\'3\' seed=\'7\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type=\'linear\' slope=\'0.45\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23fb)\'/%3E%3C/svg%3E");  background-size:240px 240px;}body.tm-phase8-formal .yan-yuan .compose > *{position:relative;z-index:1;}body.tm-phase8-formal .yan-yuan .cmp-head{flex:0 0 auto;display:flex;align-items:center;gap:15px;padding:18px 26px 15px;border-bottom:1px solid rgba(120,90,40,0.14);}body.tm-phase8-formal .yan-yuan .cmp-face{width:52px;height:62px;flex:0 0 auto;border-radius:8px;display:grid;place-items:center;font-size:23px;font-weight:bold;color:var(--ink);  background:linear-gradient(160deg,#efe3c4,#d9c79d);border:1px solid var(--gold-d);  box-shadow:inset 0 0 0 1px rgba(255,253,243,0.65),inset 0 0 0 2.5px rgba(168,131,58,0.42),0 4px 11px -3px rgba(60,40,20,0.34);}body.tm-phase8-formal .yan-yuan .cmp-who{flex:1;min-width:0;}body.tm-phase8-formal .yan-yuan .cmp-who b{font-size:19px;color:var(--ink);letter-spacing:0.05em;}body.tm-phase8-formal .yan-yuan .cmp-who b small{font-size:12px;color:var(--ink-faint);font-weight:normal;margin-left:8px;letter-spacing:0.02em;}body.tm-phase8-formal .yan-yuan .cmp-who .cmp-loc{font-size:11.5px;color:var(--route);margin-top:3px;letter-spacing:0.02em;display:flex;align-items:center;gap:6px;}body.tm-phase8-formal .yan-yuan .cmp-who .cmp-loc::before{content:"⛰";font-size:12px;opacity:0.7;}body.tm-phase8-formal .yan-yuan .cmp-stat{display:flex;gap:6px;}body.tm-phase8-formal .yan-yuan .route{flex:0 0 auto;margin:15px 26px 0;padding:14px 18px 16px;border-radius:10px;position:relative;  border:1px solid rgba(154,117,54,0.26);background:linear-gradient(180deg,rgba(154,117,54,0.055),rgba(154,117,54,0.015));}body.tm-phase8-formal .yan-yuan .route-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;}body.tm-phase8-formal .yan-yuan .route-top b{font-size:12px;letter-spacing:0.1em;color:var(--ink-soft);display:flex;align-items:center;gap:6px;}body.tm-phase8-formal .yan-yuan .route-top b::before{content:"驿";font-size:10px;color:#fff;background:linear-gradient(150deg,var(--route),var(--gold-d));padding:1px 5px;border-radius:3px;letter-spacing:0;}body.tm-phase8-formal .yan-yuan .route-top em{font-style:normal;font-size:12px;color:var(--route);letter-spacing:0.02em;}body.tm-phase8-formal .yan-yuan .route-line{position:relative;height:30px;margin:0 6px;}body.tm-phase8-formal .yan-yuan .route-line::before{content:"";position:absolute;left:0;right:0;top:14px;height:2px;border-radius:1px;  background:repeating-linear-gradient(90deg,rgba(154,117,54,0.34) 0 6px,transparent 6px 11px);}body.tm-phase8-formal .yan-yuan .route-done{position:absolute;left:0;top:14px;height:2px;border-radius:1px;background:linear-gradient(90deg,var(--gold-d),var(--gold));box-shadow:0 0 5px rgba(168,131,58,0.4);transition:width .5s ease;}body.tm-phase8-formal .yan-yuan .route-node{position:absolute;top:7px;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;font-size:9px;color:#fff;z-index:2;}body.tm-phase8-formal .yan-yuan .route-node.start{left:-2px;background:linear-gradient(150deg,var(--cinnabar-hi),var(--cinnabar-d));box-shadow:0 0 0 3px rgba(168,50,40,0.12),inset 0 1px 0 rgba(255,255,255,0.3);}body.tm-phase8-formal .yan-yuan .route-node.end{right:-2px;background:linear-gradient(150deg,var(--gold-hi),var(--gold-d));box-shadow:0 0 0 3px rgba(168,131,58,0.12),inset 0 1px 0 rgba(255,255,255,0.35);}body.tm-phase8-formal .yan-yuan .route-node.end.lit{background:linear-gradient(150deg,var(--jade-hi),var(--jade));box-shadow:0 0 0 3px rgba(85,127,111,0.2),0 0 10px rgba(111,162,145,0.5);}body.tm-phase8-formal .yan-yuan .route-courier{position:absolute;top:1px;transform:translateX(-50%);font-size:15px;z-index:3;filter:drop-shadow(0 2px 2px rgba(60,40,20,0.4));transition:left .5s ease;}body.tm-phase8-formal .yan-yuan .route-break{position:absolute;top:5px;transform:translateX(-50%);font-size:16px;font-weight:bold;color:var(--cinnabar);z-index:3;text-shadow:0 1px 2px rgba(122,32,24,0.4);}body.tm-phase8-formal .yan-yuan .route-labels{display:flex;justify-content:space-between;margin:5px 6px 0;font-size:11.5px;color:var(--ink-faint);letter-spacing:0.02em;}body.tm-phase8-formal .yan-yuan .route-labels b{color:var(--ink-soft);font-size:12px;}body.tm-phase8-formal .yan-yuan .route.calm{border-style:dashed;opacity:0.92;}body.tm-phase8-formal .yan-yuan .route.danger{border-color:rgba(122,32,24,0.4);background:linear-gradient(180deg,rgba(168,50,40,0.08),rgba(168,50,40,0.02));}body.tm-phase8-formal .yan-yuan .route.danger .route-top b::before{background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));}body.tm-phase8-formal .yan-yuan .route-note{margin-top:7px;font-size:12px;letter-spacing:0.02em;line-height:1.5;color:var(--ink-soft);}body.tm-phase8-formal .yan-yuan .route-note.warn{color:var(--cinnabar-d);}body.tm-phase8-formal .yan-yuan .multi-banner{flex:0 0 auto;margin:11px 22px 0;padding:9px 15px;border-radius:8px;font-size:12px;letter-spacing:0.02em;line-height:1.6;  color:var(--cinnabar-d);background:rgba(168,50,40,0.06);border:1px dashed rgba(122,32,24,0.34);}body.tm-phase8-formal .yan-yuan .multi-banner b{color:var(--cinnabar-d);}body.tm-phase8-formal .yan-yuan .multi-banner small{display:block;margin-top:3px;color:var(--ink-faint);font-size:11.5px;}body.tm-phase8-formal .yan-yuan .cmp-grid{flex:0 0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:13px;padding:16px 26px 0;}body.tm-phase8-formal .yan-yuan .cmp-field{display:flex;flex-direction:column;gap:5px;}body.tm-phase8-formal .yan-yuan .cmp-field>span{font-size:11.5px;letter-spacing:0.1em;color:var(--ink-faint);}body.tm-phase8-formal .yan-yuan .cmp-field select{font-family:var(--font);font-size:12.5px;color:var(--ink);padding:8px 10px;border:1px solid rgba(168,131,58,0.28);border-radius:7px;  background:rgba(255,252,242,0.8);outline:none;cursor:pointer;transition:border-color .15s;}body.tm-phase8-formal .yan-yuan .cmp-field select:focus{border-color:var(--gold);}body.tm-phase8-formal .yan-yuan .cmp-meta{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 26px 0;}body.tm-phase8-formal .yan-yuan .token-badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;letter-spacing:0.03em;padding:4px 11px;border-radius:13px;  border:1px solid var(--gold-d);background:linear-gradient(150deg,rgba(216,185,106,0.22),rgba(168,131,58,0.1));color:var(--gold-d);}body.tm-phase8-formal .yan-yuan .token-badge b{color:var(--ink);}body.tm-phase8-formal .yan-yuan .token-badge .tk-ico{width:17px;height:17px;display:grid;place-items:center;border-radius:50%;font-size:10px;color:#fff;background:linear-gradient(150deg,var(--gold-hi),var(--gold-d));box-shadow:inset 0 1px 0 rgba(255,255,255,0.45),0 1px 3px rgba(125,94,34,0.4);}body.tm-phase8-formal .yan-yuan .token-badge.lack{border-color:rgba(122,32,24,0.45);background:rgba(168,50,40,0.07);color:var(--cinnabar-d);}body.tm-phase8-formal .yan-yuan .token-badge.lack .tk-ico{background:linear-gradient(150deg,var(--cinnabar-hi),var(--cinnabar-d));}body.tm-phase8-formal .yan-yuan .token-badge.none{border-style:dashed;border-color:rgba(120,90,40,0.3);background:rgba(255,252,242,0.5);color:var(--ink-faint);}body.tm-phase8-formal .yan-yuan .token-badge.none .tk-ico{background:rgba(156,139,107,0.6);}body.tm-phase8-formal .yan-yuan .cipher-gauge{flex:1;min-width:180px;display:flex;align-items:center;gap:10px;padding:5px 13px;border-radius:10px;border:1px solid rgba(124,106,144,0.26);background:rgba(124,106,144,0.05);}body.tm-phase8-formal .yan-yuan .cipher-gauge .cg-lbl{font-size:12px;letter-spacing:0.04em;color:var(--violet);white-space:nowrap;}body.tm-phase8-formal .yan-yuan .cipher-gauge .cg-track{flex:1;height:6px;border-radius:3px;background:rgba(142,106,168,0.16);overflow:hidden;}body.tm-phase8-formal .yan-yuan .cipher-gauge .cg-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--jade-hi),var(--cinnabar) 92%);transition:width .4s ease;}body.tm-phase8-formal .yan-yuan .cipher-gauge .cg-val{font-size:12px;color:var(--ink-soft);white-space:nowrap;min-width:78px;text-align:right;}body.tm-phase8-formal .yan-yuan .cmp-paper{flex:0 0 auto;margin:14px 26px 0;}body.tm-phase8-formal .yan-yuan .cmp-textarea{width:100%;min-height:92px;resize:vertical;font-family:var(--font-doc);font-size:15px;line-height:2.05;letter-spacing:0.02em;color:var(--ink);  padding:15px 18px;border:1px solid rgba(120,90,40,0.2);border-radius:8px;outline:none;transition:border-color .15s,box-shadow .15s;  background:    repeating-linear-gradient(0deg, transparent 0 calc(2em - 1px), rgba(80,60,36,0.07) calc(2em - 1px) 2em),    rgba(255,253,247,0.7);}body.tm-phase8-formal .yan-yuan .cmp-textarea::placeholder{color:var(--ink-faint);}body.tm-phase8-formal .yan-yuan .cmp-textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(168,131,58,0.1);}body.tm-phase8-formal .yan-yuan .cmp-acts{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:9px;padding:17px 26px 19px;}body.tm-phase8-formal .yan-yuan .yact{font-family:var(--font);font-size:13px;letter-spacing:0.08em;cursor:pointer;padding:9px 19px;border-radius:8px;  border:1px solid rgba(168,131,58,0.42);background:rgba(255,252,243,0.5);color:var(--ink-soft);transition:all .16s;display:inline-flex;align-items:center;gap:6px;}body.tm-phase8-formal .yan-yuan .yact:hover{background:#fffdf6;border-color:var(--gold);color:var(--ink);transform:translateY(-1px);box-shadow:0 7px 16px -9px rgba(80,56,24,0.45);}body.tm-phase8-formal .yan-yuan .yact.primary{color:#fff;background:linear-gradient(155deg,var(--cinnabar-hi),var(--cinnabar-d));border-color:var(--cinnabar-d);box-shadow:0 5px 15px -3px rgba(122,32,24,0.45),inset 0 1px 0 rgba(255,255,255,0.18);}body.tm-phase8-formal .yan-yuan .yact.primary:hover{background:linear-gradient(155deg,#d2564a,var(--cinnabar));color:#fff;}body.tm-phase8-formal .yan-yuan .yact.primary .seal-ico{font-size:14px;}body.tm-phase8-formal .yan-yuan .cmp-acts .acts-note{margin-left:auto;font-size:11.5px;color:var(--ink-faint);letter-spacing:0.02em;}body.tm-phase8-formal .yan-yuan .thread{flex:0 0 auto;min-height:340px;max-height:56vh;display:flex;flex-direction:column;border:1px solid rgba(168,131,58,0.2);border-radius:12px;overflow:hidden;  background:linear-gradient(180deg,rgba(255,253,243,0.44),rgba(245,236,210,0.22));box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),0 16px 38px -22px rgba(50,32,14,0.4);}body.tm-phase8-formal .yan-yuan .thread-hd{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid rgba(168,131,58,0.16);}body.tm-phase8-formal .yan-yuan .thread-hd b{font-size:14px;letter-spacing:0.1em;color:var(--ink);}body.tm-phase8-formal .yan-yuan .thread-hd em{font-style:normal;font-size:12px;color:var(--ink-faint);}body.tm-phase8-formal .yan-yuan .thread-filter{margin-left:auto;display:flex;gap:5px;}body.tm-phase8-formal .yan-yuan .tf{font-family:var(--font);font-size:12px;letter-spacing:0.03em;cursor:pointer;padding:3px 11px;border-radius:11px;  border:1px solid rgba(168,131,58,0.3);background:rgba(255,252,242,0.5);color:var(--ink-soft);transition:all .14s;}body.tm-phase8-formal .yan-yuan .tf:hover{border-color:var(--gold);}body.tm-phase8-formal .yan-yuan .tf.active{color:#fff;background:linear-gradient(150deg,var(--gold),var(--gold-d));border-color:var(--gold-d);}body.tm-phase8-formal .yan-yuan .thread-scroll{flex:1;min-height:0;overflow-y:auto;padding:16px 18px;scrollbar-width:none;}body.tm-phase8-formal .yan-yuan .thread-scroll::-webkit-scrollbar{width:0;}body.tm-phase8-formal .yan-yuan .lcard{position:relative;margin-bottom:13px;padding:14px 16px 14px 19px;border-radius:10px;border:1px solid rgba(168,131,58,0.16);  background:linear-gradient(180deg,rgba(255,253,243,0.72),rgba(246,239,218,0.5));box-shadow:0 10px 22px -13px rgba(60,40,20,0.36),inset 0 1px 0 rgba(255,255,255,0.5);overflow:hidden;}body.tm-phase8-formal .yan-yuan .lcard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--lc,var(--gold));}body.tm-phase8-formal .yan-yuan .lcard.out::before{background:linear-gradient(180deg,var(--cinnabar),var(--cinnabar-d));}body.tm-phase8-formal .yan-yuan .lcard.in::before{background:linear-gradient(180deg,var(--indigo),#33456a);}body.tm-phase8-formal .yan-yuan .lcard.intercepted{background:linear-gradient(180deg,#fbf1ee,#f6e6e1);}body.tm-phase8-formal .yan-yuan .lcard.blocked{background:linear-gradient(180deg,#faf4e6,#f2e7cc);}body.tm-phase8-formal .yan-yuan .lc-top{display:flex;align-items:center;gap:8px;margin-bottom:6px;}body.tm-phase8-formal .yan-yuan .lc-dir{font-size:12px;font-weight:bold;letter-spacing:0.05em;padding:2px 9px;border-radius:11px;color:#fff;white-space:nowrap;}body.tm-phase8-formal .yan-yuan .lc-dir.out{background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));}body.tm-phase8-formal .yan-yuan .lc-dir.in{background:linear-gradient(150deg,var(--indigo),#33456a);}body.tm-phase8-formal .yan-yuan .lc-route{font-size:12px;color:var(--ink-soft);letter-spacing:0.02em;}body.tm-phase8-formal .yan-yuan .lc-status{margin-left:auto;font-size:11.5px;letter-spacing:0.03em;padding:2px 10px;border-radius:11px;border:1px solid rgba(168,131,58,0.34);background:rgba(255,255,255,0.5);color:var(--ink-soft);white-space:nowrap;}body.tm-phase8-formal .yan-yuan .lc-status.road{color:var(--route);border-color:rgba(154,117,54,0.4);background:rgba(154,117,54,0.08);}body.tm-phase8-formal .yan-yuan .lc-status.done{color:#23463a;border-color:var(--jade);background:rgba(111,162,145,0.16);}body.tm-phase8-formal .yan-yuan .lc-status.bad{color:#fff;border-color:var(--cinnabar-d);background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));}body.tm-phase8-formal .yan-yuan .lc-meta{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px;}body.tm-phase8-formal .yan-yuan .lc-tag{font-size:11px;letter-spacing:0.04em;padding:2px 8px;border-radius:7px;border:1px solid transparent;background:rgba(120,90,40,0.055);color:var(--ink-faint);}body.tm-phase8-formal .yan-yuan .lc-tag.type{color:#fff;border:0;letter-spacing:0.06em;box-shadow:0 1px 4px -1px rgba(60,40,20,0.32);}body.tm-phase8-formal .yan-yuan .lc-tag.cipher{color:var(--violet);border:1px solid rgba(124,106,144,0.42);background:rgba(124,106,144,0.06);}body.tm-phase8-formal .yan-yuan .lc-tag.token{color:var(--gold-d);border-color:var(--gold-d);background:rgba(216,185,106,0.14);}body.tm-phase8-formal .yan-yuan .lc-body{font-family:var(--font-doc);font-size:13px;line-height:1.8;color:var(--ink);letter-spacing:0.01em;text-align:justify;white-space:pre-wrap;}body.tm-phase8-formal .yan-yuan .lc-body.expand{-webkit-line-clamp:unset;}body.tm-phase8-formal .yan-yuan .lc-toggle{display:inline-block;margin-top:4px;font-size:12px;color:var(--cinnabar-d);cursor:pointer;border:none;background:none;font-family:var(--font);}body.tm-phase8-formal .yan-yuan .lc-toggle:hover{text-decoration:underline;}body.tm-phase8-formal .yan-yuan .lc-reply{margin-top:9px;padding:10px 13px;border-radius:8px;border-left:3px solid var(--indigo);background:rgba(74,94,138,0.055);}body.tm-phase8-formal .yan-yuan .lc-reply b{font-size:12px;letter-spacing:0.06em;color:var(--indigo);display:flex;align-items:center;gap:6px;}body.tm-phase8-formal .yan-yuan .lc-reply b::before{content:"复";font-size:10px;color:#fff;background:var(--indigo);padding:1px 5px;border-radius:3px;letter-spacing:0;}body.tm-phase8-formal .yan-yuan .lc-reply.forged b::after{content:"疑伪";font-size:10px;color:#fff;background:var(--cinnabar);padding:1px 5px;border-radius:3px;letter-spacing:0;margin-left:auto;}body.tm-phase8-formal .yan-yuan .lc-reply p{font-family:var(--font-doc);font-size:12.5px;line-height:1.75;color:var(--ink-soft);margin-top:5px;letter-spacing:0.01em;}body.tm-phase8-formal .yan-yuan .lc-mini{margin-top:8px;position:relative;height:16px;}body.tm-phase8-formal .yan-yuan .lc-mini::before{content:"";position:absolute;left:2px;right:2px;top:7px;height:2px;border-radius:1px;background:repeating-linear-gradient(90deg,rgba(154,117,54,0.3) 0 5px,transparent 5px 9px);}body.tm-phase8-formal .yan-yuan .lc-mini .mn-done{position:absolute;left:2px;top:7px;height:2px;border-radius:1px;background:var(--gold);}body.tm-phase8-formal .yan-yuan .lc-mini .mn-dot{position:absolute;top:3px;width:9px;height:9px;border-radius:50%;}body.tm-phase8-formal .yan-yuan .lc-mini .mn-dot.s{left:0;background:var(--cinnabar);}body.tm-phase8-formal .yan-yuan .lc-mini .mn-dot.e{right:0;background:var(--gold-d);}body.tm-phase8-formal .yan-yuan .lc-mini .mn-dot.e.lit{background:var(--jade);}body.tm-phase8-formal .yan-yuan .lc-mini .mn-mk{position:absolute;top:-1px;transform:translateX(-50%);font-size:12px;}body.tm-phase8-formal .yan-yuan .lc-mini .mn-x{position:absolute;top:-1px;transform:translateX(-50%);font-size:12px;color:var(--cinnabar);font-weight:bold;}body.tm-phase8-formal .yan-yuan .lc-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;}body.tm-phase8-formal .yan-yuan .lc-btn{font-family:var(--font);font-size:11.5px;letter-spacing:0.04em;cursor:pointer;padding:5px 12px;border-radius:7px;  border:1px solid rgba(168,131,58,0.32);background:rgba(255,252,243,0.4);color:var(--ink-soft);transition:all .14s;}body.tm-phase8-formal .yan-yuan .lc-btn:hover{background:#fffdf6;border-color:var(--gold);color:var(--ink);}body.tm-phase8-formal .yan-yuan .lc-btn.green{border-color:var(--jade);color:#23463a;background:rgba(111,162,145,0.16);}body.tm-phase8-formal .yan-yuan .lc-btn.green:hover{background:rgba(111,162,145,0.3);}body.tm-phase8-formal .yan-yuan .lc-btn.hot{border-color:var(--cinnabar-d);color:#fff;background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));}body.tm-phase8-formal .yan-yuan .lc-btn.hot:hover{background:linear-gradient(150deg,#d2564a,var(--cinnabar));}body.tm-phase8-formal .yan-yuan .lc-btn.star{margin-left:auto;border-color:var(--gold);color:var(--gold-d);}body.tm-phase8-formal .yan-yuan .lc-btn.star.on{background:var(--gold);color:#fff;}body.tm-phase8-formal .yan-yuan .thread-empty{padding:34px 16px;text-align:center;color:var(--ink-faint);}body.tm-phase8-formal .yan-yuan .thread-empty b{font-size:15px;letter-spacing:0.16em;color:var(--ink-soft);display:block;margin-bottom:7px;}body.tm-phase8-formal .yan-yuan .thread-empty p{font-size:12px;line-height:1.7;letter-spacing:0.02em;}body.tm-phase8-formal .yan-yuan .inbox{flex:0 0 262px;min-height:0;display:flex;flex-direction:column;border:1px solid rgba(168,131,58,0.2);border-radius:12px;overflow:hidden;  background:linear-gradient(180deg,rgba(255,253,243,0.44),rgba(245,236,210,0.24));box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),0 16px 38px -20px rgba(50,32,14,0.44);}body.tm-phase8-formal .yan-yuan .inbox-hd{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:15px 16px 12px;border-bottom:1px solid rgba(168,131,58,0.18);}body.tm-phase8-formal .yan-yuan .inbox-seal{width:32px;height:32px;flex:0 0 auto;display:grid;place-items:center;border-radius:8px;font-size:16px;color:#fff;font-weight:bold;  background:linear-gradient(155deg,var(--indigo-hi),#33456a);border:1px solid rgba(51,69,106,0.6);box-shadow:0 2px 6px rgba(40,52,80,0.4),inset 0 1px 0 rgba(255,255,255,0.25);}body.tm-phase8-formal .yan-yuan .inbox-hd b{font-size:15px;letter-spacing:0.12em;color:var(--ink);display:block;}body.tm-phase8-formal .yan-yuan .inbox-hd span{font-size:12px;color:var(--ink-faint);letter-spacing:0.04em;}body.tm-phase8-formal .yan-yuan .inbox-sum{flex:0 0 auto;display:flex;gap:8px;padding:9px 13px;border-bottom:1px solid rgba(168,131,58,0.22);}body.tm-phase8-formal .yan-yuan .inbox-sum span{flex:1;font-size:12px;color:var(--ink-faint);letter-spacing:0.04em;text-align:center;padding:6px 0;border-radius:7px;background:rgba(255,250,235,0.45);border:1px solid rgba(168,131,58,0.16);}body.tm-phase8-formal .yan-yuan .inbox-sum b{color:var(--ink);font-size:14px;display:block;}body.tm-phase8-formal .yan-yuan .inbox-sum span.hot b{color:var(--cinnabar);}body.tm-phase8-formal .yan-yuan .inbox-scroll{flex:1;min-height:0;overflow-y:auto;padding:10px 11px;scrollbar-width:none;}body.tm-phase8-formal .yan-yuan .inbox-scroll::-webkit-scrollbar{width:0;}body.tm-phase8-formal .yan-yuan .incard{position:relative;margin-bottom:11px;padding:12px 13px;border-radius:10px;border:1px solid rgba(168,131,58,0.16);  background:linear-gradient(180deg,rgba(255,253,243,0.72),rgba(246,239,218,0.5));box-shadow:0 8px 18px -12px rgba(60,40,20,0.3);transition:transform .15s,box-shadow .15s;}body.tm-phase8-formal .yan-yuan .incard.unread{border-color:rgba(122,32,24,0.4);}body.tm-phase8-formal .yan-yuan .incard.unread::after{content:"";position:absolute;right:9px;top:11px;width:7px;height:7px;border-radius:50%;background:var(--cinnabar);box-shadow:0 0 0 3px rgba(168,50,40,0.16);}body.tm-phase8-formal .yan-yuan .incard:hover{transform:translateY(-1px);box-shadow:0 4px 11px rgba(60,40,20,0.16);}body.tm-phase8-formal .yan-yuan .inc-top{display:flex;align-items:center;gap:8px;margin-bottom:5px;}body.tm-phase8-formal .yan-yuan .inc-seal{width:30px;height:30px;flex:0 0 auto;display:grid;place-items:center;border-radius:50%;font-size:12px;font-weight:bold;color:#fff;  background:linear-gradient(150deg,var(--indigo),#33456a);box-shadow:0 0 0 1.5px rgba(74,94,138,0.5),0 2px 7px -2px rgba(40,52,80,0.4);}body.tm-phase8-formal .yan-yuan .incard.reply .inc-seal{background:linear-gradient(150deg,var(--jade-hi),var(--jade));box-shadow:0 0 0 1.5px rgba(85,127,111,0.55),0 2px 7px -2px rgba(40,60,50,0.38);}body.tm-phase8-formal .yan-yuan .inc-who b{font-size:13px;color:var(--ink);letter-spacing:0.03em;display:block;line-height:1.3;}body.tm-phase8-formal .yan-yuan .inc-who span{font-size:11px;color:var(--ink-faint);}body.tm-phase8-formal .yan-yuan .inc-title{font-size:12px;color:var(--ink-soft);line-height:1.5;margin-bottom:4px;font-family:var(--font-doc);  display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}body.tm-phase8-formal .yan-yuan .inc-body{font-family:var(--font-doc);font-size:11.5px;line-height:1.7;color:var(--ink-faint);letter-spacing:0.01em;  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px;}body.tm-phase8-formal .yan-yuan .inc-body.expanded{display:block;-webkit-line-clamp:unset;overflow:visible;white-space:pre-wrap;color:var(--ink);font-size:12.5px;}body.tm-phase8-formal .yan-yuan .inc-title.expanded{display:block;-webkit-line-clamp:unset;overflow:visible;}body.tm-phase8-formal .yan-yuan .incard.expanded{border-color:rgba(168,131,58,0.5);box-shadow:0 6px 16px -8px rgba(60,40,20,0.4),inset 0 0 0 1px rgba(168,131,58,0.12);}body.tm-phase8-formal .yan-yuan .inc-meta{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--ink-faint);margin-bottom:6px;}body.tm-phase8-formal .yan-yuan .inc-acts{display:flex;gap:5px;}body.tm-phase8-formal .yan-yuan .inc-btn{flex:1;font-family:var(--font);font-size:12px;letter-spacing:0.03em;cursor:pointer;padding:5px 0;border-radius:7px;  border:1px solid rgba(168,131,58,0.3);background:rgba(255,252,243,0.45);color:var(--ink-soft);transition:all .14s;}body.tm-phase8-formal .yan-yuan .inc-btn:hover{background:#fff;border-color:var(--gold);color:var(--ink);}body.tm-phase8-formal .yan-yuan .inc-btn.green{border-color:var(--jade);color:#23463a;background:rgba(111,162,145,0.14);}body.tm-phase8-formal .yan-yuan .inbox-empty{padding:30px 12px;text-align:center;color:var(--ink-faint);font-size:12px;line-height:1.7;}body.tm-phase8-formal .yan-yuan .inbox-empty b{font-size:14px;letter-spacing:0.14em;color:var(--ink-soft);display:block;margin-bottom:6px;}@keyframes zhy-yanIn{from{opacity:0;transform:translateY(10px) scale(0.99);}to{opacity:1;transform:translateY(0) scale(1);}}'; if (st.__tmCss !== __css) { st.__tmCss = __css; st.textContent = __css; }
  }

  // ═══ 御案批红 · 百官奏疏 (zou-yuan) · 落地 2026-06-02 ═══
  var MEM_TYPE_YUAN = {
    '弹章':{c:'#a83228',label:'弹章',glyph:'劾'},'弹劾':{c:'#a83228',label:'弹章',glyph:'劾'},
    '警报':{c:'#7a2018',label:'警报',glyph:'警'},'军务':{c:'#4a5e8a',label:'军务',glyph:'兵'},
    '边报':{c:'#4a5e8a',label:'边报',glyph:'边'},'荐表':{c:'#557f6f',label:'荐表',glyph:'荐'},
    '政务':{c:'#a8833a',label:'政务',glyph:'政'},'人事':{c:'#8e6aa8',label:'人事',glyph:'铨'},
    '民生':{c:'#b98b2f',label:'民生',glyph:'民'},'经济':{c:'#b98b2f',label:'民生',glyph:'民'},
    'territory':{c:'#a83228',label:'侨置',glyph:'疆'},'谏疏':{c:'#a8833a',label:'谏疏',glyph:'谏'}
  };
  function memTypeYuan(t){ return MEM_TYPE_YUAN[t] || {c:'#a8833a',label:(t||'奏疏'),glyph:'奏'}; }
  var MEM_REL_LABEL = { high:'信据确凿', medium:'尚需查核', low:'风闻待核' };
  var MEM_REL_LEVEL = { high:3, medium:2, low:1 };
  function memRel(m){ return (m && m.reliability) || 'medium'; }
  var MEM_STATUS_TEXT = { pending:'待批', pending_review:'待核', hold:'留中', held:'留中', approved:'已准', rejected:'已驳', annotated:'已批示', referred:'已转', court_debate:'付廷议', done:'已批' };
  function memIsSecret(m){ return m && (m.subtype === '密折' || m.subtype === '密揭'); }
  function memHeldTurns(m){
    var gm = window.GM || {}; var now = Number(gm.turn || 1);
    var arr = (m.raw && Number(m.raw._arrivedTurn)) || Number(m.turn) || now;
    return Math.max(0, now - arr);
  }
  function memCharOf(m){
    try { if (typeof window.findCharByName === 'function') return window.findCharByName(m.from); } catch(_) {}
    return null;
  }
  function memOpener(m){
    var f = String(m.from || '');
    if (/^[一-龥]{2,4}$/.test(f) && !/(司|厂|监|部|院|寺|军|民|塘报|有司|衙|生员|士民|联名)/.test(f)) return '臣' + f + '谨奏：';
    return '';
  }

  // 折子 (左·奏牍架)
  function renderMemFolderYuan(m, activeId){
    var tm = memTypeYuan(m.type), g = memorialGroupKey(m), secret = memIsSecret(m);
    var opened = state.memorialOpened && state.memorialOpened[m.id];
    var held = memHeldTurns(m);
    var sealedTag = secret ? (opened ? '密折' : '密 · 封缄') : (m.subtype && m.subtype !== '公疏' ? m.subtype : '');
    var tail = g === 'done'
      ? '<span class="zf-stamp">' + esc(MEM_STATUS_TEXT[m.status] || '已批') + '</span>'
      : (g === 'held' && held > 0 ? '<div class="zf-held' + (held >= 2 ? ' warn' : '') + '">已留中 ' + held + ' 回' + (held >= 2 ? ' · 恐续奏' : '') + '</div>' : '<div style="margin-top:5px">' + memRelDots(memRel(m)) + '</div>');
    return '<button type="button" class="zou-folder ' + (String(activeId) === String(m.id) ? 'active' : '') + (g === 'done' ? ' done' : '') + '" data-desk-action="select-memorial-desk" data-id="' + attr(m.id || '') + '" style="--tc:' + tm.c + '">' +
      '<div class="zf-top"><span class="zf-type" style="background:' + tm.c + '">' + esc(tm.label) + '</span>' +
        (sealedTag ? '<span class="zf-sub' + (secret && !opened ? ' mi' : '') + '">' + esc(sealedTag) + '</span>' : '') +
        ((m.raw && m.raw._remoteFrom) ? '<span class="zf-remote" title="远方奏疏">远</span>' : '') +
        (g === 'urgent' ? '<span class="zf-urgent"></span>' : '') + '</div>' +
      '<div class="zf-title">' + esc(m.title || '奏疏') + '</div>' +
      '<div class="zf-meta"><b style="color:var(--ink)">' + esc(m.from || '臣工') + '</b><span class="dot">·</span><span>' + esc(m.dept || m.office || '通政司') + '</span></div>' +
      tail + '</button>';
  }
  function memRelDots(rel){
    var lv = MEM_REL_LEVEL[rel] || 0, h = '';
    for (var i = 0; i < 3; i++) h += '<i class="' + (i < lv ? '' : 'off') + '">●</i>';
    return '<span class="zf-rel" title="' + attr(MEM_REL_LABEL[rel] || '') + '">' + h + '</span>';
  }

  // 奏本抬头
  function memBenHead(m, tm, g){
    var statusChip = g === 'urgent' ? '<span class="chip hot">急奏</span>' : g === 'done' ? '<span class="chip green">' + esc(MEM_STATUS_TEXT[m.status] || '已批') + '</span>' : g === 'held' ? '<span class="chip">留中</span>' : '<span class="chip">待批</span>';
    var rel = memRel(m), relCls = rel === 'low' ? 'lo' : '';
    var ch = memCharOf(m), faction = (ch && (ch.faction || ch.group)) || '';
    var impeachT = '';
    if (tm.label === '弹章' && /弹劾/.test(String(m.title || ''))) {
      var _it = (String(m.title).split('弹劾')[1] || '').replace(/(冒功|欺君|不法|贪墨|贪|失职|渎职|结党|专擅|跋扈).*$/, '').replace(/[，。、；：·等\s].*$/, '').slice(0, 12);
      if (_it.length >= 2) impeachT = _it;
    }
    return '<div class="ben-head"><div class="bh-status">' + statusChip + '</div><div class="bh-row">' +
      '<div class="bh-seal" style="--tc:' + tm.c + '"><b>' + esc(tm.glyph) + '</b><span>' + esc(tm.label) + '</span></div>' +
      '<div class="bh-main"><div class="bh-title">' + esc(m.title || '奏疏') + '</div>' +
        '<div class="bh-author">具题　<b>' + esc(m.from || '臣工') + '</b>　' + esc(m.office || (ch && (ch.officialTitle || ch.title)) || '') + '　〔' + esc(m.dept || '通政司') + '〕</div>' +
        '<div class="bh-tags">' +
          '<span class="bh-tag">' + esc(tm.label) + '</span>' +
          (m.subtype ? '<span class="bh-tag' + (memIsSecret(m) ? ' mi' : '') + '">' + esc(m.subtype) + '</span>' : '') +
          (impeachT ? '<span class="bh-tag impeach">被劾 · ' + esc(impeachT) + '</span>' : '') +
          ((m.raw && m.raw._remoteFrom) ? '<span class="bh-tag remote">远方 · ' + esc(m.raw._remoteFrom) + '</span>' : '') +
          '<span class="bh-tag">可靠 <span class="rel-d ' + relCls + '">' + esc(MEM_REL_LABEL[rel] || '未明') + '</span></span>' +
          (faction ? '<span class="bh-tag">' + esc(faction) + '</span>' : '') +
        '</div></div></div></div>';
  }

  // 御览批红 (中)
  function renderMemReaderYuan(m){
    if (!m) return '<div class="ben-empty"><div class="ben-empty-seal">奏</div><h3>案 牍 清 净</h3><p>百官无事启奏　·　通政司暂无折件转入</p><small>新奏疏会于每回合由百官、有司、边镇陆续呈入</small></div>';
    var tm = memTypeYuan(m.type), g = memorialGroupKey(m);
    // 密折封缄态
    if (memIsSecret(m) && !(state.memorialOpened && state.memorialOpened[m.id])) {
      return memBenHead(m, tm, g) +
        '<div class="ben-sealed"><button type="button" class="wax" data-desk-action="memorial-unseal-desk" data-id="' + attr(m.id || '') + '"><b>缄</b></button>' +
        '<div class="sealed-hint"><h4>密 折 · 火 漆 封 缄</h4><p>' + esc(m.from || '') + ' 直达御前 · 不付外廷拟议<br>点火漆启封，方可御览</p></div></div>';
    }
    var done = g === 'done';
    var mid = 'mem-formal-' + (m.rawIndex != null ? m.rawIndex : String(m.id || '').replace(/[^a-zA-Z0-9_-]/g, ''));
    var replyId = mid + '-reply';
    var reply = m.reply || '';
    state.memorialReplies = state.memorialReplies || {};
    if (Object.prototype.hasOwnProperty.call(state.memorialReplies, replyId)) reply = state.memorialReplies[replyId];
    var body = m.text || m.content || '暂无正文。';
    var opener = memOpener(m);
    var held = memHeldTurns(m);
    var longBody = body.length > 180;
    var bodyHtml = longBody
      ? '<div class="ben-text collapsed" id="' + attr(mid) + '-bt">' + esc(body) + '</div><button type="button" class="ben-toggle" onclick="var b=document.getElementById(&quot;' + attr(mid) + '-bt&quot;);if(b){var c=b.classList.toggle(&quot;collapsed&quot;);this.textContent=c?&quot;▼ 展开全文&quot;:&quot;▲ 收起&quot;;}">▼ 展开全文</button>'
      : '<div class="ben-text" id="' + attr(mid) + '-bt">' + esc(body) + '</div>';
    var quick = done ? '' : '<div class="pizhu-quick">' + ['知道了', '依议', '该部知道', '着实奏来', '览', '准奏，钦此', '着会官详议'].map(function(p){
      return '<span class="qphrase" onclick="var t=document.getElementById(&quot;' + replyId + '&quot;);if(t){t.value=t.value?t.value+&quot;，&quot;+this.textContent:this.textContent;t.focus();}">' + esc(p) + '</span>';
    }).join('') + '</div>';
    return memBenHead(m, tm, g) +
      (g === 'held' && held > 0 ? '<div class="held-banner' + (held >= 2 ? ' warn' : '') + '"><b>已留中 ' + held + ' 回合</b>' + (held >= 2 ? '　·　' + esc(m.from || '具题人') + '恐焦虑续奏，或求见当面追问' : '　·　御前暂存，可继续保留或下发') + '</div>' : '') +
      '<div class="ben-body"><div class="ben-paper">' +
        (opener ? '<div class="bp-open">' + esc(opener) + '</div>' : '') +
        bodyHtml +
        '<div class="bp-close">臣不胜屏营待命之至，谨奏。</div>' +
      '</div></div>' +
      '<div class="ben-foot">' +
        '<div class="pizhu-lbl"><b>朱 批</b>' + (done ? '<small>已批 · 朱批归档</small>' : '<small>御笔朱批，下发有司</small>') + '</div>' +
        quick +
        '<textarea class="pizhu-ta" id="' + attr(replyId) + '" data-desk-memorial-reply ' + (done ? 'readonly' : '') + ' placeholder="御笔亲批……">' + esc(reply) + '</textarea>' +
        memReaderActs(m, g, done, replyId) +
      '</div>';
  }
  function memReaderActs(m, g, done, replyId){
    if (done) return '<div class="pizhu-acts"><span style="font-size:12px;color:var(--ink-faint);letter-spacing:0.06em">此折已批 · ' + esc(MEM_STATUS_TEXT[m.status] || '已决') + ' · 可追踪回函与承办</span></div>';
    var bd = function(dec){ return { id: m.id || '', decision: dec, replyid: replyId }; };
    var a = '<div class="pizhu-acts">';
    a += actionBtn('准奏', 'memorial-decision-desk', bd('approved'), 'pact primary');
    a += actionBtn('驳回', 'memorial-decision-desk', bd('rejected'), 'pact danger');
    a += actionBtn('批示', 'memorial-decision-desk', bd('annotated'), 'pact');
    a += actionBtn('转有司', 'memorial-decision-desk', bd('referred'), 'pact');
    a += actionBtn('发廷议', 'memorial-decision-desk', bd('court_debate'), 'pact');
    if (g !== 'held') a += actionBtn('留中', 'memorial-decision-desk', bd('hold'), 'pact');
    a += '<span class="pact-sep"></span>';
    a += actionBtn('摘入拟诏', 'memorial-edict-desk', { id: m.id || '' }, 'pact jade');
    a += actionBtn('传召问询', 'memorial-summon-desk', { id: m.id || '' }, 'pact');
    if (m.raw && m.raw._qiaozhiTarget) a += actionBtn('侨置决策', 'memorial-qiaozhi-desk', { id: m.id || '' }, 'pact primary');
    a += '</div>';
    return a;
  }

  // 票拟与影响 (右)
  function renderMemAsideYuan(m){
    if (!m) return '';
    var g = memorialGroupKey(m), rel = memRel(m), relLv = MEM_REL_LEVEL[rel] || 0;
    var ch = memCharOf(m);
    var loyalty = ch && (typeof ch.loyalty === 'number' ? ch.loyalty : null);
    var faction = (ch && (ch.faction || ch.group)) || m.dept || '';
    var relation = ch && (ch.persona || ch.personality || ch.bio || ch.note || ch.desc) || '';
    var niyi = m.raw && (m.raw._fuchenNiyi || m.raw.piaoni);
    var _replyId = 'mem-formal-' + (m.rawIndex != null ? m.rawIndex : String(m.id || '').replace(/[^a-zA-Z0-9_-]/g, '')) + '-reply';
    var aside = '';
    // 辅臣拟议 (AI 生成于 endturn·写 raw._fuchenNiyi·未生成则占位)·niyi 在时可一键采入朱批
    aside += '<div class="card"><div class="card-hd"><span class="ci">拟</span>辅臣拟议<span class="hd-note">辅臣之见 · 可采可驳</span></div><div class="card-bd">' +
      (niyi ? '<div class="piaoni">' + esc(niyi) + '<span class="pn-from">—— 辅臣 拟议</span></div>'
            + (g !== 'done' ? '<button type="button" class="piaoni-take" data-niyi="' + attr(niyi) + '" onclick="var t=document.getElementById(&quot;' + _replyId + '&quot;);if(t){if(!t.readOnly){var n=this.getAttribute(&quot;data-niyi&quot;);t.value=t.value?t.value+&quot;　&quot;+n:n;t.focus();}}">采拟议入朱批</button>' : '')
            : '<div class="piaoni" style="color:var(--ink-faint)">辅臣拟议将于推演时由辅臣拟具（带其立场私心，可采可驳）。<span class="pn-from">—— 待本回辅臣拟议</span></div>') +
    '</div></div>';
    // 具题之臣
    aside += '<div class="card"><div class="card-hd"><span class="ci">臣</span>具题之臣</div><div class="card-bd">' +
      '<div class="who"><div class="who-face">' + esc((m.from || '臣').slice(0, 1)) + '</div>' +
        '<div class="who-info"><b>' + esc(m.from || '臣工') + '</b><span>' + esc(m.office || (ch && (ch.officialTitle || ch.title)) || '') + '</span><span>' + esc(m.dept || '') + (faction ? ' · ' + esc(faction) : '') + '</span></div></div>' +
      '<dl class="who-meta">' +
        (loyalty != null ? '<dt>忠悃</dt><dd>' + loyalty + ' / 100</dd>' : '') +
        '<dt>可靠</dt><dd><span class="relbar">' + [0, 1, 2].map(function(i){ return '<i class="' + (i < relLv ? 'on' : '') + (rel === 'low' && i < relLv ? ' bad' : '') + '"></i>'; }).join('') + '</span></dd>' +
      '</dl>' +
      (relation ? '<div style="margin-top:9px;font-size:11.5px;color:var(--ink-soft);line-height:1.6;font-family:var(--font-doc)">「' + esc(compactText(String(relation), 60)) + '」</div>' : '') +
    '</div></div>';
    // 批阅链路
    aside += '<div class="card"><div class="card-hd"><span class="ci">链</span>批阅链路</div><div class="card-bd"><div class="chain">' +
      memChainRow('源', '来源', '奏疏 · ' + esc(memTypeYuan(m.type).label) + (m.subtype ? ' · ' + esc(m.subtype) : '')) +
      memChainRow('批', '批复', '准奏 / 驳回 / 留中 / 转有司 / 发廷议') +
      memChainRow('行', '执行', '君主 → 中枢辅臣 → 有司 → 州县地方') +
      memChainRow('档', '归档', '写入近事 · 人物记忆 · 史官实录') +
    '</div></div></div>';
    // 批后结果 (仅已批回显·不事前预估)
    if (g === 'done') {
      aside += '<div class="card"><div class="card-hd"><span class="ci">果</span>批后结果 · 本折后续</div><div class="card-bd"><div class="chain">' +
        memFollowups(m).map(function(r){ return memChainRow(r[0].slice(0, 1), r[0], esc(r[1])); }).join('') +
      '</div></div></div>';
    } else {
      aside += '<div class="card"><div class="card-hd"><span class="ci">果</span>批后结果</div><div class="card-bd"><div class="imp-pending">尚未批复。<br>朱批下发后，此处回显该折引发的<b>实际</b>影响（民心 / 财政 / 人物 / 边事…）。<br><span class="imp-note">后果应自然发生 · 不事前预告</span></div></div></div>';
    }
    return aside;
  }
  function memChainRow(d, b, p){ return '<div class="chain-row"><span class="chain-dot">' + esc(d) + '</span><div><b>' + esc(b) + '</b><p>' + p + '</p></div></div>'; }
  // 本折后续·已批折回显真实已发生的后续(纯文字·无数字·读现有数据·不另调 AI)·承接"后果应自然不预告"
  function memFollowups(m){
    var rows = [], st = String(m.status || '');
    var DEC = { approved:'已准奏 · 交有司施行', rejected:'已驳回 · 所请不行', annotated:'已批示 · 候有司遵行', referred:'已交有司核议', court_debate:'已付廷议 · 候朝议' };
    rows.push(['朱批', DEC[st] || '已得朱批']);
    if (st === 'referred') rows.push(['承办', ((m.raw && m.raw._referredTo) ? m.raw._referredTo + ' ' : '所交有司') + '应于后续上折复议']);
    if (m.raw && m.raw._remoteFrom) {
      var _now = Number((window.GM || {}).turn || 1), _dt = Number(m.raw._replyDeliveryTurn || 0);
      rows.push(['回传', (_dt && _now >= _dt) ? '朱批已送达 · ' + (m.from || '具题人') + '已知结果' : '朱批回传中 · 信使在途 · ' + (m.from || '具题人') + '尚不知结果']);
    }
    if (m.from) rows.push(['具题人', m.from + '：' + (st === 'rejected' ? '闻驳 · 或忧惧或离心' : '闻准 · 感念在心')]);
    rows.push(['归档', '已入近事 · 人物记忆 · 史官实录（后续于近事、实录追踪）']);
    return rows;
  }

  // 在途奏疏
  function renderMemTransitYuan(){
    var gm = window.GM || {};
    var pending = Array.isArray(gm._pendingMemorialDeliveries) ? gm._pendingMemorialDeliveries.filter(function(m){ return !m || m.status === 'in_transit' || m.status === 'intercepted'; }) : [];
    var rows = firstArray(pending, gm.memorialTransit, gm._memorialTransit, gm.zoushuTransit).slice(0, 4);
    if (!rows.length) return '';
    return '<div class="transit"><div class="transit-t">在途奏疏 · ' + rows.length + ' 件</div>' +
      rows.map(function(t){
        var from = t.from || t.sender || '地方', eta = t.eta || t.due || '在途';
        return '<div class="transit-row"><b>' + esc(from) + '</b><em>' + esc(eta) + '</em><div style="color:var(--ink-faint);font-size:11.5px;margin-top:2px">' + esc([t.office || t.dept || '衙门', t.type || '奏疏'].filter(Boolean).join(' · ')) + '</div><div style="margin-top:1px">' + esc(compactText(t.body || t.text || t.content || '', 60)) + '</div></div>';
      }).join('') + '</div>';
  }

  // 主面板
  function renderFormalMemorialPanel(){
    installMemorialYuanStyles();
    restoreFormalDraftsFromGM(false);
    var mems = getMemorials();
    var filter = state.memorialFilter || 'all';
    if (filter === 'review') filter = 'all';
    var visible = mems.filter(function(m){ return memorialMatchesFormal(filter, m); });
    // active
    var active = mems.find(function(m){ return String(m.id) === String(state.memorialId || ''); });
    if (!active || !memorialMatchesFormal(filter, active)) active = visible[0] || mems[0] || null;
    if (active) state.memorialId = active.id;
    // 筛选签条
    var filters = [['all', '全部'], ['urgent', '急奏'], ['pending', '百官启奏'], ['held', '留中'], ['done', '已批']];
    var filterHtml = filters.map(function(f){
      var n = mems.filter(function(m){ return memorialMatchesFormal(f[0], m); }).length;
      return '<button type="button" class="filter ' + (filter === f[0] ? 'active' : '') + '" data-desk-action="memorial-filter-desk" data-filter="' + attr(f[0]) + '"><span>' + esc(f[1]) + '</span><span class="fc">' + n + '</span></button>';
    }).join('');
    // 折子列表 (分组)
    var order = ['urgent', 'pending', 'held', 'done'];
    var GLBL = { urgent: '急奏待批', pending: '百官启奏', held: '留中之折', done: '已批档案' };
    var listHtml = order.map(function(gk){
      var rows = visible.filter(function(m){ return memorialGroupKey(m) === gk; });
      if (!rows.length) return '';
      return '<div class="shelf-group"><div class="shelf-group-t">' + esc(GLBL[gk]) + ' <small>' + rows.length + ' 件</small></div>' +
        rows.map(function(m){ return renderMemFolderYuan(m, state.memorialId); }).join('') + '</div>';
    }).join('') || '<div style="padding:30px 10px;text-align:center;color:var(--ink-faint);font-size:12.5px;">案牍清净　无此类奏疏</div>';
    var pend = mems.filter(function(m){ return memorialGroupKey(m) !== 'done'; }).length;
    var urg = mems.filter(function(m){ return memorialGroupKey(m) === 'urgent'; }).length;
    return '<section class="zou-yuan">' +
      '<div class="zou-titlebar"><div class="zt-center"><div class="zt-main">百 官 奏 疏</div><div class="zt-sub">通政司　百官启奏　御前批红</div></div>' +
        '<div class="zou-chips"><span class="chip green">本回 ' + pend + ' 件</span><span class="chip hot">急 ' + urg + '</span></div></div>' +
      '<div class="zou-body">' +
        '<aside class="shelf"><div class="shelf-hd"><span class="shelf-seal">奏</span><div><b>朱批案牍</b><span>急奏 · 留中 · 已批</span></div></div>' +
          '<div class="filters">' + filterHtml + '</div>' +
          '<div class="shelf-scroll">' + listHtml + '</div>' +
          renderMemTransitYuan() +
        '</aside>' +
        '<main class="read"><article class="zouben" data-memorial-id="' + attr(active ? active.id : '') + '">' + renderMemReaderYuan(active) + '</article></main>' +
        '<aside class="aside">' + renderMemAsideYuan(active) + '</aside>' +
      '</div></section>';
  }

  // Selection does not change membership/order: keep the actual shelf and its scroll.
  // Drafts are captured by the caller before replacing the reader. Filter/decision
  // actions still use the complete render so counts and grouping remain truthful.
  function refreshFormalMemorialSelection(root, force){
    if (!root || !root.isConnected || !root.__tmMemorialCurrent || !root.__tmMemorialCurrent()) return false;
    var panel = root.querySelector('.zou-yuan');
    if (!panel) return false;
    var reader = panel.querySelector('.zouben'), aside = panel.querySelector('.aside'), shelf = panel.querySelector('.shelf-scroll');
    var active = getMemorials().find(function(m){ return String(m.id) === String(state.memorialId || ''); });
    if (!reader || !aside || !shelf || !active || !memorialMatchesFormal(state.memorialFilter, active)) return false;
    if (!force && reader.getAttribute('data-memorial-id') === String(active.id)) return true;
    var readerHtml = renderMemReaderYuan(active), asideHtml = renderMemAsideYuan(active);
    reader.innerHTML = readerHtml;
    reader.setAttribute('data-memorial-id', String(active.id));
    aside.innerHTML = asideHtml;
    aside.scrollTop = 0;
    Array.prototype.forEach.call(shelf.querySelectorAll('.zou-folder'), function(row){
      row.classList.toggle('active', row.getAttribute('data-id') === String(active.id));
    });
    return true;
  }

  function normalizeLetterPeople(){
    var selfName = (window.P && P.playerInfo && P.playerInfo.characterName) || '';
    var people = getPeople().filter(function(p){
      if (!p) return false;
      if (p.alive === false) return false;
      if (p.isPlayer) return false;
      if (selfName && p.name === selfName) return false;
      return true;
    }).slice(0, 96);
    if (!people.length) people = [{ name:'臣工', office:'御前候命', faction:'京师' }];
    return people.map(function(p, i){
      var name = p.name || personKey(p) || ('人物' + (i + 1));
      return {
        id: name,
        name: name,
        role: p.officialTitle || p.office || p.title || p.role || p.faction || '臣工',
        region: letterRegionOf(p),
        location: p.location || p.region || p.faction || '京师',
        face: name.slice(0, 1),
        portrait: (typeof tmfRenwuPortrait === 'function') ? tmfRenwuPortrait(p) : '',
        faction: p.faction || p.group || '',
        raw: p
      };
    });
  }

  function letterRegionOf(p){
    var loc = String((p && (p.location || p.region)) || '');
    var title = String((p && (p.officialTitle || p.title || p.role || p.office)) || '');
    var capital = (window.GM && GM._capital) || '京城';
    if (/皇后|皇贵妃|贵妃|妃|嫔|夫人|公主|太后|太妃|内廷|司礼|东厂/.test(title + loc)) return '内廷';
    try { if (typeof window._isSameLocation === 'function' && window._isSameLocation(loc, capital)) return '在京'; } catch(_) {}
    if (/京城|京师|顺天|紫禁城|北京/.test(loc)) return '在京';
    if (/辽|宁远|锦|蓟|山海关|皮岛|沈阳|盛京/.test(loc)) return '辽东·北境';
    if (/大同|宣府|太原|山西|归化/.test(loc)) return '宣大·山西';
    if (/陕|西安|延|甘|宁夏|兰州|榆林|固原|米脂|安塞|府谷/.test(loc)) return '西陲·边镇';
    if (/四川|重庆|云|贵|蜀|巴|石柱|成都/.test(loc)) return '西南·巴蜀';
    if (/福建|广东|广西|厦门|台湾|琼|朝鲜|日本|海/.test(loc)) return '南方·海疆';
    if (/江|杭|南京|苏|湖广|浙|南直|安庆/.test(loc)) return '江南·江浙';
    if (/河南|山东|河北|北直|鲁|豫|保定|大名|商丘/.test(loc)) return '中原·鲁豫';
    return loc || '其他';
  }

  function letterTypeLabelFormal(type){
    var map = {
      personal: '私函',
      greeting: '问安函',
      report: '来报',
      secret_decree: '密旨',
      military_order: '征调令',
      formal_edict: '正式诏令',
      proclamation: '檄文',
      diplomatic: '外交书',
      diplomatic_dispatch: '外交书'
    };
    return map[type] || (type || '书信');
  }

  function letterUrgencyLabelFormal(v){
    return ({ normal:'普通驿递', urgent:'加急驿递', extreme:'八百里加急' })[v] || (v || '驿递');
  }

  function letterCipherLabelFormal(v){
    return ({ none:'不加密', yinfu:'阴符', yinshu:'阴书', wax_ball:'蜡丸密函', silk_sewn:'帛书缝衣' })[v] || (v || '不加密');
  }

  function letterSendModeLabelFormal(v){
    return ({ normal:'普通信使', multi_courier:'多路信使', secret_agent:'密使' })[v] || (v || '普通信使');
  }

  function letterStatusTextFormal(l){
    var s = String((l && l.status) || '');
    if (s === 'draft') return '草稿';
    if (s === 'traveling') return '信使在途';
    if (s === 'delivered') return '已送达';
    if (s === 'replying') return '回函在途';
    if (s === 'returned') return '已有回函';
    if (s === 'blocked') return '中书阻滞';
    if (s === 'intercepted') return '信使失踪';
    if (s === 'intercepted_forging') return '回函在途';
    if (s === 'blocked') return '流转受阻';
    if (s === 'recalled') return '已追回';
    return s || '未阅';
  }

  function letterFilterMatchFormal(filter, l){
    var s = String((l && l.status) || '').toLowerCase();
    if (filter === 'unread') return !l.playerRead && !l.toPlayer && l.from !== '玩家';
    if (filter === 'road') return /traveling|replying|sent|delivered|intercepted_forging/.test(s);
    if (filter === 'lost') return /intercepted|blocked|lost/.test(s);
    if (filter === 'star') return !!l.starred;
    return true;
  }

  function letterTimeFormal(l){
    try { if (typeof window.getTSText === 'function') return window.getTSText(l.sentTurn || 1); } catch(_) {}
    return '第' + (l.sentTurn || 1) + '回合';
  }

  function letterPersonCounts(name, letters){
    var rows = letters.filter(function(l){ return String(l.from) === String(name) || String(l.to) === String(name); });
    var unread = rows.filter(function(l){ return l.from !== '玩家' && !l.playerRead; }).length;
    var road = rows.filter(function(l){ return /traveling|replying|delivered|intercepted_forging/.test(String(l.status || '')); }).length;
    var lost = rows.filter(function(l){ return /intercepted|blocked|lost/.test(String(l.status || '')); }).length;
    return { total: rows.length, unread: unread, road: road, lost: lost };
  }

  function formalIncomingLetters(letters){
    var rows = [];
    // ★2026-07-01·收件箱只收「给玩家」的来函。原判据仅 from!=='玩家'·漏查收件人→NPC↔NPC 的信被误塞进玩家收件箱。
    //   源头:agent 模式 deepen_letters(tm-endturn-agent-depth-tools:306 `to:L.to||'玩家'`)·AI 若把 L.to 设成另一 NPC
    //   (如密谋密信 甲→乙)即生成 NPC↔NPC 信入 GM.letters 且标 _npcInitiated。给玩家的信收件人=`'玩家'`(各创建点既定
    //   sentinel)或玩家角色名(AI 偶用本名寄君)·NPC↔NPC 的 to 是别的 NPC 名→排除。天启无此类信故零回归。
    var _pn = '';
    try { _pn = (window.P && window.P.playerInfo && window.P.playerInfo.characterName) || ''; } catch(_) {}
    function _isToPlayer(to){ var t = String(to == null ? '' : to); return t === '玩家' || (_pn && t === _pn); }
    letters.forEach(function(l){
      if (!l) return;
      if (String(l.from) !== '玩家' && _isToPlayer(l.to)) {
        rows.push({
          id: l.id,
          from: l.from || '来信者',
          title: l.title || '来函',
          content: l.content || '暂无正文。',
          status: letterStatusTextFormal(l),
          time: letterTimeFormal(l),
          unread: !l.playerRead,
          reply: false,
          raw: l.raw,
          source: l
        });
      } else if (l.reply && /returned|intercepted_forging/.test(String(l.status || ''))) {
        rows.push({
          id: l.id,
          from: l.to || '回信者',
          title: '回书 · ' + (l.title || letterTypeLabelFormal(l.letterType)),
          content: l.reply,
          status: letterStatusTextFormal(l),
          time: l.replyTurn ? (function(){ try { if (typeof window.getTSText === 'function') return window.getTSText(l.replyTurn); } catch(_) {} return '第' + l.replyTurn + '回合'; })() : letterTimeFormal(l),
          unread: !l.raw || !l.raw._replyRead,
          reply: true,
          raw: l.raw,
          source: l
        });
      }
    });
    rows.sort(function(a, b){
      var at = (a.source && (a.source.replyTurn || a.source.sentTurn)) || 0;
      var bt = (b.source && (b.source.replyTurn || b.source.sentTurn)) || 0;
      if (bt !== at) return bt - at;
      return String(a.from).localeCompare(String(b.from));
    });
    return rows;
  }

  function yanLetterTypeMeta(type){
    return YAN_TYPE[type] || { label: letterTypeLabelFormal(type), c:'#4a5e8a' };
  }
  function renderFormalInboxItem(item){
    var pp = (typeof tmfRenwuPortrait === 'function') ? tmfRenwuPortrait({ name:item.from }) : '';
    // 2026-06-11·治「右侧来函点展阅看不到全文/就地展开太挤」:展阅改为弹「大居中阅览浮层」(openLetterReadOverlay)，
    //   舒适读全文，不再受右栏窄列(262px)挤成一小块。右卡仍保留 2 行预览。
    var actions = actionBtn('展阅', 'letter-read-desk', { id:item.id || '' }, 'inc-btn');
    if (!item.reply) actions += actionBtn('回书', 'letter-thread-action-desk', { id:item.id || '', letterAction:'reply' }, 'inc-btn green');
    actions += actionBtn('摘入', 'letter-thread-action-desk', { id:item.id || '', letterAction:'excerpt' }, 'inc-btn');
    return '<article class="incard ' + (item.unread ? 'unread ' : '') + (item.reply ? 'reply' : '') + '">' +
      '<div class="inc-top">' + yanFaceImg({ name:item.from, portrait:pp }, 'inc-seal') + '<div class="inc-who"><b>' + esc(item.from || '来信者') + '</b><span>' + (item.reply ? '回书' : '主动来函') + '</span></div></div>' +
      '<div class="inc-title">' + fullHongyanText(item.title || '来函', '来函', 'hy-inbox-title-full-v5') + '</div>' +
      '<div class="inc-body wd-selectable">' + fullHongyanText(item.content || '暂无正文。', '暂无正文。', 'hy-inbox-body-full-v5') + '</div>' +
      '<div class="inc-meta"><span>' + esc(item.time || '') + '</span><span>' + (item.unread ? '未阅' : (item.reply ? '回书' : esc(item.status || '已阅'))) + '</span></div>' +
      '<div class="inc-acts">' + actions + '</div></article>';
  }

  // 2026-06-11·鸿雁来函「展阅」大阅览浮层:大居中卡片·宽 680px·16px 仿宋·行高 2·长则卡内滚动·舒适读全文。
  function openLetterReadOverlay(letter, navList, navIdx){
    if (!letter) return;
    // #4 上一封/下一封导航:未传入则按收件箱顺序现算
    if (!Array.isArray(navList)) {
      try { navList = (typeof formalIncomingLetters === 'function') ? formalIncomingLetters(getLetters()) : []; } catch(_nl) { navList = []; }
      navIdx = navList.findIndex(function(x){ return String(x.id || '') === String(letter.id || ''); });
      if (navIdx < 0) { navList = [letter]; navIdx = 0; }
    }
    if (!document.getElementById('tm-letter-read-style')) {
      var st = document.createElement('style');
      st.id = 'tm-letter-read-style';
      st.textContent =
        '.tm-letter-read-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483600;' +
          'width:min(680px,88vw);max-height:86vh;box-sizing:border-box;display:flex;flex-direction:column;padding:24px 30px 26px;' +
          'border-radius:12px;border:1px solid #a8833a;background:linear-gradient(180deg,#fffdf3,#f4ead0);' +
          'box-shadow:0 30px 80px rgba(40,24,10,0.55),inset 0 0 0 1px rgba(255,255,255,0.5);' +
          'font-family:"FangSong","STFangsong","Noto Serif SC",serif;color:#241d15;}' +
        '.tm-letter-read-card .lr-close{position:absolute;right:13px;top:11px;width:30px;height:30px;border:none;background:none;' +
          'font-size:22px;color:#9c8b6b;cursor:pointer;line-height:1;border-radius:6px;}' +
        '.tm-letter-read-card .lr-close:hover{background:rgba(168,50,40,0.1);color:#7a2018;}' +
        '.tm-letter-read-card .lr-head{display:flex;align-items:center;gap:12px;padding-bottom:13px;margin-bottom:14px;' +
          'border-bottom:1px solid rgba(168,131,58,0.3);flex:0 0 auto;}' +
        '.tm-letter-read-card .lr-seal{width:42px;height:42px;display:grid;place-items:center;border-radius:9px;font-size:19px;' +
          'font-weight:bold;color:#fff;background:linear-gradient(150deg,#6a7eaa,#33456a);flex:0 0 auto;box-shadow:0 2px 7px rgba(40,52,80,0.4);}' +
        '.tm-letter-read-card .lr-who b{font-size:19px;letter-spacing:0.05em;display:block;line-height:1.3;}' +
        '.tm-letter-read-card .lr-who span{font-size:12.5px;color:#9c8b6b;letter-spacing:0.02em;}' +
        '.tm-letter-read-card .lr-title{font-size:16.5px;font-weight:600;color:#7a2018;letter-spacing:0.04em;margin-bottom:12px;flex:0 0 auto;line-height:1.5;}' +
        '.tm-letter-read-card .lr-body{flex:1 1 auto;min-height:120px;overflow-y:auto;font-size:16px;line-height:2.05;' +
          'letter-spacing:0.02em;white-space:pre-wrap;text-align:justify;padding-right:10px;}' +
        '.tm-letter-read-card .lr-body .hy-fulltext-v5{white-space:pre-wrap;}' +
        '.tm-letter-read-card .lr-reply{margin-top:16px;padding:13px 16px;border-radius:8px;border-left:3px solid #4a5e8a;' +
          'background:rgba(74,94,138,0.06);flex:0 0 auto;max-height:34vh;overflow-y:auto;}' +
        '.tm-letter-read-card .lr-reply > b{display:block;font-size:13px;color:#4a5e8a;margin-bottom:8px;letter-spacing:0.1em;}' +
        '.tm-letter-read-card .lr-reply-body{font-size:15px;line-height:1.95;white-space:pre-wrap;color:#3a3022;}' +
        '.tm-letter-read-card .lr-reply-body .hy-fulltext-v5{white-space:pre-wrap;}' +
        '.tm-letter-read-card .lr-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:13px;border-top:1px solid rgba(168,131,58,0.3);flex:0 0 auto;}' +
        '.tm-letter-read-card .lr-reply-btn{padding:7px 18px;border-radius:7px;border:1px solid #4a5e8a;background:linear-gradient(150deg,#6a7eaa,#33456a);color:#fff;font-size:14px;cursor:pointer;letter-spacing:0.06em;font-family:inherit;}' +
        '.tm-letter-read-card .lr-reply-btn:hover{filter:brightness(1.1);}' +
        '.tm-letter-read-card .lr-nav{margin-left:auto;display:flex;align-items:center;gap:8px;}' +
        '.tm-letter-read-card .lr-nav-btn{padding:6px 12px;border-radius:6px;border:1px solid #a8833a;background:rgba(168,131,58,0.12);color:#7a5a18;font-size:13px;cursor:pointer;font-family:inherit;}' +
        '.tm-letter-read-card .lr-nav-btn:disabled{opacity:0.35;cursor:default;}' +
        '.tm-letter-read-card .lr-nav-btn:not(:disabled):hover{background:rgba(168,131,58,0.22);}' +
        '.tm-letter-read-card .lr-nav-pos{font-size:12.5px;color:#9c8b6b;min-width:46px;text-align:center;}';
      (document.head || document.documentElement).appendChild(st);
    }
    var from = letter.from || '来信者';
    var title = letter.title || '来函';
    var content = letter.content || '暂无正文。';
    var reply = (letter.reply && typeof letter.reply === 'string') ? letter.reply : ((letter.source && letter.source.reply) || '');
    var time = letter.time || '';
    // #4 底部:回信(来函且尚无回书) + 上一封/下一封翻页
    var canReply = !reply && String(from) !== '玩家';
    var navHtml = (navList && navList.length > 1) ?
      ('<div class="lr-nav">' +
        '<button type="button" class="lr-nav-btn" onclick="window._tmLetterReadGo&&window._tmLetterReadGo(-1)"' + (navIdx <= 0 ? ' disabled' : '') + '>◀ 上一封</button>' +
        '<span class="lr-nav-pos">' + (navIdx + 1) + ' / ' + navList.length + '</span>' +
        '<button type="button" class="lr-nav-btn" onclick="window._tmLetterReadGo&&window._tmLetterReadGo(1)"' + (navIdx >= navList.length - 1 ? ' disabled' : '') + '>下一封 ▶</button>' +
      '</div>') : '';
    var replyBtnHtml = canReply ? '<button type="button" class="lr-reply-btn" onclick="window._tmLetterReadReply&&window._tmLetterReadReply()">✍ 回　信</button>' : '';
    var footHtml = (replyBtnHtml || navHtml) ? ('<div class="lr-foot">' + replyBtnHtml + navHtml + '</div>') : '';
    var html = '<div class="tm-letter-read-card" role="dialog" aria-modal="true">' +
      '<button type="button" class="lr-close" data-close-bridge="1" title="关闭">×</button>' +
      '<div class="lr-head"><span class="lr-seal">函</span><div class="lr-who"><b>' + esc(from) + '</b><span>' +
        (reply ? '回书往来' : '主动来函') + (time ? ' · ' + esc(time) : '') + '</span></div></div>' +
      '<div class="lr-title">' + fullHongyanText(title, '来函', 'lr-title-text') + '</div>' +
      '<div class="lr-body wd-selectable">' + fullHongyanText(content, '暂无正文。', 'lr-body-text') + '</div>' +
      (reply ? '<div class="lr-reply"><b>回　函</b><div class="lr-reply-body wd-selectable">' + fullHongyanText(reply, '', 'lr-reply-text') + '</div></div>' : '') +
      footHtml +
      '</div>';
    // #4 全局回调(闭包当前 letter/navList/navIdx):翻页=重开弹窗(openDeskOverlay 替换式);回信=走 reply 流程并打开写信面板
    var _curId = letter.id;
    window._tmLetterReadGo = function(d){ var ni = navIdx + d; if (ni >= 0 && ni < navList.length) { openLetterReadOverlay(navList[ni], navList, ni); } };
    window._tmLetterReadReply = function(){ try { handleModuleAction('letter-thread-action-desk', { id: _curId, letterAction: 'reply' }); } catch(_r){} try { openHongyanPreviewPanel(); } catch(_p){} };
    openDeskOverlay('tm-letter-read-overlay', html);
  }
  function renderFormalLetterCard(l, targetName){
    var outgoing = String(l.from) === '玩家' || String(l.to) === String(targetName);
    if (!outgoing && l.raw && !l.raw._playerRead) l.raw._playerRead = true;
    var statusText = letterStatusTextFormal(l);
    var rawStatus = String((l.raw && l.raw.status) || l.status || '');
    var tm = yanLetterTypeMeta(l.letterType);
    var cardCls = outgoing ? 'out' : 'in';
    if (/intercepted$/.test(rawStatus)) cardCls += ' intercepted';
    if (rawStatus === 'blocked') cardCls += ' blocked';
    var stCls = /returned/.test(rawStatus) ? 'done' : (/intercepted$|blocked/.test(rawStatus) ? 'bad' : (/traveling|replying|delivered|intercepted_forging/.test(rawStatus) ? 'road' : ''));
    var forged = !!(l.forged || (l.raw && l.raw._forgedReply) || rawStatus === 'intercepted_forging');
    var token = l.token || l._tokenUsed || (l.raw && l.raw._tokenUsed) || tm.token;
    var meta = '<span class="lc-tag type" style="background:' + tm.c + '">' + esc(tm.label) + '</span>' +
      '<span class="lc-tag">' + esc(letterUrgencyLabelFormal(l.urgency)) + '</span>' +
      (l.cipher && l.cipher !== 'none' ? '<span class="lc-tag cipher">' + esc(letterCipherLabelFormal(l.cipher)) + '</span>' : '') +
      (token ? '<span class="lc-tag token">' + esc((YAN_TOKEN[token] || {}).label || '') + '</span>' : '') +
      '<span class="lc-tag">' + esc(letterTimeFormal(l)) + '</span>';
    var actions = '';
    if (outgoing && rawStatus === 'traveling') actions += actionBtn('追回', 'letter-thread-action-desk', { id:l.id || '', letterAction:'recall' }, 'lc-btn');
    if (outgoing && /intercepted/.test(rawStatus)) {
      actions += actionBtn('重发·密使', 'letter-thread-action-desk', { id:l.id || '', letterAction:'resend-secret' }, 'lc-btn');
      actions += actionBtn('重发·加急', 'letter-thread-action-desk', { id:l.id || '', letterAction:'resend-fast' }, 'lc-btn hot');
    }
    if (outgoing && rawStatus === 'blocked') actions += actionBtn('绕封锁·改密旨', 'letter-thread-action-desk', { id:l.id || '', letterAction:'bypass' }, 'lc-btn hot');
    if (!outgoing && l.raw && l.raw._npcInitiated) actions += actionBtn('回书', 'letter-thread-action-desk', { id:l.id || '', letterAction:'reply' }, 'lc-btn green');
    actions += actionBtn('遣使核实', 'letter-thread-action-desk', { id:l.id || '', letterAction:'verify' }, 'lc-btn');
    actions += actionBtn('摘入', 'letter-thread-action-desk', { id:l.id || '', letterAction:'excerpt' }, 'lc-btn');
    actions += actionBtn(l.starred ? '★' : '☆', 'letter-thread-action-desk', { id:l.id || '', letterAction:'star' }, 'lc-btn star' + (l.starred ? ' on' : ''));
    var lit = /returned/.test(rawStatus);
    var danger = /intercepted$|blocked/.test(rawStatus);
    var lnow = (window.GM && GM.turn) || 1, lsT = Number(l.sentTurn || (l.raw && l.raw.sentTurn) || lnow), ldT = Number(l.deliveryTurn || (l.raw && l.raw.deliveryTurn) || (lsT + 1));
    var lprog = (ldT > lsT) ? Math.max(6, Math.min(100, Math.round((lnow - lsT) / (ldT - lsT) * 100))) : 55;
    var mini = /(traveling|intercepted|blocked|replying|intercepted_forging|recalled)/.test(rawStatus) ?
      ('<div class="lc-mini"><span class="mn-done" style="width:' + (lit ? 100 : lprog) + '%"></span><span class="mn-dot s"></span><span class="mn-dot e' + (lit ? ' lit' : '') + '"></span>' +
        (/traveling/.test(rawStatus) ? '<span class="mn-mk" style="left:' + lprog + '%">🐎</span>' : '') +
        (/replying|intercepted_forging/.test(rawStatus) ? '<span class="mn-mk" style="left:' + (100 - lprog) + '%">🐎</span>' : '') +
        (/intercepted$/.test(rawStatus) ? '<span class="mn-x" style="left:' + lprog + '%">✕</span>' : '') +
        (rawStatus === 'blocked' ? '<span class="mn-x" style="left:12%">⊘</span>' : '') + '</div>') : '';
    return '<article class="lcard ' + cardCls + '">' +
      '<div class="lc-top"><span class="lc-dir ' + (outgoing ? 'out' : 'in') + '">' + (outgoing ? '御前发出' : '来函上达') + '</span>' +
        '<span class="lc-route">' + esc([l.from, l.to].filter(Boolean).join(' → ')) + '</span>' +
        '<span class="lc-status ' + stCls + '">' + esc(statusText) + '</span></div>' +
      '<div class="lc-meta">' + meta + '</div>' +
      '<div class="lc-body wd-selectable">' + fullHongyanText(l.content || '暂无正文。', '暂无正文。', 'hy-letter-body-full-v5') + '</div>' +
      (l.reply ? '<div class="lc-reply' + (forged ? ' forged' : '') + '"><b>回书 · ' + esc(String(l.from) === '玩家' ? (l.to || '') : (l.from || '')) + (letterTimeFormal(l) ? '　' + esc(letterTimeFormal(l)) : '') + '</b><p>' + fullHongyanText(l.reply, '暂无回书。', 'hy-letter-reply-full-v5') + '</p></div>' : '') +
      mini +
      '<div class="lc-acts">' + actions + '</div></article>';
  }

  // ═══ 御案·鸿雁 (yan-yuan) · 落地 2026-06-03 ═══
  var YAN_TYPE = {
    secret_decree:{label:'密旨',c:'#a83228',token:'seal'},
    military_order:{label:'征调令',c:'#7a2018',token:'tally'},
    formal_edict:{label:'正式诏令',c:'#a8833a',token:'seal'},
    greeting:{label:'问安函',c:'#557f6f',token:false},
    personal:{label:'私函',c:'#4a5e8a',token:false},
    proclamation:{label:'檄文',c:'#8e6aa8',token:false}
  };
  var YAN_TOKEN = { seal:{label:'玺印',glyph:'玺',desc:'加盖玺印·彰显正统'}, tally:{label:'虎符',glyph:'符',desc:'调兵凭证·无符不从'}, gold_tablet:{label:'金牌',glyph:'金',desc:'八百里加急专用'} };
  var YAN_CIPHER = { none:{label:'不加密',read:1.0}, yinfu:{label:'阴符',read:0.2}, yinshu:{label:'阴书',read:0.05}, wax_ball:{label:'蜡丸密函',read:0.4}, silk_sewn:{label:'帛书缝衣',read:0.3} };
  function yanHeldToken(need){
    if(!need) return false;
    try{ var items=(window.GM&&GM.items)||[]; var lbl=(YAN_TOKEN[need]||{}).label;
      if(items.some(function(it){return it&&(it.type===need||it.name===lbl);})) return true; }catch(_){}
    return need==='seal'||need==='tally';
  }
  function yanTokenBadge(type){
    var need=(YAN_TYPE[type]||{}).token;
    if(!need) return '<span class="token-badge none"><span class="tk-ico">○</span>无需信物</span>';
    var tk=YAN_TOKEN[need]||{label:need,glyph:'信'};
    if(yanHeldToken(need)) return '<span class="token-badge"><span class="tk-ico">'+esc(tk.glyph)+'</span>附 <b>'+esc(tk.label)+'</b> · '+esc(tk.desc)+'</span>';
    return '<span class="token-badge lack"><span class="tk-ico">'+esc(tk.glyph)+'</span>未持<b>'+esc(tk.label)+'</b> · 恐无符不从</span>';
  }
  function yanCipherGauge(cipher){
    var rd=(YAN_CIPHER[cipher]||YAN_CIPHER.none).read; var pct=Math.round(rd*100);
    var txt=rd>=1?'若被截即遭破译':rd<=0.05?'纵截亦难破译':'截获后约 '+pct+'% 可被读';
    return '<span class="cipher-gauge"><span class="cg-lbl">密级 · '+esc((YAN_CIPHER[cipher]||{}).label||'不加密')+'</span><span class="cg-track"><span class="cg-fill" style="width:'+pct+'%"></span></span><span class="cg-val">'+esc(txt)+'</span></span>';
  }
  function yanFaceImg(p, cls){
    var nm=(p&&p.name)||'臣';
    var glyph=esc(nm.slice(-2,-1)||nm.slice(0,1));
    return '<span class="'+cls+' has-portrait" data-glyph="'+glyph+'"><img class="pt-img" loading="lazy" decoding="async" src="'+attr((p&&p.portrait)||'')+'" alt="" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'fallback\');"></span>';
  }
  function yanRouteBlock(target, letters){
    var rows=letters.filter(function(l){ return String(l.from)===String(target.name)||String(l.to)===String(target.name); });
    var live=rows.filter(function(l){ return /traveling|replying|delivered|intercepted|intercepted_forging|blocked|recalled/.test(String(l.status||'')); })[0];
    function _days(urg){ try{ return (typeof calcLetterDays==='function')?calcLetterDays('京城', target.location||'', urg||'normal'):0; }catch(_){ return 0; } }
    if(!live){ var cd=_days('normal'); return '<div class="route calm"><div class="route-top"><b>驿路</b><em>'+(cd?'京城 → '+esc(target.location||'')+' 约 '+cd+' 日':'京城 → '+esc(target.location||'')+' · 驿路通畅')+'</em></div><div class="route-note">'+fullHongyanText('驿路通畅，暂无在途信使。拟函遣使后，可在此追踪驿程。','驿路通畅','hy-route-note-full-v5')+'</div></div>'; }
    var st=String(live.status||''); var danger=/intercepted|blocked/.test(st)&&st!=='intercepted_forging'; var lit=/returned/.test(st);
    var now=(window.GM&&GM.turn)||1;
    var sT=Number(live.sentTurn||(live.raw&&live.raw.sentTurn)||now);
    var dT=Number(live.deliveryTurn||(live.raw&&live.raw.deliveryTurn)||(sT+1));
    var prog=(dT>sT)?Math.max(6,Math.min(100,Math.round((now-sT)/(dT-sT)*100))):55;
    var D=_days(live.urgency)||Math.max(1,dT-sT); var el=Math.max(0,Math.round(D*prog/100));
    var note='', noteCls='';
    if(/traveling/.test(st)) note='信使在途　已行 '+el+' 日 / 全程 '+D+' 日　距'+(target.location||'')+'尚余 '+Math.max(1,D-el)+' 日';
    else if(/delivered/.test(st)) note='已抵'+(target.location||'')+'　'+(target.name||'')+'已览，候其回书';
    else if(/replying|intercepted_forging/.test(st)) note='回函在途　自'+(target.location||'')+'返京　已行 '+el+' 日 / 全程 '+D+' 日';
    else if(/intercepted/.test(st)){ note='信使失踪于途中　杳无音讯，恐已落敌手'; noteCls='warn'; }
    else if(/blocked/.test(st)){ note='为'+((live.raw&&live.raw.blockBy)||'中书')+'扣发，未能出京'; noteCls='warn'; }
    else if(/recalled/.test(st)) note='信使已奉命折返　原信追回';
    var stTxt=(typeof letterStatusTextFormal==='function'?letterStatusTextFormal(live):st);
    var typeLabel=(typeof letterTypeLabelFormal==='function'?letterTypeLabelFormal(live.letterType):'');
    var endGlyph=esc(((target.name||'臣').slice(-2,-1))||((target.name||'臣').slice(0,1)));
    var courier='', brk='';
    if(/traveling/.test(st)) courier='<span class="route-courier" style="left:'+prog+'%">🐎</span>';
    else if(/replying|intercepted_forging/.test(st)) courier='<span class="route-courier" style="left:'+(100-prog)+'%">🐎</span>';
    else if(/intercepted/.test(st)) brk='<span class="route-break" style="left:'+prog+'%">✕</span>';
    else if(/blocked/.test(st)) brk='<span class="route-break" style="left:14%">⊘</span>';
    return '<div class="route'+(danger?' danger':'')+'"><div class="route-top"><b>驿路</b><em>'+esc(stTxt)+(typeLabel?' · '+esc(typeLabel):'')+'</em></div><div class="route-line"><div class="route-done" style="width:'+(lit?100:prog)+'%"></div><span class="route-node start">京</span><span class="route-node end'+(lit?' lit':'')+'">'+endGlyph+'</span>'+courier+brk+'</div><div class="route-labels"><b>京城</b><b>'+esc(target.location||'')+'</b></div><div class="route-note'+(noteCls?' '+noteCls:'')+'">'+fullHongyanText(note,'驿路暂无说明','hy-route-note-full-v5')+'</div></div>';
  }
  function yanContactCard(p, target, multiOn, multiTargets, letters){
    var active=String(p.name)===String(target.name);
    var multiSel=multiOn&&multiTargets.indexOf(p.name)>=0;
    var c=letterPersonCounts(p.name, letters);
    var right;
    if(multiOn){ right='<span class="contact-msel">'+(multiSel?'✓':'')+'</span>'; }
    else { right='<span class="contact-counts">'+(c.unread?'<span class="cc unread">'+esc(c.unread)+'</span>':'')+(c.road?'<span class="cc road">'+esc(c.road)+'</span>':'')+(c.lost?'<span class="cc lost">'+esc(c.lost)+'</span>':'')+'</span>'; }
    return '<button type="button" class="contact '+(active&&!multiOn?'active ':'')+(multiSel?'multi-sel':'')+'" data-desk-action="letter-target-desk" data-name="'+attr(p.name)+'" data-letter-search-text="'+attr([p.name,p.role,p.region,p.location,p.faction].join(' '))+'">'+yanFaceImg(p,'contact-face')+'<span class="contact-main"><b>'+esc(p.name)+'</b><span data-hy-contact-role="1">'+esc(p.role)+'</span><i data-hy-contact-location="1">'+esc(p.location)+'</i></span>'+right+'</button>';
  }
  function renderFormalLetterPanel(){
    installHongyanYuanStyles();
    restoreFormalDraftsFromGM(false);
    var letters = getLetters();
    var people = normalizeLetterPeople();
    var filter = state.letterFilter || 'all';
    var targetName = (window.GM && GM._pendingLetterTo) || state.letterTarget || (people[0] && people[0].name) || '臣工';
    var target = people.find(function(p){ return String(p.name) === String(targetName) || String(p.id) === String(targetName); }) || people[0] || {name:'臣工',role:'',location:'',region:'其他',portrait:''};
    state.letterTarget = target.name;
    if (!Array.isArray(state.letterMultiTargets)) state.letterMultiTargets = [];
    var multiOn = !!state.letterMultiMode;
    var multiTargets = state.letterMultiTargets;
    var grouped = {};
    people.forEach(function(p){ (grouped[p.region] || (grouped[p.region] = [])).push(p); });
    var regionOrder = ['内廷','在京','辽东·北境','宣大·山西','西陲·边镇','中原·鲁豫','江南·江浙','西南·巴蜀','南方·海疆','其他'];
    Object.keys(grouped).forEach(function(k){ if (regionOrder.indexOf(k) < 0) regionOrder.push(k); });
    var roster = regionOrder.map(function(region){
      if (!grouped[region] || !grouped[region].length) return '';
      return '<div class="region-group"><div class="region-t">' + esc(region) + '</div>' + grouped[region].map(function(p){ return yanContactCard(p, target, multiOn, multiTargets, letters); }).join('') + '</div>';
    }).join('') + '<div class="roster-empty hy-search-empty-v5" style="display:none">没有匹配的通信对象。</div>';
    var targetLetters = letters.filter(function(l){ return String(l.from) === String(target.name) || String(l.to) === String(target.name); });
    targetLetters = targetLetters.filter(function(l){ return letterFilterMatchFormal(filter, l); });
    targetLetters.sort(function(a, b){ return (a.sentTurn || 0) - (b.sentTurn || 0); });
    var TFILTERS=[['all','全部'],['unread','未读'],['road','在途'],['lost','失约'],['star','星标']];
    var filterBtns = TFILTERS.map(function(f){ return '<button type="button" class="tf '+(filter===f[0]?'active':'')+'" data-desk-action="letter-filter-desk" data-filter="'+attr(f[0])+'">'+esc(f[1])+'</button>'; }).join('');
    var thread = targetLetters.length ? targetLetters.map(function(l){ return renderFormalLetterCard(l, target.name); }).join('') : '<div class="thread-empty"><b>尚无往来书信</b><p>选中人物后可直接拟函。信件送达、截获、逾期、回函随回合驿程结算，写入 GM.letters。</p></div>';
    var draft = state.letterDraft || {};
    var type = draft.type || 'personal', urgency = draft.urgency || 'normal', cipher = draft.cipher || 'none', sendMode = draft.sendMode || 'multi_courier', body = draft.body || '';
    var c = letterPersonCounts(target.name, letters);
    var inboxRows = formalIncomingLetters(letters);
    var unreadInbox = inboxRows.filter(function(x){ return x.unread; }).length;
    var inbox = inboxRows.length ? inboxRows.slice(0, 20).map(renderFormalInboxItem).join('') : '<div class="inbox-empty"><b>暂无来信</b>主动来函与已返回的回书会集中显示于此。</div>';
    var roadAll = letters.filter(function(l){ return /traveling|replying|intercepted_forging/.test(String(l.status||'')); }).length;
    var routeWarnings = [];
    try {
      routeWarnings = ((window.GM && GM._routeDisruptions) || []).filter(function(route){ return route && !route.resolved; });
    } catch(_) {}
    var routeWarningHtml = routeWarnings.length ? '<div class="hy-route-v5 hy-route-warning-v5"><b>驿路告警</b>' + routeWarnings.map(function(route){
      var routeName = route.route || [route.from, route.to].filter(Boolean).join('-') || '未知驿路';
      var routeText = routeName + '：' + (route.reason || '原因不明') + '；该方向信件截获率大幅提高。';
      return fullHongyanText(routeText, '驿路告急', 'hy-route-full-v5');
    }).join('') + '</div>' : '';
    function opt(v,cur,lbl){ return '<option value="'+v+'"'+(cur===v?' selected':'')+'>'+lbl+'</option>'; }
    return '<section class="yan-yuan">' +
      '<div class="yan-titlebar"><div class="yt-center"><div class="yt-main">鸿 雁 传 书</div><div class="yt-sub">驿传四方　密旨亲遣　御前通问</div></div>' +
        '<div class="yan-chips"><span class="chip indigo">在途 ' + esc(roadAll) + '</span><span class="chip hot">未阅 ' + esc(unreadInbox) + '</span></div></div>' +
      '<div class="yan-body">' +
        '<aside class="roster"><div class="roster-hd"><span class="roster-seal">雁</span><div><b>雁信名册</b><span>远方臣工 · 边镇 · 外藩</span></div></div>' +
          '<div class="roster-tools"><div class="yan-search"><input class="tm-input" data-desk-letter-search value="' + attr(state.letterSearch || '') + '" placeholder="检索姓名、官职、党派、地点"></div>' +
          '<div class="multi-bar">' + actionBtn(multiOn ? ('群发中 · ' + multiTargets.length + ' 人') : '群发', 'letter-multi-toggle-desk', {}, 'multi-toggle' + (multiOn ? ' on' : '')) + '<span class="multi-hint">' + (multiOn ? '勾选收件人，写完正文按「遣使送出」一并发出' : '点名册可逐一选定收信人') + '</span></div></div>' +
          '<div class="roster-scroll">' + roster + '</div></aside>' +
        '<main class="deskmain">' +
          '<section class="compose"><div class="cmp-head">' + yanFaceImg(target, 'cmp-face') + '<div class="cmp-who"><b>致 ' + esc(target.name) + '<small data-hy-contact-role="1">' + esc(target.role||'') + '</small></b><div class="cmp-loc" data-hy-contact-location="1">' + esc(target.location||'') + (target.faction ? ' · ' + esc(target.faction) : '') + '</div></div><div class="cmp-stat">' + actionChip('往来 ' + c.total, 'green') + (c.unread ? actionChip('未阅 ' + c.unread, 'hot') : '') + (c.road ? actionChip('在途 ' + c.road, 'indigo') : '') + '</div></div>' +
            routeWarningHtml +
            yanRouteBlock(target, letters) +
            (multiOn ? '<div class="multi-banner"><b>群发 ' + multiTargets.length + ' 人</b>' + (multiTargets.length ? '：' + esc(multiTargets.join('、')) : '（请在左侧名册勾选收件人）') + '<small>正文与类型 / 缓急 / 加密对所有人一致；遣使后逐一计驿程。</small></div>' : '') +
            '<div class="cmp-grid"><div class="cmp-field"><span>书信类型</span><select class="tm-select" data-desk-letter-type data-letter-draft-field="type">' + opt('secret_decree',type,'密旨')+opt('military_order',type,'征调令')+opt('formal_edict',type,'正式诏令')+opt('greeting',type,'问安函')+opt('personal',type,'私函')+opt('proclamation',type,'檄文') + '</select></div>' +
              '<div class="cmp-field"><span>驿递缓急</span><select class="tm-select" data-desk-letter-urgency data-letter-draft-field="urgency">' + opt('normal',urgency,'普通驿递')+opt('urgent',urgency,'加急驿递')+opt('extreme',urgency,'八百里加急') + '</select></div>' +
              '<div class="cmp-field"><span>加密方式</span><select class="tm-select" data-desk-letter-cipher data-letter-draft-field="cipher">' + opt('none',cipher,'不加密')+opt('yinfu',cipher,'阴符')+opt('yinshu',cipher,'阴书')+opt('wax_ball',cipher,'蜡丸密函')+opt('silk_sewn',cipher,'帛书缝衣') + '</select></div>' +
              '<div class="cmp-field"><span>信使方式</span><select class="tm-select" data-desk-letter-sendmode data-letter-draft-field="sendMode">' + opt('normal',sendMode,'普通信使')+opt('multi_courier',sendMode,'多路信使')+opt('secret_agent',sendMode,'密使') + '</select></div></div>' +
            '<div class="cmp-meta">' + yanTokenBadge(type) + yanCipherGauge(cipher) + '</div>' +
            '<div class="cmp-paper"><textarea class="tm-textarea cmp-textarea" data-desk-letter-body data-letter-draft-field="body" placeholder="致书' + attr(target.name) + '……">' + esc(body) + '</textarea></div>' +
            '<div class="cmp-acts">' + actionBtn('遣使送出', 'letter-send-desk', {}, 'yact primary') + actionBtn('存为草稿', 'letter-draft-desk', {}, 'yact') + actionBtn('入人物记忆', 'letter-memory-desk', {}, 'yact') + '<span class="acts-note">' + esc(letterUrgencyLabelFormal(urgency)) + ' · ' + esc(letterSendModeLabelFormal(sendMode)) + ((type === 'military_order' || type === 'formal_edict') ? ' · 正式文书经中书' : '') + '</span>' + '<input data-desk-letter-to data-letter-draft-field="to" type="hidden" value="' + attr(target.name) + '"></div></section>' +
          '<section class="thread"><div class="thread-hd"><b>往来信札</b><em>' + esc(target.name) + ' · ' + esc((TFILTERS.find(function(f){ return f[0] === filter; }) || ['', '全部'])[1]) + '</em><div class="thread-filter">' + filterBtns + '</div></div><div class="thread-scroll">' + thread + '</div></section></main>' +
        '<aside class="inbox"><div class="inbox-hd"><span class="inbox-seal">函</span><div><b>鸿雁来函</b><span>主动来函 · 回书 · 未阅</span></div></div><div class="inbox-sum"><span>总来函 <b>' + esc(inboxRows.length) + '</b></span><span class="' + (unreadInbox?'hot':'') + '">未阅 <b>' + esc(unreadInbox) + '</b></span></div><div class="inbox-scroll">' + inbox + '</div></aside>' +
      '</div></section>';
  }
  // ===== BODY END =====

  // ── backfill：origin 仍按名调用的 9 个函数回填 bucket(供 origin forward shim 解析) ──
  __p8mp.renderFormalMemorialPanel = renderFormalMemorialPanel;
  __p8mp.refreshFormalMemorialSelection = refreshFormalMemorialSelection;
  __p8mp.renderFormalLetterPanel = renderFormalLetterPanel;
  __p8mp.letterTypeLabelFormal = letterTypeLabelFormal;
  __p8mp.letterUrgencyLabelFormal = letterUrgencyLabelFormal;
  __p8mp.letterCipherLabelFormal = letterCipherLabelFormal;
  __p8mp.letterSendModeLabelFormal = letterSendModeLabelFormal;
  __p8mp.letterTimeFormal = letterTimeFormal;
  __p8mp.formalIncomingLetters = formalIncomingLetters;
  __p8mp.openLetterReadOverlay = openLetterReadOverlay;
})();
