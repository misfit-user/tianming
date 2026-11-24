// 舆图城郭立体模型·东洋诸样（并进 towns3d.js 的 BUILD）：日本、朝鲜的府州治所不画成方城砖墙，照当地的城与町。
// 日本（安土城一五七九年以后，聚落等第给 japan）：城下町——石垣台上的本丸（大城另有二之丸），台边一圈白土塀、南面櫓门，
//   天守一重比一重小、重重腰檐、隔重起千鸟破风、顶上金鯱，台角隅櫓，台下一圈堀；町屋成片不筑外城，寺院、朱红鸟居，都会添五重塔。
//   小藩只是阵屋：矮石垣上两重的三阶櫓。各档两种：白壁（白鹭那样）、黑板（乌城那样）。幕府所在另有一圈大名屋敷。
// 日本（之前，japanOld）：不筑城，国衙一圈筑地塀、朱柱大堂，国分寺七重塔，屋顶多桧皮、草葺；京城是平安京——
//   大内里朱柱青瓦、朱雀大路直通罗城门、东西两寺五重塔。
// 朝鲜（korea）：随山势圆转的石筑邑城，外沿女墙；虹霓门（半圆拱）上丹青楼阁（柱枋朱褐、檐下一道青绿、黛瓦翘角）；
//   城内客舍（正厅高、两翼低）、东轩，方池圆岛、池边楼亭；民居瓦房翘角、草房圆顶。王都另画宫阙：三洞重楼的正门、
//   两重月台上的重檐正殿、回廊、池中楼阁。
// 城外诸样（照当地样子的市镇、港、地标，EAST_LOCAL 按地域给模型名）：
//   日本——町（宿场町，一条大街两排町屋、横町，町外小社与火の見櫓）；湊（土蔵、问屋、常夜灯，弁才船）；寺（白土塀、二重楼门、
//   深檐本堂、朱红五重塔、钟楼）；社（参道、两座鸟居、朱垣里拝殿本殿、社叢）；学（藩校：讲堂、黑漆的圣堂、寮）；砦（堀、石垣台、
//   小天守、隅櫓）；代官所（长屋门、主屋、高札）。安土以前：町屋桧皮草葺，湊无常夜灯，寺塔七重、筑地塀，学是国学（朱柱），
//   城柵（外一圈木栅，栅里国衙、望楼），官署即国衙。
//   朝鲜——场市（白布遮阳棚、酒幕旗、榉树）；浦口（瓦仓、草房，白布帆、草席帆的船）；寺刹（天王门、石台上大雄殿、三层石塔、
//   梵钟阁）；祠堂（三门、红箭门）；书院（石台上两层门楼、讲堂、东西斋、后头祠堂）；镇堡（随势小石城、虹霓门、将台）；官衙（三门、东轩、内衙、红箭门）。
// 四郊村舍（点景近看换上的，每样八十面以内）：日本茅草农家、小土蔵、杉、稻架；朝鲜草房、瓦房、酱缸台。
// k：towns3d.js 递来的器件（颜色、方块、屋顶、民居、街坊……，far() 问此刻搭的是不是远看那份）。各样搭完返回占地半宽。
const YAW = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

