'use strict';
const assert = require('assert/strict');
const { createAccountRequests } = require('../../main-account-requests');
function harness() {
  let session = { token: 'test-A', user: { id: 'A' } }, failWrite = false, failClear = false;
  const pending = [];
  const q = createAccountRequests({ read: () => structuredClone(session), write: next => { if (failWrite) throw new Error('disk'); session = structuredClone(next); },
    clear: () => { if (failClear) throw new Error('disk'); session = { token: '', user: null }; }, publicSession: value => ({ loggedIn: !!value.token, user: value.user }),
    sanitize: value => { const result = { ...value }; delete result.token; return result; },
    send: (req, body, options) => new Promise((resolve, reject) => pending.push({ req, options, resolve, reject })) });
  return { call: (route, method = 'POST') => q.request({ route, pathname: route, method }, {}), pending, read: () => session,
    failWrite: () => { failWrite = true; }, failClear: () => { failClear = true; } };
}
(async () => {
  for (const oldRoute of ['account/me', 'account/set-email', 'account/logout', 'account/login']) {
    const h = harness(); const old = h.call(oldRoute); const next = h.call('account/login');
    h.pending[1].resolve({ success: true, token: 'test-B', user: { id: 'B' } });
    const current = await next; assert.equal(current.session.user.id, 'B'); assert.ok(!JSON.stringify(current).includes('test-B'));
    h.pending[0].resolve({ success: true, token: 'test-A', user: { id: 'A' } });
    assert.equal((await old).code, 'account-operation-stale'); assert.equal(h.read().user.id, 'B');
  }
  const h = harness(), login = h.call('account/email-login'), logout = h.call('account/logout');
  h.pending[1].resolve({ success: true }); await logout;
  h.pending[0].resolve({ success: true, token: 'late', user: { id: 'late' } }); assert.equal((await login).stale, true); assert.equal(h.read().token, '');
  const w = harness(); w.failWrite(); const attempt = w.call('account/register');
  w.pending[0].resolve({ success: true, token: 'test-B', user: { id: 'B' } });
  const failed = await attempt; assert.equal(failed.success, false); assert.equal(failed.session.user.id, 'A'); assert.equal(w.read().user.id, 'A');
  const c = harness(); c.failClear(); assert.equal((await c.call('account/logout')).success, false); assert.equal(c.pending.length, 0); assert.equal(c.read().user.id, 'A');
  const n = harness(), out = n.call('account/logout'); n.pending[0].reject(new Error('offline'));
  assert.equal((await out).remoteRevoked, false); assert.equal(n.read().token, '');
  // Exercise both public IPC families and the real atomic session writer, not just the coordinator.
  const createMain = require('./lib-audit-main');
  const pending = [];
  const main = createMain({ requireOverrides: { './main-safe-remote.js': { createSafeRemote: () => ({
    fetchRemoteResponse: (url, init) => new Promise(resolve => pending.push({ url, init,
      reply: body => resolve({ url, response: new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }) }) }))
  }) } } });
  try {
    const a = main.invoke('account-login', { username: 'test-A', password: 'fixture' });
    pending[0].reply({ success: true, token: 'fixture-token-A', user: { id: 'A' } }); await a;
    const oldMe = main.invoke('online-request', { method: 'GET', pathname: 'account/me' });
    assert.equal(pending[1].init.headers.Authorization, 'Bearer fixture-token-A');
    const b = main.invoke('account-login', { username: 'test-B', password: 'fixture' });
    assert.equal(pending[2].init.headers.Authorization, undefined, 'login is anonymous even when another session exists');
    pending[2].reply({ success: true, token: 'fixture-token-B', user: { id: 'B' } }); await b;
    pending[1].reply({ success: true, user: { id: 'A' } });
    assert.equal((await oldMe).code, 'account-operation-stale');
    const view = await main.invoke('account-session');
    assert.equal(view.session.user.id, 'B'); assert.ok(!JSON.stringify(view).includes('fixture-token'));
    const oldRename = main.io.renameSync;
    main.io.renameSync = () => { throw new Error('injected atomic session write failure'); };
    const c = main.invoke('account-login', { username: 'test-C', password: 'fixture' });
    pending[3].reply({ success: true, token: 'fixture-token-C', user: { id: 'C' } });
    assert.equal((await c).code, 'account-session-write-failed');
    assert.equal((await main.invoke('account-session')).session.user.id, 'B');
    main.io.renameSync = oldRename;
    main.io.rmSync = () => { throw new Error('injected session clear failure'); };
    assert.equal((await main.invoke('account-logout')).code, 'account-session-clear-failed');
    assert.equal((await main.invoke('account-session')).session.user.id, 'B');
    assert.equal(pending.length, 4, 'failed durable logout must not start remote revocation');
    const health = main.invoke('online-request', { method: 'GET', pathname: 'health' });
    assert.equal(pending[4].init.headers.Authorization, undefined);
    pending[4].reply({ success: true, status: 'healthy' });
    const status = await health; assert.equal(status.status, 'healthy'); assert.equal(status.session, undefined);
  } finally { main.cleanup(); }
  console.log('PASS account generation: stale me/email/logout/login, inverse login, durable failure and token isolation');
})().catch(error => { console.error(error); process.exitCode = 1; });
