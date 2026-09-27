#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function ruleBody(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(escaped + '\\s*\\{([^}]+)\\}'));
  return match ? match[1] : '';
}

const manager = read('tm-content-manager.js') + '\n' + read('tm-content-manager-community.js');
const mallCss = read('tm-online-mall.css');
const index = read('index.html');
const verifyAll = read('scripts/verify-all.js');

assert(
  manager.includes('<main class="tm-mall tm-mall-page atelier-shell" role="main" aria-label="'),
  'content manager should render the workshop as a full-page main surface'
);
assert(
  !manager.includes('<div class="tm-mall" role="dialog" aria-modal="true"'),
  'top-level creative workshop should not keep popup dialog markup'
);
assert(
  manager.includes('</main>'),
  'full-page workshop shell should close the main element'
);

const bgRule = ruleBody(mallCss, '#tm-content-bg.tm-online-shell-bg');
assert(bgRule, 'workshop background override should target the content manager layer');
assert(/align-items\s*:\s*stretch/.test(bgRule), 'content manager layer should stretch children vertically');
assert(/justify-content\s*:\s*stretch/.test(bgRule), 'content manager layer should stretch children horizontally');
assert(/overflow\s*:\s*hidden/.test(bgRule), 'full-page layer should own overflow');

const pageRule = ruleBody(mallCss, '#tm-content-bg.tm-online-shell-bg>.tm-mall.tm-mall-page');
assert(pageRule, 'full-page workshop rule should target the rendered mall page');
[
  /width\s*:\s*100%/,
  /height\s*:\s*100%/,
  /max-width\s*:\s*none/,
  /max-height\s*:\s*none/,
  /border\s*:\s*none/
].forEach((pattern) => assert(pattern.test(pageRule), 'full-page workshop missing CSS: ' + pattern));

assert(
  /#tm-content-bg \.tm-mall\.tm-mall-page \.topbar/.test(mallCss),
  'full-page workshop should have a dedicated topbar layout'
);
assert(
  /@media\(max-width:900px\)[\s\S]*\.tm-mall\.tm-mall-page \.gsearch/.test(mallCss),
  'full-page workshop should keep search usable on narrow viewports'
);
assert(
  /tm-online-mall\.css\?v=[A-Za-z0-9_.-]+/.test(index),
  'index should bust cached mall CSS after the full-page fix'
);
assert(
  verifyAll.includes('smoke-content-manager-workshop-fullpage.js'),
  'verify-all should include creative workshop full-page smoke'
);

console.log('smoke-content-manager-workshop-fullpage ok');
