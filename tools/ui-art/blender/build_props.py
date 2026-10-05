"""甲 · 御书房案上器物：Blender 无界面程序化建模，导出 props.glb 给 Three.js 用。

用法：blender -b -P build_props.py -- <输出目录> [preview]
  · 每件器物是一个独立的顶层对象（或空对象带子件），名字即 Three.js 里取用的名字
  · 尺寸按真实米制建（玺 10 厘米见方、书 26 厘米长……），进场景后统一乘 1000 与书案单位（毫米）对齐
  · 材质只给 PBR 底色、粗糙度、金属度；纸纹、木纹、描金这类细纹理在 Three.js 里按材质名补
  · 带 preview 参数时另渲一张总览图（EEVEE）供检查造型
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
# 默认写进仓里的新前端资产目录（二进制不进 git，见 web/ui/assets/.gitignore）
OUT_DIR = ARGS[0] if ARGS else os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'web', 'ui', 'assets', 'study'))
PREVIEW = 'preview' in ARGS
TAU = math.tau

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------------- 材质 ----------------
def srgb(hex_color):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(lin(int(hex_color[i:i + 2], 16)) for i in (1, 3, 5))


MATS = {}


def mat(name, color, rough=0.5, metal=0.0, coat=0.0, transmission=0.0, ior=1.5):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Transmission Weight'].default_value = transmission
    b.inputs['IOR'].default_value = ior
    MATS[name] = m
    return m


M = {
    'jade': mat('jade', '#b9c9a8', 0.22, coat=0.6, transmission=0.35),
    'brocade': mat('brocade_red', '#7c1f14', 0.8),
    'gold': mat('gold', '#c9a55a', 0.3, 1.0),
    'silk_red': mat('silk_red', '#9b2418', 0.65),
    'porcelain': mat('porcelain', '#f1ede2', 0.12, coat=0.8),
    'celadon': mat('celadon', '#98b7a0', 0.18, coat=0.7),
    'cinnabar': mat('cinnabar', '#b2301f', 0.75),
    'bronze': mat('bronze', '#6e4a2c', 0.36, 1.0),
    'ash': mat('ash', '#8f8a82', 0.95),
    'incense': mat('incense', '#5a2a1c', 0.8),
    'ember': mat('ember', '#ff8a3a', 0.6),
    'bamboo': mat('bamboo', '#b8955a', 0.45),
    'horn': mat('horn', '#2a1c14', 0.35),
    'hair_ink': mat('hair_ink', '#15110e', 0.7),
    'hair_red': mat('hair_red', '#a8261a', 0.6),
    'hair_root': mat('hair_root', '#d9c9a6', 0.8),
    'stone': mat('inkstone', '#37302f', 0.42),
    'ink_wet': mat('ink_wet', '#030303', 0.12),
    'ink_stick': mat('ink_stick', '#141111', 0.55),
    'tea': mat('tea', '#8a6a24', 0.05, coat=1.0),
    'cloth_blue': mat('cloth_indigo', '#34466b', 0.9),
    'cloth_brown': mat('cloth_brown', '#5e4230', 0.9),
    'paper_edge': mat('paper_edge', '#e6dcc4', 0.95),
    'slip': mat('title_slip', '#efe7d3', 0.9),
    'thread': mat('thread', '#ece4d2', 0.8),
    'fold_cover': mat('memorial_cover', '#e9dfc6', 0.9),
    'fold_yellow': mat('memorial_yellow', '#c8a246', 0.7),
    'fold_slip': mat('memorial_slip', '#b3281b', 0.8),
    'lacquer': mat('lacquer_black', '#120b08', 0.22, coat=1.0),
    'lacquer_red': mat('lacquer_red', '#7a2014', 0.3, coat=1.0),
    'letter': mat('letter_paper', '#ebe0c5', 0.9),
    'note': mat('note_paper', '#efe5cc', 0.9),
    'wax': mat('seal_wax', '#8e1d12', 0.35),
    'zitan': mat('wood_zitan', '#3a1c14', 0.35, coat=0.5),
    'bamboo_old': mat('bamboo_old', '#b08a4e', 0.5, coat=0.2),
}


# ---------------- 造型工具 ----------------
def link(ob, parent=None):
    bpy.context.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def from_bmesh(name, bm, material, smooth_angle=None, parent=None):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me), parent)
    if isinstance(material, (list, tuple)):
        for m in material:
            me.materials.append(m)
    elif material is not None:
        me.materials.append(material)
    if smooth_angle is not None:
        for p in me.polygons:
            p.use_smooth = True
        smooth_by_angle(ob, smooth_angle)
    return ob


def smooth_by_angle(ob, angle):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))


def lathe(name, profile, material, seg=64, parent=None, smooth=35):
    """旋转成形：profile 是自下而上的 (半径, 高) 点列；半径为 0 的点收成一个顶点。"""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(TAU * i / seg), r * math.sin(TAU * i / seg), z)) for i in range(seg)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(seg):
            if len(a) == 1:
                bm.faces.new((a[0], b[i], b[(i + 1) % seg]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[(i + 1) % seg], b[0]))
            else:
                bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bmesh(name, bm, material, smooth, parent)


def box(name, sx, sy, sz, material, bevel=0.0, seg=2, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, face_mats=None):
    """长方块：底面落在 loc 的 z 上。face_mats=(顶底材质, 侧面材质) 时顶/底与四侧分开给材质。"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, sz / 2), verts=bm.verts)
    mats = material
    if face_mats:
        mats = list(face_mats)
        for f in bm.faces:
            f.material_index = 0 if abs(f.normal.z) > 0.5 else 1
    ob = from_bmesh(name, bm, mats, None, parent)
    ob.location = loc
    ob.rotation_euler = rot
    if bevel > 0:
        mod = ob.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = seg
        mod.limit_method = 'ANGLE'
        mod.harden_normals = False
        for p in ob.data.polygons:
            p.use_smooth = True
        smooth_by_angle(ob, 35)
    return ob


