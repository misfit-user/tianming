// 新前端入口：index.html 在开关开着（?ui=new 或 localStorage tm_ui=new）时动态载入这里。
// 老内核照旧由 index.html 载入；这里挂上新前端自己的样式与根节点，再按模式起步。
//   默认：应用壳（启幕 → 御案 …）
//   ?bench=kernel：适配层台（开天启、读数、存读档），开发自检用
import { installViewport } from './core/viewport.js';
import { installSettings } from './core/settings.js';
import { installOrnaments, installTiao } from './kit/index.js';

const base = new URL('./', import.meta.url).href;

function addStyle(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = base + href;
  link.dataset.newui = '1';                     // 停用老样式表时认得出自己的
  document.head.append(link);
  return new Promise((resolve) => { link.onload = resolve; link.onerror = resolve; });
}

async function start() {
  await Promise.all(['kit/tokens.css', 'kit/fonts.css', 'kit/qi.css', 'scene/scene.css', 'screens/screens.css', 'screens/docket.css', 'screens/issues.css', 'screens/atlas.css', 'screens/edict.css', 'screens/letters.css', 'screens/audience.css', 'screens/offices.css'].map(addStyle));
  const root = document.createElement('div');
  root.id = 'tm-newui-root';
  root.className = 'q-root';
  document.body.append(root);
  installViewport();
  installSettings();
  installOrnaments();
  installTiao();
  const mode = new URLSearchParams(location.search).get('bench');
  if (mode === 'kernel') {
    const { runKernelBench } = await import('./dev/kernel-bench.js');
    await runKernelBench(root);
    return;
  }
  const { startApp } = await import('./app.js');
  await startApp(root);
}

start().catch((err) => {
  console.error('[newui] 启动失败', err);
  document.body.dataset.newuiError = String(err && err.message || err);
});
