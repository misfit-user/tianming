"""把生图原稿（art/r3、art/r4）与公有领域名画（art/pd）加工成书房用的贴图：
可平铺化、拼金砖、裁画心、统一尺寸。
用法：python tools/ui-art/tex/make_textures.py
  源件目录：环境变量 TM_ART_SRC，默认 D:/tianming-ui-rebuild-20260926/art（源件常驻处，不放 Temp）
  出图目录：web/ui/assets/study/tex/
"""
import os
import random

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

Image.MAX_IMAGE_PIXELS = None
OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'web', 'ui', 'assets', 'study', 'tex'))
ART = os.environ.get('TM_ART_SRC', 'D:/tianming-ui-rebuild-20260926/art')
R3 = os.path.join(ART, 'r3')
R4 = os.path.join(ART, 'r4')
PD = os.path.join(ART, 'pd')


def src(name):
    return Image.open(os.path.join(R3, name)).convert('RGB')


def save(im, name, q=88):
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, name), quality=q)
    print(name, im.size)


def tileable(im, feather=0.3):
    """半幅错位叠化：四边与自身对侧接得上"""
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    b = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    ey = np.minimum(np.arange(h), h - 1 - np.arange(h)) / (h / 2)
    ex = np.minimum(np.arange(w), w - 1 - np.arange(w)) / (w / 2)
    wy = np.clip(ey / feather, 0, 1)
    wx = np.clip(ex / feather, 0, 1)
    m = np.minimum.outer(wy, wx)[..., None]
    m = m * m * (3 - 2 * m)
    return Image.fromarray(np.clip(a * m + b * (1 - m), 0, 255).astype(np.uint8))


def square(im, size):
    s = min(im.size)
    x0, y0 = (im.width - s) // 2, (im.height - s) // 2
    return im.crop((x0, y0, x0 + s, y0 + s)).resize((size, size), Image.LANCZOS)


# 木：紫檀（护墙板、书格、案腿）与黄花梨（案面，压一压火气）
save(tileable(square(src('wood-zitan.png'), 1024)), 'zitan.jpg')
hh = square(src('wood-huanghuali.png'), 1024)
hh = ImageEnhance.Color(hh).enhance(0.72)
hh = ImageEnhance.Brightness(hh).enhance(0.82)
save(tileable(hh), 'huanghuali.jpg')

# 绢
save(tileable(square(src('silk-weave.png'), 1024)), 'silk.jpg')

# 金砖：2×2 块一张图（每块 1024 像素 = 0.64 米），块块取不同一截、明暗略有出入，细缝
jz = tileable(square(src('floor-jinzhuan.png'), 1024))
jza = np.asarray(jz).astype(np.float32)
rnd = random.Random(4)
out = np.zeros((2048, 2048, 3), np.float32)
for i in range(2):
    for j in range(2):
        t = np.roll(np.roll(jza, rnd.randint(0, 1023), 0), rnd.randint(0, 1023), 1)
        if rnd.random() < 0.5:
            t = t[:, ::-1]
        t = t * rnd.uniform(0.9, 1.08)
        out[i * 1024:(i + 1) * 1024, j * 1024:(j + 1) * 1024] = t
for k in (0, 1024):
    for d, c in ((-2, 0.55), (-1, 0.35), (0, 0.35), (1, 0.55), (2, 1.12)):
        out[(k + d) % 2048, :] *= c
        out[:, (k + d) % 2048] *= c
save(Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), 'floor-tiles.jpg')

# 地毯、天花、彩画
save(src('carpet-dragon.png').resize((2048, 2048), Image.LANCZOS), 'carpet.jpg')
save(src('ceiling-panel.png').resize((1024, 1024), Image.LANCZOS), 'ceiling.jpg')
save(src('beam-caihua.png').resize((2048, 683), Image.LANCZOS), 'caihua.jpg')

# 窗外：去掉原图里画进去的窗扇，只留中间院景
wc = src('window-court.png')
save(wc.crop((int(wc.width * 0.115), 0, int(wc.width * 0.885), int(wc.height * 0.9))).resize((1600, 1150), Image.LANCZOS), 'window-court.jpg')

# 屏风画心：《千里江山图》主峰一段（王希孟，北宋，公有领域），比例同五扇屏心 3.2 : 2.16
q = Image.open(os.path.join(PD, 'qianli-jiangshan-full.jpg')).convert('RGB')
cx = 16043
w = int(1600 * 2.5 / 1.965)     # 第四轮屏风收在两柱之间：绢心 2.5 × 1.965 米
save(q.crop((cx - w // 2, 0, cx + w // 2, 1600)).resize((2048, 1382), Image.LANCZOS), 'screen-qianli.jpg')

for extra, name in (('brocade-cloud.png', 'brocade.jpg'), ('lacquer-cinnabar.png', 'cinnabar.jpg')):
    if os.path.exists(os.path.join(R3, extra)):
        save(tileable(square(src(extra), 1024)), name)
if os.path.exists(os.path.join(R3, 'clouds-mist.png')):
    save(src('clouds-mist.png').resize((1600, 1066), Image.LANCZOS), 'clouds.jpg')


# ---------- 第四轮（art/r4） ----------
def src4(name):
    return Image.open(os.path.join(R4, name)).convert('RGB')


def htile(im, feather=0.25):
    """只横向可接：左右半幅错位叠化（纹带绕瓶一周用）"""
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    b = np.roll(a, w // 2, 1)
    ex = np.minimum(np.arange(w), w - 1 - np.arange(w)) / (w / 2)
    m = np.clip(ex / feather, 0, 1)[None, :, None]
    m = m * m * (3 - 2 * m)
    return Image.fromarray(np.clip(a * m + b * (1 - m), 0, 255).astype(np.uint8))


if os.path.exists(os.path.join(R4, 'throne-back.png')):
    save(src4('throne-back.png'), 'throne-back.jpg')
    save(tileable(square(src4('carved-clouds.png'), 1024)), 'carved-clouds.jpg')
    # 槅扇裙板：原图 3:2，门扇板心近方，横向收一收（如意云略显修长，不裁掉四角云头）
    save(src4('door-skirt.png').resize((1024, 1024), Image.LANCZOS), 'door-skirt.jpg')
    save(src4('plaque-frame.png').resize((2048, 683), Image.LANCZOS), 'plaque-frame.jpg')
    wp = tileable(square(src4('wallpaper-yinhua.png'), 1024))
    wp = ImageEnhance.Contrast(wp).enhance(0.7)
    save(wp, 'wallpaper.jpg')
    save(src4('fan-face.png'), 'fan-face.jpg')
    save(src4('lantern-painting.png'), 'lantern-painting.jpg')
    # 青花梅瓶：一周纹带（缠枝莲），上下各两道弦纹，其余素白釉；图上为瓶口、图下为瓶足
    lotus = htile(src4('porcelain-lotus.png'))
    lotus = ImageEnhance.Color(lotus).enhance(0.82)
    W, H = 2048, 1024
    wrap = Image.new('RGB', (W, H), (236, 240, 243))
    band = lotus.resize((W, 560), Image.LANCZOS)
    wrap.paste(band, (0, 250))
    arr = np.asarray(wrap).astype(np.float32)
    blue = np.array([44, 70, 140], np.float32)
    for y0, th in ((222, 7), (236, 3), (822, 3), (834, 7), (92, 5), (960, 5)):
        arr[y0:y0 + th] = arr[y0:y0 + th] * 0.2 + blue * 0.8
    save(Image.fromarray(arr.astype(np.uint8)), 'porcelain-wrap.jpg')
