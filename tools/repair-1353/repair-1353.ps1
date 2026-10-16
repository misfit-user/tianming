param(
  [switch]$Rollback,
  [string]$UserDataRoot = '',
  [string]$AppAsarPath = ''
)
$ErrorActionPreference = 'Stop'
$Version = '1.3.5.3'
$PackageVersion = '1.3.503'
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PayloadRoot = Join-Path $PackageRoot 'payload'
$ManifestPath = Join-Path $PackageRoot 'payload-manifest.json'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $PackageRoot ("repair-$stamp.log")
# 文件清单、1.3.5.3 原文件哈希与上一版修复包写入过的哈希全部来自 payload-manifest.json
# （由 build-payload.js 生成），这里不再手抄；LoadManifestTables 在校验完清单后填这几张表。
# PatchAsar 只接受「1.3.5.3 原文件」或「上一版修复包写入的文件」，其它哈希一律拒绝，
# 所以这个工具不会把别的构建悄悄改掉。hotUpdate=false 的文件（main-impl.js）不在热更新目录里。
$KitVersion = 'v2.5 (2026-10-17)'
$files = @(); $hotFiles = @(); $asarFiles = @{}; $asarAccepted = @{}; $hotAccepted = @{}; $payloadSha = @{}
function LoadManifestTables($manifest) {
  $script:files = @(); $script:hotFiles = @(); $script:asarFiles = @{}; $script:asarAccepted = @{}; $script:hotAccepted = @{}; $script:payloadSha = @{}
  foreach($entry in @($manifest.files)) {
    $rel = [string]$entry.path
    $script:files += $rel
    $asarPath = "web/$rel"
    if ($entry.PSObject.Properties['asarPath'] -and $entry.asarPath) { $asarPath = [string]$entry.asarPath }
    $script:asarFiles[$asarPath] = $rel
    $accepted = @(([string]$entry.originalSha256).ToLowerInvariant())
    if ($entry.PSObject.Properties['priorSha256']) { foreach($h in @($entry.priorSha256)) { if ($h) { $accepted += ([string]$h).ToLowerInvariant() } } }
    $script:asarAccepted[$asarPath] = $accepted
    $script:hotAccepted[$rel] = $accepted
    $script:payloadSha[$rel] = ([string]$entry.sha256).ToLowerInvariant()
    $isHot = $true
    if ($entry.PSObject.Properties['hotUpdate']) { $isHot = [bool]$entry.hotUpdate }
    if ($isHot) { $script:hotFiles += $rel }
  }
}

function Log([string]$s) { $line = "[$(Get-Date -Format s)] $s"; Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8; Write-Host $line }
function Hash([string]$p) {
  # Use .NET directly: a double-clicked Windows PowerShell may not have the
  # Microsoft.PowerShell.Utility module on PSModulePath.
  $sha=[Security.Cryptography.SHA256]::Create(); $s=[IO.File]::OpenRead($p)
  try { $h=$sha.ComputeHash($s); return ([BitConverter]::ToString($h) -replace '-', '').ToLowerInvariant() }
  finally { $s.Dispose(); $sha.Dispose() }
}
function AtomicCopy([string]$src, [string]$dst) {
  $tmp = "$dst.tmp-$PID-$stamp"
  Copy-Item -LiteralPath $src -Destination $tmp -Force
  Move-Item -LiteralPath $tmp -Destination $dst -Force
}
function FindTargets() {
  $out = @()
  $bases = if ($UserDataRoot) { @($UserDataRoot) } else { @($env:APPDATA,$env:LOCALAPPDATA) }
  foreach($base in $bases) {
    if (-not (Test-Path -LiteralPath $base)) { continue }
    foreach($profile in Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue) {
      $candidate = Join-Path $profile.FullName ("content\hot-updates\versions\$Version")
      if ((Test-Path -LiteralPath (Join-Path $candidate 'index.html')) -and (Test-Path -LiteralPath $candidate)) { $out += (Resolve-Path -LiteralPath $candidate).Path }
    }
  }
  return @($out | Sort-Object -Unique)
}
function VerifyPayload() {
  if (-not (Test-Path -LiteralPath $ManifestPath)) { throw 'payload-manifest.json missing' }
  $manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach($entry in @($manifest.files)) {
    $p = Join-Path $PayloadRoot ([string]$entry.path)
    if (-not (Test-Path -LiteralPath $p)) { throw "payload file missing: $($entry.path)" }
    $got = Hash $p
    if ($got -ne ([string]$entry.sha256).ToLowerInvariant()) { throw "payload hash mismatch: $($entry.path)" }
  }
  return $manifest
}
function ActiveState([string]$target) {
  $hot = Split-Path -Parent (Split-Path -Parent $target)
  $statePath = Join-Path $hot 'hot-update-state.json'
  if (-not (Test-Path -LiteralPath $statePath)) { return $false }
  try { $s = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $false }
  return ([IO.Path]::GetFullPath([string]$s.currentDir) -eq [IO.Path]::GetFullPath($target) -and [string]$s.currentVersion -eq $Version -and $s.enabled -ne $false)
}
function RollbackTarget([string]$target) {
  $hot = Split-Path -Parent (Split-Path -Parent $target)
  $backupRoot = Join-Path $hot 'repair-backups'
  $candidates = @(Get-ChildItem -LiteralPath $backupRoot -Directory -Filter "$Version-*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending)
  # 优先选写完收据的完整备份；早期版本的备份没有收据时退回最新一份（2026-10-17·复审 F5）
  $latest = @($candidates | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'receipt.json') }) | Select-Object -First 1
  if (-not $latest) { $latest = $candidates | Select-Object -First 1 }
  if (-not $latest) { throw "no repair backup for $target" }
  foreach($rel in $hotFiles) {
    $src = Join-Path $latest.FullName $rel; $dst = Join-Path $target $rel
    if (Test-Path -LiteralPath $src) { AtomicCopy $src $dst }
  }
  Log "ROLLED BACK $target from $($latest.FullName)"
}

