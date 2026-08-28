#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""tianming 通用服务器部署脚本 — 在服务器上跑（python3·stdlib only·单文件）。
2026-06-11·更新功能全面升级 S9·取代每版手写 deploy-XXXX.py。

从 GitHub Release 拉制品（dev 侧 SSH 被墙·全走 HTTP），内存安全（大 zip 全程流式落盘），
全部写入原子化（唯一临时文件 + os.replace）+ 旧 feed 留 .bak-<ts>，发布顺序「内容先、feed 最后」
（杜绝 feed 已说新版、包还没到位的 404 竞态）。

服务器一行（release.js 会按版补好 DEFAULT_TAG 并把本文件传到 release 资产里）：
  curl -sL https://github.com/misfit-user/tianming/releases/download/ship-X.Y.Z.W/deploy.py -o /tmp/d.py && python3 /tmp/d.py

参数：
  --tag ship-X.Y.Z.W | --version X.Y.Z.W   二选一（默认 DEFAULT_TAG）
  --only desktop,capgo,changelog,installer  只发某几端（默认全部·installer 资产不在则自动跳过）
  --enable-manifest                         capgo latest.json 携带差量 manifest（默认剥掉=全量兜底·灰度试差量时再开）
  --disable-manifest                        只把服务器现有 capgo/latest.json 的 manifest 剥掉重发（即时回退·不下载任何资产）
  --force                                   允许发布相同/更低版本（默认单调闸拒绝）
  --dry-run                                 下载+全套校验·不写任何对外文件
  --base-dir DIR                            服务器根（默认 1Panel 路径·本地模拟传临时目录）
  --assets-dir DIR                          从本地目录取资产（本地模拟·不访问 GitHub）
  --skip-verify                             跳过发布后公网回读校验
