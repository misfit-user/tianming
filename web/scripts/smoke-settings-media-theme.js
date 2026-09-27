// smoke-settings-media-theme.js - guard Esc settings migration for audio/theme UI.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const patches = (fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8'));
const themeFont = fs.readFileSync(path.join(ROOT, 'tm-theme-font.js'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

assert(/_renderSettingsAudioSection/.test(patches), 'settings audio section helper missing');
assert(/_renderSettingsThemeFontSection/.test(patches), 'settings theme/font section helper missing');
assert(/<h4>声乐<\/h4>/.test(patches) || /\\u58F0\\u4E50/.test(patches), 'settings page should expose 声乐 section');
assert(/<h4>主题字号<\/h4>/.test(patches) || /\\u4E3B\\u9898\\u5B57\\u53F7/.test(patches), 'settings page should expose 主题字号 section');
assert(/_renderSettingsAudioSection\(\)\+/.test(patches), 'settings page should mount 声乐 section');
assert(/_renderSettingsThemeFontSection\(\)\+/.test(patches), 'settings page should mount 主题字号 section');
assert(/AudioSystem\.(setBgmVolume|setSfxVolume|playTrack|setLoopMode|ensureBgmPlaying)/.test(patches), '声乐 section should use AudioSystem controls');
assert(/TMThemeFont\.renderControls/.test(patches), '主题字号 section should use shared renderer');
assert(/ThemeSystem\.setTheme/.test(themeFont), '主题字号 module should keep legacy ThemeSystem bridge');
assert(/_settingsSizeApply/.test(patches) && /_tmApplySize/.test(patches), '主题字号 section should expose left-drawer font-size controls');
assert(/_tmApplyBodyFont|_tmApplyTitleFont/.test(themeFont), '主题字号 module should bridge existing left-drawer font controls');
assert(/_tmApplyScopeSize/.test(themeFont) && /tm\.fontSizeScopes/.test(themeFont), '主题字号 module should expose per-section font size controls');
assert(/TM-ZCOOL-XiaoWei/.test(styles) && /@font-face/.test(styles), 'embedded font-face declarations missing');
assert(/_settingsMediaThemeInit/.test(patches), 'settings media/theme init hook missing');
assert(/_settingsBuildTabs/.test(patches), 'settings tab builder missing');
assert(/_settingsSwitchTab/.test(patches), 'settings tab switcher missing');
assert(/settings-tab-shell/.test(styles) && /settings-pane\.active/.test(styles), 'settings tab CSS missing');
assert(/styles\.css\?v=[^"'<\s]+/.test(index), 'index.html should bust settings CSS cache');  // 验有 cache-bust(?v=)·不钉死具体版本串(随 styles.css 改动 bump·原钉 20260520 已过时)
assert(/tm-theme-font\.js\?v=[^"'<\s]+/.test(index), 'index.html should load theme/font module (cache-busted)');  // 同上·验加载+有 ?v=·不钉死版本
assert(/tm-patches\.js\?v=[^"'<\s]+/.test(index), 'index.html should bust settings JS cache');
assert(/REMOTE_CHANGELOG_URL/.test(fs.readFileSync(path.join(ROOT, 'tm-changelog.js'), 'utf8')), 'remote changelog source missing');
assert(/tm-changelog\.js\?v=[A-Za-z0-9_.-]+/.test(index), 'index.html should bust changelog JS cache');

console.log('[smoke-settings-media-theme] PASS settings media/theme sections present');