# Packaged Electron builds do not expose a Node runtime to a player.  This
# reader/writer handles the small asar pickle/header format directly with .NET
# streams, preserving every non-target byte and rebuilding offsets safely.
function ReadU32([byte[]]$b, [int]$o) {
  return [uint32]([int]$b[$o] -bor ([int]$b[$o+1] -shl 8) -bor ([int]$b[$o+2] -shl 16) -bor ([int]$b[$o+3] -shl 24))
}
function ReadExact([IO.FileStream]$s, [byte[]]$b, [int]$o, [int]$n) {
  $done = 0
  while ($done -lt $n) {
    $got = $s.Read($b, $o + $done, $n - $done)
    if ($got -le 0) { throw 'asar 文件提前结束' }
    $done += $got
  }
}
function ReadAsarHeader([string]$path) {
  $s = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  try {
    $sizeBuf = New-Object byte[] 8; ReadExact $s $sizeBuf 0 8
    $headerSize = [int](ReadU32 $sizeBuf 4)
    if ($headerSize -lt 8 -or $headerSize -gt 128MB) { throw "asar header 大小异常: $headerSize" }
    $hb = New-Object byte[] $headerSize; ReadExact $s $hb 0 $headerSize
    $strLen = [int](ReadU32 $hb 4)
    if ($strLen -lt 2 -or $strLen -gt ($headerSize - 8)) { throw 'asar header JSON 长度异常' }
    $json = [Text.Encoding]::UTF8.GetString($hb, 8, $strLen)
    $header = $json | ConvertFrom-Json
    return [pscustomobject]@{ Header=$header; HeaderSize=$headerSize; Json=$json }
  } finally { $s.Dispose() }
}
function AddAsarEntries($node, [string]$prefix, [Collections.Generic.List[object]]$out) {
  $fp = $node.PSObject.Properties['files']
  if ($null -ne $fp) {
    foreach ($p in $node.files.PSObject.Properties) {
      $q = if ($prefix) { "$prefix/$($p.Name)" } else { $p.Name }
      AddAsarEntries $p.Value $q $out
    }
    return
  }
  $op = $node.PSObject.Properties['offset']; $sp = $node.PSObject.Properties['size']
  if ($null -ne $op -and $null -ne $sp -and $null -eq $node.PSObject.Properties['unpacked']) {
    $out.Add([pscustomobject]@{ Path=$prefix; Node=$node; OldOffset=[int64]$node.offset; OldSize=[int64]$node.size })
  }
}
function GetAsarEntries($header) {
  $list = New-Object 'Collections.Generic.List[object]'
  AddAsarEntries $header $null $list
  return @($list | Sort-Object OldOffset)
}
function HashAsarRegion([string]$path, [int64]$pos, [int64]$len) {
  $s = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  $sha = [Security.Cryptography.SHA256]::Create(); $buf = New-Object byte[] (1024*1024)
  try {
    [void]$s.Seek($pos, [IO.SeekOrigin]::Begin); $left = $len
    while ($left -gt 0) {
      $want = [int][Math]::Min($buf.Length, $left); $got = $s.Read($buf, 0, $want)
      if ($got -le 0) { throw 'asar 文件在内容区提前结束' }
      [void]$sha.TransformBlock($buf, 0, $got, $buf, 0); $left -= $got
    }
    [void]$sha.TransformFinalBlock([byte[]]@(), 0, 0)
    return ([BitConverter]::ToString($sha.Hash) -replace '-', '').ToLowerInvariant()
  } finally { $sha.Dispose(); $s.Dispose() }
}
function CopyAsarRegion([IO.FileStream]$src, [IO.FileStream]$dst, [int64]$pos, [int64]$len) {
  [void]$src.Seek($pos, [IO.SeekOrigin]::Begin); $buf = New-Object byte[] (1024*1024); $left = $len
  while ($left -gt 0) {
    $want = [int][Math]::Min($buf.Length, $left); $got = $src.Read($buf, 0, $want)
    if ($got -le 0) { throw 'asar 文件在复制时提前结束' }
    $dst.Write($buf, 0, $got); $left -= $got
  }
}
function WriteU32([IO.FileStream]$s, [uint32]$v) {
  $b = [BitConverter]::GetBytes($v); $s.Write($b, 0, 4)
}
function WriteAsarHeader([IO.FileStream]$s, $header) {
  $json = $header | ConvertTo-Json -Compress -Depth 100
  $jb = [Text.Encoding]::UTF8.GetBytes($json); $aligned = $jb.Length + ((4 - ($jb.Length % 4)) % 4)
  $pickleLen = 8 + $aligned; WriteU32 $s 4; WriteU32 $s ([uint32]$pickleLen)
  WriteU32 $s ([uint32](4 + $aligned)); WriteU32 $s ([uint32]$jb.Length)
  $s.Write($jb, 0, $jb.Length)
  if ($aligned -gt $jb.Length) { $s.Write((New-Object byte[] ($aligned - $jb.Length)), 0, $aligned - $jb.Length) }
  return $pickleLen
}
function ReadAsarRegionBytes([string]$path, [int64]$pos, [int64]$len) {
  if ($len -gt 32MB) { throw 'asar 元数据过大' }
  $s = [IO.File]::OpenRead($path)
  try { [void]$s.Seek($pos, [IO.SeekOrigin]::Begin); $b=New-Object byte[] ([int]$len); ReadExact $s $b 0 ([int]$len); return $b } finally { $s.Dispose() }
}
function GetAsarPackageVersion([string]$path, $info, $entries) {
  $pkg = $entries | Where-Object Path -eq 'package.json' | Select-Object -First 1
  if ($null -eq $pkg) { return $null }
  try {
    $b = ReadAsarRegionBytes $path (8 + $info.HeaderSize + $pkg.OldOffset) $pkg.OldSize
    return ([Text.Encoding]::UTF8.GetString($b) | ConvertFrom-Json).version
  } catch { return $null }
}
function ReplaceAtomic([string]$tmp, [string]$dst) {
  try { [IO.File]::Replace($tmp, $dst, $null, $true) } catch { Move-Item -LiteralPath $tmp -Destination $dst -Force }
}
function PatchAsar([string]$path, $manifest) {
  $info = ReadAsarHeader $path; $entries = GetAsarEntries $info.Header
  $pkgVersion = GetAsarPackageVersion $path $info $entries
  if ($pkgVersion -ne $PackageVersion) { throw "跳过非 $Version 全量包（package.json=$pkgVersion）: $path" }
  $byPath = @{}; foreach($e in $entries) { $byPath[$e.Path] = $e }
  $repl = @{}
  foreach($ap in $asarFiles.Keys) {
    if (-not $byPath.ContainsKey($ap)) { throw "asar 缺少目标文件: $ap" }
    $e = $byPath[$ap]; $payloadName = $asarFiles[$ap]; $payload = Join-Path $PayloadRoot $payloadName
    $oldHash = HashAsarRegion $path (8 + $info.HeaderSize + $e.OldOffset) $e.OldSize
    $newHash = ([string]((@($manifest.files) | Where-Object path -eq $payloadName)[0].sha256)).ToLowerInvariant()
    if ($oldHash -ne $newHash -and -not ($asarAccepted[$ap] -contains $oldHash)) { throw "asar 原文件校验失败，拒绝覆盖: $ap ($oldHash)" }
    if ($oldHash -ne $newHash) { $repl[$ap] = [pscustomobject]@{ Path=$ap; Payload=$payload; Size=(Get-Item -LiteralPath $payload).Length; Hash=$newHash; Node=$e.Node } }
  }
  if ($repl.Count -eq 0) { Log "SKIP already repaired app.asar: $path"; return $true }
  $archiveLen = (Get-Item -LiteralPath $path).Length
  $root = [IO.Path]::GetPathRoot($path); $driveName = $root.TrimEnd('\').TrimEnd(':')
  $drive = Get-PSDrive -Name $driveName -ErrorAction SilentlyContinue
  if ($drive -and $drive.Free -lt ($archiveLen * 2 + 128MB)) { throw "磁盘空间不足：asar 修复需要约 $([Math]::Round(($archiveLen*2+128MB)/1GB,1)) GB 临时空间" }
  $dir = Split-Path -Parent $path; $backupRoot = Join-Path $dir 'repair-backups'; New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  $backup = Join-Path $backupRoot "$Version-$stamp-app.asar"; Copy-Item -LiteralPath $path -Destination $backup -Force
  if ((Get-Item -LiteralPath $backup).Length -ne $archiveLen) { throw 'asar 备份大小校验失败' }
  $newOffset = [int64]0
  foreach($e in $entries) {
    if ($repl.ContainsKey($e.Path)) { $r=$repl[$e.Path]; $e.Node.size=[int64]$r.Size; if ($e.Node.PSObject.Properties['integrity']) { $e.Node.integrity.hash=$r.Hash; $e.Node.integrity.blocks=@($r.Hash) } }
    $e.Node.offset=[string]$newOffset; $newOffset += [int64]$e.Node.size
  }
  $tmp = "$path.tmp-$PID-$stamp"; $src=[IO.File]::OpenRead($path); $dst=[IO.File]::Open($tmp,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try {
    [void](WriteAsarHeader $dst $info.Header)
    foreach($e in $entries) { if ($repl.ContainsKey($e.Path)) { $ps=[IO.File]::OpenRead($repl[$e.Path].Payload); try { $ps.CopyTo($dst) } finally { $ps.Dispose() } } else { CopyAsarRegion $src $dst (8 + $info.HeaderSize + $e.OldOffset) $e.OldSize } }
    $dst.Flush($true)
  } finally { $src.Dispose(); $dst.Dispose() }
  # Re-open the generated archive before replacing the user's file.  This is
  # deliberately an independent parse/hash check, so a truncated write cannot
  # become the active app.asar.
  $verify = ReadAsarHeader $tmp; $verifyEntries = GetAsarEntries $verify.Header; $verifyMap = @{}
  foreach($e in $verifyEntries) { $verifyMap[$e.Path] = $e }
  foreach($ap in $repl.Keys) {
    $e = $verifyMap[$ap]; $got = HashAsarRegion $tmp (8 + $verify.HeaderSize + $e.OldOffset) $e.OldSize
    if ($got -ne $repl[$ap].Hash) { throw "asar 写入后校验失败: $ap ($got)" }
  }
  ReplaceAtomic $tmp $path; Log "REPAIRED app.asar $path backup=$backup"; return $true
}
function RollbackAsar([string]$path) {
  $root = Split-Path -Parent $path; $backupRoot = Join-Path $root 'repair-backups'
  $latest = Get-ChildItem -LiteralPath $backupRoot -File -Filter "$Version-*-app.asar" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $latest) { throw "no app.asar repair backup for $path" }
  $tmp = "$path.tmp-rollback-$PID-$stamp"; Copy-Item -LiteralPath $latest.FullName -Destination $tmp -Force; ReplaceAtomic $tmp $path
  Log "ROLLED BACK app.asar $path from $($latest.FullName)"
}
function FindAsarTargets() {
  $paths = New-Object 'Collections.Generic.List[string]'
  if ($AppAsarPath) { $paths.Add((Resolve-Path -LiteralPath $AppAsarPath).Path); return @($paths) }
  # Restrict automatic discovery to normal installation roots.  A portable
  # copy or a developer archive must be named explicitly with -AppAsarPath;
  # never scan a user's Desktop and rewrite arbitrary app.asar files.
  $roots = @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)}) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Sort-Object -Unique
  foreach($root in $roots) { try { Get-ChildItem -LiteralPath $root -Filter app.asar -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object { if ($_.FullName -match '\\resources\\app\.asar$') { $paths.Add($_.FullName) } } } catch {} }
  return @($paths | Sort-Object -Unique)
}

