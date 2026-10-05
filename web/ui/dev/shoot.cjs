// 新前端截图：node web/ui/dev/shoot.cjs <出图目录> <页面路径（相对 web/）>... [--size=1920x1080]
// 等 body[data-ready] 到位（页面 ?wait=2 可要求等到 '2'），再等 1.5 秒拍。
// 需要本机已有 playwright-core 与一份 Chromium：路径用环境变量 TM_PLAYWRIGHT_CORE / TM_CHROMIUM 指定，
// 默认取本机 npx 缓存里的那一份。服务：python -m http.server 8794（根为 web/），地址可用 TM_UI_BASE 改。
'use strict';
const path = require('path');
const fs = require('fs');

const core = process.env.TM_PLAYWRIGHT_CORE || 'C:/Users/37814/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core';
const exe = process.env.TM_CHROMIUM || 'C:/Users/37814/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const base = process.env.TM_UI_BASE || 'http://127.0.0.1:8794/';
const { chromium } = require(core);

const args = process.argv.slice(2);
const sizeArg = args.find((a) => a.startsWith('--size='));
const [vw, vh] = (sizeArg ? sizeArg.slice(7) : '1920x1080').split('x').map(Number);
const [out, ...pages] = args.filter((a) => !a.startsWith('--'));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: exe,
    args: ['--disable-gpu-shader-disk-cache', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11']
  });
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  let failed = 0;
  for (const rel of pages) {
    const p = await ctx.newPage();
    const logs = [];
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
    p.on('pageerror', (e) => logs.push('pageerror: ' + e.message.slice(0, 300)));
    const t0 = Date.now();
    await p.goto(base + rel + (rel.includes('?') ? '&' : '?') + 'shot=1', { timeout: 180000 });
    const want = new URLSearchParams(rel.split('?')[1] || '').get('wait') || '1';
    try {
      await p.waitForFunction((w) => document.body && document.body.dataset.ready === w, want, { timeout: 180000 });
    } catch (_e) {
      logs.push('timeout: 页面没有就绪');
      failed++;
    }
    await p.waitForTimeout(1500);
    const name = decodeURIComponent(rel).replace(/^ui\//, '').replace(/\.html/, '').replace(/[\/?=&{}\[\]",:]/g, '-').replace(/-+/g, '-').replace(/-$/, '').slice(0, 90) + `-${vw}x${vh}.png`;
    await p.screenshot({ path: path.join(out, name) });
    console.log(`${rel} → ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    logs.filter((l) => !/favicon/.test(l)).slice(0, 12).forEach((l) => console.log('  ' + l));
    await p.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
