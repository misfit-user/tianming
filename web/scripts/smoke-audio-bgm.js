// smoke-audio-bgm.js - guard configurable background music wiring.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assetExists = relative => require('./lib-smoke-evidence').assetExists('smoke-audio-bgm.js', relative);

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

const played = [];
const created = [];
const hooks = {};
const storage = new Map();

function FakeAudio(src) {
  this.src = src;
  this.volume = 1;
  this.loop = false;
  this.preload = '';
  this.paused = true;
  this.onerror = null;
  this.onended = null;
  created.push(this);
  this.play = () => {
    this.paused = false;
    played.push({ src: this.src, volume: this.volume, loop: this.loop });
    return Promise.resolve();
  };
  this.pause = () => { this.paused = true; };
}

const context = {
  console,
  window: {},
  document: {
    body: { appendChild() {}, insertAdjacentHTML() {} },
    createElement() { return { style: {}, setAttribute() {}, appendChild() {}, remove() {} }; },
    getElementById() { return null; },
    querySelector() { return null; },
    head: { appendChild() {} },
    documentElement: { style: { setProperty() {} }, removeAttribute() {}, setAttribute() {} }
  },
  localStorage: {
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); },
    removeItem(k) { storage.delete(k); }
  },
  Audio: FakeAudio,
  GameHooks: {
    on(name, fn) {
      if (!hooks[name]) hooks[name] = [];
      hooks[name].push(fn);
    },
    run(name) {
      (hooks[name] || []).forEach(fn => fn());
    }
  },
  _$() { return null; },
  _dbg() {},
  toast() {},
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout() {}
};
context.window = context;

vm.createContext(context);

vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-bgm-config.js'), 'utf8'), context, { filename: 'tm-bgm-config.js' });

assert(Array.isArray(context.TM_BGM_TRACKS), 'TM_BGM_TRACKS should be an array');
assert(context.TM_BGM_TRACKS.length === 4, 'TM_BGM_TRACKS should include the four bundled themes');
assert(context.TM_BGM_PLAYLIST_VERSION === 'theme-quartet-20260513', 'BGM playlist version should be pinned for migration');
assert(context.TM_BGM_DEFAULT_LOOP === 'sequence', 'default loop mode should cycle through the theme playlist');
assert(context.TM_MENU_BGM && context.TM_MENU_BGM.src, 'TM_MENU_BGM should define the launch/menu track');
assert(context.TM_MENU_BGM.id === 'tianming-hegui', 'TM_MENU_BGM should use the dedicated launch song');
assert(assetExists(context.TM_MENU_BGM.src), 'menu BGM file missing: ' + context.TM_MENU_BGM.src);
context.TM_BGM_TRACKS.forEach(track => {
  assert(track.id && track.title && track.src, 'each BGM track should have id, title and src');
  assert(assetExists(track.src), 'BGM file missing: ' + track.src);
});

const audioThemeSource = fs.readFileSync(path.join(ROOT, 'tm-audio-theme.js'), 'utf8');
vm.runInContext(audioThemeSource, context, { filename: 'tm-audio-theme.js' });

assert(context.AudioSystem, 'AudioSystem missing');
assert(typeof context.AudioSystem.playDefaultBgm === 'function', 'playDefaultBgm missing');
assert(typeof context.AudioSystem.playMenuBgm === 'function', 'playMenuBgm missing');
assert(typeof context.AudioSystem.autoEnsureBgmPlaying === 'function', 'autoEnsureBgmPlaying missing');
assert(typeof context.AudioSystem.renderShellPanelHtml === 'function', 'renderShellPanelHtml missing');
assert(audioThemeSource.includes('bgmFailureCooldownMs: 3 * 60 * 1000'), 'BGM load failure cooldown should be 3 minutes');

storage.set('tianming_audio_settings', JSON.stringify({
  sfxVolume: 0.5,
  bgmVolume: 0.3,
  enabled: true,
  bgmEnabled: true,
  currentTrackId: 'old-track',
  loopMode: 'single',
  bgmPlaylistVersion: 'old-playlist'
}));

context.AudioSystem.init();
context.AudioSystem.playMenuBgm();
assert(played.length === 1, 'menu BGM should play once before entering game');
assert(played[0].src === context.TM_MENU_BGM.src, 'menu BGM should use dedicated launch track');
assert(played[0].loop === true, 'menu BGM should loop while outside gameplay');
assert(context.AudioSystem.bgmScope === 'menu', 'menu BGM should mark audio scope as menu');

context.GameHooks.run('enterGame:after');
assert(context.AudioSystem.loopMode === 'sequence', 'AudioSystem should migrate stale playlist settings to sequence loop mode');
assert(context.AudioSystem.currentTrackId === context.TM_BGM_TRACKS[0].id, 'AudioSystem should reset stale current track to first bundled theme');

assert(played.length === 2, 'enterGame should replace menu BGM with game playlist BGM');
assert(played[1].src === context.TM_BGM_TRACKS[0].src, 'default game BGM should use first configured track');
assert(played[1].loop === false, 'sequence mode should advance tracks instead of looping one audio element');
assert(context.AudioSystem.bgmScope === 'game', 'enterGame should mark audio scope as game');
assert(Math.abs(played[0].volume - context.AudioSystem.bgmVolume) < 0.001, 'BGM volume should sync to audio element');
assert(created[0].preload === 'none', 'BGM should avoid eager loading before play');
assert(typeof created[0].onerror === 'function', 'BGM should install load error handler');
created[1].onerror();
context.AudioSystem.playDefaultBgm();
assert(played.length === 2, 'recently failed game BGM track should be cooled down instead of retried');
assert(context.AudioSystem.bgmFailureCooldownMs === 180000, 'BGM failure cooldown should be exactly 3 minutes');
assert(JSON.parse(storage.get('tianming_audio_settings')).bgmPlaylistVersion === context.TM_BGM_PLAYLIST_VERSION, 'saved settings should include current playlist version');

const html = context.AudioSystem.renderShellPanelHtml();
assert(html.includes(context.TM_BGM_TRACKS[0].title), 'shell panel should render configured track title');
assert(!html.includes(context.TM_MENU_BGM.title), 'menu BGM should not appear in playable in-game track list');
assert(/data-track-id=/.test(html), 'shell panel should include playable track ids');

console.log('[smoke-audio-bgm] PASS tracks=' + context.TM_BGM_TRACKS.length + ' played=' + played.length);