export function eastBuilders(k) {
  const { C, box, flat, mound, hipRoof, skirt, gableRoof, house, pavilion, hall, courtyard, tree, pagoda, quarter, pool, flag, palisade, junk, crown, trunk, rng, pick } = k;
  const far = k.far;

  // ======================= 日本 =======================
  const J = {
    stone: [0.66, 0.65, 0.61], stoneTop: [0.58, 0.57, 0.54], plaster: [0.95, 0.94, 0.9], black: [0.23, 0.22, 0.21],
    roof: [0.38, 0.41, 0.46], roofLight: [0.47, 0.5, 0.54], wood: [0.46, 0.36, 0.28], woodDark: [0.34, 0.27, 0.22],
    verm: [0.84, 0.33, 0.2], bark: [0.5, 0.39, 0.3], tsuiji: [0.9, 0.83, 0.66], green: [0.42, 0.6, 0.49], street: [0.84, 0.81, 0.72],
    gravel: [0.84, 0.83, 0.77], townRoof: [0.5, 0.53, 0.58], townRoof2: [0.44, 0.47, 0.52], bronze: [0.36, 0.42, 0.36]
  };
  // 一圈土塀：矩形（心 cx,cz，外沿半宽 a×b）的边上，墙脚在 y、高 h、厚 t，瓦顶；南面正中留 gw 宽的门口
  function wallRect(m, cx, y, cz, a, b, h, t, gw, wall, cap = J.roof) {
    const seg = (x0, z0, x1, z1) => box(m, x0, y - 0.25, z0, x1, y + h, z1, wall, { top: cap });
    seg(cx - a, cz - b, cx + a, cz - b + t);
    seg(cx - a, cz - b + t, cx - a + t, cz + b - t);
    seg(cx + a - t, cz - b + t, cx + a, cz + b - t);
    if (gw > 0) { seg(cx - a, cz + b - t, cx - gw / 2, cz + b); seg(cx + gw / 2, cz + b - t, cx + a, cz + b); }
    else seg(cx - a, cz + b - t, cx + a, cz + b);
  }
  // 一圈水：矩形（半宽 a×b）外 w 宽
  function moatRing(m, cx, cz, a, b, w) {
    flat(m, cx - a - w, cz - b - w, cx + a + w, cz - b, 0.012, C.water);
    flat(m, cx - a - w, cz + b, cx + a + w, cz + b + w, 0.012, C.water);
    flat(m, cx - a - w, cz - b, cx - a, cz + b, 0.012, C.water);
    flat(m, cx + a, cz - b, cx + a + w, cz + b, 0.012, C.water);
  }
  // 千鸟破风：腰檐上朝南（sz=1）或朝北（-1）起一个小山墙三角，两片小坡顶盖着
  function chidori(m, x, y, zf, w, h, sz, wall) {
    const d = 0.08 * sz, e = 0.012 * sz;
    m.tri([x - w, y, zf], [x + w, y, zf], [x, y + h, zf], wall);
    m.quad([x - w * 1.15, y - 0.006, zf + e], [x, y + h + 0.012, zf + e], [x, y + h + 0.012, zf - d], [x - w * 1.15, y - 0.006, zf - d], J.roof);
    m.quad([x, y + h + 0.012, zf + e], [x + w * 1.15, y - 0.006, zf + e], [x + w * 1.15, y - 0.006, zf - d], [x, y + h + 0.012, zf - d], J.roof);
  }
  // 一排黑窗（南北两面）
  function windows(m, x, y, z, a, b, h, s) {
    if (far()) return;
    for (const sz of [1, -1]) {
      const zf = z + sz * (b + 0.003), n = Math.max(2, Math.round(a / 0.06));
      for (let i = 0; i < n; i++) {
        const px = x - a + (2 * a) * (i + 0.5) / n;
        m.quad([px - 0.011 * s, y + h * 0.42, zf], [px + 0.011 * s, y + h * 0.42, zf], [px + 0.011 * s, y + h * 0.7, zf], [px - 0.011 * s, y + h * 0.7, zf], C.hole);
      }
    }
  }
  // 天守：y0（本丸台面）起天守台石垣，上 n 重，一重比一重小；重与重之间一圈腰檐，隔重南北各起一个千鸟破风；
  // 顶重歇山大顶带脊，脊两头一对金鯱。wall 白壁或黑板
  function tenshu(m, x, y0, z, n, a, b, wall) {
    const s = a / 0.26, baseH = 0.09 * s;
    mound(m, x, z, a + 0.09 * s, b + 0.09 * s, a + 0.035 * s, b + 0.035 * s, y0 - 0.3, y0 + baseH, J.stone, J.stoneTop);
    let y = y0 + baseH, aa = a, bb = b;
    for (let i = 0; i < n; i++) {
      const h = (i === 0 ? 0.12 : 0.092) * s, top = i === n - 1, o = 0.05 * s;
      box(m, x - aa, y, z - bb, x + aa, y + h, z + bb, wall, { faces: 'nsew' });
      windows(m, x, y, z, aa, bb, h, s);
      y += h;
      if (top) {
        const rh = Math.max(aa, bb) * 0.6;
        hipRoof(m, x, y, z, aa + o, bb + o, rh, J.roof, { lift: 0.016 * s, ridge: J.roof, bands: 3 });
        if (!far()) {                           // 金鯱：脊两头各一块
          const r = Math.abs((aa + o) - (bb + o)), along = aa >= bb;
          for (const sx of [-1, 1]) {
            const px = along ? x + sx * (r + 0.012 * s) : x, pz = along ? z : z + sx * (r + 0.012 * s);
            box(m, px - 0.011 * s, y + rh, pz - 0.011 * s, px + 0.011 * s, y + rh + 0.05 * s, pz + 0.011 * s, C.gold);
          }
        }
      } else {
        const na = aa * 0.8, nb = bb * 0.8;
        skirt(m, x, y - 0.004, z, aa + o, bb + o, na, nb, 0.045 * s, J.roof, 0.012 * s);
        if (i % 2 === 0 && !far()) for (const sz of [1, -1]) chidori(m, x, y + 0.006, z + sz * (bb + o * 0.45), na * 0.5, 0.06 * s, sz, wall);
        aa = na; bb = nb;
      }
    }
  }
  // 隅櫓：台角上两重的小櫓
  function yagura(m, x, y0, z, s, wall) {
    let y = y0, a = s, b = s * 0.85;
    const h = 0.075 * (s / 0.12);
    box(m, x - a, y, z - b, x + a, y + h, z + b, wall, { faces: 'nsew' });
    y += h;
    skirt(m, x, y - 0.003, z, a + 0.035, b + 0.035, a * 0.74, b * 0.74, 0.03, J.roof, 0.006);
    a *= 0.74; b *= 0.74;
    box(m, x - a, y, z - b, x + a, y + h * 0.8, z + b, wall, { faces: 'nsew' });
    y += h * 0.8;
    hipRoof(m, x, y, z, a + 0.032, b + 0.032, Math.max(a, b) * 0.7, J.roof, { lift: 0.01, ridge: J.roof, bands: 2 });
  }
  // 櫓门：土塀缺口上一座横长的门楼（门洞黑），黛瓦歇山
  function yaguraMon(m, x, y0, z, w, wall) {
    box(m, x - w / 2, y0 - 0.25, z - 0.05, x + w / 2, y0 + 0.1, z + 0.05, wall);
    m.quad([x - w * 0.2, y0, z + 0.053], [x + w * 0.2, y0, z + 0.053], [x + w * 0.2, y0 + 0.06, z + 0.053], [x - w * 0.2, y0 + 0.06, z + 0.053], C.hole);
    hipRoof(m, x, y0 + 0.1, z, w / 2 + 0.04, 0.09, 0.07, J.roof, { lift: 0.01, ridge: J.roof, bands: 2 });
  }
  // 御殿：台面（y）上几座低平的大屋连成一片，旁边几株松；s 占地的尺度
  function goten(m, x, y, z, s, r) {
    m.push(0, y, 0);
    house(m, x, z, 0.7 * s, 0.3 * s, 0.08, J.plaster, J.roof);
    house(m, x + 0.22 * s, z + 0.24 * s, 0.4 * s, 0.22 * s, 0.07, J.plaster, J.roofLight, true);
    house(m, x - 0.26 * s, z + 0.22 * s, 0.36 * s, 0.2 * s, 0.07, J.plaster, J.roof);
    for (let i = 0; i < 3; i++) tree(m, x + (r() - 0.5) * s, z - 0.25 * s - r() * 0.1 * s, 1.0 + r() * 0.4, C.leafDark);
    m.pop();
  }
  // 鸟居：两根朱柱，上压一道两头出挑的黑笠木，下一道贯
  function torii(m, x, z, s = 1) {
    const w = 0.11 * s, h = 0.2 * s, p = 0.012 * s;
    for (const sx of [-1, 1]) box(m, x + sx * w - p, -0.2, z - p, x + sx * w + p, h, z + p, J.verm, { faces: 'nsew' });
    box(m, x - w * 1.5, h, z - p * 1.4, x + w * 1.5, h + 0.022 * s, z + p * 1.4, J.black);
    box(m, x - w * 1.25, h - 0.045 * s, z - p * 0.8, x + w * 1.25, h - 0.03 * s, z + p * 0.8, J.verm);
  }
  // 神社：朱红的小殿（桧皮顶），门前一座鸟居
  function jinja(m, x, z, s) {
    hall(m, x, z - 0.06 * s, 0.13 * s, 0.09 * s, 0.075, J.bark, { body: J.verm, lift: 0.02 });
    torii(m, x, z + 0.2 * s, 1.5 * s);
    tree(m, x - 0.22 * s, z - 0.1 * s, 1.2, C.leafDark); tree(m, x + 0.22 * s, z - 0.12 * s, 1.1, C.leafDark);
  }
  // 寺：一圈白土塀，正中一座深檐大殿（黑木柱身、黛瓦大顶）；levels>0 殿旁一座朱红的塔
  function tera(m, x, z, s, levels = 0) {
    wallRect(m, x, 0, z, 0.42 * s, 0.38 * s, 0.07, 0.03, 0.15 * s, J.plaster);
    hall(m, x - (levels ? 0.08 * s : 0), z + 0.02 * s, 0.22 * s, 0.15 * s, 0.1, J.roof, { body: J.woodDark, lift: 0.025 });
    if (levels) pagoda(m, x + 0.26 * s, z - 0.2 * s, levels, 0.15 * s, J.verm, J.roof);
  }
  // 町屋：深进、临街一面，黑木格子与白壁，黛瓦
  const JP_LOOK = { walls: [J.plaster, J.plaster, J.wood, C.plaster2], roofs: [J.townRoof, J.townRoof2, J.townRoof, J.roofLight] };
  const JO_LOOK = { walls: [J.plaster, J.wood, C.earthHouse], roofs: [J.bark, J.bark, C.thatch, J.roof] };

  // 城下町。o：hw 町的半宽；cz 本丸心的南北位；hon [半宽, 半深, 石垣高]、ni 二之丸（同，或无）、moat 堀宽；
  // ten [重数, 半宽, 半深]；yHon 本丸隅櫓几座（0/2/4）、yNi 二之丸几座；black 黑板天守；density 町屋疏密；
  // tera [x, z, s, 塔级]；jinja [x, z, s]；yashiki 大名屋敷几处（幕府所在）
  function castleTown(m, r, o) {
    const { hw, cz } = o, wall = o.black ? J.black : J.plaster, low = o.black ? J.woodDark : J.plaster;
    const [ha, hb, hh] = o.hon, ni = o.ni;
    const A = ni ? ni[0] : ha, B = ni ? ni[1] : hb, mw = o.moat;
    // 堀、南面一道土桥
    moatRing(m, 0, cz, A + 0.08, B + 0.08, mw);
    flat(m, -0.07, cz + B + 0.08, 0.07, cz + B + 0.08 + mw, 0.024, C.earth);
    let base = 0;
    if (ni) {
      mound(m, 0, cz, A + 0.08, B + 0.08, A, B, -0.4, ni[2], J.stone, J.gravel);
      wallRect(m, 0, ni[2], cz, A, B, 0.05, 0.025, 0.2, low);
      yaguraMon(m, 0, ni[2], cz + B - 0.0125, 0.24, wall);
      if (o.yNi) for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]].slice(0, o.yNi)) yagura(m, sx * (A - 0.08), ni[2], cz + sz * (B - 0.08), 0.09, wall);
      base = ni[2];
    }
    const hz = ni ? cz - (B - hb) * 0.45 : cz, top = base + hh;
    mound(m, 0, hz, ha + 0.07, hb + 0.07, ha, hb, ni ? base - 0.1 : -0.4, top, J.stone, J.gravel);
    wallRect(m, 0, top, hz, ha, hb, 0.05, 0.025, 0.18, low);
    yaguraMon(m, 0, top, hz + hb - 0.0125, 0.2, wall);
    if (o.yHon) for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]].slice(0, o.yHon)) yagura(m, sx * (ha - 0.07), top, hz + sz * (hb - 0.07), 0.08, wall);
    const [tn, ta, tb] = o.ten, ea = ta * 1.35, eb = tb * 1.35;     // 天守连天守台的外沿
    const tx = (o.black ? 1 : -1) * Math.max(0, ha - 0.05 - ea) * 0.7, tz = hz - Math.max(0, hb - 0.05 - eb) * 0.7;
    tenshu(m, tx, top, tz, tn, ta, tb, wall);
    // 御殿：本丸、二之丸台面上几座低平的大屋，几株松
    goten(m, -tx * 0.9, top, hz + hb * 0.12, Math.min(ha, hb) * 1.3, r);
    if (ni) for (const sx of [-1, 1]) goten(m, sx * (A * 0.62), ni[2], cz + B * 0.35, Math.min(A, B) * 0.55, r);
    // 町：南北大街出櫓门直下，东西一两道横街；寺、神社、屋敷先占地，余下町屋
    const keep = [[-A - mw - 0.18, cz - B - mw - 0.18, A + mw + 0.18, cz + B + mw + 0.18]];
    const south = cz + B + 0.08 + mw;
    flat(m, -0.08, south, 0.08, hw, 0.026, J.street);
    keep.push([-0.1, south, 0.1, hw]);
    for (const zz of o.streets || []) {
      flat(m, -hw, zz - 0.07, hw, zz + 0.07, 0.026, J.street);
      keep.push([-hw, zz - 0.09, hw, zz + 0.09]);
    }
    if (o.tera) { const [x, z, s, lv] = o.tera; tera(m, x, z, s, lv); keep.push([x - 0.46 * s, z - 0.42 * s, x + 0.46 * s, z + 0.42 * s]); }
    if (o.jinja) { const [x, z, s] = o.jinja; jinja(m, x, z, s); keep.push([x - 0.3 * s, z - 0.25 * s, x + 0.3 * s, z + 0.32 * s]); }
    for (const [x, z, s] of o.yashiki || []) {
      wallRect(m, x, 0, z, 0.32 * s, 0.26 * s, 0.06, 0.025, 0.12 * s, J.plaster);
      house(m, x, z - 0.04 * s, 0.4 * s, 0.22 * s, 0.11, J.wood, J.roof);
      keep.push([x - 0.36 * s, z - 0.3 * s, x + 0.36 * s, z + 0.3 * s]);
    }
    quarter(m, r, -hw + 0.04, -hw + 0.04, hw - 0.04, hw - 0.04, o.density, keep, false, JP_LOOK);
  }
  // 各档：阵屋、府城、大府、都会，各白、黑两种（v）；幕府所在另一样
  function jp(tier, v) {
    return (m) => {
      const r = rng(1101 + tier * 10 + v), black = v === 1;
      if (tier === 0) {
        castleTown(m, r, { hw: 1.45, cz: -0.42, hon: [0.42, 0.34, 0.08], moat: 0.1, ten: [2, 0.18, 0.15], black, density: 0.78,
          streets: [0.55], jinja: [v ? -0.85 : 0.85, 0.75, 0.75] });
        return 1.45;
      }
      if (tier === 1) {
        castleTown(m, r, { hw: 1.95, cz: -0.5, hon: [0.56, 0.48, 0.16], moat: 0.16, ten: [3, 0.25, 0.2], yHon: 2, black, density: 0.85,
          streets: [0.62], tera: [v ? -1.15 : 1.15, 1.2, 0.8, 0], jinja: [v ? 1.2 : -1.2, 1.15, 0.85] });
        return 1.95;
      }
      if (tier === 2) {
        castleTown(m, r, { hw: 2.45, cz: -0.62, ni: [0.98, 0.82, 0.1], hon: [0.6, 0.5, 0.14], moat: 0.2, ten: [4, 0.33, 0.27], yHon: 4, yNi: 2, black,
          density: 0.88, streets: [0.78, 1.7], tera: [v ? -1.5 : 1.5, 1.25, 0.95, 0], jinja: [v ? 1.55 : -1.55, 1.25, 0.9] });
        return 2.45;
      }
      castleTown(m, r, { hw: 3.0, cz: -0.78, ni: [1.25, 1.02, 0.11], hon: [0.72, 0.6, 0.16], moat: 0.26, ten: [5, 0.39, 0.32], yHon: 4, yNi: 4, black,
        density: 0.92, streets: [0.9, 2.05], tera: [v ? -1.9 : 1.9, 1.5, 1.1, 5], jinja: [v ? 1.95 : -1.95, 1.5, 1.0] });
      return 3.0;
    };
  }
  // 幕府所在：都会那样的大城，堀外一圈大名屋敷，町更大
  function jpCap(m) {
    const r = rng(1191);
    const yashiki = [];
    for (const x of [-2.2, -1.25, 1.25, 2.2]) yashiki.push([x, -1.95, 1.05]);
    for (const x of [-2.55, 2.55]) yashiki.push([x, -0.85, 1.05]);
    castleTown(m, r, { hw: 3.75, cz: -0.95, ni: [1.45, 1.18, 0.12], hon: [0.84, 0.68, 0.18], moat: 0.3, ten: [5, 0.44, 0.36], yHon: 4, yNi: 4,
      density: 0.93, streets: [1.0, 2.4], tera: [2.35, 1.75, 1.2, 5], jinja: [-2.35, 1.75, 1.1], yashiki });
    return 3.75;
  }

  // ---------- 日本（安土以前）：国衙、国分寺、平安京 ----------
  // 国衙：一圈筑地塀（土黄墙、黛瓦顶），朱柱正殿、两厢
  function kokuga(m, x, z, s) {
    wallRect(m, x, 0, z, 0.46 * s, 0.38 * s, 0.08, 0.035, 0.16 * s, J.tsuiji);
    hall(m, x, z - 0.06 * s, 0.22 * s, 0.13 * s, 0.1, J.roof, { body: J.verm, lift: 0.02 });
    for (const sx of [-1, 1]) house(m, x + sx * 0.3 * s, z + 0.08 * s, 0.32 * s, 0.13 * s, 0.08, J.verm, J.bark, true);
  }
  // o：hw；kokuga [x, z, s]；tera [x, z, s, 塔级]；jinja；streets 横街；density
  function oldTown(m, r, o) {
    const { hw } = o, keep = [];
    flat(m, -0.09, -hw, 0.09, hw, 0.026, J.street);
    keep.push([-0.11, -hw, 0.11, hw]);
    for (const zz of o.streets || []) { flat(m, -hw, zz - 0.07, hw, zz + 0.07, 0.026, J.street); keep.push([-hw, zz - 0.09, hw, zz + 0.09]); }
    { const [x, z, s] = o.kokuga; kokuga(m, x, z, s); keep.push([x - 0.5 * s, z - 0.42 * s, x + 0.5 * s, z + 0.42 * s]); }
    if (o.tera) { const [x, z, s, lv] = o.tera; tera(m, x, z, s, lv); keep.push([x - 0.46 * s, z - 0.42 * s, x + 0.46 * s, z + 0.42 * s]); }
    if (o.jinja) { const [x, z, s] = o.jinja; jinja(m, x, z, s); keep.push([x - 0.3 * s, z - 0.25 * s, x + 0.3 * s, z + 0.32 * s]); }
    quarter(m, r, -hw + 0.04, -hw + 0.04, hw - 0.04, hw - 0.04, o.density, keep, false, JO_LOOK);
  }
  function jo(tier, v) {
    return (m) => {
      const r = rng(1201 + tier * 10 + v), sx = v ? -1 : 1;
      const hw = [1.45, 1.95, 2.45, 3.0][tier];
      oldTown(m, r, {
        hw, density: [0.62, 0.72, 0.8, 0.86][tier], streets: tier ? [hw * 0.35] : [],
        kokuga: [0, -hw * 0.45, [0.85, 1, 1.15, 1.3][tier]],
        tera: tier ? [sx * hw * 0.55, hw * 0.45, [0, 0.85, 1.0, 1.15][tier], [0, 5, 7, 7][tier]] : null,
        jinja: [-sx * hw * 0.55, hw * 0.5, 0.8]
      });
      return hw;
    };
  }
  // 平安京：朱雀大路直通北头大内里（筑地塀围着，朱雀门重楼，大极殿朱柱青瓦坐在台上，两厢朝堂），南头罗城门；东西两寺五重塔；条坊成片
  function joCap(m) {
    const r = rng(1291), hw = 3.75, keep = [], pz = -2.4;
    flat(m, -0.16, pz + 1.16, 0.16, hw, 0.026, J.street);
    keep.push([-0.2, pz + 1.1, 0.2, hw]);
    for (const zz of [-0.2, 1.0, 2.2]) { flat(m, -hw, zz - 0.06, hw, zz + 0.06, 0.026, J.street); keep.push([-hw, zz - 0.08, hw, zz + 0.08]); }
    wallRect(m, 0, 0, pz, 1.25, 1.1, 0.1, 0.04, 0.3, J.tsuiji);
    flat(m, -1.21, pz - 1.06, 1.21, pz + 1.06, 0.022, C.pave);
    box(m, -0.3, -0.3, pz + 1.04, 0.3, 0.1, pz + 1.16, J.verm, { top: J.verm });
    pavilion(m, 0, 0.1, pz + 1.1, 0.26, 0.07, 0.1, 2, J.green, { body: J.verm, lift: 0.03, ridge: J.roof });
    mound(m, 0, pz - 0.15, 0.5, 0.32, 0.44, 0.27, -0.3, 0.08, C.marble);
    hall(m, 0, pz - 0.15, 0.36, 0.18, 0.14, J.green, { base: C.marble, body: J.verm, tiers: 1, lift: 0.04, y: 0.08 });
    for (const sx of [-1, 1]) for (const z of [pz + 0.35, pz + 0.7]) house(m, sx * 0.62, z, 0.46, 0.16, 0.09, J.verm, J.green, true);
    keep.push([-1.3, pz - 1.15, 1.3, pz + 1.2]);
    // 罗城门：南头大路口一座重楼门
    box(m, -0.34, -0.3, hw - 0.42, 0.34, 0.1, hw - 0.28, J.verm, { top: J.verm });
    pavilion(m, 0, 0.1, hw - 0.35, 0.3, 0.08, 0.1, 2, J.roof, { body: J.verm, lift: 0.03 });
    keep.push([-0.4, hw - 0.5, 0.4, hw]);
    for (const sx of [-1, 1]) { tera(m, sx * 1.75, 2.85, 1.0, 5); keep.push([sx * 1.75 - 0.46, 2.43, sx * 1.75 + 0.46, 3.27]); }
    quarter(m, r, -hw + 0.04, -hw + 0.04, hw - 0.04, hw - 0.04, 0.86, keep, false, JO_LOOK);
    return hw;
  }

  // ======================= 朝鲜 =======================
  const K = {
    stone: [0.77, 0.76, 0.72], stoneTop: [0.7, 0.69, 0.66], roof: [0.32, 0.33, 0.35], roofDark: [0.26, 0.27, 0.29],
    pillar: [0.62, 0.27, 0.2], green: [0.32, 0.56, 0.46], wall: [0.94, 0.91, 0.84], earth: [0.8, 0.69, 0.53], thatch: [0.69, 0.61, 0.45],
    ground: [0.8, 0.76, 0.66], street: [0.86, 0.83, 0.75], jar: [0.36, 0.26, 0.2]
  };
  // 圆转的城圈：超椭圆 |x/a|^p + |z/b|^p = 1 上取 n 点（p 越大越方）
  function loopPts(a, b, p, n, wob = 0, r = null) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / n * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), f = 1 + (r ? (r() - 0.5) * wob : 0);
      pts.push([a * f * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), b * f * Math.sign(s) * Math.pow(Math.abs(s), 2 / p)]);
    }
    return pts;
  }
  // 一圈石城：沿闭合折线，墙高 h、厚 t，外沿一排女墙（间距 crenel）
  function wallLoop(m, pts, h, t, crenel) {
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length], dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, out = Math.sign((-dz / len) * mx + (dx / len) * mz) || 1;
      m.push(mx, 0, mz, Math.atan2(-dz, dx));
      box(m, -len / 2 - t * 0.35, -1, -t / 2, len / 2 + t * 0.35, h, t / 2, K.stone, { top: K.stoneTop });
      if (crenel > 0 && !far()) {
        const mh = Math.max(0.04, h * 0.14), md = Math.min(0.05, t * 0.3), n = Math.max(1, Math.round(len / crenel));
        for (let j = 0; j < n; j++) {
          const cx = -len / 2 + len * (j + 0.5) / n, w = (len / n) * 0.55;
          box(m, cx - w / 2, h, out * (t / 2 - md), cx + w / 2, h + mh, out * t / 2, K.stone, { top: K.stoneTop, faces: 'nsewt' });
        }
      }
      m.pop();
    }
  }
  // 城圈里铺一层地（扇形）
  function loopGround(m, pts, y, col) {
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
      m.tri([0, y, 0], [x0 * 0.98, y, z0 * 0.98], [x1 * 0.98, y, z1 * 0.98], col);
    }
  }
  // 半圆拱的门洞
  function roundArch(m, x, y0, z, w, h) {
    const r = w / 2, ys = y0 + h - r;
    m.quad([x - r, y0, z], [x + r, y0, z], [x + r, ys, z], [x - r, ys, z], C.hole);
    for (let i = 0; i < 6; i++) {
      const a0 = Math.PI * i / 6, a1 = Math.PI * (i + 1) / 6;
      m.tri([x, ys, z], [x + Math.cos(a0) * r, ys + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, ys + Math.sin(a1) * r, z], C.hole);
    }
  }
  // 丹青楼阁：朱褐柱身、檐下一道青绿，黛瓦歇山翘角
  function kPavilion(m, x, y, z, a, b, bh, tiers) {
    pavilion(m, x, y, z, a, b, bh, tiers, K.roof, { body: K.pillar, lift: 0.045, ridge: K.roofDark });
    if (!far()) box(m, x - a - 0.004, y + bh * 0.76, z - b - 0.004, x + a + 0.004, y + bh, z + b + 0.004, K.green, { faces: 'nsew' });
  }
  // 虹霓门：石砌门台（高出城墙一截、伸出墙外），半圆拱门洞，台上一座丹青楼阁（tiers 重檐）
  function kGate(m, zf, h, t, gw, tiers) {
    const out = 0.07, y1 = h + 0.04;
    box(m, -gw / 2, -1, zf - t - out, gw / 2, y1, zf + out, K.stone, { top: K.stoneTop });
    roundArch(m, 0, 0, zf + out + 0.004, gw * 0.3, h * 0.66);
    if (tiers > 0) kPavilion(m, 0, y1, zf - t / 2, gw * 0.38, Math.max(0.1, (t + out * 2) * 0.42), Math.max(0.11, gw * 0.22), tiers);
  }
  // 瓦房：歇山翘角，白墙；草房：土墙、圆鼓鼓的草顶（两截收顶）
  function kHouse(m, x, z, w, d, wh, rot) {
    m.push(x, 0, z, rot ? Math.PI / 2 : 0);
    box(m, -w / 2, -0.5, -d / 2, w / 2, wh, d / 2, K.wall, { faces: 'nsew' });
    hipRoof(m, 0, wh, 0, w / 2 + 0.035, d / 2 + 0.045, d * 0.48, K.roof, { lift: 0.022, bands: 2 });
    m.pop();
  }
  function choga(m, x, z, w, d, wh, rot) {
    m.push(x, 0, z, rot ? Math.PI / 2 : 0);
    const a = w / 2 + 0.03, b = d / 2 + 0.035, y = wh * 0.85, h = d * 0.52;
    box(m, -w / 2, -0.5, -d / 2, w / 2, y, d / 2, K.earth, { faces: 'nsew' });
    mound(m, 0, 0, a, b, a * 0.72, b * 0.62, y, y + h * 0.72, K.thatch);
    mound(m, 0, 0, a * 0.72, b * 0.62, a * 0.3, b * 0.18, y + h * 0.72, y + h, K.thatch);
    m.pop();
  }
  const KO_LOOK = { build: (m, cx, cz, w, d, wh, wall, roof, side, r) => (r() < 0.45 ? choga(m, cx, cz, w * 0.88, d * 0.9, wh, side) : kHouse(m, cx, cz, w, d, wh, side)) };
  // 官衙一座：台基、朱褐柱身、青绿额枋、黛瓦翘角
  function kHall(m, x, y, z, a, b, bh) {
    box(m, x - a, y, z - b, x + a, y + bh, z + b, K.pillar, { faces: 'nsew' });
    if (!far()) box(m, x - a - 0.004, y + bh * 0.74, z - b - 0.004, x + a + 0.004, y + bh, z + b + 0.004, K.green, { faces: 'nsew' });
    hipRoof(m, x, y + bh, z, a + 0.05, b + 0.05, Math.max(a, b) * 0.5, K.roof, { lift: 0.035, ridge: K.roofDark });
  }
  // 客舍：一圈院墙，正厅高、东西两翼低（三段屋脊高低错落）
  function gaeksa(m, x, z, s) {
    courtyard(m, x, z, 0.5 * s, 0.34 * s, 0.08, 0.035, K.wall, K.roof, 0.15 * s);
    box(m, x - 0.44 * s, -0.4, z - 0.17 * s, x + 0.44 * s, 0.04, z + 0.05 * s, K.stoneTop);
    kHall(m, x, 0.04, z - 0.06 * s, 0.11 * s, 0.09 * s, 0.13 * s);
    for (const sx of [-1, 1]) kHall(m, x + sx * 0.27 * s, 0.04, z - 0.06 * s, 0.15 * s, 0.075 * s, 0.085 * s);
  }
  // 东轩：院墙里一座官衙、门屋
  function dongheon(m, x, z, s) {
    courtyard(m, x, z, 0.36 * s, 0.3 * s, 0.08, 0.035, K.wall, K.roof, 0.14 * s);
    kHall(m, x, 0.02, z - 0.05 * s, 0.2 * s, 0.1 * s, 0.1 * s);
    kHouse(m, x, z + 0.2 * s, 0.18 * s, 0.09 * s, 0.07, false);
  }
  // 方池圆岛，池边一座楼亭（石柱架起、四面敞开）
  function pond(m, x, z, s) {
    flat(m, x - 0.36 * s, z - 0.26 * s, x + 0.2 * s, z + 0.26 * s, 0.014, C.water);
    pool(m, x - 0.08 * s, z, 0.08 * s, 0.08 * s, 0.02, K.ground, 0, Math.PI * 2, 10);
    tree(m, x - 0.08 * s, z, 0.9);
    const px = x + 0.31 * s, a = 0.11 * s, y = 0.07 * s;
    if (!far()) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(m, px + sx * a * 0.78 - 0.012, -0.2, z + sz * a * 0.78 - 0.012, px + sx * a * 0.78 + 0.012, y + 0.08, z + sz * a * 0.78 + 0.012, K.pillar, { faces: 'nsew' });
    box(m, px - a * 0.9, y, z - a * 0.9, px + a * 0.9, y + 0.018, z + a * 0.9, K.stoneTop);
    hipRoof(m, px, y + 0.08, z, a + 0.05, a + 0.05, a * 0.75, K.roof, { lift: 0.04, ridge: K.roofDark });
  }
  // 邑城。o：hw；a、b 城圈半径（东西、南北），p 圆转程度，wob 随势的起伏，h 墙高、t 墙厚、crenel 女墙间距；
  // gates 开门的面、tiers 各门楼几重；gaeksa、dongheon、pond [x, z, s]；density 民居疏密；palace 王都宫阙 [z, s]
  function koTown(m, r, o) {
    const { a, b, h, t } = o, pts = loopPts(a, b, o.p, o.n || 28, o.wob || 0, r);
    loopGround(m, pts, 0.018, K.ground);
    wallLoop(m, pts, h, t, o.crenel || 0);
    const gw = o.gateW || Math.max(0.4, Math.min(a, b) * 0.22);
    for (const g of o.gates) {
      m.push(0, 0, 0, YAW[g]);
      const R = g === 's' || g === 'n' ? b : a;
      kGate(m, R, h, t, gw, (o.tiers && o.tiers[g]) || 0);
      m.pop();
    }
    const keep = [];
    flat(m, -0.09, -b * 0.2, 0.09, b - t, 0.026, K.street);
    keep.push([-0.11, -b * 0.25, 0.11, b]);
    if (o.gates.includes('e') || o.gates.includes('w')) { flat(m, -a + t, -0.08, a - t, 0.08, 0.026, K.street); keep.push([-a, -0.1, a, 0.1]); }
    if (o.gaeksa) { const [x, z, s] = o.gaeksa; gaeksa(m, x, z, s); keep.push([x - 0.54 * s, z - 0.38 * s, x + 0.54 * s, z + 0.38 * s]); }
    if (o.dongheon) { const [x, z, s] = o.dongheon; dongheon(m, x, z, s); keep.push([x - 0.4 * s, z - 0.34 * s, x + 0.4 * s, z + 0.34 * s]); }
    if (o.pond) { const [x, z, s] = o.pond; pond(m, x, z, s); keep.push([x - 0.4 * s, z - 0.3 * s, x + 0.45 * s, z + 0.3 * s]); }
    if (o.palace) { const [z, s] = o.palace; gungwol(m, 0, z, s); keep.push([-1.3 * s, z - 1.05 * s, 1.3 * s, z + 1.12 * s]); }
    // 城圈里按十字分三片铺民居（超椭圆的四角在城外，不铺）
    for (const [x0, z0, x1, z1] of [[-a * 0.8, -b * 0.55, a * 0.8, b * 0.55], [-a * 0.55, -b * 0.82, a * 0.55, -b * 0.55], [-a * 0.55, b * 0.55, a * 0.55, b * 0.82]]) {
      quarter(m, r, x0, z0, x1, z1, o.density, keep, false, KO_LOOK);
    }
  }
  // 宫阙：宫墙一圈，正门三洞重楼；正殿坐两重月台、重檐；殿后便殿，两侧回廊；西北一方大池，池中重檐楼阁
  function gungwol(m, cx, cz, s) {
    courtyard(m, cx, cz, 1.25 * s, 1.0 * s, 0.13, 0.05, K.wall, K.roofDark, 0.34 * s);
    flat(m, cx - 1.2 * s, cz - 0.95 * s, cx + 1.2 * s, cz + 0.95 * s, 0.022, C.pave);
    box(m, cx - 0.36 * s, -0.4, cz + 1.0 * s - 0.1, cx + 0.36 * s, 0.17, cz + 1.0 * s + 0.06, K.stone, { top: K.stoneTop });
    for (const dx of [-0.2, 0, 0.2]) roundArch(m, cx + dx * s, 0, cz + 1.0 * s + 0.064, 0.09 * s, 0.13);
    kPavilion(m, cx, 0.17, cz + 1.0 * s - 0.02, 0.28 * s, 0.08 * s, 0.1, 2);
    mound(m, cx, cz - 0.05 * s, 0.5 * s, 0.36 * s, 0.44 * s, 0.3 * s, -0.4, 0.05, K.stoneTop);
    mound(m, cx, cz - 0.08 * s, 0.4 * s, 0.27 * s, 0.35 * s, 0.22 * s, 0.05, 0.1, K.stoneTop);
    kPavilion(m, cx, 0.1, cz - 0.08 * s, 0.27 * s, 0.15 * s, 0.13, 2);
    kHall(m, cx, 0.02, cz - 0.62 * s, 0.24 * s, 0.1 * s, 0.1);
    for (const sx of [-1, 1]) box(m, cx + sx * 0.62 * s - 0.05, -0.3, cz - 0.4 * s, cx + sx * 0.62 * s + 0.05, 0.08, cz + 0.6 * s, K.pillar, { faces: 'nsew' });
    for (const sx of [-1, 1]) hipRoof(m, cx + sx * 0.62 * s, 0.08, cz + 0.1 * s, 0.1, 0.52 * s, 0.06, K.roof, { lift: 0.02 });
    const px = cx - 0.85 * s, pz = cz - 0.55 * s;
    flat(m, px - 0.3 * s, pz - 0.3 * s, px + 0.3 * s, pz + 0.3 * s, 0.026, C.water);
    box(m, px - 0.16 * s, -0.3, pz - 0.12 * s, px + 0.16 * s, 0.09, pz + 0.12 * s, K.stoneTop);
    kPavilion(m, px, 0.09, pz, 0.14 * s, 0.1 * s, 0.07, 2);
  }
  function ko(tier, v) {
    return (m) => {
      const r = rng(1301 + tier * 10 + v);
      if (tier === 0) {
        koTown(m, r, { a: 1.3, b: 1.15, p: 2.3, wob: 0.06, h: 0.24, t: 0.13, crenel: 0.2, gates: v ? ['s', 'e'] : ['s', 'w'], tiers: { s: 1 }, density: 0.74,
          dongheon: [v ? -0.4 : 0.4, -0.45, 0.85] });
        return 1.3;
      }
      if (tier === 1) {
        koTown(m, r, { a: 1.85, b: 1.65, p: 2.4, wob: 0.06, h: 0.32, t: 0.16, crenel: 0.2, gates: ['s', 'e', 'w'], tiers: { s: 1, e: 1, w: 1 }, density: 0.84,
          gaeksa: [v ? 0.5 : -0.5, -0.75, 0.95], dongheon: [v ? -0.75 : 0.75, -0.5, 0.85] });
        return 1.85;
      }
      if (tier === 2) {
        koTown(m, r, { a: 2.35, b: 2.1, p: 2.5, wob: 0.07, h: 0.38, t: 0.18, crenel: 0.2, gates: ['s', 'n', 'e', 'w'], tiers: { s: 2, n: 1, e: 1, w: 1 }, density: 0.88,
          gaeksa: [v ? 0.6 : -0.6, -0.95, 1.1], dongheon: [v ? -0.95 : 0.95, -0.7, 0.95], pond: [v ? -1.05 : 1.05, 0.95, 0.9] });
        return 2.35;
      }
      koTown(m, r, { a: 2.9, b: 2.6, p: 2.6, wob: 0.07, h: 0.44, t: 0.2, crenel: 0.21, gates: ['s', 'n', 'e', 'w'], tiers: { s: 2, n: 2, e: 2, w: 2 }, density: 0.91,
        gaeksa: [v ? 0.75 : -0.75, -1.2, 1.25], dongheon: [v ? -1.15 : 1.15, -0.9, 1.05], pond: [v ? -1.25 : 1.25, 1.2, 1.1] });
      return 2.9;
    };
  }
  // 王都：大城圈随山势起伏，四门重楼；城中偏北宫阙
  function koCap(m) {
    const r = rng(1391);
    koTown(m, r, { a: 3.65, b: 3.3, p: 2.2, wob: 0.1, n: 36, h: 0.5, t: 0.22, crenel: 0.22, gates: ['s', 'n', 'e', 'w'], tiers: { s: 2, n: 2, e: 2, w: 2 }, gateW: 0.8,
      density: 0.92, palace: [-1.05, 1.0], pond: [1.75, 1.35, 1.0] });
    return 3.65;
  }

  // ======================= 城外诸样：日本 =======================
  // 土蔵：下截黑（海鼠壁）、上截白，黛瓦两坡
  function kura(m, x, z, w, d, wh, rot) {
    m.push(x, 0, z, rot ? Math.PI / 2 : 0);
    box(m, -w / 2, -0.5, -d / 2, w / 2, wh * 0.34, d / 2, J.black, { faces: 'nsew' });
    box(m, -w / 2, wh * 0.34, -d / 2, w / 2, wh, d / 2, J.plaster, { faces: 'nsew' });
    gableRoof(m, 0, wh, 0, w / 2 + 0.02, d / 2 + 0.03, d * 0.45, J.roof, J.plaster, w / 2, d / 2);
    m.pop();
  }
  // 弁才船：平底宽身，艫（船尾）高起一间屋形，舳（船头）翘起；一根桅，一张横张的白木棉大帆（几道接缝）。吃水线 y=0，长 L，头朝 +x
  function bune(m, x, z, yaw, L) {
    m.push(x, 0, z, yaw);
    const b = L * 0.19, hh = L * 0.1;
    const S = [[-L / 2, b * 0.85], [L * 0.22, b], [L / 2, 0], [L * 0.22, -b], [-L / 2, -b * 0.85]];
    for (let i = 0; i < S.length; i++) {
      const [x0, z0] = S[i], [x1, z1] = S[(i + 1) % S.length];
      m.quad([x0 * 0.85, -0.05, z0 * 0.6], [x1 * 0.85, -0.05, z1 * 0.6], [x1, hh, z1], [x0, hh, z0], J.woodDark);
    }
    for (let i = 1; i < S.length - 1; i++) m.tri([S[0][0], hh, S[0][1]], [S[i][0], hh, S[i][1]], [S[i + 1][0], hh, S[i + 1][1]], J.wood);
    box(m, -L * 0.5, hh, -b * 0.7, -L * 0.3, hh + L * 0.09, b * 0.7, J.wood, { top: J.roof });
    m.tri([L * 0.34, hh, -b * 0.35], [L * 0.34, hh, b * 0.35], [L * 0.56, hh + L * 0.12, 0], J.wood);
    box(m, L * 0.02 - 0.012, hh, -0.012, L * 0.02 + 0.012, hh + L * 0.95, 0.012, C.pole, { faces: 'nsew' });
    m.push(L * 0.02, 0, 0, Math.PI / 2 + 0.3);
    const sw = L * 0.3, y0 = hh + L * 0.22, y1 = hh + L * 0.88;
    m.quad([-sw, y0, 0.015], [sw, y0, 0.015], [sw, y1, 0.015], [-sw, y1, 0.015], J.plaster);
    for (const u of [-0.5, 0, 0.5]) m.quad([u * sw - 0.006, y0, 0.018], [u * sw + 0.006, y0, 0.018], [u * sw + 0.006, y1, 0.018], [u * sw - 0.006, y1, 0.018], J.wood);
    box(m, -sw * 1.05, y1, -0.008, sw * 1.05, y1 + 0.016, 0.008, C.pole);
    m.pop();
    m.pop();
  }
  // 木栈：从岸上伸进海里（门朝 +z），两排桩
  function pier(m, len = 1.3) {
    box(m, -0.09, -0.06, -0.3, 0.09, 0.03, len, C.woodLight);
    for (let z = 0; z <= len - 0.05; z += 0.26) for (const sx of [-0.1, 0.1]) box(m, sx - 0.015, -0.4, z - 0.015, sx + 0.015, 0.04, z + 0.015, C.wood, { faces: 'nsew' });
  }
  // 湊：岸上两座土蔵、一间问屋、一座常夜灯；木栈伸进海里，两只弁才船泊着。sea 为假是河埠（栈、船随地面）；old 安土以前（草葺的仓，没有常夜灯）
  function jpPort(m, sea = true, old = false) {
    if (old) {
      house(m, -0.25, -0.62, 0.8, 0.3, 0.13, J.tsuiji, C.thatch);
      house(m, 0.55, -0.55, 0.36, 0.24, 0.11, J.wood, J.bark, true);
    } else {
      kura(m, -0.25, -0.62, 0.76, 0.28, 0.16, false);
      kura(m, 0.55, -0.55, 0.36, 0.24, 0.14, true);
      box(m, 0.16, -0.3, -0.33, 0.26, 0.12, -0.23, J.stone, { top: J.stoneTop });
      box(m, 0.175, 0.12, -0.315, 0.245, 0.19, -0.245, J.plaster, { faces: 'nsew' });
      hipRoof(m, 0.21, 0.19, -0.28, 0.06, 0.06, 0.05, J.roof);
    }
    house(m, -0.7, -0.2, 0.3, 0.22, 0.1, J.wood, old ? J.bark : J.roof);
    m.sea = sea;
    pier(m);
    bune(m, 0.4, 0.8, Math.PI / 2 + 0.2, 0.62);
    bune(m, -0.38, 1.12, Math.PI / 2 - 0.15, 0.5);
    m.sea = false;
    return 0.8;
  }
  // 火の見櫓：四根高柱、两道横木，顶上一层台、宝形小顶，台下悬一口半钟
  function fireTower(m, x, z) {
    const a = 0.05, h = 0.48;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(m, x + sx * a - 0.01, -0.2, z + sz * a - 0.01, x + sx * a + 0.01, h + 0.07, z + sz * a + 0.01, J.woodDark, { faces: 'nsew' });
    for (const y of [0.16, 0.32]) box(m, x - a - 0.012, y, z - a - 0.012, x + a + 0.012, y + 0.012, z + a + 0.012, J.wood, { faces: 'nsew' });
    box(m, x - a - 0.025, h, z - a - 0.025, x + a + 0.025, h + 0.014, z + a + 0.025, J.wood);
    box(m, x - 0.014, h + 0.02, z - 0.014, x + 0.014, h + 0.055, z + 0.014, C.gold);
    hipRoof(m, x, h + 0.07, z, a + 0.035, a + 0.035, 0.055, J.roof);
  }
  // 町（宿场町）：南北一条大街，两侧町屋挨着（平入），中段一条横町；町外西侧一座小社（鸟居），东侧火の見櫓，几株松。old 安土以前（桧皮、草葺，无櫓）
  function jpMarket(m, old = false) {
    const r = rng(old ? 1283 : 1183);
    const walls = old ? [J.tsuiji, J.wood, C.earthHouse] : [J.plaster, J.wood, J.plaster, C.plaster2];
    const roofs = old ? [J.bark, J.bark, C.thatch] : [J.townRoof, J.townRoof2, J.roof];
    flat(m, -0.1, -1.05, 0.1, 1.05, 0.016, J.street);
    flat(m, -1.0, 0.26, 1.0, 0.38, 0.014, J.street);
    for (const sx of [-1, 1]) {
      for (let z = -0.98; z < 0.9; z += 0.19) {
        if (z > 0.1 && z < 0.4) continue;
        house(m, sx * 0.27, z + 0.09, 0.3, 0.17, 0.1 + r() * 0.025, pick(r, walls), pick(r, roofs), true);
      }
      for (const z of [-0.72, -0.46, 0.66, 0.9]) if (r() < 0.75) house(m, sx * 0.62, z, 0.26, 0.18, 0.09, pick(r, walls), pick(r, roofs));
    }
    jinja(m, -0.66, -0.02, 0.7);
    if (!old) fireTower(m, 0.64, -0.06);
    for (const [x, z, s] of [[-0.95, 0.72, 1.1], [0.95, 0.62, 1.0], [0.9, -0.88, 1.1]]) tree(m, x, z, s, C.leafDark);
    return 1.1;
  }
  // 寺：一圈白土塀（安土以前筑地塀），南面二重楼门；深檐黑木的本堂；东北一座朱红五重塔（安土以前七重）；西北钟楼（石台、四柱、悬钟）；两株松
  function jpTemple(m, old = false) {
    const cz = -0.04;
    flat(m, -0.86, cz - 0.86, 0.86, cz + 0.86, 0.016, J.gravel);
    wallRect(m, 0, 0, cz, 0.9, 0.9, 0.08, 0.035, 0.32, old ? J.tsuiji : J.plaster);
    pavilion(m, 0, 0, cz + 0.88, 0.16, 0.08, 0.1, 2, J.roof, { body: J.verm, lift: 0.015, ridge: J.roof });
    hall(m, -0.15, cz + 0.12, 0.32, 0.2, 0.12, J.roof, { body: J.woodDark, lift: 0.02 });
    pagoda(m, 0.5, cz - 0.42, old ? 7 : 5, 0.22, J.verm, J.roof);
    const bx = -0.52, bz = cz - 0.5;
    box(m, bx - 0.12, -0.3, bz - 0.12, bx + 0.12, 0.04, bz + 0.12, J.stone, { top: J.stoneTop });
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(m, bx + sx * 0.08 - 0.01, 0.04, bz + sz * 0.08 - 0.01, bx + sx * 0.08 + 0.01, 0.16, bz + sz * 0.08 + 0.01, J.woodDark, { faces: 'nsew' });
    box(m, bx - 0.03, 0.08, bz - 0.03, bx + 0.03, 0.15, bz + 0.03, J.bronze);
    hipRoof(m, bx, 0.16, bz, 0.14, 0.14, 0.09, J.roof, { lift: 0.015 });
    tree(m, -0.62, cz + 0.55, 1.2, C.leafDark); tree(m, 0.62, cz + 0.5, 1.1, C.leafDark);
    return 1.0;
  }
  // 社：南来一条参道、两座鸟居；朱垣里拝殿在前、本殿在后（桧皮顶）；四周社叢（深绿的树挤着）
  function jpShrine(m) {
    const cz = -0.22;
    flat(m, -0.07, cz + 0.3, 0.07, cz + 1.1, 0.02, J.gravel);
    flat(m, -0.52, cz - 0.52, 0.52, cz + 0.3, 0.018, J.gravel);
    wallRect(m, 0, 0, cz - 0.12, 0.42, 0.36, 0.045, 0.02, 0.14, J.verm, J.verm);
    hall(m, 0, cz + 0.06, 0.2, 0.1, 0.08, J.bark, { body: J.verm, lift: 0.02 });
    hall(m, 0, cz - 0.3, 0.13, 0.1, 0.09, J.bark, { body: J.verm, lift: 0.015 });
    torii(m, 0, cz + 0.5, 1.6);
    torii(m, 0, cz + 0.92, 2.0);
    for (const [x, z, s] of [[-0.72, cz - 0.5, 1.45], [0.7, cz - 0.55, 1.4], [-0.75, cz + 0.05, 1.25], [0.74, cz + 0.1, 1.3], [-0.42, cz - 0.72, 1.35],
      [0.38, cz - 0.74, 1.25], [-0.62, cz + 0.55, 1.2], [0.6, cz + 0.6, 1.15]]) tree(m, x, z, s, C.leafDark);
    return 0.9;
  }
  // 学（藩校、学问所）：白土塀一圈，南面一座门；讲堂在前、黑漆的圣堂（孔子庙，两重檐）在后，两侧寮舍；门内两株松。
  // old 国学（安土以前）：筑地塀、朱柱桧皮，圣堂单檐朱柱
  function jpAcademy(m, old = false) {
    const cz = -0.16, wall = old ? J.tsuiji : J.plaster, body = old ? J.verm : J.wood, roof = old ? J.bark : J.roof;
    flat(m, -0.76, cz - 0.64, 0.76, cz + 0.64, 0.016, J.gravel);
    wallRect(m, 0, 0, cz, 0.8, 0.68, 0.075, 0.03, 0.24, wall);
    hall(m, 0, cz + 0.68, 0.13, 0.05, 0.08, roof, { body: J.woodDark, lift: 0.01 });
    hall(m, 0, cz + 0.08, 0.32, 0.15, 0.11, roof, { body, lift: 0.015 });
    hall(m, 0, cz - 0.42, 0.2, 0.12, 0.11, roof, { body: old ? J.verm : J.black, lift: 0.02, tiers: old ? 1 : 2 });
    for (const sx of [-1, 1]) house(m, sx * 0.56, cz + 0.12, 0.6, 0.15, 0.09, wall, roof, true);
    tree(m, -0.35, cz + 0.46, 1.0, C.leafDark); tree(m, 0.35, cz + 0.46, 1.0, C.leafDark);
    return 0.9;
  }
  // 砦（出城）：一圈堀、南面土桥，石垣台上白土塀、櫓门；台上三重的小天守、两座隅櫓、御殿
  function jpFort(m) {
    const r = rng(1171);
    moatRing(m, 0, 0, 0.74, 0.66, 0.13);
    flat(m, -0.07, 0.66, 0.07, 0.79, 0.024, C.earth);
    mound(m, 0, 0, 0.74, 0.66, 0.66, 0.58, -0.4, 0.14, J.stone, J.gravel);
    wallRect(m, 0, 0.14, 0, 0.66, 0.58, 0.05, 0.025, 0.18, J.plaster);
    yaguraMon(m, 0, 0.14, 0.58 - 0.0125, 0.2, J.plaster);
    tenshu(m, -0.26, 0.14, -0.2, 3, 0.25, 0.2, J.plaster);
    for (const sz of [-1, 1]) yagura(m, 0.52, 0.14, sz * 0.44, 0.09, J.plaster);
    goten(m, 0.24, 0.14, 0.26, 0.46, r);
    return 0.95;
  }
  // 代官所（奉行所）：白土塀一圈，南面长屋门（门洞黑）；里头主屋（黑木、黛瓦大顶）、侧屋；门外一座高札；两株松
  function jpYamen(m) {
    const cz = -0.18;
    flat(m, -0.74, cz - 0.6, 0.74, cz + 0.6, 0.016, J.gravel);
    wallRect(m, 0, 0, cz, 0.78, 0.64, 0.075, 0.03, 0, J.plaster);
    house(m, 0, cz + 0.62, 0.72, 0.15, 0.11, J.plaster, J.roof);
    m.quad([-0.07, 0, cz + 0.697], [0.07, 0, cz + 0.697], [0.07, 0.085, cz + 0.697], [-0.07, 0.085, cz + 0.697], C.hole);
    hall(m, 0, cz - 0.12, 0.34, 0.17, 0.11, J.roof, { body: J.wood, lift: 0.015 });
    house(m, 0.5, cz + 0.2, 0.4, 0.16, 0.09, J.plaster, J.roof, true);
    const kx = -0.42, kz = cz + 0.86;
    for (const sx of [-1, 1]) box(m, kx + sx * 0.09 - 0.008, -0.2, kz - 0.008, kx + sx * 0.09 + 0.008, 0.14, kz + 0.008, J.woodDark, { faces: 'nsew' });
    box(m, kx - 0.1, 0.07, kz - 0.006, kx + 0.1, 0.13, kz + 0.006, J.plaster);
    gableRoof(m, kx, 0.14, kz, 0.12, 0.04, 0.03, J.roof, J.woodDark, 0.1, 0.006);
    tree(m, -0.5, cz - 0.4, 1.1, C.leafDark); tree(m, 0.52, cz - 0.42, 1.0, C.leafDark);
    return 0.9;
  }
  // 望楼：四根高柱，上一层台、小顶
  function watchTower(m, x, z) {
    const a = 0.05, h = 0.34;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(m, x + sx * a - 0.01, -0.2, z + sz * a - 0.01, x + sx * a + 0.01, h, z + sz * a + 0.01, J.wood, { faces: 'nsew' });
    box(m, x - a - 0.02, h, z - a - 0.02, x + a + 0.02, h + 0.05, z + a + 0.02, J.wood);
    hipRoof(m, x, h + 0.05, z, a + 0.04, a + 0.04, 0.05, J.bark);
  }
  // 城柵（安土以前）：外一圈木栅，南面二重楼门；栅里国衙（筑地塀、朱柱正殿），栅角两座望楼
  function joFort(m) {
    palisade(m, [[-0.88, -0.8], [0.88, -0.8], [0.88, 0.8], [-0.88, 0.8]], 0.2);
    pavilion(m, 0, 0, 0.8, 0.15, 0.07, 0.11, 2, J.bark, { body: J.verm, lift: 0.015, ridge: J.roof });
    kokuga(m, 0, -0.14, 1.45);
    for (const sx of [-1, 1]) watchTower(m, sx * 0.76, -0.68);
    return 0.95;
  }
  // 官署（安土以前）：国衙，南面一座门，两株树
  function joYamen(m) {
    kokuga(m, 0, -0.1, 1.75);
    pavilion(m, 0, 0, 0.565, 0.14, 0.06, 0.09, 1, J.bark, { body: J.verm, lift: 0.015, ridge: J.roof });
    tree(m, -0.55, 0.75, 1.1); tree(m, 0.58, 0.72, 1.0);
    return 0.9;
  }

  // ======================= 城外诸样：朝鲜 =======================
  // 遮阳棚（场市）：四根细柱，上蒙一块微斜的白布
  function awning(m, x, z, a, b, col = K.wall) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(m, x + sx * a - 0.006, -0.1, z + sz * b - 0.006, x + sx * a + 0.006, 0.08, z + sz * b + 0.006, C.wood, { faces: 'nsew' });
    m.quad([x - a - 0.02, 0.07, z + b + 0.02], [x + a + 0.02, 0.07, z + b + 0.02], [x + a + 0.02, 0.095, z - b - 0.02], [x - a - 0.02, 0.095, z - b - 0.02], col);
  }
  // 场市：南北大街两侧瓦房、草房，街心一片场院搭着白布棚，酒幕挑一面白旗；镇口两株榉树
  function koMarket(m) {
    const r = rng(1383);
    flat(m, -0.1, -1.05, 0.1, 1.05, 0.016, K.street);
    flat(m, -0.5, -0.3, 0.5, 0.3, 0.018, K.ground);
    for (const sx of [-1, 1]) {
      for (const z0 of [-1.0, 0.36]) for (let z = z0; z < z0 + 0.62; z += 0.21) {
        if (r() < 0.55) choga(m, sx * 0.3, z + 0.1, 0.3, 0.18, 0.09, true);
        else kHouse(m, sx * 0.3, z + 0.1, 0.3, 0.18, 0.1, true);
      }
      for (const z of [-0.72, 0.7]) if (r() < 0.8) choga(m, sx * 0.68, z, 0.26, 0.2, 0.08, false);
    }
    for (const [x, z] of [[-0.32, -0.16], [-0.32, 0.16], [0.32, -0.16], [0.32, 0.16]]) awning(m, x, z, 0.1, 0.07);
    flag(m, 0.5, 0.36, 0.5, K.wall);
    tree(m, -0.82, -0.05, 1.4); tree(m, 0.84, 0.08, 1.3);
    return 1.1;
  }
  // 浦口：岸上瓦仓、两间草房，木栈伸进海里，两只船（白布帆、草席帆）
  function koPort(m, sea = true) {
    kHouse(m, -0.25, -0.62, 0.74, 0.26, 0.13, false);
    choga(m, 0.55, -0.55, 0.34, 0.22, 0.1, true);
    choga(m, -0.72, -0.18, 0.28, 0.22, 0.09, false);
    m.sea = sea;
    pier(m);
    junk(m, 0.38, 0.8, Math.PI / 2 + 0.2, 0.6, K.wall);
    junk(m, -0.36, 1.12, Math.PI / 2 - 0.15, 0.5, K.thatch);
    m.sea = false;
    flag(m, 0.14, -0.3, 0.5, K.green);
    return 0.8;
  }
  // 寺刹：一圈院墙，南面天王门（丹青楼阁）；石筑台上大雄殿，殿前三层石塔；东南梵钟阁、西侧僧房；两株古树
  function koTemple(m) {
    const cz = -0.05;
    flat(m, -0.86, cz - 0.84, 0.86, cz + 0.84, 0.016, K.ground);
    courtyard(m, 0, cz, 0.9, 0.86, 0.09, 0.04, K.wall, K.roof, 0.32);
    kPavilion(m, 0, 0, cz + 0.86, 0.16, 0.07, 0.11, 1);
    box(m, -0.42, -0.4, cz - 0.56, 0.42, 0.06, cz - 0.1, K.stone, { top: K.stoneTop });
    kHall(m, 0, 0.06, cz - 0.33, 0.3, 0.14, 0.13);
    pagoda(m, 0, cz + 0.2, 3, 0.17, K.stone, K.stoneTop);
    kPavilion(m, 0.56, 0, cz + 0.46, 0.1, 0.1, 0.1, 1);
    kHouse(m, -0.56, cz + 0.22, 0.36, 0.16, 0.09, true);
    tree(m, -0.62, cz - 0.62, 1.3); tree(m, 0.62, cz - 0.6, 1.2);
    return 1.0;
  }
  // 红箭门：两根朱柱，上一道横木，横木上一排箭尖
  function hongsal(m, x, z, w, h) {
    for (const sx of [-1, 1]) box(m, x + sx * w - 0.012, -0.2, z - 0.012, x + sx * w + 0.012, h, z + 0.012, K.pillar, { faces: 'nsew' });
    box(m, x - w - 0.02, h * 0.8, z - 0.01, x + w + 0.02, h * 0.86, z + 0.01, K.pillar);
    for (let i = 0; i < 7; i++) { const px = x - w * 0.8 + w * 1.6 * i / 6; m.tri([px - 0.008, h * 0.86, z], [px + 0.008, h * 0.86, z], [px, h * 0.99, z], K.pillar); }
  }
  // 三门：院墙南面一间门屋（门洞黑）
  function samun(m, z) {
    kHouse(m, 0, z, 0.38, 0.12, 0.09, false);
    m.quad([-0.05, 0, z + 0.062], [0.05, 0, z + 0.062], [0.05, 0.075, z + 0.062], [-0.05, 0.075, z + 0.062], C.hole);
  }
  // 祠堂：一圈院墙，南面三门；石台上祠宇（丹青）；门外一座红箭门；两株树
  function koShrine(m) {
    const cz = -0.22;
    flat(m, -0.7, cz - 0.6, 0.7, cz + 0.6, 0.016, K.ground);
    courtyard(m, 0, cz, 0.74, 0.62, 0.09, 0.04, K.wall, K.roof, 0.3);
    samun(m, cz + 0.6);
    box(m, -0.4, -0.4, cz - 0.44, 0.4, 0.05, cz - 0.04, K.stone, { top: K.stoneTop });
    kHall(m, 0, 0.05, cz - 0.24, 0.28, 0.13, 0.12);
    hongsal(m, 0, cz + 0.98, 0.24, 0.36);
    tree(m, -0.52, cz + 0.24, 1.2); tree(m, 0.54, cz + 0.27, 1.1);
    return 0.9;
  }
  // 书院：南面石台上两层门楼，讲堂居中，东西两斋，后头一圈小墙里祠堂；两株银杏
  function koAcademy(m) {
    const cz = -0.16;
    flat(m, -0.76, cz - 0.66, 0.76, cz + 0.66, 0.016, K.ground);
    courtyard(m, 0, cz, 0.8, 0.7, 0.09, 0.04, K.wall, K.roof, 0.34);
    box(m, -0.22, -0.3, cz + 0.62, 0.22, 0.06, cz + 0.78, K.stone, { top: K.stoneTop });
    kPavilion(m, 0, 0.06, cz + 0.7, 0.18, 0.07, 0.09, 2);
    kHall(m, 0, 0.03, cz - 0.02, 0.3, 0.13, 0.11);
    for (const sx of [-1, 1]) kHouse(m, sx * 0.5, cz + 0.32, 0.38, 0.14, 0.085, true);
    courtyard(m, 0, cz - 0.48, 0.3, 0.17, 0.07, 0.03, K.wall, K.roof, 0.1);
    kHall(m, 0, 0.02, cz - 0.5, 0.15, 0.08, 0.09);
    tree(m, -0.55, cz - 0.45, 1.3, C.leaf); tree(m, 0.56, cz - 0.46, 1.25, C.leaf);
    return 0.9;
  }
  // 镇堡：随势的小石城、女墙，南面虹霓门楼；城中石台上两层将台，两排营房，一杆帅旗
  function koFort(m) {
    const r = rng(1373), pts = loopPts(0.86, 0.76, 2.3, 22, 0.06, r);
    loopGround(m, pts, 0.018, K.ground);
    wallLoop(m, pts, 0.26, 0.13, 0.18);
    kGate(m, 0.76, 0.26, 0.13, 0.36, 1);
    box(m, -0.2, -0.3, -0.44, 0.2, 0.1, -0.14, K.stone, { top: K.stoneTop });
    kPavilion(m, 0, 0.1, -0.29, 0.14, 0.1, 0.09, 2);
    for (const sx of [-1, 1]) kHouse(m, sx * 0.4, 0.22, 0.32, 0.14, 0.08, false);
    flag(m, 0.22, -0.3, 0.72);
    return 0.95;
  }
  // 官衙：南面三门、门外红箭门；石台上东轩（丹青官衙），北边内衙、西边厢房；一株树
  function koYamen(m) {
    const cz = -0.2;
    flat(m, -0.74, cz - 0.6, 0.74, cz + 0.6, 0.016, K.ground);
    courtyard(m, 0, cz, 0.78, 0.64, 0.09, 0.04, K.wall, K.roof, 0.3);
    samun(m, cz + 0.62);
    box(m, -0.38, -0.4, cz - 0.3, 0.38, 0.04, cz + 0.06, K.stoneTop);
    kHall(m, 0, 0.04, cz - 0.12, 0.3, 0.14, 0.12);
    kHouse(m, 0.48, cz - 0.44, 0.34, 0.15, 0.09, false);
    kHouse(m, -0.5, cz + 0.24, 0.32, 0.14, 0.08, true);
    hongsal(m, 0, cz + 0.98, 0.22, 0.34);
    tree(m, -0.5, cz - 0.44, 1.2);
    return 0.9;
  }

  // ======================= 四郊村舍（点景近看换上的那种，几千处一起画，每样八十面以内） =======================
  // 日本农家：板壁，陡的茅草四坡顶（一道短脊）
  function minka(m, x, z, w, d, wh, rot, wall = J.wood) {
    m.push(x, 0, z, rot ? Math.PI / 2 : 0);
    box(m, -w / 2, -0.3, -d / 2, w / 2, wh, d / 2, wall, { faces: 'nsew' });
    mound(m, 0, 0, w / 2 + 0.035, d / 2 + 0.04, w * 0.28, 0.012, wh, wh + d * 0.62, C.thatch);
    m.pop();
  }
  // 小土蔵：白壁、黛瓦两坡
  function kuraS(m, x, z, w, d, wh) {
    box(m, x - w / 2, -0.3, z - d / 2, x + w / 2, wh, z + d / 2, J.plaster, { faces: 'nsew' });
    gableRoof(m, x, wh, z, w / 2 + 0.02, d / 2 + 0.025, d * 0.45, J.roof, J.plaster, w / 2, d / 2);
  }
  // 杉：一根干，两层五棱的尖冠（下宽上窄，瘦高）
  function sugi(m, x, z) {
    trunk(m, x, z, 0.22, 0.02);
    for (const [y, r, hh] of [[0.18, 0.11, 0.3], [0.36, 0.075, 0.3]]) {
      const apex = [x, y + hh, z];
      for (let i = 0; i < 5; i++) {
        const a0 = i / 5 * Math.PI * 2, a1 = (i + 1) / 5 * Math.PI * 2;
        m.tri([x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], apex, C.deep);
      }
    }
  }
  // 村：一座茅草农家、一座小土蔵，屋后一株杉
  function jpHamlet(m) {
    minka(m, -0.12, 0.04, 0.42, 0.26, 0.11, false);
    kuraS(m, 0.27, 0.16, 0.2, 0.16, 0.12);
    sugi(m, 0.3, -0.22);
    return 0.44;
  }
  // 庄：两座茅草农家（一座白壁）、一座土蔵，场边一架稻架，屋后一株杉
  function jpHamletB(m) {
    minka(m, -0.04, -0.22, 0.5, 0.26, 0.12, false);
    minka(m, -0.4, 0.06, 0.34, 0.22, 0.11, true, J.plaster);
    kuraS(m, 0.4, 0.04, 0.2, 0.26, 0.13);
    box(m, 0.02, 0, 0.18, 0.26, 0.09, 0.2, C.hay);
    sugi(m, -0.42, -0.36);
    return 0.52;
  }
  // 朝鲜草房、瓦房（省面版）：土墙或白墙，一个圆鼓的草顶或四坡的黛瓦顶
  function chogaS(m, x, z, w, d, wh, rot) {
    m.push(x, 0, z, rot ? Math.PI / 2 : 0);
    box(m, -w / 2, -0.3, -d / 2, w / 2, wh, d / 2, K.earth, { faces: 'nsew' });
    mound(m, 0, 0, w / 2 + 0.03, d / 2 + 0.035, w * 0.3, d * 0.16, wh, wh + d * 0.42, K.thatch);
    m.pop();
  }
  function kHouseS(m, x, z, w, d, wh, rot) {
    m.push(x, 0, z, rot ? Math.PI / 2 : 0);
    box(m, -w / 2, -0.3, -d / 2, w / 2, wh, d / 2, K.wall, { faces: 'nsew' });
    mound(m, 0, 0, w / 2 + 0.035, d / 2 + 0.04, w * 0.3, 0.01, wh, wh + d * 0.4, K.roof);
    m.pop();
  }
  // 村：两座草房，院角一处酱缸台，屋后一株树
  function koHamlet(m) {
    chogaS(m, -0.12, 0.04, 0.4, 0.24, 0.1, false);
    chogaS(m, 0.25, 0.17, 0.28, 0.2, 0.09, true);
    box(m, 0.02, -0.1, 0.24, 0.1, 0.04, 0.32, K.jar);
    trunk(m, 0.3, -0.2, 0.26, 0.025);
    crown(m, 0.3, 0.38, -0.2, 0.17, 0.28, C.jade, 5, false);
    return 0.44;
  }
  // 庄：两座草房、一座瓦房（地主家）围着一块场，屋后一株树
  function koHamletB(m) {
    flat(m, -0.2, -0.06, 0.24, 0.24, 0.014, K.ground);
    chogaS(m, -0.04, -0.22, 0.5, 0.24, 0.11, false);
    chogaS(m, -0.4, 0.06, 0.34, 0.2, 0.1, true);
    kHouseS(m, 0.4, 0.02, 0.32, 0.2, 0.11, true);
    trunk(m, -0.42, -0.34, 0.28, 0.025);
    crown(m, -0.42, 0.42, -0.34, 0.18, 0.3, C.jade, 5, false);
    return 0.52;
  }

  const out = { jpCap, joCap, koCap, jpHamlet, jpHamletB, koHamlet, koHamletB };
  for (let t = 0; t < 4; t++) for (let v = 0; v < 2; v++) { out[`jp${t}${v}`] = jp(t, v); out[`jo${t}${v}`] = jo(t, v); out[`ko${t}${v}`] = ko(t, v); }
  Object.assign(out, {
    jpMarket: (m) => jpMarket(m), joMarket: (m) => jpMarket(m, true), koMarket,
    jpPort: (m) => jpPort(m, true), jpWharf: (m) => jpPort(m, false), joPort: (m) => jpPort(m, true, true), joWharf: (m) => jpPort(m, false, true),
    koPort: (m) => koPort(m, true), koWharf: (m) => koPort(m, false),
    jpTemple: (m) => jpTemple(m), joTemple: (m) => jpTemple(m, true), koTemple,
    jpShrine, koShrine,
    jpAcademy: (m) => jpAcademy(m), joAcademy: (m) => jpAcademy(m, true), koAcademy,
    jpFort, joFort, koFort, jpYamen, joYamen, koYamen
  });
  return out;
}

