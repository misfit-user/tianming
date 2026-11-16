// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-phase-g1-authority-ui.js — G 阶段 ①：权威运行时 UI + 朝代预设 + 历史案例库
 *
 * ⚠ 架构分类（2026-04-24 R10 评估）：
 *   文件名以 "phase-" 开头，但**本质是自包含 UI 模块**而非 monkey patch。
 *   导出 PhaseG1 + window.openTianweiInspection/openQianGangInspection/openMinxinInspection
 *        /openLizhiInspection/openMinxinHeatmap/applyDynastyPreset，不覆盖现有函数。
 *   未来可改名为 tm-authority-ui.js，当前命名保留以维持加载顺序与 git 历史。
 *   **不需要"归位"到 authority-engines.js**（这是 UI 层，属性上不同）。
 *
 * 补完：
 *  - 天威之察 / 乾纲之察 / 民心之察 / 吏治之察 4 个运行时面板
 *  - 12 朝代 × 4 阶段 权力预设矩阵（开国/盛/衰/亡）
 *  - 80+ 历史案例库（权臣/民变/诏书/暴君/明主）
 *  - 执行度乘数 5 段非线性表
 *  - 天下热力图（按民心 5 级着色）
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  12 朝代 × 4 阶段 权力预设
  // ═══════════════════════════════════════════════════════════════════

  var DYNASTY_AUTHORITY_PRESETS = {
    '秦': {
      founding: { hw:75, hq:85, mx:45, corr:20, name:'始皇集权' },
      peak:     { hw:82, hq:90, mx:35, corr:25, name:'焚书坑儒' },
      decline:  { hw:45, hq:60, mx:15, corr:55, name:'二世而亡' },
      collapse: { hw:15, hq:20, mx:5,  corr:80, name:'刘邦入关' }
    },
    '汉': {
      founding: { hw:70, hq:65, mx:65, corr:25 },
      peak:     { hw:80, hq:70, mx:70, corr:30 },
      decline:  { hw:50, hq:40, mx:45, corr:55 },
      collapse: { hw:20, hq:25, mx:15, corr:75 }
    },
    '三国': {
      founding: { hw:60, hq:55, mx:50, corr:35 },
      peak:     { hw:65, hq:60, mx:55, corr:35 },
      decline:  { hw:40, hq:35, mx:35, corr:55 },
      collapse: { hw:15, hq:20, mx:15, corr:70 }
    },
    '晋': {
      founding: { hw:60, hq:50, mx:55, corr:40 },
      peak:     { hw:55, hq:45, mx:50, corr:50 },
      decline:  { hw:30, hq:25, mx:25, corr:70 },
      collapse: { hw:10, hq:15, mx:10, corr:85 }
    },
    '南北朝': {
      founding: { hw:55, hq:50, mx:45, corr:40 },
      peak:     { hw:60, hq:55, mx:50, corr:40 },
      decline:  { hw:35, hq:30, mx:30, corr:60 },
      collapse: { hw:20, hq:25, mx:20, corr:70 }
    },
    '隋': {
      founding: { hw:75, hq:80, mx:60, corr:25 },
      peak:     { hw:85, hq:85, mx:45, corr:35 },
      decline:  { hw:50, hq:55, mx:20, corr:60 },
      collapse: { hw:20, hq:25, mx:10, corr:80 }
    },
    '唐': {
      founding: { hw:75, hq:70, mx:70, corr:25, name:'贞观之治' },
      peak:     { hw:85, hq:75, mx:75, corr:25, name:'开元盛世' },
      decline:  { hw:50, hq:40, mx:45, corr:60, name:'安史之乱' },
      collapse: { hw:15, hq:20, mx:20, corr:80, name:'藩镇割据' }
    },
    '宋': {
      founding: { hw:65, hq:55, mx:65, corr:30, name:'杯酒释兵权' },
      peak:     { hw:70, hq:55, mx:70, corr:35, name:'仁宗盛治' },
      decline:  { hw:40, hq:35, mx:45, corr:55, name:'宋金议和' },
      collapse: { hw:15, hq:20, mx:20, corr:65, name:'靖康崖山' }
    },
    '元': {
      founding: { hw:80, hq:75, mx:40, corr:45 },
      peak:     { hw:75, hq:70, mx:35, corr:50 },
      decline:  { hw:40, hq:35, mx:20, corr:70 },
      collapse: { hw:10, hq:15, mx:10, corr:85 }
    },
    '明': {
      founding: { hw:80, hq:85, mx:60, corr:25, name:'洪武严政' },
      peak:     { hw:75, hq:70, mx:65, corr:35, name:'永乐宣德' },
      decline:  { hw:45, hq:40, mx:35, corr:65, name:'万历怠政' },
      collapse: { hw:15, hq:25, mx:10, corr:80, name:'甲申之变' }
    },
    '清': {
      founding: { hw:75, hq:80, mx:55, corr:30, name:'康熙定鼎' },
      peak:     { hw:85, hq:80, mx:70, corr:30, name:'康乾盛世' },
      decline:  { hw:45, hq:45, mx:35, corr:65, name:'道光以降' },
      collapse: { hw:15, hq:20, mx:15, corr:75, name:'辛亥鼎革' }
    },
    '民国': {
      founding: { hw:40, hq:35, mx:40, corr:60 },
      peak:     { hw:50, hq:45, mx:50, corr:55 },
      decline:  { hw:25, hq:20, mx:30, corr:75 },
      collapse: { hw:10, hq:15, mx:15, corr:85 }
    }
  };

  function applyDynastyPreset(dynasty, phase) {
    var preset = DYNASTY_AUTHORITY_PRESETS[dynasty] && DYNASTY_AUTHORITY_PRESETS[dynasty][phase];
    if (!preset) return { ok: false };
    var G = global.GM;
    if (!G) return { ok: false };
    if (typeof G.huangwei === 'object') G.huangwei.index = preset.hw;
    else G.huangwei = preset.hw;
    if (typeof G.huangquan === 'object') G.huangquan.index = preset.hq;
    else G.huangquan = preset.hq;
    if (typeof G.minxin === 'object') G.minxin.trueIndex = preset.mx;
    else G.minxin = preset.mx;
    if (G.corruption && typeof G.corruption === 'object') {
      G.corruption.trueIndex = preset.corr;
      G.corruption.overall = preset.corr;
    }
    return { ok: true, preset: preset };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  80+ 历史案例库
  // ═══════════════════════════════════════════════════════════════════

  var HISTORICAL_CASES = {
    // 权臣（15 条）
    powerMinister: [
      { name:'赵高',    dynasty:'秦', year:-207, control:0.95, ending:'usurpation_failed', summary:'指鹿为马，胡亥幽居' },
      { name:'霍光',    dynasty:'汉', year:-74,  control:0.80, ending:'natural_death',     summary:'辅弼三帝，后灭族' },
      { name:'王莽',    dynasty:'汉', year:9,    control:1.00, ending:'usurped',            summary:'篡汉立新，赤眉所灭' },
      { name:'董卓',    dynasty:'汉', year:189,  control:0.85, ending:'assassination',      summary:'废立天子，王允吕布诛之' },
      { name:'曹操',    dynasty:'三国',year:208, control:0.90, ending:'son_usurped',        summary:'挟天子以令诸侯' },
      { name:'司马懿',  dynasty:'三国',year:249, control:0.85, ending:'descendants_usurped',summary:'高平陵政变' },
      { name:'桓温',    dynasty:'晋', year:371,  control:0.75, ending:'natural_death',      summary:'三次北伐，欲受九锡' },
      { name:'刘裕',    dynasty:'晋', year:420,  control:0.95, ending:'usurped',            summary:'取代东晋立宋' },
      { name:'李林甫',  dynasty:'唐', year:736,  control:0.80, ending:'posthumous_purge',   summary:'口蜜腹剑十九年' },
      { name:'杨国忠',  dynasty:'唐', year:755,  control:0.75, ending:'executed',           summary:'马嵬兵变被诛' },
      { name:'蔡京',    dynasty:'宋', year:1102, control:0.80, ending:'exile',              summary:'六贼之首' },
      { name:'秦桧',    dynasty:'宋', year:1138, control:0.85, ending:'posthumous_demote',  summary:'杀岳飞，议和' },
      { name:'严嵩',    dynasty:'明', year:1542, control:0.80, ending:'demoted',            summary:'贪墨二十年' },
      { name:'魏忠贤',  dynasty:'明', year:1624, control:0.85, ending:'suicide',            summary:'九千岁' },
      { name:'和珅',    dynasty:'清', year:1776, control:0.85, ending:'executed',           summary:'抄家银八亿' }
    ],
    // 民变（20 条）
    rebellion: [
      { name:'陈胜吴广', dynasty:'秦', year:-209, level:5, cause:'徭役', result:'triggered_collapse' },
      { name:'赤眉',     dynasty:'新', year:18,   level:5, cause:'饥荒', result:'triggered_collapse' },
      { name:'绿林',     dynasty:'新', year:17,   level:5, cause:'饥荒', result:'founded_han' },
      { name:'黄巾',     dynasty:'汉', year:184,  level:5, cause:'民不聊生', result:'triggered_collapse' },
      { name:'孙恩',     dynasty:'晋', year:399,  level:4, cause:'五斗米道', result:'suppressed' },
      { name:'瓦岗',     dynasty:'隋', year:611,  level:5, cause:'大运河徭役', result:'founded_tang' },
      { name:'黄巢',     dynasty:'唐', year:875,  level:5, cause:'盐税', result:'triggered_collapse' },
      { name:'方腊',     dynasty:'宋', year:1120, level:4, cause:'花石纲', result:'suppressed' },
      { name:'钟相杨幺', dynasty:'宋', year:1130, level:3, cause:'战乱', result:'suppressed' },
      { name:'红巾',     dynasty:'元', year:1351, level:5, cause:'徭役+民族', result:'founded_ming' },
      { name:'叶宗留',   dynasty:'明', year:1446, level:3, cause:'矿禁', result:'suppressed' },
      { name:'邓茂七',   dynasty:'明', year:1448, level:4, cause:'佃户抗租', result:'suppressed' },
      { name:'刘六刘七', dynasty:'明', year:1510, level:3, cause:'马政', result:'suppressed' },
      { name:'王森',     dynasty:'明', year:1596, level:3, cause:'闻香教', result:'suppressed' },
      { name:'李自成',   dynasty:'明', year:1630, level:5, cause:'饥荒+驿改', result:'triggered_collapse' },
      { name:'张献忠',   dynasty:'明', year:1640, level:5, cause:'饥荒', result:'suppressed_by_qing' },
      { name:'三藩',     dynasty:'清', year:1673, level:4, cause:'削藩', result:'suppressed' },
      { name:'白莲',     dynasty:'清', year:1796, level:4, cause:'宗教', result:'suppressed' },
      { name:'太平天国', dynasty:'清', year:1851, level:5, cause:'鸦片+饥荒', result:'weakened_dynasty' },
      { name:'捻军',     dynasty:'清', year:1853, level:4, cause:'饥荒', result:'suppressed' }
    ],
    // 明君（10 条）
    enlightenedEmperor: [
      { name:'汉文帝',   dynasty:'汉', year:-180, hw:75, hq:55, mx:75, summary:'文景之治' },
      { name:'汉武帝',   dynasty:'汉', year:-141, hw:90, hq:90, mx:55, summary:'前期盛后期暴' },
      { name:'汉光武',   dynasty:'汉', year:25,   hw:80, hq:70, mx:75, summary:'光武中兴' },
      { name:'唐太宗',   dynasty:'唐', year:626,  hw:80, hq:65, mx:80, summary:'贞观之治' },
      { name:'武则天',   dynasty:'唐', year:690,  hw:85, hq:85, mx:60, summary:'女主称帝' },
      { name:'唐玄宗',   dynasty:'唐', year:712,  hw:85, hq:70, mx:75, summary:'开元天宝' },
      { name:'宋仁宗',   dynasty:'宋', year:1022, hw:65, hq:45, mx:70, summary:'仁政宽厚' },
      { name:'明太祖',   dynasty:'明', year:1368, hw:90, hq:95, mx:55, summary:'洪武集权' },
      { name:'康熙',     dynasty:'清', year:1661, hw:85, hq:80, mx:70, summary:'康熙盛世' },
      { name:'乾隆',     dynasty:'清', year:1735, hw:90, hq:85, mx:60, summary:'盛极而衰' }
    ],
    // 暴君（10 条）
    tyrant: [
      { name:'秦二世',   dynasty:'秦', year:-209, hw:85, activated:true, ending:'usurped_by_zhaogao' },
      { name:'汉武帝后期',dynasty:'汉',year:-90,  hw:90, activated:true, ending:'awakened' },
      { name:'王莽',     dynasty:'新', year:9,    hw:88, activated:true, ending:'killed' },
      { name:'隋炀帝',   dynasty:'隋', year:605,  hw:92, activated:true, ending:'killed' },
      { name:'武则天',   dynasty:'唐', year:684,  hw:90, activated:false, ending:'natural_death' },
      { name:'朱元璋',   dynasty:'明', year:1380, hw:95, activated:true, ending:'natural_death' },
      { name:'朱棣',     dynasty:'明', year:1402, hw:88, activated:true, ending:'natural_death' },
      { name:'天启',     dynasty:'明', year:1620, hw:82, activated:false, ending:'natural_death' },
      { name:'崇祯',     dynasty:'明', year:1627, hw:88, activated:true, ending:'suicide' },
      { name:'雍正',     dynasty:'清', year:1722, hw:90, activated:false, ending:'natural_death' }
    ],
    // 诏令典范（25 条）
    classicalEdicts: [
      { name:'求贤诏',   emperor:'汉武',      year:-130, type:'search_talent' },
      { name:'轮台诏',   emperor:'汉武',      year:-89,  type:'self_blame' },
      { name:'罢黜百家', emperor:'汉武',      year:-134, type:'ideology' },
      { name:'罪己诏',   emperor:'唐太宗',    year:643,  type:'self_blame' },
      { name:'均田诏',   emperor:'北魏孝文',  year:485,  type:'huji_reform' },
      { name:'开元新政', emperor:'唐玄宗',    year:713,  type:'overall_reform' },
      { name:'劝农诏',   emperor:'宋仁宗',    year:1048, type:'agriculture' },
      { name:'庆历新政', emperor:'宋仁宗',    year:1043, type:'overall_reform' },
      { name:'熙宁变法', emperor:'宋神宗',    year:1069, type:'overall_reform' },
      { name:'大诰',     emperor:'明太祖',    year:1385, type:'legal' },
      { name:'削藩策',   emperor:'明建文',    year:1399, type:'central_local' },
      { name:'废相',     emperor:'明太祖',    year:1380, type:'office_reform' },
      { name:'一条鞭',   emperor:'明万历',    year:1581, type:'tax_reform' },
      { name:'摊丁入亩', emperor:'清雍正',    year:1723, type:'tax_reform' },
      { name:'改土归流', emperor:'清雍正',    year:1726, type:'central_local' },
      { name:'火耗归公', emperor:'清雍正',    year:1723, type:'fiscal_reform' },
      { name:'废三饷',   emperor:'清顺治',    year:1645, type:'relief' },
      { name:'永不加赋', emperor:'清康熙',    year:1712, type:'promise' },
      { name:'平三藩诏', emperor:'清康熙',    year:1673, type:'central_local' },
      { name:'军机处立', emperor:'清雍正',    year:1729, type:'office_reform' },
      { name:'文字狱',   emperor:'清乾隆',    year:1750, type:'suppression' },
      { name:'闭关令',   emperor:'清乾隆',    year:1757, type:'foreign' },
      { name:'禁海令',   emperor:'明洪武',    year:1371, type:'foreign' },
      { name:'编户诏',   emperor:'秦始皇',    year:-216, type:'huji_reform' },
      { name:'迁都诏',   emperor:'明永乐',    year:1421, type:'move_capital' }
    ]
  };

  // ═══════════════════════════════════════════════════════════════════
  //  天威之察 UI
  // ═══════════════════════════════════════════════════════════════════

  function openTianweiInspection() {
    var G = global.GM;
    if (!G.huangwei) { if (global.toast) global.toast('皇威未初始化'); return; }
    var hw = G.huangwei;
    var body = '<div style="max-width:700px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">天威之察</div>';
    // 真实 vs 感知
    body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';
    body += '<div style="padding:10px;background:var(--bg-2);border-radius:4px;"><div style="font-size:0.74rem;color:#d4be7a;">真值</div><div style="font-size:1.4rem;color:var(--gold-300);">' + Math.round(hw.index) + '</div><div style="font-size:0.72rem;color:var(--ink-300);">' + (hw.phase||'normal') + '</div></div>';
    body += '<div style="padding:10px;background:var(--bg-2);border-radius:4px;"><div style="font-size:0.74rem;color:#d4be7a;">地方视值</div><div style="font-size:1.4rem;color:var(--celadon-300);">' + Math.round(hw.perceivedIndex || hw.index) + '</div><div style="font-size:0.72rem;color:var(--ink-300);">粉饰 ' + (Math.round((hw.perceivedIndex||hw.index)-hw.index)) + '</div></div>';
    body += '</div>';
    // 四维
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">四维分项</div>';
    if (hw.subDims) {
      body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;font-size:0.76rem;">';
      body += '<div style="padding:6px;background:var(--bg-2);">朝廷威 ' + Math.round(hw.subDims.court.value||0) + '</div>';
      body += '<div style="padding:6px;background:var(--bg-2);">藩屏威 ' + Math.round(hw.subDims.provincial.value||0) + '</div>';
      body += '<div style="padding:6px;background:var(--bg-2);">军威 ' + Math.round(hw.subDims.military.value||0) + '</div>';
      body += '<div style="padding:6px;background:var(--bg-2);">外威 ' + Math.round(hw.subDims.foreign.value||0) + '</div>';
      body += '</div>';
    }
    // 14 源近状
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">累积源（近回合）</div>';
    body += '<div style="font-size:0.7rem;background:var(--bg-2);padding:6px;border-radius:3px;max-height:100px;overflow-y:auto;">';
    Object.keys(hw.sources || {}).forEach(function(k) {
      if (hw.sources[k] > 0.5) body += '<span style="color:var(--celadon-300);margin-right:8px;">+' + k + ':' + hw.sources[k].toFixed(1) + '</span>';
    });
    Object.keys(hw.drains || {}).forEach(function(k) {
      if (hw.drains[k] > 0.5) body += '<span style="color:var(--vermillion-300);margin-right:8px;">-' + k + ':' + hw.drains[k].toFixed(1) + '</span>';
    });
    body += '</div>';
    // 暴君 / 失威
    if (hw.tyrantSyndrome && hw.tyrantSyndrome.active) {
      body += '<div style="margin-top:10px;padding:8px;background:rgba(192,64,48,0.15);border-left:3px solid var(--vermillion-400);font-size:0.76rem;">';
      body += '<b>暴君综合症活跃</b><br>颂圣奏疏 ' + (((hw.tyrantSyndrome.flatteryMemorialRatio||0)*100).toFixed(0)) + '%<br>';
      body += '隐伤：民心漏 ' + (hw.tyrantSyndrome.hiddenDamage && hw.tyrantSyndrome.hiddenDamage.unreportedMinxinDrop || 0).toFixed(1);
      body += '<br>腐败掩 ' + (hw.tyrantSyndrome.hiddenDamage && hw.tyrantSyndrome.hiddenDamage.concealedCorruption || 0).toFixed(1);
      body += '</div>';
    }
    if (hw.lostAuthorityCrisis && hw.lostAuthorityCrisis.active) {
      body += '<div style="margin-top:10px;padding:8px;background:rgba(140,40,30,0.15);border-left:3px solid var(--vermillion-500);font-size:0.76rem;">';
      body += '<b>失威危机活跃</b><br>抗疏倍频 ' + (hw.lostAuthorityCrisis.objectionFrequency||1).toFixed(1) + 'x<br>';
      body += '外邦蠢动 ' + ((hw.lostAuthorityCrisis.foreignEmboldened||0)*100).toFixed(0) + '%';
      body += '</div>';
    }
    body += '</div>';
    _showGModal(body, '天威之察');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  乾纲之察 UI
  // ═══════════════════════════════════════════════════════════════════

  function openQianGangInspection() {
    var G = global.GM;
    if (!G.huangquan) { if (global.toast) global.toast('皇权未初始化'); return; }
    var hq = G.huangquan;
    var body = '<div style="max-width:700px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">乾纲之察</div>';
    body += '<div style="padding:10px;background:var(--bg-2);border-radius:4px;margin-bottom:10px;">';
    body += '<div style="font-size:0.76rem;color:#d4be7a;">皇权指数</div>';
    body += '<div style="font-size:1.6rem;color:var(--gold-300);">' + Math.round(hq.index) + '</div>';
    var hqPhase = hq.index >= 70 ? '专制' : hq.index >= 35 ? '制衡' : '权臣';
    body += '<div style="font-size:0.82rem;color:var(--celadon-300);">' + hqPhase + '段</div>';
    body += '</div>';
    // 四维
    if (hq.subDims) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">四维</div>';
      body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.76rem;margin-bottom:10px;">';
      body += '<div style="padding:6px;background:var(--bg-2);">中央 ' + Math.round(hq.subDims.central.value||0) + '</div>';
      body += '<div style="padding:6px;background:var(--bg-2);">地方 ' + Math.round(hq.subDims.provincial.value||0) + '</div>';
      body += '<div style="padding:6px;background:var(--bg-2);">军权 ' + Math.round(hq.subDims.military.value||0) + '</div>';
      body += '<div style="padding:6px;background:var(--bg-2);">内廷 ' + Math.round(hq.subDims.imperial.value||0) + '</div>';
      body += '</div>';
    }
    // 权臣
    if (hq.powerMinister) {
      var pm = hq.powerMinister;
      body += '<div style="padding:10px;background:rgba(192,64,48,0.1);border-left:3px solid var(--vermillion-400);font-size:0.76rem;margin-bottom:10px;">';
      body += '<b>权臣：' + pm.name + '</b><br>控制力 ' + ((pm.controlLevel||0)*100).toFixed(0) + '%<br>';
      body += '党羽 ' + (pm.faction||[]).length + ' 人 · 拦截 ' + (pm.interceptions||0) + ' 次 · 自拟 ' + (pm.counterEdicts||0) + ' 次';
      body += '</div>';
    }
    // 执行度
    body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">诏令执行度</div>';
    body += '<div style="padding:6px;background:var(--bg-2);font-size:0.76rem;">';
    body += '基础 ' + ((hq.executionRate || 0.75) * 100).toFixed(0) + '%';
    if (G.huangwei && G.huangwei.phase) {
      var hwMult = ({tyrant:1.3, majesty:1.0, normal:0.85, decline:0.65, lost:0.35})[G.huangwei.phase] || 1.0;
      body += ' × 皇威 ' + hwMult;
    }
    body += '</div>';
    body += '</div>';
    _showGModal(body, '乾纲之察');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心之察 UI
  // ═══════════════════════════════════════════════════════════════════

  function openMinxinInspection() {
    var G = global.GM;
    if (!G.minxin) { if (global.toast) global.toast('民心未初始化'); return; }
    var mx = G.minxin;
    var body = '<div style="max-width:760px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">民心之察</div>';
    body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';
    body += '<div style="padding:10px;background:var(--bg-2);"><div style="font-size:0.74rem;color:#d4be7a;">真实</div><div style="font-size:1.4rem;color:var(--gold-300);">' + Math.round(mx.trueIndex) + '</div><div style="font-size:0.72rem;">' + (mx.phase||'peaceful') + '</div></div>';
    body += '<div style="padding:10px;background:var(--bg-2);"><div style="font-size:0.74rem;color:#d4be7a;">感知</div><div style="font-size:1.4rem;color:var(--celadon-300);">' + Math.round(mx.perceivedIndex || mx.trueIndex) + '</div></div>';
    body += '</div>';
    // byClass 表格
    if (mx.byClass && Object.keys(mx.byClass).length > 0) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">分阶层</div>';
      body += '<div style="max-height:200px;overflow-y:auto;background:var(--bg-2);padding:6px;border-radius:3px;font-size:0.72rem;">';
      Object.keys(mx.byClass).forEach(function(cl) {
        var cv = mx.byClass[cl];
        var color = cv.index >= 60 ? 'var(--celadon-300)' : cv.index >= 40 ? 'var(--gold-400)' : 'var(--vermillion-400)';
        body += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>' + cl + '</span><span style="color:' + color + ';">' + Math.round(cv.index) + '</span></div>';
      });
      body += '</div>';
    }
    // 民变
    if (mx.revolts && mx.revolts.length > 0) {
      var ongoing = mx.revolts.filter(function(r){return r.status==='ongoing';});
      if (ongoing.length > 0) {
        body += '<div style="font-size:0.82rem;color:var(--vermillion-400);margin:10px 0 4px;">民变 ' + ongoing.length + ' 起</div>';
        ongoing.forEach(function(r) {
          body += '<div style="font-size:0.72rem;background:rgba(192,64,48,0.1);padding:4px 8px;margin:2px 0;">';
          body += (r.region||'某地') + ' · L' + r.level + ' · ' + (r.cause||'？');   // 只看：剿、抚、赈从诏令进（同志 11-15）
          body += '</div>';
        });
      }
    }
    // 天象/祥瑞/谶纬
    var signs = G.heavenSigns || [];
    var proph = (mx.prophecy && mx.prophecy.pendingTriggers) || [];
    if (signs.length > 0 || proph.length > 0) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:10px 0 4px;">异象</div>';
      body += '<div style="font-size:0.72rem;background:var(--bg-2);padding:6px;">';
      signs.slice(-5).forEach(function(s) {
        body += '<div>' + (s.type==='good'?'🌟':'⚠')+' ' + s.name + '（' + s.turn + '）</div>';
      });
      proph.slice(-3).forEach(function(p) {
        body += '<div>📜 ' + p.text + '</div>';
      });
      body += '</div>';
    }
    body += '</div>';
    _showGModal(body, '民心之察');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  吏治之察 UI
  // ═══════════════════════════════════════════════════════════════════

  function openLizhiInspection() {
    var G = global.GM;
    if (!G.corruption) { if (global.toast) global.toast('腐败未初始化'); return; }
    var corr = G.corruption;
    var body = '<div style="max-width:720px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">吏治之察</div>';
    var overall = (typeof corr === 'object') ? (typeof corr.trueIndex === 'number' ? corr.trueIndex : (typeof corr.overall === 'number' ? corr.overall : 0)) : corr;
    body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';
    body += '<div style="padding:10px;background:var(--bg-2);"><div style="font-size:0.74rem;">真值</div><div style="font-size:1.4rem;color:var(--vermillion-300);">' + Math.round(overall) + '</div></div>';
    body += '<div style="padding:10px;background:var(--bg-2);"><div style="font-size:0.74rem;">感知</div><div style="font-size:1.4rem;color:var(--gold-300);">' + Math.round(corr.perceived || overall) + '</div></div>';
    body += '</div>';
    // 6 部门
    if (corr.byDept || corr.subDepts) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">六部门</div>';
      body += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:0.72rem;margin-bottom:10px;">';
      ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
        var v = corr.byDept && corr.byDept[d];
        if (v === undefined && corr.subDepts && corr.subDepts[d]) v = corr.subDepts[d].true;
        if (v !== undefined) {
          var c = v >= 60 ? 'var(--vermillion-400)' : v >= 40 ? 'var(--gold-400)' : 'var(--celadon-300)';
          body += '<div style="padding:6px;background:var(--bg-2);color:' + c + ';">' + d + ' ' + Math.round(v) + '</div>';
        }
      });
      body += '</div>';
    }
    // 9 源
    if (corr.sources) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin-bottom:4px;">九源</div>';
      body += '<div style="font-size:0.72rem;background:var(--bg-2);padding:6px;max-height:140px;overflow-y:auto;">';
      Object.keys(corr.sources).forEach(function(k) {
        var v = corr.sources[k];
        if (v > 0.5) body += '<div>' + k + '：' + v.toFixed(1) + '</div>';
      });
      body += '</div>';
    }
    // 监察
    if (G.auditSystem) {
      body += '<div style="font-size:0.82rem;color:var(--gold-400);margin:10px 0 4px;">监察</div>';
      body += '<div style="font-size:0.72rem;background:var(--bg-2);padding:6px;">';
      body += '御史可用 ' + (G.auditSystem.inspectorsAvailable||0) + ' / ' + '强度 ' + ((G.auditSystem.strength||0)*100).toFixed(0) + '%';
      body += ' · 查 ' + (G.auditSystem.totalAuditsCompleted||0) + ' 次 · 曝光 ' + (G.auditSystem.totalFraudExposed||0);
      body += '<br><button class="btn" style="font-size:0.71rem;padding:3px 8px;margin-top:4px;" onclick="prompt(\'派往哪个区域 ID？\',\'default\')&&PhaseA.dispatchAudit(prompt.value||\'default\',\'normal\')">派御史</button>';
      body += '</div>';
    }
    body += '</div>';
    _showGModal(body, '吏治之察');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  天下热力图
  // ═══════════════════════════════════════════════════════════════════

  function openMinxinHeatmap() {
    var G = global.GM;
    if (!G.minxin || !G.minxin.byRegion) { if (global.toast) global.toast('无分区民心'); return; }
    var body = '<div style="max-width:760px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.6rem;">天下民情图</div>';
    body += '<div style="font-size:0.74rem;color:#d4be7a;margin-bottom:6px;">按民心 5 级着色</div>';
    body += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px;">';
    Object.keys(G.minxin.byRegion).forEach(function(rid) {
      var r = G.minxin.byRegion[rid];
      var v = r.index || 60;
      var color = v >= 80 ? 'var(--celadon-500)' : v >= 60 ? 'var(--celadon-300)' : v >= 40 ? 'var(--gold-400)' : v >= 20 ? 'var(--vermillion-400)' : 'var(--vermillion-500)';
      body += '<div style="padding:6px 8px;background:' + color + ';border-radius:3px;font-size:0.72rem;color:#fff;">';
      body += rid + '<br>' + Math.round(v);
      body += '</div>';
    });
    body += '</div>';
    body += '</div>';
    _showGModal(body, '天下热力图');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  辅助
  // ═══════════════════════════════════════════════════════════════════

  function _showGModal(bodyHtml, title) {
    var ov = document.createElement('div');
    ov.className = '_g_modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:19040;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.0rem;width:92%;max-width:780px;max-height:88vh;overflow-y:auto;">' + bodyHtml + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  function tick(){}
  function init(){}

  global.PhaseG1 = {
    init: init,
    tick: tick,
    applyDynastyPreset: applyDynastyPreset,
    openTianweiInspection: openTianweiInspection,
    openQianGangInspection: openQianGangInspection,
    openMinxinInspection: openMinxinInspection,
    openLizhiInspection: openLizhiInspection,
    openMinxinHeatmap: openMinxinHeatmap,
    DYNASTY_AUTHORITY_PRESETS: DYNASTY_AUTHORITY_PRESETS,
    HISTORICAL_CASES: HISTORICAL_CASES,
    VERSION: 1
  };

  global.openTianweiInspection = openTianweiInspection;
  global.openQianGangInspection = openQianGangInspection;
  global.openMinxinInspection = openMinxinInspection;
  global.openLizhiInspection = openLizhiInspection;
  global.openMinxinHeatmap = openMinxinHeatmap;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
