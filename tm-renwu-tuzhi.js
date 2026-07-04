// ============================================================
// tm-renwu-tuzhi.js — 人物图志「御案米金」运行时面板（in-DOM·零clobber）
//
// 立项 2026-06-04。owner 评旧御案版 tmfRenwu「大量死字段死数据·UI不美观」。
// 本模块 = 把已验证预览(preview/renwu-tuzhi-yuan-preview.html v3)落地为运行时:
//   · 读真 GM.chars(适配器 adaptChar·按 docs/renwu-tuzhi-yuan-redesign.md 接线图)
//   · 御案米金视觉·CSS 全 scope 在 #tm-zhi-overlay 下防冲突
//   · 覆盖 window.openCharRenwuPage / openRenwuTuzhi → 所有人物入口路由到本面板
//   · 不碰热文件(phase8-formal-*/tm-renwu-ui/tm-player-core)·仅 index.html 加一行 script
//
// 落地分刀(见任务#12-16)：L1 地基+适配器+名籍/头屏/总览/身份(本文件)；
//   L2 其余页签真数据；L3 朝局/排行；L4 对参/御笔朱批；L5 wire+真游戏验。
// 渲染层 shape 与预览一致(适配器对齐)→ 渲染代码原样移植，唯一新活=适配器。
// ============================================================
(function(){
'use strict';
if (window.__TMZhiLoaded) return; window.__TMZhiLoaded = true;

/* ===================== 御案米金 CSS（scope 于 #tm-zhi-overlay） ===================== */
var CSS = [
'#tm-zhi-overlay{--silk-hi:#fffdf3;--silk:#f6efda;--silk-lo:#ece1c6;--silk-edge:#dcc99c;--paper:#fcf7ec;--ink:#241d15;--ink-soft:#574733;--ink-faint:#9c8b6b;--gold-hi:#d8b96a;--gold:#a8833a;--gold-d:#7d5e22;--cinnabar:#a83228;--cinnabar-hi:#c64a3e;--cinnabar-d:#7a2018;--jade:#6fa291;--jade-d:#2d5848;--indigo:#4a5e8a;--vermilion:#b83a2b;--purple:#8e6aa8;--rule-ink:rgba(120,90,40,0.10);--zfont:"STKaiti","KaiTi","楷体","Noto Serif SC","STSong",serif;--zfont-doc:"FangSong","STFangsong","仿宋","Noto Serif SC",serif;',
'  position:fixed;inset:0;z-index:99990;display:grid;place-items:center;padding:18px;font-family:var(--zfont);color:var(--ink);',
'  background:rgba(36,24,14,0.5) , radial-gradient(circle at 50% 50%,rgba(36,24,14,0.4),rgba(36,24,14,0.62));-webkit-font-smoothing:antialiased;animation:zy-fade .25s ease both;}',
'#tm-zhi-overlay *{box-sizing:border-box;margin:0;padding:0;}',
'@keyframes zy-fade{from{opacity:0}to{opacity:1}}',
'@keyframes zy-leaf{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}',
'@keyframes zy-radarIn{from{opacity:0;transform:scale(0.82)}to{opacity:1;transform:scale(1)}}',
'@keyframes zy-pageTurn{from{opacity:0;transform:perspective(1400px) rotateY(-3.5deg) translateX(-7px);transform-origin:left center}to{opacity:1;transform:none}}',
'#tm-zhi-overlay .zhi-frame{width:min(1480px,100%);height:min(940px,100%);display:flex;flex-direction:column;border:1px solid var(--silk-edge);border-radius:14px;position:relative;overflow:hidden;box-shadow:0 24px 70px rgba(58,40,22,0.5),0 2px 0 rgba(255,255,255,0.6) inset;background:repeating-linear-gradient(46deg,rgba(120,90,40,0.016) 0 1px,transparent 1px 6px),radial-gradient(130% 70% at 50% -5%,transparent 62%,rgba(90,66,28,0.055)),radial-gradient(130% 70% at 50% 105%,transparent 62%,rgba(90,66,28,0.06)),linear-gradient(168deg,var(--silk-hi),var(--silk) 60%,var(--silk-lo));}',
'#tm-zhi-overlay .zhi-frame::before{content:"";position:absolute;inset:7px;border:1px solid rgba(168,131,58,0.26);border-radius:9px;pointer-events:none;z-index:30;}',
'#tm-zhi-overlay .zhi-frame::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:29;background-image:radial-gradient(circle at 0 0,rgba(125,94,34,0.16) 0 1px,transparent 1.4px),radial-gradient(circle at 100% 0,rgba(125,94,34,0.16) 0 1px,transparent 1.4px),radial-gradient(circle at 0 100%,rgba(125,94,34,0.16) 0 1px,transparent 1.4px),radial-gradient(circle at 100% 100%,rgba(125,94,34,0.16) 0 1px,transparent 1.4px);background-size:18px 18px;background-repeat:no-repeat;background-position:11px 11px,calc(100% - 11px) 11px,11px calc(100% - 11px),calc(100% - 11px) calc(100% - 11px);}',
'#tm-zhi-overlay .zhi-titlebar{position:relative;flex:0 0 auto;padding:13px 22px 11px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(168,131,58,0.22);}',
'#tm-zhi-overlay .zhi-close{position:absolute;left:14px;top:12px;z-index:40;width:31px;height:31px;border-radius:50%;border:1px solid var(--gold-d);background:rgba(255,253,243,0.7);color:var(--gold-d);font-size:17px;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;}',
'#tm-zhi-overlay .zhi-close:hover{background:var(--cinnabar);color:#fff;border-color:var(--cinnabar);transform:rotate(90deg);}',
'#tm-zhi-overlay .st-main{font-size:23px;font-weight:bold;letter-spacing:0.34em;color:var(--ink);text-shadow:0 1px 0 rgba(255,255,255,0.7),0 2px 4px rgba(120,90,36,0.26);text-align:center;}',
'#tm-zhi-overlay .st-main::before,#tm-zhi-overlay .st-main::after{content:"";display:inline-block;width:26px;height:1px;vertical-align:0.34em;margin:0 14px;background:linear-gradient(90deg,transparent,var(--gold));}',
'#tm-zhi-overlay .st-main::after{background:linear-gradient(90deg,var(--gold),transparent);}',
'#tm-zhi-overlay .st-sub{font-size:11.5px;color:var(--ink-faint);letter-spacing:0.3em;margin-top:4px;text-align:center;}',
'#tm-zhi-overlay .zhi-chips{display:flex;gap:7px;}',
'#tm-zhi-overlay .chip{font-size:12px;letter-spacing:0.05em;padding:3px 10px;border-radius:11px;border:1px solid var(--gold-d);background:rgba(255,250,235,0.7);color:var(--ink-soft);white-space:nowrap;}',
'#tm-zhi-overlay .chip.green{border-color:var(--jade-d);color:var(--jade-d);background:rgba(111,162,145,0.12);}',
'#tm-zhi-overlay .chip.hot{border-color:var(--cinnabar);color:#fff;background:linear-gradient(160deg,var(--cinnabar),var(--cinnabar-d));}',
'#tm-zhi-overlay .global-bar{flex:0 0 auto;display:flex;gap:11px;padding:11px 22px;align-items:center;border-bottom:1px solid rgba(168,131,58,0.2);}',
'#tm-zhi-overlay .viewtabs{display:flex;gap:3px;flex:0 0 auto;}',
'#tm-zhi-overlay .vtab{font-family:var(--zfont);font-size:12px;letter-spacing:0.08em;cursor:pointer;padding:8px 14px;border-radius:8px;border:1px solid rgba(168,131,58,0.34);background:rgba(255,252,243,0.5);color:var(--ink-soft);transition:all .15s;}',
'#tm-zhi-overlay .vtab:hover{border-color:var(--gold);}',
'#tm-zhi-overlay .vtab.active{color:#fff;background:linear-gradient(150deg,var(--cinnabar-hi),var(--cinnabar-d));border-color:var(--cinnabar-d);}',
'#tm-zhi-overlay .gsearch{position:relative;flex:1;}',
'#tm-zhi-overlay .gsearch input{width:100%;font-family:var(--zfont);font-size:13px;color:var(--ink);padding:9px 13px 9px 36px;border:1px solid rgba(168,131,58,0.36);border-radius:9px;background:rgba(255,252,242,0.78);outline:none;}',
'#tm-zhi-overlay .gsearch input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(168,131,58,0.1);}',
'#tm-zhi-overlay .gsearch::before{content:"\\2315";position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:17px;color:var(--gold-d);}',
'#tm-zhi-overlay .gbtn{font-family:var(--zfont);font-size:12px;letter-spacing:0.06em;cursor:pointer;padding:8px 16px;border-radius:9px;border:1px solid rgba(168,131,58,0.4);background:rgba(255,252,243,0.6);color:var(--ink-soft);transition:all .15s;white-space:nowrap;}',
'#tm-zhi-overlay .gbtn:hover{background:#fffdf6;border-color:var(--gold);color:var(--ink);}',
'#tm-zhi-overlay .gbtn.seal{border-color:var(--cinnabar-d);color:#fff;background:linear-gradient(155deg,var(--cinnabar-hi),var(--cinnabar-d));}',
'#tm-zhi-overlay .zhi-body{flex:1;display:grid;grid-template-columns:296px 1fr 300px;min-height:0;}',
'#tm-zhi-overlay .panel{display:flex;flex-direction:column;min-height:0;min-width:0;}',
'#tm-zhi-overlay .panel.roster{border-right:1px solid rgba(168,131,58,0.2);background:linear-gradient(180deg,rgba(255,253,247,0.4),transparent);}',
'#tm-zhi-overlay .panel.folio{border-left:1px solid rgba(168,131,58,0.2);background:linear-gradient(180deg,rgba(255,253,247,0.4),transparent);}',
'#tm-zhi-overlay .panel-hd{flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid rgba(168,131,58,0.18);}',
'#tm-zhi-overlay .panel-hd .seal{width:29px;height:29px;flex:0 0 auto;display:grid;place-items:center;border-radius:7px;font-size:14px;color:#fff;font-weight:bold;background:linear-gradient(155deg,var(--cinnabar-hi),var(--cinnabar-d));border:1px solid rgba(122,32,24,0.55);box-shadow:0 2px 6px rgba(122,32,24,0.36);transform:rotate(-1.5deg);}',
'#tm-zhi-overlay .panel-hd .seal.gold{background:linear-gradient(155deg,var(--gold-hi),var(--gold-d));border-color:rgba(125,94,34,0.5);}',
'#tm-zhi-overlay .panel-hd b{font-size:13.5px;letter-spacing:0.12em;color:var(--ink);display:block;}',
'#tm-zhi-overlay .panel-hd span{font-size:11px;color:var(--ink-faint);}',
'#tm-zhi-overlay .statbar{flex:0 0 auto;display:grid;grid-template-columns:repeat(7,1fr);gap:1px;padding:9px 11px 6px;}',
'#tm-zhi-overlay .stat{text-align:center;padding:3px 0;cursor:pointer;border-radius:6px;transition:background .14s;}',
'#tm-zhi-overlay .stat:hover{background:rgba(168,131,58,0.1);}',
'#tm-zhi-overlay .stat.on{background:rgba(168,50,40,0.1);}',
'#tm-zhi-overlay .stat b{display:block;font-size:16px;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1.1;}',
'#tm-zhi-overlay .stat.on b{color:var(--cinnabar-d);}',
'#tm-zhi-overlay .stat span{font-size:10px;color:var(--ink-faint);}',
'#tm-zhi-overlay .stat.warn b{color:var(--cinnabar-d);}',
'#tm-zhi-overlay .stat.warn.on{background:rgba(168,50,40,0.14);}',
'#tm-zhi-overlay .roster-tools{flex:0 0 auto;padding:4px 11px 9px;border-bottom:1px solid rgba(168,131,58,0.16);}',
'#tm-zhi-overlay .r-search{position:relative;margin-bottom:7px;}',
'#tm-zhi-overlay .r-search input{width:100%;font-family:var(--zfont);font-size:12px;color:var(--ink);padding:7px 10px 7px 28px;border:1px solid rgba(168,131,58,0.32);border-radius:8px;background:rgba(255,252,242,0.7);outline:none;}',
'#tm-zhi-overlay .r-search::before{content:"\\2315";position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--gold-d);}',
'#tm-zhi-overlay .r-filters{display:flex;gap:5px;margin-bottom:6px;}',
'#tm-zhi-overlay .r-sel{flex:1;min-width:0;font-family:var(--zfont);font-size:11.5px;color:var(--ink-soft);padding:5px 6px;border:1px solid rgba(168,131,58,0.3);border-radius:7px;background:rgba(255,252,242,0.6);cursor:pointer;outline:none;}',
'#tm-zhi-overlay .r-meta{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--ink-faint);}',
'#tm-zhi-overlay .r-meta b{color:var(--cinnabar-d);font-variant-numeric:tabular-nums;}',
'#tm-zhi-overlay .r-check{display:inline-flex;align-items:center;gap:3px;cursor:pointer;}',
'#tm-zhi-overlay .roster-list{flex:1;overflow-y:auto;padding:7px 9px 14px;}',
'#tm-zhi-overlay .fac-hdr{display:flex;align-items:center;gap:7px;font-size:12px;letter-spacing:0.1em;color:var(--ink-soft);margin:9px 3px 6px;padding-left:8px;border-left:3px solid var(--fc,var(--gold));}',
'#tm-zhi-overlay .fac-hdr:first-child{margin-top:2px;}',
'#tm-zhi-overlay .fac-hdr .n{font-size:10.5px;color:var(--ink-faint);background:rgba(168,131,58,0.13);border-radius:8px;padding:0 6px;}',
'#tm-zhi-overlay .pcard{position:relative;display:flex;gap:9px;width:100%;text-align:left;cursor:pointer;font-family:var(--zfont);padding:8px 9px;border-radius:9px;border:1px solid rgba(168,131,58,0.2);background:linear-gradient(120deg,var(--silk-hi),var(--silk) 80%);margin-bottom:6px;transition:transform .15s,border-color .15s,box-shadow .15s;overflow:hidden;content-visibility:auto;contain-intrinsic-size:auto 64px;}',
'#tm-zhi-overlay .pcard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--fc,var(--gold));opacity:0.55;}',
'#tm-zhi-overlay .pcard:hover{transform:translateX(2px);border-color:var(--gold);box-shadow:-1px 1px 8px rgba(120,90,40,0.1);}',
'#tm-zhi-overlay .pcard.active{border-color:var(--cinnabar);box-shadow:-2px 0 0 var(--cinnabar),0 2px 10px rgba(120,90,40,0.14);background:linear-gradient(120deg,#fffef7,#fbf4e0);}',
'#tm-zhi-overlay .pcard.dead{opacity:0.62;filter:grayscale(0.4);}',
'#tm-zhi-overlay .pc-face{width:46px;height:56px;flex:0 0 auto;border-radius:4px;overflow:hidden;background:linear-gradient(160deg,#efe3c4,#dcca9f);border:1px solid rgba(168,131,58,0.4);box-shadow:0 1px 3px rgba(120,90,40,0.2),0 0 0 2px rgba(255,253,243,0.6) inset;display:grid;place-items:center;position:relative;}',
'#tm-zhi-overlay .pc-face .glyph{font-size:23px;font-weight:bold;color:var(--ink-soft);opacity:0.82;}',
'#tm-zhi-overlay .pc-face img{width:100%;height:100%;object-fit:cover;}',
'#tm-zhi-overlay .pc-body{flex:1;min-width:0;}',
'#tm-zhi-overlay .pc-name{display:flex;align-items:baseline;gap:5px;}',
'#tm-zhi-overlay .pc-name b{font-size:14px;letter-spacing:0.04em;color:var(--ink);}',
'#tm-zhi-overlay .pc-name .zi{font-size:11px;color:var(--ink-faint);}',
'#tm-zhi-overlay .pc-name .age{font-size:10.5px;color:var(--ink-faint);margin-left:auto;}',
'#tm-zhi-overlay .pc-off{font-size:11.5px;color:var(--ink-soft);margin:2px 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
'#tm-zhi-overlay .pc-off .rk{color:var(--gold-d);}',
'#tm-zhi-overlay .pc-bars{display:flex;gap:7px;margin-bottom:4px;}',
'#tm-zhi-overlay .pc-bar{flex:1;display:flex;align-items:center;gap:3px;font-size:10px;color:var(--ink-faint);}',
'#tm-zhi-overlay .pc-bar i{flex:1;height:3px;border-radius:2px;background:rgba(120,90,40,0.16);overflow:hidden;}',
'#tm-zhi-overlay .pc-bar i::after{content:"";display:block;height:100%;width:var(--v,0%);background:linear-gradient(90deg,var(--gold-d),var(--gold-hi));border-radius:2px;}',
'#tm-zhi-overlay .pc-tags{display:flex;flex-wrap:wrap;gap:4px;}',
'#tm-zhi-overlay .ptag{font-size:10px;padding:1px 6px;border-radius:8px;border:1px solid rgba(168,131,58,0.3);background:rgba(255,252,242,0.6);color:var(--ink-soft);}',
'#tm-zhi-overlay .ptag.st{border-color:rgba(168,50,40,0.34);color:var(--cinnabar-d);background:rgba(168,50,40,0.06);}',
'#tm-zhi-overlay .ptag.jail{border-color:var(--cinnabar-d);color:#fff;background:linear-gradient(150deg,var(--cinnabar),var(--cinnabar-d));font-weight:bold;}',
'#tm-zhi-overlay .ptag.fac{border-color:rgba(74,94,138,0.34);color:var(--indigo);background:rgba(74,94,138,0.07);}',
'#tm-zhi-overlay .pc-loy{position:absolute;right:8px;top:8px;width:30px;height:30px;}',
'#tm-zhi-overlay .pcard.pinned{border-color:var(--gold);box-shadow:-2px 0 0 var(--gold-hi),0 2px 8px rgba(120,90,40,0.12);}',
'#tm-zhi-overlay .pc-star{color:var(--gold-d);font-size:12px;margin-right:2px;}',
'#tm-zhi-overlay .panel.main{background:linear-gradient(180deg,rgba(255,253,247,0.2),transparent);}',
'#tm-zhi-overlay .main-scroll{flex:1;overflow-y:auto;}',
'#tm-zhi-overlay .dossier-head{position:relative;display:flex;gap:18px;padding:18px 22px 16px;border-bottom:1px solid rgba(168,131,58,0.2);background:linear-gradient(180deg,rgba(246,239,218,0.7),transparent);}',
'#tm-zhi-overlay .dh-mountwrap{display:flex;gap:4px;}',
'#tm-zhi-overlay .dh-mount{flex:0 0 auto;width:118px;position:relative;}',
'#tm-zhi-overlay .dh-mount::before{content:"";position:absolute;left:-5px;right:-5px;top:-8px;height:5px;border-radius:3px;background:linear-gradient(180deg,var(--gold-d),var(--gold-hi));box-shadow:0 1px 3px rgba(120,90,40,0.34);}',
'#tm-zhi-overlay .dh-portrait{width:118px;height:150px;border-radius:5px;overflow:hidden;position:relative;background:linear-gradient(165deg,#efe3c4,#d8c397);display:grid;place-items:center;box-shadow:0 5px 16px rgba(120,90,40,0.3),0 0 0 5px rgba(252,247,236,0.85) inset,0 0 0 6px rgba(125,94,34,0.42),0 0 0 10px rgba(168,131,58,0.2),0 0 0 11px rgba(125,94,34,0.3);}',
'#tm-zhi-overlay .dh-portrait .glyph{font-size:56px;font-weight:bold;color:var(--ink-soft);opacity:0.8;}',
'#tm-zhi-overlay .dh-portrait img{width:100%;height:100%;object-fit:cover;}',
'#tm-zhi-overlay .dh-seal-on{position:absolute;right:3px;bottom:3px;width:24px;height:24px;z-index:2;}',
'#tm-zhi-overlay .dh-mount-cap{text-align:center;font-size:11px;color:var(--ink-faint);letter-spacing:0.2em;margin-top:7px;}',
'#tm-zhi-overlay .dh-colophon{writing-mode:vertical-rl;text-orientation:upright;font-family:var(--zfont-doc);font-size:11.5px;letter-spacing:0.18em;color:var(--ink-faint);height:150px;line-height:1.5;max-height:150px;overflow:hidden;border-left:1px solid rgba(168,131,58,0.2);padding-left:3px;}',
'#tm-zhi-overlay .dh-info{flex:1;min-width:0;}',
'#tm-zhi-overlay .dh-titleline{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}',
'#tm-zhi-overlay .dh-titleline h2{font-size:26px;letter-spacing:0.1em;color:var(--ink);}',
'#tm-zhi-overlay .dh-titleline .zi{font-size:13px;color:var(--ink-soft);}',
'#tm-zhi-overlay .dh-titleline .age{font-size:12px;color:var(--ink-faint);}',
'#tm-zhi-overlay .seal-mark{flex:0 0 auto;width:36px;height:36px;}',
'#tm-zhi-overlay .seal-mark svg{display:block;width:100%;height:100%;transform:rotate(-2deg);}',
'#tm-zhi-overlay .dh-seal-on .seal-mark{width:24px;height:24px;}',
'#tm-zhi-overlay .dh-seal-on .seal-mark svg{transform:rotate(4deg);}',
'#tm-zhi-overlay .dh-pills{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;}',
'#tm-zhi-overlay .dh-pill{font-size:12px;padding:3px 11px;border-radius:11px;border:1px solid rgba(168,131,58,0.34);background:rgba(255,252,242,0.65);color:var(--ink-soft);}',
'#tm-zhi-overlay .dh-pill.fac{border-color:rgba(74,94,138,0.4);color:var(--indigo);background:rgba(74,94,138,0.08);}',
'#tm-zhi-overlay .dh-pill.rank{border-color:var(--gold-d);color:var(--gold-d);background:rgba(168,131,58,0.1);}',
'#tm-zhi-overlay .situation{display:flex;align-items:center;gap:9px;margin:9px 0 2px;padding:7px 13px;border-radius:7px;font-size:12px;letter-spacing:0.08em;}',
'#tm-zhi-overlay .situation .sg{flex:0 0 auto;width:24px;height:24px;border-radius:5px;display:grid;place-items:center;font-size:13px;font-weight:bold;color:#fff;}',
'#tm-zhi-overlay .situation .stx b{font-size:12.5px;}#tm-zhi-overlay .situation .stx span{font-size:11.5px;opacity:0.85;margin-left:6px;}',
'#tm-zhi-overlay .situation.imprison{background:linear-gradient(100deg,rgba(122,32,24,0.12),rgba(122,32,24,0.03));border:1px solid rgba(122,32,24,0.3);color:var(--cinnabar-d);}',
'#tm-zhi-overlay .situation.imprison .sg{background:linear-gradient(150deg,var(--cinnabar-hi),var(--cinnabar-d));}',
'#tm-zhi-overlay .situation.exile{background:linear-gradient(100deg,rgba(142,106,168,0.12),rgba(142,106,168,0.03));border:1px solid rgba(142,106,168,0.3);color:var(--purple);}',
'#tm-zhi-overlay .situation.exile .sg{background:linear-gradient(150deg,#a98ac4,#6f4f8a);}',
'#tm-zhi-overlay .situation.travel{background:linear-gradient(100deg,rgba(168,131,58,0.13),rgba(168,131,58,0.03));border:1px solid rgba(168,131,58,0.3);color:var(--gold-d);}',
'#tm-zhi-overlay .situation.travel .sg{background:linear-gradient(150deg,var(--gold-hi),var(--gold-d));}',
'#tm-zhi-overlay .situation.dead{background:linear-gradient(100deg,rgba(120,90,40,0.1),transparent);border:1px solid rgba(120,90,40,0.26);color:var(--ink-soft);}',
'#tm-zhi-overlay .situation.dead .sg{background:linear-gradient(150deg,#9c8b6b,#6b5d44);}',
'#tm-zhi-overlay .situation.scheme{background:linear-gradient(100deg,rgba(36,24,14,0.1),transparent);border:1px solid rgba(36,24,14,0.26);color:var(--ink);}',
'#tm-zhi-overlay .situation.scheme .sg{background:linear-gradient(150deg,#574733,#241d15);}',
'#tm-zhi-overlay .dh-hearts{display:flex;gap:18px;margin:10px 0 2px;}',
'#tm-zhi-overlay .dh-heart{text-align:center;}',
'#tm-zhi-overlay .dh-heart b{display:block;font-size:21px;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1.1;}',
'#tm-zhi-overlay .dh-heart.warn b{color:var(--cinnabar-d);}',
'#tm-zhi-overlay .dh-heart span{font-size:11px;color:var(--ink-faint);letter-spacing:0.1em;}',
'#tm-zhi-overlay .dh-acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}',
'#tm-zhi-overlay .dact{font-family:var(--zfont);font-size:12px;cursor:pointer;padding:7px 16px;border-radius:8px;border:1px solid rgba(168,131,58,0.36);background:rgba(255,252,243,0.6);color:var(--ink-soft);transition:all .15s;}',
'#tm-zhi-overlay .dact:hover{background:#fffdf6;border-color:var(--gold);transform:translateY(-1px);}',
'#tm-zhi-overlay .dact.primary{border-color:var(--cinnabar-d);color:#fff;background:linear-gradient(155deg,var(--cinnabar-hi),var(--cinnabar-d));}',
'#tm-zhi-overlay .dact:active{transform:scale(0.97);}',
'#tm-zhi-overlay .dact.danger{border-color:rgba(168,50,40,0.5);color:#a83228;background:rgba(255,247,244,0.7);}',
'#tm-zhi-overlay .dact.danger:hover{background:#fff0ec;border-color:#a83228;color:#8a241b;}',
'#tm-zhi-overlay .dh-loy{position:absolute;right:22px;top:18px;width:74px;height:74px;text-align:center;}',
'#tm-zhi-overlay .dh-loy .lbl{font-size:11px;color:var(--ink-faint);letter-spacing:0.2em;margin-top:1px;}',
'#tm-zhi-overlay .verdict{margin:13px 22px 4px;padding:11px 15px 11px 16px;border-radius:7px;position:relative;border:1px solid rgba(184,58,43,0.26);background:linear-gradient(180deg,rgba(184,58,43,0.05),rgba(184,58,43,0.02));}',
'#tm-zhi-overlay .verdict::before{content:"御 览";position:absolute;left:-1px;top:-10px;font-size:11px;letter-spacing:0.1em;color:#fff;background:linear-gradient(150deg,var(--vermilion),var(--cinnabar-d));padding:2px 8px;border-radius:4px;}',
'#tm-zhi-overlay .verdict p{font-family:var(--zfont);font-size:13.5px;line-height:1.75;color:var(--vermilion);}',
'#tm-zhi-overlay .tabs{display:flex;gap:2px;padding:11px 22px 0;border-bottom:1px solid rgba(168,131,58,0.22);overflow-x:auto;}',
'#tm-zhi-overlay .tab{font-family:var(--zfont);font-size:13px;letter-spacing:0.08em;cursor:pointer;padding:8px 15px 9px;border:1px solid transparent;border-bottom:none;border-radius:8px 8px 0 0;color:var(--ink-faint);background:transparent;white-space:nowrap;transition:all .14s;position:relative;top:1px;}',
'#tm-zhi-overlay .tab:hover{color:var(--ink-soft);background:rgba(168,131,58,0.06);}',
'#tm-zhi-overlay .tab.active{color:var(--cinnabar-d);background:var(--paper);border-color:rgba(168,131,58,0.28);}',
'#tm-zhi-overlay .detail{padding:16px 22px 30px;}',
'#tm-zhi-overlay .detail>*{animation:zy-leaf .3s ease-out both;}',
'#tm-zhi-overlay .dgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}',
'#tm-zhi-overlay .sec{border:1px solid rgba(168,131,58,0.22);border-radius:9px;background:linear-gradient(170deg,rgba(255,253,247,0.65),rgba(246,239,218,0.3));padding:13px 15px;margin-bottom:14px;position:relative;}',
'#tm-zhi-overlay .sec.full{grid-column:1/-1;}',
'#tm-zhi-overlay .sec-t{font-size:13px;letter-spacing:0.12em;color:var(--ink);font-weight:bold;margin-bottom:10px;display:flex;align-items:center;gap:7px;}',
'#tm-zhi-overlay .sec-t::before{content:"";width:13px;height:13px;border-radius:3px;background:linear-gradient(150deg,var(--gold-hi),var(--gold-d));transform:rotate(-4deg);}',
'#tm-zhi-overlay .sec-t small{font-weight:normal;color:var(--ink-faint);font-size:11px;letter-spacing:0.04em;margin-left:auto;}',
'#tm-zhi-overlay .mingpan-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
'#tm-zhi-overlay .mingpan{text-align:center;}',
'#tm-zhi-overlay .mingpan svg{width:100%;height:auto;max-width:248px;display:block;margin:0 auto;}',
'#tm-zhi-overlay .radar-svg{animation:zy-radarIn .55s cubic-bezier(.2,.7,.3,1) both;transform-origin:center;}',
'#tm-zhi-overlay .mingpan .cap{font-size:12px;letter-spacing:0.16em;color:var(--ink-soft);margin-top:2px;}',
'#tm-zhi-overlay .bars{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;}',
'#tm-zhi-overlay .bar{font-size:12px;color:var(--ink-soft);}',
'#tm-zhi-overlay .bar .k{display:flex;justify-content:space-between;margin-bottom:2px;}',
'#tm-zhi-overlay .bar .k b{color:var(--ink);font-variant-numeric:tabular-nums;}',
'#tm-zhi-overlay .bar .track{height:5px;border-radius:3px;background:rgba(120,90,40,0.13);overflow:hidden;}',
'#tm-zhi-overlay .bar .fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--c1,var(--gold-d)),var(--c2,var(--gold-hi)));}',
'#tm-zhi-overlay .idgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}',
'#tm-zhi-overlay .idcell{padding:7px 9px;border-radius:7px;background:rgba(255,252,242,0.55);border:1px solid rgba(168,131,58,0.16);}',
'#tm-zhi-overlay .idcell span{display:block;font-size:10.5px;color:var(--ink-faint);letter-spacing:0.06em;margin-bottom:2px;}',
'#tm-zhi-overlay .idcell b{font-size:12.5px;color:var(--ink);font-weight:normal;}',
'#tm-zhi-overlay .idcell.two{grid-column:span 2;}',
'#tm-zhi-overlay .dual{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}',
'#tm-zhi-overlay .dualbox{padding:10px 12px;border-radius:8px;background:rgba(255,252,242,0.6);border-left:3px solid var(--dc,var(--gold-d));}',
'#tm-zhi-overlay .dualbox .lb{font-size:11px;letter-spacing:0.16em;color:var(--dc,var(--gold-d));margin-bottom:5px;}',
'#tm-zhi-overlay .dualbox .v{font-size:13px;color:var(--ink);margin-bottom:3px;}',
'#tm-zhi-overlay .dualbox .s{font-size:12px;color:var(--ink-soft);line-height:1.6;}',
'#tm-zhi-overlay .prose{font-family:var(--zfont-doc);font-size:13px;line-height:1.95;color:var(--ink-soft);text-align:justify;}',
'#tm-zhi-overlay .prose.indent{text-indent:2em;}',
'#tm-zhi-overlay .prose-paper{padding:12px 15px;border-radius:7px;background:repeating-linear-gradient(0deg,transparent 0 calc(1.95em - 1px),var(--rule-ink) calc(1.95em - 1px) 1.95em),rgba(255,253,247,0.5);border:1px solid rgba(168,131,58,0.16);}',
'#tm-zhi-overlay .traits{display:flex;flex-wrap:wrap;gap:6px;}',
'#tm-zhi-overlay .trait{font-size:12px;padding:3px 11px;border-radius:11px;border:1px solid rgba(168,131,58,0.3);background:rgba(255,252,242,0.6);color:var(--ink-soft);}',
'#tm-zhi-overlay .trait.pos{border-color:rgba(111,162,145,0.4);color:var(--jade-d);background:rgba(111,162,145,0.08);}',
'#tm-zhi-overlay .trait.neg{border-color:rgba(168,50,40,0.36);color:var(--cinnabar-d);background:rgba(168,50,40,0.06);}',
'#tm-zhi-overlay .rows{display:flex;flex-direction:column;}',
'#tm-zhi-overlay .row{display:flex;justify-content:space-between;align-items:baseline;padding:5px 2px;border-bottom:1px dashed rgba(168,131,58,0.2);font-size:12px;}',
'#tm-zhi-overlay .row:last-child{border-bottom:none;}',
'#tm-zhi-overlay .row .k{color:var(--ink-faint);}',
'#tm-zhi-overlay .row .v{color:var(--ink);text-align:right;max-width:64%;}',
'#tm-zhi-overlay .row .v.link{color:var(--indigo);cursor:pointer;}',
'#tm-zhi-overlay .stub{text-align:center;color:var(--ink-faint);padding:40px 10px;font-size:13px;line-height:1.9;}',
'#tm-zhi-overlay .folio-scroll{flex:1;overflow-y:auto;padding:11px 13px 20px;}',
'#tm-zhi-overlay .fcard{border:1px solid rgba(168,131,58,0.2);border-radius:9px;background:linear-gradient(170deg,rgba(255,253,247,0.7),rgba(246,239,218,0.3));padding:11px 13px;margin-bottom:11px;}',
'#tm-zhi-overlay .fcard>.ft{font-size:11.5px;letter-spacing:0.1em;color:var(--ink-soft);font-weight:bold;margin-bottom:8px;display:flex;align-items:center;gap:6px;}',
'#tm-zhi-overlay .fcard>.ft::before{content:"";width:4px;height:13px;border-radius:2px;background:var(--gold-d);}',
'#tm-zhi-overlay .actgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}',
'#tm-zhi-overlay .actgrid .span{grid-column:1/-1;}',
'#tm-zhi-overlay .fact{font-family:var(--zfont);font-size:11.5px;cursor:pointer;padding:8px 6px;border-radius:7px;border:1px solid rgba(168,131,58,0.32);background:rgba(255,252,243,0.6);color:var(--ink-soft);transition:all .14s;text-align:center;}',
'#tm-zhi-overlay .fact:hover{background:#fffdf6;border-color:var(--gold);}',
'#tm-zhi-overlay .fact.primary{border-color:var(--cinnabar-d);color:#fff;background:linear-gradient(155deg,var(--cinnabar-hi),var(--cinnabar-d));}',
'#tm-zhi-overlay .fnote{font-size:11.5px;color:var(--ink-faint);line-height:1.6;margin-top:8px;}',
'#tm-zhi-overlay .risk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}',
'#tm-zhi-overlay .risk{text-align:center;padding:6px 2px;border-radius:6px;background:rgba(255,252,242,0.5);}',
'#tm-zhi-overlay .risk span{display:block;font-size:10px;color:var(--ink-faint);}',
'#tm-zhi-overlay .risk b{font-size:16px;color:var(--ink);font-variant-numeric:tabular-nums;}',
'#tm-zhi-overlay .relnet{display:flex;flex-direction:column;gap:6px;}',
'#tm-zhi-overlay .relrow{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:7px;background:rgba(255,252,242,0.55);border:1px solid rgba(168,131,58,0.16);cursor:pointer;}',
'#tm-zhi-overlay .relrow:hover{border-color:var(--gold);}',
'#tm-zhi-overlay .relrow .nm{font-size:12.5px;color:var(--ink);min-width:56px;}',
'#tm-zhi-overlay .relrow .lbl{font-size:11.5px;padding:1px 8px;border-radius:8px;}',
'#tm-zhi-overlay .relrow .lbl.good{color:var(--jade-d);background:rgba(111,162,145,0.13);}',
'#tm-zhi-overlay .relrow .lbl.bad{color:var(--cinnabar-d);background:rgba(168,50,40,0.08);}',
'#tm-zhi-overlay .relrow .lbl.neu{color:var(--ink-soft);background:rgba(168,131,58,0.1);}',
'#tm-zhi-overlay .relrow .sc{font-size:11px;color:var(--ink-faint);font-variant-numeric:tabular-nums;margin-left:auto;}',
'#tm-zhi-overlay .wcrow{display:flex;gap:8px;align-items:center;}',
'#tm-zhi-overlay .wcdot{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:13px;border:1px solid;position:relative;}',
'#tm-zhi-overlay .wcdot small{position:absolute;bottom:-13px;font-size:9px;color:var(--ink-faint);font-variant-numeric:tabular-nums;}',
'#tm-zhi-overlay .wcdot.hi{background:rgba(111,162,145,0.16);border-color:var(--jade);color:var(--jade-d);}',
'#tm-zhi-overlay .wcdot.mid{background:rgba(168,131,58,0.12);border-color:var(--gold);color:var(--gold-d);}',
'#tm-zhi-overlay .wcdot.lo{background:rgba(168,50,40,0.08);border-color:rgba(168,50,40,0.34);color:var(--cinnabar-d);}',
'#tm-zhi-overlay .opinion{padding:11px 14px;border-radius:7px;border-left:3px solid var(--cinnabar);background:linear-gradient(180deg,rgba(184,58,43,0.05),transparent);}',
'#tm-zhi-overlay .opinion .big{font-size:26px;color:var(--cinnabar-d);font-variant-numeric:tabular-nums;}',
'#tm-zhi-overlay .opinion .brk{font-size:12px;color:var(--ink-faint);}',
'#tm-zhi-overlay .egonet svg{width:100%;height:auto;display:block;}',
'#tm-zhi-overlay .egonode{cursor:pointer;}',
'#tm-zhi-overlay .egonode:hover rect{stroke-width:2;}',
'#tm-zhi-overlay .egolegend{display:flex;gap:16px;justify-content:center;margin-top:6px;font-size:11.5px;color:var(--ink-faint);flex-wrap:wrap;}',
'#tm-zhi-overlay .egolegend span{display:inline-flex;align-items:center;gap:5px;}',
'#tm-zhi-overlay .egolegend i{width:14px;height:0;border-top-width:2px;border-top-style:solid;display:inline-block;}',
'#tm-zhi-overlay .relrow .meter{flex:1;height:4px;border-radius:2px;background:rgba(120,90,40,0.14);overflow:hidden;position:relative;}',
'#tm-zhi-overlay .relrow .meter i{position:absolute;top:0;bottom:0;left:50%;width:1px;background:rgba(120,90,40,0.3);}',
'#tm-zhi-overlay .relrow .meter b{position:absolute;top:0;bottom:0;border-radius:2px;}',
'#tm-zhi-overlay .tl{position:relative;padding-left:18px;}',
'#tm-zhi-overlay .tl::before{content:"";position:absolute;left:5px;top:4px;bottom:4px;width:2px;background:linear-gradient(180deg,var(--gold-d),rgba(120,90,40,0.15));}',
'#tm-zhi-overlay .tlrow{position:relative;padding:0 0 11px 8px;}',
'#tm-zhi-overlay .tlrow::before{content:"";position:absolute;left:-15px;top:4px;width:9px;height:9px;border-radius:50%;background:#fff;border:2px solid var(--gold-d);}',
'#tm-zhi-overlay .tlrow.key::before{background:linear-gradient(150deg,var(--cinnabar-hi),var(--cinnabar-d));border-color:var(--cinnabar-d);box-shadow:0 0 0 3px rgba(168,50,40,0.14);}',
'#tm-zhi-overlay .tlrow .yr{font-size:11px;color:var(--gold-d);font-variant-numeric:tabular-nums;}',
'#tm-zhi-overlay .tlrow .ti{font-size:12.5px;color:var(--ink);margin:1px 0;}',
'#tm-zhi-overlay .tlrow .ds{font-size:12px;color:var(--ink-soft);line-height:1.6;}',
'#tm-zhi-overlay .domains{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px;}',
'#tm-zhi-overlay .dom{font-size:11.5px;padding:2px 9px;border-radius:9px;background:rgba(168,131,58,0.1);color:var(--ink-soft);border:1px solid rgba(168,131,58,0.2);}',
'#tm-zhi-overlay .dom b{color:var(--cinnabar-d);font-variant-numeric:tabular-nums;}',
'#tm-zhi-overlay .mems{display:flex;flex-direction:column;gap:1px;}',
'#tm-zhi-overlay .mem{display:flex;gap:8px;padding:6px 4px;border-bottom:1px solid rgba(168,131,58,0.13);font-size:12px;}',
'#tm-zhi-overlay .mem .t{font-size:11px;color:var(--ink-faint);font-variant-numeric:tabular-nums;flex:0 0 auto;}',
'#tm-zhi-overlay .mem .ev{color:var(--ink-soft);line-height:1.55;}',
'#tm-zhi-overlay .mem .who{color:var(--indigo);font-size:11px;}',
'#tm-zhi-overlay .archive-toggle{font-size:12px;color:var(--gold-d);cursor:pointer;padding:6px 4px;}',
'#tm-zhi-overlay .archive-toggle:hover{color:var(--cinnabar-d);}',
'#tm-zhi-overlay .works{display:flex;flex-direction:column;gap:7px;}',
'#tm-zhi-overlay .work{padding:8px 11px;border-radius:7px;background:rgba(255,252,242,0.6);border:1px solid rgba(168,131,58,0.18);border-left:3px solid var(--gold-d);cursor:pointer;transition:all .14s;}',
'#tm-zhi-overlay .work:hover{border-left-color:var(--cinnabar);transform:translateX(2px);}',
'#tm-zhi-overlay .work .ti{font-size:12.5px;color:var(--ink);}',
'#tm-zhi-overlay .work .ti .star{color:var(--gold-d);}',
'#tm-zhi-overlay .work .mt{font-size:11px;color:var(--ink-faint);margin-top:2px;}',
'#tm-zhi-overlay .fttitle small{font-size:11px;color:var(--ink-faint);letter-spacing:0.04em;}',
'#tm-zhi-overlay .ft-wrap{margin:4px -4px 0;overflow-x:auto;}',
'#tm-zhi-overlay .ft-svg{width:100%;min-width:560px;height:auto;display:block;}',
'#tm-zhi-overlay .ft-legend{display:flex;gap:16px;justify-content:center;margin-top:8px;font-size:11.5px;color:var(--ink-faint);}',
'#tm-zhi-overlay .ft-lg{display:inline-flex;align-items:center;gap:5px;}',
'#tm-zhi-overlay .ft-mk{width:13px;height:11px;border-radius:2px;display:inline-block;}',
'#tm-zhi-overlay .ft-mk.self{background:rgba(168,131,58,0.16);border:1.5px solid var(--gold);}',
'#tm-zhi-overlay .ft-mk.blood{background:rgba(255,253,243,0.6);border:1px solid var(--gold-d);}',
'#tm-zhi-overlay .ft-mk.inlaw{background:rgba(111,162,145,0.08);border:1px dashed var(--jade);}',
'#tm-zhi-overlay .ft-mk.dead{background:rgba(120,90,40,0.1);border:1px solid var(--ink-faint);}',
'#tm-zhi-overlay .clan-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:4px;}',
'#tm-zhi-overlay .clan-it{text-align:center;padding:9px 4px;border-radius:8px;background:rgba(255,252,242,0.5);border:1px solid rgba(168,131,58,0.16);}',
'#tm-zhi-overlay .clan-it .lb{font-size:10.5px;color:var(--ink-faint);letter-spacing:0.1em;margin-bottom:4px;}',
'#tm-zhi-overlay .clan-it .vv{font-size:18px;color:var(--ink);font-variant-numeric:tabular-nums;}',
'#tm-zhi-overlay .clan-it .track{height:4px;border-radius:2px;background:rgba(120,90,40,0.13);margin-top:5px;overflow:hidden;}',
'#tm-zhi-overlay .clan-it .track i{display:block;height:100%;background:linear-gradient(90deg,var(--gold-d),var(--gold-hi));}',
'#tm-zhi-overlay .pov-lead{font-family:var(--zfont-doc);font-size:14px;line-height:1.9;color:var(--ink);text-align:justify;padding:12px 16px;border-radius:7px;background:repeating-linear-gradient(0deg,transparent 0 calc(1.9em - 1px),var(--rule-ink) calc(1.9em - 1px) 1.9em),rgba(255,253,247,0.5);border:1px solid rgba(168,131,58,0.18);border-left:3px solid var(--purple);}',
'#tm-zhi-overlay .pov-lead .me{color:var(--purple);font-weight:bold;}',
'#tm-zhi-overlay .pov-eye{display:flex;flex-direction:column;gap:7px;}',
'#tm-zhi-overlay .pov-row{display:flex;align-items:flex-start;gap:9px;padding:8px 10px;border-radius:7px;background:rgba(255,252,242,0.55);border:1px solid rgba(168,131,58,0.16);cursor:pointer;}',
'#tm-zhi-overlay .pov-row:hover{border-color:var(--gold);}',
'#tm-zhi-overlay .pov-row .who{flex:0 0 auto;font-size:13px;color:var(--ink);min-width:52px;}',
'#tm-zhi-overlay .pov-row .say{flex:1;font-family:var(--zfont-doc);font-size:12.5px;line-height:1.6;color:var(--ink-soft);font-style:italic;}',
'#tm-zhi-overlay .pov-row .say.good{color:var(--jade-d);}',
'#tm-zhi-overlay .pov-row .say.bad{color:var(--cinnabar-d);}',
'#tm-zhi-overlay .chaoju,#tm-zhi-overlay .paihang{padding:16px 22px 30px;}',
'#tm-zhi-overlay .dongtai{padding:16px 22px 30px;}',
'#tm-zhi-overlay .dt-ctrl{display:flex;align-items:center;gap:5px;margin-bottom:12px;flex-wrap:wrap;}',
'#tm-zhi-overlay .dt-ctrl .lb{font-size:12px;color:var(--ink-faint);}',
'#tm-zhi-overlay .dt-group{margin-bottom:16px;}',
'#tm-zhi-overlay .dt-turn{font-family:var(--zfont);font-size:13px;color:var(--cinnabar-d);letter-spacing:0.08em;margin-bottom:7px;border-bottom:1px solid rgba(168,131,58,0.2);padding-bottom:4px;}',
'#tm-zhi-overlay .dt-turn small{color:var(--ink-faint);font-size:11px;margin-left:6px;}',
'#tm-zhi-overlay .dt-item{padding:8px 11px;margin-bottom:6px;border-radius:8px;background:rgba(255,252,243,0.6);border-left:3px solid #9c8b6b;}',
'#tm-zhi-overlay .dt-item.h{border-left-color:#a83228;background:rgba(168,50,40,0.05);}',
'#tm-zhi-overlay .dt-item.f{border-left-color:#557f6f;background:rgba(85,127,111,0.05);}',
'#tm-zhi-overlay .dt-head{font-size:13.5px;color:var(--ink);line-height:1.5;}',
'#tm-zhi-overlay .dt-actor{color:var(--cinnabar-d);cursor:pointer;}',
'#tm-zhi-overlay .dt-actor:hover{text-decoration:underline;}',
'#tm-zhi-overlay .dt-verb{font-size:12px;padding:1px 7px;border-radius:10px;background:rgba(156,139,107,0.18);color:var(--ink-soft);}',
'#tm-zhi-overlay .dt-verb.h{background:rgba(168,50,40,0.14);color:#a83228;}',
'#tm-zhi-overlay .dt-verb.f{background:rgba(85,127,111,0.16);color:#557f6f;}',
'#tm-zhi-overlay .dt-arrow{color:var(--ink-faint);}',
'#tm-zhi-overlay .dt-tgt{color:var(--ink-soft);}',
'#tm-zhi-overlay .dt-say{font-size:12.5px;color:var(--ink-soft);margin-top:3px;}',
'#tm-zhi-overlay .dt-inner{font-size:12px;color:var(--ink-faint);font-style:italic;margin-top:2px;}',
'#tm-zhi-overlay .nian{padding:16px 22px 30px;}',
'#tm-zhi-overlay .ni-item{padding:10px 13px;margin-bottom:9px;border-radius:8px;background:rgba(255,252,243,0.6);border-left:3px solid #9c8b6b;}',
'#tm-zhi-overlay .ni-item.success{border-left-color:#7a1f1a;background:rgba(122,31,26,0.07);}',
'#tm-zhi-overlay .ni-item.foiled{border-left-color:#557f6f;background:rgba(85,127,111,0.04);}',
'#tm-zhi-overlay .ni-head{font-size:13.5px;color:var(--ink);line-height:1.55;display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;}',
'#tm-zhi-overlay .ni-turn{font-family:var(--zfont);font-size:11.5px;color:var(--cinnabar-d);min-width:46px;}',
'#tm-zhi-overlay .ni-act{font-size:12.5px;font-weight:700;padding:1px 8px;border-radius:10px;background:rgba(156,139,107,0.18);color:var(--ink-soft);}',
'#tm-zhi-overlay .ni-act.success{background:rgba(122,31,26,0.14);color:#7a1f1a;}',
'#tm-zhi-overlay .ni-act.foiled{background:rgba(85,127,111,0.16);color:#557f6f;}',
'#tm-zhi-overlay .ni-actor{color:var(--cinnabar-d);cursor:pointer;font-weight:600;}',
'#tm-zhi-overlay .ni-actor:hover{text-decoration:underline;}',
'#tm-zhi-overlay .ni-arrow{color:var(--ink-faint);}',
'#tm-zhi-overlay .ni-tgt{color:var(--ink-soft);}',
'#tm-zhi-overlay .ni-meta{font-size:12px;color:var(--ink-soft);margin-top:4px;}',
'#tm-zhi-overlay .ni-conspir{font-size:12px;color:var(--ink-faint);margin-top:3px;}',
'#tm-zhi-overlay .ni-conspir b{color:var(--ink-soft);cursor:pointer;font-weight:500;}',
'#tm-zhi-overlay .ni-conspir b:hover{text-decoration:underline;}',
'#tm-zhi-overlay .ni-gate{font-size:11px;color:#7a1f1a;background:rgba(122,31,26,0.08);padding:1px 6px;border-radius:6px;margin-left:6px;}',
'#tm-zhi-overlay .ni-reason{font-size:12px;color:var(--ink-faint);font-style:italic;margin-top:3px;}',
'#tm-zhi-overlay .chaoju-graph svg{width:100%;height:auto;display:block;}',
'#tm-zhi-overlay .cnode{cursor:pointer;}',
'#tm-zhi-overlay .cj-balance{margin-bottom:14px;padding:11px 15px;border-radius:9px;background:linear-gradient(170deg,rgba(255,253,247,0.7),rgba(246,239,218,0.3));border:1px solid rgba(168,131,58,0.22);}',
'#tm-zhi-overlay .cj-balance .bt{font-size:11.5px;color:var(--ink-soft);letter-spacing:0.1em;margin-bottom:7px;}',
'#tm-zhi-overlay .cj-bar{height:18px;border-radius:9px;overflow:hidden;display:flex;border:1px solid rgba(168,131,58,0.3);}',
'#tm-zhi-overlay .cj-bar span{height:100%;display:flex;align-items:center;justify-content:center;font-size:10.5px;color:#fff;white-space:nowrap;overflow:hidden;text-shadow:0 1px 1px rgba(0,0,0,0.3);}',
'#tm-zhi-overlay .cj-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-top:14px;}',
'#tm-zhi-overlay .cj-card{border:1px solid rgba(168,131,58,0.22);border-top:3px solid var(--fc,var(--gold));border-radius:9px;background:linear-gradient(170deg,rgba(255,253,247,0.7),rgba(246,239,218,0.3));padding:11px 13px;}',
'#tm-zhi-overlay .cj-card .ct{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px;}',
'#tm-zhi-overlay .cj-card .ct b{font-size:14px;letter-spacing:0.1em;color:var(--ink);}',
'#tm-zhi-overlay .cj-card .ct .pw{font-size:11px;color:var(--ink-faint);}',
'#tm-zhi-overlay .cj-members{display:flex;flex-wrap:wrap;gap:5px;}',
'#tm-zhi-overlay .cj-mem{font-size:12px;padding:2px 9px;border-radius:9px;border:1px solid rgba(168,131,58,0.26);background:rgba(255,252,242,0.6);color:var(--ink-soft);cursor:pointer;transition:all .14s;}',
'#tm-zhi-overlay .cj-mem:hover{border-color:var(--cinnabar);color:var(--cinnabar-d);transform:translateY(-1px);}',
'#tm-zhi-overlay .cj-mem.lead{border-color:var(--gold-d);color:var(--gold-d);font-weight:bold;background:rgba(168,131,58,0.12);}',
'#tm-zhi-overlay .cj-mem.dead{opacity:0.5;text-decoration:line-through;}',
'#tm-zhi-overlay .cj-legend{display:flex;gap:16px;justify-content:center;margin:8px 0 2px;font-size:11.5px;color:var(--ink-faint);flex-wrap:wrap;}',
'#tm-zhi-overlay .cj-legend i{width:16px;height:0;border-top-width:2px;border-top-style:solid;display:inline-block;vertical-align:middle;margin-right:5px;}',
'#tm-zhi-overlay .ph-ctrl{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px;align-items:center;}',
'#tm-zhi-overlay .ph-ctrl .lb{font-size:12px;color:var(--ink-faint);letter-spacing:0.06em;}',
'#tm-zhi-overlay .phb{font-family:var(--zfont);font-size:12px;cursor:pointer;padding:5px 12px;border-radius:7px;border:1px solid rgba(168,131,58,0.3);background:rgba(255,252,242,0.55);color:var(--ink-soft);transition:all .14s;}',
'#tm-zhi-overlay .phb:hover{border-color:var(--gold);}',
'#tm-zhi-overlay .phb.active{color:#fff;background:linear-gradient(150deg,var(--gold),var(--gold-d));border-color:var(--gold-d);}',
'#tm-zhi-overlay .ph-table{width:100%;border-collapse:collapse;font-size:12px;}',
'#tm-zhi-overlay .ph-table th{font-size:11.5px;color:var(--ink-faint);font-weight:normal;letter-spacing:0.06em;text-align:center;padding:7px 5px;border-bottom:1px solid rgba(168,131,58,0.3);}',
'#tm-zhi-overlay .ph-table td{padding:7px 5px;border-bottom:1px solid rgba(168,131,58,0.14);text-align:center;font-variant-numeric:tabular-nums;color:var(--ink);}',
'#tm-zhi-overlay .ph-table tbody tr{cursor:pointer;transition:background .12s;}',
'#tm-zhi-overlay .ph-table tbody tr:hover{background:rgba(168,131,58,0.09);}',
'#tm-zhi-overlay .ph-table tbody tr.dead{opacity:0.55;}',
'#tm-zhi-overlay .ph-rank{font-size:14px;color:var(--gold-d);font-weight:bold;width:32px;}',
'#tm-zhi-overlay .ph-rank.top{color:var(--cinnabar-d);}',
'#tm-zhi-overlay .ph-name{text-align:left;font-size:13px;white-space:nowrap;}',
'#tm-zhi-overlay .ph-name small{color:var(--ink-faint);font-size:11px;margin-left:5px;}',
'#tm-zhi-overlay .ph-pri b{color:var(--cinnabar-d);}',
'#tm-zhi-overlay .ph-pri .vb{display:inline-block;height:5px;border-radius:3px;background:linear-gradient(90deg,var(--gold-d),var(--gold-hi));vertical-align:middle;margin-left:6px;max-width:90px;}',
'#tm-zhi-overlay .pc-cmp{position:absolute;right:8px;bottom:8px;width:20px;height:20px;border-radius:5px;border:1px solid rgba(168,131,58,0.34);background:rgba(255,252,242,0.8);color:var(--gold-d);font-size:12px;display:grid;place-items:center;cursor:pointer;opacity:0;transition:all .14s;z-index:2;}',
'#tm-zhi-overlay .pcard:hover .pc-cmp{opacity:1;}',
'#tm-zhi-overlay .pc-cmp:hover{border-color:var(--cinnabar);color:var(--cinnabar-d);background:#fff;transform:scale(1.1);}',
'#tm-zhi-overlay .cmp-head{display:flex;align-items:center;justify-content:space-between;padding:14px 22px 12px;border-bottom:1px solid rgba(168,131,58,0.22);background:linear-gradient(180deg,rgba(246,239,218,0.7),transparent);}',
'#tm-zhi-overlay .cmp-head h2{font-size:19px;letter-spacing:0.14em;color:var(--ink);}',
'#tm-zhi-overlay .cmp-head h2 small{font-size:12px;color:var(--ink-faint);letter-spacing:0.04em;margin-left:8px;}',
'#tm-zhi-overlay .cmp-clear{font-family:var(--zfont);font-size:12px;cursor:pointer;padding:6px 14px;border-radius:8px;border:1px solid rgba(168,131,58,0.4);background:rgba(255,252,243,0.6);color:var(--ink-soft);}',
'#tm-zhi-overlay .cmp-clear:hover{border-color:var(--cinnabar);color:var(--cinnabar-d);}',
'#tm-zhi-overlay .cmp-body{padding:16px 22px 30px;animation:zy-pageTurn .42s ease-out both;}',
'#tm-zhi-overlay .cmp-people{display:grid;gap:14px;margin-bottom:14px;}',
'#tm-zhi-overlay .cmp-person{position:relative;display:flex;gap:12px;align-items:center;padding:11px 14px;border-radius:9px;border:1px solid rgba(168,131,58,0.3);background:linear-gradient(170deg,rgba(255,253,247,0.7),rgba(246,239,218,0.3));border-left-width:4px;}',
'#tm-zhi-overlay .cmp-face{width:46px;height:56px;flex:0 0 auto;border-radius:4px;background:linear-gradient(160deg,#efe3c4,#dcca9f);border:1px solid rgba(168,131,58,0.4);display:grid;place-items:center;font-size:22px;font-weight:bold;color:var(--ink-soft);overflow:hidden;}',
'#tm-zhi-overlay .cmp-face img{width:100%;height:100%;object-fit:cover;}',
'#tm-zhi-overlay .cmp-person .nm{font-size:16px;color:var(--ink);}',
'#tm-zhi-overlay .cmp-person .of{font-size:12px;color:var(--ink-soft);margin-top:2px;}',
'#tm-zhi-overlay .cmp-person .fa{font-size:11.5px;margin-top:3px;}',
'#tm-zhi-overlay .cmp-drop{position:absolute;right:7px;top:7px;width:18px;height:18px;border-radius:5px;border:1px solid rgba(168,131,58,0.34);background:rgba(255,252,242,0.85);color:var(--ink-faint);font-size:12px;display:grid;place-items:center;cursor:pointer;z-index:2;}',
'#tm-zhi-overlay .cmp-drop:hover{border-color:var(--cinnabar);color:var(--cinnabar-d);}',
'#tm-zhi-overlay .cmp-radar-wrap{display:flex;flex-direction:column;align-items:center;}',
'#tm-zhi-overlay .cmp-radar-wrap svg{max-width:300px;width:100%;}',
'#tm-zhi-overlay .cmp-verdict{margin-top:12px;padding:11px 15px;border-radius:7px;border-left:3px solid var(--gold-d);background:rgba(168,131,58,0.07);font-family:var(--zfont-doc);font-size:13px;line-height:1.8;color:var(--ink-soft);}',
'#tm-zhi-overlay .cmp-verdict b{font-family:var(--zfont);color:var(--gold-d);}',
'#tm-zhi-overlay .cmpbarN{display:grid;grid-template-columns:48px 1fr;align-items:center;gap:10px;margin-bottom:10px;font-size:12px;}',
'#tm-zhi-overlay .cmpbarN .lab{color:var(--ink-faint);text-align:right;}',
'#tm-zhi-overlay .cmpbarN .cells{display:flex;flex-direction:column;gap:3px;}',
'#tm-zhi-overlay .cwbar{display:flex;align-items:center;gap:6px;}',
'#tm-zhi-overlay .cwbar i{height:6px;border-radius:3px;min-width:2px;}',
'#tm-zhi-overlay .cwbar b{font-variant-numeric:tabular-nums;font-size:12px;width:26px;text-align:right;}',
'#tm-zhi-overlay .zhubi{margin:11px 22px 4px;padding:10px 15px 10px 16px;border-radius:7px;position:relative;border:1px solid rgba(184,58,43,0.3);background:linear-gradient(180deg,rgba(184,58,43,0.06),rgba(184,58,43,0.02));}',
'#tm-zhi-overlay .zhubi::before{content:"御 笔";position:absolute;left:-1px;top:-10px;font-size:11px;letter-spacing:0.1em;color:#fff;background:linear-gradient(150deg,var(--vermilion),var(--cinnabar-d));padding:2px 8px;border-radius:4px;}',
'#tm-zhi-overlay .zhubi .zb-txt{font-family:var(--zfont);font-size:13.5px;line-height:1.75;color:var(--vermilion);min-height:20px;}',
'#tm-zhi-overlay .zhubi .zb-txt.empty{color:var(--ink-faint);font-style:italic;}',
'#tm-zhi-overlay .zhubi .zb-edit{position:absolute;right:10px;top:8px;font-size:12px;color:var(--cinnabar-d);cursor:pointer;border:1px solid rgba(184,58,43,0.3);border-radius:6px;padding:2px 9px;background:rgba(255,252,243,0.7);}',
'#tm-zhi-overlay .zhubi .zb-edit:hover{background:var(--cinnabar);color:#fff;}',
'#tm-zhi-overlay .zhubi textarea{width:100%;font-family:var(--zfont);font-size:13px;color:var(--vermilion);background:rgba(255,253,247,0.8);border:1px solid rgba(184,58,43,0.3);border-radius:6px;padding:7px 9px;resize:vertical;min-height:54px;outline:none;line-height:1.7;}',
'#tm-zhi-overlay .zhubi .zb-acts{margin-top:7px;display:flex;gap:7px;justify-content:flex-end;}',
'#tm-zhi-overlay .zhubi .zb-acts button{font-family:var(--zfont);font-size:12px;cursor:pointer;padding:4px 12px;border-radius:6px;border:1px solid rgba(168,131,58,0.4);background:rgba(255,252,243,0.6);color:var(--ink-soft);}',
'#tm-zhi-overlay .zhubi .zb-acts button.save{border-color:var(--cinnabar-d);color:#fff;background:linear-gradient(150deg,var(--cinnabar-hi),var(--cinnabar-d));}',
'#tm-zhi-overlay ::-webkit-scrollbar{width:8px;height:8px;}',
'#tm-zhi-overlay ::-webkit-scrollbar-thumb{background:rgba(168,131,58,0.3);border-radius:4px;}',
'#tm-zhi-overlay ::-webkit-scrollbar-track{background:transparent;}',
'@media(prefers-reduced-motion:reduce){#tm-zhi-overlay,#tm-zhi-overlay *{animation:none!important;transition:none!important;}}'
].join('\n');

function installStyles(){
  if (document.getElementById('tm-zhi-styles')) return;
  var s = document.createElement('style'); s.id = 'tm-zhi-styles'; s.textContent = CSS;
  document.head.appendChild(s);
}

/* ===================== 工具 ===================== */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function clamp(v){return Math.max(0,Math.min(100,Number(v)||0));}
function num(v,d){return (v==null||isNaN(Number(v)))?d:Number(v);}
function _g(){return window.GM||{};}
function _p(){return window.P||{};}
function toast(m){ if(typeof window.toast==='function'&&window.toast!==toast){try{window.toast(m);return;}catch(e){}} var t=document.getElementById('tm-zhi-toast'); if(t){t.textContent=m;t.style.opacity='1';clearTimeout(t._t);t._t=setTimeout(function(){t.style.opacity='0';},1900);} }
var FACOLOR={'皇室':'#a8833a','阉党':'#8e6aa8','边镇':'#7a2018','清流':'#557f6f','东林':'#4a5e8a','后宫':'#c64a3e','无派系':'#9c8b6b'};
function facColor(f){return FACOLOR[f]||'#a8833a';}
function relWord(v){return v>=50?'莫逆':v>=25?'亲近':v<=-50?'死敌':v<=-25?'不睦':'一般';}
function imprWord(f){return f>=15?'感恩戴德':f>=8?'心存感激':f>=3?'略有好感':f<=-15?'恨之入骨':f<=-8?'怀恨在心':f<=-3?'心生不满':'无感';}
function relGen(rel){rel=String(rel||'');if(/祖/.test(rel))return -2;if(/父|母/.test(rel))return -1;if(/孙/.test(rel))return 2;if(/子|女|嗣|儿/.test(rel))return 1;return 0;}

/* ===================== 真数据适配器（接线图核心） ===================== */
function effAttr(c,k){try{return (typeof getEffectiveAttr==='function')?getEffectiveAttr(c,k):(c[k]||0);}catch(e){return c[k]||0;}}
function isConsort(c){try{return (typeof _tmIsPlayerConsort==='function')?!!_tmIsPlayerConsort(c):!!(c&&c.spouse===true);}catch(e){return !!(c&&c.spouse===true);}}
/* 品级真源=实职官衔(officialTitle∪title)经 TMPromotion.resolveRankLevel 拆段最长匹配派生取最高品·单一真相源·替代失效的 getRankLevel(官衔)+滞后 rankLevel 散阶 */
function _rankLabel(c){
  if(c.rank)return c.rank;
  var lv=null;
  // 权威:从实职复合串派生(拆段·officeTree名表+补充关键字·本官+加衔取最高)。18=从九品默认堆视为未解析不显。
  try{if(window.TMPromotion&&TMPromotion.resolveRankLevel){var r=TMPromotion.resolveRankLevel(c,_g());if(r!=null&&r>=1&&r<18)lv=r;}}catch(e){}
  // 兜底(引擎缺位):旧 getRankLevel(官衔串)→散阶
  if(lv==null){try{if(typeof getRankLevel==='function'){var g=getRankLevel(c.officialTitle||c.title);if(g!=null&&g>0&&g<18)lv=g;}}catch(e2){}}
  if(lv==null&&c.rankLevel!=null&&c.rankLevel<18)lv=c.rankLevel;
  if(lv==null)return '';
  try{if(typeof RANK_HIERARCHY!=='undefined'&&RANK_HIERARCHY){for(var i=0;i<RANK_HIERARCHY.length;i++)if(RANK_HIERARCHY[i].level===lv)return RANK_HIERARCHY[i].label;}}catch(e3){}
  return '';
}
/* 兼职头衔合并走既有 _zhiOfficeTitles 体系(office-system _offGetCharOfficeTitles 真源·已增强吸收 title 官职段)·此处不另造 */
/* 五常真源=c.wuchangOverride{仁义礼智信}·c.wuchang 在运行时恒空 */
function _wuchangOf(c){var w=c.wuchang;if(w&&typeof w==='object'&&Object.keys(w).length)return w;return c.wuchangOverride||{};}
/* 名望真源=c.resources.fame(可负·越低越声名狼藉)·c.mingwang/reputation 恒空 */
function _mingwangOf(c){if(c.mingwang!=null)return Math.round(c.mingwang);if(c.reputation!=null)return Math.round(c.reputation);if(c.resources&&c.resources.fame!=null)return Math.round(c.resources.fame);return null;}
/* 功名=资格(出身)⊕政绩(merit)。政绩半边真源=c.resources.virtueMerit(累积政绩·升迁凭据)+virtueStage(数字阶·名走 CharEconEngine.getVirtueStageName:未识/有闻/清誉/儒望/朝宗/师表) */
function _gongmingOf(c){
  var r=c.resources||{};
  var merit=(r.virtueMerit!=null?Math.round(r.virtueMerit):(c.virtueMerit!=null?Math.round(c.virtueMerit):null));
  var stage=(r.virtueStage!=null?r.virtueStage:c.virtueStage);var tier='';
  try{if(window.CharEconEngine&&CharEconEngine.getVirtueStageName)tier=CharEconEngine.getVirtueStageName(stage);}catch(e){}
  return {merit:merit,tier:tier};
}
/* 资格半边=结构化出身(走 TMGongming.describe·从 learning 解析+派生正异途/清浊流/天花板/优免) */
function _gongmingOriginOf(c){try{if(window.TMGongming&&TMGongming.describe)return TMGongming.describe(c,_g());}catch(e){}return null;}
function adaptTraits(c){
  var out=[];
  if(Array.isArray(c.traits)){c.traits.forEach(function(t){
    var id=typeof t==='string'?t:(t&&(t.id||t.name)||''),nm=id,cls='';
    if(typeof TRAIT_LIBRARY!=='undefined'&&TRAIT_LIBRARY[id]){var d=TRAIT_LIBRARY[id];nm=d.name||id;var sum=0;if(d.effects)Object.keys(d.effects).forEach(function(k){sum+=d.effects[k]||0;});cls=sum>=3?'pos':sum<=-3?'neg':'';}
    if(nm)out.push({n:nm,c:cls});
  });}
  if(!out.length&&Array.isArray(c.traitIds)&&_p().traitDefinitions){c.traitIds.forEach(function(id){var d=_p().traitDefinitions.find(function(x){return x.id===id;});if(d)out.push({n:d.name||id,c:''});});}
  return out.slice(0,8);
}
function adaptRels(c){
  var map={};
  try{if(typeof AffinityMap!=='undefined'&&AffinityMap.getRelations){(AffinityMap.getRelations(c.name)||[]).forEach(function(r){map[r.name]={name:r.name,strength:Math.round(r.value),label:relWord(r.value)};});}}catch(e){}
  if(c._relationships){Object.keys(c._relationships).forEach(function(on){var arr=c._relationships[on]||[];if(!arr.length)return;var top=arr.slice().sort(function(a,b){return Math.abs(b.strength||0)-Math.abs(a.strength||0);})[0];var s=(map[on]&&map[on].strength)||top.strength||0;map[on]={name:on,strength:Math.round(s),label:(map[on]&&map[on].label)||relWord(s),type:top.type};});}
  if(c._impressions){Object.keys(c._impressions).forEach(function(on){var f=(c._impressions[on]||{}).favor||0;if(!map[on]&&Math.abs(f)>=2)map[on]={name:on,strength:Math.max(-100,Math.min(100,Math.round(f*3))),label:imprWord(f)};});}
  return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return Math.abs(b.strength)-Math.abs(a.strength);}).slice(0,8);
}
function adaptImpr(c){var out=[];if(c._impressions){Object.keys(c._impressions).forEach(function(on){var iv=c._impressions[on]||{};if(Math.abs(iv.favor||0)>=2)out.push({name:on,favor:Math.round(iv.favor),label:imprWord(iv.favor)});});}return out.sort(function(a,b){return Math.abs(b.favor)-Math.abs(a.favor);}).slice(0,12);}
function adaptMemory(c){var GM=_g(),full=[];if(Array.isArray(GM._memoryArchiveFull))full=GM._memoryArchiveFull.filter(function(m){return m&&m.char===c.name;});if(!full.length&&Array.isArray(c._memory))full=c._memory.slice();return full.map(function(m){return {turn:m.turn,emotion:m.emotion||'平',event:m.event||m.summary||'',who:m.who||''};});}
/* 角色弧线 type 英文枚举→中文显示(原 dismissal/betrayal/arc_archive 等英文直显于人物图志/纪传卷·display-only 不改原始 type) */
var ARC_TYPE_CN={appointment:'就任',dismissal:'罢免',death:'身故',inheritance:'承袭',promotion:'擢升',demotion:'降黜',transfer:'调任',retirement:'致仕',autonomous:'自主行止',title_grant:'册封',title_revoke:'褫夺',title_promote:'加衔',reward:'受赏',achievement:'功绩',event:'纪事',arc_archive:'早年事迹',war:'兵事',betrayal:'背弃',alliance:'结盟',marriage:'联姻'};
function _arcTypeCN(t){return (t&&ARC_TYPE_CN[t])||t||'纪事';}
function adaptArcs(c){var GM=_g(),a=(GM.characterArcs&&GM.characterArcs[c.name])||[];return a.map(function(x){return {turn:x.turn,type:x.type||'事',desc:x.desc||''};});}
function adaptBlood(c){
  var out=[],seen={};
  if(typeof getBloodRelatives==='function'){try{(getBloodRelatives(c.name)||[]).forEach(function(r){if(seen[r.name])return;seen[r.name]=1;var c2=(typeof findCharByName==='function')?findCharByName(r.name):null;out.push({name:r.name,relation:r.relation,generation:relGen(r.relation),dead:c2&&c2.alive===false,inLaw:/妻|夫|姻|岳|嫂|媳|对食|后|妃|嫔/.test(r.relation||'')});});}catch(e){}}
  (c.children||[]).forEach(function(cn){if(typeof cn==='string'&&!seen[cn]){seen[cn]=1;out.push({name:cn,relation:'子嗣',generation:1});}});
  return out;
}
function adaptWorks(c){var GM=_g(),w=(GM.culturalWorks||[]).filter(function(x){return x.author===c.name;});return w.map(function(x){return {title:x.title,genre:(typeof _WENYUAN_GENRES!=='undefined'&&_WENYUAN_GENRES[x.genre])||x.genre,turn:x.turn,quality:x.quality,mood:x.mood,preserved:x.isPreserved};});}
function adaptCareer(c){return Array.isArray(c.career)?c.career.map(function(x){return typeof x==='string'?{title:x}:{year:x.year||x.date,title:x.title,desc:x.desc||x.note,milestone:x.milestone};}):[];}
/* 全部官职(主⊕兼)数组·走 office-system 真源·回退本地字段·供显示多职 */
function _zhiOfficeTitles(c){
  try{if(typeof _offGetCharOfficeTitles==='function'){var a=_offGetCharOfficeTitles(c);if(a&&a.length)return a;}}catch(e){}
  var arr=[];if(c&&c.officialTitle)arr.push(c.officialTitle);
  if(c&&Array.isArray(c.concurrentTitles))c.concurrentTitles.forEach(function(t){if(t&&arr.indexOf(t)<0)arr.push(t);});
  return arr;
}
/* 一行式官职文案·主职「兼」兼职·无职回退 title/布衣 */
function _zhiOfficeLine(p){
  var a=(p&&p.officeTitles)||[];
  if(!a.length)return (p&&(p.officialTitle||p.title))||'布衣';
  if(a.length===1)return a[0];
  return a[0]+'　兼　'+a.slice(1).join('、');
}
/* 主职(officeTitles 首项)·供公职身份主值 */
function _zhiOfficePrimary(p){var a=(p&&p.officeTitles)||[];return a.length?a[0]:((p&&(p.officialTitle||p.title))||'布衣');}
/* 兼职小字行·≥2 职才出·绿色「兼 …」 */
function _zhiConcurrentLine(p){var a=(p&&p.officeTitles)||[];if(a.length<2)return '';return '<div class="s" style="color:#557f6f">兼　'+esc(a.slice(1).join('、'))+'</div>';}
/* 官职 pill 串·主职实线 pill+每个兼职虚线「兼 …」pill·flex-wrap 自适应 */
function _zhiOfficePills(p){
  var a=(p&&p.officeTitles)||[];
  if(!a.length)return '<span class="dh-pill">'+esc((p&&(p.officialTitle||p.title))||'布衣')+'</span>';
  return a.map(function(t,i){return '<span class="dh-pill"'+(i>0?' style="border-style:dashed;opacity:0.92" title="兼任"':'')+'>'+(i>0?'兼 ':'')+esc(t)+'</span>';}).join('');
}
function adaptChar(c){
  var isP=!!c.isPlayer||(_p().playerInfo&&_p().playerInfo.characterName===c.name);
  return {
    _ref:c, name:c.name, zi:c.zi||c.courtesy||'', title:c.title, officialTitle:c.officialTitle, officeTitles:_zhiOfficeTitles(c), role:c.role, rank:_rankLabel(c),
    faction:c.faction||(isConsort(c)?'后宫':'无派系'), party:c.party, partyRank:c.partyRank,
    age:c.age, gender:c.gender||(isConsort(c)?'女':''), birthplace:c.birthplace, ethnicity:c.ethnicity, faith:c.faith, culture:c.culture, learning:c.learning, stance:c.stance, speechStyle:c.speechStyle,
    family:c.family, familyTier:c.familyTier, isPlayer:isP, alive:c.alive!==false, deathReason:c.deathReason, deathTurn:c.deathTurn,
    appearance:c.appearance, bio:c.bio, personality:c.personality, personalGoal:c.personalGoal||c.goal,
    portrait:c.portrait,
    loyalty:num(c.loyalty,50), intelligence:effAttr(c,'intelligence'), valor:effAttr(c,'valor'), administration:effAttr(c,'administration'), management:effAttr(c,'management'), charisma:effAttr(c,'charisma'), diplomacy:effAttr(c,'diplomacy'), military:effAttr(c,'military'), benevolence:effAttr(c,'benevolence'),
    ambition:num(c.ambition,50), stress:num(c.stress,0), health:num(c.health,80), integrity:(c.integrity!=null?Math.round(c.integrity):null),
    mingwang:_mingwangOf(c), gongming:_gongmingOf(c).merit, gongmingTier:_gongmingOf(c).tier, gongmingOrigin:_gongmingOriginOf(c), meritLog:(c._meritLog||[]).slice(-6).reverse(),
    wuchang:_wuchangOf(c), traits:adaptTraits(c),
    _mood:c._mood, location:c.location, _travelTo:c._travelTo, _imprisoned:c._imprisoned||c.imprisoned, _imprisonedTurn:c._imprisonedTurn, _imprisonReason:c._imprisonReason, _exiled:c._exiled||c.exiled, _exileReason:c._exileReason, _fled:c._fled||c._missing, _mourning:c._mourning, _retired:c._retired, _scheming:c._scheming,
    children:(c.children||[]).slice(), spouse:c.spouse, spouseRank:c.spouseRank, motherClan:c.motherClan,
    bloodRelatives:adaptBlood(c), relationships:adaptRels(c), impressions:adaptImpr(c),
    memory:adaptMemory(c), memArchive:c._memArchive||[], arcs:adaptArcs(c), lifeExp:c._lifeExp||[],
    works:adaptWorks(c), career:adaptCareer(c)
  };
}
var _peopleCache=null;
function loadPeople(force){
  if(_peopleCache&&!force)return _peopleCache;
  var GM=_g(),seen={},out=[];
  /* 功名重标定迁移(幂等)·保证面板读到的是 derive 拨发后的新尺度功名(开局/读档/中盘皆对)·引擎侧 endTurn 另有覆盖 */
  try{if(GM&&window.TMPromotion&&TMPromotion.migrateAllMerit)TMPromotion.migrateAllMerit(GM);}catch(e){}
  function add(c){if(!c||!c.name||seen[c.name])return;seen[c.name]=true;try{out.push(adaptChar(c));}catch(e){}}
  (GM.chars||[]).forEach(add);(GM.allCharacters||[]).forEach(add);
  // 防串台：只补当前激活剧本的 P.characters（否则官方天启/上一局人物会漏进当前局图志名册）
  if(window.P&&Array.isArray(P.characters))(typeof _tmActiveScenarioRows==='function'?_tmActiveScenarioRows(P.characters):P.characters).forEach(add);
  _peopleCache=out; return out;
}
function PEOPLE(){return loadPeople();}
function findP(name){var l=PEOPLE();for(var i=0;i<l.length;i++)if(l[i].name===name)return l[i];return null;}

