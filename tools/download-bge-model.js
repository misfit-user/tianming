#!/usr/bin/env node
/**
 * 下载 bge-small-zh-v1.5 模型到 vendor/models/·供 Electron 端预打包
 *
 * 用法（在 web/ 目录执行）：
 *   node tools/download-bge-model.js          # 默认走 hf-mirror（中国可用）
 *   node tools/download-bge-model.js --hf     # 强制走 huggingface.co
 *   node tools/download-bge-model.js --quiet  # 静默模式
 *
 * 输出：vendor/models/Xenova/bge-small-zh-v1.5/
 *   ├── onnx/model_quantized.onnx  (~23 MB)
 *   ├── tokenizer.json
 *   ├── tokenizer_config.json
 *   ├── config.json
 *   ├── special_tokens_map.json
 *   └── vocab.txt
 *
 * 总计 ~23 MB·下载时间通常 30-60 秒（量化版极小）。
 *
 * 推荐执行时机：
 *   · Electron 打包前·确保 vendor/models 进入 asar
 *   · package.json 加 "prepare-vendor": "node tools/download-bge-model.js"
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const args = process.argv.slice(2);
const useHF = args.includes('--hf');
const quiet = args.includes('--quiet');

const HOST = useHF ? 'https://huggingface.co' : 'https://hf-mirror.com';
const MODEL = 'Xenova/bge-small-zh-v1.5';
const REVISION = 'main';
const FILES = [
  'onnx/model_quantized.onnx',
  'tokenizer.json',
  'tokenizer_config.json',
  'config.json',
  'special_tokens_map.json',
  'vocab.txt'
];

const VENDOR_ROOT = path.join(__dirname, '..', 'vendor', 'models', MODEL);

function log(...a) { if (!quiet) console.log(...a); }

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function download(urlStr, destPath, fileLabel) {
  return new Promise(function(resolve, reject) {
    var totalBytes = 0;
    var receivedBytes = 0;
    var lastReportPct = -1;

    function fetchOnce(url, redirCount) {
      if (redirCount > 5) return reject(new Error('redirect 过多: ' + url));
      var req = https.get(url, { headers: { 'User-Agent': 'tianming/prepare-vendor' } }, function(res) {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          var loc = res.headers.location;
          if (!loc) return reject(new Error('redirect 无 location: ' + res.statusCode));
          if (loc.indexOf('http') !== 0) loc = HOST + loc;
          return fetchOnce(loc, redirCount + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
        }
        totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        ensureDir(path.dirname(destPath));
        var ws = fs.createWriteStream(destPath);
        res.on('data', function(chunk) {
          receivedBytes += chunk.length;
          if (totalBytes > 0) {
            var pct = Math.floor(receivedBytes / totalBytes * 100);
            if (pct !== lastReportPct && pct % 10 === 0) {
              log('  [' + fileLabel + '] ' + pct + '%·' + (receivedBytes / 1024 / 1024).toFixed(1) + ' / ' + (totalBytes / 1024 / 1024).toFixed(1) + ' MB');
              lastReportPct = pct;
            }
          }
        });
        res.pipe(ws);
        ws.on('finish', function() {
          ws.close(function() {
            log('  [' + fileLabel + '] ✓ ' + (receivedBytes / 1024 / 1024).toFixed(1) + ' MB → ' + destPath);
            resolve();
          });
        });
        ws.on('error', function(err) { reject(err); });
      });
      req.on('error', function(err) { reject(err); });
      req.setTimeout(120000, function() { req.destroy(new Error('timeout 120s')); });
    }

    fetchOnce(urlStr, 0);
  });
}

async function main() {
  log('天命 · bge-small-zh-v1.5 模型预下载');
  log('Mirror: ' + HOST);
  log('Target: ' + VENDOR_ROOT);
  log('');
  ensureDir(VENDOR_ROOT);

  for (var i = 0; i < FILES.length; i++) {
    var rel = FILES[i];
    var url = HOST + '/' + MODEL + '/resolve/' + REVISION + '/' + rel;
    var dest = path.join(VENDOR_ROOT, rel);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      log('  [' + rel + '] 已存在·跳过 (' + (fs.statSync(dest).size / 1024 / 1024).toFixed(1) + ' MB)');
      continue;
    }
    log('  [' + rel + '] 下载中...');
    try {
      await download(url, dest, rel);
    } catch(e) {
      console.error('  [' + rel + '] 失败:', e.message);
      // 若主 mirror 失败·尝试备用
      if (!useHF) {
        log('  [' + rel + '] hf-mirror 失败·重试 huggingface.co...');
        var altUrl = 'https://huggingface.co/' + MODEL + '/resolve/' + REVISION + '/' + rel;
        try {
          await download(altUrl, dest, rel);
        } catch(e2) {
          console.error('  [' + rel + '] 备用也失败:', e2.message);
          process.exit(1);
        }
      } else {
        process.exit(1);
      }
    }
  }

  log('');
  log('✓ 全部下载完成。');
  log('  目录: ' + VENDOR_ROOT);
  log('  文件数: ' + FILES.length);
  // 总体积
  var totalSize = 0;
  FILES.forEach(function(rel) {
    try { totalSize += fs.statSync(path.join(VENDOR_ROOT, rel)).size; } catch(_){}
  });
  log('  总计: ' + (totalSize / 1024 / 1024).toFixed(1) + ' MB');
  log('');
  log('Electron 打包前确保 vendor/models 包含在 asar 内·或电子构建配置 extraResources 引用。');
  log('运行时 transformers.js 会自动从 ./vendor/models/' + MODEL + '/ 加载（已在 tm-semantic-recall.js 配好）。');
}

main().catch(function(e) {
  console.error('FAIL:', e.message);
  process.exit(1);
});
