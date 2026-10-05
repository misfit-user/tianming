"""新前端字体管线：把字体原件切成按需加载的 woff2 分片，并写出 @font-face 样式表与资产清单。

用法：python tools/ui-art/fonts/build-fonts.py [--src 字体原件目录] [--only 字族名,...]
  原件默认在 D:/tianming-ui-rebuild-20260926/fonts（生图、字体等源件常驻处，不放 Temp）。
  产物：web/ui/assets/fonts/<字族>/<序号>.woff2、web/ui/kit/fonts.css、web/ui/assets/fonts/manifest.json

切法：先按游戏自己的用字频率排字（官方剧本 JSON + web 脚本里的汉字），再接 GB2312、Big5 里剩下的字，
最后是字体里其余的字；每片几千字，unicode-range 写进样式表，浏览器只取页面上用到的那几片。
"""
import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

REPO = Path(__file__).resolve().parents[3]
OUT_FONTS = REPO / 'web' / 'ui' / 'assets' / 'fonts'
OUT_CSS = REPO / 'web' / 'ui' / 'kit' / 'fonts.css'

# 字族 → 原件、用途。界面字用简体字集为主；场景书法字（Yuji）只有日本字集，场景文字一律写繁体
FAMILIES = [
    {'family': 'TM-WenKai', 'file': 'LXGWWenKai-Medium.ttf', 'role': '界面正文小楷、奏折正文、笺上小字'},
    {'family': 'TM-MaShanZheng', 'file': 'MaShanZheng-Regular.ttf', 'role': '界面题头（毛笔楷）'},
    {'family': 'TM-Qiji', 'file': 'qiji-combo.ttf', 'role': '邸报刻本字（会把简体印成繁体刻本字形）'},
    {'family': 'TM-Syuku', 'file': 'YujiSyuku-Regular.ttf', 'role': '场景书法：立轴、楹联、卷目（繁体）'},
    {'family': 'TM-Boku', 'file': 'YujiBoku-Regular.ttf', 'role': '场景书法：匾额（繁体）'},
    {'family': 'TM-Xing', 'file': 'ZhiMangXing-Regular.ttf', 'role': '朱批行书'},
    {'family': 'TM-Seal', 'file': 'LXGWSeal-Regular.ttf', 'role': '印文小篆（字少，整件一片）'},
]
# 每片字数：第一片小，保证开局常用字一片就够
SHARD_SIZES = [1200, 1800, 2400, 3000]
SHARD_REST = 3500


def corpus_counter():
    """游戏自己的用字频率：官方剧本 JSON + web 下的脚本与页面。"""
    cnt = Counter()
    han = re.compile(r'[\u3400-\u9fff\uf900-\ufaff]')
    paths = list((REPO / 'scenarios').glob('*.json'))
    paths += [p for p in (REPO / 'web').glob('*.js')]
    paths += [p for p in (REPO / 'web').glob('*.html')]
    for p in paths:
        try:
            text = p.read_text(encoding='utf-8', errors='ignore')
        except OSError as exc:
            print(f'  跳过 {p.name}: {exc}', file=sys.stderr)
            continue
        cnt.update(han.findall(text))
    return cnt


def charset_of(encoding):
    out = []
    for cp in range(0x3400, 0xA000):
        ch = chr(cp)
        try:
            ch.encode(encoding)
        except UnicodeEncodeError:
            continue
        out.append(cp)
    return out


def ranges(cps):
    """码位列表 → unicode-range 写法（连续的并成区间）。"""
    cps = sorted(cps)
    out, start, prev = [], None, None
    for cp in cps:
        if start is None:
            start = prev = cp
        elif cp == prev + 1:
            prev = cp
        else:
            out.append((start, prev))
            start = prev = cp
    if start is not None:
        out.append((start, prev))
    return ', '.join(f'U+{a:x}' if a == b else f'U+{a:x}-{b:x}' for a, b in out)


def plan_shards(cmap, order):
    """按字序把字体里有的码位分片；ASCII、标点、全角符号并进第一片。"""
    have = set(cmap)
    base = [cp for cp in have if cp < 0x3400 or 0xFE10 <= cp <= 0xFE4F or 0xFF00 <= cp <= 0xFFEF]
    seen = set(base)
    ordered = []
    for cp in order:
        if cp in have and cp not in seen:
            ordered.append(cp)
            seen.add(cp)
    ordered += sorted(cp for cp in have if cp not in seen)
    shards, i, k = [], 0, 0
    while i < len(ordered):
        size = SHARD_SIZES[k] if k < len(SHARD_SIZES) else SHARD_REST
        shards.append(ordered[i:i + size])
        i += size
        k += 1
    if shards:
        shards[0] = base + shards[0]
    else:
        shards = [base]
    return shards


def write_shard(src, cps, dst):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']          # 保留 vert/vrt2：竖排标点要用
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = False
    font = subset.load_font(str(src), opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=cps)
    sub.subset(font)
    dst.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(dst), opts)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='D:/tianming-ui-rebuild-20260926/fonts')
    ap.add_argument('--only', default='')
    args = ap.parse_args()
    src_dir = Path(args.src)
    only = set(filter(None, args.only.split(',')))

    print('统计用字频率…')
    cnt = corpus_counter()
    order = [ord(ch) for ch, _ in cnt.most_common()]
    order += charset_of('gb2312') + charset_of('big5')
    print(f'  语料汉字 {len(cnt)} 种')

    manifest_path = OUT_FONTS / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'families': {}}
    for spec in FAMILIES:
        fam = spec['family']
        if only and fam not in only:
            continue
        src = src_dir / spec['file']
        if not src.exists():
            src = src_dir / 'dl' / spec['file']
        cmap = TTFont(str(src), lazy=True).getBestCmap()
        shards = plan_shards(cmap, order)
        out_dir = OUT_FONTS / fam
        for old in out_dir.glob('*.woff2'):
            old.unlink()
        entries = []
        for i, cps in enumerate(shards):
            dst = out_dir / f'{i:02d}.woff2'
            write_shard(src, cps, dst)
            entries.append({'file': f'{fam}/{dst.name}', 'bytes': dst.stat().st_size, 'sha256': sha256(dst),
                            'chars': len(cps), 'range': ranges(cps)})
        total = sum(e['bytes'] for e in entries)
        print(f'  {fam}: {len(cmap)} 字 → {len(entries)} 片，共 {total / 1e6:.1f} MB（首片 {entries[0]["bytes"] / 1e6:.2f} MB）')
        manifest['families'][fam] = {'source': str(src).replace('\\', '/'), 'role': spec['role'], 'shards': entries}

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    css = ['/* 由 tools/ui-art/fonts/build-fonts.py 生成，别手改。字体均为 SIL OFL 1.1，见 ../assets/fonts/LICENSES.md */']
    for fam, info in manifest['families'].items():
        css.append(f'/* {fam}：{info["role"]} */')
        for e in info['shards']:
            css.append("@font-face { font-family: '%s'; src: url('../assets/fonts/%s') format('woff2'); font-display: block; unicode-range: %s; }"
                       % (fam, e['file'], e['range']))
    OUT_CSS.write_text('\n'.join(css) + '\n', encoding='utf-8')
    print(f'写出 {OUT_CSS.relative_to(REPO)} 与 {manifest_path.relative_to(REPO)}')


if __name__ == '__main__':
    main()
