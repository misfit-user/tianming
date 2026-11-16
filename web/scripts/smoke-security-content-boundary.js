#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const mapSource = fs.readFileSync(path.join(WEB, 'map-display.js'), 'utf8');
const interactiveMapSource = fs.readFileSync(path.join(WEB, 'tm-map-system.js'), 'utf8');
const saveSource = fs.readFileSync(path.join(WEB, 'tm-save-manager.js'), 'utf8');
const saveLifecycleSource = fs.readFileSync(path.join(WEB, 'tm-save-lifecycle.js'), 'utf8');
const launchSource = fs.readFileSync(path.join(WEB, 'tm-launch.js'), 'utf8');
let assertions = 0;

function ok(value, label) {
  if (!value) throw new Error('[smoke-security-content-boundary] ' + label);
  assertions++;
}

function runRecentSaveCardProbe() {
  const marker = '<img src=x onerror="globalThis.__owned=1">';
  const saveName = '<script>globalThis.__owned=2</script>';
  const nodes = [];
  let htmlWrites = 0;

  function makeNode(tag) {
    const node = {
      tagName: String(tag).toUpperCase(),
      className: '',
      children: [],
      attributes: {},
      textContent: '',
      appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      remove() { this.removed = true; },
      click() { this.clicked = true; }
    };
    Object.defineProperty(node, 'innerHTML', {
      set() { htmlWrites++; },
      get() { return ''; }
    });
    nodes.push(node);
    return node;
  }

  const host = makeNode('div');
  const empty = makeNode('div');
  const loadButton = makeNode('button');
  const document = {
    createElement: makeNode,
    getElementById(id) {
      return id === 'home-recent' ? host : id === 'home-recent-empty' ? empty : id === 'btn-load-save' ? loadButton : null;
    }
  };
  const localStorage = {
    getItem(key) {
      if (key !== 'tm_save_index') return null;
      return JSON.stringify({ slot_1: { timestamp: 9, eraName: marker, turn: 0, name: saveName } });
    }
  };
  const start = indexSource.indexOf('(function fillHomeRecent(){');
  const end = indexSource.indexOf('})();', start);
  ok(start >= 0 && end > start, '首页最近存档渲染器可定位');
  vm.runInNewContext(indexSource.slice(start, end + 5), { document, localStorage, JSON, Object });

  ok(host.children.length === 1 && htmlWrites === 0, '最近存档卡只用 DOM 节点构造，不写 innerHTML');
  const card = host.children[0];
  ok(card.children[1].children[0].textContent === marker, '恶意时代名只进入 textContent');
  ok(card.children[1].children[1].textContent === saveName, '恶意存档名只进入 textContent');
}

