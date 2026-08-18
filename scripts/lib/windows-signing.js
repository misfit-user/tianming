'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function requirePublisher(env = process.env) {
  const publisher = String(env.TIANMING_WINDOWS_PUBLISHER || '').trim();
  if (!publisher || !/(?:^|,)\s*CN=/i.test(publisher)) {
    throw new Error('Windows 发布必须设置 TIANMING_WINDOWS_PUBLISHER 为签名证书的完整 Subject（至少包含 CN=）。');
  }
  return publisher;
}

function signingIdentity(env = process.env) {
  const link = String(env.WIN_CSC_LINK || env.CSC_LINK || '').trim();
  const sha1 = String(env.TIANMING_WINDOWS_CERTIFICATE_SHA1 || '').trim();
  const subject = String(env.TIANMING_WINDOWS_CERTIFICATE_SUBJECT || '').trim();
  if (link) return { kind: 'link', value: link };
  if (/^[0-9a-f]{40}$/i.test(sha1)) return { kind: 'sha1', value: sha1 };
  if (subject) return { kind: 'subject', value: subject };
  throw new Error('Windows 发布缺少签名身份：设置 WIN_CSC_LINK/CSC_LINK，或显式证书 SHA1/Subject。');
}

function windowsBuildOverrides(pkg, env = process.env) {
  const publisher = requirePublisher(env);
  const identity = signingIdentity(env);
  const configured = Object.assign({}, pkg.build && pkg.build.win, {
    forceCodeSigning: true,
    signAndEditExecutable: true,
    verifyUpdateCodeSignature: true,
    publisherName: [publisher]
  });
  if (identity.kind === 'sha1' || identity.kind === 'subject') {
    configured.signtoolOptions = Object.assign({}, configured.signtoolOptions);
    if (identity.kind === 'sha1') configured.signtoolOptions.certificateSha1 = identity.value;
    else configured.signtoolOptions.certificateSubjectName = identity.value;
  }
  return { publisher, win: configured };
}

function platformBuildConfig(pkg, platform, env = process.env) {
  const version = String(pkg.build && pkg.build.buildVersion || '').trim();
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) throw new Error('package buildVersion 不是四段版本号');
  if (platform === 'win') {
    const signed = windowsBuildOverrides(pkg, env);
    return {
      publisher: signed.publisher,
      config: {
        directories: { output: pkg.build.directories.output },
        win: signed.win
      }
    };
  }
  if (platform !== 'mac' && platform !== 'linux') throw new Error('未知构建平台: ' + platform);
  return {
    publisher: '',
    config: { directories: { output: 'dist/' + platform + '/测试版' + version } }
  };
}

function verifyAuthenticode(file, expectedPublisher) {
  const target = path.resolve(file);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error('待验签 Windows 制品不存在: ' + target);
  if (process.platform !== 'win32') throw new Error('Authenticode 最终验签必须在 Windows 上执行');
  const script = [
    "$ErrorActionPreference='Stop'",
    '$target=$args[0]',
    '$expected=$args[1]',
    '$sig=Get-AuthenticodeSignature -LiteralPath $target',
    "if($sig.Status -ne [System.Management.Automation.SignatureStatus]::Valid){throw ('Authenticode 状态不是 Valid: '+$sig.Status+' '+$sig.StatusMessage)}",
    "if(-not $sig.SignerCertificate){throw '缺少 Authenticode 签名证书'}",
    "if($sig.SignerCertificate.Subject -cne $expected){throw ('发布者不匹配: '+$sig.SignerCertificate.Subject+' != '+$expected)}",
    "if(-not $sig.TimeStamperCertificate){throw 'Authenticode 缺少可信时间戳证书'}",
    "[pscustomobject]@{status=[string]$sig.Status;subject=$sig.SignerCertificate.Subject;thumbprint=$sig.SignerCertificate.Thumbprint;timestampSubject=$sig.TimeStamperCertificate.Subject}|ConvertTo-Json -Compress"
  ].join(';');
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script, target, expectedPublisher], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error('Windows 制品签名验证失败·' + target + '\n' + String(result.stderr || result.stdout || '').trim());
  }
  let info;
  try { info = JSON.parse(String(result.stdout || '').trim()); }
  catch (_) { throw new Error('Windows 签名验证输出不可解析·' + target); }
  return info;
}

function verifyWindowsArtifacts(files, expectedPublisher) {
  const executables = Array.from(new Set((files || []).map(file => path.resolve(file)).filter(file => /\.exe$/i.test(file) && fs.existsSync(file))));
  if (!executables.length) throw new Error('Windows 构建未产生可验签的 .exe 制品');
  return executables.map(file => ({ file, signature: verifyAuthenticode(file, expectedPublisher) }));
}

module.exports = {
  requirePublisher,
  signingIdentity,
  windowsBuildOverrides,
  platformBuildConfig,
  verifyAuthenticode,
  verifyWindowsArtifacts
};
