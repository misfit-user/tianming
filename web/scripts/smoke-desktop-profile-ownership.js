'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../main.js'), 'utf8');
function fixture(owned, attached = true) {
  const events = [], handlers = new Map();
  const window = { isDestroyed: () => false, isMinimized: () => true,
    restore() { events.push('restore'); }, show() { events.push('show'); }, focus() { events.push('focus'); } };
  const app = { isPackaged: true, requestSingleInstanceLock() { events.push('lock'); return owned; },
    on(name, fn) { handlers.set(name, fn); }, quit() { events.push('quit'); } };
  vm.runInNewContext(source, { process: { env: {} }, console,
    require(name) {
      if (name === 'electron') return { app, BrowserWindow: { getAllWindows: () => [window] } };
      if (name === 'node:inspector') return { url: () => attached ? 'ws://fixture' : undefined, close() { events.push('disconnect'); } };
      assert.equal(name, './main-impl.js'); events.push('load-implementation');
    }
  }, { filename: 'main.js' });
  return { events, handlers };
}
const secondary = fixture(false);
assert.deepEqual(secondary.events, ['lock', 'quit'], 'a duplicate must exit before loading any profile I/O');
assert.equal(secondary.handlers.size, 0);
const primary = fixture(true);
assert.deepEqual(primary.events, ['lock', 'load-implementation']);
assert.equal(primary.handlers.has('before-quit'), false, 'do not disconnect before the save handshake permits exit');
primary.handlers.get('second-instance')();
assert.deepEqual(primary.events.slice(-3), ['restore', 'show', 'focus']);
primary.handlers.get('will-quit')();
assert.equal(primary.events.at(-1), 'disconnect', 'approved quit releases an attached Node debugger');
const ordinary = fixture(true, false); ordinary.handlers.get('will-quit')();
assert.deepEqual(ordinary.events, ['lock', 'load-implementation']);
console.log('[smoke-desktop-profile-ownership] PASS 7 assertions');
