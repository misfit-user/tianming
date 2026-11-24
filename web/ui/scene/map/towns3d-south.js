// 舆图城郭立体模型·南洋诸样（并进 towns3d.js 的 BUILD）：大越、南洋诸国、西洋据点的府州治所照当地的城与镇。
// 大越（viet）：砖石的方城，门楼、寺殿黛红的瓦顶四角高翘；城内瓦房、草房，寺院一座砖塔，亭（村社公所）宽矮的大顶；椰、槟榔。
//   都城（升龙）城中套一座皇城：五洞的端门，敬天殿坐高台。
// 南洋诸国（seasia：骠、真腊、堕和罗、环王、蒲甘、吕宋诸邦……）：护城河围着红砖城，城内王宫层层收顶的尖阁、白身金顶的钟形佛塔、
//   砖砌的佛殿；民居是高脚屋陡草顶，椰林。小邦只一圈木栅。占城旧地（大越治下）也画这一路，添占婆砖塔。
// 西洋据点（west：西班牙马尼拉、葡萄牙澳门、荷兰大员）：棱堡（城角菱形的炮台）围着的石城，教堂白墙红瓦、钟楼，石屋红瓦；
//   城外尼巴屋（高脚、草顶）、椰林；马尼拉城外另有华商聚居的八连。小处只是传教的镇子：广场、教堂、尼巴屋。
// 城外诸样（照当地样子的市镇、港、地标，SOUTH_LOCAL 按地域给模型名）：
//   大越——市（筒屋两排、街心吹き放ち的市场大屋根、亭）；港（红瓦货栈、帆船）；寺（三关门、两重上殿、砖塔七级、莲池）；
//   庙（华表柱、宽矮大顶的拜亭、正殿）；文庙（奎文阁、天光井、大成殿）；屯（砖石方城、门楼）；衙（门楼、正堂、两厢）。
//   南洋诸国——市（运河、木桥、草葺市棚、高脚屋、小舟、小白塔）；港（高脚货栈、帆船、带边架的席帆舟）；寺（佛殿、大塔、两小塔）；
//   祠（砖墙里砖塔三座）；学（佛殿、长长的讲亭、小金塔）；堡（砖墙垛口、营堂）；王府（层层收顶的殿、高脚长屋）。教堂照西洋据点画。
//   西洋据点——市（石铺广场、喷泉、石屋、白布摊棚、尼巴屋）；港（石砌货栈、石码头、西洋帆船与华船）；教堂（大教堂、修院、十字架）；
//   学院（石屋围院、小教堂）；堡（棱堡小城、炮）；官署（两层石厅、下层拱廊、广场、旗）。寺、祠庙照原样（华人的庙）。
// 四郊村舍（点景近看换上的，每样八十面以内）：大越草屋与红瓦屋、槟榔；南洋高脚屋、椰（西洋据点四郊的尼巴屋同此）。
// k：towns3d.js 递来的器件。各样搭完返回占地半宽。
const YAW = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