def tube(name, points, radius, material, parent=None, seg=12):
    """沿折线点列扫出圆管（丝绳、提梁）。"""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    cu.resolution_u = seg
    sp = cu.splines.new('NURBS')
    sp.points.add(len(points) - 1)
    for p, co in zip(sp.points, points):
        p.co = (*co, 1)
    sp.use_endpoint_u = True
    sp.order_u = 3
    ob = link(bpy.data.objects.new(name, cu), parent)
    ob.data.materials.append(material)
    return ob


def skin_creature(name, joints, bones, material, parent=None, subsurf=2):
    """骨架点 + 蒙皮修改器 + 细分：做玺钮、镇纸钮这类圆润的小兽。joints: {名: (坐标, 半径)}"""
    names = list(joints)
    me = bpy.data.meshes.new(name)
    me.from_pydata([joints[n][0] for n in names], [(names.index(a), names.index(b)) for a, b in bones], [])
    ob = link(bpy.data.objects.new(name, me), parent)
    skin = ob.modifiers.new('skin', 'SKIN')
    skin.use_smooth_shade = True
    for i, n in enumerate(names):
        r = joints[n][1]
        me.skin_vertices[0].data[i].radius = (r, r)
    me.skin_vertices[0].data[0].use_root = True
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = subsurf
    sub.render_levels = subsurf
    ob.data.materials.append(material)
    return ob


def group(name, loc=(0, 0, 0)):
    ob = link(bpy.data.objects.new(name, None))
    ob.location = loc
    return ob


