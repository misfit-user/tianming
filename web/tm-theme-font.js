(function(){
  'use strict';

  var FONT_VERSION = '20260520-scope-fonts';
  var DEFAULT_THEME = 'plain';
  var DEFAULT_SIZE = 'md';
  var DEFAULT_BODY = 'TM-ZCOOL-XiaoWei';
  var DEFAULT_TITLE = 'TM-ZCOOL-QingKe';
  var MEMORIAL_INKS = [
    { key:'ink', label:'深墨（默认）', ink:'#241d15', soft:'#493b2a', muted:'#62523c' },
    { key:'black', label:'墨黑（高对比）', ink:'#181818', soft:'#303030', muted:'#484848' },
    { key:'indigo', label:'靛青', ink:'#263e50', soft:'#304c61', muted:'#456079' }
  ];

  function esc(v) {
    if (v == null) return '';
    return String(v).replace(/[&<>"]/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  function q(v) {
    return String(v || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
  function readStore(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null || v === '' ? fallback : v;
    } catch(_) {
      return fallback;
    }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, value); } catch(_){}
  }
  function getStyle(id) {
    var st = document.getElementById(id);
    if (!st) {
      st = document.createElement('style');
      st.id = id;
      document.head.appendChild(st);
    }
    return st;
  }
  function toastMsg(text) {
    if (typeof toast === 'function') toast(text);
  }

  var THEMES = [
    { key:'plain', label:'\u7d20\u7eb8', desc:'\u5ba3\u7eb8\u91d1\u7ebf \u00b7 \u6731\u5802', swatch:['#b89a53','#c9a85f','#6a9a7f','#b84738'],
      pal:{ bg:'#1a1510', surface:'#2a2218', fg:'#f4eadd', primary:'#c9a85f', accent:'#b84738', info:'#7eb8a7', warn:'#c9a045', gold1:'#b89a53', gold2:'#c9a85f', gold3:'#d4be7a', verm1:'#8f3428', verm2:'#b84738', verm3:'#d15c47', cela:'#6a9a7f' } },
    { key:'ink', label:'\u6c34\u58a8', desc:'\u58a8\u5206\u4e94\u8272 \u00b7 \u51b7\u8c03', swatch:['#3d342a','#6b5d47','#a69470','#d9c9a9'],
      pal:{ bg:'#1a1a22', surface:'#282834', fg:'#d9c9a9', primary:'#a69470', accent:'#6b5d47', info:'#b0b8c4', warn:'#c9c4a8', gold1:'#6b5d47', gold2:'#a69470', gold3:'#c2b596', verm1:'#5a4038', verm2:'#7a5548', verm3:'#a07058', cela:'#607080' } },
    { key:'vermillion', label:'\u6731\u781a', desc:'\u6d53\u6731\u91cd\u8d64 \u00b7 \u70ed\u8c03', swatch:['#8f3428','#b84738','#d15c47','#c9a85f'],
      pal:{ bg:'#1e0f0c', surface:'#2e1a14', fg:'#fce6d8', primary:'#d15c47', accent:'#8f3428', info:'#c9a045', warn:'#e89078', gold1:'#b89a53', gold2:'#c9a85f', gold3:'#e8c888', verm1:'#8f3428', verm2:'#b84738', verm3:'#d15c47', cela:'#8a7050' } },
    { key:'celadon', label:'\u9752\u7eff', desc:'\u9752\u7eff\u5c71\u6c34 \u00b7 \u96fe\u8c03', swatch:['#4a7a5f','#6a9a7f','#b89a53','#d9c9a9'],
      pal:{ bg:'#0f1814', surface:'#1a2420', fg:'#e8f0e0', primary:'#6a9a7f', accent:'#4a7a5f', info:'#b89a53', warn:'#d9c9a9', gold1:'#8a9060', gold2:'#b89a53', gold3:'#d9c9a9', verm1:'#7a5548', verm2:'#a07058', verm3:'#c08878', cela:'#6a9a7f' } }
  ];
  var THEME_MAP = THEMES.reduce(function(m, t){ m[t.key] = t; return m; }, {});

  var SIZE_LABELS = { xs:'\u6781\u5c0f', sm:'\u5c0f', md:'\u4e2d', lg:'\u5927', xl:'\u7279\u5927' };
  var SIZE_SCALES = { xs:0.78, sm:0.88, md:1.0, lg:1.14, xl:1.30 };
  var SIZE_BASE = { xs:0.95, sm:1.05, base:1.18, md:1.28, lg:1.42, xl:1.60, xl2:1.90, xl3:2.45 };

  var FONT_OPTIONS = [
    { value:'TM-ZCOOL-XiaoWei', label:'\u5185\u7f6e \u00b7 \u7ad9\u9177\u5c0f\u8587', stack:'"TM-ZCOOL-XiaoWei","ZCOOL XiaoWei","STKaiti","KaiTi","Noto Serif SC","SimSun",serif' },
    { value:'TM-ZCOOL-QingKe', label:'\u5185\u7f6e \u00b7 \u5e86\u79d1\u9ec4\u6cb9', stack:'"TM-ZCOOL-QingKe","ZCOOL QingKe HuangYou","STKaiti","KaiTi","Noto Serif SC",serif' },
    { value:'TM-MaShanZheng', label:'\u5185\u7f6e \u00b7 \u9a6c\u5584\u653f', stack:'"TM-MaShanZheng","Ma Shan Zheng","STKaiti","KaiTi",serif' },
    { value:'TM-LongCang', label:'\u5185\u7f6e \u00b7 \u9f99\u85cf\u624b\u4e66', stack:'"TM-LongCang","Long Cang","STKaiti","KaiTi",serif' },
    { value:'STKaiti', label:'\u7cfb\u7edf \u00b7 \u6977\u4f53 STKaiti', stack:'"STKaiti","KaiTi","\u6977\u4f53","Noto Serif SC","SimSun",serif' },
    { value:'SimSun', label:'\u7cfb\u7edf \u00b7 \u5b8b\u4f53 SimSun', stack:'"SimSun","Songti SC","Noto Serif SC",serif' },
    { value:'FangSong', label:'\u7cfb\u7edf \u00b7 \u4eff\u5b8b FangSong', stack:'"FangSong","FangSong_GB2312","STFangsong",serif' },
    { value:'Noto Serif SC', label:'\u7cfb\u7edf \u00b7 \u601d\u6e90\u5b8b\u4f53', stack:'"Noto Serif SC","Source Han Serif SC","SimSun",serif' },
    { value:'LXGW WenKai', label:'\u7cfb\u7edf \u00b7 \u971e\u9e5c\u6587\u6977', stack:'"LXGW WenKai","STKaiti","KaiTi",serif' },
    { value:'STXingkai', label:'\u7cfb\u7edf \u00b7 \u884c\u6977', stack:'"STXingkai","KaiTi","STKaiti",serif' },
    { value:'STLiti', label:'\u7cfb\u7edf \u00b7 \u96b6\u4e66', stack:'"STLiti","LiSu","STKaiti",serif' }
  ];
  var FONT_MAP = FONT_OPTIONS.reduce(function(m, f){ m[f.value] = f; return m; }, {});

  var SCOPES = [
    { key:'topbar', label:'\u9876\u90e8\u680f', desc:'\u4e03\u5927\u53d8\u91cf\u3001\u5929\u65f6\u3001\u5b58\u6863\u72b6\u6001', targets:['#bar','.ngui-topbar','.bar-time-pop'] },
    { key:'leftShell', label:'\u5de6\u4fa7\u680f', desc:'\u4eba\u7269\u56fe\u5fd7\u3001\u8206\u56fe\u5de5\u5177\u3001\u4e8b\u4ef6\u5165\u53e3', targets:['.gl','#_shell_extras_left','.gs-left','.left-panel'] },
    { key:'rightRail', label:'\u53f3\u4fa7\u680f', desc:'\u7eb2\u3001\u653f\u3001\u6587\u3001\u81e3\u3001\u519b\u3001\u56fe\u3001\u6237\u3001\u5236\u4e0e\u53f3\u62bd\u5c49', targets:['.gr','#_shell_extras_right','.gs-rail','.right-panel'] },
    { key:'map', label:'\u5929\u4e0b\u8206\u56fe', desc:'\u5730\u56fe\u3001\u5730\u5757\u9875\u3001\u52bf\u529b\u9875', targets:['#map','#mapWrap','#mapPanel','.map-panel','.map-tools','.df-panel','.df-shell','.frp-shell','.province-panel','.faction-panel'] },
    { key:'renwu', label:'\u4eba\u7269\u56fe\u5fd7', desc:'\u4eba\u7269\u5361\u3001\u4eba\u7269\u8be6\u60c5\u3001\u53f3\u62bd\u5c49\u7b80\u8981', targets:['.renwu-page-container','.renwu-page-overlay','.char-detail-panel','.rwp-panel','.rwp-tab','.rwp-section'] },
    { key:'events', label:'\u4e8b\u4ef6\u680f', desc:'\u8fd1\u4e8b\u3001\u90b8\u62a5\u3001\u6d3b\u52a8\u8bb0\u5f55', targets:['.gs-news','.gs-news-item','.tm-cl-panel','.tm-cl-card','.event-panel','.scroll-archive'] },
    { key:'edict', label:'\u64b0\u5199\u8bcf\u4e66', desc:'\u8bcf\u4ee4\u7f16\u8f91\u3001\u5efa\u8bae\u5e93\u3001\u6da6\u8272', targets:['.ed-scroll','.edict-panel','.edict-input','.ed-src','.tm-edict','.imperial-edict'] },
    { key:'memorial', label:'\u767e\u5b98\u594f\u758f', desc:'\u594f\u758f\u5361\u3001\u6279\u793a\u3001\u7559\u4e2d', scaleTargets:['.zou-yuan'], targets:['.mem-panel','.mem-card','.memorial-card','.memorial-content','.bn-panel','.bn-card'] },
    { key:'court', label:'\u95ee\u5bf9\u671d\u8bae', desc:'\u95ee\u5bf9\u3001\u5e38\u671d\u3001\u5ef7\u8bae\u3001\u5fa1\u524d\u4f1a\u8bae', targets:['.wdp-panel','.wendui-chat-area','.wd-modal','.chaoyi-panel','.chaoyi-modal','.cy-panel','.qj-panel'] },
    { key:'letter', label:'\u9e3f\u96c1\u4f20\u4e66', desc:'\u6765\u4fe1\u3001\u5199\u4fe1\u3001\u4fe1\u7b3a\u6b63\u6587', targets:['.hy-panel','.lt-panel','.lt-npc-list','.letter-body','.lt-compose'] },
    { key:'history', label:'\u53f2\u5b98\u5b9e\u5f55', desc:'\u53f2\u8bb0\u3001\u7f16\u5e74\u3001\u8d77\u5c45\u6ce8\u3001\u7eaa\u4e8b\u3001\u56de\u5408\u7ed3\u679c', targets:['.qiju-panel','.qiju-record','.turn-modal','.turn-result','.turn-summary-bar','.narr-shizhengji','.narr-zhengwen','.post-turn-panel','.scroll-manager'] },
    { key:'settings', label:'\u8bbe\u7f6e\u5f39\u7a97', desc:'\u8bbe\u7f6e\u9875\u3001\u66f4\u65b0\u3001\u521b\u610f\u5de5\u574a\u3001\u8d26\u53f7', targets:['.settings-bg','.settings-box','.content-manager-modal','.update-modal','.workshop-modal','.account-modal'] }
  ];

  function sizeButtonRow(current, onclickExpr, extraClass) {
    return '<div class="gs-font-sizes ' + esc(extraClass || '') + '">' +
      ['xs','sm','md','lg','xl'].map(function(k) {
        return '<button type="button" class="gs-sz-btn ' + k + (k === current ? ' active' : '') + '" onclick="' + onclickExpr(k) + '">' + SIZE_LABELS[k] + '</button>';
      }).join('') +
      '</div>';
  }
  function themeCards(savedTheme, fnName) {
    return '<div class="gs-theme-grid tm-settings-theme-grid">' + THEMES.map(function(t) {
      return '<div class="gs-theme-card' + (t.key === savedTheme ? ' active' : '') + '" data-theme="' + esc(t.key) + '" onclick="' + fnName + '(\'' + q(t.key) + '\', this)">' +
        '<div class="gs-theme-swatch">' + t.swatch.map(function(c){ return '<span class="c" style="background:' + esc(c) + ';"></span>'; }).join('') + '</div>' +
        '<div class="gs-theme-name">' + esc(t.label) + '</div><div class="desc">' + esc(t.desc) + '</div></div>';
    }).join('') + '</div>';
  }
  function fontSelect(kind, current) {
    var fn = kind === 'title' ? '_tmApplyTitleFont' : '_tmApplyBodyFont';
    return '<select class="gs-font-select" onchange="' + fn + '(this.value)">' + FONT_OPTIONS.map(function(f) {
      return '<option value="' + esc(f.value) + '"' + (f.value === current ? ' selected' : '') + '>' + esc(f.label) + '</option>';
    }).join('') + '</select>';
  }
  function loadScopeSizes() {
    try {
      var raw = localStorage.getItem('tm.fontSizeScopes');
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch(_) {
      return {};
    }
  }
  function saveScopeSizes(obj) {
    try { localStorage.setItem('tm.fontSizeScopes', JSON.stringify(obj || {})); } catch(_){}
  }

  function renderControls(opts) {
    opts = opts || {};
    var context = opts.context || 'settings';
    var savedTheme = readStore('tm.theme', DEFAULT_THEME);
    var savedSize = readStore('tm.fontSize', DEFAULT_SIZE);
    var savedBody = readStore('tm.fontBody', DEFAULT_BODY);
    var savedTitle = readStore('tm.fontTitle', DEFAULT_TITLE);
    var scoped = loadScopeSizes();
    var compact = context === 'drawer';
    var h = '';
    if (compact) {
      h += '<div class="gs-panel-hdr"><div class="gs-panel-title">\u754c\u9762\u4e3b\u9898</div><span class="gs-panel-cnt">\u7ec6\u8c03</span></div>';
    } else {
      h += '<div class="settings-section tm-settings-theme"><h4>\u4e3b\u9898\u5b57\u53f7</h4>';
      h += '<div class="tm-settings-sub">\u7edf\u4e00\u63a7\u5236\u65b0 UI \u7684\u4e3b\u9898\u3001\u5185\u7f6e\u5b57\u4f53\u3001\u5168\u5c40\u5b57\u53f7\uff0c\u5e76\u53ef\u6309\u5177\u4f53\u754c\u9762\u5355\u72ec\u8c03\u5b57\u53f7\u3002</div>';
    }
    h += '<div class="tm-theme-block"><div class="tm-theme-block-title">\u4e3b\u9898</div>' + themeCards(savedTheme, '_tmApplyTheme') + '</div>';
    h += '<div class="gs-font-row tm-font-global-row"><span class="lbl">\u5168\u5c40</span>' +
      sizeButtonRow(savedSize, function(k){ return "_tmApplySize('" + q(k) + "', this)"; }, 'tm-global-size-buttons') +
      '</div>';
    h += '<div class="gs-font-row"><span class="lbl">\u6b63\u6587</span>' + fontSelect('body', savedBody) + '</div>';
    h += '<div class="gs-font-row"><span class="lbl">\u6807\u9898</span>' + fontSelect('title', savedTitle) + '</div>';
    h += '<div class="tm-scope-size-head"><span>\u5206\u533a\u5b57\u53f7</span><em>\u6309\u65b0 UI \u5b9e\u9645\u6a21\u5757\u5355\u72ec\u8c03\u8282</em></div>';
    h += '<div class="tm-scope-size-grid">';
    SCOPES.forEach(function(s) {
      var cur = scoped[s.key] || 'md';
      h += '<div class="tm-scope-size-card" data-scope="' + esc(s.key) + '"><div class="tm-scope-size-meta"><b>' + esc(s.label) + '</b><em>' + esc(s.desc) + '</em></div>' +
        sizeButtonRow(cur, function(k){ return "_tmApplyScopeSize('" + q(s.key) + "','" + q(k) + "', this)"; }, 'tm-scope-size-buttons') +
        (s.key === 'memorial' ? memorialInkControl() : '') + '</div>';
    });
    h += '</div>';
    if (!compact) h += '</div>';
    return h;
  }

  function applyTheme(name, el, silent) {
    var theme = THEME_MAP[name] || THEME_MAP[DEFAULT_THEME];
    var pal = theme.pal;
    var css = ':root{'
      + '--color-background:' + pal.bg + ';'
      + '--color-surface:' + pal.surface + ';'
      + '--color-foreground:' + pal.fg + ';'
      + '--color-primary:' + pal.primary + ';'
      + '--color-accent:' + pal.accent + ';'
      + '--color-info:' + pal.info + ';'
      + '--color-warning:' + pal.warn + ';'
      + '--gold-400:' + pal.gold2 + ';'
      + '--gold-500:' + pal.gold1 + ';'
      + '--gold-300:' + pal.gold3 + ';'
      + '--vermillion-400:' + pal.verm2 + ';'
      + '--vermillion-500:' + pal.verm1 + ';'
      + '--vermillion-300:' + pal.verm3 + ';'
      + '--celadon-400:' + pal.cela + ';'
      + '--bg-2:' + pal.bg + ';'
      + '--bg-3:' + pal.surface + ';'
      + '}';
    getStyle('_tmThemeOverride').textContent = css;
    writeStore('tm.theme', theme.key);
    if (el) {
      var parent = el.parentElement;
      if (parent) {
        parent.querySelectorAll('.gs-theme-card').forEach(function(c){ c.classList.remove('active'); });
        el.classList.add('active');
      }
    }
    if (!silent) {
      try {
        if (window.ThemeSystem && typeof ThemeSystem.setTheme === 'function') {
          ThemeSystem.setTheme(({ plain:'dark', ink:'sepia', vermillion:'dark', celadon:'green' })[theme.key] || 'dark');
        }
      } catch(_){}
      toastMsg('\u4e3b\u9898 \u00b7 ' + theme.label.replace(/\s+/g, ''));
    }
  }

  function applyGlobalSize(size, el, silent) {
    var s = SIZE_SCALES[size] || SIZE_SCALES[DEFAULT_SIZE];
    var css = ':root{'
      + '--tm-font-global-scale:' + s + ';'
      + '--text-xs:' + (SIZE_BASE.xs*s).toFixed(2) + 'rem;'
      + '--text-sm:' + (SIZE_BASE.sm*s).toFixed(2) + 'rem;'
      + '--text-base:' + (SIZE_BASE.base*s).toFixed(2) + 'rem;'
      + '--text-md:' + (SIZE_BASE.md*s).toFixed(2) + 'rem;'
      + '--text-lg:' + (SIZE_BASE.lg*s).toFixed(2) + 'rem;'
      + '--text-xl:' + (SIZE_BASE.xl*s).toFixed(2) + 'rem;'
      + '--text-2xl:' + (SIZE_BASE.xl2*s).toFixed(2) + 'rem;'
      + '--text-3xl:' + (SIZE_BASE.xl3*s).toFixed(2) + 'rem;'
      + '}';
    getStyle('_tmSizeOverride').textContent = css;
    writeStore('tm.fontSize', size);
    setActiveSize(el);
    if (!silent) toastMsg('\u5b57\u53f7 \u00b7 \u5168\u5c40' + (SIZE_LABELS[size] || SIZE_LABELS.md));
  }

  function setActiveSize(el) {
    if (!el) return;
    var parent = el.parentElement;
    if (!parent) return;
    parent.querySelectorAll('.gs-sz-btn').forEach(function(b){ b.classList.remove('active'); });
    el.classList.add('active');
  }

  function fontStack(font, fallback) {
    return (FONT_MAP[font] && FONT_MAP[font].stack) || fallback || FONT_MAP[DEFAULT_BODY].stack;
  }
  function applyBodyFont(font, silent) {
    var stack = fontStack(font, FONT_MAP[DEFAULT_BODY].stack);
    var css = ':root{--font-serif:' + stack + ';}' +
      'body,button,input,select,textarea,#bar,#bar *,.gl,.gl *,.gr,.gr *,.gs-panel,.gs-panel *,.settings-box,.settings-box *,.renwu-page-container,.renwu-page-container *,.char-detail-panel,.char-detail-panel *,.turn-modal,.turn-modal *{font-family:' + stack + ' !important;}';
    getStyle('_tmBodyFontOverride').textContent = css;
    writeStore('tm.fontBody', font);
    if (!silent) toastMsg('\u6b63\u6587\u5b57\u4f53 \u00b7 ' + ((FONT_MAP[font] && FONT_MAP[font].label) || font));
    try { applyTitleFont(readStore('tm.fontTitle', DEFAULT_TITLE), true); } catch(_){}
  }
  function applyTitleFont(font, silent) {
    var stack = fontStack(font, FONT_MAP[DEFAULT_TITLE].stack);
    var css = '.home-title,.home-card-cn,.turn-summary-bar,.gs-panel-title,.gs-drawer-title,.mem-title,.wdp-title,.hy-title,.bn-title,.rwp-name,.tm-cl-panel-title,.settings-section h4,h1,h2,h3,h4{font-family:' + stack + ' !important;}';
    getStyle('_tmTitleFontOverride').textContent = css;
    writeStore('tm.fontTitle', font);
    if (!silent) toastMsg('\u6807\u9898\u5b57\u4f53 \u00b7 ' + ((FONT_MAP[font] && FONT_MAP[font].label) || font));
  }

  function scopeSelectorCss(scope, scale) {
    var targets = scope.targets || [];
    if (!targets.length) return '';
    var varName = '--tm-size-' + scope.key;
    var rootSel = targets.concat(scope.scaleTargets || []).join(',');
    var textSel = targets.map(function(s){ return s + ' :where(button,input,select,textarea,label,span,em,b,strong,p,li,td,th,.gs-panel-cnt,.gs-news-title,.tm-cl-title,.memorial-content,.letter-body,.qiju-text,.wendui-npc-bubble,.wendui-player-bubble)'; }).join(',');
    var titleSel = targets.map(function(s){ return s + ' :where(h1,h2,h3,h4,.gs-panel-title,.gs-drawer-title,.mem-title,.wdp-title,.hy-title,.bn-title,.rwp-name,.tm-cl-panel-title)'; }).join(',');
    var smallSel = targets.map(function(s){ return s + ' :where(small,.desc,.sub,.meta,.bar-var-name,.bar-var-trend,.rwp-meta,.lt-npc-title,.letter-meta,.qiju-turn)'; }).join(',');
    return rootSel + '{' + varName + ':' + scale + ';}' +
      textSel + '{font-size:calc(var(--text-sm) * var(' + varName + ')) !important;}' +
      titleSel + '{font-size:calc(var(--text-lg) * var(' + varName + ')) !important;}' +
      smallSel + '{font-size:calc(var(--text-xs) * var(' + varName + ')) !important;}';
  }
  function applyScopedSizes() {
    var scoped = loadScopeSizes();
    var css = '';
    SCOPES.forEach(function(scope) {
      var key = scoped[scope.key] || 'md';
      var scale = SIZE_SCALES[key] || SIZE_SCALES.md;
      if (key !== 'md') css += scopeSelectorCss(scope, scale);
    });
    getStyle('_tmScopedSizeOverride').textContent = css;
  }
  function applyScopeSize(scopeKey, size, el) {
    var scoped = loadScopeSizes();
    scoped[scopeKey] = size || 'md';
    saveScopeSizes(scoped);
    applyScopedSizes();
    setActiveSize(el);
    var scope = SCOPES.filter(function(s){ return s.key === scopeKey; })[0];
    toastMsg('\u5b57\u53f7 \u00b7 ' + (scope ? scope.label : scopeKey) + (SIZE_LABELS[size] || SIZE_LABELS.md));
  }
  function restore() {
    var theme = readStore('tm.theme', DEFAULT_THEME);
    var size = readStore('tm.fontSize', DEFAULT_SIZE);
    var body = readStore('tm.fontBody', DEFAULT_BODY);
    var title = readStore('tm.fontTitle', DEFAULT_TITLE);
    applyTheme(theme, null, true);
    applyGlobalSize(size, null, true);
    applyBodyFont(body, true);
    applyTitleFont(title, true);
    applyScopedSizes();
    applyMemorialInk(readStore('tm.memorialInk', 'ink'), true);
  }

  function memorialInkControl() {
    var current = readStore('tm.memorialInk', 'ink');
    return '<label class="tm-memorial-ink-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px">文字颜色' +
      '<select class="gs-font-select" data-memorial-ink aria-label="奏疏文字颜色" onchange="_tmApplyMemorialInk(this.value)">' +
      MEMORIAL_INKS.map(function(p){ return '<option value="' + p.key + '"' + (p.key === current ? ' selected' : '') + '>' + p.label + '</option>'; }).join('') +
      '</select></label>';
  }
  function applyMemorialInk(key, silent) {
    // Presets only: stored/user strings cannot become arbitrary CSS.
    var palette = MEMORIAL_INKS.filter(function(p){ return p.key === key; })[0] || MEMORIAL_INKS[0];
    getStyle('_tmMemorialInkOverride').textContent = ':root{--tm-memorial-ink:' + palette.ink + ';--tm-memorial-ink-soft:' + palette.soft + ';--tm-memorial-ink-muted:' + palette.muted + ';}';
    writeStore('tm.memorialInk', palette.key);
    if (!silent) toastMsg('奏疏文字 · ' + palette.label);
  }

  window.TMThemeFont = {
    version: FONT_VERSION,
    themes: THEMES,
    fonts: FONT_OPTIONS,
    scopes: SCOPES,
    renderControls: renderControls,
    restore: restore,
    applyTheme: applyTheme,
    applySize: applyGlobalSize,
    applyScopeSize: applyScopeSize,
    applyMemorialInk: applyMemorialInk,
    applyBodyFont: applyBodyFont,
    applyTitleFont: applyTitleFont
  };
  window._tmRenderThemeFontControls = renderControls;
  window._tmApplyTheme = applyTheme;
  window._tmApplySize = applyGlobalSize;
  window._tmApplyScopeSize = applyScopeSize;
  window._tmApplyMemorialInk = applyMemorialInk;
  window._tmApplyBodyFont = applyBodyFont;
  window._tmApplyTitleFont = applyTitleFont;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restore, { once:true });
  } else {
    restore();
  }
})();
