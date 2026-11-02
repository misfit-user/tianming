// 开机自检：载入新前端，等 body[data-ready]，收集页面错误与控制台报错，打印 ready 状态。门禁看到「ready 1」算过。
// node tools/newui/bootcheck.cjs；需要本机服务（web/ 下 python -m http.server 8794），路径同 web/ui/dev/shoot.cjs。
'use strict';
const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const { chromium } = require(core);
(async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 400)));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
  p.on('requestfailed', (r) => errs.push('reqfail ' + r.url().slice(-80)));
  await p.goto('http://127.0.0.1:8794/index.html?ui=new', { timeout: 120000 });
  for (let i = 0; i < 20; i++) {
    const r = await p.evaluate(() => document.body.dataset.ready || '');
    if (r === '1') { console.log('ready after', i * 3, 's'); break; }
    await p.waitForTimeout(3000);
  }
  console.log('ready', await p.evaluate(() => document.body.dataset.ready || '(none)'));
  errs.slice(0, 30).forEach((e) => console.log(e));
  await b.close();
})();