# ---------------- 器物 ----------------
def make_seal():
    """玉玺：方座、台阶、蹲兽钮，钮上系红丝绦垂到座边。"""
    g = group('seal')
    box('seal_base', 0.10, 0.10, 0.052, M['jade'], bevel=0.005, seg=3, parent=g)
    box('seal_step', 0.084, 0.084, 0.010, M['jade'], bevel=0.003, loc=(0, 0, 0.051), parent=g)
    z = 0.061
    # 蟠龙钮：身子绕台一圈盘起，颈从圈中昂起，头朝前，两只角后扬（不带腿，免得像走兽）
    joints = {}
    turns = 13
    for i in range(turns):
        k = i / (turns - 1)
        a = math.radians(205 + 320 * k)
        rad = 0.031 - 0.009 * k
        joints[f'b{i}'] = ((rad * math.cos(a), rad * math.sin(a), z + 0.007 + 0.012 * k), 0.0032 + 0.0078 * min(1.0, k * 2.2))
    joints.update({
        'neck': ((0.006, 0.004, z + 0.033), 0.0082), 'head': ((0.014, 0.0, z + 0.045), 0.0112),
        'snout': ((0.029, 0.0, z + 0.046), 0.0066), 'jaw': ((0.024, 0.0, z + 0.039), 0.0048),
        'hornL': ((0.004, 0.009, z + 0.058), 0.0026), 'hornR': ((0.004, -0.009, z + 0.058), 0.0026),
        'maneL': ((0.006, 0.011, z + 0.046), 0.0035), 'maneR': ((0.006, -0.011, z + 0.046), 0.0035),
    })
    bones = [(f'b{i}', f'b{i + 1}') for i in range(turns - 1)]
    bones += [(f'b{turns - 1}', 'neck'), ('neck', 'head'), ('head', 'snout'), ('head', 'jaw'), ('head', 'hornL'), ('head', 'hornR'), ('head', 'maneL'), ('head', 'maneR')]
    skin_creature('seal_knob', joints, bones, M['jade'], parent=g)
    # 红丝绦：从龙颈绕下，沿玺侧垂到锦垫上，末端一只穗子平躺在垫上
    tube('seal_cord', [(0.012, 0.012, z + 0.03), (0.03, 0.03, z + 0.012), (0.046, 0.042, 0.052), (0.053, 0.05, 0.03), (0.056, 0.058, 0.008), (0.06, 0.068, 0.003)], 0.0016, M['silk_red'], parent=g)
    tassel = lathe('seal_tassel', [(0, 0.0), (0.009, 0.0), (0.0075, 0.02), (0.005, 0.03), (0.0055, 0.034), (0, 0.037)], M['silk_red'], seg=24, parent=g, smooth=60)
    tassel.location = (0.062, 0.105, 0.005)
    tassel.rotation_euler = (math.radians(90), 0, 0)
    return g


def make_cushion():
    """红锦垫：厚软方垫，四周包金边。"""
    g = group('cushion')
    c = box('cushion_body', 0.17, 0.17, 0.026, M['brocade'], bevel=0.011, seg=5, parent=g)
    box('cushion_trim', 0.172, 0.172, 0.004, M['gold'], bevel=0.0015, loc=(0, 0, 0.011), parent=g)
    return g


def make_paste_box():
    """印泥盒：白瓷矮圆盒，盒内朱砂印泥，盖子斜倚一旁。"""
    g = group('paste_box')
    lathe('paste_body', [(0, 0), (0.034, 0), (0.038, 0.003), (0.040, 0.020), (0.037, 0.024), (0.034, 0.022), (0.033, 0.017), (0, 0.017)], M['porcelain'], parent=g)
    lathe('paste_red', [(0, 0.0172), (0.0325, 0.0172), (0.031, 0.0195), (0, 0.021)], M['cinnabar'], parent=g, smooth=80)
    lid = lathe('paste_lid', [(0, 0.022), (0.02, 0.021), (0.036, 0.016), (0.041, 0.008), (0.041, 0.0), (0.038, 0.0), (0.038, 0.007), (0.033, 0.014), (0, 0.018)], M['porcelain'], parent=g)
    lid.location = (0.092, 0.012, 0.0)
    lid.rotation_euler = (0, 0, 0)
    return g