// 地域 → 模型名的前缀（城郭四档 0～3 后跟街巷那一位 0、1；都城另一样）
export const EAST_KIND = { japan: 'jp', japanOld: 'jo', korea: 'ko' };
// 地域 → 城外诸样（市镇、港、河埠、几样地标与四郊村舍）换成的模型；没列的（仓廒、水利、工坊、烽燧、驿、桥、在建、残垣、教堂、林木）照原样
export const EAST_LOCAL = {
  japan: { market: 'jpMarket', port: 'jpPort', wharf: 'jpWharf', temple: 'jpTemple', shrine: 'jpShrine', academy: 'jpAcademy', fort: 'jpFort', yamen: 'jpYamen',
    hamlet: 'jpHamlet', hamletB: 'jpHamletB' },
  japanOld: { market: 'joMarket', port: 'joPort', wharf: 'joWharf', temple: 'joTemple', shrine: 'jpShrine', academy: 'joAcademy', fort: 'joFort', yamen: 'joYamen',
    hamlet: 'jpHamlet', hamletB: 'jpHamletB' },
  korea: { market: 'koMarket', port: 'koPort', wharf: 'koWharf', temple: 'koTemple', shrine: 'koShrine', academy: 'koAcademy', fort: 'koFort', yamen: 'koYamen',
    hamlet: 'koHamlet', hamletB: 'koHamletB' }
};
