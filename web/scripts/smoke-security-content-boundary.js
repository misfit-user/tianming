#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const mapSource = fs.readFileSync(path.join(WEB, 'map-display.js'), 'utf8');
const saveSource = fs.readFileSync(path.join(WEB, 'tm-save-manager.js'), 'utf8');
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

console.log('[smoke-security-content-boundary] PASS assertions=' + assertions);