def make_censer():
    """三足铜炉：鼓腹、两耳、三足，炉中香灰插一炷香（烟在 Three.js 里画）。"""
    g = group('censer')
    body = [(0, 0.030), (0.036, 0.030), (0.052, 0.040), (0.062, 0.058), (0.062, 0.078), (0.055, 0.094), (0.052, 0.100),
            (0.056, 0.104), (0.058, 0.108), (0.052, 0.110), (0.049, 0.102), (0.048, 0.096), (0, 0.090)]
    lathe('censer_body', body, M['bronze'], parent=g)
    lathe('censer_ash', [(0, 0.0955), (0.047, 0.0955), (0.046, 0.097), (0, 0.0985)], M['ash'], parent=g, smooth=80)
    for i in range(3):
        a = TAU * i / 3 + math.pi / 2
        x, y = 0.036 * math.cos(a), 0.036 * math.sin(a)
        leg = lathe(f'censer_leg{i}', [(0.0075, 0.0), (0.0095, 0.004), (0.0075, 0.014), (0.0085, 0.026), (0.011, 0.034), (0, 0.036)], M['bronze'], seg=20, parent=g)
        leg.location = (x * 1.05, y * 1.05, 0)
    for s in (-1, 1):
        ear = tube(f'censer_ear{"LR"[s > 0]}', [(0.042 * s, 0.0, 0.106), (0.047 * s, 0.0, 0.126), (0.058 * s, 0.0, 0.132), (0.064 * s, 0.0, 0.122), (0.058 * s, 0.0, 0.104)], 0.0042, M['bronze'], parent=g)
    lathe('censer_stick', [(0.0013, 0.0), (0.0013, 0.118), (0, 0.119)], M['incense'], seg=10, parent=g).location = (0.008, -0.004, 0.096)
    lathe('censer_ember', [(0, 0.0), (0.0016, 0.0005), (0.0014, 0.006), (0, 0.0072)], M['ember'], seg=10, parent=g, smooth=80).location = (0.008, -0.004, 0.096 + 0.113)
    return g


def make_brush(name, hair):
    """毛笔：竹管、笔斗、笔头（根部白、尖部蘸墨或蘸朱），沿 +X 平放。"""
    g = group(name)
    parts = []
    shaft = lathe(f'{name}_shaft', [(0, 0), (0.0048, 0.0), (0.0048, 0.17), (0.0052, 0.172), (0.0052, 0.175), (0.0046, 0.177), (0.0046, 0.19), (0, 0.19)], M['bamboo'], seg=20, parent=g)
    cap = lathe(f'{name}_cap', [(0, 0.19), (0.0052, 0.19), (0.0052, 0.2), (0.003, 0.203), (0, 0.203)], M['horn'], seg=20, parent=g)
    ferrule = lathe(f'{name}_ferrule', [(0, -0.018), (0.006, -0.018), (0.006, 0.002), (0, 0.002)], M['horn'], seg=20, parent=g)
    root = lathe(f'{name}_root', [(0, -0.030), (0.0058, -0.030), (0.0062, -0.022), (0.0058, -0.018), (0, -0.018)], M['hair_root'], seg=20, parent=g, smooth=70)
    tip = lathe(f'{name}_tip', [(0, -0.060), (0.0012, -0.056), (0.0038, -0.046), (0.0056, -0.036), (0.0058, -0.030), (0, -0.030)], M[hair], seg=20, parent=g, smooth=70)
    for ob in (shaft, cap, ferrule, root, tip):
        ob.rotation_euler = (0, math.pi / 2, 0)
    return g


