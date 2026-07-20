# build-capgo-bundle.ps1 — 打天命安卓热更 bundle（Capgo OTA·移植 Phase 3）
# 从 web/ 源打成 Capgo bundle，剔除运行时不用的垃圾（同 APK 打包规则）。
#   全量模式:  build-capgo-bundle.ps1 -Version 1.0.1          → capgo-dist\1.0.1.zip
#   差量模式:  build-capgo-bundle.ps1 -Version 1.0.2 -Manifest → capgo-dist\1.0.2.zip（兜底全量·永远要有）
#                                                              + 1.0.2-manifest.json + files\<sha256> 内容寻址库
#   差量打包:  … -Manifest -PackFiles [-BaselineManifest 上版manifest或线上latest.json]
#                                                              → capgo-files-1.0.2.zip（只含基线没有的新对象·上 gh release）
#   机器可读:  差量模式同时落 1.0.2-build.json（zip 大小/清单数/新对象数·release.js 拾取）
# 2026-06-11·S8 升级·差量发布打通（客户端 tm-capacitor-boot.js 早已支持 latest.manifest·一直缺发布侧）
param(
  [Parameter(Mandatory=$true)][string]$Version,
  [string]$WebDir  = "",
  [string]$OutDir  = "$PSScriptRoot\..\capgo-dist",
  [string]$BaseUrl = "https://api.themisfitserspeople.top/tianming/capgo",
  [string]$BaselineManifest = '',
  [switch]$Manifest,
  [switch]$PackFiles
)
$ErrorActionPreference = 'Stop'
function Resolve-TianmingRepoRoot {
  param([string]$ScriptDir = $PSScriptRoot)
  # 以 marker scripts\stage-web-release.js 为准逐级上溯仓根。mobile 是指向 E:\MovedFromC 的 junction，
  # 某些 shell 会把 $PSScriptRoot 解到物理盘 -> $PSScriptRoot\..\.. 落到错处；故先从脚本目录上溯、
  # 命不中再从当前工作目录(这些脚本恒以仓根为 cwd 被调用)上溯，两条都靠 marker 命中即仓根真源。
  $marker = Join-Path 'scripts' 'stage-web-release.js'
  foreach ($start in @($ScriptDir, (Get-Location).Path)) {
    if (-not $start) { continue }
    $dir = $start
    while ($dir) {
      if (Test-Path -LiteralPath (Join-Path $dir $marker)) { return (Resolve-Path -LiteralPath $dir).Path }
      $parent = Split-Path -Parent $dir
      if (-not $parent -or $parent -eq $dir) { break }
      $dir = $parent
    }
  }
  throw "找不到天命仓根(marker=$marker)·PSScriptRoot=$ScriptDir·cwd=$((Get-Location).Path) 逐级上溯均未命中"
}
$repoRoot = Resolve-TianmingRepoRoot
if (-not $WebDir) { $WebDir = Join-Path $repoRoot 'web' }
$WebDir = (Resolve-Path $WebDir).Path
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$OutDir = (Resolve-Path $OutDir).Path

# JSON 一律无 BOM 写（PS5.1 Out-File utf8 带 BOM·会呛死 node JSON.parse / python json.load）
function Write-JsonNoBom([string]$Path, $Obj) {
  $json = $Obj | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
}

# 1) web → staging·统一排除、forbidden path、体积与 SHA256 manifest 闸
$stage = Join-Path $OutDir "_stage-$Version"
$stageScript = Join-Path $repoRoot 'scripts\stage-web-release.js'
$officialSync = Join-Path $repoRoot 'web\scripts\sync-official-scenarios.js'
Write-Host "复制 web → staging（统一 release-tree）..." -ForegroundColor Cyan
& node $officialSync
if ($LASTEXITCODE -ne 0) { throw "官方剧本生成失败·exit=$LASTEXITCODE" }
& node $stageScript --repo-root $repoRoot --source $WebDir --target $stage --label capgo
if ($LASTEXITCODE -ne 0) { throw "Capgo staging 闸失败·exit=$LASTEXITCODE" }
$sz = [math]::Round((Get-ChildItem $stage -Recurse -File | Measure-Object Length -Sum).Sum/1MB,1)
Write-Host "  staging = $sz MB" -ForegroundColor Gray

# 2) 全量 zip·两种模式都打（差量端点 latest.json 也必须保留 url 兜底——旧客户端只认 url）
$zip = Join-Path $OutDir "$Version.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Write-Host "压缩全量 bundle..." -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
$zipBytes = (Get-Item $zip).Length
$zsz = [math]::Round($zipBytes/1MB,1)
Write-Host "✅ 全量 bundle: $zip  ($zsz MB)" -ForegroundColor Green

