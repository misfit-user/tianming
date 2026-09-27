'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../..'),backup=path.join(root,'docs/fiscal-satisfaction-fix-20260926/backups/class');
fs.mkdirSync(backup,{recursive:true});
function edit(name,fn){const p=path.join(root,'web',name),bytes=fs.readFileSync(p);fs.writeFileSync(path.join(backup,name+'.bak'),bytes);const raw=bytes.toString('utf8'),crlf=raw.includes('\r\n');const next=fn(raw.replace(/\r\n/g,'\n'));fs.writeFileSync(p,crlf?next.replace(/\n/g,'\r\n'):next);}
function one(s,from,to){if(s.split(from).length!==2)throw Error('Expected one match: '+from.slice(0,100));return s.replace(from,to);}
edit('tm-patches-start.js',s=>one(s,"      if (sc && sc.populationConfig && sc.populationConfig.accounting && sc.populationConfig.accounting.schema === 'tm-population-ledger/2' && typeof TM.Renli.prime === 'function') TM.Renli.prime(GM, typeof P !== 'undefined' ? P : null);\n      else if (typeof TM.Renli.endturnTick === 'function') TM.Renli.endturnTick(GM, typeof P !== 'undefined' ? P : null);","      if (typeof TM.Renli.prime === 'function') TM.Renli.prime(GM, typeof P !== 'undefined' ? P : null);"));
edit('tm-party-class-ecology.js',s=>one(s,"      var name = classNameOf(cls);\n      var score = scoreClass(root, cls, tokens);","      var name = classNameOf(cls);\n      // A scoped runtime pressure has already resolved who is exposed. Topic affinity is not exposure.\n      if (raw.classImpactsAuthoritative === true && !classNames[normalizeName(name)]) return;\n      var score = scoreClass(root, cls, tokens);"));
edit('tm-social-political-signals.js',s=>{
  s=one(s,'  function partySearchText(party) {',`  // Numerical pressure follows identity and exposure, never mutable demands or background prose.
  // These bilingual roles also support custom scenarios through population keys and explicit tags.
  function classIdentityText(cls) {
    return [classNameOf(cls), cls && cls.className, cls && cls.economicRole, cls && cls.role,
      cls && cls.status, cls && cls.populationKeys, cls && cls.tags, cls && cls.labels,
      cls && cls.descriptor && cls.descriptor.economicBase].map(textOf).join(' ').replace(/[_-]/g, ' ').toLowerCase();
  }

  function inferScopedClassImpacts(root, kind, buildImpact) {
    return getClasses(root).map(function(cls) {
      if (!cls) return null;
      var text = classIdentityText(cls), matches = false;
      if (kind === 'military') matches = /\\b(military|soldiers?|army|armies|garrison|guards?|mercenary|mercenaries|navy|marines?|troops?|veterans?)\\b|军户|军人|军队|兵户|士兵|戍卒|战士|卫士|武人|军士|军籍|军事|武装|士卒|水师/.test(text);
      if (kind === 'local') matches = /\\b(peasants?|farmers?|rural|commoners?|tenants?|refugees?|workers?|artisans?|merchants?|craftsmen|laborers?|labourers?|households?)\\b|农|佃户|佃民|流民|平民|庶民|百姓|居民|工匠|商人|商户|商贾|市民|农业|手工|生产|流通|商贸/.test(text)
        || !!(cls.descriptor && cls.descriptor.stratum === '下');
      if (!matches) return null;
      var impact = buildImpact(cls);
      if (!impact) return null;
      impact.name = classNameOf(cls);
      return impact;
    }).filter(Boolean);
  }

  function partySearchText(party) {`);
  const from=s.indexOf('  function readLocalRevoltRisk(root) {'),to=s.indexOf('  function linkedIssueForTokens(root, tokens) {',from);
  if(from<0||to<0)throw Error('local pressure boundary missing');
  s=s.slice(0,from)+`  function readLocalRevoltPressure(root) {
    var local = root && root.local || {};
    var direct = readMaxFinite([local.revoltRisk, local.rebellionRisk, local.unrestRisk, root && root.revoltRisk, root && root.rebellionRisk]);
    if (direct != null && direct > 1) direct /= 100;
    var leaves = [], bridge = global.IntegrationBridge;
    var ah = root && root.adminHierarchy;
    if (ah && bridge && typeof bridge.getLeafDivisions === 'function') {
      try { leaves = bridge.getLeafDivisions(ah, 'player') || []; } catch (_) {}
    }
    if (!leaves.length && ah) {
      function walk(nodes) {
        toArray(nodes).forEach(function(node) {
          if (!node || typeof node !== 'object') return;
          var kids = toArray(node.children || node.divisions || node.subs);
          if (kids.length) walk(kids); else leaves.push(node);
        });
      }
      var player = ah.player || ah[root.playerFactionId] || ah[root.playerFaction];
      if (Array.isArray(ah.divisions)) walk(ah.divisions);
      else if (player) walk(player.divisions || player.children || player.subs);
    }
    if (!leaves.length && !ah) leaves = toArray(root && (root.provinces || root.regions || root.divisions));
    var threshold = tuneNumber(root, 'socialSignals.thresholds.localRevoltRisk', 0.65);
    var total = 0, affected = 0, peak = direct, rows = [];
    leaves.forEach(function(leaf) {
      if (!leaf || typeof leaf !== 'object') return;
      var risk = readMaxFinite([leaf.revoltRisk, leaf.rebellionRisk, leaf.unrestRisk]);
      if (risk != null && risk > 1) risk /= 100;
      var rawMinxin = leaf.minxin != null ? leaf.minxin : leaf.minxinLocal;
      var moodRisk = rawMinxin == null ? null : localMinxinRevoltSeverity(rawMinxin);
      if (moodRisk != null) risk = Math.max(risk || 0, moodRisk);
      var pop = leaf.populationDetail || leaf.population || {};
      var weight = Number(pop.actualMouths != null ? pop.actualMouths : pop.mouths != null ? pop.mouths : typeof leaf.population === 'number' ? leaf.population : 1);
      if (!isFinite(weight) || weight <= 0) weight = 1;
      total += weight;
      var exposed = risk != null && risk >= threshold;
      if (exposed) affected += weight;
      if (risk != null) peak = Math.max(peak || 0, risk);
      rows.push({ leaf: leaf, weight: weight, exposed: exposed });
    });
    return { risk: peak, share: direct != null && direct >= threshold ? 1 : total ? affected / total : 0, rows: rows, national: direct != null && direct >= threshold };
  }

  function localClassExposure(root, cls, pressure) {
    if (pressure.national) return 1;
    var resolver = TM.ClassMinxinBridge;
    var descriptors = toArray(cls.regionalVariants);
    if (cls.regionId || cls.region) descriptors = [cls];
    if (!descriptors.length || !resolver || typeof resolver.resolveRegions !== 'function') return pressure.share;
    var selected = [];
    descriptors.forEach(function(d) {
      resolver.resolveRegions(root, d, cls.factionId || cls.faction || 'player').forEach(function(entry) {
        if (selected.indexOf(entry.leaf) < 0) selected.push(entry.leaf);
      });
    });
    if (!selected.length) return pressure.share;
    var total = 0, affected = 0;
    pressure.rows.forEach(function(row) {
      if (selected.indexOf(row.leaf) < 0) return;
      total += row.weight;
      if (row.exposed) affected += row.weight;
    });
    return total ? affected / total : 0;
  }

`+s.slice(to);
  s=one(s,"      emit('military-wage-arrears', {\n        sourceSystem: 'military',","      emit('military-wage-arrears', {\n        classImpactsAuthoritative: true,\n        sourceSystem: 'military',");
  s=one(s,"affectedClasses: inferClassImpacts(root, ['military', 'soldier', 'wage', 'arrears', 'mutiny', 'garrison', '\\u519b\\u9977', '\\u6b20\\u9977', '\\u54d7\\u53d8', '\\u5175'], function() {","affectedClasses: inferScopedClassImpacts(root, 'military', function() {");
  s=one(s,'    var revoltRisk = readLocalRevoltRisk(root);','    var revoltPressure = readLocalRevoltPressure(root);\n    var revoltRisk = revoltPressure.risk;');
  s=one(s,"      emit('local-revolt-risk', {\n        sourceSystem: 'local',","      emit('local-revolt-risk', {\n        classImpactsAuthoritative: true,\n        sourceSystem: 'local',");
  s=one(s,"affectedClasses: inferClassImpacts(root, ['local', 'revolt', 'rebellion', 'uprising', 'unrest', 'peasant', 'commoner', 'rural', '\\u5730\\u65b9', '\\u6c11\\u53d8', '\\u8d77\\u4e49', '\\u6c11'], function() {\n          return {\n            satisfactionDelta: -Math.max(3, Math.round(3 + rSeverity * 6)),\n            influenceDelta: Math.max(1, Math.round(rSeverity * 3)),\n            unrestDelta: { grievance: -Math.round(3 + rSeverity * 5), revolt: -Math.round(3 + rSeverity * 6) },",`affectedClasses: inferScopedClassImpacts(root, 'local', function(cls) {
          var exposure = localClassExposure(root, cls, revoltPressure);
          if (exposure <= 0) return null;
          return {
            satisfactionDelta: -round2(Math.max(3, Math.round(3 + rSeverity * 6)) * exposure),
            influenceDelta: round2(Math.max(1, Math.round(rSeverity * 3)) * exposure),
            unrestDelta: { grievance: -round2(Math.round(3 + rSeverity * 5) * exposure), revolt: -round2(Math.round(3 + rSeverity * 6) * exposure) },`);
  return s;
});
console.log('class scope and opening prime edits complete');