"""
import urllib.request, json, os, zipfile, hashlib, time, shutil, sys, re, base64
import contextlib, pathlib, tempfile

try:
    import fcntl
except ImportError:  # Windows local verifier; production host is Linux.
    fcntl = None

try:
    import msvcrt
except ImportError:
    msvcrt = None

DEFAULT_TAG = ""  # release.js 每版自动补 "ship-X.Y.Z.W"
REPO = "misfit-user/tianming"
DEFAULT_BASE = "/opt/1panel/apps/openresty/openresty/www/sites/api.themisfitserspeople.top/index/tianming"
PUBLIC_BASE = "https://api.themisfitserspeople.top/tianming"

# ── 参数 ──────────────────────────────────────────────────────────────────────
def arg(name, dflt=None):
    if "--" + name in sys.argv:
        i = sys.argv.index("--" + name)
        if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith("--"):
            return sys.argv[i + 1]
        return True
    return dflt

def flag(name):
    return ("--" + name) in sys.argv

TAG = str(arg("tag", "") or "")
VER = str(arg("version", "") or "")
if not TAG and VER: TAG = "ship-" + VER
if not TAG: TAG = DEFAULT_TAG
if not VER and TAG.startswith("ship-"): VER = TAG[5:]
if not TAG or not VER:
    print("缺 --tag/--version 且 DEFAULT_TAG 未补"); sys.exit(2)

BASE = str(arg("base-dir", DEFAULT_BASE))
ASSETS_DIR = str(arg("assets-dir", "") or "")
ONLY = [s.strip() for s in str(arg("only", "") or "").split(",") if s.strip()]
DRY = flag("dry-run")
FORCE = flag("force")
ENABLE_MANIFEST = flag("enable-manifest")
DISABLE_MANIFEST = flag("disable-manifest")
SKIP_VERIFY = flag("skip-verify") or bool(ASSETS_DIR) or (BASE != DEFAULT_BASE)
REPORT_PEAK_MEMORY = flag("report-peak-memory")

if REPORT_PEAK_MEMORY:
    import tracemalloc
    tracemalloc.start()

REL = f"https://github.com/{REPO}/releases/download/{TAG}"
HOT = BASE + "/hot"
FILES = HOT + "/files"
MANIFESTS = HOT + "/manifests"
CAPGO = BASE + "/capgo"
CAPGO_BUNDLES = CAPGO + "/bundles"
CAPGO_FILES = CAPGO + "/files"
RELEASES_WIN = BASE + "/releases/win"
TS = time.strftime("%Y%m%d-%H%M%S")
HEX64 = re.compile(r"^[0-9a-f]{64}$")
STREAM_CHUNK_BYTES = 1024 * 1024
DEPLOY_LOCK_TIMEOUT_SECONDS = 900


class DeployError(Exception):
    def __init__(self, code, message, exit_code=3):
        super().__init__(message)
        self.code = code
        self.exit_code = exit_code

def want(channel):
    return (not ONLY) or (channel in ONLY)

# ── 基础设施（承袭 deploy-1334.py 验证过的范式） ───────────────────────────────
def log(msg): print(msg, flush=True)

def _remove_if_exists(path):
    try:
        os.remove(path)
    except FileNotFoundError:
        pass

def _new_temp_path(directory, prefix):
    os.makedirs(directory, exist_ok=True)
    fd, path = tempfile.mkstemp(prefix=prefix, dir=directory)
    os.close(fd)
    _remove_if_exists(path)
    return path

def _copy_stream_atomic(src, dst):
    """Copy a path/file-like object to dst through a unique fsynced sibling."""
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".deploy-", dir=os.path.dirname(dst))
    try:
        with os.fdopen(fd, "wb") as out:
            if hasattr(src, "read"):
                shutil.copyfileobj(src, out, length=STREAM_CHUNK_BYTES)
            else:
                with open(src, "rb") as inp:
                    shutil.copyfileobj(inp, out, length=STREAM_CHUNK_BYTES)
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, dst)
    finally:
        _remove_if_exists(tmp)

def _atomic_write_bytes(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".deploy-", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    finally:
        _remove_if_exists(tmp)

@contextlib.contextmanager
def deployment_lock():
    """Serialize the entire publication. Linux uses flock; Windows supports local CI."""
    if DRY:
        yield
        return
    os.makedirs(BASE, exist_ok=True)
    lock_path = os.path.join(BASE, ".deploy.lock")
    lock_file = open(lock_path, "a+b")
    locked = False
    started = time.monotonic()
    warned = False
    try:
        if msvcrt is not None:
            lock_file.seek(0, os.SEEK_END)
            if lock_file.tell() == 0:
                lock_file.write(b"0")
                lock_file.flush()
        while not locked:
            try:
                if fcntl is not None:
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                elif msvcrt is not None:
                    lock_file.seek(0)
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    raise DeployError("LOCK_UNSUPPORTED", "当前平台没有可用的进程互斥锁", 9)
                locked = True
            except (BlockingIOError, OSError):
                if not warned:
                    log("  [lock] 另一部署正在运行·等待部署锁")
                    warned = True
                if time.monotonic() - started >= DEPLOY_LOCK_TIMEOUT_SECONDS:
                    raise DeployError("LOCK_TIMEOUT", "等待部署锁超时", 9)
                time.sleep(0.05)
        if warned:
            log(f"  [lock] 等待 {time.monotonic() - started:.3f}s 后取得部署锁")
        yield
    finally:
        if locked:
            if fcntl is not None:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
            elif msvcrt is not None:
                lock_file.seek(0)
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
        lock_file.close()

def download(name, dst, tries=6):
    """资产 → dst·流式 1MB chunk·恒定低内存。--assets-dir 时从本地拷。"""
    if ASSETS_DIR:
        src = os.path.join(ASSETS_DIR, name)
        if not os.path.exists(src): raise FileNotFoundError(src)
        _copy_stream_atomic(src, dst)
        return dst
    url = f"{REL}/{name}"
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "tm-deploy/2"})
            with urllib.request.urlopen(req, timeout=900) as r:
                _copy_stream_atomic(r, dst)
            return dst
        except Exception as e:
            last = e; log(f"  download retry {i+1}: {type(e).__name__} {e}"); time.sleep(3)
    raise SystemExit(f"DOWNLOAD FAILED {url}: {last}")

def asset_exists(name):
    if ASSETS_DIR:
        return os.path.exists(os.path.join(ASSETS_DIR, name))
    try:
        req = urllib.request.Request(f"{REL}/{name}", headers={"User-Agent": "tm-deploy/2"}, method="HEAD")
        urllib.request.urlopen(req, timeout=60)
        return True
    except Exception:
        return False

def fetch_small(name, tries=6):
    if ASSETS_DIR:
        with open(os.path.join(ASSETS_DIR, name), "rb") as fh: return fh.read()
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(f"{REL}/{name}", headers={"User-Agent": "tm-deploy/2"})
            return urllib.request.urlopen(req, timeout=120).read()
        except Exception as e:
            last = e; log(f"  fetch retry {i+1}: {type(e).__name__}"); time.sleep(3)
    raise SystemExit(f"FETCH FAILED {name}: {last}")

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""): h.update(chunk)
    return h.hexdigest()

def sha512_b64_file(path):
    h = hashlib.sha512()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""): h.update(chunk)
    return base64.b64encode(h.digest()).decode("ascii")

def parse_json_bytes(raw): return json.loads(raw.decode("utf-8-sig"))

def ver_tuple(v):
    parts = re.split(r"[.+-]", str(v or "0"))
    out = []
    for p in parts[:4]:
        try: out.append(int(p))
        except ValueError: out.append(0)
    while len(out) < 4: out.append(0)
    return tuple(out)

def publish_bytes(path, data, label):
    """原子发布·旧文件留 .bak-<ts>·dry-run 只演不写。"""
    if DRY:
        log(f"  [dry-run] 将发布 {label} → {path} ({len(data)} bytes)")
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path): shutil.copy2(path, path + f".bak-{TS}")
    _atomic_write_bytes(path, data); os.chmod(path, 0o644)
    log(f"  发布 {label} → {path}")

def publish_move(src, dst, label):
    if DRY:
        log(f"  [dry-run] 将移动就位 {label} → {dst} ({os.path.getsize(src)/1048576:.1f}MB)")
        try: os.remove(src)
        except OSError: pass
        return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    os.replace(src, dst); os.chmod(dst, 0o644)
    log(f"  就位 {label} → {dst}")

def gate_monotonic(live_path, new_ver, channel):
    """版本单调闸。返回 'publish' | 'skip'（相同版本幂等重跑）。更低版本 → abort（除非 --force）。"""
    if not os.path.exists(live_path): return "publish"
    try:
        if live_path.endswith(".yml"):
            m = re.search(r"^version:\s*([\w.\-]+)", open(live_path, encoding="utf-8").read(), re.M)
            live = m.group(1) if m else "0"
        else:
            live = str(parse_json_bytes(open(live_path, "rb").read()).get("version", "0"))
    except Exception as e:
        log(f"  [gate] 现有 {channel} feed 读取失败(视为可发)·{e}"); return "publish"
    nt, lt = ver_tuple(new_ver), ver_tuple(live)
    if nt > lt: return "publish"
    if nt == lt:
        log(f"  [gate] {channel} 已是 v{live}·feed 不重发（内容落位仍幂等执行）")
        return "skip"
    if FORCE:
        log(f"  [gate] WARN·{channel} 降级发布 v{new_ver} < 线上 v{live}·--force 放行（客户端会拒装·确认这是你要的）")
        return "publish"
    log(f"ABORT: {channel} 版本不单调·新 v{new_ver} < 线上 v{live}。降级会让全部客户端拒装/搁浅。--force 可强行。")
    sys.exit(5)

def _validate_desktop_manifest(z, manifest):
    """Validate every manifest identity before publishing any content object."""
    if not isinstance(manifest, dict) or not isinstance(manifest.get("files"), list):
        raise DeployError("MANIFEST_INVALID", "manifest.files 必须为数组")

    zip_entries = {}
    for info in z.infolist():
        zip_entries.setdefault(info.filename, []).append(info)

    seen_paths = set()
    normalized = []
    for index, raw in enumerate(manifest["files"]):
        if not isinstance(raw, dict):
            raise DeployError("MANIFEST_INVALID", f"manifest.files[{index}] 不是对象")
        path_value = raw.get("path")
        if not isinstance(path_value, str) or not path_value or "\x00" in path_value:
            raise DeployError("MANIFEST_PATH_INVALID", f"manifest.files[{index}].path 非法")
        posix_path = pathlib.PurePosixPath(path_value)
        if (posix_path.is_absolute() or ".." in posix_path.parts or "\\" in path_value
                or path_value.endswith("/") or posix_path.name in ("", ".", "..")):
            raise DeployError("MANIFEST_PATH_INVALID", f"manifest path 越界或不规范: {path_value!r}")
        if path_value in seen_paths:
            raise DeployError("MANIFEST_PATH_DUPLICATE", f"manifest path 重复: {path_value!r}")
        seen_paths.add(path_value)

        sha_value = raw.get("sha256")
        if not isinstance(sha_value, str):
            raise DeployError("MANIFEST_SHA_INVALID", f"{path_value}: sha256 缺失或不是字符串")
        sha_value = sha_value.lower()
        if not HEX64.fullmatch(sha_value):
            raise DeployError("MANIFEST_SHA_INVALID", f"{path_value}: sha256 不是 64 位 hex")

        infos = zip_entries.get(path_value, [])
        if not infos:
            raise DeployError("INCOMPLETE", f"manifest 文件不在 zip: {path_value!r}")
        if len(infos) != 1 or infos[0].is_dir():
            raise DeployError("MANIFEST_ZIP_ENTRY_INVALID", f"ZIP 条目重复或不是文件: {path_value!r}")
        info = infos[0]

        declared_size = raw.get("size")
        size = None
        if declared_size is not None:
            if isinstance(declared_size, bool):
                raise DeployError("MANIFEST_SIZE_INVALID", f"{path_value}: size 非法")
            try:
                size = int(declared_size)
            except (TypeError, ValueError):
                raise DeployError("MANIFEST_SIZE_INVALID", f"{path_value}: size 不是整数")
            if size < 0 or size != info.file_size:
                raise DeployError("MANIFEST_SIZE_MISMATCH",
                                  f"{path_value}: manifest size={size}，ZIP size={info.file_size}")

        normalized.append({
            "path": path_value,
            "sha256": sha_value,
            "size": size,
            "info": info,
        })
    return normalized

def _desktop_object_path(entry):
    files_root = os.path.abspath(FILES)
    dst = os.path.abspath(os.path.join(
        files_root,
        entry["sha256"][:2],
        entry["sha256"][2:],
        os.path.basename(entry["path"]),
    ))
    try:
        contained = os.path.commonpath([files_root, dst]) == files_root
    except ValueError:
        contained = False
    if not contained:
        raise DeployError("OBJECT_PATH_ESCAPE", f"对象目标越界: {entry['path']!r}")
    return dst

def _stream_desktop_entry(z, entry):
    """Hash while streaming; publish only a fully verified object."""
    dst = _desktop_object_path(entry)
    existing_valid = False
    if os.path.exists(dst):
        size_ok = entry["size"] is None or os.path.getsize(dst) == entry["size"]
        if size_ok and sha256_file(dst) == entry["sha256"]:
            existing_valid = True

    hasher = hashlib.sha256()
    written = 0
    if DRY or existing_valid:
        try:
            with z.open(entry["info"], "r") as src:
                for chunk in iter(lambda: src.read(STREAM_CHUNK_BYTES), b""):
                    hasher.update(chunk)
                    written += len(chunk)
        except Exception as error:
            raise DeployError("OBJECT_READ_FAILED", f"{entry['path']}: {error}") from error
    else:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix=".deploy-", dir=os.path.dirname(dst))
        try:
            try:
                with os.fdopen(fd, "wb") as out, z.open(entry["info"], "r") as src:
                    for chunk in iter(lambda: src.read(STREAM_CHUNK_BYTES), b""):
                        hasher.update(chunk)
                        written += len(chunk)
                        out.write(chunk)
                    out.flush()
                    os.fsync(out.fileno())
            except Exception as error:
                raise DeployError("OBJECT_READ_FAILED", f"{entry['path']}: {error}") from error
            if hasher.hexdigest() != entry["sha256"]:
                raise DeployError("OBJECT_HASH_MISMATCH", f"{entry['path']}: 实际 sha256 与 manifest 不符")
            if entry["size"] is not None and written != entry["size"]:
                raise DeployError("OBJECT_SIZE_MISMATCH", f"{entry['path']}: 实际写入大小与 manifest 不符")
            os.replace(tmp, dst)
            os.chmod(dst, 0o644)
        finally:
            _remove_if_exists(tmp)

    if hasher.hexdigest() != entry["sha256"]:
        raise DeployError("OBJECT_HASH_MISMATCH", f"{entry['path']}: 实际 sha256 与 manifest 不符")
    if entry["size"] is not None and written != entry["size"]:
        raise DeployError("OBJECT_SIZE_MISMATCH", f"{entry['path']}: 实际读取大小与 manifest 不符")
    return "skipped" if existing_valid else "added"

def _validate_capgo_object_pack(z):
    """Build the complete Capgo object identity table before writing anything."""
    seen_hashes = set()
    entries = []
    for info in z.infolist():
        if info.is_dir():
            continue
        object_hash = os.path.basename(info.filename)
        if not HEX64.fullmatch(object_hash):
            raise DeployError(
                "CAPGO_OBJECT_HASH_INVALID",
                f"Capgo 对象 hash 非法: {info.filename!r}",
                7,
            )
        if object_hash in seen_hashes:
            raise DeployError(
                "CAPGO_OBJECT_DUPLICATE",
                f"Capgo 对象重复: {object_hash}",
                7,
            )
        seen_hashes.add(object_hash)
        entries.append({"hash": object_hash, "info": info})
    return entries

def _stream_capgo_object(z, entry):
    """Verify and atomically publish one Capgo content-addressed object."""
    expected_hash = str(entry["hash"]).lower()
    if not HEX64.fullmatch(expected_hash):
        raise DeployError(
            "CAPGO_OBJECT_HASH_INVALID",
            f"Capgo 对象 hash 非法: {expected_hash!r}",
            7,
        )
    info = entry["info"]
    dst = os.path.join(CAPGO_FILES, expected_hash)
    existing_valid = False
    if os.path.exists(dst):
        existing_valid = sha256_file(dst) == expected_hash
        if not existing_valid:
            log(f"  [capgo] 既有对象损坏·重新写入 {expected_hash[:12]}")

    hasher = hashlib.sha256()
    written = 0
    if DRY or existing_valid:
        try:
            with z.open(info, "r") as src:
                for chunk in iter(lambda: src.read(STREAM_CHUNK_BYTES), b""):
                    hasher.update(chunk)
                    written += len(chunk)
        except Exception as error:
            raise DeployError(
                "CAPGO_OBJECT_READ_FAILED",
                f"Capgo 对象读取失败: {info.filename}: {error}",
                7,
            ) from error
    else:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix=".deploy-", dir=os.path.dirname(dst))
        try:
            try:
                with os.fdopen(fd, "wb") as out, z.open(info, "r") as src:
                    for chunk in iter(lambda: src.read(STREAM_CHUNK_BYTES), b""):
                        hasher.update(chunk)
                        written += len(chunk)
                        out.write(chunk)
                    out.flush()
                    os.fsync(out.fileno())
            except Exception as error:
                raise DeployError(
                    "CAPGO_OBJECT_READ_FAILED",
                    f"Capgo 对象读取失败: {info.filename}: {error}",
                    7,
                ) from error
            if hasher.hexdigest() != expected_hash:
                raise DeployError(
                    "CAPGO_OBJECT_HASH_MISMATCH",
                    f"Capgo 对象内容与名称不一致: {info.filename}",
                    7,
                )
            if written != info.file_size:
                raise DeployError(
                    "CAPGO_OBJECT_SIZE_MISMATCH",
                    f"Capgo 对象实际大小与 ZIP 元数据不一致: {info.filename}",
                    7,
                )
            os.replace(tmp, dst)
            os.chmod(dst, 0o644)
        finally:
            _remove_if_exists(tmp)

    if hasher.hexdigest() != expected_hash:
        raise DeployError(
            "CAPGO_OBJECT_HASH_MISMATCH",
            f"Capgo 对象内容与名称不一致: {info.filename}",
            7,
        )
    if written != info.file_size:
        raise DeployError(
            "CAPGO_OBJECT_SIZE_MISMATCH",
            f"Capgo 对象实际大小与 ZIP 元数据不一致: {info.filename}",
            7,
        )
    return "skipped" if existing_valid else "added"

# ── 电脑端 Electron 热更 ──────────────────────────────────────────────────────
def deploy_desktop():
    zip_name = f"tianming-hot-{VER}.zip"
    log(f"[desktop] 下载热更整包（流式·落 serve 真实磁盘）...")
    os.makedirs(FILES, exist_ok=True); os.makedirs(MANIFESTS, exist_ok=True)
    zpath = _new_temp_path(HOT, f".{zip_name}.deploy-")
    try:
        download(zip_name, zpath)
        zsha = sha256_file(zpath)
        log(f"  zip {os.path.getsize(zpath)/1048576:.1f}MB sha={zsha[:12]}")

        hotlatest = parse_json_bytes(fetch_small("hot-latest.json"))
        if str(hotlatest.get("version", "")) != VER:
            log(f"ABORT: hot-latest.json version={hotlatest.get('version')} ≠ {VER}"); sys.exit(2)
        if hotlatest.get("sha256") and hotlatest["sha256"].lower() != zsha.lower():
            log("ABORT: hot-latest.json sha256 ≠ 实际 zip sha·不发布"); sys.exit(2)
        if hotlatest.get("size") and int(hotlatest["size"]) != os.path.getsize(zpath):
            log("ABORT: hot-latest.json size ≠ 实际 zip 大小·不发布"); sys.exit(2)

        feed_action = gate_monotonic(f"{HOT}/hot-latest.json", VER, "desktop")

        try:
            with zipfile.ZipFile(zpath) as z:
                try:
                    mbytes = z.read("manifest.json")
                    m = json.loads(mbytes)
                except (KeyError, ValueError, UnicodeDecodeError) as error:
                    raise DeployError("MANIFEST_INVALID", f"manifest.json 无法读取: {error}") from error
                entries = _validate_desktop_manifest(z, m)

                moved = skipped = 0
                for entry in entries:
                    result = _stream_desktop_entry(z, entry)
                    if result == "skipped": skipped += 1
                    else: moved += 1
                log(f"  files 库·新入 {moved}·已有跳过 {skipped}")

                changelog_bytes = None
                for nm in ("changelog.json", "web/changelog.json"):
                    try: changelog_bytes = z.read(nm); break
                    except KeyError: continue
        except zipfile.BadZipFile as error:
            raise DeployError("ZIP_INVALID", f"热更 ZIP 损坏: {error}") from error

        publish_bytes(f"{MANIFESTS}/{VER}.json", mbytes,
                      f"manifest manifests/{VER}.json ({len(entries)} 文件)")
        publish_move(zpath, f"{HOT}/{zip_name}", "热更整包")
        if feed_action == "publish":
            publish_bytes(f"{HOT}/hot-latest.json",
                          json.dumps(hotlatest, ensure_ascii=False, indent=2).encode("utf-8"),
                          f"hot-latest.json v{VER}")
        return changelog_bytes
    finally:
        _remove_if_exists(zpath)

# ── 邸报 ─────────────────────────────────────────────────────────────────────
def deploy_changelog(from_zip_bytes=None):
    data = None
    if asset_exists("changelog.json"):
        data = fetch_small("changelog.json")
    elif from_zip_bytes:
        data = from_zip_bytes
    if not data:
        log("[changelog] WARN·release 里没有 changelog.json 资产·且 zip 内未取到·邸报未更新"); return
    cl = parse_json_bytes(data)
    top = cl["entries"][0]
    if VER not in str(top.get("module", "")):
        log(f"  [changelog] WARN·顶条目 module 未含 {VER}·确认 changelog 是否漏写（仍发布）")
    publish_bytes(f"{BASE}/changelog.json", data, f"邸报 top={top.get('date')}·{str(top.get('module'))[:28]}")

# ── 安卓 Capgo ───────────────────────────────────────────────────────────────
def deploy_capgo():
    # 即时回退快路·只剥服务器现有 latest.json 的 manifest·不下载任何资产
    if DISABLE_MANIFEST:
        clp = f"{CAPGO}/latest.json"
        if not os.path.exists(clp): log("ABORT: 服务器无 capgo/latest.json 可改"); sys.exit(6)
        cur = parse_json_bytes(open(clp, "rb").read())
        cur.pop("manifest", None)
        publish_bytes(clp, json.dumps(cur, ensure_ascii=False, indent=2).encode("utf-8"),
                      f"latest.json（manifest 已剥·全量回退）v{cur.get('version')}")
        return

    zip_name = f"{VER}.zip"
    os.makedirs(CAPGO_BUNDLES, exist_ok=True)
    latest = parse_json_bytes(fetch_small("latest.json"))
    if str(latest.get("version", "")) != VER:
        log(f"ABORT: capgo latest.json version={latest.get('version')} ≠ {VER}"); sys.exit(2)
    if not latest.get("url"):
        log("ABORT: capgo latest.json 缺 url（旧客户端兜底字段·绝不能少）"); sys.exit(2)

    feed_action = gate_monotonic(f"{CAPGO}/latest.json", VER, "capgo")

    # 差量对象包（可选资产）→ capgo/files/·条目名必须 64hex
    pack_name = f"capgo-files-{VER}.zip"
    if asset_exists(pack_name):
        ppath = _new_temp_path(CAPGO, f".{pack_name}.deploy-")
        try:
            download(pack_name, ppath)
            try:
                with zipfile.ZipFile(ppath) as pz:
                    entries = _validate_capgo_object_pack(pz)
                    added = skipped = 0
                    os.makedirs(CAPGO_FILES, exist_ok=True)
                    for entry in entries:
                        result = _stream_capgo_object(pz, entry)
                        if result == "skipped": skipped += 1
                        else: added += 1
            except zipfile.BadZipFile as error:
                raise DeployError(
                    "CAPGO_OBJECT_PACK_INVALID",
                    f"Capgo 对象包损坏: {error}",
                    7,
                ) from error
        finally:
            _remove_if_exists(ppath)
        log(f"  [capgo] 对象包·新入 {added}·已有验证 {skipped}")
    else:
        log("  [capgo] 无 capgo-files 对象包资产（纯全量发布或对象已全在服务器）")

    # manifest 完备闸·latest.json 带 manifest 时·每个 hash 必须已在 capgo/files/（否则差量客户端会 404）
    has_manifest = isinstance(latest.get("manifest"), list) and len(latest["manifest"]) > 0
    if has_manifest:
        missing = [e["file_hash"] for e in latest["manifest"]
                   if not os.path.exists(f"{CAPGO_FILES}/{str(e.get('file_hash','')).lower()}")]
        if missing and not DRY:
            log(f"ABORT: manifest 有 {len(missing)} 个对象不在 capgo/files/（前 5: {missing[:5]}）·latest.json 未发布")
            sys.exit(7)
        if missing and DRY:
            log(f"  [dry-run] WARN·manifest 缺对象 {len(missing)} 个（dry-run 下 files 未真写·此警告可能为演练假象）")

    # 全量 bundle（永远要发·url 兜底）·已存在且大小一致 → 跳过下载（幂等/二次 enable 跑不重拉 500MB）
    cbp = f"{CAPGO_BUNDLES}/{zip_name}"
    need_dl = True
    if os.path.exists(cbp) and latest.get("size") and os.path.getsize(cbp) == int(latest["size"]):
        log(f"  [capgo] bundle 已在位且大小一致·跳过下载"); need_dl = False
    if need_dl:
        log(f"[capgo] 下载全量 bundle（流式）...")
        staged_bundle = _new_temp_path(CAPGO_BUNDLES, f".{zip_name}.deploy-")
        try:
            download(zip_name, staged_bundle)
            got = os.path.getsize(staged_bundle)
            if latest.get("size") and int(latest["size"]) != got:
                log(f"ABORT: latest.size({latest['size']}) ≠ 实际({got})"); sys.exit(4)
            publish_move(staged_bundle, cbp, f"capgo bundle ({got/1048576:.1f}MB)")
        finally:
            _remove_if_exists(staged_bundle)

    # feed·默认剥 manifest（全量兜底=今天的行为）·--enable-manifest 才带差量上线
    out = dict(latest)
    if not ENABLE_MANIFEST:
        out.pop("manifest", None)
    if feed_action == "publish" or ENABLE_MANIFEST:
        publish_bytes(f"{CAPGO}/latest.json",
                      json.dumps(out, ensure_ascii=False, indent=2).encode("utf-8"),
                      f"capgo latest.json v{VER}" + ("·携带差量 manifest(" + str(len(out.get('manifest', []))) + "条)" if out.get("manifest") else "·全量(url 兜底)"))

# ── 本体安装包（electron-updater 通道） ───────────────────────────────────────
def deploy_installer():
    if not asset_exists("latest.yml"):
        log("[installer] release 无 latest.yml 资产·跳过本体通道"); return
    yml_text = fetch_small("latest.yml").decode("utf-8-sig")
    def yfield(name):
        m = re.search(r"^\s*" + name + r":\s*(.+)$", yml_text, re.M)
        return m.group(1).strip().strip("'\"") if m else ""
    yver, ypath, ysha, ysize = yfield("version"), yfield("path"), yfield("sha512"), yfield("size")
    if not yver or not ypath or not ysha:
        log("ABORT: latest.yml 缺 version/path/sha512"); sys.exit(8)
    gate = gate_monotonic(f"{RELEASES_WIN}/latest.yml", yver, "installer")

    os.makedirs(RELEASES_WIN, exist_ok=True)
    alias = f"tianming-setup-{VER}-x64.exe"   # gh 资产用 ASCII 别名（中文文件名会被改写）·落位时还原 yml 的 path
    exe_dst = f"{RELEASES_WIN}/{ypath}"
    if os.path.exists(exe_dst) and ysize and os.path.getsize(exe_dst) == int(ysize) and sha512_b64_file(exe_dst) == ysha:
        log("  [installer] exe 已在位且 sha512 一致·跳过下载")
    else:
        log(f"[installer] 下载本体安装包（~{int(ysize or 0)/1048576:.0f}MB·流式）...")
        staged_exe = _new_temp_path(RELEASES_WIN, f".{os.path.basename(ypath)}.deploy-")
        try:
            download(alias, staged_exe)
            actual = sha512_b64_file(staged_exe)
            if actual != ysha:
                log("ABORT: 安装包 sha512 与 latest.yml 不符·不发布"); sys.exit(8)
            publish_move(staged_exe, exe_dst, f"本体 {ypath}")
        finally:
            _remove_if_exists(staged_exe)
    if asset_exists(alias + ".blockmap"):
        blockmap_dst = f"{RELEASES_WIN}/{ypath}.blockmap"
        staged_blockmap = _new_temp_path(RELEASES_WIN, f".{os.path.basename(ypath)}.blockmap.deploy-")
        try:
            download(alias + ".blockmap", staged_blockmap)
            publish_move(staged_blockmap, blockmap_dst, "blockmap（差量安装）")
        finally:
            _remove_if_exists(staged_blockmap)
    if gate == "publish":
        publish_bytes(f"{RELEASES_WIN}/latest.yml", yml_text.encode("utf-8"), f"latest.yml v{yver}")

# ── 发布后公网回读 ────────────────────────────────────────────────────────────
def post_verify():
    if SKIP_VERIFY or DRY:
        log("[verify] 跳过公网回读（本地模拟/dry-run/--skip-verify）"); return
    def get(url):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 tm-deploy"})
            return urllib.request.urlopen(req, timeout=60).read()
        except Exception as e:
            return ("ERR " + str(e)).encode()
    checks = []
    if want("desktop"):
        checks.append(("desktop", f"{PUBLIC_BASE}/hot/hot-latest.json"))
    if want("capgo"):
        checks.append(("capgo", f"{PUBLIC_BASE}/capgo/latest.json"))
    for name, url in checks:
        fresh = get(url + "?cb=" + str(int(time.time())))
        bare = get(url)
        try:
            fv = parse_json_bytes(fresh).get("version"); bv = parse_json_bytes(bare).get("version")
            mark = "OK" if fv == VER else "源站未更新?!"
            cdn = "" if bv == fv else f"·CDN 缓存仍旧(v{bv})·等 TTL 或手动 purge"
            log(f"  [verify] {name}·源站 v{fv} {mark}{cdn}")
        except Exception:
            log(f"  [verify] {name}·回读异常·fresh={fresh[:80]!r}")

def main():
    with deployment_lock():
        log(f"=== tianming deploy v{VER}（tag {TAG}）{'·DRY-RUN' if DRY else ''} ===")
        log(f"    base={BASE}{'·assets=' + ASSETS_DIR if ASSETS_DIR else ''}·only={ONLY or '全部'}")
        changelog_from_zip = None
        if DISABLE_MANIFEST:
            deploy_capgo(); log("=== DONE（manifest 已剥·全量回退） ==="); return
        if want("desktop"):
            changelog_from_zip = deploy_desktop()
        if want("changelog"):
            deploy_changelog(changelog_from_zip)
        if want("capgo"):
            deploy_capgo()
        if want("installer"):
            deploy_installer()
        post_verify()
        log(f"=== DONE v{VER} ===")
        log(f"验证: curl -s {PUBLIC_BASE}/hot/hot-latest.json | head -3")
        log(f"      curl -s {PUBLIC_BASE}/capgo/latest.json | head -3")

if __name__ == "__main__":
    try:
        main()
    except DeployError as error:
        log(f"ABORT_{error.code}: {error}")
        sys.exit(error.exit_code)
    finally:
        if REPORT_PEAK_MEMORY:
            _current, peak = tracemalloc.get_traced_memory()
            log(f"PEAK_TRACED_BYTES={peak}")