export function southBuilders(k) {
  const { C, box, flat, mound, hipRoof, skirt, gableRoof, house, pavilion, hall, courtyard, pagoda, quarter, pool, flag, rng, pick, stilt, palisade, wallRing, junk } = k;
  const far = k.far;
  const S = {
    brick: [0.68, 0.43, 0.33], brickTop: [0.62, 0.4, 0.31], vnWall: [0.69, 0.62, 0.53], vnWallTop: [0.62, 0.56, 0.48],
    vnRoof: [0.62, 0.37, 0.29], vnRoof2: [0.55, 0.33, 0.27], palmThatch: [0.66, 0.57, 0.39],
    white: [0.94, 0.92, 0.86], whiteTop: [0.88, 0.86, 0.8], gold: C.gold,
    palm: [0.35, 0.55, 0.31], palmDark: [0.27, 0.45, 0.26], trunk: [0.52, 0.44, 0.34],
    fort: [0.82, 0.77, 0.67], fortTop: [0.75, 0.7, 0.61], church: [0.95, 0.91, 0.82], tileRed: [0.71, 0.39, 0.29], tileRed2: [0.63, 0.35, 0.27],
    canvas: [0.93, 0.9, 0.82], mat: [0.8, 0.71, 0.52]
  };

  // ---------- 共用：椰树、高脚屋群 ----------
  // 椰（槟榔）：细干略斜（两截），顶上一圈七片垂下的羽叶
  function palm(m, x, z, s = 1, lean = 0) {
    if (far()) return;
    const h = 0.3 * s, w = 0.01 * s, a = lean || 0.6, dx = Math.cos(a) * 0.05 * s, dz = Math.sin(a) * 0.05 * s;
    box(m, x - w, -0.2, z - w, x + w, h * 0.55, z + w, S.trunk, { faces: 'nsew' });
    box(m, x + dx * 0.5 - w, h * 0.55, z + dz * 0.5 - w, x + dx + w, h, z + dz + w, S.trunk, { faces: 'nsew' });
    const tx = x + dx, tz = z + dz, r = 0.13 * s;
    for (let i = 0; i < 7; i++) {
      const t = i / 7 * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t), px = -sn * 0.018 * s, pz = c * 0.018 * s;
      const tip = [tx + c * r, h - 0.06 * s, tz + sn * r], mid = [tx + c * r * 0.5, h + 0.02 * s, tz + sn * r * 0.5];
      m.tri([tx + px, h, tz + pz], [mid[0] + px, mid[1], mid[2] + pz], tip, i % 2 ? S.palm : S.palmDark);
      m.tri([tx - px, h, tz - pz], [mid[0] - px, mid[1], mid[2] - pz], tip, i % 2 ? S.palmDark : S.palm);
    }
  }
  // 一片高脚屋：矩形里散几座（stilt：四柱架起、陡草顶），间以椰树；keep 里留空
  function stiltField(m, r, x0, z0, x1, z1, density, keep = []) {
    for (let z = z0 + 0.15; z < z1 - 0.15; z += 0.36 + r() * 0.12) {
      for (let x = x0 + 0.15 + r() * 0.1; x < x1 - 0.15; x += 0.4 + r() * 0.15) {
        if (keep.some(([a, b, c, d]) => x + 0.2 > a && x - 0.2 < c && z + 0.2 > b && z - 0.2 < d)) continue;
        if (r() < density) stilt(m, x, z, 0.26 + r() * 0.1, 0.18 + r() * 0.05, 0.08, 0.1, r() < 0.5 ? 0 : Math.PI / 2);
        else if (r() < 0.6) palm(m, x, z, 0.9 + r() * 0.5, r() * 6);
      }
    }
  }

  // ======================= 大越 =======================
  // 门楼：砖台上一座红瓦重檐、四角高翘的楼
  function vnGate(m, zf, h, t, gw, tiers) {
    const out = 0.06, y1 = h + 0.03;
    box(m, -gw / 2, -1, zf - t - out, gw / 2, y1, zf + out, S.vnWall, { top: S.vnWallTop });
    m.quad([-gw * 0.13, 0, zf + out + 0.004], [gw * 0.13, 0, zf + out + 0.004], [gw * 0.13, h * 0.62, zf + out + 0.004], [-gw * 0.13, h * 0.62, zf + out + 0.004], C.hole);
    if (tiers > 0) pavilion(m, 0, y1, zf - t / 2, gw * 0.36, Math.max(0.1, (t + out * 2) * 0.42), Math.max(0.11, gw * 0.22), tiers, S.vnRoof, { body: C.red, lift: 0.065, ridge: S.vnRoof2 });
  }
  // 寺（chùa）：院墙一圈，大殿红瓦翘角，殿后一座砖塔
  function chua(m, x, z, s, levels) {
    courtyard(m, x, z, 0.4 * s, 0.38 * s, 0.08, 0.035, S.white, S.vnRoof2, 0.15 * s);
    hall(m, x, z + 0.05 * s, 0.22 * s, 0.13 * s, 0.1, S.vnRoof, { body: C.red, lift: 0.06 });
    if (levels) pagoda(m, x, z - 0.24 * s, levels, 0.15 * s, S.brick, S.vnRoof2);
    palm(m, x - 0.3 * s, z + 0.25 * s, 1.1); palm(m, x + 0.3 * s, z + 0.22 * s, 1.0, 2.5);
  }
  // 亭（đình，村社公所）：宽矮的大顶，几乎压到地
  function dinh(m, x, z, s) {
    box(m, x - 0.26 * s, -0.3, z - 0.12 * s, x + 0.26 * s, 0.07, z + 0.12 * s, C.wood, { faces: 'nsew' });
    hipRoof(m, x, 0.07, z, 0.33 * s, 0.19 * s, 0.13 * s, S.vnRoof, { lift: 0.06, ridge: S.vnRoof2 });
  }
  const VN_LOOK = { walls: [S.white, C.plaster2, C.earthHouse, S.white], roofs: [S.vnRoof, S.vnRoof2, S.palmThatch, S.vnRoof] };
  // 方城。o：hw、h 墙高、t 墙厚、gates、tiers、moat、chua [x, z, s, 塔级]、dinh [x, z, s]、density、keep、palms 几株
  function vnTown(m, r, o) {
    const { hw, h, t } = o, inner = hw - t;
    flat(m, -inner, -inner, inner, inner, 0.02, C.ground);
    if (o.moat) {
      const a = hw + 0.12, b = a + 0.26;
      flat(m, -b, a, b, b, 0.012, C.water); flat(m, -b, -b, b, -a, 0.012, C.water);
      flat(m, -b, -a, -a, a, 0.012, C.water); flat(m, a, -a, b, a, 0.012, C.water);
      for (const g of o.gates) { m.push(0, 0, 0, YAW[g]); flat(m, -0.12, a - 0.02, 0.12, b + 0.02, 0.02, S.vnWallTop); m.pop(); }
    }
    wallRing(m, hw, h, t, S.vnWall, S.vnWallTop, o.crenel || 0);
    const gw = Math.max(0.4, hw * 0.22);
    for (const g of o.gates) { m.push(0, 0, 0, YAW[g]); vnGate(m, hw, h, t, gw, (o.tiers && o.tiers[g]) || 0); m.pop(); }
    const keep = (o.keep || []).slice();
    flat(m, -0.1, -inner, 0.1, inner, 0.028, C.street); keep.push([-0.12, -inner, 0.12, inner]);
    if (o.gates.includes('e') || o.gates.includes('w')) { flat(m, -inner, -0.1, inner, 0.1, 0.028, C.street); keep.push([-inner, -0.12, inner, 0.12]); }
    if (o.chua) { const [x, z, s, lv] = o.chua; chua(m, x, z, s, lv); keep.push([x - 0.44 * s, z - 0.42 * s, x + 0.44 * s, z + 0.42 * s]); }
    if (o.dinh) { const [x, z, s] = o.dinh; dinh(m, x, z, s); keep.push([x - 0.36 * s, z - 0.24 * s, x + 0.36 * s, z + 0.24 * s]); }
    const g0 = 0.15;
    for (const [x0, z0, x1, z1] of [[-inner, -inner, -g0, -g0], [g0, -inner, inner, -g0], [-inner, g0, -g0, inner], [g0, g0, inner, inner]]) {
      quarter(m, r, x0 + 0.03, z0 + 0.03, x1 - 0.02, z1 - 0.02, o.density, keep, false, VN_LOOK);
    }
    // 城外几株椰、槟榔
    for (let i = 0; i < (o.palms || 6); i++) {
      const side = i % 4, u = (r() - 0.5) * 1.8 * hw, d = hw + 0.14 + r() * 0.12 + (o.moat ? 0.44 : 0);
      const [x, z] = [[u, d], [d, u], [u, -d], [-d, u]][side];
      palm(m, x, z, 1 + r() * 0.4, r() * 6);
    }
  }
  function vn(tier, v) {
    return (m) => {
      const r = rng(1401 + tier * 10 + v), sx = v ? -1 : 1;
      const hw = [1.4, 1.9, 2.4, 2.95][tier];
      vnTown(m, r, {
        hw, h: [0.24, 0.32, 0.4, 0.48][tier], t: [0.13, 0.16, 0.18, 0.2][tier], crenel: tier ? 0.2 : 0, moat: tier >= 2,
        gates: tier ? ['s', 'n', 'e', 'w'] : (v ? ['s', 'e'] : ['s', 'w']), tiers: tier >= 2 ? { s: 2, n: 1, e: 1, w: 1 } : { s: 1, n: tier ? 1 : 0 },
        density: [0.72, 0.82, 0.88, 0.92][tier],
        chua: tier ? [sx * hw * 0.5, -hw * 0.45, [0, 0.85, 1.0, 1.15][tier], [0, 3, 5, 7][tier]] : null,
        dinh: [-sx * hw * 0.5, hw * 0.45, [0.8, 0.9, 1.0, 1.1][tier]], palms: 4 + tier * 3
      });
      return hw;
    };
  }
  // 升龙：城中偏北一座皇城——五洞端门、敬天殿坐高台（黄瓦）、两厢
  function vnCap(m) {
    const r = rng(1491), pz = -0.7, s = 1.0;
    vnTown(m, r, { hw: 3.6, h: 0.52, t: 0.22, crenel: 0.22, moat: true, gates: ['s', 'n', 'e', 'w'], tiers: { s: 2, n: 2, e: 2, w: 2 }, density: 0.92,
      chua: [2.0, 1.6, 1.1, 7], dinh: [-2.0, 1.7, 1.1], palms: 16, keep: [[-1.35 * s, pz - 1.15 * s, 1.35 * s, pz + 1.2 * s]] });
    courtyard(m, 0, pz, 1.25 * s, 1.05 * s, 0.16, 0.06, C.palace, S.vnRoof2, 0.0);
    flat(m, -1.2 * s, pz - 1.0 * s, 1.2 * s, pz + 1.0 * s, 0.03, C.pave);
    box(m, -0.5 * s, -0.4, pz + 1.0 * s - 0.08, 0.5 * s, 0.22, pz + 1.0 * s + 0.08, C.palace, { top: C.palace });
    for (const dx of [-0.32, -0.16, 0, 0.16, 0.32]) m.quad([dx * s - 0.04, 0, pz + 1.0 * s + 0.084], [dx * s + 0.04, 0, pz + 1.0 * s + 0.084], [dx * s + 0.04, 0.13, pz + 1.0 * s + 0.084], [dx * s - 0.04, 0.13, pz + 1.0 * s + 0.084], C.hole);
    pavilion(m, 0, 0.22, pz + 1.0 * s, 0.3 * s, 0.08, 0.1, 2, C.gold, { body: C.red, lift: 0.06 });
    mound(m, 0, pz - 0.2 * s, 0.55 * s, 0.42 * s, 0.45 * s, 0.34 * s, -0.4, 0.14, C.stoneTop);
    hall(m, 0, pz - 0.22 * s, 0.34 * s, 0.17 * s, 0.13, C.gold, { base: C.stoneTop, body: C.red, tiers: 2, lift: 0.06, y: 0.14 });
    for (const sx of [-1, 1]) house(m, sx * 0.85 * s, pz - 0.1 * s, 0.6 * s, 0.16 * s, 0.09, C.red, S.vnRoof, true);
    return 3.6;
  }

  // ======================= 南洋诸国 =======================
  // 钟形佛塔：三层方台，上一口钟形的身（八棱），宝顶几道环、金色尖刹。gilt 金身（骠、蒲甘），否则白身金顶
  function stupa(m, x, z, s, gilt = false) {
    const body = gilt ? S.gold : S.white, top = S.gold;
    mound(m, x, z, 0.17 * s, 0.17 * s, 0.15 * s, 0.15 * s, -0.3, 0.035 * s, S.whiteTop);
    mound(m, x, z, 0.14 * s, 0.14 * s, 0.12 * s, 0.12 * s, 0.035 * s, 0.065 * s, S.whiteTop);
    const prof = [[0.115, 0.065], [0.12, 0.1], [0.11, 0.15], [0.08, 0.195], [0.045, 0.22], [0.03, 0.235]];
    const n = far() ? 6 : 8;
    for (let k2 = 0; k2 < prof.length - 1; k2++) {
      const [r0, y0] = prof[k2], [r1, y1] = prof[k2 + 1];
      for (let i = 0; i < n; i++) {
        const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
        m.quad([x + Math.cos(a0) * r0 * s, y0 * s, z + Math.sin(a0) * r0 * s], [x + Math.cos(a1) * r0 * s, y0 * s, z + Math.sin(a1) * r0 * s],
          [x + Math.cos(a1) * r1 * s, y1 * s, z + Math.sin(a1) * r1 * s], [x + Math.cos(a0) * r1 * s, y1 * s, z + Math.sin(a0) * r1 * s], k2 >= 3 ? top : body);
      }
    }
    for (let i = 0; i < 4; i++) {
      const a0 = i / 4 * Math.PI * 2, a1 = (i + 1) / 4 * Math.PI * 2, rr = 0.03 * s, y0 = 0.235 * s;
      m.tri([x + Math.cos(a0) * rr, y0, z + Math.sin(a0) * rr], [x + Math.cos(a1) * rr, y0, z + Math.sin(a1) * rr], [x, y0 + 0.14 * s, z], top);
    }
  }
  // 砖塔（占婆、真腊那样）：方身一节节收，四面假门，顶上一个圆锥
  function prang(m, x, z, s) {
    let y = -0.3, a = 0.11 * s;
    box(m, x - a * 1.25, y, z - a * 1.25, x + a * 1.25, 0.04 * s, z + a * 1.25, S.brickTop);
    y = 0.04 * s;
    for (let i = 0; i < 4; i++) {
      const h = (i === 0 ? 0.13 : 0.05) * s;
      box(m, x - a, y, z - a, x + a, y + h, z + a, S.brick, { top: S.brickTop });
      if (i === 0 && !far()) m.quad([x - a * 0.3, y, z + a + 0.003], [x + a * 0.3, y, z + a + 0.003], [x + a * 0.3, y + h * 0.7, z + a + 0.003], [x - a * 0.3, y + h * 0.7, z + a + 0.003], C.hole);
      y += h; a *= 0.8;
    }
    for (let i = 0; i < 4; i++) {
      const a0 = i / 4 * Math.PI * 2 + Math.PI / 4, a1 = a0 + Math.PI / 2;
      m.tri([x + Math.cos(a0) * a * 1.3, y, z + Math.sin(a0) * a * 1.3], [x + Math.cos(a1) * a * 1.3, y, z + Math.sin(a1) * a * 1.3], [x, y + 0.1 * s, z], S.brickTop);
    }
  }
  // 王宫：台基上一座殿，层层收顶的尖阁（n 层），顶上金刹
  function prasat(m, x, z, s, n) {
    box(m, x - 0.42 * s, -0.4, z - 0.32 * s, x + 0.42 * s, 0.06, z + 0.32 * s, S.whiteTop);
    box(m, x - 0.3 * s, 0.06, z - 0.2 * s, x + 0.3 * s, 0.15, z + 0.2 * s, C.red, { faces: 'nsew' });
    let y = 0.15, a = 0.36 * s, b = 0.26 * s;
    for (let i = 0; i < n; i++) {
      const top = i === n - 1;
      if (top) hipRoof(m, x, y, z, a, b, 0.07 * s, S.vnRoof2, { lift: 0.03, ridge: S.gold });
      else {
        skirt(m, x, y, z, a, b, a * 0.72, b * 0.72, 0.06 * s, S.vnRoof2, 0.03);
        box(m, x - a * 0.6, y + 0.04 * s, z - b * 0.6, x + a * 0.6, y + 0.08 * s, z + b * 0.6, S.gold, { faces: 'nsew' });
      }
      y += 0.08 * s; a *= 0.72; b *= 0.72;
    }
    box(m, x - 0.012, y, z - 0.012, x + 0.012, y + 0.2 * s, z + 0.012, S.gold, { faces: 'nsew' });
  }
  // 砖砌佛殿（蒲甘那样）：方殿、两层台、上一座尖顶
  function zedi(m, x, z, s) {
    box(m, x - 0.2 * s, -0.4, z - 0.2 * s, x + 0.2 * s, 0.12 * s, z + 0.2 * s, S.brick, { top: S.brickTop });
    m.quad([x - 0.05 * s, 0, z + 0.2 * s + 0.003], [x + 0.05 * s, 0, z + 0.2 * s + 0.003], [x + 0.05 * s, 0.09 * s, z + 0.2 * s + 0.003], [x - 0.05 * s, 0.09 * s, z + 0.2 * s + 0.003], C.hole);
    mound(m, x, z, 0.16 * s, 0.16 * s, 0.12 * s, 0.12 * s, 0.12 * s, 0.17 * s, S.brickTop);
    mound(m, x, z, 0.1 * s, 0.1 * s, 0.07 * s, 0.07 * s, 0.17 * s, 0.21 * s, S.brickTop);
    for (let i = 0; i < 4; i++) {
      const a0 = i / 4 * Math.PI * 2 + Math.PI / 4, a1 = a0 + Math.PI / 2, rr = 0.075 * s;
      m.tri([x + Math.cos(a0) * rr, 0.21 * s, z + Math.sin(a0) * rr], [x + Math.cos(a1) * rr, 0.21 * s, z + Math.sin(a1) * rr], [x, 0.36 * s, z], S.gold);
    }
  }
  // o：hw；wall 0 木栅 1 砖城；moat；palace [x, z, s, 层]；stupas [[x, z, s, 金]]；zedis；prangs；density 高脚屋疏密
  function seaTown(m, r, o) {
    const { hw } = o, keep = [];
    if (o.moat) {
      const a = hw + 0.1, b = a + 0.3;
      flat(m, -b, a, b, b, 0.012, C.water); flat(m, -b, -b, b, -a, 0.012, C.water);
      flat(m, -b, -a, -a, a, 0.012, C.water); flat(m, a, -a, b, a, 0.012, C.water);
      flat(m, -0.12, a - 0.02, 0.12, b + 0.02, 0.02, S.brickTop);
    }
    if (o.wall) {
      wallRing(m, hw, o.h, o.t, S.brick, S.brickTop, 0);
      box(m, -0.22, -1, hw - o.t - 0.05, 0.22, o.h + 0.06, hw + 0.05, S.brick, { top: S.brickTop });
      m.quad([-0.07, 0, hw + 0.054], [0.07, 0, hw + 0.054], [0.07, o.h * 0.65, hw + 0.054], [-0.07, o.h * 0.65, hw + 0.054], C.hole);
    } else {
      palisade(m, [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]], 0.24);
    }
    const inner = hw - (o.t || 0.06);
    flat(m, -0.1, -inner, 0.1, inner, 0.026, C.street); keep.push([-0.14, -inner, 0.14, inner]);
    if (o.palace) { const [x, z, s, n] = o.palace; prasat(m, x, z, s, n); keep.push([x - 0.46 * s, z - 0.36 * s, x + 0.46 * s, z + 0.36 * s]); }
    for (const [x, z, s, gilt] of o.stupas || []) { stupa(m, x, z, s, gilt); keep.push([x - 0.2 * s, z - 0.2 * s, x + 0.2 * s, z + 0.2 * s]); }
    for (const [x, z, s] of o.zedis || []) { zedi(m, x, z, s); keep.push([x - 0.22 * s, z - 0.22 * s, x + 0.22 * s, z + 0.22 * s]); }
    for (const [x, z, s] of o.prangs || []) { prang(m, x, z, s); keep.push([x - 0.16 * s, z - 0.16 * s, x + 0.16 * s, z + 0.16 * s]); }
    stiltField(m, r, -inner + 0.04, -inner + 0.04, inner - 0.04, inner - 0.04, o.density, keep);
    for (let i = 0; i < 4 + 2 * (o.palms || 0); i++) {
      const side = i % 4, u = (r() - 0.5) * 1.8 * hw, d = hw + 0.14 + r() * 0.12 + (o.moat ? 0.46 : 0);
      const [x, z] = [[u, d], [d, u], [u, -d], [-d, u]][side];
      palm(m, x, z, 1 + r() * 0.4, r() * 6);
    }
  }
  function sea(tier, v) {
    return (m) => {
      const r = rng(1501 + tier * 10 + v), sx = v ? -1 : 1, hw = [1.4, 1.9, 2.4, 2.95][tier];
      const gilt = v === 1;
      seaTown(m, r, {
        hw, wall: tier >= 1, h: [0, 0.26, 0.32, 0.38][tier], t: [0.06, 0.13, 0.15, 0.17][tier], moat: tier >= 1, density: [0.62, 0.7, 0.74, 0.78][tier], palms: tier,
        palace: tier >= 2 ? [0, -hw * 0.42, [0, 0, 1.0, 1.2][tier], [0, 0, 4, 5][tier]] : null,
        stupas: [[sx * hw * 0.5, hw * 0.35, [1.0, 1.3, 1.5, 1.8][tier], gilt]].concat(tier >= 2 ? [[-sx * hw * 0.55, -hw * 0.45, 1.1, !gilt]] : []).concat(tier >= 3 ? [[sx * hw * 0.55, -hw * 0.55, 1.0, gilt], [-sx * hw * 0.5, hw * 0.5, 1.2, gilt]] : []),
        zedis: tier >= 1 ? [[-sx * hw * 0.45, hw * 0.1, [0, 0.9, 1.0, 1.15][tier]]] : [],
        prangs: v === 0 && tier >= 1 ? [[sx * hw * 0.55, -hw * 0.1, 1.0]] : []
      });
      return hw;
    };
  }
  // 都城（蒲甘、吴哥那样）：大护城河、红砖城，城中王宫七层尖阁，一座大金塔，几座佛殿
  function seaCap(m) {
    const r = rng(1591);
    seaTown(m, r, { hw: 3.55, wall: true, h: 0.44, t: 0.2, moat: true, density: 0.8, palms: 5,
      palace: [0, -1.2, 1.5, 7], stupas: [[1.7, 1.2, 2.6, true], [-1.8, -1.6, 1.3, false], [1.9, -1.8, 1.2, true]],
      zedis: [[-1.7, 1.0, 1.4], [-0.9, 2.1, 1.1], [0.9, 2.2, 1.0]], prangs: [[-2.4, 0.0, 1.2]] });
    return 3.55;
  }

  // ======================= 西洋据点 =======================
  // 教堂：白墙红瓦的长殿（南北走向），正面（+z）一堵高出屋脊的山花墙、黑门，东侧一座钟楼（方身、窗洞、四坡小顶）
  function church(m, x, z, s) {
    const a = 0.11 * s, b = 0.26 * s, h = 0.14 * s, rh = a * 0.85, ea = a + 0.03, eb = b + 0.02;
    box(m, x - a, -0.4, z - b, x + a, h, z + b, S.church, { faces: 'nsew' });
    for (const sx of [-1, 1]) m.quad([x + sx * ea, h - 0.01, z - eb], [x + sx * ea, h - 0.01, z + eb], [x, h + rh, z + eb], [x, h + rh, z - eb], S.tileRed);
    m.tri([x - a, h, z - b], [x + a, h, z - b], [x, h + rh * 0.95, z - b], S.church);
    m.quad([x - a - 0.012, 0, z + b + 0.005], [x + a + 0.012, 0, z + b + 0.005], [x + a + 0.012, h, z + b + 0.005], [x - a - 0.012, h, z + b + 0.005], S.church);
    m.quad([x - a - 0.012, h, z + b + 0.005], [x + a + 0.012, h, z + b + 0.005], [x + a * 0.45, h + rh * 1.35, z + b + 0.005], [x - a * 0.45, h + rh * 1.35, z + b + 0.005], S.church);
    m.quad([x - a * 0.32, 0, z + b + 0.008], [x + a * 0.32, 0, z + b + 0.008], [x + a * 0.32, h * 0.62, z + b + 0.008], [x - a * 0.32, h * 0.62, z + b + 0.008], C.hole);
    const tx = x + a + 0.055 * s, tz = z + b - 0.06 * s, ts = 0.055 * s, th = h * 2.1;
    box(m, tx - ts, -0.4, tz - ts, tx + ts, th, tz + ts, S.church, { faces: 'nsew' });
    if (!far()) m.quad([tx - ts * 0.4, th * 0.76, tz + ts + 0.003], [tx + ts * 0.4, th * 0.76, tz + ts + 0.003], [tx + ts * 0.4, th * 0.92, tz + ts + 0.003], [tx - ts * 0.4, th * 0.92, tz + ts + 0.003], C.hole);
    hipRoof(m, tx, th, tz, ts + 0.012, ts + 0.012, ts * 1.4, S.tileRed2, { bands: 1 });
  }
  // 石屋：石砌的底层，上层白墙出挑，红瓦四坡
  function stoneHouse(m, x, z, w, d, wh, rot) {
    m.push(x, 0, z, rot ? Math.PI / 2 : 0);
    box(m, -w / 2, -0.5, -d / 2, w / 2, wh * 0.5, d / 2, S.fortTop, { faces: 'nsew' });
    box(m, -w / 2 - 0.01, wh * 0.5, -d / 2 - 0.01, w / 2 + 0.01, wh, d / 2 + 0.01, S.church, { faces: 'nsew' });
    hipRoof(m, 0, wh, 0, w / 2 + 0.03, d / 2 + 0.03, d * 0.38, S.tileRed, { bands: 1 });
    m.pop();
  }
  const WEST_LOOK = { build: (m, cx, cz, w, d, wh, wall, roof, side) => stoneHouse(m, cx, cz, w, d, wh * 1.15, side) };
  // 棱堡城：四面幕墙，四角各一座菱形炮台（转四十五度的方台），每面正中再一座半菱形的；南面一道门
  function bastioned(m, hw, h, t, mid) {
    wallRing(m, hw, h, t, S.fort, S.fortTop, 0);
    const bs = Math.max(0.2, hw * 0.16);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      m.push(sx * hw, 0, sz * hw, Math.PI / 4);
      box(m, -bs, -1, -bs, bs, h + 0.02, bs, S.fort, { top: S.fortTop });
      m.pop();
    }
    if (mid) for (const g of ['n', 'e', 'w']) {
      m.push(0, 0, 0, YAW[g]); m.push(0, 0, hw, Math.PI / 4);
      box(m, -bs * 0.7, -1, -bs * 0.7, bs * 0.7, h, bs * 0.7, S.fort, { top: S.fortTop });
      m.pop(); m.pop();
    }
    box(m, -0.2, -1, hw - t - 0.04, 0.2, h + 0.05, hw + 0.04, S.fort, { top: S.fortTop });
    m.quad([-0.07, 0, hw + 0.044], [0.07, 0, hw + 0.044], [0.07, h * 0.7, hw + 0.044], [-0.07, h * 0.7, hw + 0.044], C.hole);
  }
  // o：hw（据点那一圈），fort [半宽, 墙高, 墙厚, 正中炮台] 或无（传教的镇子只有广场）；church [x, z, s]；density 城里石屋；
  // nipa 城外尼巴屋那一圈宽；parian 华商八连 [x, z, 半宽]
  function westTown(m, r, o) {
    const { hw } = o, keep = [];
    if (o.fort) {
      const [fa, fh, ft, mid] = o.fort;
      bastioned(m, fa, fh, ft, mid);
      flat(m, -fa + ft, -fa + ft, fa - ft, fa - ft, 0.02, C.ground);
      flat(m, -0.09, -fa + ft, 0.09, fa - ft, 0.026, C.street);
      const ckeep = [[-0.12, -fa, 0.12, fa]].concat(o.innerKeep || []);
      if (o.church) { const [x, z, s] = o.church; church(m, x, z, s); ckeep.push([x - 0.2 * s, z - 0.34 * s, x + 0.25 * s, z + 0.34 * s]); flat(m, x - 0.25 * s, z + 0.3 * s, x + 0.25 * s, z + 0.6 * s, 0.026, C.pave); ckeep.push([x - 0.3 * s, z + 0.28 * s, x + 0.3 * s, z + 0.65 * s]); }
      quarter(m, r, -fa + ft + 0.04, -fa + ft + 0.04, fa - ft - 0.04, fa - ft - 0.04, o.density, ckeep, false, WEST_LOOK);
      keep.push([-fa - 0.35, -fa - 0.35, fa + 0.35, fa + 0.35]);
    } else {
      // 传教的镇子：广场、教堂、修院
      flat(m, -0.45, -0.1, 0.45, 0.55, 0.022, C.pave);
      if (o.church) { const [x, z, s] = o.church; church(m, x, z, s); }
      stoneHouse(m, 0.42, -0.25, 0.4, 0.2, 0.12, false);
      keep.push([-0.7, -0.8, 0.8, 0.7]);
    }
    if (o.parian) {
      const [x, z, a] = o.parian;
      quarter(m, r, x - a, z - a * 0.6, x + a, z + a * 0.6, 0.9, []);
      keep.push([x - a - 0.1, z - a * 0.6 - 0.1, x + a + 0.1, z + a * 0.6 + 0.1]);
    }
    stiltField(m, r, -hw, -hw, hw, hw, o.nipa ?? 0.5, keep);
  }
  function we(tier, v) {
    return (m) => {
      const r = rng(1601 + tier * 10 + v), sx = v ? -1 : 1, hw = [1.4, 1.9, 2.4, 2.95][tier];
      if (tier === 0) westTown(m, r, { hw, church: [-0.2 * sx, -0.25, 1.0], nipa: 0.5 });
      else if (tier === 1) westTown(m, r, { hw, fort: [0.85, 0.24, 0.12, false], church: [sx * 0.3, -0.25, 0.9], density: 0.6, nipa: 0.45 });
      else if (tier === 2) westTown(m, r, { hw, fort: [1.35, 0.3, 0.14, true], church: [sx * 0.45, -0.4, 1.1], density: 0.8, nipa: 0.4 });
      else westTown(m, r, { hw, fort: [1.75, 0.34, 0.15, true], church: [sx * 0.6, -0.55, 1.3], density: 0.86, nipa: 0.35 });
      return hw;
    };
  }
  // 马尼拉：棱堡王城，城角一座圣地亚哥那样的小堡，大教堂；城外华商八连、尼巴屋
  function weCap(m) {
    const r = rng(1691);
    westTown(m, r, { hw: 3.6, fort: [2.0, 0.38, 0.16, true], church: [0.55, -0.6, 1.5], density: 0.86, nipa: 0.3, parian: [-2.6, 2.6, 0.75], innerKeep: [[-2.05, -2.05, -1.0, -1.0]] });
    bastioned2(m, -1.55, -1.55, 0.42, 0.42);
    return 3.6;
  }
  // 城角小堡：一圈矮墙、四角炮台，当中一座方楼
  function bastioned2(m, x, z, a, h) {
    m.push(x, 0, z);
    wallRing(m, a, h, 0.08, S.fort, S.fortTop, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { m.push(sx * a, 0, sz * a, Math.PI / 4); box(m, -0.08, -1, -0.08, 0.08, h + 0.02, 0.08, S.fort, { top: S.fortTop }); m.pop(); }
    box(m, -0.12, -0.4, -0.12, 0.12, h + 0.14, 0.12, S.fort, { top: S.fortTop });
    m.pop();
  }

  // ======================= 城外诸样：共用 =======================
  // 木栈：从岸上伸进海里（朝 +z），两排桩
  function pier(m, len = 1.3) {
    box(m, -0.09, -0.06, -0.3, 0.09, 0.03, len, C.woodLight);
    for (let z = 0; z <= len - 0.05; z += 0.26) for (const sx of [-0.1, 0.1]) box(m, sx - 0.015, -0.4, z - 0.015, sx + 0.015, 0.04, z + 0.015, C.wood, { faces: 'nsew' });
  }
  // 吹き放ちの大屋根（市场、讲亭）：四角与长边正中立柱，歇山顶
  function openHall(m, x, z, a, b, h, roof, ridge = S.vnRoof2) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]]) box(m, x + sx * a * 0.9 - 0.012, -0.2, z + sz * b * 0.9 - 0.012, x + sx * a * 0.9 + 0.012, h, z + sz * b * 0.9 + 0.012, C.wood, { faces: 'nsew' });
    hipRoof(m, x, h, z, a + 0.05, b + 0.05, Math.max(a, b) * 0.42, roof, { lift: 0.05, ridge });
  }
  // 摊棚：四根细柱，上蒙一块微斜的白布
  function canopy(m, x, z, a, b) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(m, x + sx * a - 0.006, -0.1, z + sz * b - 0.006, x + sx * a + 0.006, 0.08, z + sz * b + 0.006, C.wood, { faces: 'nsew' });
    m.quad([x - a - 0.02, 0.07, z + b + 0.02], [x + a + 0.02, 0.07, z + b + 0.02], [x + a + 0.02, 0.095, z - b - 0.02], [x - a - 0.02, 0.095, z - b - 0.02], S.canvas);
  }

  // ======================= 城外诸样：大越 =======================
  // 市（chợ）：南北大街两侧红瓦的筒屋，街心一座吹き放ちの市场大屋根；西侧一座亭；四周椰与槟榔
  function vnMarket(m) {
    const r = rng(1483);
    flat(m, -0.1, -1.05, 0.1, 1.05, 0.016, C.street);
    flat(m, -0.52, -0.32, 0.52, 0.32, 0.018, C.pave);
    openHall(m, 0, 0, 0.36, 0.2, 0.1, S.vnRoof);
    for (const sx of [-1, 1]) {
      for (const z0 of [-1.0, 0.38]) for (let z = z0; z < z0 + 0.6; z += 0.17) house(m, sx * 0.27, z + 0.08, 0.3, 0.15, 0.1 + r() * 0.03, pick(r, [S.white, C.plaster2, S.white]), pick(r, [S.vnRoof, S.vnRoof2]), true);
      for (const z of [-0.74, 0.74]) if (r() < 0.8) house(m, sx * 0.64, z, 0.26, 0.2, 0.09, C.earthHouse, S.palmThatch);
    }
    dinh(m, -0.72, 0, 0.75);
    for (const [x, z, s] of [[0.78, -0.1, 1.2], [0.92, 0.3, 1.0], [-0.95, -0.5, 1.1], [-0.92, 0.55, 1.15], [0.9, -0.9, 1.0]]) palm(m, x, z, s, x * 3 + z);
    return 1.1;
  }
  // 港：岸上红瓦白墙的货栈、一间草房，木栈伸进海里，两只帆船；几株椰
  function vnPort(m, sea = true) {
    house(m, -0.25, -0.62, 0.78, 0.28, 0.13, S.white, S.vnRoof);
    house(m, 0.55, -0.55, 0.36, 0.24, 0.11, C.plaster2, S.vnRoof2, true);
    house(m, -0.7, -0.2, 0.3, 0.22, 0.1, C.earthHouse, S.palmThatch);
    palm(m, 0.36, -0.22, 1.1, 1); palm(m, -0.86, -0.58, 1.05, 3);
    m.sea = sea;
    pier(m);
    junk(m, 0.38, 0.8, Math.PI / 2 + 0.2, 0.6);
    junk(m, -0.36, 1.12, Math.PI / 2 - 0.15, 0.5);
    m.sea = false;
    return 0.8;
  }
  // 寺（chùa）：白墙一圈，南面三关门（中间二重、两旁一重）；上殿红瓦两重翘角；殿后砖塔七级；门内一方莲池；椰
  function vnTemple(m) {
    const cz = -0.04, roofs = { body: C.red, lift: 0.06, ridge: S.vnRoof2 };
    flat(m, -0.86, cz - 0.86, 0.86, cz + 0.86, 0.016, C.pave);
    courtyard(m, 0, cz, 0.9, 0.88, 0.08, 0.035, S.white, S.vnRoof2, 0.62);
    pavilion(m, 0, 0, cz + 0.88, 0.13, 0.07, 0.11, 2, S.vnRoof, roofs);
    for (const sx of [-1, 1]) pavilion(m, sx * 0.24, 0, cz + 0.88, 0.08, 0.06, 0.08, 1, S.vnRoof, roofs);
    hall(m, 0, cz + 0.08, 0.34, 0.17, 0.11, S.vnRoof, { body: C.red, lift: 0.07, tiers: 2 });
    pagoda(m, 0, cz - 0.5, 7, 0.2, S.brick, S.vnRoof2);
    flat(m, -0.66, cz + 0.4, -0.34, cz + 0.66, 0.02, C.water);
    palm(m, 0.62, cz + 0.5, 1.2, 1); palm(m, -0.64, cz - 0.55, 1.1, 2.2); palm(m, 0.64, cz - 0.6, 1.15, 4);
    return 1.0;
  }
  // 华表柱（cột đồng trụ）：白方柱、柱头一块红瓦帽、上一截小方顶
  function pillar(m, x, z, h) {
    box(m, x - 0.03, -0.2, z - 0.03, x + 0.03, h, z + 0.03, S.white, { top: S.whiteTop });
    box(m, x - 0.045, h, z - 0.045, x + 0.045, h + 0.04, z + 0.045, S.vnRoof2);
    box(m, x - 0.022, h + 0.04, z - 0.022, x + 0.022, h + 0.09, z + 0.022, S.white, { top: S.whiteTop });
  }
  // 庙（đền）：白墙一圈，门外两根华表柱；前头宽矮大顶的拜亭，后头正殿；两株椰
  function vnShrine(m) {
    const cz = -0.2;
    flat(m, -0.72, cz - 0.62, 0.72, cz + 0.62, 0.016, C.pave);
    courtyard(m, 0, cz, 0.76, 0.64, 0.08, 0.035, S.white, S.vnRoof2, 0.3);
    dinh(m, 0, cz + 0.16, 1.25);
    hall(m, 0, cz - 0.36, 0.24, 0.13, 0.1, S.vnRoof, { body: C.red, lift: 0.07 });
    for (const sx of [-1, 1]) pillar(m, sx * 0.2, cz + 0.88, 0.3);
    palm(m, -0.56, cz - 0.4, 1.1, 1); palm(m, 0.58, cz - 0.38, 1.05, 3);
    return 0.9;
  }
  // 文庙（văn miếu）：白墙一圈，南门一重楼；门内奎文阁（四根白柱上二重楼阁），阁后天光井一方水，北面大成殿；两株椰
  function vnAcademy(m) {
    const cz = -0.16, roofs = { body: C.red, lift: 0.05, ridge: S.vnRoof2 };
    flat(m, -0.78, cz - 0.7, 0.78, cz + 0.7, 0.016, C.pave);
    courtyard(m, 0, cz, 0.82, 0.74, 0.08, 0.035, S.white, S.vnRoof2, 0.26);
    pavilion(m, 0, 0, cz + 0.74, 0.12, 0.06, 0.09, 1, S.vnRoof, roofs);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(m, sx * 0.1 - 0.025, -0.2, cz + 0.36 + sz * 0.08 - 0.025, sx * 0.1 + 0.025, 0.12, cz + 0.36 + sz * 0.08 + 0.025, S.white, { faces: 'nsew' });
    pavilion(m, 0, 0.12, cz + 0.36, 0.13, 0.11, 0.08, 2, S.vnRoof, roofs);
    flat(m, -0.3, cz - 0.02, 0.3, cz + 0.18, 0.02, C.water);
    hall(m, 0, cz - 0.42, 0.36, 0.14, 0.11, S.vnRoof, { body: C.red, lift: 0.07 });
    palm(m, -0.6, cz + 0.3, 1.1, 1); palm(m, 0.6, cz + 0.32, 1.1, 2.5);
    return 0.9;
  }
  // 屯（đồn）：砖石方城、雉堞，南门一重楼；城中两排营房、一杆旗
  function vnFort(m) {
    const hw = 0.82;
    flat(m, -hw + 0.12, -hw + 0.12, hw - 0.12, hw - 0.12, 0.02, C.ground);
    wallRing(m, hw, 0.3, 0.12, S.vnWall, S.vnWallTop, 0.18);
    vnGate(m, hw, 0.3, 0.12, 0.36, 1);
    for (const z of [-0.36, 0.1]) house(m, 0, z, 0.9, 0.2, 0.1, S.white, S.vnRoof);
    flag(m, 0.5, -0.5, 0.8);
    return 0.95;
  }
  // 衙：白墙一圈，南门一重楼；院里红瓦正堂、两厢；两株椰
  function vnYamen(m) {
    const cz = -0.2;
    flat(m, -0.74, cz - 0.6, 0.74, cz + 0.6, 0.016, C.pave);
    courtyard(m, 0, cz, 0.78, 0.64, 0.08, 0.035, S.white, S.vnRoof2, 0.28);
    pavilion(m, 0, 0, cz + 0.64, 0.14, 0.06, 0.1, 1, S.vnRoof, { body: C.red, lift: 0.06, ridge: S.vnRoof2 });
    hall(m, 0, cz - 0.16, 0.34, 0.16, 0.12, S.vnRoof, { body: C.red, lift: 0.07 });
    for (const sx of [-1, 1]) house(m, sx * 0.52, cz + 0.2, 0.44, 0.15, 0.09, S.white, S.vnRoof2, true);
    palm(m, -0.55, cz - 0.48, 1.1, 1); palm(m, 0.55, cz - 0.45, 1.05, 3);
    return 0.9;
  }

  // ======================= 城外诸样：南洋诸国 =======================
  // 小舟：两头尖，船心一块舱板（运河上）
  function canoe(m, x, z, L, yaw = 0) {
    m.push(x, 0, z, yaw);
    const b = L * 0.13, hull = [[-L / 2, 0], [-L * 0.3, b], [L * 0.3, b], [L / 2, 0], [L * 0.3, -b], [-L * 0.3, -b]];
    for (let i = 0; i < hull.length; i++) { const [x0, z0] = hull[i], [x1, z1] = hull[(i + 1) % hull.length]; m.quad([x0 * 0.9, 0, z0 * 0.6], [x1 * 0.9, 0, z1 * 0.6], [x1, 0.035, z1], [x0, 0.035, z0], C.hull); }
    m.quad([-L * 0.3, 0.035, b], [L * 0.3, 0.035, b], [L * 0.3, 0.035, -b], [-L * 0.3, 0.035, -b], C.woodLight);
    m.pop();
  }
  // 带边架的帆舟（吕宋、马来那样）：细长两头尖的船身，左右各一根浮木由两道横杆架着；一根桅，一面斜张的席帆。吃水线 y=0，长 L，头朝 +x
  function prahu(m, x, z, yaw, L) {
    m.push(x, 0, z, yaw);
    const b = L * 0.1, hh = L * 0.08, hull = [[-L / 2, 0], [-L * 0.3, b], [L * 0.3, b], [L / 2, 0], [L * 0.3, -b], [-L * 0.3, -b]];
    for (let i = 0; i < hull.length; i++) { const [x0, z0] = hull[i], [x1, z1] = hull[(i + 1) % hull.length]; m.quad([x0 * 0.9, -0.04, z0 * 0.55], [x1 * 0.9, -0.04, z1 * 0.55], [x1, hh, z1], [x0, hh, z0], C.hull); }
    m.quad([-L * 0.3, hh, b], [L * 0.3, hh, b], [L * 0.3, hh, -b], [-L * 0.3, hh, -b], C.woodLight);
    for (const sz of [-1, 1]) box(m, -L * 0.28, -0.01, sz * L * 0.3 - 0.008, L * 0.28, 0.012, sz * L * 0.3 + 0.008, C.wood);
    for (const bx of [-L * 0.12, L * 0.12]) box(m, bx - 0.006, hh * 0.8, -L * 0.31, bx + 0.006, hh * 0.8 + 0.01, L * 0.31, C.wood);
    box(m, -0.008, hh, -0.008, 0.008, hh + L * 0.75, 0.008, C.pole, { faces: 'nsew' });
    m.push(0, 0, 0, 0.5);
    m.quad([-L * 0.26, hh + L * 0.12, 0], [L * 0.3, hh + L * 0.22, 0], [L * 0.22, hh + L * 0.74, 0], [-L * 0.32, hh + L * 0.6, 0], S.mat);
    m.pop();
    m.pop();
  }
  // 市：一道运河东西穿过（街上一座木桥），四座草葺的市棚，两边高脚屋与椰林，河上两只小舟，街东一座小白塔
  function seaMarket(m) {
    const r = rng(1583);
    flat(m, -1.15, -0.12, 1.15, 0.12, 0.012, C.water);
    flat(m, -0.1, -1.05, 0.1, -0.12, 0.016, C.street);
    flat(m, -0.1, 0.12, 0.1, 1.05, 0.016, C.street);
    box(m, -0.1, 0.02, -0.15, 0.1, 0.05, 0.15, C.wood, { top: C.woodLight });
    for (const [x, z] of [[-0.36, -0.34], [0.36, -0.34], [-0.36, 0.36], [0.36, 0.36]]) openHall(m, x, z, 0.16, 0.1, 0.08, S.palmThatch, S.palmThatch);
    stupa(m, 0.36, -0.78, 0.95, false);
    stiltField(m, r, -1.05, -1.05, 1.05, 1.05, 0.6, [[-0.6, -0.52, 0.6, 0.54], [-1.2, -0.17, 1.2, 0.17], [-0.15, -1.1, 0.15, 1.1], [0.14, -1.0, 0.58, -0.56]]);
    canoe(m, -0.62, 0, 0.28); canoe(m, 0.64, 0.02, 0.24, 0.1);
    return 1.1;
  }
  // 港：岸上两座高脚货栈，木栈伸进海里，一只帆船、一只带边架的席帆舟；几株椰
  function seaPort(m, sea = true) {
    stilt(m, -0.3, -0.6, 0.7, 0.3, 0.1, 0.13);
    stilt(m, 0.5, -0.55, 0.36, 0.26, 0.09, 0.11, Math.PI / 2);
    palm(m, -0.76, -0.25, 1.2, 1); palm(m, 0.3, -0.2, 1.0, 3); palm(m, 0.8, -0.18, 1.1, 5);
    m.sea = sea;
    pier(m);
    junk(m, 0.38, 0.8, Math.PI / 2 + 0.2, 0.6);
    prahu(m, -0.36, 1.1, Math.PI / 2 - 0.15, 0.52);
    m.sea = false;
    return 0.8;
  }
  // 寺（wat）：白墙一圈；前头佛殿（层层收顶、金刹），后头一座大塔（白身金顶），两旁两座通身金的小塔；椰
  function seaTemple(m) {
    const cz = -0.04;
    flat(m, -0.86, cz - 0.86, 0.86, cz + 0.86, 0.016, C.pave);
    courtyard(m, 0, cz, 0.9, 0.88, 0.07, 0.035, S.white, S.whiteTop, 0.3);
    prasat(m, 0, cz + 0.34, 0.8, 3);
    stupa(m, 0, cz - 0.36, 2.1, false);
    for (const sx of [-1, 1]) stupa(m, sx * 0.58, cz - 0.56, 0.85, true);
    palm(m, -0.62, cz + 0.55, 1.2, 1); palm(m, 0.62, cz + 0.5, 1.1, 2.3);
    return 1.0;
  }
  // 祠（砖塔庙）：砖墙一圈，南面砖门；当中一座大砖塔，两旁两座小砖塔；两株椰
  function seaShrine(m) {
    const cz = -0.12;
    flat(m, -0.72, cz - 0.66, 0.72, cz + 0.66, 0.016, C.pave);
    courtyard(m, 0, cz, 0.76, 0.7, 0.09, 0.04, S.brick, S.brickTop, 0.26);
    box(m, -0.18, -0.3, cz + 0.62, 0.18, 0.16, cz + 0.76, S.brick, { top: S.brickTop });
    m.quad([-0.05, 0, cz + 0.764], [0.05, 0, cz + 0.764], [0.05, 0.11, cz + 0.764], [-0.05, 0.11, cz + 0.764], C.hole);
    prang(m, 0, cz - 0.12, 2.0);
    for (const sx of [-1, 1]) prang(m, sx * 0.44, cz + 0.14, 1.0);
    palm(m, -0.55, cz + 0.45, 1.1, 1); palm(m, 0.56, cz + 0.42, 1.05, 3);
    return 0.85;
  }
  // 学（寺学）：白墙一圈；北面佛殿（层层收顶），南面一座长长的吹き放ち讲亭，一座金小塔；几株椰
  function seaAcademy(m) {
    const cz = -0.14;
    flat(m, -0.76, cz - 0.66, 0.76, cz + 0.66, 0.016, C.pave);
    courtyard(m, 0, cz, 0.8, 0.7, 0.07, 0.035, S.white, S.whiteTop, 0.28);
    prasat(m, 0, cz - 0.34, 0.75, 2);
    openHall(m, 0, cz + 0.28, 0.42, 0.12, 0.09, S.vnRoof2, S.gold);
    stupa(m, 0.52, cz - 0.42, 0.8, true);
    palm(m, -0.55, cz - 0.45, 1.1, 1); palm(m, -0.58, cz + 0.45, 1.1, 2); palm(m, 0.58, cz + 0.42, 1.05, 4);
    return 0.9;
  }
  // 堡：砖墙方城（城头一排垛口），南面砖门；城中层层收顶的营堂、两座高脚营房、一杆旗
  function seaFort(m) {
    const hw = 0.82;
    flat(m, -hw + 0.12, -hw + 0.12, hw - 0.12, hw - 0.12, 0.02, C.ground);
    wallRing(m, hw, 0.3, 0.12, S.brick, S.brickTop, 0.18);
    box(m, -0.2, -1, hw - 0.17, 0.2, 0.36, hw + 0.05, S.brick, { top: S.brickTop });
    m.quad([-0.06, 0, hw + 0.054], [0.06, 0, hw + 0.054], [0.06, 0.2, hw + 0.054], [-0.06, 0.2, hw + 0.054], C.hole);
    prasat(m, 0, -0.25, 0.7, 2);
    for (const sx of [-1, 1]) stilt(m, sx * 0.42, 0.3, 0.36, 0.2, 0.06, 0.1);
    flag(m, 0.5, -0.5, 0.78);
    return 0.95;
  }
  // 王府（官署）：白墙一圈，南门；院里一座层层收顶的殿（三层），两旁高脚长屋；两株椰
  function seaYamen(m) {
    const cz = -0.18;
    flat(m, -0.74, cz - 0.6, 0.74, cz + 0.6, 0.016, C.pave);
    courtyard(m, 0, cz, 0.78, 0.64, 0.08, 0.035, S.white, S.whiteTop, 0.28);
    box(m, -0.16, -0.3, cz + 0.58, 0.16, 0.14, cz + 0.7, S.white, { top: S.whiteTop });
    hipRoof(m, 0, 0.14, cz + 0.64, 0.2, 0.1, 0.08, S.vnRoof2, { lift: 0.04, ridge: S.gold });
    prasat(m, 0, cz - 0.16, 0.9, 3);
    for (const sx of [-1, 1]) stilt(m, sx * 0.55, cz + 0.25, 0.4, 0.2, 0.07, 0.11, Math.PI / 2);
    palm(m, -0.56, cz - 0.46, 1.1, 1); palm(m, 0.56, cz - 0.44, 1.05, 3);
    return 0.9;
  }

  // ======================= 城外诸样：西洋据点 =======================
  // 西洋帆船（盖伦那样）：船身高，艉楼高起、艏楼，一根斜桅；前、中两桅横帆两层，后桅一面三角帆。吃水线 y=0，长 L，头朝 +x
  function galleon(m, x, z, yaw, L) {
    m.push(x, 0, z, yaw);
    const b = L * 0.15, hh = L * 0.12;
    const hull = [[-L * 0.5, b * 0.85], [L * 0.28, b], [L * 0.5, 0], [L * 0.28, -b], [-L * 0.5, -b * 0.85]];
    for (let i = 0; i < hull.length; i++) { const [x0, z0] = hull[i], [x1, z1] = hull[(i + 1) % hull.length]; m.quad([x0 * 0.85, -0.06, z0 * 0.55], [x1 * 0.85, -0.06, z1 * 0.55], [x1, hh, z1], [x0, hh, z0], C.hull); }
    for (let i = 1; i < hull.length - 1; i++) m.tri([hull[0][0], hh, hull[0][1]], [hull[i][0], hh, hull[i][1]], [hull[i + 1][0], hh, hull[i + 1][1]], C.woodLight);
    box(m, -L * 0.5, hh, -b * 0.78, -L * 0.24, hh + L * 0.15, b * 0.78, C.hull, { top: C.woodLight });
    box(m, L * 0.2, hh, -b * 0.62, L * 0.38, hh + L * 0.07, b * 0.62, C.hull, { top: C.woodLight });
    m.quad([L * 0.44, hh + L * 0.03, -0.006], [L * 0.7, hh + L * 0.12, -0.006], [L * 0.7, hh + L * 0.14, 0.006], [L * 0.44, hh + L * 0.05, 0.006], C.pole);
    for (const [mx, mh, sw] of [[L * 0.2, 0.92, 0.22], [-L * 0.03, 1.05, 0.26]]) {
      box(m, mx - 0.01, hh, -0.01, mx + 0.01, hh + L * mh, 0.01, C.pole, { faces: 'nsew' });
      m.push(mx, 0, 0, Math.PI / 2 + 0.25);
      m.quad([-L * sw, hh + L * mh * 0.3, 0.012], [L * sw, hh + L * mh * 0.3, 0.012], [L * sw * 0.92, hh + L * mh * 0.62, 0.012], [-L * sw * 0.92, hh + L * mh * 0.62, 0.012], S.canvas);
      m.quad([-L * sw * 0.72, hh + L * mh * 0.66, 0.012], [L * sw * 0.72, hh + L * mh * 0.66, 0.012], [L * sw * 0.62, hh + L * mh * 0.93, 0.012], [-L * sw * 0.62, hh + L * mh * 0.93, 0.012], S.canvas);
      m.pop();
    }
    const kx = -L * 0.33;
    box(m, kx - 0.009, hh + L * 0.15, -0.009, kx + 0.009, hh + L * 0.8, 0.009, C.pole, { faces: 'nsew' });
    m.tri([kx - L * 0.14, hh + L * 0.24, 0.002], [kx + L * 0.12, hh + L * 0.3, 0.002], [kx - L * 0.02, hh + L * 0.8, 0.002], S.canvas);
    m.pop();
  }
  // 港：岸上石砌货栈两座、一杆旗；石筑码头伸进海里，一只西洋帆船、一只华人帆船（澳门、马尼拉、大员都有华船往来）
  function wePort(m, sea = true) {
    stoneHouse(m, -0.25, -0.62, 0.78, 0.28, 0.15, false);
    stoneHouse(m, 0.55, -0.55, 0.34, 0.24, 0.14, true);
    flag(m, 0.28, -0.3, 0.62);
    m.sea = sea;
    box(m, -0.12, -0.06, -0.3, 0.12, 0.04, 1.2, S.fortTop, { top: S.fort });
    galleon(m, 0.42, 0.8, Math.PI / 2 + 0.2, 0.7);
    junk(m, -0.4, 1.12, Math.PI / 2 - 0.15, 0.48);
    m.sea = false;
    return 0.8;
  }
  // 市（广场）：石铺广场当中一座喷泉，三面石屋，场上几处白布摊棚；四外尼巴屋、椰
  function weMarket(m) {
    const r = rng(1683);
    flat(m, -0.56, -0.5, 0.56, 0.5, 0.02, C.pave);
    flat(m, -0.1, 0.5, 0.1, 1.05, 0.016, C.street);
    flat(m, -0.1, -1.05, 0.1, -0.5, 0.016, C.street);
    for (const sx of [-1, 1]) for (let z = -0.4; z < 0.45; z += 0.2) stoneHouse(m, sx * 0.7, z, 0.24, 0.18, 0.13, true);
    for (const x of [-0.36, 0.36]) stoneHouse(m, x, -0.66, 0.34, 0.2, 0.13, false);
    pool(m, 0, 0, 0.13, 0.13, 0.03, S.fortTop, 0, Math.PI * 2, 8);
    pool(m, 0, 0, 0.1, 0.1, 0.035, C.water, 0, Math.PI * 2, 8);
    box(m, -0.015, 0, -0.015, 0.015, 0.1, 0.015, S.fort, { faces: 'nsew' });
    for (const [x, z] of [[-0.3, 0.25], [0.3, 0.25], [-0.3, -0.22], [0.3, -0.22]]) canopy(m, x, z, 0.1, 0.07);
    // 四外尼巴屋、椰（广场三面是石屋，北头与南头街两旁才是尼巴屋）
    for (const [x, z, rot] of [[-0.98, -0.62, 0], [0.98, -0.5, 1], [-0.98, 0.16, 1], [0.98, 0.3, 0], [-0.48, 0.82, 0], [0.46, 0.86, 1], [-0.5, -0.98, 1], [0.52, -0.96, 0]]) {
      stilt(m, x, z, 0.26 + r() * 0.08, 0.18 + r() * 0.04, 0.08, 0.1, rot ? Math.PI / 2 : 0);
    }
    for (const [x, z, s] of [[-0.98, 0.62, 1.2], [0.98, -0.92, 1.1], [0.95, 0.75, 1.05], [-0.92, -0.95, 1.1]]) palm(m, x, z, s, x + z * 2);
    return 1.1;
  }
  // 十字架：石座上一根竖、一道横
  function cross(m, x, z, h) {
    box(m, x - 0.04, -0.2, z - 0.04, x + 0.04, 0.04, z + 0.04, S.fort, { top: S.fortTop });
    box(m, x - 0.01, 0.04, z - 0.01, x + 0.01, h, z + 0.01, C.wood, { faces: 'nsew' });
    box(m, x - 0.05, h * 0.72, z - 0.009, x + 0.05, h * 0.78, z + 0.009, C.wood);
  }
  // 教堂（天主堂）：南面石铺前庭、一座十字架，大教堂（山花墙、钟楼），西侧修院（石屋两座）；两株椰
  function weChurch(m) {
    flat(m, -0.6, 0.25, 0.6, 0.9, 0.02, C.pave);
    church(m, 0.05, -0.2, 2.2);
    stoneHouse(m, -0.55, -0.35, 0.5, 0.2, 0.12, true);
    stoneHouse(m, -0.4, -0.72, 0.3, 0.18, 0.11, false);
    cross(m, -0.32, 0.62, 0.3);
    palm(m, 0.66, 0.52, 1.1, 1); palm(m, -0.68, 0.55, 1.05, 3);
    return 0.9;
  }
  // 学院（colegio）：石屋围成一方院，北面一座小教堂（门朝院里），院心一株树
  function weAcademy(m) {
    const cz = -0.1;
    flat(m, -0.7, cz - 0.62, 0.7, cz + 0.62, 0.02, C.pave);
    stoneHouse(m, 0, cz + 0.5, 1.1, 0.2, 0.14, false);
    m.quad([-0.06, 0, cz + 0.602], [0.06, 0, cz + 0.602], [0.06, 0.09, cz + 0.602], [-0.06, 0.09, cz + 0.602], C.hole);
    for (const sx of [-1, 1]) stoneHouse(m, sx * 0.48, cz - 0.02, 0.8, 0.18, 0.13, true);
    church(m, 0, cz - 0.38, 1.25);
    palm(m, 0.16, cz + 0.2, 1.0, 2);
    return 0.9;
  }
  // 堡：棱堡小城（四角菱形炮台），南门；城中两排石营房、一杆旗，南墙头两门炮
  function weFort(m) {
    const fa = 0.72;
    bastioned(m, fa, 0.28, 0.12, false);
    flat(m, -fa + 0.12, -fa + 0.12, fa - 0.12, fa - 0.12, 0.02, C.ground);
    for (const z of [-0.3, 0.12]) stoneHouse(m, 0, z, 0.8, 0.18, 0.12, false);
    flag(m, 0.42, -0.5, 0.78);
    for (const sx of [-1, 1]) box(m, sx * 0.4 - 0.02, 0.28, fa - 0.1, sx * 0.4 + 0.02, 0.31, fa + 0.04, C.black);
    return 1.0;
  }
  // 官署（王府厅、市政厅）：两层石厅（下层拱廊、上层白墙、红瓦四坡），两旁石屋；南面石铺广场、一杆旗；两株椰
  function weYamen(m) {
    const cz = -0.2;
    flat(m, -0.7, cz + 0.2, 0.7, cz + 0.95, 0.02, C.pave);
    box(m, -0.5, -0.5, cz - 0.3, 0.5, 0.12, cz + 0.12, S.fortTop, { faces: 'nsew' });
    for (let i = 0; i < 5; i++) { const x = -0.4 + i * 0.2; m.quad([x - 0.05, 0, cz + 0.122], [x + 0.05, 0, cz + 0.122], [x + 0.05, 0.08, cz + 0.122], [x - 0.05, 0.08, cz + 0.122], C.hole); }
    box(m, -0.51, 0.12, cz - 0.31, 0.51, 0.24, cz + 0.13, S.church, { faces: 'nsew' });
    hipRoof(m, 0, 0.24, cz - 0.09, 0.55, 0.25, 0.12, S.tileRed, { bands: 1 });
    for (const sx of [-1, 1]) stoneHouse(m, sx * 0.64, cz - 0.05, 0.36, 0.2, 0.12, true);
    flag(m, 0, cz + 0.6, 0.8);
    palm(m, -0.55, cz + 0.7, 1.1, 1); palm(m, 0.55, cz + 0.72, 1.05, 3);
    return 0.9;
  }

  // ======================= 四郊村舍（点景近看换上的那种，几千处一起画，每样八十面以内） =======================
  // 椰（省面版）：一根干，顶上五片垂下的羽叶
  function palmS(m, x, z, s) {
    const h = 0.3 * s, w = 0.01 * s, r = 0.13 * s;
    box(m, x - w, -0.2, z - w, x + w, h, z + w, S.trunk, { faces: 'nsew' });
    for (let i = 0; i < 5; i++) {
      const t = i / 5 * Math.PI * 2 + 0.3, c = Math.cos(t), sn = Math.sin(t), px = -sn * 0.02 * s, pz = c * 0.02 * s;
      m.tri([x + px, h, z + pz], [x - px, h, z - pz], [x + c * r, h - 0.06 * s, z + sn * r], i % 2 ? S.palm : S.palmDark);
    }
  }
  // 高脚屋（省面版）：楼身架在两根柱上，陡草两坡
  function stiltS(m, x, z, w, d, raise, wh, rot) {
    m.push(x, 0, z, rot ? Math.PI / 2 : 0);
    for (const [sx, sz] of [[-1, -1], [1, 1]]) box(m, sx * w * 0.4 - 0.014, -0.3, sz * d * 0.4 - 0.014, sx * w * 0.4 + 0.014, raise, sz * d * 0.4 + 0.014, C.wood, { faces: 'ns' });
    box(m, -w / 2, raise, -d / 2, w / 2, raise + wh, d / 2, C.woodLight, { faces: 'nsew' });
    gableRoof(m, 0, raise + wh, 0, w / 2 + 0.05, d / 2 + 0.07, d * 0.75, S.palmThatch, C.woodLight, w / 2, d / 2);
    m.pop();
  }
  // 大越村：一座草顶土屋、一座红瓦白墙屋，屋旁一株槟榔
  function vnHamlet(m) {
    house(m, -0.12, 0.04, 0.42, 0.24, 0.12, C.earthHouse, S.palmThatch, false, -0.3);
    house(m, 0.25, 0.17, 0.3, 0.2, 0.11, S.white, S.vnRoof, true, -0.3);
    palm(m, 0.24, -0.2, 1.4, 0.8);
    return 0.44;
  }
  // 大越庄：红瓦正屋、两座草顶厢屋围着一块场，一株槟榔
  function vnHamletB(m) {
    flat(m, -0.2, -0.06, 0.24, 0.24, 0.014, C.ground);
    house(m, -0.04, -0.22, 0.52, 0.24, 0.13, S.white, S.vnRoof, false, -0.3);
    house(m, -0.4, 0.06, 0.36, 0.2, 0.12, C.earthHouse, S.palmThatch, true, -0.3);
    house(m, 0.4, 0.02, 0.32, 0.2, 0.11, C.earthHouse, S.palmThatch, true, -0.3);
    palm(m, -0.34, -0.34, 1.45, 2.4);
    return 0.52;
  }
  // 南洋村（西洋据点四郊的尼巴屋同此）：两座高脚屋，一株椰
  function seaHamlet(m) {
    stiltS(m, -0.12, 0.04, 0.4, 0.24, 0.1, 0.1, false);
    stiltS(m, 0.26, 0.17, 0.28, 0.2, 0.09, 0.09, true);
    palmS(m, 0.3, -0.2, 1.5);
    return 0.44;
  }
  // 南洋庄：三座高脚屋，一株椰
  function seaHamletB(m) {
    stiltS(m, -0.04, -0.22, 0.48, 0.24, 0.1, 0.11, false);
    stiltS(m, -0.4, 0.08, 0.32, 0.2, 0.09, 0.1, true);
    stiltS(m, 0.38, 0.04, 0.3, 0.2, 0.09, 0.1, true);
    palmS(m, 0.05, 0.22, 1.4);
    return 0.52;
  }

  const out = { vnCap, seaCap, weCap, vnHamlet, vnHamletB, seaHamlet, seaHamletB };
  for (let t = 0; t < 4; t++) for (let v = 0; v < 2; v++) { out[`vn${t}${v}`] = vn(t, v); out[`sea${t}${v}`] = sea(t, v); out[`we${t}${v}`] = we(t, v); }
  Object.assign(out, {
    vnMarket, seaMarket, weMarket,
    vnPort: (m) => vnPort(m, true), vnWharf: (m) => vnPort(m, false), seaPort: (m) => seaPort(m, true), seaWharf: (m) => seaPort(m, false),
    wePort: (m) => wePort(m, true), weWharf: (m) => wePort(m, false),
    vnTemple, seaTemple, vnShrine, seaShrine, weChurch, vnAcademy, seaAcademy, weAcademy, vnFort, seaFort, weFort, vnYamen, seaYamen, weYamen
  });
  return out;
}

