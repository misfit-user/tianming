// 新前端自己的设置（画质分档、记数写法、动效、音量等）。游戏本身的设置（AI、存档等）仍归内核，经适配层读写。
// 存在 localStorage 的 tm_ui_settings 一项里；读写失败（隐私模式、配额满）就只在内存里生效。
import { bus } from './bus.js';
import { setNumeralStyle } from './numerals.js';

const KEY = 'tm_ui_settings';
const DEFAULTS = {
  quality: 'auto',        // auto | high | medium | low
  numerals: 'cn',         // cn 汉字记数 | arabic 阿拉伯数字
  motion: 'full',         // full | less（少动效：只留淡入淡出）
  textSize: 'std',        // std 标准 | large 大 | xlarge 特大（正文四阶字号的倍数，见 kit/tokens.css --fs-k）
  home: 'desk',           // desk 御案为家 | map 舆图为家（舆图铺满为主画面，御案只在案上之事时升起，见 docs/newui-foundation-20261005/universal-view.md）
  musicVolume: 0.6,
  soundVolume: 0.8
};

const TEXT_K = { std: 1, large: 1.12, xlarge: 1.25 };

let values = { ...DEFAULTS };

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (_e) {
    raw = null;
  }
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    for (const k of Object.keys(DEFAULTS)) if (k in saved) values[k] = saved[k];
  } catch (_e) {
    values = { ...DEFAULTS };
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(values));
  } catch (_e) {
    // 存不下也照样生效，只是下次启动回到默认
  }
}

function applySideEffects() {
  setNumeralStyle(values.numerals);
  const reduce = values.motion === 'less' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.dataset.motion = reduce ? 'less' : 'full';
  document.documentElement.style.setProperty('--fs-k', String(TEXT_K[values.textSize] || 1));
}

export function installSettings() {
  load();
  applySideEffects();
  return { ...values };
}

export function getSetting(key) {
  return values[key];
}

export function setSetting(key, value) {
  if (!(key in DEFAULTS) || values[key] === value) return;
  values[key] = value;
  save();
  applySideEffects();
  bus.emit('settings:changed', { key, value });
}

export function allSettings() {
  return { ...values };
}
