#!/usr/bin/env node
'use strict';

const path = require('path');
const { createOnlineClient } = require(path.resolve(__dirname, '..', 'tm-online-client.js'));

let assertions = 0;
function ok(value, label) {
  if (!value) throw new Error('[smoke-online-desktop-token-boundary] ' + label);
  assertions++;
}

async function main() {
  const memory = {
    tm_online_session: JSON.stringify({ token: 'legacy-renderer-secret', user: { id: 1 } }),
    tm_online_api_url: 'https://attacker.invalid/'
  };
  const calls = [];
  const bridge = {
    accountSession: async () => ({ success: true, session: { loggedIn: true, user: { id: 7, username: '史官' }, loggedInAt: 'now' } }),
    accountLogout: async () => ({ success: true }),
    onlineRequest: async (method, pathname, body) => {
      calls.push({ method, pathname, body });
      if (pathname === 'account/login') {
        return { success: true, user: { id: 7, username: '史官' }, session: { loggedIn: true, user: { id: 7, username: '史官' }, loggedInAt: 'later' } };
      }
      return { success: true, friends: [] };
    }
  };
  const storage = {
    getItem: key => Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null,
    setItem: (key, value) => { memory[key] = String(value); },
    removeItem: key => { delete memory[key]; }
  };
  const client = createOnlineClient({ desktopBridge: bridge, storage, fetch: () => { throw new Error('desktop must not fetch directly'); } });
  await Promise.resolve();
  await Promise.resolve();

  ok(!Object.prototype.hasOwnProperty.call(memory, 'tm_online_session'), 'desktop startup removes legacy renderer token storage');
  ok(client.isLoggedIn() && client.getSession().user.id === 7, 'desktop exposes public login state and identity');
  ok(client.getToken() === '' && !Object.prototype.hasOwnProperty.call(client.getSession(), 'token'), 'desktop API never exposes bearer token');

  const login = await client.login({ username: '史官', password: 'secret' });
  ok(login.success && client.getSession().loggedIn, 'desktop login consumes sanitized main-process response');
  await client.friends();
  ok(calls.some(call => call.method === 'POST' && call.pathname === 'account/login')
    && calls.some(call => call.method === 'GET' && call.pathname === 'friends'), 'desktop online calls use the fixed IPC proxy');
  ok(calls.every(call => !call.body || !Object.prototype.hasOwnProperty.call(call.body, 'token')), 'renderer never sends bearer token through IPC payloads');

  console.log('[smoke-online-desktop-token-boundary] PASS assertions=' + assertions);
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
