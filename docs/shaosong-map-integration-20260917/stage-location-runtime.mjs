import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'),work=path.join(root,'docs/shaosong-map-integration-20260917/location-stage');
const plans=[],hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function one(text,from,to){if(text.includes('\r\n')){from=from.replace(/\r?\n/g,'\r\n');to=to.replace(/\r?\n/g,'\r\n');}assert.equal(text.split(from).length,2,'Missing/ambiguous patch: '+from);return text.replace(from,to);}
function patch(name,fn){const before=fs.readFileSync(path.join(work,'before',name));let after=fn(before.toString('utf8'));assert.notEqual(after,before.toString('utf8'),name);fs.writeFileSync(path.join(work,'after',name),after);plans.push({name,before:hash(before),after:hash(after)});}
const sync=(entity,kind='army',game='undefined',text)=>`if (window.TMMapLocations) window.TMMapLocations.sync(${entity}, '${kind}', ${game}${text?', '+text:''});`;
patch('index.html',t=>one(t,'<script src="tm-map-system.js?v=20260709"></script>','<script src="tm-map-system.js?v=20260709"></script>\n<script src="tm-map-locations.js?v=20260917location2"></script>'));
patch('tm-ai-change-army.js',t=>one(t,'    if (changed) _refreshMilitaryViews(G);','    if (changed) { '+sync('army','army','G')+' _refreshMilitaryViews(G); }'));
patch('tm-military.js',t=>one(t,"          _army2.state = 'garrison';","          _army2.state = 'garrison';\n          "+sync('_army2','army','GM','order.to')));
patch('tm-three-systems-ext.js',t=>one(t,"          a.state = 'garrison';","          a.state = 'garrison';\n          "+sync('a','army','GM','a.location')));
patch('tm-battle-turn.js',t=>one(t,'a.location = a.garrison = t.to;','a.location = a.garrison = t.to; '+sync('a','army','undefined','t.to')));
patch('tm-border-invasion.js',t=>one(t,'a2.location = lf2.name; a2.garrison = lf2.name;','a2.location = lf2.name; a2.garrison = lf2.name; '+sync('a2','army','undefined','lf2.name')));
patch('tm-faction-action-engine.js',t=>one(t,'army.location = p.location || p.garrison; army.garrison = p.garrison || p.location;','army.location = p.location || p.garrison; army.garrison = p.garrison || p.location; '+sync('army','army','undefined','army.location')));
patch('tm-faction-npc-llm-decision.js',t=>one(t,'        army.garrison = p.garrison || p.location;','        army.garrison = p.garrison || p.location;\n        '+sync('army','army','undefined','army.location')));
patch('tm-feudal-warfare.js',t=>one(t,"      army.location = army.destination;\n      army.destination = '';","      army.location = army.destination;\n      army.destination = '';\n      "+sync('army','army','undefined','army.location')));
patch('tm-military-ui.js',t=>one(t,'a.location=gv("gm_loc");','a.location=gv("gm_loc");'+sync('a','army','undefined','a.location')));
patch('tm-endturn-agent-write-tools.js',t=>one(t,"    else { ch.location = loc; ch._travelTo = ''; }","    else { ch.location = loc; ch._travelTo = ''; }\n    "+sync('ch','character','gm')));
patch('tm-endturn-apply.js',t=>{for(const [e,v]of [['_flCh','act.new_location'],['_nlCh','act.new_location'],['ch','cu.new_location']])t=one(t,`${e}.location = ${v};`,`${e}.location = ${v}; `+sync(e,'character','undefined',v));return t;});
patch('tm-game-loop-wentian-hardchange.js',t=>one(t,'  _wtMirrorCharacterHardChange(ch.name, { location: loc, place: loc, currentLocation: loc, loc: loc }, clearTravel);','  _wtMirrorCharacterHardChange(ch.name, { location: loc, place: loc, currentLocation: loc, loc: loc }, clearTravel);\n  if (window.TMMapLocations) window.TMMapLocations.syncWorld(window.GM);'));
patch('tm-patches.js',t=>{t=one(t,'      ch.location = loc.location;','      ch.location = loc.location; '+sync('ch','character','undefined','loc.location'));return one(t,'      ch[fix.field] = fix.newValue;','      ch[fix.field] = fix.newValue; '+sync('ch','character','undefined','fix.newValue'));});
patch('tm-patches-start.js',t=>one(t,"  _tmStartPrimeFormalRuntime(sid, sc, _hasStartAI ? 'before-enter-api' : 'before-enter-local');","  if (window.TMMapLocations) window.TMMapLocations.syncWorld(GM);\n  _tmStartPrimeFormalRuntime(sid, sc, _hasStartAI ? 'before-enter-api' : 'before-enter-local');"));
patch('tm-map-system.js',t=>{
 t=one(t,'    var node = resolveMapNode(army.locationNode || army.locationId || army.regionId || army.mapRegionId || army.location);',`    var boundLocation = window.TMMapLocations && window.TMMapLocations.read(army, 'army', GM);
    var node = resolveMapNode(boundLocation ? boundLocation.regionId : (army.locationNode || army.locationId || army.regionId || army.mapRegionId || army.location || army.garrison));`);
 t=one(t,'if (army.targetLocation || army.targetLocationNode || army.targetLocationId || army.targetRegionId) {','if (army.targetLocation || army.targetLocationNode || army.targetLocationId || army.targetRegionId || army.destination) {');
 t=one(t,'var targetNode = resolveMapNode(army.targetLocationNode || army.targetLocationId || army.targetRegionId || army.targetLocation);','var targetNode = resolveMapNode(army.targetLocationNode || army.targetLocationId || army.targetRegionId || army.targetLocation || army.destination);');
 t=one(t,'  return null;\n}\n\n/**\n * 更新军队移动动画',`  if (window.TMMapLocations && window.TMMapLocations.enabled(GM.mapData)) {
    var alias = window.TMMapLocations.resolveText(key, GM.mapData, {}, 'node', GM);
    if (alias.regionId && alias.regionId !== key) return resolveMapNode(alias.regionId);
  }
  return null;
}

/**
 * 更新军队移动动画`);
 return t;
});
patch('phase8-formal-map-dossier.js',t=>{
 t=one(t,'    var regions = map.regions || [];',`    var regions = map.regions || [];
    var locationService = window.TMMapLocations;
    var strictLocations = locationService && locationService.enabled(map);
    var liveLocations = strictLocations ? armies.map(function(a) { return locationService.read(a, 'army', gm); }) : null;`);
 t=one(t,"    if (_armyRegionCache.sig === sig) return _armyRegionCache;",`    sig += ':' + JSON.stringify(armies.map(function(a, i) { return a && [a.id,a.garrison,a.location,a.regionId,a.garrisonRegionId,a.regionHint,a.soldiers,a.size,a.strength,a.faction,a.factionId,a.destroyed,a.disbanded,liveLocations && liveLocations[i] && liveLocations[i].regionId]; }));
    if (_armyRegionCache.sig === sig && _armyRegionCache.world === gm && _armyRegionCache.map === map) return _armyRegionCache;`);
 t=one(t,'    armies.forEach(function(a){','    armies.forEach(function(a, armyIndex){');
 t=one(t,'      if (!a || a.destroyed) return;','      if (!a || a.destroyed || a.disbanded) return;');
 t=one(t,"      var garrisonText = String(a.garrison || a.location || '');",`      var garrisonText = String(a.garrison || a.location || '');
      if (strictLocations) {
        var bound = liveLocations[armyIndex];
        if (!bound || !bound.regionId) unbound.push({ name: String(a.name || ''), garrison: garrisonText, soldiers: soldiers, status: bound && bound.status });
        else addTo(bound.regionId, a, soldiers, bound.precision === 'representative' ? '·区域参考点' : '');
        return;
      }`);
 t=one(t,'_armyRegionCache = { sig: sig, byRegion: byRegion, unboundCount: unbound.length, unbound: unbound };','_armyRegionCache = { sig: sig, world: gm, map: map, byRegion: byRegion, unboundCount: unbound.length, unbound: unbound };');
 return t;
});
plans.push({name:'tm-map-locations.js',before:null,after:hash(fs.readFileSync(path.join(work,'after/tm-map-locations.js')))});
fs.writeFileSync(path.join(work,'runtime-plan.json'),JSON.stringify(plans,null,2));
console.log(JSON.stringify({staged:plans.length,files:plans.map(r=>r.name)}));