// 地域 → 模型名的前缀（城郭四档 0～3 后跟一位 0、1；都城另一样）
export const SOUTH_KIND = { viet: 'vn', seasia: 'sea', west: 'we' };
// 地域 → 城外诸样（市镇、港、河埠、几样地标与四郊村舍）换成的模型；没列的照原样（西洋据点的寺、祠庙是华人的庙，照中原画）
export const SOUTH_LOCAL = {
  viet: { market: 'vnMarket', port: 'vnPort', wharf: 'vnWharf', temple: 'vnTemple', shrine: 'vnShrine', academy: 'vnAcademy', fort: 'vnFort', yamen: 'vnYamen',
    hamlet: 'vnHamlet', hamletB: 'vnHamletB' },
  seasia: { market: 'seaMarket', port: 'seaPort', wharf: 'seaWharf', temple: 'seaTemple', shrine: 'seaShrine', church: 'weChurch', academy: 'seaAcademy', fort: 'seaFort',
    yamen: 'seaYamen', hamlet: 'seaHamlet', hamletB: 'seaHamletB' },
  west: { market: 'weMarket', port: 'wePort', wharf: 'weWharf', church: 'weChurch', academy: 'weAcademy', fort: 'weFort', yamen: 'weYamen',
    hamlet: 'seaHamlet', hamletB: 'seaHamletB' }
};
