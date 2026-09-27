'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');
const backup=path.join(__dirname,'backups/party');fs.mkdirSync(backup,{recursive:true});
function edit(file,fn){const p=path.join(root,file),b=fs.readFileSync(p),out=fn(b.toString('utf8'));const dest=path.join(backup,path.basename(file));if(!fs.existsSync(dest))fs.writeFileSync(dest,b);fs.writeFileSync(p,out);}
function replace(s,a,b){if(!s.includes(a))throw Error('Missing edit anchor: '+a.slice(0,100));return s.replace(a,b);}
edit('web/tm-class-engine.js',s=>{
 s=replace(s,'cohesion: parseTurnNumber(p.cohesion) || 50,',"cohesion: p.cohesion != null && p.cohesion !== '' && isFinite(Number(p.cohesion)) ? Number(p.cohesion) : 50,");
 s=replace(s,'var oldC = parseTurnNumber(ps.cohesion);','var oldC = Number(ps.cohesion);');
 s=replace(s,'var nextC = clamp(oldC + partyDelta, 0, 100);\n      ps.cohesion = nextC;', 'var nextC = Math.round(clamp(oldC + partyDelta, 0, 100) * 100) / 100;\n      partyDelta = Math.round((nextC - oldC) * 100) / 100;\n      if (!partyDelta) return;\n      ps.cohesion = nextC;');
 s=replace(s,'// 稳定器（结构回归）走闸外：它是恢复通道，自身限幅 ±1.2。','// 稳定器（结构回归）走闸外；事件预算按净额计算，压力后的纾解仍可生效。');
 s=replace(s,`    if (!cls._satBudget || cls._satBudget.turn !== turn) cls._satBudget = { turn: turn, used: 0 };
    var room = Math.max(0, budget - cls._satBudget.used);
    var approved = clamp(d, -room, room);`, `    if (!cls._satBudget || cls._satBudget.turn !== turn) cls._satBudget = { turn: turn, version: 2, net: 0, uncertainty: 0, used: 0 };
    var account = cls._satBudget;
    if (account.version !== 2 || !isFinite(account.net) || !isFinite(account.uncertainty)) {
      // 旧账只存绝对额：近账完整时还原净额；截断的未知部分保留上下界，不能读档后凭空重发预算。
      var spent = Math.max(0, Number(account.used) || 0), known = 0, magnitude = 0;
      toArray(cls._satLedger).forEach(function(entry) {
        if (!entry || Number(entry.t) !== turn || entry.src === 'struct-drift') return;
        var delta = Number(entry.d);
        if (!isFinite(delta)) return;
        known += delta; magnitude += Math.abs(delta);
      });
      if (!isFinite(spent)) spent = budget;
      if (magnitude > spent + 0.01) { known = 0; magnitude = 0; }
      account = cls._satBudget = { turn: turn, version: 2, net: known, uncertainty: Math.max(0, spent - magnitude), used: spent };
    }
    var downRoom = Math.max(0, budget + account.net - account.uncertainty);
    var upRoom = Math.max(0, budget - account.net - account.uncertainty);
    var approved = clamp(d, -downRoom, upRoom);`);
 s=replace(s,'    cls._satBudget.used += Math.abs(approved);','    account.net = Math.round((account.net + approved) * 100) / 100;\n    account.used = Math.round((account.used + Math.abs(approved)) * 100) / 100;');
 return s;
});
edit('web/tm-party-class-llm-calibrator.js',s=>{
 s=replace(s,'  function applyPartyUpdate(root, update, turn, sourceName) {',`  function mergePartyUpdates(root, updates) {
    var groups = [];
    toArray(updates).forEach(function(update) {
      update = update || {};
      var party = findParty(root, update.party || update.partyName || update.name);
      if (!party) return;
      var group = groups.find(function(row) { return row.party === party; });
      if (!group) { group = { party: party, update: { party: partyNameOf(party) }, delta: 0, target: null, seen: [] }; groups.push(group); }
      var agenda = textOf(update.currentAgenda || update.agenda), goal = textOf(update.shortGoal || update.goal);
      var delta = Number(update.cohesionDelta != null ? update.cohesionDelta : update.cohesion_delta);
      var target = update.cohesion != null && update.cohesion !== '' ? Number(update.cohesion) : NaN;
      var key = JSON.stringify([agenda, goal, isFinite(delta) ? delta : null, isFinite(target) ? target : null, textOf(update.reason)]);
      if (group.seen.indexOf(key) >= 0) return;
      group.seen.push(key);
      if (agenda) group.update.currentAgenda = agenda;
      if (goal) group.update.shortGoal = goal;
      if (update.reason) group.update.reason = textOf(update.reason);
      // 同条绝对目标沿用覆盖 delta 的语义；同党同批只结一次有界净调整。
      if (isFinite(target)) group.target = clamp(target, 0, 100);
      else if (isFinite(delta)) group.delta += delta;
    });
    return groups.map(function(group) {
      var before = Number(group.party.cohesion);
      if (!isFinite(before)) before = 50;
      group.update.cohesionDelta = group.delta + (group.target == null ? 0 : group.target - before);
      return group.update;
    });
  }

  function applyPartyUpdate(root, update, turn, sourceName) {`);
 s=replace(s,`    var cohesionDelta = Number(update.cohesionDelta != null ? update.cohesionDelta : update.cohesion_delta);
    if (isFinite(cohesionDelta) && cohesionDelta) {
      var cohesion = Number(party.cohesion);
      if (!isFinite(cohesion)) cohesion = 50;
      party.cohesion = Math.round(clamp(cohesion + clamp(cohesionDelta, -15, 15), 0, 100) * 100) / 100;
      changed = true;
    }
    if (update.cohesion != null) {
      party.cohesion = Math.round(clamp(update.cohesion, 0, 100) * 100) / 100;
      changed = true;
    }`, `    var cohesionDelta = Number(update.cohesionDelta != null ? update.cohesionDelta : update.cohesion_delta);
    if (isFinite(cohesionDelta) && cohesionDelta) {
      var cohesion = Number(party.cohesion);
      if (!isFinite(cohesion)) cohesion = 50;
      var budget = party._cohesionCalibrationBudget;
      if (!budget || budget.turn !== turn || !isFinite(budget.net)) budget = party._cohesionCalibrationBudget = { turn: turn, net: 0 };
      var approved = clamp(clamp(cohesionDelta, -15, 15), -15 - budget.net, 15 - budget.net);
      var after = Math.round(clamp(cohesion + approved, 0, 100) * 100) / 100;
      approved = Math.round((after - cohesion) * 100) / 100;
      if (approved) {
        party.cohesion = after;
        budget.net = Math.round((budget.net + approved) * 100) / 100;
        var state = root.partyState && root.partyState[partyNameOf(party)];
        if (state) {
          state.cohesion = after;
          state._synced_cohesion = after;
          state.historyLog = toArray(state.historyLog);
          state.historyLog.push({ turn: turn, field: 'cohesion', delta: approved, source: sourceName, reason: update.reason || '党派校准' });
          if (state.historyLog.length > 20) state.historyLog = state.historyLog.slice(-20);
        }
        changed = true;
      }
    }`);
 s=replace(s,'    result.party_updates.forEach(function(update) {','    mergePartyUpdates(source, result.party_updates).forEach(function(update) {');
 s=replace(s,"      'Never return absolute satisfaction values; use satisfactionDelta only. Class mood must move gradually with evidence.',","      'Never return absolute satisfaction or cohesion values; use satisfactionDelta or cohesionDelta only. Mood and cohesion must move gradually with evidence. Return at most one update per party.',");
 return s;
});
edit('web/scripts/smoke-class-satisfaction-guard.js',s=>{
 s=replace(s,"ok(Math.abs(c3.applied.satisfaction) <= 2.01, '③ 同回合第二刀只放余额 (got ' + c3.applied.satisfaction + ')');", "ok(c3.applied.satisfaction === -12 && gentry.satisfaction === 50, '③ 同回合反向变化按净额生效 (got ' + c3.applied.satisfaction + ')');");
 s=replace(s,"ok(gentry._satBudget && gentry._satBudget.used >= 13.9, '③ 预算账本就位 used=' + (gentry._satBudget && gentry._satBudget.used));", "ok(gentry._satBudget && gentry._satBudget.net === 0 && gentry._satBudget.used === 24, '③ 预算保留累计量并独立记录净额');");
 s=replace(s,'/Never return absolute satisfaction values/', '/Never return absolute satisfaction or cohesion values/');
 return s;
});
console.log('party patch applied; original bytes retained in '+backup);