function runMapDetailsProbe() {
  const name = '<img src=x onerror=owned()>幽州';
  const ctx = {
    console,
    P: {},
    GM: {
      provinceStats: {
        [name]: { population: 0, prosperity: 0, taxRevenue: 0, governor: '<marquee>太守</marquee>' }
      },
      chars: [{ alive: true, name: '<object>人物</object>', location: name }]
    },
    _isSameLocation: () => true,
    getTerrainName: () => '<svg onload=owned()>山地</svg>'
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(mapSource, ctx);
  const html = ctx.showProvinceDetails({
    name,
    owner: '<script>owned()</script>',
    terrain: 'mountain',
    resources: ['<b>铁</b>'],
    development: 0,
    troops: 0,
    characters: ['<iframe>守将</iframe>'],
    events: '<script>owned()</script>\n次行'
  });
  ok(!/<(?:script|img|iframe|object|svg|marquee)\b/i.test(html), '地图详情不生成来自数据的活动标签');
  ok(html.includes('&lt;img') && html.includes('&lt;script&gt;') && html.includes('&lt;iframe&gt;'), '地图字段在拼接前统一 HTML 转义');
  ok(html.includes('发展度：</strong>0/100') && html.includes('繁荣度：0/100'), '地图详情保留合法零值');
  ok(html.includes('&lt;script&gt;owned()&lt;/script&gt;<br>次行'), '历史换行只在转义后转换为 br');
}

function runInteractiveMapProbe() {
  let htmlWrites = 0;
  const createdTags = [];
  function makeNode(tag, text) {
    const node = {
      tagName: String(tag || '').toUpperCase(),
      textContent: text == null ? '' : String(text),
      children: [],
      style: {},
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren() { this.children = Array.prototype.slice.call(arguments); }
    };
    Object.defineProperty(node, 'innerHTML', { set() { htmlWrites++; }, get() { return ''; } });
    if (tag) createdTags.push(node.tagName);
    return node;
  }
  const info = makeNode('section');
  const document = {
    getElementById(id) { return id === 'map-region-info' ? info : null; },
    createElement(tag) { return makeNode(tag); },
    createTextNode(text) { return makeNode('', text); }
  };
  const start = interactiveMapSource.indexOf('var InteractiveMap = {');
  const end = interactiveMapSource.indexOf('\n};\n', start); // 对象字面量之后第一个顶格的 };
  ok(start >= 0 && end > start, '交互地图对象可定位');
  const ctx = { document, getLiveMapData: () => ({ regions: [] }), Math, String };
  vm.runInNewContext(interactiveMapSource.slice(start, end + 3), ctx);
  const marker = '<img src=x onerror="globalThis.__owned=1">';
  ctx.InteractiveMap.showRegionInfo({ name: marker, controller: '<script>owned()</script>', population: 0, income: 0, desc: marker });
  function flatten(node) { return node.textContent + node.children.map(flatten).join(''); }
  const rendered = flatten(info);
  ok(htmlWrites === 0, '交互地图地区详情不写动态 innerHTML');
  ok(rendered.includes(marker) && rendered.includes('<script>owned()</script>'), '恶意地区字段只作为文本显示');
  ok(rendered.includes('人口: 0') && rendered.includes('收入: 0'), '交互地图保留人口和收入零值');
  ok(createdTags.every(tag => ['SECTION', 'H4', 'DIV', 'STRONG'].includes(tag)), '地区字段不会创建活动 DOM 标签');
}

function runDesktopFallbackSaveProbe() {
  const marker = '<img src=x onerror="globalThis.__tmFallbackOwned=1">';
  const scenarioMarker = '<script>globalThis.__tmFallbackOwned=2</script>';
  const nodesById = Object.create(null);
  const createdTags = [];
  let htmlWrites = 0;
  let loadRequest = null;
  let deleteRequest = null;

  function makeNode(tag) {
    const node = {
      tagName: String(tag || '').toUpperCase(),
      children: [],
      style: {},
      textContent: '',
      className: '',
      value: '',
      listeners: Object.create(null),
      appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
      addEventListener(type, handler) { this.listeners[type] = handler; }
    };
    Object.defineProperty(node, 'lastChild', { get() { return this.children[this.children.length - 1] || null; } });
    Object.defineProperty(node, 'innerHTML', {
      set() { htmlWrites++; },
      get() { return ''; }
    });
    if (tag) createdTags.push(node.tagName);
    return node;
  }

  nodesById.G = makeNode('main');
  const document = { createElement: makeNode };
  const context = {
    document,
    window: {
      desktopLoadSave(value) { loadRequest = value; },
      desktopDeleteSave(value) { deleteRequest = value; }
    },
    showPanel(root) {
      ok(root && root.tagName === 'DIV' && root.id === 'tm-desktop-save-panel', '降级面板传入真实 DOM 根节点');
      nodesById['tm-desktop-save-panel'] = root;
    },
    _$: id => nodesById[id] || null,
    importSaveFile() {},
    showMain() {},
    Number,
    String,
    Math
  };
  context.window.window = context.window;
  const start = saveLifecycleSource.indexOf('function _tmDesktopSavePanelRoot(');
  const end = saveLifecycleSource.indexOf('\ndoSaveGame=async function()', start);
  ok(start >= 0 && end > start, '桌面存档降级渲染器可定位');
  const fallbackSource = saveLifecycleSource.slice(start, end);
  ok(!/\.innerHTML\s*=|insertAdjacentHTML|onclick\s*=/.test(fallbackSource), '桌面存档降级路径无动态 HTML 或内联事件处理器');
  vm.runInNewContext(fallbackSource, context);
  const file = {
    name: marker,
    storageKey: 'save-safe-key',
    modifiedStr: '某日',
    size: 1024,
    meta: { scenario: scenarioMarker, turn: 0 }
  };
  context._tmShowDesktopLoadFallback([file]);

  function flatten(node) {
    return String(node && node.textContent || '') + (node && node.children || []).map(flatten).join('');
  }
  const root = nodesById['tm-desktop-save-panel'];
  const rendered = flatten(root);
  ok(htmlWrites === 0, '恶意存档元数据渲染期间不写 innerHTML');
  ok(rendered.includes(marker) && rendered.includes(scenarioMarker), '存档名和剧本名仅作为文本完整显示');
  ok(!createdTags.includes('IMG') && !createdTags.includes('SCRIPT'), '恶意元数据不会创建活动 DOM 节点');
  const buttons = [];
  (function collect(node) {
    if (!node) return;
    if (node.tagName === 'BUTTON') buttons.push(node);
    (node.children || []).forEach(collect);
  })(root);
  buttons[0].listeners.click();
  buttons[1].listeners.click();
  ok(loadRequest && loadRequest.storageKey === file.storageKey && deleteRequest && deleteRequest.storageKey === file.storageKey,
    '降级列表通过闭包事件传递存档标识，不拼接可执行代码');
}

ok(/http-equiv=["']Content-Security-Policy["']/i.test(indexSource)
  && /object-src 'none'/.test(indexSource) && /base-uri 'none'/.test(indexSource), '首页声明 CSP 基础纵深防护');
ok(!/span\.innerHTML\s*=/.test(indexSource.slice(indexSource.indexOf('(function fillHomeRecent(){'), indexSource.indexOf('})();', indexSource.indexOf('(function fillHomeRecent(){')))),
  '首页最近存档源码不回退到动态 innerHTML');
ok(/function _saveEsc\(/.test(saveSource) && /_saveEsc\(save\.name/.test(saveSource)
  && /_saveEsc\(save\.scenarioName/.test(saveSource), '存档管理器对导入元数据做输出编码');
ok(/data-scenario-id/.test(launchSource) && /addEventListener\(['"]click['"]/.test(launchSource)
  && !/onclick=["'][^"']*\+\s*(?:sid|scenarioId)/.test(launchSource), '剧本入口用 data 属性和闭包绑定，不拼动态脚本');

runRecentSaveCardProbe();
runMapDetailsProbe();
runInteractiveMapProbe();
runDesktopFallbackSaveProbe();

console.log('[smoke-security-content-boundary] PASS assertions=' + assertions);
