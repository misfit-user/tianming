'use strict';
const assert = require('node:assert/strict'),
  G = require('../tm-map-workbench.js'),
  B = require('../tm-map-binding-workbench.js');
const rect = (x, y, w, h) => ({
  type: 'Polygon',
  coordinates: [
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ],
  ],
});
function map() {
  return {
    id: 'neutral',
    version: '1',
    coordinateSystemId: 'game-pixel',
    cells: [
      {
        id: 'outer',
        name: '环地',
        geometry: {
          type: 'Polygon',
          coordinates: [rect(0, 0, 10, 10).coordinates[0], rect(3, 3, 4, 4).coordinates[0]],
        },
      },
      { id: 'enclave', name: '内嵌地', geometry: rect(3, 3, 4, 4) },
      {
        id: 'islands',
        name: '二岛',
        geometry: { type: 'MultiPolygon', coordinates: [rect(12, 0, 2, 2).coordinates, rect(16, 0, 2, 2).coordinates] },
      },
      {
        id: 'lake-shore',
        name: '湖岸',
        geometry: {
          type: 'Polygon',
          coordinates: [rect(20, 0, 10, 10).coordinates[0], rect(23, 3, 4, 4).coordinates[0]],
        },
      },
    ],
  };
}
let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log('PASS ' + name);
}
test('full geometry separates protected enclave, true inner ring and logical multipart', () => {
  const m = map(),
    r = G.inspect(m);
  assert(r.ok && r.complete);
  assert.equal(r.regions, 4);
  assert.equal(r.components, 5);
  assert.equal(r.holes[0].classification, 'enclave');
  assert.equal(r.holes[1].classification, 'unknown');
  assert.deepEqual(G.hit(m, [5, 5]), ['enclave']);
  assert.deepEqual(G.hit(m, [25, 5]), []);
  assert.deepEqual(G.hit(m, [13, 1]), ['islands']);
  assert.deepEqual(G.hit(m, [17, 1]), ['islands']);
  assert(G.contains(m.cells[0].geometry, G.anchor(m.cells[0].geometry)));
});
test('point contact does not grant a land route; shared boundaries are symmetric', () => {
  const m = {
    id: 'adj',
    version: '1',
    coordinateSystemId: 'game-pixel',
    cells: [
      { id: 'a', geometry: rect(0, 0, 2, 2) },
      { id: 'b', geometry: rect(2, 0, 2, 2) },
      { id: 'c', geometry: rect(4, 2, 2, 2) },
    ],
  };
  const r = G.inspect(m);
  assert.deepEqual(r.neighbors.a, ['b']);
  assert.deepEqual(r.neighbors.b, ['a']);
  assert.deepEqual(r.neighbors.c, []);
  assert.equal(r.adjacency[0].passable, 'requires-scenario-rule');
});
test('shared boundary edits move both sides without gaps or changing land union', () => {
  const m = {
      id: 'shared',
      version: '1',
      coordinateSystemId: 'game-pixel',
      cells: [
        { id: 'a', geometry: rect(0, 0, 2, 2) },
        { id: 'b', geometry: rect(2, 0, 2, 2) },
      ],
    },
    before = JSON.stringify(m);
  const r = G.operations(m, [
    {
      type: 'adjustSharedBoundary',
      regionIds: ['a', 'b'],
      from: [
        [2, 0],
        [2, 2],
      ],
      to: [
        [2, 0],
        [2.5, 1],
        [2, 2],
      ],
    },
  ]);
  assert.equal(r.before.unionArea, r.after.unionArea);
  assert.equal(JSON.stringify(m), before);
  assert(G.inspect(r.map).ok);
});
test('hole and coordinate evidence cannot be bypassed by a repair request', () => {
  assert.throws(
    () =>
      G.operations(map(), [
        {
          type: 'classifyHole',
          regionId: 'outer',
          component: 0,
          ring: 1,
          classification: 'accidental-gap',
          sourceRef: 'test',
        },
      ]),
    /独立地块/,
  );
  assert.throws(
    () =>
      G.operations(map(), [
        {
          type: 'repairGap',
          regionId: 'outer',
          geometry: rect(3, 3, 4, 4),
          classification: 'accidental-gap',
          sourceRef: 'test',
        },
      ]),
    /物理陆地/,
  );
  assert.throws(() => G.operations(map(), [{ type: 'moveLabel', regionId: 'outer', point: [5, 5] }]), /孔洞/);
  const m = map();
  m.coordinateSystemId = 'wgs84';
  m.cells[0].geometry.coordinates[0][1][0] = 1000;
  assert.throws(() => G.validate(m), /经纬度/);
});
test('integer split conserves population and does not duplicate armies; ambiguous references block the package', () => {
  const m = {
      id: 'split',
      version: '1',
      coordinateSystemId: 'game-pixel',
      cells: [{ id: 'a', geometry: rect(0, 0, 10, 10) }],
    },
    ops = [
      {
        type: 'splitLogicalRegion',
        regionId: 'a',
        reason: '测试',
        parts: [
          { id: 'west', geometry: rect(0, 0, 5, 10) },
          { id: 'east', geometry: rect(5, 0, 5, 10) },
        ],
      },
    ],
    r = G.operations(m, ops),
    s = {
      factions: [{ id: 'f' }],
      characters: [{ id: 'c', regionId: 'a' }],
      map: {
        regions: [
          {
            id: 'a',
            name: '旧地',
            population: 101,
            households: 11,
            money: 7,
            controllerFactionId: 'f',
            sovereignFactionId: 'f',
          },
        ],
      },
      military: { initialTroops: [{ id: 'army', soldiers: 17, garrisonRegionId: 'a', locationPoint: [1, 1] }] },
    };
  assert.throws(() => B.rebind(s, m, r), /歧义/);
  const out = B.rebind(s, m, r, { referenceTargets: { 'characters.0.regionId': 'east' } });
  assert.equal(out.report.before.population, out.report.after.population);
  assert.equal(out.report.after.soldiers, 17);
  assert.equal(out.scenario.military.initialTroops.length, 1);
  assert.equal(out.scenario.military.initialTroops[0].garrisonRegionId, 'west');
  assert.equal(out.scenario.characters[0].regionId, 'east');
  assert.equal(
    out.scenario.map.regions.reduce((n, r) => n + r.households, 0),
    11,
  );
});
test('merging different controllers requires explicit binding policy', () => {
  const m = {
      id: 'merge',
      version: '1',
      coordinateSystemId: 'game-pixel',
      cells: [
        { id: 'a', geometry: rect(0, 0, 2, 2) },
        { id: 'b', geometry: rect(2, 0, 2, 2) },
      ],
    },
    r = G.operations(m, [{ type: 'mergeLogicalRegions', regionIds: ['a', 'b'], newId: 'c', reason: '测试' }]);
  assert.throws(
    () =>
      B.rebind(
        {
          factions: [{ id: 'fa' }, { id: 'fb' }],
          map: {
            regions: [
              { id: 'a', controllerFactionId: 'fa', sovereignFactionId: 'fa' },
              { id: 'b', controllerFactionId: 'fb', sovereignFactionId: 'fb' },
            ],
          },
        },
        m,
        r,
      ),
    /政策/,
  );
});
test('self crossings and land-overlap fail instead of being silently normalized', () => {
  const m = map();
  m.cells[0].geometry = rect(0, 0, 10, 10);
  assert(!G.inspect(m).ok);
  m.cells[0].geometry = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [5, 5],
        [0, 5],
        [5, 0],
        [0, 0],
      ],
    ],
  };
  assert.throws(() => G.validate(m), /自交/);
});
test('positive land repair requires explicit physical land and conserves all existing cells', () => {
  const m = {
    id: 'gap',
    version: '1',
    coordinateSystemId: 'game-pixel',
    physicalLandGeometry: rect(0, 0, 3, 2),
    cells: [
      { id: 'a', geometry: rect(0, 0, 1, 2) },
      { id: 'b', geometry: rect(2, 0, 1, 2) },
    ],
  };
  const before = JSON.stringify(m),
    r = G.operations(m, [
      {
        type: 'repairGap',
        regionId: 'a',
        geometry: rect(1, 0, 1, 2),
        classification: 'accidental-gap',
        sourceRef: 'author-proof',
      },
    ]);
  assert.equal(r.before.unionArea, 4);
  assert.equal(r.after.unionArea, 6);
  assert.deepEqual(G.hit(r.map, [1.5, 1]), ['a']);
  assert.equal(JSON.stringify(m), before);
});
test('merge rewires real mapRegionId, office, character, troop and event references without changing another binding', () => {
  const m = {
      id: 'merge-refs',
      version: '1',
      coordinateSystemId: 'game-pixel',
      cells: [
        { id: 'a', geometry: rect(0, 0, 2, 2) },
        { id: 'b', geometry: rect(2, 0, 2, 2) },
      ],
    },
    s = {
      factions: [{ id: 'f' }],
      characters: [{ id: 'char', regionId: 'a' }],
      map: {
        regions: [
          { id: 'a', controllerFactionId: 'f', population: 5 },
          { id: 'b', controllerFactionId: 'f', population: 6 },
        ],
      },
      adminHierarchy: { f: { divisions: [{ id: 'd', mapRegionId: 'a', mappedRegions: ['a', 'b'] }] } },
      officeTree: [{ id: 'office', regionId: 'b' }],
      military: { initialTroops: [{ id: 'army', soldiers: 7, garrisonRegionId: 'a' }] },
      events: [{ id: 'event', targetRegionId: 'b' }],
    };
  const before = JSON.stringify(s),
    operation = G.operations(m, [
      { type: 'mergeLogicalRegions', regionIds: ['a', 'b'], newId: 'joined', reason: 'explicit merge' },
    ]),
    next = B.rebind(s, m, operation).scenario;
  assert.equal(next.adminHierarchy.f.divisions[0].mapRegionId, 'joined');
  assert.deepEqual(next.adminHierarchy.f.divisions[0].mappedRegions, ['joined']);
  assert.equal(next.characters[0].regionId, 'joined');
  assert.equal(next.officeTree[0].regionId, 'joined');
  assert.equal(next.military.initialTroops[0].garrisonRegionId, 'joined');
  assert.equal(next.events[0].targetRegionId, 'joined');
  assert.equal(next.map.regions[0].population, 11);
  assert.equal(JSON.stringify(s), before);
});
test('tax bases survive split and merge, while different fiscal authorities or units cannot be silently merged', () => {
  const m = {
      id: 'tax-map',
      version: '1',
      coordinateSystemId: 'game-pixel',
      cells: [{ id: 'a', geometry: rect(0, 0, 10, 10) }],
    },
    s = {
      factions: [{ id: 'f' }, { id: 'tax' }],
      map: {
        regions: [
          {
            id: 'a',
            sovereignFactionId: 'f',
            controllerFactionId: 'f',
            taxAuthorityFactionId: 'tax',
            taxBase: 101,
            taxBaseResource: 'money',
            taxBaseUnit: '两',
          },
        ],
      },
    };
  const split = G.operations(m, [
    {
      type: 'splitLogicalRegion',
      regionId: 'a',
      reason: 'explicit',
      parts: [
        { id: 'west', geometry: rect(0, 0, 4, 10) },
        { id: 'east', geometry: rect(4, 0, 6, 10) },
      ],
    },
  ]);
  const next = B.rebind(s, m, split).scenario;
  assert.equal(
    next.map.regions.reduce((n, r) => n + r.taxBase, 0),
    101,
  );
  assert(
    next.map.regions.every(
      (r) => r.taxAuthorityFactionId === 'tax' && r.taxBaseResource === 'money' && r.taxBaseUnit === '两',
    ),
  );
  const merge = G.operations(split.map, [
    { type: 'mergeLogicalRegions', regionIds: ['west', 'east'], newId: 'joined', reason: 'explicit' },
  ]);
  assert.equal(B.rebind(next, split.map, merge).scenario.map.regions[0].taxBase, 101);
  next.map.regions[1].taxAuthorityFactionId = 'f';
  assert.throws(() => B.rebind(next, split.map, merge), /不同税权/);
  next.map.regions[1].taxAuthorityFactionId = 'tax';
  next.map.regions[1].taxBaseUnit = '石';
  assert.throws(() => B.rebind(next, split.map, merge), /不同税权/);
  assert.equal(s.map.regions.length, 1);
  assert.equal(s.map.regions[0].taxBase, 101);
});
test('numeric tails and actual water holes remain separately recorded without increasing geometry tolerances', () => {
  const m={id:'holes',version:'1',coordinateSystemId:'game-pixel',cells:[{id:'land',geometry:{type:'Polygon',coordinates:[rect(0,0,10,10).coordinates[0],rect(1,1,.000001,.000001).coordinates[0],rect(3,3,2,2).coordinates[0]]}}]};
  const before=G.inspect(m),r=G.operations(m,[{type:'classifyHole',regionId:'land',component:0,ring:1,classification:'quantization-tail',sourceRef:'fixture-proof'},{type:'classifyHole',regionId:'land',component:0,ring:2,classification:'water',sourceRef:'fixture-proof'}]);
  assert.equal(r.after.holes.length,2);assert.deepEqual(r.after.holes.map(h=>h.classification),['quantization-tail','water']);
  assert.deepEqual(r.after.parameters,before.parameters);assert.equal(r.after.unionArea,before.unionArea);assert.deepEqual(G.hit(r.map,[4,4]),[]);
});
test('physical river evidence does not invent a route or a political control grant', () => {
  const m={id:'river',version:'1',coordinateSystemId:'game-pixel',physicalRivers:[{id:'river',geometry:{type:'LineString',coordinates:[[1,1],[6,1]]}}],cells:[{id:'a',geometry:rect(0,0,2,2)},{id:'b',geometry:rect(5,0,2,2)}]};
  const r=G.operations(m,[{type:'rebuildLandAdjacency'}]);assert.equal(r.after.adjacencyEdges,0);assert.equal(r.control.length,0);assert.deepEqual(r.map.physicalRivers,m.physicalRivers);
});
console.log(n + ' PASS / 0 FAIL');