def make_brush_rest():
    """笔山：青瓷五峰，峰间两道凹口搁笔。"""
    pts = [(-0.08, 0.0), (0.08, 0.0), (0.078, 0.012), (0.066, 0.028), (0.052, 0.020), (0.040, 0.036), (0.026, 0.024),
           (0.012, 0.044), (0.0, 0.052), (-0.012, 0.044), (-0.026, 0.024), (-0.040, 0.036), (-0.052, 0.020), (-0.066, 0.028), (-0.078, 0.012)]
    bm = bmesh.new()
    front = [bm.verts.new((x, -0.012, z)) for x, z in pts]
    back = [bm.verts.new((x, 0.012, z)) for x, z in pts]
    bm.faces.new(list(reversed(front)))
    bm.faces.new(back)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = from_bmesh('brush_rest', bm, M['celadon'])
    mod = ob.modifiers.new('bevel', 'BEVEL')
    mod.width = 0.006
    mod.segments = 4
    mod.limit_method = 'ANGLE'
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = 2
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def make_inkstone():
    """端砚：圆角厚石板，四周留边，砚堂浅凹，上端一道深池盛墨（刀具先倒圆角再挖，边沿圆润）。"""
    g = group('inkstone')
    base = box('inkstone_body', 0.22, 0.15, 0.032, M['stone'], parent=g)
    base.modifiers.remove(base.modifiers[0]) if base.modifiers else None
    bev0 = base.modifiers.new('round', 'BEVEL')
    bev0.width = 0.012
    bev0.segments = 5
    bev0.limit_method = 'ANGLE'
    bev0.angle_limit = math.radians(60)
    for name, sx, sy, cy, depth, r in (('cut_hall', 0.176, 0.098, -0.012, 0.005, 0.02), ('cut_pool', 0.15, 0.03, 0.047, 0.015, 0.012)):
        cutter = box(name, sx, sy, 0.05, M['stone'], loc=(0, cy, 0.032 - depth), parent=g)
        cb = cutter.modifiers.new('round', 'BEVEL')
        cb.width = r
        cb.segments = 6
        cb.limit_method = 'ANGLE'
        mod = base.modifiers.new(name, 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = cutter
        mod.solver = 'EXACT'
        cutter.hide_set(True)
        cutter.hide_render = True
        cutter['cutter'] = True
    bev = base.modifiers.new('soften', 'BEVEL')
    bev.width = 0.0015
    bev.segments = 2
    bev.limit_method = 'ANGLE'
    for p in base.data.polygons:
        p.use_smooth = True
    smooth_by_angle(base, 40)
    box('inkstone_ink', 0.145, 0.026, 0.0008, M['ink_wet'], loc=(0, 0.047, 0.024), parent=g)
    return g


def make_ink_stick():
    g = group('ink_stick')
    box('ink_stick_body', 0.088, 0.022, 0.01, M['ink_stick'], bevel=0.0012, parent=g)
    box('ink_stick_gold', 0.05, 0.012, 0.0004, M['gold'], loc=(0.004, 0, 0.0099), parent=g)
    return g


def make_dropper():
    """水盂：青瓷扁腹小罐。"""
    return lathe('dropper', [(0, 0), (0.021, 0), (0.024, 0.003), (0.031, 0.012), (0.033, 0.022), (0.029, 0.033), (0.017, 0.040),
                             (0.0125, 0.042), (0.0125, 0.046), (0.0105, 0.046), (0.0105, 0.041), (0, 0.037)], M['celadon'])


def make_tea():
    """盖碗（三才碗）：盏托、碗、碗盖；盖子斜搭在碗沿上，露出一弯茶汤"""
    g = group('tea')
    lathe('tea_saucer', [(0, 0), (0.05, 0.0), (0.062, 0.005), (0.064, 0.009), (0.06, 0.01), (0.045, 0.007), (0.03, 0.008), (0.027, 0.014),
                         (0.022, 0.014), (0.021, 0.009), (0, 0.009)], M['porcelain'], parent=g)
    lathe('tea_cup', [(0, 0.012), (0.016, 0.012), (0.017, 0.016), (0.02, 0.02), (0.034, 0.034), (0.043, 0.056), (0.047, 0.066), (0.0455, 0.067),
                      (0.041, 0.057), (0.032, 0.036), (0.018, 0.024), (0, 0.023)], M['porcelain'], parent=g)
    lathe('tea_liquid', [(0, 0.05), (0.038, 0.05), (0, 0.0505)], M['tea'], parent=g, smooth=80)
    lid = lathe('tea_lid', [(0, 0.03), (0.01, 0.03), (0.012, 0.024), (0.011, 0.018), (0.02, 0.016), (0.034, 0.01), (0.042, 0.004), (0.043, 0.0),
                            (0.04, 0.0), (0.039, 0.003), (0.031, 0.008), (0.018, 0.013), (0, 0.015)], M['porcelain'], parent=g)
    lid.location = (0.012, 0.0, 0.061)
    lid.rotation_euler = (0, math.radians(-14), 0)
    return g


def make_brush_pot():
    """竹雕笔筒：老竹色，口沿一道弦纹；插三支笔，笔杆斜倚"""
    g = group('brush_pot')
    lathe('pot_body', [(0, 0), (0.05, 0.0), (0.052, 0.004), (0.052, 0.13), (0.054, 0.134), (0.054, 0.14), (0.047, 0.14), (0.047, 0.006), (0, 0.006)],
          M['bamboo_old'], seg=48, parent=g, smooth=40)
    for i, (hair, tilt, az) in enumerate((('hair_ink', 9, 20), ('hair_ink', 13, 150), ('hair_red', 11, 260))):
        b = make_brush(f'pot_brush{i}', hair)
        b.parent = g
        a = math.radians(az)
        b.location = (0.018 * math.cos(a), 0.018 * math.sin(a), 0.045)
        # 笔毫朝上：先竖起（-X 轴转到 +Z），再往外斜
        b.rotation_euler = (math.radians(tilt) * math.sin(a), -math.radians(90) - math.radians(tilt) * math.cos(a), 0)
    return g


def make_book(name, cover):
    """线装书：书衣、书口、四眼订线、题签（题签材质单独，Three.js 里写书名）。"""
    g = group(name)
    w, d, h = 0.26, 0.18, 0.017
    box(f'{name}_block', w, d, h, None, bevel=0.0012, parent=g, face_mats=(M[cover], M['paper_edge']))
    slip = box(f'{name}_slip', 0.034, 0.13, 0.0006, None, loc=(0.085, 0.0, h), parent=g)
    slip.data.materials.append(mat(f'{name}_slip', '#efe7d3', 0.9))
    for i in range(4):
        y = -d / 2 + d * (i + 0.5) / 4
        box(f'{name}_st{i}', 0.014, 0.0016, 0.0007, M['thread'], loc=(-w / 2 + 0.009, y, h), parent=g)
        box(f'{name}_sp{i}', 0.0016, 0.0016, h + 0.001, M['thread'], loc=(-w / 2 + 0.0008, y, 0), parent=g)
    box(f'{name}_spine', 0.0016, d * 0.98, 0.0007, M['thread'], loc=(-w / 2 + 0.0165, 0, h), parent=g)
    return g


def make_memorial(name, cover):
    """奏折：经折装一叠，书衣素纸或黄绫，面上一条朱签。"""
    g = group(name)
    box(f'{name}_block', 0.17, 0.36, 0.013, None, bevel=0.0012, parent=g, face_mats=(M[cover], M['paper_edge']))
    box(f'{name}_slip', 0.03, 0.11, 0.0005, M['fold_slip'], loc=(0.045, 0.09, 0.013), parent=g)
    return g


def make_letterbox():
    """黑漆描金信匣：盖面（材质单独，Three.js 里补描金纹）、包金角、铜锁扣，匣上两封信。"""
    g = group('letterbox')
    box('lb_body', 0.30, 0.21, 0.058, M['lacquer'], bevel=0.004, seg=3, parent=g)
    lid = box('lb_lid', 0.304, 0.214, 0.016, M['lacquer'], bevel=0.005, seg=3, loc=(0, 0, 0.058), parent=g)
    top = box('lb_lid_top', 0.27, 0.18, 0.0006, None, loc=(0, 0, 0.074), parent=g)
    top.data.materials.append(mat('lacquer_gilt', '#120b08', 0.25, coat=1.0))
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f'lb_corner{sx}{sy}', 0.026, 0.026, 0.0012, M['gold'], bevel=0.0005, loc=(sx * 0.139, sy * 0.094, 0.0735), parent=g)
    box('lb_lock', 0.036, 0.004, 0.03, M['gold'], bevel=0.0015, loc=(0, -0.107, 0.036), parent=g)
    tube('lb_ring', [(-0.008, -0.111, 0.03), (-0.008, -0.114, 0.018), (0.0, -0.115, 0.012), (0.008, -0.114, 0.018), (0.008, -0.111, 0.03)], 0.0014, M['gold'], parent=g)
    for i, (dx, dy, rot) in enumerate(((-0.03, 0.01, 0.12), (0.035, -0.012, -0.2))):
        l = box(f'lb_letter{i}', 0.2, 0.09, 0.004, M['letter'], bevel=0.0008, loc=(dx, dy, 0.0748 + i * 0.0042), rot=(0, 0, rot), parent=g)
        box(f'lb_band{i}', 0.018, 0.092, 0.0006, M['silk_red'], loc=(dx + 0.03 * math.cos(rot), dy + 0.03 * math.sin(rot), 0.0788 + i * 0.0042), rot=(0, 0, rot), parent=g)
        seal = lathe(f'lb_wax{i}', [(0, 0), (0.011, 0), (0.012, 0.002), (0.009, 0.003), (0, 0.0032)], M['wax'], seg=24, parent=g, smooth=70)
        seal.location = (dx + 0.03 * math.cos(rot), dy + 0.03 * math.sin(rot), 0.0792 + i * 0.0042)
    return g