try {
  $manifest = VerifyPayload
  LoadManifestTables $manifest
  Log "天命 $Version 修复器 $KitVersion · 清单文件 $($files.Count) 个（热更新目录 $($hotFiles.Count) 个）"
  $running = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match '^(tianming|tianming-history|天命)$' }
  if ($running) { throw '天命仍在运行，请完全退出游戏后再次双击修复器；修复器不会强杀进程。' }
  $allTargets = @(FindTargets)
  $targets = @($allTargets | Where-Object { ActiveState $_ })
  foreach($inactive in @($allTargets | Where-Object { -not (ActiveState $_) })) { Log "SKIP inactive target: $inactive" }
  if (-not $targets.Count) {
    # Full installers have no hot-update shadow.  In that case patch the
    # packaged app.asar after checking package.json and every target baseline.
    $asars = @(FindAsarTargets)
    if (-not $asars.Count) { throw "未找到 $Version 的活动热更新或全量安装 app.asar。程序不会创建假目录；可用 -AppAsarPath 指定安装位置。" }
    $success = 0
    foreach($asar in $asars) {
      try {
        if ($Rollback) { RollbackAsar $asar } else { [void](PatchAsar $asar $manifest) }
        $success++
      } catch { Log ("SKIP app.asar: " + $_.Exception.Message) }
    }
    if ($success -eq 0) { throw '没有找到可安全修复的 1.3.5.3 app.asar（版本或原文件校验不符）' }
    Log '完成。请重新启动天命；若需撤销，使用 launch.bat -Rollback。'
    Read-Host '按 Enter 关闭'; exit 0
  }
  foreach($target in $targets) {
    if (-not (ActiveState $target)) { Log "SKIP inactive target: $target"; continue }
    if ($Rollback) { RollbackTarget $target; continue }
    foreach($rel in $hotFiles) { if (-not (Test-Path -LiteralPath (Join-Path $target $rel))) { throw "target file missing: $target\$rel" } }
    # 与 PatchAsar 同一道门（2026-10-17·复审 F5）：写入前核对全部目标，只接受 1.3.5.3 原文件、历史修复包写过的或本版；
    # 全部已是本版就跳过、不再新建备份——否则第二次运行会把补丁版当成原件备份，回滚就回不去了。
    $pending = @()
    foreach($rel in $hotFiles) {
      $cur = Hash (Join-Path $target $rel)
      if ($cur -eq $payloadSha[$rel]) { continue }
      if (-not ($hotAccepted[$rel] -contains $cur)) { throw "热更新原文件校验失败，拒绝覆盖: $target\$rel ($cur)" }
      $pending += $rel
    }
    if (-not $pending.Count) { Log "SKIP already repaired $target"; continue }
    $hot = Split-Path -Parent (Split-Path -Parent $target)
    $backup = Join-Path $hot ("repair-backups\$Version-$stamp")
    New-Item -ItemType Directory -Force -Path $backup | Out-Null
    foreach($rel in $pending) {
      $src = Join-Path $PayloadRoot $rel; $dst = Join-Path $target $rel; $bak = Join-Path $backup $rel
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $bak) | Out-Null
      Copy-Item -LiteralPath $dst -Destination $bak -Force
      AtomicCopy $src $dst
      if ((Hash $dst) -ne ((@($manifest.files) | Where-Object path -eq $rel)[0].sha256).ToLowerInvariant()) { throw "post-write hash mismatch: $rel" }
    }
    # 热更新目录只有 web/ 文件；主进程文件（main-impl.js）在 app.asar 里，热更新用户的桌面日志增强要等下个完整安装包。
    foreach($rel in $files) { if ($hotFiles -notcontains $rel) { Log "SKIP (not part of hot-update dir): $rel" } }
    $receipt = [ordered]@{ schema = 2; product = 'tianming'; version = $Version; kit = $KitVersion; installedAt = (Get-Date).ToString('o'); target = $target; backup = $backup; files = $pending }
    $receiptPath = Join-Path $backup 'receipt.json'; $receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $receiptPath -Encoding UTF8
    Log "REPAIRED $target backup=$backup"
  }
  Log '完成。请重新启动天命；若需撤销，使用 launch.bat -Rollback。'
} catch { Log ("FAILED: " + $_.Exception.Message); exit 1 }
Read-Host '按 Enter 关闭'
