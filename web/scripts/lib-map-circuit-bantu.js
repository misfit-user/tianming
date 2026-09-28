// lib-map-circuit-bantu.js — 谱牒版图卷（按省道分组）的取数与断言，供天启、绍宋两个通志用例共用
//
// bantuSnapshot 在真实开局里按数据层重算各省道分组，再实际开一次谱牒取 HTML；
// bantuMarkup 从 HTML 里取出版图卷的省道行与州签；assertBantuConservation 核组数与签数守恒。
'use strict';

const assert = require('node:assert/strict');

// 从真实开局读取势力叶子集合及各省道汇总，和实际谱牒版图 HTML 对账。
function bantuSnapshot(run, key) {
  const snapshot = JSON.parse(run(`(function(){
    var parts = TMPhase8FormalBridge.__p8MapParts, MC = TM.MapCircuits, key = ${JSON.stringify(key)};
    var f = parts.findFaction(key, '') || {};
    var owner = f.stableOwnerKey || f.mapFactionId || f.id || key;
    var regions = GM.mapData.regions.filter(function(r){ return parts.factionOwnsRegion(r, key, f); });
    var index = MC.indexCircuits(GM.mapData, { layout: TMMapRealmLayout, ownerOf: parts.canonicalOwnerKey });
    var groups = [], none = regions.filter(function(r){ return !MC.isRealCircuit(MC.circuitOf(index, r)); });
    index.circuits.forEach(function(circuit){
      if (!MC.isRealCircuit(circuit)) return;
      var own = MC.partitionByOwner(circuit, owner).own.filter(function(r){ return regions.indexOf(r) >= 0; });
      if (!own.length) return;
      var sum = MC.summarize(own, { bundle: parts.regionBundle, mood: parts.moodViewScore, office: parts.officeViewScore });
      var mood = parts.gradeOf('mood', sum.mood), office = parts.gradeOf('office', sum.office);
      groups.push({ key: circuit.key, label: circuit.label, count: own.length, total: circuit.members.length,
        ids: own.map(function(r){ return String(r.id || r.name || r.title || ''); }), population: sum.population,
        values: [parts.hasDisplayValue(sum.population) ? '户口 ' + parts.ppValue(sum.population) : null,
          parts.hasDisplayValue(sum.mood) ? '民心 ' + parts.ppValue(sum.mood) + '<em class="' + (parts.gradeIsWarn('mood', mood) ? 'warn' : '') + '">' + (mood && mood.mark || '') + '</em>' : null,
          parts.hasDisplayValue(sum.office) ? '吏治 ' + parts.ppValue(sum.office) + '<em class="' + (parts.gradeIsWarn('office', office) ? 'warn' : '') + '">' + (office && office.mark || '') + '</em>' : null].filter(function(v){ return v !== null; }) });
    });
    return JSON.stringify({ key: key, name: f.label || f.name, groups: groups,
      ids: regions.map(function(r){ return String(r.id || r.name || r.title || ''); }), none: none.map(function(r){ return String(r.id || r.name || r.title || ''); }) });
  })()`));
  // 参考数据与实际开册分开执行，避免把两次计算叠在同一个 VM 同步时限里。
  const started = Date.now();
  snapshot.html = run(`(function(){ TMPhase8FormalBridge.__p8MapParts.openFactionDossier(${JSON.stringify(key)}, null); return document.getElementById('ppop').innerHTML; })()`);
  console.log('[bantu] ' + snapshot.name + ' groups=' + snapshot.groups.length + ' signs=' + snapshot.ids.length + ' unassigned=' + snapshot.none.length + ' renderMs=' + (Date.now() - started));
  return snapshot;
}

// VM 不解析 innerHTML，沿用本文件的标记提取法，只读取版图卷中的签与省道行。
function bantuMarkup(snapshot) {
  const section = snapshot.html.match(/<section class="bk-juan" id="bk-bantu">([\s\S]*?)<\/section>/);
  assert(section, '谱牒含版图卷');
  const html = section[1];
  const groups = [...html.matchAll(/<details class="bk-bantu-dao\b[^"]*"([^>]*)>([\s\S]*?)<\/details>/g)].map((m) => ({
    key: (m[1].match(/data-bk-bantu-circuit="([^"]+)"/) || [])[1] || null,
    attrs: m[1], html: m[2], ids: [...m[2].matchAll(/class="bk-qian" data-bk-open-region="([^"]*)"/g)].map((a) => a[1])
  }));
  return { html, groups, ids: [...html.matchAll(/class="bk-qian" data-bk-open-region="([^"]*)"/g)].map((m) => m[1]) };
}

// 按真实势力集合断言组数与签数守恒，重复签不能被集合去重掩盖。
function assertBantuConservation(snapshot, parsed) {
  assert(snapshot.groups.length > 0, snapshot.name + ' 有正式省道');
  assert.equal(parsed.groups.length, snapshot.groups.length + (snapshot.none.length ? 1 : 0), '正式省道组数加未设省道组');
  assert.equal(parsed.ids.length, snapshot.ids.length, '版图签数等于 factionProfile 同口径地块数');
  assert.equal(new Set(parsed.ids).size, parsed.ids.length, '没有重复地块');
  assert.deepEqual([...parsed.ids].sort(), [...snapshot.ids].sort(), '没有漏签或引入本势力之外的地块');
  assert.equal(parsed.groups.reduce((n, g) => n + g.ids.length, 0), snapshot.ids.length, '全部州签都在分组内');
}

module.exports = { bantuSnapshot, bantuMarkup, assertBantuConservation };