if (-not $Manifest) {
  Write-Host "   上传到服务器 $BaseUrl/bundles/$Version.zip · 端点回 {version:'$Version', url:'$BaseUrl/bundles/$Version.zip'}" -ForegroundColor Yellow
} else {
  # 3) 差量: 每文件 sha256 → manifest + 文件落 files\<sha256>（assets 不变→hash 不变→Capgo 跳过不下）
  Write-Host "生成差量 manifest（每文件 sha256）..." -ForegroundColor Cyan
  $filesDir = Join-Path $OutDir 'files'
  New-Item -ItemType Directory -Path $filesDir -Force | Out-Null

  # 基线哈希集·来自线上 latest.json（含 manifest 数组）或上一版 *-manifest.json·没有就空集 = 全新对象
  $baseline = @{}
  if ($BaselineManifest) {
    if (-not (Test-Path $BaselineManifest)) { throw "BaselineManifest 不存在: $BaselineManifest" }
    $bmRaw = Get-Content $BaselineManifest -Raw -Encoding UTF8  # 同上·manifest path 含中文剧本名·PS5.1 GBK 读会乱码
    $bm = $bmRaw | ConvertFrom-Json
    $bArr = @()
    if ($bm.PSObject.Properties['manifest']) { $bArr = $bm.manifest }
    elseif ($bm -is [array]) { $bArr = $bm }
    foreach ($e in $bArr) {
      if ($e.file_hash) { $baseline[([string]$e.file_hash).ToLower()] = $true }
    }
    Write-Host "  基线对象 $($baseline.Count) 个（$BaselineManifest）" -ForegroundColor Gray
  }

  $entries = New-Object System.Collections.Generic.List[object]
  $newHashes = New-Object System.Collections.Generic.List[string]
  $newBytes = [long]0
  Get-ChildItem $stage -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($stage.Length).TrimStart('\','/').Replace('\','/')
    $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
    $dst = Join-Path $filesDir $hash
    if (-not (Test-Path $dst)) { Copy-Item $_.FullName $dst -Force }
    $entries.Add([ordered]@{ file_name = $rel; file_hash = $hash; download_url = "$BaseUrl/files/$hash" })
    if (-not $baseline.ContainsKey($hash) -and -not $newHashes.Contains($hash)) {
      $newHashes.Add($hash)
      $newBytes += $_.Length
    }
  }
  $manifestObj = [ordered]@{ version = $Version; manifest = $entries }
  $mfPath = Join-Path $OutDir "$Version-manifest.json"
  Write-JsonNoBom $mfPath $manifestObj
  Write-Host "✅ 差量 manifest: $mfPath  ($($entries.Count) 文件·相对基线新对象 $($newHashes.Count) 个·$([math]::Round($newBytes/1MB,1)) MB)" -ForegroundColor Green

  # 4) -PackFiles·把「基线没有的新对象」打成一个 zip（条目名=sha256·服务器解到 capgo/files/ 即落位）
  $packPath = Join-Path $OutDir "capgo-files-$Version.zip"
  if (Test-Path $packPath) { Remove-Item $packPath -Force }
  if ($PackFiles) {
    if ($newHashes.Count -gt 0) {
      Write-Host "打包新对象 → capgo-files-$Version.zip ..." -ForegroundColor Cyan
      $packList = $newHashes | ForEach-Object { Join-Path $filesDir $_ }
      Compress-Archive -Path $packList -DestinationPath $packPath -CompressionLevel Optimal
      Write-Host "✅ 新对象包: $packPath  ($([math]::Round((Get-Item $packPath).Length/1MB,1)) MB·$($newHashes.Count) 对象)" -ForegroundColor Green
    } else {
      Write-Host "  相对基线零新对象·不打 capgo-files 包" -ForegroundColor Gray
    }
  }

  # 5) 机器可读构建摘要·release.js 拾取（zip 大小给 latest.json 的 size 字段等）
  $buildInfo = [ordered]@{
    version       = $Version
    zip           = "$Version.zip"
    zipBytes      = $zipBytes
    manifestFile  = "$Version-manifest.json"
    manifestCount = $entries.Count
    packedFile    = $(if ($PackFiles -and $newHashes.Count -gt 0) { "capgo-files-$Version.zip" } else { '' })
    packedCount   = $newHashes.Count
    packedBytes   = $newBytes
    baseUrl       = $BaseUrl
    generatedAt   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  }
  Write-JsonNoBom (Join-Path $OutDir "$Version-build.json") $buildInfo
  Write-Host "   上传 capgo-files-$Version.zip + $Version.zip + latest.json（release.js 合成）→ gh release" -ForegroundColor Yellow
  Write-Host "   assets 不变的文件 sha 与上版相同 → Capgo 自动跳过 → 只下改动的几 MB" -ForegroundColor Yellow
}
try { Remove-Item $stage -Recurse -Force -ErrorAction Stop } catch { Write-Host "  (staging 清理有残留·不影响已生成产物: $($_.Exception.Message))" -ForegroundColor Gray }
exit 0  # 产物在 build.json 已落盘·别让末尾 staging 清理的文件锁非致命错误把退出码染成 1（release.js 用 status 判 capgo 成败会误 die）