/* ===================== 状态 ===================== */
var state={sel:null,q:'',fac:'all',role:'all',sort:'loyalty',dead:false,tab:'overview',roleStat:'all',compare:null,compare2:null,view:'liezhuan',phSort:'loyalty',dtWin:6};
var _zhiRosterRenderTimer=0;

/* ===================== 立绘字形 / SVG 基件 ===================== */
function faceHtml(p,cls){ if(p.portrait){return '<img loading="lazy" src="'+esc(p.portrait)+'" alt="" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'fallback\')">';} return '<span class="glyph">'+esc((p.name||'?').charAt(0))+'</span>'; }
function loyRing(val,size){var v=clamp(val),r=size*0.4,c=2*Math.PI*r,off=c*(1-v/100),cx=size/2;var col=v>=70?'#6fa291':v>=40?'#a8833a':'#a83228';return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'"><circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="rgba(120,90,40,0.16)" stroke-width="'+(size*0.07)+'"/><circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="'+(size*0.07)+'" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 '+cx+' '+cx+')"/><text x="'+cx+'" y="'+(cx-1)+'" text-anchor="middle" font-size="'+(size*0.34)+'" font-weight="bold" fill="'+col+'" font-family="serif">'+Math.round(v)+'</text><text x="'+cx+'" y="'+(cx+size*0.26)+'" text-anchor="middle" font-size="'+(size*0.16)+'" fill="#9c8b6b" font-family="serif">忠</text></svg>';}
function sealMark(p){var col=p.isPlayer?'#a8833a':(p.alive===false?'#9c8b6b':'#a83228'),ch=esc((p.name||'?').charAt(0));return '<span class="seal-mark" title="印鉴"><svg viewBox="0 0 42 42"><rect x="2.6" y="2.6" width="36.8" height="36.8" rx="4" fill="rgba(255,253,243,0.55)" stroke="'+col+'" stroke-width="2.6"/><rect x="6.5" y="6.5" width="29" height="29" rx="2" fill="none" stroke="'+col+'" stroke-width="0.8" opacity="0.55"/><text x="21" y="22" text-anchor="middle" dominant-baseline="central" font-size="21" font-weight="bold" fill="'+col+'" font-family="serif">'+ch+'</text></svg></span>';}
function radar(axes,opts){
  opts=opts||{};var size=opts.size||220,cx=size/2,cy=size/2+4,maxR=size*0.34,rings=4,col=opts.color||'#a83228',n=axes.length;
  var s='<svg viewBox="0 0 '+size+' '+(size+8)+'" class="radar-svg">';
  for(var ri=1;ri<=rings;ri++){var rr=maxR*ri/rings,pts=[];for(var i=0;i<n;i++){var a=-Math.PI/2+i*2*Math.PI/n;pts.push((cx+rr*Math.cos(a)).toFixed(1)+','+(cy+rr*Math.sin(a)).toFixed(1));}s+='<polygon points="'+pts.join(' ')+'" fill="'+(ri===rings?'rgba(255,253,243,0.4)':'none')+'" stroke="rgba(120,90,40,'+(ri===rings?0.34:0.16)+')" stroke-width="1"/>';}
  var dpts=[];
  for(var i2=0;i2<n;i2++){var a2=-Math.PI/2+i2*2*Math.PI/n,ex=cx+maxR*Math.cos(a2),ey=cy+maxR*Math.sin(a2);s+='<line x1="'+cx+'" y1="'+cy+'" x2="'+ex.toFixed(1)+'" y2="'+ey.toFixed(1)+'" stroke="rgba(168,131,58,0.34)" stroke-width="1"/>';var lx=cx+(maxR+15)*Math.cos(a2),ly=cy+(maxR+15)*Math.sin(a2),anchor=Math.abs(Math.cos(a2))<0.3?'middle':(Math.cos(a2)>0?'start':'end');s+='<text x="'+lx.toFixed(1)+'" y="'+(ly+3).toFixed(1)+'" text-anchor="'+anchor+'" font-size="11" fill="#574733" font-family="serif">'+esc(axes[i2].label)+'</text>';var v=clamp(axes[i2].value),dr=maxR*v/100;dpts.push((cx+dr*Math.cos(a2)).toFixed(1)+','+(cy+dr*Math.sin(a2)).toFixed(1));}
  if(opts.third&&opts.third.axes){var c3=opts.third.color||'#557f6f',d3=[];for(var k=0;k<n;k++){var ak=-Math.PI/2+k*2*Math.PI/n,vk=clamp(opts.third.axes[k].value),drk=maxR*vk/100;d3.push((cx+drk*Math.cos(ak)).toFixed(1)+','+(cy+drk*Math.sin(ak)).toFixed(1));}s+='<polygon points="'+d3.join(' ')+'" fill="'+c3+'" fill-opacity="0.12" stroke="'+c3+'" stroke-width="1.5" stroke-linejoin="round" stroke-dasharray="1.5,3"/>';}
  if(opts.second&&opts.second.axes){var c2=opts.second.color||'#4a5e8a',d2=[];for(var j=0;j<n;j++){var aj=-Math.PI/2+j*2*Math.PI/n,vj=clamp(opts.second.axes[j].value),drj=maxR*vj/100;d2.push((cx+drj*Math.cos(aj)).toFixed(1)+','+(cy+drj*Math.sin(aj)).toFixed(1));}s+='<polygon points="'+d2.join(' ')+'" fill="'+c2+'" fill-opacity="0.14" stroke="'+c2+'" stroke-width="1.6" stroke-linejoin="round" stroke-dasharray="4,2.5"/>';}
  s+='<polygon points="'+dpts.join(' ')+'" fill="'+col+'" fill-opacity="0.2" stroke="'+col+'" stroke-width="1.7" stroke-linejoin="round"/>';
  for(var i3=0;i3<n;i3++){var a3=-Math.PI/2+i3*2*Math.PI/n,v3=clamp(axes[i3].value),dr3=maxR*v3/100;s+='<circle cx="'+(cx+dr3*Math.cos(a3)).toFixed(1)+'" cy="'+(cy+dr3*Math.sin(a3)).toFixed(1)+'" r="2.4" fill="'+col+'"/>';}
  return s+'</svg>';
}
function situationBanner(p){
  if(p.alive===false)return '<div class="situation dead"><span class="sg">殁</span><span class="stx"><b>已殁</b><span>'+esc(p.deathReason||'')+(p.deathTurn?' · T'+p.deathTurn:'')+'</span></span></div>';
  if(p._imprisoned)return '<div class="situation imprison"><span class="sg">狱</span><span class="stx"><b>下诏狱'+(p._imprisonedTurn!=null?'·已系 '+Math.max(0,(_g().turn||0)-(p._imprisonedTurn||0))+' 回合':'')+'</b><span>'+esc(p._imprisonReason||'系于狴犴')+'</span></span></div>';
  if(p._exiled)return '<div class="situation exile"><span class="sg">谪</span><span class="stx"><b>流放在外</b><span>'+esc(p._exileReason||'谪戍边方')+'</span></span></div>';
  if(p._travelTo)return '<div class="situation travel"><span class="sg">行</span><span class="stx"><b>赴任途中</b><span>'+esc(p.location||'')+' → '+esc((p._travelTo&&(p._travelTo.toLocation||p._travelTo))||'')+'</span></span></div>';
  if(p._scheming)return '<div class="situation scheme"><span class="sg">谋</span><span class="stx"><b>密谋异动</b><span>察其交结，谨防其变</span></span></div>';
  return '';
}

