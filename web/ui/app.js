// 应用壳：载入（先在显卡上算舆图地形场，再起书房、舆图）→ 启幕 → 開卷／續卷 → 书案 ⇄ 舆图。
// 舞台唯一；屏与屏之间只切 DOM 层与镜头。数据与动作一律经 game（适配层）。
import { h } from './core/dom.js';
import { resolveQuality } from './core/quality.js';
import { game } from './adapter/game.js';
import { createStage } from './scene/stage.js';
import { createStudyView } from './scene/study/index.js';
import { createMapView, terrainFields } from './scene/map/index.js';
import { LOOK_QINGLV_AGED } from './scene/map/looks.js';
import { loadingScreen } from './screens/loading.js';
import { installToasts } from './screens/toast.js';
import { createTitle } from './screens/title.js';
import { createDesk } from './screens/desk.js';
import { installNotices } from './screens/notices.js';

// 案头花笺（启幕时案上那三张）：开局后换成真时政
const NOTES = [['陕西大饥', ['延庆诸府赤地千里', '斗米值银七钱', '饥民聚众于渭北']], ['太仓告匮', ['九边欠饷九十余日', '太仓仅存八十万', '户部请发内帑']], ['辽东空悬', ['督师缺员已两月', '关宁兵饷俱匮', '请速简大臣']]];

export async function startApp(root) {
  const params = new URLSearchParams(location.search);
  const q = resolveQuality();
  const load = loadingScreen(root);
  load.set('启 卷', 0.03);
  const kernel = game.boot();

  // 舞台先冻着：地形场要独占显卡算（与书房抢显卡要慢三倍）
  const stageHost = h('div.stage-host');
  const labels = h('div.map-labels');
  const clouds = [h('div.dive-cloud.a'), h('div.dive-cloud.b')];
  root.append(stageHost, labels, ...clouds, h('div.stage-vignette'));
  const stage = createStage(stageHost, { preserve: params.has('shot') });
  stage.freeze();
  installToasts(root, game);

  load.set('研 墨', 0.1);
  load.sub('舆图山川');
  await terrainFields(stage.renderer, { hiRes: q.mapHiRes });
  load.set('张 灯', 0.35);
  const study = stage.add(await createStudyView(stage, {
    shot: 'title', notes: NOTES,
    onProgress: (s, k) => { load.sub(s); load.set('张 灯', 0.35 + k * 0.35); }
  }));
  load.set('展 图', 0.75);
  load.sub('舆图');
  const map = stage.add(await createMapView(stage, { labelLayer: labels, fov: 30 }));
  map.setActive(false);
  study.setMapSheet(await map.renderSheet({ look: LOOK_QINGLV_AGED, names: false }));
  load.set('候 驾', 0.92);
  load.sub('诸司');
  await kernel;
  stage.show('study');
  stage.thaw();
  await stage.nextFrames(4);
  load.set('就 绪', 1);
  load.sub('');

  // 开发用「借视角」：?as=人名，以此人的身份看书案（只换界面所见，内核照旧；见 ui/model/identity.js）
  const as = params.get('as');
  if (as) game.on('game:entered', () => game.setViewAs(as));
  const desk = createDesk({ root, stage, study, map, game, labels, clouds });
  installNotices({ game, profile: () => desk.profile });
  const title = createTitle({
    root, stage, study, game,
    onEnter: async () => { title.hide(); await desk.show(); }
  });
  await load.done();
  await title.show();
  window.__newui = { stage, study, map, game, title, desk };
  document.body.dataset.ready = '1';
}
