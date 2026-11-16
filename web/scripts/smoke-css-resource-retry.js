#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) {
    console.error('[smoke-css-resource-retry] FAIL:', msg);
    process.exit(1);
  }
}

const index = read('index.html');

const helperMatch = index.match(/<script>\s*([\s\S]*?TM_CSS_RETRY[\s\S]*?)<\/script>/);
assert(helperMatch, 'index.html should contain an inline CSS retry helper script');

const timers = [];
const sandbox = {
  window: { console: { warn: function(){} } },
  console: { warn: function(){} },
  Date: { now: function(){ return 12345; } },
  setTimeout: function(fn, delay) {
    timers.push({ fn, delay });
    return timers.length;
  },
  clearTimeout: function(){},
};
vm.createContext(sandbox);
vm.runInContext(helperMatch[1], sandbox);
assert(typeof sandbox.window.TM_CSS_RETRY === 'function', 'retry helper should install window.TM_CSS_RETRY');

const fakeLink = {
  href: 'styles.css?v=x',
  _attrs: {
    href: 'styles.css?v=x',
    'data-css-base': 'styles.css?v=x',
    'data-css-fallback': 'https://cdn.example/styles.css?v=x',
  },
  getAttribute: function(name) { return this._attrs[name] || ''; },
  setAttribute: function(name, value) { this._attrs[name] = String(value); },
};
sandbox.window.TM_CSS_RETRY(fakeLink);
assert(timers.length === 1 && timers[0].delay === 1000, 'first retry should be quick');
timers.shift().fn();
assert(/styles\.css\?v=x&cssRetry=12345-1/.test(fakeLink.href), 'first retry should reuse primary CSS URL with cache-bust');
sandbox.window.TM_CSS_RETRY(fakeLink);
timers.shift().fn();
sandbox.window.TM_CSS_RETRY(fakeLink);
timers.shift().fn();
assert(/^https:\/\/cdn\.example\/styles\.css\?v=x&cssRetry=12345-3/.test(fakeLink.href), 'third retry should switch to fallback CSS URL');

console.log('[smoke-css-resource-retry] PASS');