/* ===================== 名籍(roster) ===================== */
function roleOf(p){if(p.faction==='后宫'||p.faction==='阉党')return 'harem';if(!p.officialTitle&&!p.title)return 'bu';if((p.military||0)>=(p.administration||0)&&(p.military||0)>=40)return 'mili';return 'civil';}
function inCapital(p){return /京|宫|乾清|慈庆|东厂|阙下|内廷/.test(String(p.location||''));}
function computeStat(){var st={all:0,civil:0,mili:0,harem:0,bu:0,dead:0,jail:0};PEOPLE().forEach(function(p){if(p.alive===false){st.dead++;return;}if(p._imprisoned||p._exiled)st.jail++;var r=roleOf(p);if(r==='harem')st.harem++;else if(r==='mili'){st.mili++;st.all++;}else if(r==='bu')st.bu++;else{st.civil++;st.all++;}});return st;}
function filtered(){
  var list=PEOPLE().slice();
  var kw=state.q?String(state.q).trim().toLowerCase():'';
  if(kw){
    // 检索:全局找人——跨全部人物(含已殁)·不被身份/党派/含已殁筛选拦截(原 bug:搜在剔除已殁之后·搜死者搜不到)
    list=list.filter(function(p){return (p.name+'\u0001'+(p.zi||'')+'\u0001'+(p.officialTitle||'')+'\u0001'+(p.title||'')+'\u0001'+(p.faction||'')+'\u0001'+(p.party||'')).toLowerCase().indexOf(kw)>=0;});
  }else{
    // 身份快筛:已殁=只看殁者·其余=只看在世(原 bug:state.dead latch 后死者泄入身份视图·与计数对不上)
    if(state.roleStat==='dead'){
      list=list.filter(function(p){return p.alive===false;});
    }else if(state.roleStat==='jail'){
      list=list.filter(function(p){return p.alive!==false&&(p._imprisoned||p._exiled);});
    }else{
      if(!state.dead)list=list.filter(function(p){return p.alive!==false;});
      if(state.role!=='all')list=list.filter(function(p){return roleOf(p)===state.role;});
    }
    if(state.fac!=='all')list=list.filter(function(p){return p.faction===state.fac;});
  }
  list.sort(function(a,b){if(a.isPlayer&&!b.isPlayer)return -1;if(!a.isPlayer&&b.isPlayer)return 1;var pa=isPinned(a.name),pb=isPinned(b.name);if(pa&&!pb)return -1;if(!pa&&pb)return 1;if(state.sort==='name')return String(a.name).localeCompare(String(b.name),'zh');return (b[state.sort]||0)-(a[state.sort]||0);});
  return list;
}
function pcard(p){
  var fc=facColor(p.faction),bars=[['智',p.intelligence],['政',p.administration],['武',p.military]],tags=[];
  if(p._imprisoned)tags.push('<span class="ptag jail">诏狱</span>');
  if(p._exiled)tags.push('<span class="ptag jail">流放</span>');
  if(p._travelTo)tags.push('<span class="ptag st">赴任</span>');
  if(p._scheming)tags.push('<span class="ptag st">密谋</span>');
  if(p.alive===false)tags.push('<span class="ptag st">已殁</span>');
  if((p.stress||0)>70)tags.push('<span class="ptag st">重压</span>');
  tags.push('<span class="ptag fac">'+esc(p.faction)+'</span>');
  return '<button class="pcard'+(p.name===state.sel?' active':'')+(p.alive===false?' dead':'')+(isPinned(p.name)?' pinned':'')+'" style="--fc:'+fc+'" onclick="TMZhi.selectP(\''+esc(p.name).replace(/'/g,"\\'")+'\')">'
    +'<span class="pc-face">'+faceHtml(p)+'</span>'
    +'<span class="pc-body"><span class="pc-name">'+(isPinned(p.name)?'<span class="pc-star">★</span>':'')+'<b>'+esc(p.name)+'</b>'+(p.zi?'<span class="zi">字'+esc(p.zi)+'</span>':'')+'<span class="age">'+(p.age||'?')+'岁</span></span>'
    +'<span class="pc-off">'+esc(_zhiOfficeLine(p))+(p.rank?' <span class="rk">'+esc(p.rank)+'</span>':'')+'</span>'
    +'<span class="pc-bars">'+bars.map(function(b){return '<span class="pc-bar">'+b[0]+'<i style="--v:'+clamp(b[1])+'%"></i></span>';}).join('')+'</span>'
    +'<span class="pc-tags">'+tags.join('')+'</span></span>'
    +'<span class="pc-loy">'+loyRing(p.loyalty,30)+'</span>'
    +(p.name===state.sel?'':'<span class="pc-cmp" title="与当前选中者对参" onclick="event.stopPropagation();TMZhi.setCompare(\''+oj(p.name)+'\')">⇌</span>')
    +'</button>';
}
function renderRoster(){
  var list=filtered(),vc=q('#tm-zhi-viscount');if(vc)vc.textContent=list.length;
  var box=q('#tm-zhi-roster');if(!box)return;
  if(!list.length){box.innerHTML='<div class="stub">朝野寂寂　无匹配之人<br>试调拨筛选或放宽检索</div>';return;}
  if(state.fac==='all'){
    var groups={};list.forEach(function(p){(groups[p.faction]=groups[p.faction]||[]).push(p);});
    var keys=Object.keys(groups).sort(function(a,b){return groups[b].length-groups[a].length;});
    box.innerHTML=keys.map(function(k){return '<div class="fac-hdr" style="--fc:'+facColor(k)+'">'+esc(k)+'<span class="n">'+groups[k].length+'人</span></div>'+groups[k].map(pcard).join('');}).join('');
  }else box.innerHTML=list.map(pcard).join('');
}
function scheduleZhiRosterRender(delay){
  if(_zhiRosterRenderTimer)clearTimeout(_zhiRosterRenderTimer);
  _zhiRosterRenderTimer=setTimeout(function(){
    _zhiRosterRenderTimer=0;
    renderRoster();
  },delay==null?120:delay);
}
function renderStatbar(){var st=computeStat(),cells=[['all',st.all,'在朝'],['civil',st.civil,'文臣'],['mili',st.mili,'武将'],['harem',st.harem,'内廷'],['bu',st.bu,'布衣'],['dead',st.dead,'已殁'],['jail',st.jail,'羁系']];var b=q('#tm-zhi-statbar');if(b)b.innerHTML=cells.map(function(c){return '<div class="stat'+(c[0]==='jail'&&c[1]>0?' warn':'')+(state.roleStat===c[0]?' on':'')+'" onclick="TMZhi.quickStat(\''+c[0]+'\')"><b>'+c[1]+'</b><span>'+c[2]+'</span></div>';}).join('');}
function renderFacOptions(){var facs=[];PEOPLE().forEach(function(p){if(facs.indexOf(p.faction)<0)facs.push(p.faction);});var s=q('#tm-zhi-ffac');if(s)s.innerHTML='<option value="all">全部党派</option>'+facs.map(function(f){return '<option value="'+esc(f)+'"'+(state.fac===f?' selected':'')+'>'+esc(f)+'</option>';}).join('');}

/* ===================== 列传·头屏 + 页签 ===================== */
var TABS=[['overview','总览'],['identity','身份'],['mind','心绪'],['relations','关系'],['benji','纪传'],['family','家族'],['memory','记忆'],['works','文事'],['pov','视角']];
function dossierHead(p){
  var hearts=[['忠诚',p.loyalty,false],['野心',p.ambition,p.ambition>=75],['压力',p.stress,p.stress>=65],['康健',p.health,p.health<40]];
  var colophon=esc((p.personality||p.stance||'').slice(0,20));
  return '<div class="dossier-head"><div class="dh-loy">'+loyRing(p.loyalty,74)+'<div class="lbl">忠诚</div></div>'
    +'<div class="dh-mountwrap"><div class="dh-mount"><div class="dh-portrait">'+faceHtml(p)+'<span class="dh-seal-on">'+sealMark(p)+'</span></div><div class="dh-mount-cap">立 轴 · 立 绘</div></div>'+(colophon?'<div class="dh-colophon">'+colophon+'</div>':'')+'</div>'
    +'<div class="dh-info"><div class="dh-titleline"><h2>'+esc(p.name)+'</h2>'+sealMark(p)+(p.zi?'<span class="zi">字 '+esc(p.zi)+'</span>':'')+'<span class="age">'+(p.age||'?')+'岁 · '+esc(p.gender||'')+'</span></div>'
    +'<div class="dh-pills"><span class="dh-pill fac">'+esc(p.faction)+'</span>'+(p.party?'<span class="dh-pill">'+esc(p.party)+'</span>':'')+(p.rank?'<span class="dh-pill rank">'+esc(p.rank)+'</span>':'')+_zhiOfficePills(p)+'</div>'
    +situationBanner(p)
    +'<div class="dh-hearts">'+hearts.map(function(h){return '<div class="dh-heart'+(h[2]?' warn':'')+'"><b>'+(h[1]==null?'—':Math.round(h[1]))+'</b><span>'+h[0]+'</span></div>';}).join('')+'</div>'
    +'<div class="dh-acts">'+headActs(p)+'</div></div></div>';
}
function headActs(p){
  var _del='<button class="dact danger" onclick="TMZhi.deleteP(\''+esc(p.name).replace(/'/g,"\\'")+'\')">删除</button>';
  if(p.isPlayer)return '<button class="dact primary" onclick="TMZhi.act(\'mind\')">御览心志</button>'; // 君上不可删
  if(p.alive===false)return '<button class="dact primary" onclick="TMZhi.act(\'works\')">阅其遗著</button><button class="dact" onclick="TMZhi.zhuizeng(\''+esc(p.name).replace(/'/g,"\\'")+'\')">追赠</button>'+_del;
  var cap=inCapital(p);
  return '<button class="dact primary" onclick="TMZhi.act(\''+(cap?'wendui':'letter')+'\',\''+esc(p.name).replace(/'/g,"\\'")+'\')">'+(cap?'召入问对':'鸿雁传书')+'</button>'
    +'<button class="dact" onclick="TMZhi.act(\'letter\',\''+esc(p.name).replace(/'/g,"\\'")+'\')">鸿雁传书</button>'
    +'<button class="dact" onclick="TMZhi.act(\'office\')">官制任免</button>'
    +'<button class="dact" onclick="TMZhi.pin(\''+esc(p.name).replace(/'/g,"\\'")+'\')">钉选</button>'
    +_del;
}
function verdict(p){return '<div class="verdict"><p>'+esc(p.personalGoal||p.bio||'此人暂无判断记录。')+'</p></div>';}

function tabOverview(p){
  var ra=[{label:'智',value:p.intelligence},{label:'武',value:p.valor},{label:'军',value:p.military},{label:'政',value:p.administration},{label:'管',value:p.management},{label:'交',value:p.diplomacy},{label:'魅',value:p.charisma},{label:'仁',value:p.benevolence}];
  var wc=p.wuchang||{},wa=[{label:'仁',value:wc['仁']},{label:'义',value:wc['义']},{label:'礼',value:wc['礼']},{label:'智',value:wc['智']},{label:'信',value:wc['信']}];
  var bars=[['忠诚',p.loyalty,'#557f6f','#6fa291'],['野心',p.ambition,'#8e6aa8','#a98ac4'],['压力',p.stress,'#a83228','#c64a3e'],['康健',p.health,'#7d5e22','#d8b96a'],['廉介',p.integrity,'#557f6f','#6fa291'],['名望',p.mingwang,'#7d5e22','#d8b96a']];
  var hasWc=['仁','义','礼','智','信'].some(function(k){return wc[k]!=null;});
  return '<section class="sec full"><div class="sec-t">禀 赋 命 盘 <small>八维评量'+(hasWc?' · 五常心性':'')+'</small></div>'
    +'<div class="mingpan-row"><div class="mingpan">'+radar(ra,{color:'#a83228',size:230})+'<div class="cap">八 维 评 量</div></div>'
    +(hasWc?'<div class="mingpan">'+radar(wa,{color:'#557f6f',size:230})+'<div class="cap">五 常 心 性</div></div>':'<div class="mingpan"><div class="stub">此人未录五常。</div></div>')+'</div></section>'
    +'<section class="sec full"><div class="sec-t">心 性 状 态</div><div class="bars">'+bars.map(function(b){return '<div class="bar"><div class="k"><span>'+b[0]+'</span><b>'+(b[1]==null?'—':Math.round(b[1]))+'</b></div><div class="track"><div class="fill" style="width:'+clamp(b[1])+'%;--c1:'+b[2]+';--c2:'+b[3]+'"></div></div></div>';}).join('')+'</div></section>'
    +'<section class="sec full"><div class="sec-t">功 名 <small>累 积 政 绩 · 升 迁 凭 据</small></div><div style="display:flex;align-items:baseline;gap:12px;padding:6px 4px 12px"><b style="font-size:1.7rem;font-family:serif;color:#a83228">'+(p.gongming==null?'—':p.gongming)+'</b>'+(p.gongmingTier?'<span style="font-size:1.05rem;font-family:KaiTi,STKaiti,serif;color:#7d5e22;letter-spacing:.12em">'+esc(p.gongmingTier)+'</span>':'')+'<span style="font-size:.72rem;color:#9c8b6b;margin-left:auto;font-family:FangSong,serif">六阶累进 · 处事建功而得 · 用于升迁</span></div>'+(p.meritLog&&p.meritLog.length?'<div style="padding:2px 4px 12px"><div style="font-size:.68rem;color:#9c8b6b;letter-spacing:.1em;font-family:FangSong,serif;margin-bottom:4px">近 期 功 名 升 降</div>'+p.meritLog.map(function(m){var zero=!m.delta,up=m.delta>0,col=zero?'#7d6b4b':(up?'#2d6a4a':'#a83228');return '<div style="display:flex;gap:9px;align-items:baseline;font-size:.78rem;padding:1px 0"><span style="color:#9c8b6b;font-family:FangSong,serif;min-width:40px">第'+(m.turn||0)+'回</span><b style="color:'+col+';min-width:44px;font-family:serif">'+(zero?'功绩':(up?'+':'')+m.delta)+'</b><span style="color:#6b5d44">'+esc(m.reason||'')+'</span></div>';}).join('')+'</div>':'')+'</section>'
    +'<div class="dgrid"><section class="sec"><div class="sec-t">当 前 志 向</div><div class="prose">'+esc(p.personalGoal||'未录')+'</div></section>'
    +'<section class="sec"><div class="sec-t">性 格 特 质</div><div class="traits">'+(p.traits.length?p.traits.map(function(t){return '<span class="trait '+(t.c||'')+'">'+esc(t.n)+'</span>';}).join(''):'<span class="trait">未录特质</span>')+'</div>'+(p.personality?'<div class="prose" style="margin-top:9px">'+esc(p.personality)+'</div>':'')+'</section></div>';
}
function idcell(k,v,two){return '<div class="idcell'+(two?' two':'')+'"><span>'+k+'</span><b>'+esc(v||'未录')+'</b></div>';}
/* 功名出身块：资格(出身路径·科第·荣衔·正异途·清浊流·天花板·优免) ⊕ 政绩(merit 阶)·走 TMGongming.describe */
function gongmingOriginBlock(p){
  var g=p.gongmingOrigin;if(!g)return '';
  function pill(txt,col,bg){return '<span style="font-family:KaiTi,STKaiti,serif;font-size:.9rem;padding:2px 11px;border-radius:11px;border:1px solid '+col+';color:'+col+';background:'+bg+';letter-spacing:.05em;white-space:nowrap">'+esc(txt)+'</span>';}
  var honorPills=(g.honors||[]).map(function(h){return pill(h,'#7d5e22','rgba(168,131,58,0.10)');}).join('');
  var zhengPill=pill(g.zhengtu?'正途':'异途',g.zhengtu?'#2d6a4a':'#9c5a28',g.zhengtu?'rgba(45,106,74,0.09)':'rgba(156,90,40,0.10)');
  var liuCol={qing:'#356b8a',mid:'#7d6b4b',zhuo:'#9c5a28',wu:'#7a3b3b'}[g.liupin]||'#7d6b4b';
  var liuPill=pill(g.liupinLabel||'中流',liuCol,'rgba(0,0,0,0.03)');
  var note=g.qing?'清要之选·名望素著·阁部储望所归。':(g.yi?'出身异途·循资有限·易为清议所讥。':(g.wu?'武职军功·别为一途。':'科第正途·循资而进。'));
  function stat(k,v,sub){return '<div style="flex:1;min-width:96px;text-align:center;padding:7px 4px;border:1px solid rgba(168,131,58,0.28);border-radius:7px;background:rgba(255,253,245,0.5)"><div style="font-size:.66rem;color:#9c8b6b;letter-spacing:.14em;font-family:FangSong,serif">'+k+'</div><b style="font-size:1.12rem;font-family:KaiTi,STKaiti,serif;color:#a83228">'+esc(v)+'</b>'+(sub?'<div style="font-size:.62rem;color:#9c8b6b">'+esc(sub)+'</div>':'')+'</div>';}
  var meritTxt=(p.gongmingTier?p.gongmingTier:'—')+(p.gongming!=null?'（'+p.gongming+'）':'');
  return '<section class="sec full"><div class="sec-t">功 名 出 身 <small>资 格 · 仕 途 所 凭</small></div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:9px 4px 4px">'
    +'<b style="font-size:1.5rem;font-family:KaiTi,STKaiti,serif;color:#7d5e22;letter-spacing:.04em">'+esc(g.title||'布衣')+'</b>'
    +honorPills+zhengPill+liuPill+'</div>'
    +'<div style="display:flex;gap:8px;padding:8px 4px 6px;flex-wrap:wrap">'
    +stat('仕途天花板',g.ceilingLabel||'—','循资所及')
    +stat('个人优免',(g.youmian||0)+' 丁','免役之额')
    +stat('政绩',meritTxt,'积功而得')+'</div>'
    +'<div class="fnote" style="padding:2px 4px 6px;color:#8a6d2b;font-family:FangSong,serif">'+note+(g.source==='inferred'?'　〔出身据官职推定·剧本未明载〕':'')+'</div></section>';
}
function tabIdentity(p){
  var tier={imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'};
  return '<section class="sec full"><div class="sec-t">身 份 档 案</div><div class="idgrid">'
    +idcell('姓名',p.name)+idcell('字号',p.zi||'未录')+idcell('性别',(p.age?p.age+'岁·':'')+(p.gender||''))
    +idcell('籍贯',p.birthplace)+idcell('民族',p.ethnicity)+idcell('信仰',p.faith)
    +idcell('文化',p.culture)+idcell('学识',p.learning,true)
    +idcell('立场',p.stance)+idcell('家族',(p.family||'')+(tier[p.familyTier]?'·'+tier[p.familyTier]:''),true)
    +(p.speechStyle?idcell('辞令',p.speechStyle,true):'')+idcell('当前所在',p.location)
    +'</div></section>'
    +gongmingOriginBlock(p)
    +'<div class="dual"><div class="dualbox" style="--dc:var(--gold-d)"><div class="lb">公 职 身 份</div><div class="v">'+esc(_zhiOfficePrimary(p))+'</div>'+_zhiConcurrentLine(p)+'<div class="s">'+esc(p.faction)+(p.party?' · '+esc(p.party)+(p.partyRank?'（'+esc(p.partyRank)+'）':''):'')+(p.rank?' · '+esc(p.rank):'')+'</div></div>'
    +'<div class="dualbox" style="--dc:var(--purple)"><div class="lb">私 人 身 份</div><div class="v">'+esc(p.name)+(p.age?'，'+p.age+'岁':'')+'</div><div class="s">'+esc(p.personality||'—')+'</div></div></div>'
    +'<section class="sec full"><div class="sec-t">形 貌 与 传 略</div>'+(p.appearance?'<div class="prose" style="font-style:italic;margin-bottom:9px">'+esc(p.appearance)+'</div>':'')+'<div class="prose indent prose-paper">'+esc(p.bio||'传略未录。')+'</div></section>';
}
function tabStub(label){return '<section class="sec full"><div class="sec-t">'+esc(label)+'</div><div class="stub">此页签真数据接线中。</div></section>';}
function oj(s){return esc(s).replace(/'/g,"\\'");}
function relLabel(s){return s>=50?['莫逆','good']:s>=25?['亲近','good']:s<=-50?['死敌','bad']:s<=-25?['不睦','bad']:['一般','neu'];}
function relMeter(s){s=Math.max(-100,Math.min(100,s));var col=s>=0?'#6fa291':'#a83228',w=Math.abs(s)/2,left=s>=0?50:50-w;return '<b style="left:'+left+'%;width:'+w+'%;background:'+col+'"></b>';}
function egoNetwork(p){
  var rels=(p.relationships||[]).slice(0,8);
  if(!rels.length)return '<div class="stub">此人尚无显性关系。</div>';
  var W=600,H=362,cx=300,cy=183,rx=234,ry=132,n=rels.length,s='<svg viewBox="0 0 '+W+' '+H+'">';
  rels.forEach(function(r,i){var a=-Math.PI/2+i*2*Math.PI/n,nx=cx+rx*Math.cos(a),ny=cy+ry*Math.sin(a),col=r.strength>=25?'#557f6f':r.strength<=-25?'#a83228':'#9c8b6b',w=(1.2+Math.min(5,Math.abs(r.strength)/20)).toFixed(1);s+='<line x1="'+cx+'" y1="'+cy+'" x2="'+nx.toFixed(1)+'" y2="'+ny.toFixed(1)+'" stroke="'+col+'" stroke-width="'+w+'" opacity="0.45"'+(r.strength<0?' stroke-dasharray="5,3"':'')+'/>';var mx=cx+rx*0.54*Math.cos(a),my=cy+ry*0.54*Math.sin(a);s+='<text x="'+mx.toFixed(1)+'" y="'+(my-3).toFixed(1)+'" text-anchor="middle" font-size="9.5" fill="'+col+'" font-family="serif" opacity="0.9">'+esc(r.label||'')+'</text>';});
  rels.forEach(function(r,i){var a=-Math.PI/2+i*2*Math.PI/n,nx=cx+rx*Math.cos(a),ny=cy+ry*Math.sin(a),col=r.strength>=25?'#557f6f':r.strength<=-25?'#a83228':'#9c8b6b',nm=esc(r.name),w=Math.max(30,nm.length*15+12);s+='<g class="egonode" onclick="TMZhi.selectP(\''+oj(r.name)+'\')" transform="translate('+nx.toFixed(1)+','+ny.toFixed(1)+')"><rect x="'+(-w/2)+'" y="-15" width="'+w+'" height="30" rx="6" fill="rgba(255,253,245,0.94)" stroke="'+col+'" stroke-width="1.3"/><text x="0" y="5" text-anchor="middle" font-size="13" fill="#241d15" font-family="serif">'+nm+'</text></g>';});
  s+='<g class="egonode" transform="translate('+cx+','+cy+')"><circle r="35" fill="rgba(168,131,58,0.15)" stroke="#a8833a" stroke-width="2.4"/><text x="0" y="-3" text-anchor="middle" font-size="16" font-weight="bold" fill="#7d5e22" font-family="serif">'+esc(p.name)+'</text><text x="0" y="14" text-anchor="middle" font-size="8.5" fill="#9c8b6b" font-family="serif" letter-spacing="2">本人</text></g></svg>';
  return s;
}
function familyTree(p){
  var groups={'-2':[],'-1':[],'0':[],'1':[],'2':[]};
  (p.bloodRelatives||[]).forEach(function(m){var g=String(m.generation==null?0:m.generation);if(groups[g])groups[g].push(m);});
  groups['0'].unshift({name:p.name,relation:'本人',self:true,age:p.age,title:p.officialTitle||p.rank});
  var labels={'-2':'祖 辈','-1':'父 辈','0':'同 辈','1':'子 嗣','2':'孙 辈'},yMap={'-2':30,'-1':128,'0':226,'1':324,'2':422},W=620,H=470;
  var s='<svg viewBox="0 0 '+W+' '+H+'" class="ft-svg"><g font-family="serif" font-size="10" letter-spacing="2" fill="#8a6d2b">';
  Object.keys(labels).forEach(function(g){if(groups[g]&&groups[g].length)s+='<text x="8" y="'+(yMap[g]+22)+'">'+labels[g]+'</text>';});
  s+='<line x1="4" y1="26" x2="4" y2="'+(H-20)+'" stroke="#b89a53" stroke-width="1" opacity="0.34"/></g><g font-family="serif">';
  Object.keys(groups).forEach(function(g){var row=groups[g];if(!row.length)return;var gap=Math.min(116,(W-110)/Math.max(1,row.length)),rowW=(row.length-1)*gap+96,startX=Math.max(56,(W+30)/2-rowW/2);row.forEach(function(m,idx){var x=startX+idx*gap,y=yMap[g],dead=m.dead,inLaw=m.inLaw||/妻|夫|姻|母|嫂|媳|岳|对食/.test(m.relation||'');var rectFill=m.self?'rgba(168,131,58,0.14)':(inLaw?'rgba(111,162,145,0.06)':'rgba(255,253,243,0.55)'),rectStroke=m.self?'#a8833a':(inLaw?'#6fa291':'#b89a53'),rsw=m.self?'2':'1',dash=inLaw?' stroke-dasharray="3,2"':'',txtCol=m.self?'#7d5e22':(dead?'#9c8b6b':'#241d15'),relCol=m.self?'#a8833a':(inLaw?'#2d5848':'#7d5e22'),nh=m.self?48:40,sub=(m.age?m.age+'岁 · ':'')+(m.title||m.note||'');s+='<g transform="translate('+x+','+y+')"><rect width="96" height="'+nh+'" rx="4" fill="'+rectFill+'" stroke="'+rectStroke+'" stroke-width="'+rsw+'"'+dash+'/><text x="48" y="14" text-anchor="middle" font-size="8.5" fill="'+relCol+'" letter-spacing="1.5">'+esc(m.relation||'亲属')+'</text><text x="48" y="'+(m.self?32:29)+'" text-anchor="middle" font-size="'+(m.self?15:13)+'" fill="'+txtCol+'" '+(m.self?'font-weight="bold"':'')+'>'+esc((m.name||'')+(dead?' †':''))+'</text><text x="48" y="'+(m.self?43:38)+'" text-anchor="middle" font-size="8" fill="#9c8b6b">'+esc(sub.slice(0,12))+'</text></g>';});});
  return s+'</g></svg>';
}
function tabMind(p){
  var moodMap={'喜':'心情愉悦','怒':'满腔怒火','忧':'忧心忡忡','惧':'惴惴不安','恨':'满怀怨恨','敬':'心怀敬意','平':'心境平和'};
  var sl=p.stress>=80?'濒于崩溃':p.stress>=60?'重压在身':p.stress>=35?'略有焦劳':'从容自持';
  return '<div class="dgrid"><section class="sec"><div class="sec-t">当 前 心 绪</div><div class="opinion" style="border-left-color:var(--purple);background:linear-gradient(180deg,rgba(142,106,168,0.06),transparent)"><div style="font-size:15px;color:var(--ink)">〔'+esc(p._mood||'平')+'〕'+esc(moodMap[p._mood]||'')+'</div><div class="brk" style="margin-top:4px">压力 '+Math.round(p.stress||0)+' / 100 · '+sl+'</div></div></section>'
    +'<section class="sec"><div class="sec-t">心 性 变 量</div>'
    +'<div class="bar"><div class="k"><span>压力</span><b>'+Math.round(p.stress||0)+'</b></div><div class="track"><div class="fill" style="width:'+clamp(p.stress)+'%;--c1:#a83228;--c2:#c64a3e"></div></div></div>'
    +'<div class="bar" style="margin-top:7px"><div class="k"><span>野心</span><b>'+Math.round(p.ambition||0)+'</b></div><div class="track"><div class="fill" style="width:'+clamp(p.ambition)+'%;--c1:#8e6aa8;--c2:#a98ac4"></div></div></div>'
    +'<div class="bar" style="margin-top:7px"><div class="k"><span>廉介</span><b>'+(p.integrity==null?'—':Math.round(p.integrity))+'</b></div><div class="track"><div class="fill" style="width:'+clamp(p.integrity)+'%;--c1:#557f6f;--c2:#6fa291"></div></div></div></section></div>'
    +'<section class="sec full"><div class="sec-t">五 常 心 性</div><div style="display:flex;gap:26px;justify-content:center;padding:6px 0 16px">'+['仁','义','礼','智','信'].map(function(k){var v=(p.wuchang||{})[k],lv=v==null?'mid':v>=60?'hi':v>=30?'mid':'lo';return '<div class="wcrow"><span class="wcdot '+lv+'">'+k+'<small>'+(v==null?'?':Math.round(v))+'</small></span></div>';}).join('')+'</div></section>'
    +'<section class="sec full"><div class="sec-t">内 省 与 行 止</div><div class="prose indent">'+esc(p.personality||'')+'　'+esc(p.bio||'')+'</div></section>';
}
function _tmzPlayerName(){try{var pi=(_p()||{}).playerInfo;return (pi&&pi.characterName)||'朱由检';}catch(_e){return '朱由检';}} // 玩家名硬编码朱由检曾令绍宋/自建剧本此两块整体失效(2026-07-04 审查定罪)
function tabRelations(p){
  var html='';
  if(!p.isPlayer&&p.impressions){var _pn=_tmzPlayerName();var tk=p.impressions.find(function(x){return x.name===_pn||x.name==='朱由检'||x.name==='玩家';});if(tk)html+='<section class="sec full"><div class="sec-t">对 君 主 之 心 <small>御批</small></div><div class="opinion"><span class="big">'+(tk.favor>0?'+':'')+tk.favor+'</span> <span style="color:var(--cinnabar-d);font-size:14px">'+esc(tk.label)+'</span><div class="brk" style="margin-top:4px">由累积受恩、事件、立场综合而成（OpinionSystem/_impressions）。</div></div></section>';}
  // 君上之疑——问对中君上当面察觉此人有所隐瞒(读 GM._wdSuspicions·原写而不读·君臣嫌隙留痕)
  if(!p.isPlayer){var _susp=((((_g()||{})._wdSuspicions)||[]).filter(function(s){return s&&s.who===p.name;})).slice().sort(function(a,b){return (b.turn||0)-(a.turn||0);});if(_susp.length){var _nowS=_g().turn||0;html+='<section class="sec full"><div class="sec-t">君 上 之 疑 <small>问对识破 · 君臣嫌隙</small></div><div class="opinion" style="border-left-color:#7a1f1a;background:linear-gradient(180deg,rgba(122,31,26,0.05),transparent)">'+_susp.map(function(s){var lab=(s.turn===_nowS?'本回合':(s.turn===_nowS-1?'上回合':'第'+(s.turn||0)+'回'));return '<div class="brk" style="margin:3px 0;color:var(--ink-soft)"><b style="color:#7a1f1a">'+esc(lab)+'</b> 君上'+(s.caught?'当面识破':'隐隐觉出')+'其有所隐瞒'+(s.hiding?'：所隐者“'+esc(s.hiding)+'”':'')+'</div>';}).join('')+'</div></section>';}}
  html+='<section class="sec full"><div class="sec-t">人 际 关 系 图 谱 <small>AffinityMap · 点节点可跳转</small></div><div class="egonet">'+egoNetwork(p)+'</div><div class="egolegend"><span><i style="border-color:#557f6f"></i>亲善</span><span><i style="border-color:#a83228"></i>嫌隙</span><span><i style="border-color:#9c8b6b"></i>泛交</span><span>线粗 ≈ 关系强弱</span></div></section>';
  html+='<section class="sec full"><div class="sec-t">关 系 强 弱 细 览</div><div class="relnet">'+((p.relationships||[]).map(function(r){var L=relLabel(r.strength);return '<div class="relrow" onclick="TMZhi.selectP(\''+oj(r.name)+'\')"><span class="nm">'+esc(r.name)+'</span><span class="lbl '+L[1]+'">'+esc(r.label||L[0])+'</span><span class="meter"><i></i>'+relMeter(r.strength)+'</span><span class="sc">'+(r.strength>0?'+':'')+r.strength+'</span></div>';}).join('')||'<div class="stub">暂无关系。</div>')+'</div></section>';
  html+='<div class="dgrid"><section class="sec"><div class="sec-t">对 他 人 印 象</div><div class="rows">'+((p.impressions||[]).map(function(im){var col=im.favor>=0?'good':'bad';return '<div class="row"><span class="k">'+esc(im.name)+'</span><span class="v"><span class="lbl '+col+'" style="font-size:12px;padding:1px 8px;border-radius:8px">'+esc(im.label)+'（'+(im.favor>0?'+':'')+im.favor+'）</span></span></div>';}).join('')||'<div class="prose">暂无印象记录。</div>')+'</div></section>'
    +'<section class="sec"><div class="sec-t">血 亲</div><div class="rows">'+((p.bloodRelatives||[]).filter(function(m){return !m.self;}).map(function(m){return '<div class="row"><span class="k">'+esc(m.relation)+'</span><span class="v link" onclick="TMZhi.selectP(\''+oj(m.name)+'\')">'+esc(m.name)+(m.dead?' †':'')+'</span></div>';}).join('')||'<div class="prose">暂无血亲记录。</div>')+'</div></section></div>';
  return html;
}
function tabBenji(p){
  var nodes=[];
  (p.career||[]).forEach(function(c){nodes.push({when:c.year,ti:c.title,ds:c.desc,key:c.milestone,tag:'履历'});});
  (p.arcs||[]).slice().sort(function(a,b){return a.turn-b.turn;}).forEach(function(a){nodes.push({when:'T'+a.turn,ti:_arcTypeCN(a.type),ds:a.desc,arc:true,tag:'近事'});});
  var ribbon=nodes.length?('<div style="overflow-x:auto;padding:30px 6px 14px"><div style="position:relative;display:inline-flex;align-items:flex-start;min-width:100%">'+nodes.map(function(nd){return '<div class="tlrow" style="flex:0 0 auto;width:150px;padding:0 10px;border:none"><div class="ti">'+esc(nd.when||'')+'</div><div class="sec" style="margin:6px 0 0;padding:8px 10px"><span style="font-size:10px;color:var(--ink-faint);border:1px solid rgba(168,131,58,0.3);border-radius:7px;padding:0 6px">'+esc(nd.tag)+'</span><div style="font-size:12.5px;color:'+(nd.key?'var(--cinnabar-d)':'var(--ink)')+';margin:3px 0">'+esc(nd.ti||'')+'</div><div class="ds">'+esc(nd.ds||'')+'</div></div></div>';}).join('')+'</div></div>'):'<div class="stub">暂无编年事迹。</div>';
  var dl={};(p.lifeExp||[]).forEach(function(e){dl[e.domain]=(dl[e.domain]||0)+1;});
  var domHtml=Object.keys(dl).map(function(d){return '<span class="dom">'+esc(d)+' <b>×'+dl[d]+'</b></span>';}).join('');
  return '<section class="sec full"><div class="sec-t">纪 传 长 卷 <small>履历·近事 编年 · 横向可滚</small></div>'+ribbon+'</section>'
    +'<section class="sec full"><div class="sec-t">官 制 与 任 事</div><div class="rows"><div class="row"><span class="k">现职</span><span class="v">'+esc(p.officialTitle||p.title||'未仕')+'</span></div><div class="row"><span class="k">品秩</span><span class="v">'+esc(p.rank||'未记')+'</span></div><div class="row"><span class="k">出身</span><span class="v">'+esc(p.learning||'未记')+'</span></div><div class="row"><span class="k">任所</span><span class="v">'+esc(p.location||'未记')+(p._travelTo?' → '+esc((p._travelTo.toLocation||p._travelTo)):'')+'</span></div></div></section>'
    +(domHtml?'<section class="sec full"><div class="sec-t">人 生 历 练 <small>按领域</small></div><div class="domains">'+domHtml+'</div>'+(p.lifeExp||[]).map(function(e){return '<div class="tlrow" style="padding-left:0"><div class="ds"><span style="color:var(--gold-d)">〔'+esc(e.domain)+'〕</span> '+esc(e.desc)+'</div></div>';}).join('')+'</section>':'');
}
function tabFamily(p){
  var tier={imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'};
  // 名望=真实动态声望(p.mingwang·随政绩/事件升降)·取代旧「家望」按门第硬编的静态假进度条(皇族恒100/士族恒60/世家恒78/寒门恒40·与游戏进程无关)
  var fame=(p.mingwang==null)?null:Math.round(p.mingwang);
  var clanGrid=[['门第',tier[p.familyTier]||'—',null],['族丁',(p.bloodRelatives||[]).filter(function(m){return !m.self;}).length,null],['名望',fame==null?'—':fame,fame],['家族',p.family||'—',null]];
  var harem='';
  if(p.spouseRank==='empress'||p.faction==='后宫'||p.isPlayer){var sp=p.spouse?'<div class="row"><span class="k">配偶</span><span class="v">'+esc(p.spouse)+'（'+esc({empress:'皇后',consort:'妃',concubine:'嫔'}[p.spouseRank]||'')+'）</span></div>':'';var ch=(p.children&&p.children.length&&p.children[0]!=='—')?'<div class="row"><span class="k">子嗣</span><span class="v">'+p.children.map(esc).join('、')+'</span></div>':'';if(sp||ch)harem='<section class="sec full"><div class="sec-t">后 宫 与 子 嗣</div><div class="rows">'+sp+ch+'</div></section>';}
  return '<section class="sec full"><div class="fttitle sec-t">五 代 家 谱 树 <small>金框为本人 · 虚线为姻亲 · † 已故</small></div><div class="ft-wrap">'+familyTree(p)+'</div><div class="ft-legend"><span class="ft-lg"><span class="ft-mk self"></span>本人</span><span class="ft-lg"><span class="ft-mk blood"></span>血亲</span><span class="ft-lg"><span class="ft-mk inlaw"></span>姻亲</span><span class="ft-lg"><span class="ft-mk dead"></span>已故</span></div></section>'
    +'<section class="sec full"><div class="sec-t">家 族 统 览</div><div class="clan-grid">'+clanGrid.map(function(c){return '<div class="clan-it"><div class="lb">'+c[0]+'</div><div class="vv">'+esc(c[1])+'</div>'+(c[2]!=null?'<div class="track"><i style="width:'+clamp(c[2])+'%"></i></div>':'')+'</div>';}).join('')+'</div></section>'+harem;
}
function tabMemory(p){
  var emo={'喜':'〔喜〕','怒':'〔怒〕','忧':'〔忧〕','惧':'〔惧〕','恨':'〔恨〕','敬':'〔敬〕','平':'〔平〕'};
  var memHtml=(p.memory||[]).slice().reverse().map(function(m){return '<div class="mem"><span class="t">T'+m.turn+'</span><span class="emo">'+(emo[m.emotion]||'·')+'</span><span class="ev">'+esc(m.event)+(m.who?' <span class="who">→'+esc(m.who)+'</span>':'')+'</span></div>';}).join('')||'<div class="stub">暂无活跃记忆。</div>';
  var arcHtml=(p.arcs||[]).map(function(a){return '<div class="tlrow"><div class="yr">T'+a.turn+' · '+esc(_arcTypeCN(a.type))+'</div><div class="ds">'+esc(a.desc)+'</div></div>';}).join('')||'<div class="stub">暂无角色弧线。</div>';
  var arcvHtml=(p.memArchive||[]).map(function(a){return '<div class="mem"><span class="t">'+esc(a.period||'')+'</span><span class="ev">'+esc(a.summary||'')+'</span></div>';}).join('');
  return '<section class="sec full"><div class="sec-t">此 人 记 忆 <small>'+(p.memory||[]).length+' 条 · AI记忆系统</small></div><div class="mems">'+memHtml+'</div>'
    +(arcvHtml?'<div class="archive-toggle" onclick="var n=this.nextElementSibling;n.style.display=n.style.display===\'none\'?\'block\':\'none\'">▸ 往事归档（'+(p.memArchive||[]).length+'段）</div><div style="display:none" class="mems">'+arcvHtml+'</div>':'')+'</section>'
    +'<section class="sec full"><div class="sec-t">角 色 弧 线 <small>characterArcs</small></div><div class="tl">'+arcHtml+'</div></section>';
}
function tabWorks(p){
  if(!p.works||!p.works.length)return '<section class="sec full"><div class="sec-t">著 述 文 事</div><div class="stub">此人未有著述传世。</div></section>';
  return '<section class="sec full"><div class="sec-t">著 述 文 事 <small>'+p.works.length+' 篇</small></div><div class="works">'+p.works.map(function(w){return '<div class="work"><div class="ti">'+(w.preserved?'<span class="star">★</span>':'')+'《'+esc(w.title)+'》</div><div class="mt">'+esc(w.genre||'')+(w.mood?' · '+esc(w.mood):'')+' · T'+(w.turn||0)+' · 品 '+(w.quality||0)+'</div></div>';}).join('')+'</div></section>';
}
function tabPov(p){
  var me=p.isPlayer?'朕':'吾';
  var lead='<div class="pov-lead"><span class="me">'+esc(p.name)+'自陈：</span>'+esc(p.personalGoal||p.bio||'')+'</div>';
  var eyes='';
  var _pn2=_tmzPlayerName();
  if(!p.isPlayer){var tk=(p.relationships||[]).find(function(r){return r.name===_pn2||r.name==='朱由检';}),tki=(p.impressions||[]).find(function(x){return x.name===_pn2||x.name==='朱由检'||x.name==='玩家';});if(tk||tki){var lbl=(tk&&tk.label)||(tki&&tki.label)||'',sc=(tk&&tk.strength)||(tki&&tki.favor)||0,cls=sc>0?'good':sc<0?'bad':'';eyes+='<div class="pov-row" onclick="TMZhi.selectP(\''+oj(_pn2)+'\')"><span class="who">视君上</span><span class="say '+cls+'">'+me+'于今上，'+esc(lbl)+'。</span></div>';}}
  (p.relationships||[]).filter(function(r){return r.name!==_pn2&&r.name!=='朱由检';}).forEach(function(r){var cls=r.strength>=25?'good':r.strength<=-25?'bad':'';eyes+='<div class="pov-row" onclick="TMZhi.selectP(\''+oj(r.name)+'\')"><span class="who">视'+esc(r.name)+'</span><span class="say '+cls+'">'+me+'视'+esc(r.name)+'，'+esc(r.label||'')+'（'+(r.strength>0?'亲':r.strength<0?'疏':'平')+'）。</span></div>';});
  var recent=(p.memory||[]).slice(-3).reverse(),recentHtml=recent.length?('<div class="pov-eye">'+recent.map(function(m){return '<div class="pov-row"><span class="who">T'+m.turn+'</span><span class="say">〔'+esc(m.emotion)+'〕'+esc(m.event)+'</span></div>';}).join('')+'</div>'):'<div class="stub">近来心绪未着痕迹。</div>';
  return '<section class="sec full"><div class="sec-t">此 人 眼 中 <small>主观视角 · 接 AI 记忆/印象</small></div>'+lead+'</section>'
    +'<section class="sec full"><div class="sec-t">'+me+' 眼 中 诸 人</div><div class="pov-eye">'+(eyes||'<div class="stub">'+me+'与朝中诸人未有深交。</div>')+'</div></section>'
    +'<section class="sec full"><div class="sec-t">萦 怀 之 事 <small>近日记忆</small></div>'+recentHtml+'</section>'
    +'<section class="sec full"><div class="sec-t">'+me+' 之 立 场</div><div class="rows"><div class="row"><span class="k">立场</span><span class="v">'+esc(p.stance||'未明')+'</span></div><div class="row"><span class="k">党派</span><span class="v">'+esc(p.party||p.faction||'无')+'</span></div><div class="row"><span class="k">所求</span><span class="v">'+esc((p.personalGoal||'').slice(0,26))+'</span></div></div></section>';
}
/* ===================== 朝局全景 + 群臣排行 ===================== */
function realFacStrength(name){
  /* 2026-07-03 死链修：derivedStrength 是对象{value,label}·旧判 typeof==='number' 恒 false→谱牒实力永远回落静态账 */
  try{var GM=_g();var f=(GM.facs||[]).find(function(x){return x.name===name;});if(f){if(f.derivedStrength&&typeof f.derivedStrength.value==='number')return f.derivedStrength.value;if(typeof f.derivedStrength==='number')return f.derivedStrength;if(typeof f.strength==='number')return f.strength;if(typeof f.renown==='number')return f.renown;}if(window.TM&&TM.FactionIndex&&TM.FactionIndex.get){var fi=TM.FactionIndex.get(name);if(fi&&fi.derivedStrength&&typeof fi.derivedStrength.value==='number')return fi.derivedStrength.value;if(fi&&typeof fi.derivedStrength==='number')return fi.derivedStrength;}}catch(e){}
  return null;
}
function factionData(){
  var facs={};PEOPLE().forEach(function(p){var f=p.faction||'无派系';(facs[f]=facs[f]||{name:f,members:[],power:0,color:facColor(f)}).members.push(p);});
  Object.keys(facs).forEach(function(f){var alive=facs[f].members.filter(function(p){return p.alive!==false;});var rs=realFacStrength(f);facs[f].power=(rs!=null?rs:alive.reduce(function(s,p){return s+(p.mingwang||50);},0));facs[f].realPower=rs!=null;var gmf=null;try{gmf=(_g().facs||[]).find(function(x){return x.name===f;});}catch(e){}facs[f].lead=(gmf&&gmf.leader&&findP(gmf.leader))||facs[f].members.slice().sort(function(a,b){return (b.mingwang||0)-(a.mingwang||0);})[0];});
  return facs;
}
function factionTensions(){
  var nameFac={};PEOPLE().forEach(function(p){nameFac[p.name]=p.faction;});var pair={};
  PEOPLE().forEach(function(p){(p.relationships||[]).forEach(function(r){var f1=p.faction,f2=nameFac[r.name];if(!f1||!f2||f1===f2)return;var key=[f1,f2].sort().join('|');pair[key]=(pair[key]||0)+r.strength;});});
  return pair;
}
function renderChaoju(){
  var ms=q('#tm-zhi-main');if(!ms)return;
  var facs=factionData(),keys=Object.keys(facs).sort(function(a,b){return facs[b].power-facs[a].power;}),total=keys.reduce(function(s,k){return s+facs[k].power;},0)||1,tensions=factionTensions();
  var anyReal=keys.some(function(k){return facs[k].realPower;});
  var balance='<div class="cj-balance"><div class="bt">朝 局 权 力 天 平 <span style="color:var(--ink-faint)">（'+(anyReal?'按势力派生强度':'按名望聚合')+'·占比）</span></div><div class="cj-bar">'+keys.map(function(k){var pct=Math.round(facs[k].power/total*100);return '<span style="width:'+pct+'%;background:'+facs[k].color+'" title="'+esc(k)+' '+pct+'%">'+(pct>=9?esc(k)+pct+'%':'')+'</span>';}).join('')+'</div></div>';
  var W=820,H=420,cx=410,cy=200,radial=keys.filter(function(k){return k!=='皇室';}),pos={};
  if(facs['皇室'])pos['皇室']={x:cx,y:cy,r:34};
  radial.forEach(function(k,i){var a=-Math.PI/2+i*2*Math.PI/Math.max(1,radial.length);pos[k]={x:cx+300*Math.cos(a),y:cy+148*Math.sin(a),r:20+Math.min(24,facs[k].power/Math.max(1,total)*120)};});
  if(!pos['皇室'])keys.forEach(function(k,i){var a=-Math.PI/2+i*2*Math.PI/Math.max(1,keys.length);pos[k]={x:cx+280*Math.cos(a),y:cy+148*Math.sin(a),r:24};});
  var svg='<svg viewBox="0 0 '+W+' '+H+'">';
  Object.keys(tensions).forEach(function(key){var ps=key.split('|'),a=pos[ps[0]],b=pos[ps[1]];if(!a||!b)return;var net=tensions[key],col=net<0?'#a83228':'#557f6f',w=(1+Math.min(5,Math.abs(net)/40)).toFixed(1);svg+='<line x1="'+a.x.toFixed(0)+'" y1="'+a.y.toFixed(0)+'" x2="'+b.x.toFixed(0)+'" y2="'+b.y.toFixed(0)+'" stroke="'+col+'" stroke-width="'+w+'" opacity="0.42"'+(net<0?' stroke-dasharray="6,4"':'')+'/>';});
  keys.forEach(function(k){var pp=pos[k];if(!pp)return;var f=facs[k];svg+='<g class="cnode" onclick="TMZhi.filterFaction(\''+oj(k)+'\')" transform="translate('+pp.x.toFixed(0)+','+pp.y.toFixed(0)+')"><circle r="'+pp.r.toFixed(0)+'" fill="'+f.color+'" fill-opacity="0.17" stroke="'+f.color+'" stroke-width="2.2"/><text x="0" y="-2" text-anchor="middle" font-size="13" font-weight="bold" fill="'+f.color+'" font-family="serif">'+esc(k)+'</text><text x="0" y="13" text-anchor="middle" font-size="9" fill="#7d6a48" font-family="serif">'+f.members.length+'人·'+Math.round(f.power)+'</text></g>';});
  svg+='</svg>';
  var legend='<div class="cj-legend"><span><i style="border-color:#a83228;border-top-style:dashed"></i>派系敌对</span><span><i style="border-color:#557f6f"></i>派系亲善</span><span>圈大≈势力 · 线粗≈强度</span></div>';
  var cards='<div class="cj-cards">'+keys.map(function(k){var f=facs[k];return '<div class="cj-card" style="--fc:'+f.color+'"><div class="ct"><b style="color:'+f.color+'">'+esc(k)+'</b><span class="pw">'+f.members.length+'人 · '+Math.round(f.power)+'</span></div><div class="cj-members">'+f.members.map(function(p){return '<span class="cj-mem'+(p===f.lead?' lead':'')+(p.alive===false?' dead':'')+'" onclick="TMZhi.selectP(\''+oj(p.name)+'\')">'+esc(p.name)+'</span>';}).join('')+'</div></div>';}).join('')+'</div>';
  ms.innerHTML='<div class="chaoju"><div class="sec-t" style="margin-bottom:11px">朝 局 全 景 <small>派系势力 · 张力 · 谁主谁从</small></div>'+balance+'<div class="chaoju-graph">'+svg+'</div>'+legend+cards+'</div>';
}
var PH_DIMS=[['loyalty','忠诚'],['gongming','功名'],['ambition','野心'],['stress','压力'],['mingwang','名望'],['integrity','廉介'],['military','军事'],['administration','政务']];
function renderPaihang(){
  var ms=q('#tm-zhi-main');if(!ms)return;
  var sk=state.phSort,list=PEOPLE().filter(function(p){return state.dead?true:p.alive!==false;}).slice().sort(function(a,b){return (b[sk]||0)-(a[sk]||0);}),maxV=Math.max.apply(null,list.map(function(p){return p[sk]||0;}))||100,dimLabel=(PH_DIMS.find(function(d){return d[0]===sk;})||['',''])[1];
  var ctrl='<div class="ph-ctrl"><span class="lb">排序维度：</span>'+PH_DIMS.map(function(d){return '<button class="phb'+(d[0]===sk?' active':'')+'" onclick="TMZhi.setPhSort(\''+d[0]+'\')">'+d[1]+'</button>';}).join('')+'</div>';
  var rows=list.map(function(p,i){var v=Math.round(p[sk]||0),bw=Math.round((p[sk]||0)/maxV*84);return '<tr class="'+(p.alive===false?'dead':'')+'" onclick="TMZhi.selectP(\''+oj(p.name)+'\')"><td class="ph-rank'+(i<3?' top':'')+'">'+(i+1)+'</td><td class="ph-name">'+esc(p.name)+'<small>'+esc(p.faction)+'</small></td><td>'+esc(_zhiOfficeLine(p))+'</td><td class="ph-pri"><b>'+v+'</b><i class="vb" style="width:'+bw+'px"></i></td><td>'+Math.round(p.loyalty||0)+'</td><td>'+Math.round(p.ambition||0)+'</td><td>'+Math.round(p.stress||0)+'</td><td>'+(p.mingwang==null?'—':Math.round(p.mingwang))+'</td><td>'+(p.gongming==null?'—':Math.round(p.gongming))+'</td></tr>';}).join('');
  ms.innerHTML='<div class="paihang"><div class="sec-t" style="margin-bottom:8px">群 臣 排 行 <small>全 '+list.length+' 人 · 点行入列传</small></div>'+ctrl+'<table class="ph-table"><thead><tr><th>名次</th><th style="text-align:left">姓名</th><th>官职</th><th style="color:var(--cinnabar-d)">'+esc(dimLabel)+' ▼</th><th>忠诚</th><th>野心</th><th>压力</th><th>名望</th><th>功名</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function renderFolioChaoju(){
  var fo=q('#tm-zhi-folio');if(!fo)return;var facs=factionData(),keys=Object.keys(facs).sort(function(a,b){return facs[b].power-facs[a].power;}),total=keys.reduce(function(s,k){return s+facs[k].power;},0)||1;
  fo.innerHTML='<div class="fcard"><div class="ft">派 系 势 力 榜</div><div class="relnet">'+keys.map(function(k){var f=facs[k];return '<div class="relrow" onclick="TMZhi.filterFaction(\''+oj(k)+'\')"><span class="nm" style="color:'+f.color+'">'+esc(k)+'</span><span class="sc">'+Math.round(f.power/total*100)+'%</span></div>';}).join('')+'</div></div><div class="fcard"><div class="ft">朝 局 提 要</div><div class="fnote">圈大者势隆，线赤者交恶。点派系入其名籍，点人物入列传。</div></div>';
}
function renderFolioPaihang(){
  var fo=q('#tm-zhi-folio');if(!fo)return;var dim={};PH_DIMS.forEach(function(d){dim[d[0]]=d[1];});var list=PEOPLE().filter(function(p){return p.alive!==false;}).slice().sort(function(a,b){return (b[state.phSort]||0)-(a[state.phSort]||0);}).slice(0,3),mk=['①','②','③'];
  fo.innerHTML='<div class="fcard"><div class="ft">'+esc(dim[state.phSort]||'')+' 前 三</div><div class="relnet">'+list.map(function(p,i){return '<div class="relrow" onclick="TMZhi.selectP(\''+oj(p.name)+'\')"><span class="nm">'+mk[i]+' '+esc(p.name)+'</span><span class="sc">'+Math.round(p[state.phSort]||0)+'</span></div>';}).join('')+'</div></div><div class="fcard"><div class="ft">说 明</div><div class="fnote">点列首维度切排序，点任一行入其列传。维度皆取引擎真值。</div></div>';
}
/* ===================== 朝野动态（NPC 自主行动 feed·读 _npcActionLedger） ===================== */
// behaviorType→中文：优先全局单一真源 TM.NPC.behaviorVerbCN，缺则本地兜底（镜像 tm-endturn-apply.js 的 _NPC_BEHAVIOR_CN·display-only）
var _DT_BEHAVIOR_CN={appoint:'任用',dismiss:'罢黜',declare_war:'宣战',reward:'赏赐',punish:'惩处',request_loyalty:'拉拢',reform:'推行新政',betray:'背叛',conspire:'密谋串联',petition:'进谏',investigate:'查劾',impeach:'弹劾',obstruct:'阻挠',slander:'中伤',reconcile:'和解',mentor:'提携',train_troops:'操练',fortify:'整饬城防',patrol:'巡防',flee:'出逃',retire:'告老',travel:'游历',develop:'兴修',donate:'捐输',hoard:'囤积',smuggle:'走私',suppress:'镇压',petition_jointly:'联名上书',recruit:'招募',study:'查访',recommend:'举荐',confront:'对质',mediate:'调和',frame_up:'构陷',expose_secret:'揭发',share_intelligence:'通风报信',guarantee:'担保',gift_present:'馈赠',private_visit:'私访',invite_banquet:'宴请',correspond_secret:'通密信',form_clique:'结党',marriage_alliance:'联姻',master_disciple:'收徒',duel_poetry:'诗文唱和',mourn_together:'共哀',mourn:'致哀',rival_compete:'争胜',obey:'听命',desert:'哗变'};
var _DT_TONE_HOSTILE={impeach:1,slander:1,frame_up:1,expose_secret:1,conspire:1,betray:1,obstruct:1,form_clique:1,desert:1,rival_compete:1,confront:1,smuggle:1,hoard:1,punish:1,declare_war:1,suppress:1,investigate:1};
var _DT_TONE_FRIENDLY={recommend:1,guarantee:1,gift_present:1,invite_banquet:1,private_visit:1,correspond_secret:1,marriage_alliance:1,master_disciple:1,mentor:1,reconcile:1,mediate:1,duel_poetry:1,mourn_together:1,mourn:1,reward:1,request_loyalty:1,petition_jointly:1,share_intelligence:1,recruit:1};
function _dtTone(bt){var k=String(bt||'').toLowerCase().trim();return _DT_TONE_HOSTILE[k]?'h':(_DT_TONE_FRIENDLY[k]?'f':'n');}
function _dtVerb(bt){try{if(window.TM&&TM.NPC&&typeof TM.NPC.behaviorVerbCN==='function')return TM.NPC.behaviorVerbCN(bt);}catch(e){}var k=String(bt==null?'':bt).toLowerCase().trim();return _DT_BEHAVIOR_CN[k]||(/[a-z]/i.test(k)?'举动':(bt||'举动'));}
function _dtLedger(){var L=(_g()&&_g()._npcActionLedger);return Array.isArray(L)?L:[];}
function _dtRows(){var now=_g().turn||0,win=(state.dtWin==null?6:state.dtWin);return _dtLedger().filter(function(e){return e&&e.actor&&e.status!=='blocked'&&(!e.preflight||e.preflight.ok!==false)&&(win<=0||(now-(e.turn||0))<win);}).slice().sort(function(a,b){return (b.turn||0)-(a.turn||0)||(b.createdAt||0)-(a.createdAt||0);});}
function renderDongtai(){
  var ms=q('#tm-zhi-main');if(!ms)return;
  var now=_g().turn||0,win=(state.dtWin==null?6:state.dtWin),rows=_dtRows();
  var ctrl='<div class="dt-ctrl"><span class="lb">近：</span>'+[3,6,12,0].map(function(w){return '<button class="phb'+(win===w?' active':'')+'" onclick="TMZhi.setDtWin('+w+')">'+(w===0?'全部':w+'回合')+'</button>';}).join('')+'</div>';
  if(!rows.length){ms.innerHTML='<div class="dongtai"><div class="sec-t" style="margin-bottom:8px">朝 野 动 态 <small>百官私下的招募、构陷、结纳、谋划</small></div>'+ctrl+'<div class="stub">'+(_dtLedger().length?'此窗内朝野无可见动静——可拉宽回合或择「全部」。':'朝野动态尚未生成——满朝文武的自主行动会在过回合后逐条记于此。')+'</div></div>';return;}
  var groups={},order=[];rows.forEach(function(e){var t=e.turn||0;if(!groups[t]){groups[t]=[];order.push(t);}groups[t].push(e);});
  var body=order.map(function(t){
    var label=(t===now?'本回合':(t===now-1?'上回合':(now-t)+' 回合前'));
    var items=groups[t].map(function(e){
      var tone=_dtTone(e.behaviorType);
      var head='<b class="dt-actor" onclick="TMZhi.selectP(\''+oj(e.actor)+'\')">'+esc(e.actor)+'</b> <span class="dt-verb '+tone+'">'+esc(_dtVerb(e.behaviorType))+'</span>';
      if(e.target){head+=' <span class="dt-arrow">→</span> '+(findP(e.target)?'<b class="dt-actor" onclick="TMZhi.selectP(\''+oj(e.target)+'\')">'+esc(e.target)+'</b>':'<span class="dt-tgt">'+esc(e.target)+'</span>');}
      var say=e.publicReason||e.action||'',inner=(e.motivePrivate&&e.motivePrivate!==say)?e.motivePrivate:'';
      return '<div class="dt-item '+tone+'"><div class="dt-head">'+head+'</div>'+(say?'<div class="dt-say">称：'+esc(say)+'</div>':'')+(inner?'<div class="dt-inner">私心：'+esc(inner)+'</div>':'')+'</div>';
    }).join('');
    return '<div class="dt-group"><div class="dt-turn">'+esc(label)+' <small>'+groups[t].length+' 桩</small></div>'+items+'</div>';
  }).join('');
  ms.innerHTML='<div class="dongtai"><div class="sec-t" style="margin-bottom:8px">朝 野 动 态 <small>你诏令之外，群臣各自在动——招募、构陷、结纳、谋划</small></div>'+ctrl+body+'</div>';
}
function renderFolioDongtai(){
  var fo=q('#tm-zhi-folio');if(!fo)return;
  var win=(state.dtWin==null?6:state.dtWin),rows=_dtRows(),byActor={};
  rows.forEach(function(e){byActor[e.actor]=(byActor[e.actor]||0)+1;});
  var top=Object.keys(byActor).sort(function(a,b){return byActor[b]-byActor[a];}).slice(0,8);
  fo.innerHTML='<div class="fcard"><div class="ft">动 态 提 要</div><div class="fnote">近 '+(win<=0?'全部回合':win+' 回合')+'，朝野共 '+rows.length+' 桩可见动静。<span style="color:#a83228">赤</span>者攻讦、<span style="color:#557f6f">绿</span>者结纳。点人物入其列传。</div></div><div class="fcard"><div class="ft">最 活 跃</div><div class="relnet">'+(top.length?top.map(function(n){return '<div class="relrow" onclick="TMZhi.selectP(\''+oj(n)+'\')"><span class="nm">'+esc(n)+'</span><span class="sc">'+byActor[n]+'</span></div>';}).join(''):'<div class="fnote">暂无。</div>')+'</div></div>';
}
/* ===================== 逆案录（谋反/政变/弑君·读 GM._conspiracies·display-only） ===================== */
// action/outcome→中文（镜像 tm-endturn-apply.js conspiracy_events 写入的取值·display-only）
var _NI_ACTION_CN={coup_succeeded:'政变得逞',coup_failed:'政变败露',palace_coup:'宫变',regicide:'弑君',plot_failed:'谋逆未遂',plot:'密谋',conspiracy:'谋逆',rebellion:'举兵谋反',mutiny:'兵变',assassination:'行刺',assassinate:'行刺',poison:'鸩毒',usurp:'篡位',treason:'通敌叛国',sedition:'煽乱'};
var _NI_OUTCOME_CN={succeeded:'得逞',success:'得逞',suppressed:'事败就擒',failed:'失败',exposed:'败露',foiled:'败露',pending:'未决',ongoing:'未决'};
function _niActCN(a){var k=String(a==null?'':a).toLowerCase().trim();return _NI_ACTION_CN[k]||(/[a-z]/i.test(k)?'逆案':(a||'逆案'));}
function _niOutCN(o){var k=String(o==null?'':o).toLowerCase().trim();return _NI_OUTCOME_CN[k]||(o||'未决');}
function _niSuccess(e){var o=String(e&&e.outcome||'').toLowerCase().trim(),a=String(e&&e.action||'').toLowerCase();if(o==='suppressed'||o==='failed'||o==='exposed'||o==='foiled')return false;if(o==='succeeded'||o==='success')return true;return a==='coup_succeeded'||a==='regicide'||a==='palace_coup'||a==='usurp';}
function _niLedger(){var L=(_g()&&_g()._conspiracies);return Array.isArray(L)?L:[];}
function _niRows(){return _niLedger().slice().filter(function(e){return e&&(e.instigator||e.action);}).sort(function(a,b){return (b.turn||0)-(a.turn||0);});}
function renderNian(){
  var ms=q('#tm-zhi-main');if(!ms)return;
  var now=_g().turn||0,rows=_niRows();
  if(!rows.length){ms.innerHTML='<div class="nian"><div class="sec-t" style="margin-bottom:8px">逆 案 录 <small>本朝谋逆、政变、弑君诸案及其主谋从党</small></div><div class="stub">本朝尚无逆案——若有谋反、宫变、弑君事发，将逐案记于此，主谋从党、成败缘由皆录。</div></div>';return;}
  var body=rows.map(function(e){
    var succ=_niSuccess(e),cls=succ?'success':'foiled';
    var label=(e.turn===now?'本回合':(e.turn===now-1?'上回合':'第'+(e.turn||0)+'回'));
    var head='<span class="ni-turn">'+esc(label)+'</span><span class="ni-act '+cls+'">'+esc(_niActCN(e.action))+'</span>';
    head+='<b class="ni-actor" onclick="TMZhi.selectP(\''+oj(e.instigator)+'\')">'+esc(e.instigator||'某人')+'</b>';
    if(e.target){head+=' <span class="ni-arrow">→</span> '+(findP(e.target)?'<b class="ni-actor" onclick="TMZhi.selectP(\''+oj(e.target)+'\')">'+esc(e.target)+'</b>':'<span class="ni-tgt">'+esc(e.target)+'</span>');}
    if(e._qamGated)head+='<span class="ni-gate">护栏·未遂</span>';
    var meta='<div class="ni-meta">结局：'+esc(_niOutCN(e.outcome))+'</div>';
    var con=(e.conspirators&&e.conspirators.length)?'<div class="ni-conspir">从党：'+e.conspirators.map(function(n){return findP(n)?'<b onclick="TMZhi.selectP(\''+oj(n)+'\')">'+esc(n)+'</b>':esc(n);}).join('、')+'</div>':'';
    var rsn=e.reason?'<div class="ni-reason">缘由：'+esc(e.reason)+'</div>':'';
    return '<div class="ni-item '+cls+'"><div class="ni-head">'+head+'</div>'+meta+con+rsn+'</div>';
  }).join('');
  ms.innerHTML='<div class="nian"><div class="sec-t" style="margin-bottom:8px">逆 案 录 <small>你视线之外，朝中亦有人谋逆——主谋、从党、成败、缘由</small></div>'+body+'</div>';
}
function renderFolioNian(){
  var fo=q('#tm-zhi-folio');if(!fo)return;
  var rows=_niRows(),succ=rows.filter(_niSuccess).length,foiled=rows.length-succ,byInst={};
  rows.forEach(function(e){if(e.instigator)byInst[e.instigator]=(byInst[e.instigator]||0)+1;});
  var top=Object.keys(byInst).sort(function(a,b){return byInst[b]-byInst[a];}).slice(0,8);
  fo.innerHTML='<div class="fcard"><div class="ft">逆 案 提 要</div><div class="fnote">本朝共 '+rows.length+' 案：<span style="color:#7a1f1a">得逞 '+succ+'</span> · <span style="color:#557f6f">事败 '+foiled+'</span>。点主谋入其列传。</div></div>'+(top.length?'<div class="fcard"><div class="ft">屡 谋 之 人</div><div class="relnet">'+top.map(function(n){return '<div class="relrow" onclick="TMZhi.selectP(\''+oj(n)+'\')"><span class="nm">'+esc(n)+'</span><span class="sc">'+byInst[n]+'</span></div>';}).join('')+'</div></div>':'');
}
/* ===================== 两/三人对参 ===================== */
function cmpAxes(p){return [{label:'智',value:p.intelligence},{label:'武',value:p.valor},{label:'军',value:p.military},{label:'政',value:p.administration},{label:'管',value:p.management},{label:'交',value:p.diplomacy},{label:'魅',value:p.charisma},{label:'仁',value:p.benevolence}];}
function renderCompare(){
  var ms=q('#tm-zhi-main');if(!ms)return;
  var A=findP(state.sel),B=state.compare?findP(state.compare):null,C=state.compare2?findP(state.compare2):null;
  if(!A||!B){state.compare=null;state.compare2=null;renderMain();return;}
  var ppl=[A,B];if(C)ppl.push(C);
  var cols=['#a83228','#4a5e8a','#557f6f'],clsn=['a','b','c'],dash=['━','┅','┈'];
  var ro={color:cols[0],size:300,second:{axes:cmpAxes(B),color:cols[1]}};if(C)ro.third={axes:cmpAxes(C),color:cols[2]};
  var radarHtml=radar(cmpAxes(A),ro);
  var metrics=[['忠诚','loyalty'],['野心','ambition'],['压力','stress'],['康健','health'],['名望','mingwang'],['功名','gongming'],['廉介','integrity']];
  var bars=metrics.map(function(m){var cells=ppl.map(function(p,i){return '<span class="cwbar"><i style="width:'+clamp(p[m[1]])+'%;background:'+cols[i]+'"></i><b style="color:'+cols[i]+'">'+(p[m[1]]==null?'—':Math.round(p[m[1]]))+'</b></span>';}).join('');return '<div class="cmpbarN"><span class="lab">'+m[0]+'</span><span class="cells">'+cells+'</span></div>';}).join('');
  var relPairs=[];for(var i=0;i<ppl.length;i++)for(var j=0;j<ppl.length;j++){if(i===j)continue;var r=(ppl[i].relationships||[]).find(function(x){return x.name===ppl[j].name;});if(r)relPairs.push('“'+esc(ppl[i].name)+'”视“'+esc(ppl[j].name)+'”'+esc(r.label||'')+'（'+(r.strength>0?'+':'')+r.strength+'）');}
  var relTxt=relPairs.length?relPairs.join('；')+'。':'诸人之间无显性关系记录。';
  var byLoy=ppl.slice().sort(function(a,b){return b.loyalty-a.loyalty;}),byXian=ppl.slice().sort(function(a,b){return (b.gongming||0)-(a.gongming||0);});
  var verdictTxt='<b>权衡：</b>'+esc(byLoy[0].name)+'忠诚最笃（'+Math.round(byLoy[0].loyalty)+'）'+(byLoy[0].ambition>=70?'，然野心炽盛宜防尾大；':'，且野心尚可控驭；')+'　'+esc(byXian[0].name)+'功名最著，可委以繁剧。';
  var miniP=function(p,i){return '<div class="cmp-person '+clsn[i]+'" style="border-left-color:'+cols[i]+'">'+(i>0?'<span class="cmp-drop" onclick="TMZhi.dropCompare('+i+')" title="移出对参">✕</span>':'')+'<div class="cmp-face">'+faceHtml(p)+'</div><div><div class="nm">'+esc(p.name)+'</div><div class="of">'+esc(p.officialTitle||p.title||'布衣')+(p.rank?' · '+esc(p.rank):'')+'</div><div class="fa" style="color:'+cols[i]+'">'+esc(p.faction)+(p.party?' · '+esc(p.party):'')+'</div></div></div>';};
  var legend=ppl.map(function(p,i){return '<span style="color:'+cols[i]+'">'+dash[i]+esc(p.name)+'</span>';}).join(' ');
  var addHint=C?'':'<div class="fnote" style="text-align:center;margin-top:8px">再点名籍卡的 ⇌ 可加第三人同盘对参</div>';
  ms.innerHTML='<div class="cmp-head"><h2>'+(C?'三':'两')+' 人 对 参<small>'+ppl.map(function(p){return esc(p.name);}).join(' ⇌ ')+'</small></h2><button class="cmp-clear" onclick="TMZhi.clearCompare()">✕ 退出对参</button></div>'
    +'<div class="cmp-body"><div class="cmp-people" style="grid-template-columns:repeat('+ppl.length+',1fr)">'+ppl.map(miniP).join('')+'</div>'
    +'<div class="dgrid"><section class="sec"><div class="sec-t">禀 赋 叠 盘 <small>'+legend+'</small></div><div class="cmp-radar-wrap">'+radarHtml+'</div></section>'
    +'<section class="sec"><div class="sec-t">心性·声望 并校</div>'+bars+'</section></div>'
    +'<section class="sec full"><div class="sec-t">'+(C?'三':'两')+' 人 之 间</div><div class="prose">'+relTxt+'</div></section>'
    +'<div class="cmp-verdict">'+verdictTxt+'</div>'+addHint+'</div>';
}
/* ===================== 御笔朱批(localStorage) ===================== */
function getZhubi(name){try{return localStorage.getItem('tm_zhubi_'+name)||'';}catch(e){return '';}}
function setZhubiLS(name,txt){try{if(txt)localStorage.setItem('tm_zhubi_'+name,txt);else localStorage.removeItem('tm_zhubi_'+name);}catch(e){}}
function zhubiBlock(p){var t=getZhubi(p.name);return '<div class="zhubi" id="tm-zhi-zhubi"><span class="zb-edit" onclick="TMZhi.editZhubi()">'+(t?'改批':'御批')+'</span><div class="zb-txt'+(t?'':' empty')+'">'+(t?esc(t):'（尚无御批。可亲书数语，志其亲疏向背、堪用与否。）')+'</div></div>';}
function getPinned(){try{return JSON.parse(localStorage.getItem('tm_zhi_pinned')||'[]')||[];}catch(e){return [];}}
function isPinned(name){return getPinned().indexOf(name)>=0;}
function togglePin(name){var ps=getPinned(),i=ps.indexOf(name);if(i>=0)ps.splice(i,1);else ps.push(name);try{localStorage.setItem('tm_zhi_pinned',JSON.stringify(ps));}catch(e){}return i<0;}

function renderTab(p){
  switch(state.tab){
    case 'identity':return tabIdentity(p);
    case 'mind':return tabMind(p);
    case 'relations':return tabRelations(p);
    case 'benji':return tabBenji(p);
    case 'family':return tabFamily(p);
    case 'memory':return tabMemory(p);
    case 'works':return tabWorks(p);
    case 'pov':return tabPov(p);
    default:return tabOverview(p);
  }
}
function renderMain(){
  var ms=q('#tm-zhi-main');if(!ms)return;
  if(state.view==='chaoju'){renderChaoju();return;}
  if(state.view==='paihang'){renderPaihang();return;}
  if(state.view==='dongtai'){renderDongtai();return;}
  if(state.view==='nian'){renderNian();return;}
  if(state.compare){renderCompare();return;}
  var p=findP(state.sel)||PEOPLE()[0];if(!p){ms.innerHTML='<div class="stub" style="margin-top:60px">尚无人物数据。</div>';return;}
  state.sel=p.name;
  var tabsHtml='<div class="tabs">'+TABS.map(function(t){return '<button class="tab'+(state.tab===t[0]?' active':'')+'" onclick="TMZhi.switchTab(\''+t[0]+'\')">'+t[1]+'</button>';}).join('')+'</div>';
  ms.innerHTML=dossierHead(p)+verdict(p)+zhubiBlock(p)+tabsHtml+'<div class="detail">'+renderTab(p)+'</div>';
}
function renderFolio(){
  var fo=q('#tm-zhi-folio');if(!fo)return;
  if(state.view==='chaoju')return renderFolioChaoju();
  if(state.view==='paihang')return renderFolioPaihang();
  if(state.view==='dongtai')return renderFolioDongtai();
  if(state.view==='nian')return renderFolioNian();
  var p=findP(state.sel)||PEOPLE()[0];if(!p){fo.innerHTML='';return;}
  var cap=inCapital(p);
  var rels=(p.relationships||[]).slice(0,5);
  var vd=p.loyalty>=70?['可托腹心','忠悃可恃，宜假事权。']:p.loyalty>=45?['可接触','向背未定，宜以恩结之。']:['需防范','离心已著，当谨防其变。'];
  if(p.alive===false)vd=['已殁','存其遗事，可追赠以励来者。'];
  var acts;
  if(p.isPlayer)acts='<button class="fact primary span" onclick="TMZhi.act(\'mind\')">御览心志</button>';
  else if(p.alive===false)acts='<button class="fact primary span" onclick="TMZhi.act(\'works\')">阅其遗著</button><button class="fact" onclick="TMZhi.zhuizeng(\''+esc(p.name).replace(/'/g,"\\'")+'\')">追赠昭雪</button>';
  else acts='<button class="fact primary span" onclick="TMZhi.act(\''+(cap?'wendui':'letter')+'\',\''+esc(p.name).replace(/'/g,"\\'")+'\')">'+(cap?'召入问对':'鸿雁传书')+'</button><button class="fact" onclick="TMZhi.act(\'letter\',\''+esc(p.name).replace(/'/g,"\\'")+'\')">鸿雁传书</button><button class="fact" onclick="TMZhi.act(\'office\')">官制任免</button><button class="fact" onclick="TMZhi.pin(\''+esc(p.name).replace(/'/g,"\\'")+'\')">钉选</button><button class="fact" onclick="TMZhi.switchTab(\'relations\')">关系</button>';
  var html=(getZhubi(p.name)?'<div class="fcard"><div class="ft">御 笔 朱 批</div><div style="font-size:12.5px;color:var(--vermilion);line-height:1.72;font-family:var(--zfont)">'+esc(getZhubi(p.name))+'</div></div>':'')+'<div class="fcard"><div class="ft">可 用 入 口</div><div class="actgrid">'+acts+'</div><div class="fnote">'+(cap?'此人在京，可即召问对。':p.alive===false?'此人已殁，仅存遗事遗著可考。':'此人在外，须以鸿雁传书。')+'</div></div>';
  html+='<div class="fcard"><div class="ft">朝 堂 研 判</div><div style="padding:8px 10px;border-radius:6px;background:rgba(168,50,40,0.06);border-left:3px solid var(--cinnabar);margin-bottom:9px"><strong style="display:block;font-size:12px;color:var(--cinnabar-d)">'+vd[0]+'</strong><span style="font-size:11.5px;color:var(--ink-soft)">'+vd[1]+'</span></div><div class="risk-grid">'+[['忠诚',p.loyalty],['野心',p.ambition],['压力',p.stress],['康健',p.health],['名望',p.mingwang],['功名',p.gongming]].map(function(r){return '<div class="risk"><span>'+r[0]+'</span><b>'+(r[1]==null?'—':Math.round(r[1]))+'</b></div>';}).join('')+'</div></div>';
  html+='<div class="fcard"><div class="ft">关 系 焦 点</div>'+(rels.length?'<div class="relnet">'+rels.map(function(r){var cls=r.strength>=25?'good':r.strength<=-25?'bad':'neu';return '<div class="relrow" onclick="TMZhi.selectP(\''+esc(r.name).replace(/'/g,"\\'")+'\')"><span class="nm">'+esc(r.name)+'</span><span class="lbl '+cls+'">'+esc(r.label)+'</span><span class="sc">'+(r.strength>0?'+':'')+r.strength+'</span></div>';}).join('')+'</div>':'<div class="fnote">暂无显性关系。</div>')+'</div>';
  html+='<div class="fcard"><div class="ft">五 常 速 览</div><div style="display:flex;gap:14px;justify-content:center;padding:4px 0 14px">'+['仁','义','礼','智','信'].map(function(k){var v=(p.wuchang||{})[k],lv=v==null?'mid':v>=60?'hi':v>=30?'mid':'lo';return '<span class="wcdot '+lv+'">'+k+'<small>'+(v==null?'?':Math.round(v))+'</small></span>';}).join('')+'</div></div>';
  fo.innerHTML=html;
}

/* ===================== overlay + 交互 ===================== */
function q(sel){var ov=document.getElementById('tm-zhi-overlay');return ov?ov.querySelector(sel):null;}
function buildOverlay(){
  installStyles();
  var ov=document.getElementById('tm-zhi-overlay');
  if(ov)return ov;
  ov=document.createElement('div');ov.id='tm-zhi-overlay';
  ov.innerHTML=''
    +'<div class="zhi-frame">'
    +'<div class="zhi-titlebar"><button class="zhi-close" title="退回御案" onclick="TMZhi.close()">×</button><div style="flex:1"><div class="st-main">人 物 图 志</div><div class="st-sub">朝野名籍　列传图考　心迹谱牒</div></div><div class="zhi-chips" id="tm-zhi-chips"></div></div>'
    +'<div class="global-bar"><div class="viewtabs" id="tm-zhi-viewtabs"></div><div class="gsearch"><input id="tm-zhi-gsearch" placeholder="检索姓名、字号、官职、党派……" oninput="TMZhi.onSearch(this.value)"></div><button class="gbtn seal" onclick="TMZhi.ceming()">策 名</button><button class="gbtn" onclick="TMZhi.exportBio()">导出列传</button></div>'
    +'<div class="zhi-body">'
    +'<aside class="panel roster"><div class="panel-hd"><span class="seal">志</span><div><b>朝野名籍</b><span>roster · 检索 · 派系</span></div></div>'
    +'<div class="statbar" id="tm-zhi-statbar"></div>'
    +'<div class="roster-tools"><div class="r-search"><input id="tm-zhi-rsearch" placeholder="姓名 / 官职 / 党派" oninput="TMZhi.onSearch(this.value)"></div>'
    +'<div class="r-filters"><select class="r-sel" id="tm-zhi-ffac" onchange="TMZhi.onFilter()"></select>'
    +'<select class="r-sel" id="tm-zhi-frole" onchange="TMZhi.onFilter()"><option value="all">全部身份</option><option value="civil">文臣</option><option value="mili">武将</option><option value="harem">内廷后宫</option><option value="bu">布衣草莽</option></select>'
    +'<select class="r-sel" id="tm-zhi-fsort" onchange="TMZhi.onFilter()"><option value="loyalty">按忠诚</option><option value="ambition">按野心</option><option value="stress">按压力</option><option value="name">按姓名</option></select></div>'
    +'<div class="r-meta"><span>当前显示 <b id="tm-zhi-viscount">0</b> 人</span><label class="r-check"><input type="checkbox" id="tm-zhi-fdead" onchange="TMZhi.onFilter()">含已殁</label></div></div>'
    +'<div class="roster-list" id="tm-zhi-roster"></div></aside>'
    +'<main class="panel main"><div class="main-scroll" id="tm-zhi-main"></div></main>'
    +'<aside class="panel folio"><div class="panel-hd"><span class="seal gold">案</span><div><b>御案案侧</b><span>入口 · 研判 · 焦点</span></div></div><div class="folio-scroll" id="tm-zhi-folio"></div></aside>'
    +'</div></div>'
    +'<div id="tm-zhi-toast" style="position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:99999;font-size:13px;letter-spacing:0.08em;color:#fff;padding:11px 22px;border-radius:9px;background:linear-gradient(155deg,rgba(58,40,22,0.96),rgba(36,24,14,0.96));border:1px solid #7d5e22;opacity:0;transition:opacity .25s;pointer-events:none;"></div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown',function(e){if(e.target===ov)closePanel();});
  return ov;
}
function renderViewTabs(){var vs=[['liezhuan','列传'],['chaoju','朝局'],['paihang','排行'],['dongtai','朝野动态'],['nian','逆案']];var vt=q('#tm-zhi-viewtabs');if(vt)vt.innerHTML=vs.map(function(v){return '<button class="vtab'+(state.view===v[0]?' active':'')+'" onclick="TMZhi.setView(\''+v[0]+'\')">'+v[1]+'</button>';}).join('');}
function renderChips(){var alive=PEOPLE().filter(function(p){return p.alive!==false;}).length,c=q('#tm-zhi-chips');if(c)c.innerHTML='<span class="chip green">入志 '+PEOPLE().length+'</span><span class="chip hot">存世 '+alive+'</span>';}
function renderAll(){renderChips();renderFacOptions();renderViewTabs();renderStatbar();renderRoster();renderMain();renderFolio();}

function openPanel(name){
  loadPeople(true);
  buildOverlay();
  if(name&&findP(name))state.sel=name;
  if(!state.sel){var l=PEOPLE();state.sel=l.length?l[0].name:null;}
  state.view='liezhuan';state.compare=null;state.compare2=null;state.tab='overview';
  document.getElementById('tm-zhi-overlay').style.display='grid';
  document.documentElement.style.overflow='hidden';
  renderAll();
  if(!openPanel._esc){openPanel._esc=function(e){if(e.key==='Escape')closePanel();};document.addEventListener('keydown',openPanel._esc);}
}
function closePanel(){var ov=document.getElementById('tm-zhi-overlay');if(ov)ov.style.display='none';if(_zhiRosterRenderTimer){clearTimeout(_zhiRosterRenderTimer);_zhiRosterRenderTimer=0;}document.documentElement.style.overflow='';}

/* 交互 */
var TMZhi={
  // 外部新增/移除人物后失效名册缓存·面板开着则就地刷新(2026-07-04 审查定罪:策名召入曾读死缓存)
  invalidatePeople:function(){_peopleCache=null;try{if(q('#tm-zhi-main')){renderRoster();renderMain();renderFolio();}}catch(_e){}},
  selectP:function(name){if(!findP(name))return;state.sel=name;state.tab=state.tab||'overview';state.view='liezhuan';state.compare=null;state.compare2=null;renderViewTabs();renderMain();renderFolio();renderRoster();var ms=q('#tm-zhi-main');if(ms)ms.scrollTop=0;},
  setCompare:function(name){if(!findP(name)||name===state.sel)return;if(name===state.compare||name===state.compare2)return;if(!state.compare)state.compare=name;else if(!state.compare2)state.compare2=name;else state.compare2=name;state.view='liezhuan';renderViewTabs();renderMain();renderRoster();var ms=q('#tm-zhi-main');if(ms)ms.scrollTop=0;toast('对参：'+state.sel+' ⇌ '+state.compare+(state.compare2?' ⇌ '+state.compare2:''));},
  dropCompare:function(which){if(which===2)state.compare2=null;else{state.compare=state.compare2;state.compare2=null;}if(!state.compare){this.clearCompare();return;}renderMain();renderRoster();},
  clearCompare:function(){state.compare=null;state.compare2=null;renderMain();renderRoster();},
  editZhubi:function(){var p=findP(state.sel);if(!p)return;var t=getZhubi(p.name),el=q('#tm-zhi-zhubi');if(!el)return;el.innerHTML='<textarea id="tm-zhi-zbinput" placeholder="御笔亲批……">'+esc(t)+'</textarea><div class="zb-acts"><button onclick="TMZhi.cancelZhubi()">取消</button><button class="save" onclick="TMZhi.saveZhubi()">钤 定</button></div>';var ta=q('#tm-zhi-zbinput');if(ta)ta.focus();},
  saveZhubi:function(){var p=findP(state.sel);if(!p)return;var ta=q('#tm-zhi-zbinput'),v=(ta&&ta.value||'').trim();setZhubiLS(p.name,v);renderMain();renderFolio();toast('御批已钤');},
  cancelZhubi:function(){renderMain();},
  ceming:function(){try{if(window.TM&&TM.ceming&&typeof TM.ceming.openDialog==='function'){TM.ceming.openDialog();var ov=document.getElementById('ceming-overlay');if(ov)ov.style.zIndex='100001';toast('策名·敕召贤良');return;}}catch(e){}toast('策名系统未就绪');},
  zhuizeng:function(name){name=name||state.sel;try{if(typeof switchGTab==='function'){closePanel();switchGTab(null,'gt-edict');toast('可拟诏追赠 '+name);return;}}catch(e){}toast('追赠 '+name+'（诏书系统未就绪）');},
  exportBio:function(){var p=findP(state.sel);if(!p){toast('未选人物');return;}var L=['【'+p.name+(p.zi?'　字'+p.zi:'')+'】',(p.officialTitle||p.title||'布衣')+(p.rank?'　'+p.rank:'')+'　'+(p.faction||'')+(p.party?'·'+p.party:''),(p.appearance?'〔形貌〕'+p.appearance:''),(p.bio?'〔传略〕'+p.bio:''),'〔志向〕'+(p.personalGoal||'—')].filter(Boolean);try{var blob=new Blob([L.join('\n')],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=p.name+'·列传.txt';document.body.appendChild(a);a.click();a.remove();toast('已导出 '+p.name+' 列传');}catch(e){toast('导出失败');}},
  pin:function(name){name=name||state.sel;var now=togglePin(name);renderRoster();renderMain();renderFolio();toast((now?'已钉选 ':'已取消钉选 ')+name);},
  deleteP:function(name){
    name=name||state.sel;
    var p=findP(name);if(!p){toast('未选人物');return;}
    if(p.isPlayer){toast('君上不可删除');return;}
    if(typeof confirm==='function'&&!confirm('确定删除「'+name+'」？此举不可撤销，将从朝野名籍中抹去此人。'))return;
    var GM=_g();
    ['chars','allCharacters'].forEach(function(kk){if(GM&&Array.isArray(GM[kk]))GM[kk]=GM[kk].filter(function(c){return !c||c.name!==name;});});
    if(window.P&&Array.isArray(P.characters))P.characters=P.characters.filter(function(c){return !c||c.name!==name;});
    try{if(isPinned(name))togglePin(name);}catch(_){}
    loadPeople(true); // 失效缓存·重读
    if(state.sel===name)state.sel=null;
    if(state.compare===name)state.compare=null;
    if(state.compare2===name)state.compare2=null;
    try{if(typeof buildIndices==='function')buildIndices();}catch(_){}
    try{if(typeof renderOfficeTree==='function')renderOfficeTree();}catch(_){}
    renderFacOptions();renderStatbar();renderRoster();renderMain();renderFolio();
    toast('已删除 '+name);
  },
  switchTab:function(t){state.tab=t;renderMain();},
  setView:function(v){state.view=v;state.compare=null;renderViewTabs();renderMain();renderFolio();var ms=q('#tm-zhi-main');if(ms)ms.scrollTop=0;},
  filterFaction:function(f){state.fac=f;var sel=q('#tm-zhi-ffac');if(sel)sel.value=f;state.roleStat='all';var fd=factionData()[f];renderRoster();if(fd&&fd.lead)TMZhi.selectP(fd.lead.name);},
  setPhSort:function(k){state.phSort=k;renderPaihang();renderFolio();},
  setDtWin:function(w){state.dtWin=w;renderDongtai();renderFolioDongtai();},
  onSearch:function(v){state.q=v;var a=q('#tm-zhi-gsearch'),b=q('#tm-zhi-rsearch');if(a&&a.value!==v)a.value=v;if(b&&b.value!==v)b.value=v;scheduleZhiRosterRender();},
  onFilter:function(){state.fac=(q('#tm-zhi-ffac')||{}).value||'all';state.role=(q('#tm-zhi-frole')||{}).value||'all';state.sort=(q('#tm-zhi-fsort')||{}).value||'loyalty';state.dead=!!(q('#tm-zhi-fdead')||{}).checked;state.roleStat='all';renderRoster();renderStatbar();},
  quickStat:function(k){
    var d=q('#tm-zhi-fdead');
    if(k==='dead'){state.roleStat='dead';state.role='all';state.dead=true;if(d)d.checked=true;}
    else if(k==='jail'){state.roleStat=(state.roleStat==='jail'?'all':'jail');state.role='all';state.dead=false;if(d)d.checked=false;}
    else if(k==='all'){state.roleStat='all';state.role='all';state.dead=false;if(d)d.checked=false;}
    else{state.roleStat=(state.roleStat===k?'all':k);state.role=(state.roleStat==='all'?'all':k);state.dead=false;if(d)d.checked=false;}
    var fr=q('#tm-zhi-frole');if(fr)fr.value=state.role;
    renderRoster();renderStatbar();
  },
  act:function(kind,name){
    name=name||state.sel;
    try{
      if(kind==='wendui'){ if(typeof openWenduiPick==='function'){closePanel();openWenduiPick(name);return;} }
      if(kind==='letter'){ if(typeof window.GM!=='undefined'){GM._pendingLetterTo=name;} if(typeof switchGTab==='function'){closePanel();switchGTab(null,'gt-letter');return;} }
      if(kind==='office'){ if(typeof switchGTab==='function'){closePanel();switchGTab(null,'gt-office');return;} }
      if(kind==='mind'){ state.tab='pov'; renderMain(); return; }
    }catch(e){}
    toast('动作「'+kind+'」入口待接（运行时将路由到对应系统）');
  },
  toast:toast,
  close:closePanel
};
window.TMZhi=TMZhi;

/* ===================== 入口覆盖（零 clobber 路由） ===================== */
window.openCharRenwuPage=function(name){ try{ openPanel(name); }catch(e){ console.error('[TMZhi] open fail',e); } };
window.openRenwuTuzhi=function(opts){ openPanel(opts&&opts.selected); };
window.TMZhiOpen=openPanel;

/* 御案(formal)「人物图志」模块入口劫持·包装 TMPhase8FormalBridge.modules.openModule(kind==='renwu')→新面板。
   所有入口(data-tmf-action=renwu 按钮 / openRenwu / onclick)都经 bridge.openModule→modules.openModule 此层·全覆盖·不碰热文件。 */
function _hijackFormalRenwu(){
  try{
    var B=window.TMPhase8FormalBridge;
    if(B&&B.modules&&typeof B.modules.openModule==='function'&&!B.modules.__zhiHijacked){
      var _orig=B.modules.openModule;
      B.modules.openModule=function(kind,options){
        if(kind==='renwu'){ try{ openPanel(options&&(options.selected||options.id||options.name)); return; }catch(e){ return _orig.call(this,kind,options); } }
        return _orig.call(this,kind,options);
      };
      B.modules.__zhiHijacked=true;
      try{console.log('[TMZhi] formal 人物图志 入口已接管');}catch(_){}
      return true;
    }
  }catch(e){}
  return false;
}
if(!_hijackFormalRenwu()){
  var _zt=0,_zi=setInterval(function(){ if(_hijackFormalRenwu()||++_zt>40) clearInterval(_zi); },150);
}

})();
