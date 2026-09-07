'use strict';

function createAccountRequests(d) {
  let generation = 0;
  const loginRoutes = new Set(['account/login', 'account/register', 'account/email-login']);
  const anonymous = new Set(['health', 'account/email-code', ...loginRoutes, 'account/request-reset', 'account/reset']);
  function publicResult(response) {
    const session = d.publicSession(d.read());
    return Object.assign({ success: false }, d.sanitize(response || {}), { session, loggedIn: session.loggedIn });
  }
  // Last accepted authentication/profile intention wins, including failed login attempts.
  // Reads capture both generation and exact session token; tokens never leave this module's response boundary.
  async function request(req, body) {
    const login = loginRoutes.has(req.route), logout = req.route === 'account/logout';
    if (login || logout || req.route === 'account/set-email') generation++;
    const lease = generation;
    const captured = d.read();
    const current = () => lease === generation && (login || logout || d.read().token === captured.token);
    const stale = () => publicResult({ success: false, stale: true, code: 'account-operation-stale' });
    if (logout) {
      try { d.clear(); }
      catch (_) { return publicResult({ success: false, code: 'account-session-clear-failed', error: '退出失败：本地会话无法清除' }); }
    }
    let response;
    try {
      response = await d.send(req, body, { token: anonymous.has(req.route) ? '' : captured.token });
    } catch (error) {
      if (!current()) return stale();
      if (logout) return publicResult({ success: true, remoteRevoked: false, warning: '本地已退出，远程会话撤销未确认' });
      throw error;
    }
    if (!current()) return stale();
    try {
      if (response && response.success && response.token && login) d.write({ token: response.token, user: response.user || null });
      else if (response && response.success && response.user && ['account/me', 'account/set-email'].includes(req.route) && captured.token) {
        d.write(Object.assign({}, captured, { user: response.user }));
      }
    } catch (_) { return publicResult({ success: false, code: 'account-session-write-failed', error: '账号响应未保存，请重试' }); }
    return publicResult(response);
  }
  return { request };
}
module.exports = { createAccountRequests };
