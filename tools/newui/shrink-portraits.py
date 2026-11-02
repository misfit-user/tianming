# 新界面试看包用的立绘：把正式立绘按边长缩一半拷到另一个目录，文件名与子目录不变，原图不动。
# python tools/newui/shrink-portraits.py <源 portraits 目录> <出图目录>
# 只缩长边超过 800 的（绍宋、晚唐 1086x1448 → 543x724）；天启本就 480x640，再缩就糊了，照原样拷。
# 已缩过的（出图比源新）跳过，可以断点续做。
import os
import shutil
import sys
from multiprocessing import Pool

from PIL import Image

KEEP_BELOW = 800


def work(job):
    src, dst = job
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return 'skip', os.path.getsize(src), os.path.getsize(dst)
    with Image.open(src) as im:
        w, h = im.size
        if not src.lower().endswith('.png') or max(w, h) <= KEEP_BELOW:
            shutil.copy2(src, dst)
            return 'copy', os.path.getsize(src), os.path.getsize(dst)
        small = im.resize((w // 2, h // 2), Image.LANCZOS)
    tmp = dst + '.tmp.png'
    small.save(tmp, optimize=True)
    os.replace(tmp, dst)
    return 'half', os.path.getsize(src), os.path.getsize(dst)


def main():
    if len(sys.argv) != 3:
        print(__doc__ or '用法见文件头')
        sys.exit(2)
    src_root, out_root = sys.argv[1], sys.argv[2]
    jobs = []
    for folder, _dirs, files in os.walk(src_root):
        for name in files:
            src = os.path.join(folder, name)
            jobs.append((src, os.path.join(out_root, os.path.relpath(src, src_root))))
    tally = {}
    before = after = 0
    with Pool(6) as pool:
        for i, (kind, a, b) in enumerate(pool.imap_unordered(work, jobs), 1):
            tally[kind] = tally.get(kind, 0) + 1
            before += a
            after += b
            if i % 50 == 0:
                print(f'{i}/{len(jobs)}', flush=True)
    print(f'done {tally} {before / 1048576:.0f}MB -> {after / 1048576:.0f}MB', flush=True)


if __name__ == '__main__':
    main()