def make_tray():
    """笺匣：紫檀委角浅盘，矮边一圈，匣里三张花笺（纸笺材质各自独立，Three.js 里写字）"""
    g = group('tray')
    w, d, h, t, c = 0.32, 0.23, 0.014, 0.008, 0.02
    pts = [(-w / 2 + c, -d / 2), (w / 2 - c, -d / 2), (w / 2, -d / 2 + c), (w / 2, d / 2 - c), (w / 2 - c, d / 2), (-w / 2 + c, d / 2), (-w / 2, d / 2 - c), (-w / 2, -d / 2 + c)]
    inner = [(x * (1 - 2 * t / w), y * (1 - 2 * t / d)) for x, y in pts]
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, 0)) for x, y in pts]
    hi = [bm.verts.new((x, y, h)) for x, y in pts]
    ih = [bm.verts.new((x, y, h)) for x, y in inner]
    il = [bm.verts.new((x, y, 0.005)) for x, y in inner]
    n = len(pts)
    bm.faces.new(list(reversed(lo)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
        bm.faces.new((hi[i], hi[j], ih[j], ih[i]))
        bm.faces.new((ih[i], ih[j], il[j], il[i]))
    bm.faces.new(il)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    from_bmesh('tray_body', bm, M['zitan'], None, g)
    for i, (dx, rot) in enumerate(((-0.07, 0.07), (0.01, -0.05), (0.075, 0.1))):
        n_ = box(f'tray_note{i}', 0.1, 0.17, 0.0012, None, loc=(dx, 0.0, 0.005 + i * 0.0013), rot=(0, 0, rot), parent=g)
        n_.data.materials.append(mat(f'note_{i}', '#efe5cc', 0.9))
    return g


def make_weight():
    """镇尺：长条铜镇纸，中间一只卧兽钮。"""
    g = group('weight')
    box('weight_bar', 0.34, 0.032, 0.016, M['bronze'], bevel=0.003, seg=3, parent=g)
    z = 0.016
    joints = {'hip': ((-0.022, 0, z + 0.010), 0.008), 'sho': ((0.012, 0, z + 0.011), 0.0085), 'head': ((0.028, 0, z + 0.016), 0.0075),
              'nose': ((0.037, 0, z + 0.013), 0.0045), 'tail': ((-0.036, 0.006, z + 0.006), 0.0035),
              'fl': ((0.024, 0.008, z + 0.003), 0.0045), 'fr': ((0.024, -0.008, z + 0.003), 0.0045),
              'hl': ((-0.016, 0.009, z + 0.003), 0.0048), 'hr': ((-0.016, -0.009, z + 0.003), 0.0048)}
    bones = [('hip', 'sho'), ('sho', 'head'), ('head', 'nose'), ('hip', 'tail'), ('sho', 'fl'), ('sho', 'fr'), ('hip', 'hl'), ('hip', 'hr')]
    skin_creature('weight_knob', joints, bones, M['bronze'], parent=g)
    return g


# ---------------- 摆出来 ----------------
BUILDERS = [
    ('seal', make_seal), ('cushion', make_cushion), ('paste_box', make_paste_box), ('censer', make_censer),
    ('brush_ink', lambda: make_brush('brush_ink', 'hair_ink')), ('brush_red', lambda: make_brush('brush_red', 'hair_red')),
    ('brush_rest', make_brush_rest), ('inkstone', make_inkstone), ('ink_stick', make_ink_stick), ('dropper', make_dropper),
    ('tea', make_tea), ('brush_pot', make_brush_pot), ('book_a', lambda: make_book('book_a', 'cloth_blue')), ('book_b', lambda: make_book('book_b', 'cloth_brown')),
    ('memorial_plain', lambda: make_memorial('memorial_plain', 'fold_cover')), ('memorial_yellow', lambda: make_memorial('memorial_yellow', 'fold_yellow')),
    ('letterbox', make_letterbox), ('tray', make_tray), ('weight', make_weight),
]
objs = {}
for i, (name, fn) in enumerate(BUILDERS):
    ob = fn()
    objs[name] = ob

# 导出前删掉布尔刀具（修改器已在导出时应用）
cutters = [o for o in bpy.data.objects if o.get('cutter')]

os.makedirs(OUT_DIR, exist_ok=True)
glb = os.path.join(OUT_DIR, 'props.glb')
for o in bpy.data.objects:
    o.select_set(not o.get('cutter'))
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_apply=True, use_selection=True, export_yup=True,
                          export_materials='EXPORT', export_extras=False)
print('写出', glb, os.path.getsize(glb) // 1024, 'KB')

if PREVIEW:
    # 六列三行摆开，斜上方俯拍一张检查图
    cols = 6
    for i, (name, ob) in enumerate(objs.items()):
        ob.location = ((i % cols) * 0.42, -(i // cols) * 0.46, 0)
    bpy.ops.mesh.primitive_plane_add(size=20)
    floor = bpy.context.active_object
    floor.data.materials.append(mat('floor', '#6a4a30', 0.6))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    link(cam)
    cam.location = (1.05, -2.25, 1.45)
    cam.rotation_euler = (math.radians(50), 0, 0)
    cam.data.lens = 40
    scene.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    link(sun)
    sun.data.energy = 3.0
    sun.data.angle = math.radians(3)
    sun.rotation_euler = (math.radians(42), math.radians(-25), math.radians(35))
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.62, 0.62, 0.68, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 2400, 1500
    scene.render.filepath = os.path.join(OUT_DIR, 'props-preview.png')
    bpy.ops.render.render(write_still=True)
    print('预览', scene.render.filepath)
