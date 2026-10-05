"""甲 · 御书房整间屋子：Blender 无界面程序化建模，导出 room.glb 给 Three.js 用。

用法：blender -b -P build_room.py -- <输出目录> [preview]
  · 米制、Z 朝上、地面 Z=0；进 Three.js 后乘 1000、下移 780（案面在 y=0）、Blender 的 +Y 对应 Three.js 的 -Z
  · 三开间：柱在 x=±1.5、±4.5；南面（+Y，窗与门）在 y=2.0，北面（宝座屏风）在 y=-3.6
  · 西间那扇敞开的槛窗（直射光、光柱）仍由 Three.js 按 desk-room.js 的 WIN 生成，这里只留洞口；
    中间槅扇门与东间槛窗糊纸，只透柔光，在这里建
  · 材质只给底色与粗糙度；木纹、彩画、天花、地毯、画心在 Three.js 里按材质名贴图。
    需要贴整张图的面给 0~1 的 UV；平铺材质给「米」为单位的 UV（贴图 repeat 按每米几张算）
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
BAKE = next((int(a.split('=')[1]) for a in ARGS if a.startswith('bake=')), 0)   # bake=2048：烘整屋光照贴图的边长
SAMPLES = next((int(a.split('=')[1]) for a in ARGS if a.startswith('samples=')), 192)
TAU = math.tau

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------- 尺寸（米） ----------------
COLS_X = [-4.5, -1.5, 1.5, 4.5]
SOUTH, NORTH = 2.0, -3.6            # 南北两排柱中线
COL_R = 0.19
WALL_T = 0.16                        # 南面窗下墙、门窗所在那道「墙」的厚度（与 WIN.wallT 一致）
BEAM_Z0, BEAM_Z1 = 3.45, 3.75        # 额枋上下皮
CEIL = 4.4
SILL = 0.9                           # 槛墙高
WIN_Z0, WIN_Z1 = 0.98, 3.0           # 槛窗下上皮
DOOR_Z1 = 3.0
DESK_H = 0.78
ROOM_X = 4.5


# ---------------- 材质 ----------------
def srgb(hex_color):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(lin(int(hex_color[i:i + 2], 16)) for i in (1, 3, 5))


MATS = {}


def mat(name, color, rough=0.5, metal=0.0, coat=0.0, emit=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = (*srgb(color), 1)
        b.inputs['Emission Strength'].default_value = emit
    m.use_backface_culling = True
    MATS[name] = m
    return m


M = {
    'column': mat('column_lacquer', '#7e2419', 0.42, coat=0.3),
    'base': mat('stone_base', '#b9b2a4', 0.7),
    'caihua': mat('caihua', '#2f5e5a', 0.8),
    'beam': mat('beam_plain', '#2f4f4c', 0.8),
    'ceiling': mat('ceiling_panel', '#2b4f63', 0.85),
    'rib': mat('ceiling_rib', '#3d6b55', 0.8),
    'plaster': mat('plaster', '#e8dcc2', 0.92),
    'dado': mat('dado_wood', '#3b1e14', 0.45, coat=0.2),
    'floor': mat('floor_jinzhuan', '#3f4244', 0.3),
    'carpet': mat('carpet', '#c89b4e', 0.95),
    'frame': mat('window_frame', '#6a2a1a', 0.55),
    'lattice': mat('lattice_wood', '#7a3a22', 0.6),
    'paper': mat('window_paper', '#f3ead6', 0.9, emit=0.0),
    'door_panel': mat('door_panel', '#5c2416', 0.5, coat=0.2),
    'gilt': mat('gilt_line', '#b8914a', 0.35, 0.9),
    'zitan': mat('zitan', '#2a1410', 0.35, coat=0.35),
    'desk_top': mat('desk_top', '#6b3f24', 0.45, coat=0.35),
    'desk_wood': mat('desk_wood', '#5a3320', 0.45, coat=0.3),
    'case': mat('book_case', '#2c3c5c', 0.9),
    'case_bone': mat('case_bone', '#e8dfca', 0.4),
    'case_slip': mat('case_slip', '#efe6cf', 0.85),
    'scroll_box': mat('scroll_box', '#6e4a2a', 0.5),
    'screen_silk': mat('screen_painting', '#b39a64', 0.85),
    'throne_gold': mat('throne_gilt', '#b8914a', 0.35, 0.85),
    'throne_red': mat('throne_lacquer', '#6d1c12', 0.3, coat=0.8),
    'cushion': mat('cushion_yellow', '#c79a2c', 0.8),
    'lantern_wood': mat('lantern_wood', '#3a1a10', 0.4, coat=0.4),
    'lantern_silk': mat('lantern_silk', '#efe2c0', 0.8),
    'tassel': mat('tassel_red', '#9b1e14', 0.8),
    'plaque': mat('plaque', '#1b140f', 0.3, coat=0.6),
    'porcelain': mat('porcelain_blue', '#e9ecef', 0.1, coat=0.9),
    'branch': mat('plum_branch', '#2b1d16', 0.8),
    'blossom': mat('plum_blossom', '#f2e6e2', 0.6),
    'bronze': mat('bronze', '#6e4a2c', 0.36, 1.0),
    # 第四轮
    'throne_wood': mat('throne_zitan', '#2a1410', 0.34, coat=0.45),
    'throne_carved': mat('throne_carved', '#3a1c14', 0.45, coat=0.2),
    'throne_panel': mat('throne_panel', '#3a1c14', 0.4, coat=0.2),
    'door_skirt': mat('door_skirt', '#6a2418', 0.45, coat=0.3),
    'door_band': mat('door_band', '#6a2418', 0.45, coat=0.3),
    'lattice_gilt': mat('lattice_gilt', '#c9a05a', 0.3, 0.9),
    'plaque_frame': mat('plaque_frame', '#c9a05a', 0.35, 0.8),
    'lantern_paint': mat('lantern_paint', '#efe2c0', 0.8),
    'tassel_gold': mat('tassel_gold', '#c9a05a', 0.35, 0.8),
    'fan_face': mat('fan_face', '#d9a846', 0.7),
    'porcelain_lotus': mat('porcelain_lotus', '#eef0f2', 0.08, coat=0.9),
    'case_indigo': mat('case_indigo', '#26324d', 0.9),
    'case_blue': mat('case_blue', '#44607e', 0.9),
    'case_camel': mat('case_camel', '#a08050', 0.85),
    'case_brown': mat('case_brown', '#5a3a26', 0.9),
    'book_edge': mat('book_edge', '#e2d6b6', 0.9),
    'scroll_silk': mat('scroll_silk', '#cbbb96', 0.8),
    'scroll_blue': mat('scroll_blue', '#5d6f86', 0.8),
    'jade_white': mat('jade_white', '#e8e2cc', 0.25, coat=0.5),
    'brass': mat('brass', '#a8823e', 0.35, 1.0),
    'box_nanmu': mat('box_nanmu', '#8a6232', 0.45, coat=0.3),
    'blossom_heart': mat('blossom_heart', '#d8b24a', 0.6),
    'bud': mat('plum_bud', '#8a2a2a', 0.6),
    'celadon': mat('celadon_room', '#9ab8a0', 0.15, coat=0.8),
}


# ---------------- 造型工具 ----------------
def link(ob, parent=None):
    bpy.context.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def empty(name, loc=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None)
    ob.location = loc
    return link(ob, parent)


def world_uv(bm, scale=1.0):
    """按面朝向做盒式投影，UV 单位为米 × scale：平铺材质用"""
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for l in f.loops:
            co = l.vert.co
            if az >= ax and az >= ay:
                u, v = co.x, co.y
            elif ax >= ay:
                u, v = co.y, co.z
            else:
                u, v = co.x, co.z
            l[uvl].uv = (u * scale, v * scale)


def mesh_from(name, bm, material, parent=None, uv='world', uv_scale=1.0, smooth=False, recalc=True):
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    if recalc and len(bm.faces) > 1:
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if uv == 'world':
        bm.normal_update()
        world_uv(bm, uv_scale)
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me), parent)
    mats = material if isinstance(material, (list, tuple)) else [material]
    for m in mats:
        me.materials.append(m)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return ob


def add_box(bm, x0, y0, z0, x1, y1, z1, mat_index=0):
    vs = [bm.verts.new(v) for v in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                    (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    out = []
    for f in faces:
        face = bm.faces.new([vs[i] for i in f])
        face.material_index = mat_index
        out.append(face)
    return out


def box(name, x0, y0, z0, x1, y1, z1, material, parent=None, bevel=0.0, uv_scale=1.0):
    bm = bmesh.new()
    add_box(bm, min(x0, x1), min(y0, y1), min(z0, z1), max(x0, x1), max(y0, y1), max(z0, z1))
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES', profile=0.5)
    return mesh_from(name, bm, material, parent, uv_scale=uv_scale)


def lathe(name, profile, material, segments=48, parent=None, loc=(0, 0, 0), uv_scale=1.0, smooth=True):
    """绕 Z 轴旋出回转体；profile 为 [(半径, 高)]，自下而上"""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segments):
            a = TAU * i / segments
            ring.append(bm.verts.new((loc[0] + r * math.cos(a), loc[1] + r * math.sin(a), loc[2] + z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
    if profile[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if profile[-1][0] > 1e-4:
        bm.faces.new(rings[-1])
    return mesh_from(name, bm, material, parent, uv_scale=uv_scale, smooth=smooth)


def join(objs, name):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    objs[0].data.name = name
    return objs[0]


def apply_modifiers(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def prism(bm, pts, axis, a0, a1, mat_index=0):
    """二维轮廓挤出：pts 为轮廓点 [(u, z)]；axis='y' 时 u 即 x、沿 y 从 a0 挤到 a1；axis='x' 时 u 即 y、沿 x 挤"""
    def P(u, z, a):
        return (u, a, z) if axis == 'y' else (a, u, z)
    f0 = [bm.verts.new(P(u, z, a0)) for u, z in pts]
    f1 = [bm.verts.new(P(u, z, a1)) for u, z in pts]
    out = [bm.faces.new(f0), bm.faces.new(list(reversed(f1)))]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        out.append(bm.faces.new([f0[i], f0[j], f1[j], f1[i]]))
    for f in out:
        f.material_index = mat_index
    return out


def loft(bm, rings, cap=True):
    """同点数的几圈自下而上连成筒，两头封口"""
    vs = [[bm.verts.new(p) for p in r] for r in rings]
    n = len(rings[0])
    for a, b in zip(vs, vs[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new([a[i], a[j], b[j], b[i]])
    if cap:
        bm.faces.new(list(reversed(vs[0])))
        bm.faces.new(vs[-1])
    return vs


def ring_rect(cx, cy, hw, hd, z, c=0.0):
    """倒角矩形一圈（8 点，逆时针）"""
    return [(cx - hw + c, cy - hd, z), (cx + hw - c, cy - hd, z), (cx + hw, cy - hd + c, z), (cx + hw, cy + hd - c, z),
            (cx + hw - c, cy + hd, z), (cx - hw + c, cy + hd, z), (cx - hw, cy + hd - c, z), (cx - hw, cy - hd + c, z)]


def quad_uv(bm, corners, uvs, mat_index=0):
    """一块贴整图的面：corners 四角按「从正面看逆时针」给，uvs 一一对应"""
    uvl = bm.loops.layers.uv.verify()
    f = bm.faces.new([bm.verts.new(c) for c in corners])
    f.material_index = mat_index
    for l, uv in zip(f.loops, uvs):
        l[uvl].uv = uv
    return f


def face_uv(bm, plane, c, a0, a1, z0, z1, u=(0, 1), v=(0, 1), scale=None):
    """贴在某个面上的一块图：plane 是 '+y' '-y' '+x' '-x'（面朝向），c 为该面坐标，a0~a1 为横向范围。
    UV 从观者的左到右、自下而上；scale 给了就按米平铺（u、v 参数不再用）"""
    if scale:
        u = (0, (a1 - a0) * scale)
        v = (z0 * scale, z1 * scale)
    if plane == '+y':
        cs = [(a1, c, z0), (a0, c, z0), (a0, c, z1), (a1, c, z1)]
    elif plane == '-y':
        cs = [(a0, c, z0), (a1, c, z0), (a1, c, z1), (a0, c, z1)]
    elif plane == '+x':
        cs = [(c, a0, z0), (c, a1, z0), (c, a1, z1), (c, a0, z1)]
    else:
        cs = [(c, a1, z0), (c, a0, z0), (c, a0, z1), (c, a1, z1)]
    return quad_uv(bm, cs, [(u[0], v[0]), (u[1], v[0]), (u[1], v[1]), (u[0], v[1])])


def kunmen(L, top, depth, n=28, cusp=0.25, u0=0.0):
    """壸门牙板轮廓（u 从 u0-L 到 u0+L）：两头贴腿处垂得深，往中间收起，正中一个小尖朝下。返回 (闭合轮廓, 下沿点列)"""
    bottom = []
    for i in range(n + 1):
        u = -L + 2 * L * i / n
        k = abs(u) / L
        z = top - depth * (0.42 + 0.58 * k ** 5)
        z -= depth * cusp * max(0.0, 1 - abs(u) / (0.07 * L))
        bottom.append((u0 + u, z))
    return [(u0 - L, top), (u0 + L, top)] + list(reversed(bottom)), bottom


def bead(bm, bottom, axis, a0, a1, h=0.007):
    """沿下沿起一道阳线（细边条）"""
    pts = [(u, z) for u, z in bottom] + [(u, z + h) for u, z in reversed(bottom)]
    prism(bm, pts, axis, a0, a1)


def cyl(bm, p, axis, r, L, seg=12, r2=None):
    """圆柱（或圆台），中心 p，沿 axis ('x' 'y' 'z') 长 L"""
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=L)
    vs = geom['verts']
    if axis == 'x':
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'), verts=vs)
    elif axis == 'y':
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, 'X'), verts=vs)
    bmesh.ops.translate(bm, vec=p, verts=vs)
    return vs


def sphere(bm, p, r, scale=(1, 1, 1), seg=10):
    geom = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg * 2 // 3), radius=r)
    vs = geom['verts']
    bmesh.ops.scale(bm, vec=scale, verts=vs)
    bmesh.ops.translate(bm, vec=p, verts=vs)
    return vs


def lathe_uv(name, profile, material, segments=48, parent=None, loc=(0, 0, 0), smooth=True):
    """回转体，带整图 UV：u 绕一圈 0~1、v 按轮廓长度自下而上 0~1（瓷瓶贴纹样用）"""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    lens = [0.0]
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        lens.append(lens[-1] + math.hypot(r1 - r0, z1 - z0))
    total = lens[-1]
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((loc[0] + r * math.cos(TAU * i / segments), loc[1] + r * math.sin(TAU * i / segments), loc[2] + z)) for i in range(segments + 1)])
    for k in range(len(rings) - 1):
        for i in range(segments):
            f = bm.faces.new([rings[k][i], rings[k][i + 1], rings[k + 1][i + 1], rings[k + 1][i]])
            for l, (ii, kk) in zip(f.loops, [(i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1)]):
                l[uvl].uv = (ii / segments, lens[kk] / total)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    return mesh_from(name, bm, material, parent, uv=None, smooth=smooth, recalc=False)


def tassel(knots, threads, gold, p, length=0.3, strands=12, spread=0.022):
    """流苏：顶上一个盘长结（菱形扁结）、一颗金珠，下垂一束丝线，末梢微散"""
    x, y, z = p
    geom = bmesh.ops.create_cube(knots, size=1.0)
    bmesh.ops.scale(knots, vec=(0.034, 0.008, 0.034), verts=geom['verts'])
    bmesh.ops.rotate(knots, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 4, 3, 'Y'), verts=geom['verts'])
    bmesh.ops.translate(knots, vec=(x, y, z - 0.03), verts=geom['verts'])
    cyl(knots, (x, y, z - 0.006), 'z', 0.003, 0.012, seg=6)
    sphere(gold, (x, y, z - 0.068), 0.011)
    top = z - 0.078
    for i in range(strands):
        a = TAU * i / strands
        r0, r1 = 0.004, spread * (0.6 + 0.4 * ((i * 7) % 5) / 4)
        p0 = Vector((x + r0 * math.cos(a), y + r0 * math.sin(a), top))
        p1 = Vector((x + r1 * math.cos(a), y + r1 * math.sin(a), top - length * (0.94 + 0.06 * ((i * 3) % 4) / 3)))
        d = p1 - p0
        geom = bmesh.ops.create_cone(threads, cap_ends=False, segments=5, radius1=0.0022, radius2=0.0016, depth=d.length)
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix()
        bmesh.ops.rotate(threads, cent=(0, 0, 0), matrix=rot, verts=geom['verts'])
        bmesh.ops.translate(threads, vec=(p0 + p1) / 2, verts=geom['verts'])
    # 线束腰上一道金箍
    cyl(gold, (x, y, top - 0.012), 'z', 0.0075, 0.01, seg=10)


# ================= 屋架 =================
root = empty('room')

# 金砖地：整间一块，UV 按米（贴图每 0.64 米一块砖，在 Three.js 里拼缝）
box('floor', -ROOM_X - 0.3, NORTH - 0.3, -0.05, ROOM_X + 0.3, SOUTH + 0.2, 0.0, M['floor'], root)

# 柱：鼓镜柱础 + 朱漆圆柱（南北各四根）
for y in (SOUTH, NORTH):
    for x in COLS_X:
        lathe(f'column_base_{x}_{y}', [(0.30, 0.0), (0.30, 0.04), (0.27, 0.10), (0.215, 0.14), (0.0, 0.14)], M['base'], loc=(x, y, 0), uv_scale=2)
        lathe(f'column_{x}_{y}', [(COL_R + 0.005, 0.14), (COL_R, 0.2), (COL_R - 0.012, BEAM_Z1), (0.0, BEAM_Z1)], M['column'], loc=(x, y, 0), uv_scale=1)


def caihua_beam(name, x0, x1, y, z0, z1, depth, face_sign, split=0.28):
    """额枋：朝屋里那一面与底面贴彩画。面分三段（两头旋花、中间枋心），两头按图宽比例不拉伸"""
    bm = bmesh.new()
    y0, y1 = y - depth / 2, y + depth / 2
    faces = add_box(bm, x0, y0, z0, x1, y1, z1, 1)
    uvl = bm.loops.layers.uv.verify()
    for f in faces:
        for l in f.loops:
            l[uvl].uv = (0, 0)
    bm.faces.ensure_lookup_table()
    # 朝屋里那面：y 取朝屋内的一侧；重建三段
    yf = y0 if face_sign < 0 else y1
    for f in list(bm.faces):
        c = f.calc_center_median()
        if abs(c.y - yf) < 1e-5 and abs(f.normal.y) > 0.9:
            bm.faces.remove(f)
    h = z1 - z0
    L = x1 - x0
    end = min(L * 0.32, h * 3 * split)            # 图 3:1、每头占图宽 split → 这一头的长度
    segs = [(x0, x0 + end, 0.0, split), (x0 + end, x1 - end, split, 1 - split), (x1 - end, x1, 1 - split, 1.0)]
    for sx0, sx1, u0, u1 in segs:
        vs = [bm.verts.new((sx0, yf, z0)), bm.verts.new((sx1, yf, z0)), bm.verts.new((sx1, yf, z1)), bm.verts.new((sx0, yf, z1))]
        if face_sign > 0:
            vs = [vs[1], vs[0], vs[3], vs[2]]
            uvs = [(u1, 0), (u0, 0), (u0, 1), (u1, 1)]
        else:
            uvs = [(u0, 0), (u1, 0), (u1, 1), (u0, 1)]
        f = bm.faces.new(vs)
        f.material_index = 0
        for l, uv in zip(f.loops, uvs):
            l[uvl].uv = uv
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    return mesh_from(name, bm, [M['caihua'], M['beam']], root, uv=None)


# 额枋：南北两面三间各一根，东西两面各一根（贴彩画的一面朝屋里）
for i in range(3):
    xa, xb = COLS_X[i] + COL_R * 0.6, COLS_X[i + 1] - COL_R * 0.6
    caihua_beam(f'beam_s{i}', xa, xb, SOUTH, BEAM_Z0, BEAM_Z1, 0.26, -1)
    caihua_beam(f'beam_n{i}', xa, xb, NORTH, BEAM_Z0, BEAM_Z1, 0.26, +1)
for sx in (-1, 1):
    bm = bmesh.new()
    add_box(bm, sx * ROOM_X - 0.13, NORTH + COL_R, BEAM_Z0, sx * ROOM_X + 0.13, SOUTH - COL_R, BEAM_Z1)
    mesh_from(f'beam_side_{sx}', bm, M['beam'], root, uv_scale=1)

# 额枋以上到天花：走马板（粉墙），四面
for (xa, ya, xb, yb) in [(-ROOM_X, SOUTH - 0.02, ROOM_X, SOUTH + 0.02), (-ROOM_X, NORTH - 0.02, ROOM_X, NORTH + 0.02),
                         (-ROOM_X - 0.02, NORTH, -ROOM_X + 0.02, SOUTH), (ROOM_X - 0.02, NORTH, ROOM_X + 0.02, SOUTH)]:
    box(f'frieze_{xa}_{ya}', xa, ya, BEAM_Z1, xb, yb, CEIL, M['plaster'], root)

# 井口天花：支条网格 + 每格一块画板（每块 UV 0~1）
CELL = 0.62
nx = int((2 * ROOM_X) // CELL)
ny = int((SOUTH - NORTH) // CELL)
ox = -nx * CELL / 2
oy = (SOUTH + NORTH) / 2 - ny * CELL / 2
bm = bmesh.new()
uvl = bm.loops.layers.uv.verify()
RIB = 0.055
for i in range(nx):
    for j in range(ny):
        x0, y0 = ox + i * CELL + RIB / 2, oy + j * CELL + RIB / 2
        x1, y1 = x0 + CELL - RIB, y0 + CELL - RIB
        vs = [bm.verts.new((x0, y0, CEIL)), bm.verts.new((x0, y1, CEIL)), bm.verts.new((x1, y1, CEIL)), bm.verts.new((x1, y0, CEIL))]
        f = bm.faces.new(vs)
        for l, uv in zip(f.loops, [(0, 0), (0, 1), (1, 1), (1, 0)]):
            l[uvl].uv = uv
mesh_from('ceiling_panels', bm, M['ceiling'], root, uv=None, recalc=False)
bm = bmesh.new()
for i in range(nx + 1):
    x = ox + i * CELL
    add_box(bm, x - RIB / 2, oy, CEIL - 0.05, x + RIB / 2, oy + ny * CELL, CEIL)
for j in range(ny + 1):
    y = oy + j * CELL
    add_box(bm, ox, y - RIB / 2, CEIL - 0.05, ox + nx * CELL, y + RIB / 2, CEIL)
mesh_from('ceiling_ribs', bm, M['rib'], root, uv_scale=4)
# 天花外圈到墙：素板
bm = bmesh.new()
add_box(bm, -ROOM_X, NORTH, CEIL, ROOM_X, oy, CEIL + 0.02)
add_box(bm, -ROOM_X, oy + ny * CELL, CEIL, ROOM_X, SOUTH, CEIL + 0.02)
add_box(bm, -ROOM_X, oy, CEIL, ox, oy + ny * CELL, CEIL + 0.02)
add_box(bm, ox + nx * CELL, oy, CEIL, ROOM_X, oy + ny * CELL, CEIL + 0.02)
mesh_from('ceiling_border', bm, M['rib'], root, uv_scale=2)

# ================= 南面：槛墙、槅扇门、东间糊纸槛窗、西间敞窗洞口 =================
S_IN = SOUTH - WALL_T / 2            # 南面朝屋里的一侧


def sill_wall(x0, x1):
    """槛墙（内面护墙板）+ 风槛"""
    box(f'sill_wall_{x0:.2f}', x0, S_IN, 0.0, x1, SOUTH + WALL_T / 2 + 0.1, SILL, M['dado'], root, uv_scale=1)
    box(f'sill_rail_{x0:.2f}', x0, S_IN - 0.03, SILL, x1, SOUTH + WALL_T / 2, WIN_Z0, M['frame'], root, bevel=0.006)


def lattice_panel(bm, cx, cz, hw, hh, y, spacing=0.074, bar=0.011, flower=0.021, depth=0.024, gilt=None):
    """三交六椀菱花格心（与 desk-room.js 的 windowGeometry 同一算法），建在 XZ 平面、y 处"""
    n1, n2, n3 = (1.0, 0.0), (-0.5, math.sqrt(3) / 2), (0.5, math.sqrt(3) / 2)
    for n in (n1, n2, n3):
        t = (-n[1], n[0])
        K = int(math.ceil(math.hypot(hw, hh) / spacing)) + 1
        for k in range(-K, K + 1):
            o = (n[0] * k * spacing, n[1] * k * spacing)
            s0, s1 = -1e9, 1e9
            ok = True
            for oc, tc, lim in ((o[0], t[0], hw), (o[1], t[1], hh)):
                if abs(tc) < 1e-9:
                    if abs(oc) > lim:
                        ok = False
                    continue
                a, b = (-lim - oc) / tc, (lim - oc) / tc
                s0, s1 = max(s0, min(a, b)), min(s1, max(a, b))
            if not ok or s1 - s0 < 0.002:
                continue
            sm = (s0 + s1) / 2
            L = s1 - s0
            ang = math.atan2(t[1], t[0])
            px, pz = cx + o[0] + t[0] * sm, cz + o[1] + t[1] * sm
            geom = bmesh.ops.create_cube(bm, size=1.0)
            vs = geom['verts']
            bmesh.ops.scale(bm, vec=(L, depth, bar), verts=vs)
            bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(-ang, 3, 'Y'), verts=vs)
            bmesh.ops.translate(bm, vec=(px, y, pz), verts=vs)
    a = spacing / 0.866
    for j in range(-int(math.ceil(hw / spacing)), int(math.ceil(hw / spacing)) + 1):
        for i in range(-int(math.ceil(hh / a)) - 1, int(math.ceil(hh / a)) + 2):
            px, pz = j * spacing, i * a + j * a / 2
            if abs(px) > hw - flower * 0.5 or abs(pz) > hh - flower * 0.5:
                continue
            # 菱花：六瓣花形厚片，比棂条略厚
            n = 24
            pts = []
            for k in range(n):
                ang = TAU * k / n
                rr = flower * (0.72 + 0.28 * abs(math.cos(3 * ang)))
                pts.append((cx + px + rr * math.cos(ang), cz + pz + rr * math.sin(ang)))
            f0 = [bm.verts.new((u, y - (depth + 0.006) / 2, z)) for u, z in pts]
            f1 = [bm.verts.new((u, y + (depth + 0.006) / 2, z)) for u, z in pts]
            bm.faces.new(f0)
            bm.faces.new(list(reversed(f1)))
            for k in range(n):
                kk = (k + 1) % n
                bm.faces.new([f0[k], f0[kk], f1[kk], f1[k]])
            if gilt is not None:
                # 菱花钉：花心一颗描金小钉，朝屋里
                cyl(gilt, (cx + px, y - (depth + 0.006) / 2 - 0.003, cz + pz), 'y', flower * 0.3, 0.006, seg=10, r2=flower * 0.18)

def lattice_window(name, x0, x1, z0, z1, leaves, paper=True, frame=0.074, mullion=0.06, inner=0.028):
    """糊纸槛窗/槅扇格心：外框、分扇、仔边、菱花格，后衬一层窗纸"""
    fb = bmesh.new()
    lb = bmesh.new()
    gb = bmesh.new()
    w, h = x1 - x0, z1 - z0
    add_box(fb, x0, S_IN - 0.01, z1 - frame, x1, SOUTH + 0.05, z1)
    add_box(fb, x0, S_IN - 0.01, z0, x1, SOUTH + 0.05, z0 + frame)
    add_box(fb, x0, S_IN - 0.01, z0, x0 + frame, SOUTH + 0.05, z1)
    add_box(fb, x1 - frame, S_IN - 0.01, z0, x1, SOUTH + 0.05, z1)
    iw = w - 2 * frame
    pw = (iw - mullion * (leaves - 1)) / leaves
    for i in range(1, leaves):
        mx = x0 + frame + i * (pw + mullion) - mullion
        add_box(fb, mx, S_IN, z0 + frame, mx + mullion, SOUTH + 0.04, z1 - frame)
    yl = S_IN + 0.02
    for i in range(leaves):
        px0 = x0 + frame + i * (pw + mullion)
        px1 = px0 + pw
        add_box(fb, px0, S_IN + 0.005, z1 - frame - inner, px1, SOUTH, z1 - frame)
        add_box(fb, px0, S_IN + 0.005, z0 + frame, px1, SOUTH, z0 + frame + inner)
        add_box(fb, px0, S_IN + 0.005, z0 + frame, px0 + inner, SOUTH, z1 - frame)
        add_box(fb, px1 - inner, S_IN + 0.005, z0 + frame, px1, SOUTH, z1 - frame)
        lattice_panel(lb, (px0 + px1) / 2, (z0 + z1) / 2, pw / 2 - inner, h / 2 - frame - inner, yl, gilt=gb)
    mesh_from(name + '_frame', fb, M['frame'], root, uv_scale=2)
    mesh_from(name + '_lattice', lb, M['lattice'], root, uv_scale=4)
    mesh_from(name + '_gilt', gb, M['lattice_gilt'], root, uv_scale=8, smooth=True)
    if paper:
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.verify()
        vs = [bm.verts.new((x0 + frame, yl + 0.02, z0 + frame)), bm.verts.new((x1 - frame, yl + 0.02, z0 + frame)),
              bm.verts.new((x1 - frame, yl + 0.02, z1 - frame)), bm.verts.new((x0 + frame, yl + 0.02, z1 - frame))]
        f = bm.faces.new(vs)
        for l, uv in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
            l[uvl].uv = uv
        mesh_from(name + '_paper', bm, M['paper'], root, uv=None, recalc=False)


def door_leaves(x0, x1, leaves=4):
    """中间一间四扇槅扇：上格心菱花糊纸，中绦环板，下裙板（描金线框）"""
    frame = 0.07
    lw = (x1 - x0) / leaves
    for i in range(leaves):
        a, b = x0 + i * lw + 0.004, x0 + (i + 1) * lw - 0.004
        fb = bmesh.new()
        add_box(fb, a, S_IN, 0.0, a + frame, SOUTH + 0.03, DOOR_Z1)                  # 边梃
        add_box(fb, b - frame, S_IN, 0.0, b, SOUTH + 0.03, DOOR_Z1)
        for z in (0.0, 0.62, 0.74, 0.86, DOOR_Z1 - frame):                            # 抹头
            add_box(fb, a, S_IN, z, b, SOUTH + 0.03, z + frame)
        mesh_from(f'door_{i}_frame', fb, M['frame'], root, uv_scale=2)
        pb = bmesh.new()
        add_box(pb, a + frame, S_IN + 0.02, frame, b - frame, SOUTH, 0.62)            # 裙板
        add_box(pb, a + frame, S_IN + 0.02, 0.62 + frame, b - frame, SOUTH, 0.74)     # 绦环板
        mesh_from(f'door_{i}_panel', pb, M['door_panel'], root, uv_scale=2)
        # 朝屋里那面：裙板贴「如意云」雕花、绦环板取同一图的中间一条
        sk = bmesh.new()
        face_uv(sk, '-y', S_IN + 0.019, a + frame, b - frame, frame, 0.62)
        mesh_from(f'door_{i}_skirt', sk, M['door_skirt'], root, uv=None, recalc=False)
        bd = bmesh.new()
        face_uv(bd, '-y', S_IN + 0.019, a + frame, b - frame, 0.62 + frame, 0.74, v=(0.36, 0.64))
        mesh_from(f'door_{i}_band', bd, M['door_band'], root, uv=None, recalc=False)
        lattice_window(f'door_{i}_grid', a + frame - 0.074 + 0.001, b - frame + 0.074 - 0.001, 0.86, DOOR_Z1 - frame + 0.074, 1, paper=True)


# 西间：槛墙 + 洞口（敞窗由 Three.js 生成）；东间：槛墙 + 糊纸槛窗；中间：槅扇门
for (xa, xb) in [(-ROOM_X + COL_R, -1.5 - COL_R), (1.5 + COL_R, ROOM_X - COL_R)]:
    sill_wall(xa, xb)
lattice_window('east_window', 1.5 + COL_R, ROOM_X - COL_R, WIN_Z0, WIN_Z1, 3, paper=True)
door_leaves(-1.5 + COL_R, 1.5 - COL_R)
# 门窗上方的中槛与横披之间：粉墙到额枋
for (xa, xb) in [(-ROOM_X + COL_R, -1.5 - COL_R), (-1.5 + COL_R, 1.5 - COL_R), (1.5 + COL_R, ROOM_X - COL_R)]:
    box(f'upper_rail_{xa:.2f}', xa, S_IN - 0.02, WIN_Z1, xb, SOUTH + WALL_T / 2, WIN_Z1 + 0.1, M['frame'], root, bevel=0.006)
    box(f'upper_wall_{xa:.2f}', xa, S_IN, WIN_Z1 + 0.1, xb, SOUTH + WALL_T / 2, BEAM_Z0, M['plaster'], root)

# ================= 东西山墙：粉墙 + 下护墙板 =================
for sx in (-1, 1):
    x_in = sx * ROOM_X
    box(f'side_wall_{sx}', x_in, NORTH, 0.0, x_in + sx * 0.12, SOUTH, BEAM_Z0, M['plaster'], root)
    box(f'side_dado_{sx}', x_in - sx * 0.02, NORTH + COL_R, 0.0, x_in, SOUTH - COL_R, 1.0, M['dado'], root, uv_scale=1)
    box(f'side_dado_cap_{sx}', x_in - sx * 0.035, NORTH + COL_R, 1.0, x_in, SOUTH - COL_R, 1.04, M['frame'], root, bevel=0.005)
# 北墙
box('north_wall', -ROOM_X, NORTH - 0.12, 0.0, ROOM_X, NORTH, BEAM_Z0, M['plaster'], root)
box('north_dado', -ROOM_X + COL_R, NORTH, 0.0, ROOM_X - COL_R, NORTH + 0.02, 1.0, M['dado'], root, uv_scale=1)

# ================= 地毯 =================
bm = bmesh.new()
uvl = bm.loops.layers.uv.verify()
CW, CD = 3.6, 3.6
cy = 0.1
vs = [bm.verts.new((-CW / 2, cy - CD / 2, 0.006)), bm.verts.new((CW / 2, cy - CD / 2, 0.006)),
      bm.verts.new((CW / 2, cy + CD / 2, 0.006)), bm.verts.new((-CW / 2, cy + CD / 2, 0.006))]
f = bm.faces.new(vs)
for l, uv in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
    l[uvl].uv = uv
mesh_from('carpet', bm, M['carpet'], root, uv=None, recalc=False)

# ================= 御案：大画案（冰盘沿、束腰、牙板、马蹄足） =================
DW, DD = 3.8, 2.2
desk = empty('desk', parent=root)
top_t = 0.07
bm = bmesh.new()
add_box(bm, -DW / 2, -DD / 2, DESK_H - top_t, DW / 2, DD / 2, DESK_H)
bmesh.ops.bevel(bm, geom=[e for e in bm.edges], offset=0.012, segments=3, affect='EDGES', profile=0.5)
uvl = bm.loops.layers.uv.verify()
for fc in bm.faces:
    for l in fc.loops:
        co = l.vert.co
        l[uvl].uv = ((co.x + DW / 2) / DW, (co.y + DD / 2) / DD)
mesh_from('desk_top', bm, M['desk_top'], desk, uv=None)
# 冰盘沿下收：一圈向内斜收的边
bm = bmesh.new()
inset = 0.04
z_a, z_b = DESK_H - top_t, DESK_H - top_t - 0.035
ring_a = [(-DW / 2 + 0.005, -DD / 2 + 0.005), (DW / 2 - 0.005, -DD / 2 + 0.005), (DW / 2 - 0.005, DD / 2 - 0.005), (-DW / 2 + 0.005, DD / 2 - 0.005)]
ring_b = [(-DW / 2 + inset, -DD / 2 + inset), (DW / 2 - inset, -DD / 2 + inset), (DW / 2 - inset, DD / 2 - inset), (-DW / 2 + inset, DD / 2 - inset)]
va = [bm.verts.new((x, y, z_a)) for x, y in ring_a]
vb = [bm.verts.new((x, y, z_b)) for x, y in ring_b]
for i in range(4):
    j = (i + 1) % 4
    bm.faces.new([va[i], vb[i], vb[j], va[j]])
bm.faces.new(list(reversed(vb)))
mesh_from('desk_edge', bm, M['desk_wood'], desk, uv_scale=1.5)
# 束腰 + 牙板
wa = 0.075
z_waist0 = z_b - 0.03
box('desk_waist', -DW / 2 + inset + 0.01, -DD / 2 + inset + 0.01, z_waist0, DW / 2 - inset - 0.01, DD / 2 - inset - 0.01, z_b, M['zitan'], desk, uv_scale=2)
# 牙板：壸门轮廓，下沿起阳线；长边被中腿分成三段，每段各成一个壸门
apron_d = 0.13
bm = bmesh.new()
spans_x = [(-DW / 2 + inset, -0.7), (-0.7, 0.7), (0.7, DW / 2 - inset)]
for sy_ in (-1, 1):
    y_out = sy_ * (DD / 2 - inset)
    y_in = y_out - sy_ * 0.025
    for u0, u1 in spans_x:
        pts, bottom = kunmen((u1 - u0) / 2, z_waist0, apron_d, u0=(u0 + u1) / 2)
        prism(bm, pts, 'y', min(y_in, y_out), max(y_in, y_out))
        bead(bm, bottom, 'y', min(y_out, y_out + sy_ * 0.004), max(y_out, y_out + sy_ * 0.004))
for sx_ in (-1, 1):
    x_out = sx_ * (DW / 2 - inset)
    x_in = x_out - sx_ * 0.025
    pts, bottom = kunmen(DD / 2 - inset, z_waist0, apron_d)
    prism(bm, pts, 'x', min(x_in, x_out), max(x_in, x_out))
    bead(bm, bottom, 'x', min(x_out, x_out + sx_ * 0.004), max(x_out, x_out + sx_ * 0.004))
mesh_from('desk_aprons', bm, M['desk_wood'], desk, uv_scale=1.5)
# 腿：方材内翻马蹄足（腿在四角，另在长边中段各加一对，巨案要撑）
leg = 0.085
for lx in (-DW / 2 + inset + leg / 2, -0.7, 0.7, DW / 2 - inset - leg / 2):
    for ly in (-DD / 2 + inset + leg / 2, DD / 2 - inset - leg / 2):
        bm = bmesh.new()
        add_box(bm, lx - leg / 2, ly - leg / 2, 0.06, lx + leg / 2, ly + leg / 2, z_waist0)
        fx = 1 if lx < 0 else -1
        fy = 1 if ly < 0 else -1
        add_box(bm, lx - leg / 2 + min(fx, 0) * 0.02, ly - leg / 2 + min(fy, 0) * 0.02, 0.0,
                lx + leg / 2 + max(fx, 0) * 0.02, ly + leg / 2 + max(fy, 0) * 0.02, 0.06)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.006, segments=2, affect='EDGES', profile=0.5)
        mesh_from(f'desk_leg_{lx:.2f}_{ly:.2f}', bm, M['desk_wood'], desk, uv_scale=1.5)

# ================= 书格（东西两墙各两架） =================
# 线装书平放成摞（函套前沿两枚骨签），卷轴堆成垛、轴头朝外，间以书画匣、小瓶；每格前沿上方一道券口牙子
def bookcase(name, cx, cy, rot, w=1.1, d=0.42, h=2.3, shelves=5, seed=1):
    import random
    rnd = random.Random(seed)
    g = empty(name, (cx, cy, 0), root)
    g.rotation_euler = (0, 0, rot)
    t = 0.035
    body = bmesh.new()
    for x in (-w / 2 + t / 2, w / 2 - t / 2):                                          # 四腿
        for y in (-d / 2 + t / 2, d / 2 - t / 2):
            add_box(body, x - t / 2, y - t / 2, 0.0, x + t / 2, y + t / 2, h)
    add_box(body, -w / 2 - 0.015, -d / 2 - 0.015, h - t, w / 2 + 0.015, d / 2 + 0.015, h)   # 顶，略出檐
    add_box(body, -w / 2 + t, d / 2 - 0.012, 0.06, w / 2 - t, d / 2, h - t)               # 背板
    for x0 in (-w / 2 + 0.004, w / 2 - 0.016):                                        # 两侧装板
        add_box(body, x0, -d / 2 + t, 0.06, x0 + 0.012, d / 2 - t, h - t)
    add_box(body, -w / 2 + t, -d / 2, 0.0, w / 2 - t, -d / 2 + 0.02, 0.06)            # 底枨
    step = (h - 0.1 - t) / shelves
    W = w / 2 - t
    for k in range(shelves):
        z = 0.06 + k * step
        add_box(body, -W, -d / 2, z, W, d / 2 - 0.012, z + 0.022)
    bmesh.ops.bevel(body, geom=list(body.edges), offset=0.003, segments=1, affect='EDGES')
    # 券口：每格上沿一条，两角圆弧收下
    arch = bmesh.new()
    for k in range(shelves):
        top = 0.06 + (k + 1) * step if k < shelves - 1 else h - t
        bottom = []
        n = 40
        for i in range(n + 1):
            u = -W + 2 * W * i / n
            s_ = max(0.0, (abs(u) - (W - 0.1)) / 0.1)
            dz = 0.022 + 0.08 * (1 - math.sqrt(max(0.0, 1 - s_ * s_)))
            bottom.append((u, top - dz))
        prism(arch, [(-W, top), (W, top)] + list(reversed(bottom)), 'y', -d / 2, -d / 2 + 0.016)
        bead(arch, bottom, 'y', -d / 2 - 0.003, -d / 2)
    mesh_from(name + '_body', body, M['zitan'], g, uv_scale=2)
    mesh_from(name + '_arch', arch, M['zitan'], g, uv_scale=2)
    cases = {m: bmesh.new() for m in ('case_indigo', 'case_blue', 'case_camel', 'case_brown')}
    edges, bones, silk_, blue_, jade_, box_, brass_ = (bmesh.new() for _ in range(7))
    y_front = -d / 2 + 0.035
    for k in range(shelves):
        z = 0.06 + k * step + 0.022
        room_h = step - 0.022 - 0.11
        x = -W + 0.03
        while x < W - 0.12:
            kind = rnd.choices(['stack', 'books', 'scrolls', 'box', 'gap'], [0.46, 0.16, 0.2, 0.1, 0.08])[0]
            if kind == 'stack':
                cw, cd = rnd.uniform(0.23, 0.28), rnd.uniform(0.17, 0.2)
                if x + cw > W - 0.02:
                    break
                zz = z
                for _ in range(rnd.randint(2, 5)):
                    th = rnd.uniform(0.034, 0.062)
                    if zz + th > z + room_h:
                        break
                    dx = rnd.uniform(-0.01, 0.01)
                    y0 = y_front + rnd.uniform(0, 0.02)
                    add_box(cases[rnd.choice(list(cases))], x + dx, y0, zz, x + dx + cw, y0 + cd, zz + th)
                    for fx in (0.3, 0.7):
                        add_box(bones, x + dx + cw * fx - 0.006, y0 - 0.003, zz + th * 0.3, x + dx + cw * fx + 0.006, y0, zz + th * 0.7)
                    zz += th + 0.0015
                x += cw + rnd.uniform(0.015, 0.04)
            elif kind == 'books':
                cw, cd = rnd.uniform(0.2, 0.25), rnd.uniform(0.15, 0.18)
                if x + cw > W - 0.02:
                    break
                zz = z
                for _ in range(rnd.randint(3, 8)):
                    th = rnd.uniform(0.008, 0.016)
                    dx = rnd.uniform(-0.006, 0.006)
                    add_box(edges, x + dx, y_front, zz, x + dx + cw, y_front + cd, zz + th)
                    add_box(cases['case_indigo' if rnd.random() < 0.6 else 'case_blue'], x + dx - 0.001, y_front - 0.001, zz + th, x + dx + cw + 0.001, y_front + cd + 0.001, zz + th + 0.0015)
                    zz += th + 0.0015
                x += cw + rnd.uniform(0.015, 0.04)
            elif kind == 'scrolls':
                r = rnd.uniform(0.022, 0.03)
                L = min(d - 0.1, rnd.uniform(0.28, 0.34))
                cnt = rnd.choice([2, 3])
                if x + cnt * 2 * r + 0.02 > W - 0.02:
                    break
                for row in range(cnt):
                    for i in range(cnt - row):
                        px = x + r + i * 2 * r + row * r
                        pz = z + r + row * r * 1.732
                        cyl(silk_ if rnd.random() < 0.6 else blue_, (px, y_front + L / 2, pz), 'y', r, L, seg=12)
                        cyl(jade_, (px, y_front - 0.006, pz), 'y', r * 0.62, 0.014, seg=12)
                        if rnd.random() < 0.35:
                            add_box(jade_, px - 0.005, y_front - 0.012, pz - r - 0.034, px + 0.005, y_front - 0.009, pz - r - 0.006)
                x += cnt * 2 * r + rnd.uniform(0.02, 0.05)
            elif kind == 'box':
                bw, bdp, bh = rnd.uniform(0.3, 0.4), rnd.uniform(0.2, 0.26), rnd.uniform(0.08, 0.12)
                if x + bw > W - 0.02:
                    break
                add_box(box_, x, y_front, z, x + bw, y_front + bdp, z + bh)
                add_box(box_, x - 0.003, y_front - 0.003, z + bh - 0.018, x + bw + 0.003, y_front + bdp + 0.003, z + bh + 0.004)
                add_box(brass_, x + bw / 2 - 0.018, y_front - 0.006, z + bh * 0.45, x + bw / 2 + 0.018, y_front - 0.002, z + bh * 0.85)
                x += bw + rnd.uniform(0.02, 0.05)
            else:
                x += rnd.uniform(0.05, 0.12)
    for m, b in cases.items():
        mesh_from(f'{name}_{m}', b, M[m], g, uv_scale=6)
    for b, m in ((edges, 'book_edge'), (bones, 'case_bone'), (silk_, 'scroll_silk'), (blue_, 'scroll_blue'), (jade_, 'jade_white'), (box_, 'box_nanmu'), (brass_, 'brass')):
        mesh_from(f'{name}_{m}', b, M[m], g, uv_scale=6)
    # 顶上一两件陈设：小瓶
    if rnd.random() < 0.9:
        lathe_uv(name + '_vase', [(0.0, 0.0), (0.035, 0.0), (0.04, 0.01), (0.06, 0.07), (0.058, 0.12), (0.03, 0.17), (0.018, 0.19), (0.022, 0.21), (0.0, 0.21)],
                 M['porcelain_lotus'], segments=32, parent=g, loc=(rnd.uniform(-0.3, 0.3), 0.0, h))
    return g


bookcase('bookcase_w0', -ROOM_X + 0.24, -1.9, math.pi / 2, seed=3)
bookcase('bookcase_w1', -ROOM_X + 0.24, -0.6, math.pi / 2, seed=7)
bookcase('bookcase_e0', ROOM_X - 0.24, -1.9, -math.pi / 2, seed=11)
bookcase('bookcase_e1', ROOM_X - 0.24, -0.6, -math.pi / 2, seed=13)

# ================= 宝座与屏风（北面明间） =================
dais = empty('dais', parent=root)
box('dais_step', -1.9, NORTH + 0.1, 0.0, 1.9, -1.55, 0.16, M['zitan'], dais, bevel=0.01, uv_scale=1.5)


def lobe(s_, c, w, h):
    return h * math.sqrt(max(0.0, 1 - ((s_ - c) / w) ** 2))


def ruyi_top(x0, x1, top, ch, n=40):
    """云头帽的上沿：自右往左一串点（中间一大朵、两边各一小朵）"""
    pts = []
    for k in range(n + 1):
        s_ = k / n
        f = max(0.28, lobe(s_, 0.5, 0.2, 1.0), lobe(s_, 0.24, 0.12, 0.66), lobe(s_, 0.76, 0.12, 0.66))
        pts.append((x1 - s_ * (x1 - x0), top + ch * f))
    return pts


# ---- 屏风：五扇，收在两根金柱之间。紫檀框，裙板两面雕云，绢心一幅千里江山；每扇顶上云头屏帽，须弥底座两端站牙 ----
screen = empty('screen', parent=root)
SW, SH, SZ0 = 2.5, 2.45, 0.16
sy = NORTH + 0.34
panels = 5
pw = SW / panels
fr = 0.05
SK0, SK1 = SZ0 + 0.14, SZ0 + 0.56                   # 裙板上下沿
SILK0 = SK1 + fr * 0.7                              # 绢心下沿
TOPMAX = SZ0 + SH + 0.16
bm = bmesh.new()
silk = bmesh.new()
carv = bmesh.new()
crest = bmesh.new()
for i in range(panels):
    x0 = -SW / 2 + i * pw + 0.004
    x1 = x0 + pw - 0.008
    top = SZ0 + SH + (0.16 if i == 2 else (0.07 if i in (1, 3) else 0.0))
    add_box(bm, x0, sy - 0.035, SK0 - 0.02, x0 + fr, sy + 0.035, top)                  # 边梃
    add_box(bm, x1 - fr, sy - 0.035, SK0 - 0.02, x1, sy + 0.035, top)
    add_box(bm, x0 + fr, sy - 0.035, top - fr, x1 - fr, sy + 0.035, top)               # 上抹头
    add_box(bm, x0 + fr, sy - 0.035, SK0 - 0.02, x1 - fr, sy + 0.035, SK0 - 0.02 + fr) # 下抹头
    add_box(bm, x0 + fr, sy - 0.035, SK1, x1 - fr, sy + 0.035, SILK0)                   # 腰抹头
    add_box(bm, x0 + fr, sy - 0.018, SK0 - 0.02 + fr, x1 - fr, sy + 0.018, SK1)        # 裙板
    face_uv(carv, '+y', sy + 0.0185, x0 + fr, x1 - fr, SK0 - 0.02 + fr, SK1, scale=2.6)
    face_uv(carv, '-y', sy - 0.0185, x0 + fr, x1 - fr, SK0 - 0.02 + fr, SK1, scale=2.6)
    # 绢心：五扇连成一幅（朝南看，+x 在左手）
    sx0, sx1, sz0, sz1 = x0 + fr, x1 - fr, SILK0, top - fr
    face_uv(silk, '+y', sy + 0.012, sx0, sx1, sz0, sz1,
            u=((SW / 2 - sx1) / SW, (SW / 2 - sx0) / SW), v=((sz0 - SILK0) / (TOPMAX - fr - SILK0), (sz1 - SILK0) / (TOPMAX - fr - SILK0)))
    add_box(bm, sx0, sy - 0.004, sz0, sx1, sy + 0.011, sz1)                             # 绢心背后衬板
    # 屏帽
    prism(crest, [(x0, top), (x1, top)] + ruyi_top(x0, x1, top, 0.17 if i == 2 else 0.11), 'y', sy - 0.024, sy + 0.024)
# 须弥底座
add_box(bm, -SW / 2 - 0.12, sy - 0.2, SZ0, SW / 2 + 0.12, sy + 0.2, SZ0 + 0.05)
add_box(bm, -SW / 2 - 0.08, sy - 0.15, SZ0 + 0.05, SW / 2 + 0.08, sy + 0.15, SZ0 + 0.09)
add_box(bm, -SW / 2 - 0.1, sy - 0.17, SZ0 + 0.09, SW / 2 + 0.1, sy + 0.17, SK0 - 0.02)
# 站牙：两端前后各一块，弧线收向立柱
for sxs in (-1, 1):
    xc = sxs * (SW / 2 - 0.03)
    for sgn in (-1, 1):
        pts = [(sy + sgn * 0.035, SK0 - 0.02), (sy + sgn * 0.19, SK0 - 0.02)]
        for k in range(1, 17):
            a = (k / 16) * math.pi / 2
            pts.append((sy + sgn * (0.035 + 0.155 * (1 - math.sin(a))), SK0 - 0.02 + 0.46 * (1 - math.cos(a))))
        prism(bm, pts, 'x', xc - 0.014, xc + 0.014)
mesh_from('screen_frame', bm, M['zitan'], screen, uv_scale=2)
mesh_from('screen_skirt', carv, M['throne_carved'], screen, uv=None, recalc=False)
mesh_from('screen_crest', crest, M['throne_carved'], screen, uv_scale=2.6)
mesh_from('screen_painting', silk, M['screen_silk'], screen, uv=None, recalc=False)

# ---- 宝座：紫檀雕云龙。托泥龟足、鼓腿彭牙内翻马蹄、壸门牙板描金阳线、束腰、冰盘沿座面；
#      靠背屏风式三扇（中扇高，正面浮雕云龙，顶上卷书搭脑），扶手两级跌落；黄缎坐褥、靠枕、一对迎手；脚踏 ----
throne = empty('throne', (0, -2.35, 0.16), root)
TW, TD, SEAT = 1.36, 0.86, 0.46
TZ, TC, TG = M['throne_wood'], M['throne_carved'], M['throne_gold']
gb = bmesh.new()             # 描金件汇总
carved = bmesh.new()         # 雕云贴面汇总
bm = bmesh.new()
t = 0.07
for (x0, y0, x1, y1) in [(-TW / 2, -TD / 2, TW / 2, -TD / 2 + t), (-TW / 2, TD / 2 - t, TW / 2, TD / 2),
                         (-TW / 2, -TD / 2 + t, -TW / 2 + t, TD / 2 - t), (TW / 2 - t, -TD / 2 + t, TW / 2, TD / 2 - t)]:
    add_box(bm, x0, y0, 0.025, x1, y1, 0.07)
for sx in (-1, 1):
    for sy_ in (-1, 1):
        cx, cy = sx * (TW / 2 - 0.04), sy_ * (TD / 2 - 0.04)
        add_box(bm, cx - 0.04, cy - 0.04, 0.0, cx + 0.04, cy + 0.04, 0.025)
bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.006, segments=2, affect='EDGES', profile=0.5)
mesh_from('throne_tuoni', bm, TZ, throne, uv_scale=2)
# 腿：自上往下先鼓出、再收进，足端往里一翻
bm = bmesh.new()
prof = [(0.07, -0.022, 0.06), (0.09, -0.03, 0.064), (0.12, -0.016, 0.062), (0.17, 0.006, 0.064), (0.23, 0.024, 0.068),
        (0.29, 0.034, 0.072), (0.34, 0.036, 0.074), (SEAT - 0.09, 0.03, 0.076), (SEAT - 0.045, 0.022, 0.076)]
for sx in (-1, 1):
    for sy_ in (-1, 1):
        x, y = sx * (TW / 2 - 0.06), sy_ * (TD / 2 - 0.06)
        loft(bm, [ring_rect(x + sx * off, y + sy_ * off, w / 2, w / 2, z, c=0.012) for z, off, w in prof])
        fx, fy = x - sx * 0.03, y - sy_ * 0.03
        loft(bm, [ring_rect(fx, fy, 0.034, 0.034, 0.07, 0.01), ring_rect(fx - sx * 0.01, fy - sy_ * 0.01, 0.04, 0.04, 0.092, 0.012),
                  ring_rect(x - sx * 0.022, y - sy_ * 0.022, 0.032, 0.032, 0.125, 0.01)])
mesh_from('throne_legs', bm, TZ, throne, uv_scale=2, smooth=True)
# 彭牙：壸门牙板，下沿描金阳线
AT = SEAT - 0.085
bm = bmesh.new()
for sy_ in (-1, 1):
    yo, yi = sy_ * (TD / 2 + 0.006), sy_ * (TD / 2 - 0.02)
    pts, bottom = kunmen(TW / 2 - 0.06, AT, 0.11)
    prism(bm, pts, 'y', min(yo, yi), max(yo, yi))
    bead(gb, bottom, 'y', min(yo, yo + sy_ * 0.004), max(yo, yo + sy_ * 0.004), h=0.009)
for sx in (-1, 1):
    xo, xi = sx * (TW / 2 + 0.006), sx * (TW / 2 - 0.02)
    pts, bottom = kunmen(TD / 2 - 0.06, AT, 0.11)
    prism(bm, pts, 'x', min(xo, xi), max(xo, xi))
    bead(gb, bottom, 'x', min(xo, xo + sx * 0.004), max(xo, xo + sx * 0.004), h=0.009)
mesh_from('throne_apron', bm, TC, throne, uv_scale=3)
# 束腰（雕云）上下两道金线；座面冰盘沿
bm = bmesh.new()
add_box(bm, -TW / 2 + 0.035, -TD / 2 + 0.035, AT, TW / 2 - 0.035, TD / 2 - 0.035, SEAT - 0.045)
mesh_from('throne_waist', bm, TC, throne, uv_scale=5)
for z in (AT, SEAT - 0.05):
    add_box(gb, -TW / 2 + 0.03, -TD / 2 + 0.03, z, TW / 2 - 0.03, TD / 2 - 0.03, z + 0.005)
bm = bmesh.new()
loft(bm, [ring_rect(0, 0, TW / 2 - 0.022, TD / 2 - 0.022, SEAT - 0.045, 0.02), ring_rect(0, 0, TW / 2 - 0.008, TD / 2 - 0.008, SEAT - 0.025, 0.012),
          ring_rect(0, 0, TW / 2, TD / 2, SEAT - 0.005, 0.01), ring_rect(0, 0, TW / 2, TD / 2, SEAT + 0.02, 0.01)])
mesh_from('throne_seat', bm, TZ, throne, uv_scale=2)


def framed(bmf, axis, u0, u1, zlo, zhi, c, th, fw=0.055):
    """攒框装板：四根边框 + 退进的板心（axis='y'：板在 XZ 平面、中心 y=c；axis='x'：板在 YZ 平面、中心 x=c）"""
    hb = th / 2 - 0.012
    if axis == 'y':
        add_box(bmf, u0, c - th / 2, zlo, u0 + fw, c + th / 2, zhi)
        add_box(bmf, u1 - fw, c - th / 2, zlo, u1, c + th / 2, zhi)
        add_box(bmf, u0 + fw, c - th / 2, zhi - fw, u1 - fw, c + th / 2, zhi)
        add_box(bmf, u0 + fw, c - th / 2, zlo, u1 - fw, c + th / 2, zlo + fw)
        add_box(bmf, u0 + fw, c - hb, zlo + fw, u1 - fw, c + hb, zhi - fw)
    else:
        add_box(bmf, c - th / 2, u0, zlo, c + th / 2, u0 + fw, zhi)
        add_box(bmf, c - th / 2, u1 - fw, zlo, c + th / 2, u1, zhi)
        add_box(bmf, c - th / 2, u0 + fw, zhi - fw, c + th / 2, u1 - fw, zhi)
        add_box(bmf, c - th / 2, u0 + fw, zlo, c + th / 2, u1 - fw, zlo + fw)
        add_box(bmf, c - hb, u0 + fw, zlo + fw, c + hb, u1 - fw, zhi - fw)
    return hb + 0.0006


def gilt_ring(axis, u0, u1, zlo, zhi, c, w=0.008):
    """框里沿一圈描金起线（贴在板心那一面上）"""
    if axis == '+y' or axis == '-y':
        a, b = (c, c + 0.004) if axis == '+y' else (c - 0.004, c)
        for x0, x1, z0, z1 in ((u0, u1, zlo, zlo + w), (u0, u1, zhi - w, zhi), (u0, u0 + w, zlo, zhi), (u1 - w, u1, zlo, zhi)):
            add_box(gb, x0, a, z0, x1, b, z1)
    else:
        a, b = (c, c + 0.004) if axis == '+x' else (c - 0.004, c)
        for y0, y1, z0, z1 in ((u0, u1, zlo, zlo + w), (u0, u1, zhi - w, zhi), (u0, u0 + w, zlo, zhi), (u1 - w, u1, zlo, zhi)):
            add_box(gb, a, y0, z0, b, y1, z1)


BY, BT, FW_ = -TD / 2 + 0.06, 0.07, 0.055
z0 = SEAT + 0.02
frames = bmesh.new()
panel = bmesh.new()
for x0, x1, top, center in ((-0.37, 0.37, 1.34, True), (-TW / 2 + 0.03, -0.37, 1.1, False), (0.37, TW / 2 - 0.03, 1.1, False)):
    f = framed(frames, 'y', x0, x1, z0, top, BY, BT, FW_)
    ia, ib, iz0, iz1 = x0 + FW_, x1 - FW_, z0 + FW_, top - FW_
    if center:
        face_uv(panel, '+y', BY + f, ia, ib, iz0, iz1, u=(0.33, 0.89))                   # 正面：云龙浮雕
    else:
        face_uv(carved, '+y', BY + f, ia, ib, iz0, iz1, scale=2.6)
        prism(frames, [(x0, top), (x1, top)] + ruyi_top(x0, x1, top, 0.07), 'y', BY - BT / 2, BY + BT / 2)
    face_uv(carved, '-y', BY - f, ia, ib, iz0, iz1, scale=2.6)
    gilt_ring('+y', ia, ib, iz0, iz1, BY + f)
# 卷书搭脑：中扇顶上一卷，两头金色卷头
cyl(frames, (0, BY, 1.34 + 0.04), 'x', 0.052, 0.78, seg=24)
for sx in (-1, 1):
    cyl(gb, (sx * 0.395, BY, 1.34 + 0.04), 'x', 0.056, 0.014, seg=24)
    cyl(gb, (sx * 0.405, BY, 1.34 + 0.04), 'x', 0.03, 0.01, seg=16)
# 扶手：左右各两级，外里两面雕云
for sx in (-1, 1):
    c = sx * (TW / 2 - 0.045)
    for y0, y1, top in ((BY + BT / 2, BY + 0.34, 1.0), (BY + 0.34, TD / 2 - 0.03, 0.84)):
        f = framed(frames, 'x', y0, y1, z0, top, c, 0.06, FW_)
        face_uv(carved, '+x', c + f, y0 + FW_, y1 - FW_, z0 + FW_, top - FW_, scale=2.6)
        face_uv(carved, '-x', c - f, y0 + FW_, y1 - FW_, z0 + FW_, top - FW_, scale=2.6)
        gilt_ring('+x' if sx > 0 else '-x', y0 + FW_, y1 - FW_, z0 + FW_, top - FW_, c + sx * f)
bmesh.ops.bevel(frames, geom=list(frames.edges), offset=0.004, segments=1, affect='EDGES')
mesh_from('throne_frames', frames, TZ, throne, uv_scale=2)
mesh_from('throne_panel', panel, M['throne_panel'], throne, uv=None, recalc=False)
# 坐褥、靠枕、迎手（黄缎）
bm = bmesh.new()
add_box(bm, -TW / 2 + 0.085, BY + 0.04, SEAT + 0.02, TW / 2 - 0.085, TD / 2 - 0.02, SEAT + 0.105)
bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.03, segments=4, affect='EDGES', profile=0.6)
mesh_from('throne_cushion', bm, M['cushion'], throne, uv_scale=3, smooth=True)
bm = bmesh.new()
add_box(bm, -0.27, BY + 0.045, SEAT + 0.105, 0.27, BY + 0.14, SEAT + 0.5)
bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.04, segments=4, affect='EDGES', profile=0.6)
bmesh.ops.rotate(bm, cent=(0, BY + 0.045, SEAT + 0.105), matrix=Matrix.Rotation(math.radians(8), 3, 'X'), verts=bm.verts)
for sx in (-1, 1):
    x = sx * (TW / 2 - 0.16)
    cyl(bm, (x, 0.03, SEAT + 0.105 + 0.058), 'y', 0.058, 0.3, seg=24)
    cyl(gb, (x, 0.03 - 0.152, SEAT + 0.105 + 0.058), 'y', 0.05, 0.006, seg=24)
    cyl(gb, (x, 0.03 + 0.152, SEAT + 0.105 + 0.058), 'y', 0.05, 0.006, seg=24)
mesh_from('throne_pillows', bm, M['cushion'], throne, uv_scale=3, smooth=True)
# 脚踏
bm = bmesh.new()
add_box(bm, -0.55, TD / 2 + 0.05, 0.0, 0.55, TD / 2 + 0.37, 0.12)
bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.008, segments=2, affect='EDGES', profile=0.5)
mesh_from('throne_footrest', bm, TZ, throne, uv_scale=2)
face_uv(carved, '+y', TD / 2 + 0.3706, -0.52, 0.52, 0.015, 0.098, scale=2.6)
add_box(gb, -0.55, TD / 2 + 0.366, 0.104, 0.55, TD / 2 + 0.374, 0.112)
mesh_from('throne_carved_faces', carved, TC, throne, uv=None, recalc=False)
mesh_from('throne_gilt', gb, TG, throne, uv_scale=4)

# ---- 匾：青地金字（字在 Three.js 里写），斗形边框雕金龙，向前倾挂在额枋前 ----
plq = empty('plaque_group', (0, NORTH + 0.26, 3.93), root)
plq.rotation_euler = (math.radians(-10), 0, 0)
PW_, PH_, FR = 1.9, 0.5, 0.13
bm = bmesh.new()
uvl = bm.loops.layers.uv.verify()
for fc in add_box(bm, -PW_ / 2, -0.05, -PH_ / 2, PW_ / 2, 0.0, PH_ / 2):
    for l in fc.loops:
        co = l.vert.co
        l[uvl].uv = ((PW_ / 2 - co.x) / PW_, (co.z + PH_ / 2) / PH_)
mesh_from('plaque', bm, M['plaque'], plq, uv=None)
fb = bmesh.new()
ox, oz, ix, iz = PW_ / 2 + FR, PH_ / 2 + FR, PW_ / 2, PH_ / 2
yi, yo = 0.004, 0.07
band = math.hypot(FR, yo - yi) * 3.0          # 贴图一张（3:1）管这么长
# 上：外沿在上（图的上边在外）；下：外沿在下（图的上边在里）——两条上的龙都是正的
quad_uv(fb, [(ix, yi, iz), (-ix, yi, iz), (-ox, yo, oz), (ox, yo, oz)],
        [((ox - ix) / band, 0), ((ox + ix) / band, 0), (2 * ox / band, 1), (0, 1)])
quad_uv(fb, [(ox, yo, -oz), (-ox, yo, -oz), (-ix, yi, -iz), (ix, yi, -iz)],
        [(0, 0), (2 * ox / band, 0), ((ox + ix) / band, 1), ((ox - ix) / band, 1)])
# 左右两条（朝南看 +x 在左手）：外沿为图下边
quad_uv(fb, [(ox, yo, oz), (ox, yo, -oz), (ix, yi, -iz), (ix, yi, iz)],
        [(2 * oz / band, 0), (0, 0), ((oz - iz) / band, 1), ((oz + iz) / band, 1)])
quad_uv(fb, [(-ox, yo, -oz), (-ox, yo, oz), (-ix, yi, iz), (-ix, yi, -iz)],
        [(0, 0), (2 * oz / band, 0), ((oz + iz) / band, 1), ((oz - iz) / band, 1)])
mesh_from('plaque_frame', fb, M['plaque_frame'], plq, uv=None, recalc=False)
rim = bmesh.new()
add_box(rim, -ox, -0.06, oz - 0.006, ox, yo, oz)
add_box(rim, -ox, -0.06, -oz, ox, yo, -oz + 0.006)
add_box(rim, -ox, -0.06, -oz, -ox + 0.006, yo, oz)
add_box(rim, ox - 0.006, -0.06, -oz, ox, yo, oz)
add_box(rim, -ox, -0.07, -oz, ox, -0.06, oz)
mesh_from('plaque_rim', rim, M['throne_gold'], plq, uv_scale=4)
# 两根铁挺钩把匾顶拉在额枋上
hk = bmesh.new()
for sx in (-1, 1):
    cyl(hk, (sx * 0.7, -0.09, oz + 0.02), 'y', 0.008, 0.1, seg=8)
mesh_from('plaque_hooks', hk, M['lantern_wood'], plq, uv_scale=4)


# ---- 宫灯：六方，紫檀框，六面绢画；宝盖六角挑出挑杆，杆头垂流苏；底心宝珠一挂大流苏 ----
def lantern(name, x, y, z_bottom):
    g = empty(name, (x, y, z_bottom), root)
    R, H, Z0 = 0.24, 0.56, 0.16
    frame, paint, knots, threads, gold = (bmesh.new() for _ in range(5))
    pts = [(R * math.cos(TAU * i / 6 + TAU / 12), R * math.sin(TAU * i / 6 + TAU / 12)) for i in range(6)]
    for (px, py_) in pts:
        cyl(frame, (px, py_, Z0 + H / 2 + 0.01), 'z', 0.015, H + 0.1, seg=8)
        sphere(gold, (px, py_, Z0 + H + 0.07), 0.014)
        cyl(gold, (px, py_, Z0 - 0.045), 'z', 0.01, 0.03, seg=10, r2=0.006)      # 垂头：描金小宝瓶
        sphere(gold, (px, py_, Z0 - 0.066), 0.009)
    for z in (Z0, Z0 + 0.03, Z0 + H - 0.03, Z0 + H):
        for i in range(6):
            a, b = pts[i], pts[(i + 1) % 6]
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            tgt = gold if z in (Z0 + 0.03, Z0 + H - 0.03) else frame               # 里面两道横枨描金
            geom = bmesh.ops.create_cube(tgt, size=1.0)
            bmesh.ops.scale(tgt, vec=(L, 0.016, 0.014 if tgt is frame else 0.008), verts=geom['verts'])
            bmesh.ops.rotate(tgt, cent=(0, 0, 0), matrix=Matrix.Rotation(math.atan2(b[1] - a[1], b[0] - a[0]), 3, 'Z'), verts=geom['verts'])
            bmesh.ops.translate(tgt, vec=((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z), verts=geom['verts'])
    uvl_ = paint.loops.layers.uv.verify()
    for i in range(6):
        a, b = pts[i], pts[(i + 1) % 6]
        k = 0.965
        vs = [paint.verts.new((a[0] * k, a[1] * k, Z0 + 0.038)), paint.verts.new((b[0] * k, b[1] * k, Z0 + 0.038)),
              paint.verts.new((b[0] * k, b[1] * k, Z0 + H - 0.038)), paint.verts.new((a[0] * k, a[1] * k, Z0 + H - 0.038))]
        fc = paint.faces.new(vs)
        flip = i % 2
        for l, uv in zip(fc.loops, [(flip, 0), (1 - flip, 0), (1 - flip, 1), (flip, 1)]):
            l[uvl_].uv = uv
    # 宝盖两层、宝顶
    for r1, r2, dep, zc in ((R * 1.16, R * 0.92, 0.05, Z0 + H + 0.035), (R * 0.84, R * 0.5, 0.08, Z0 + H + 0.1)):
        geom = bmesh.ops.create_cone(frame, cap_ends=True, segments=6, radius1=r1, radius2=r2, depth=dep)
        bmesh.ops.rotate(frame, cent=(0, 0, 0), matrix=Matrix.Rotation(TAU / 12, 3, 'Z'), verts=geom['verts'])
        bmesh.ops.translate(frame, vec=(0, 0, zc), verts=geom['verts'])
    sphere(gold, (0, 0, Z0 + H + 0.17), 0.035)
    cyl(gold, (0, 0, Z0 + H + 0.215), 'z', 0.008, 0.05, seg=8, r2=0.002)
    # 挑杆：六角挑出，先平后翘，杆头金珠，垂流苏
    for (px, py_) in pts:
        d = Vector((px, py_, 0)).normalized()
        chain = [Vector((px, py_, Z0 + H + 0.05)), Vector((px, py_, Z0 + H + 0.05)) + d * 0.1 + Vector((0, 0, 0.01)),
                 Vector((px, py_, Z0 + H + 0.05)) + d * 0.17 + Vector((0, 0, 0.05))]
        for p0, p1 in zip(chain, chain[1:]):
            v = p1 - p0
            geom = bmesh.ops.create_cone(frame, cap_ends=True, segments=8, radius1=0.011, radius2=0.009, depth=v.length)
            bmesh.ops.rotate(frame, cent=(0, 0, 0), matrix=Vector((0, 0, 1)).rotation_difference(v.normalized()).to_matrix(), verts=geom['verts'])
            bmesh.ops.translate(frame, vec=(p0 + p1) / 2, verts=geom['verts'])
        tip = chain[-1]
        sphere(gold, tip, 0.016)
        tassel(knots, threads, gold, (tip.x, tip.y, tip.z - 0.02), length=0.3, strands=10, spread=0.018)
    # 底：六角托盘，底心宝珠与大流苏
    geom = bmesh.ops.create_cone(frame, cap_ends=True, segments=6, radius1=R * 0.86, radius2=R * 1.04, depth=0.026)
    bmesh.ops.rotate(frame, cent=(0, 0, 0), matrix=Matrix.Rotation(TAU / 12, 3, 'Z'), verts=geom['verts'])
    bmesh.ops.translate(frame, vec=(0, 0, Z0 - 0.013), verts=geom['verts'])
    cyl(gold, (0, 0, Z0 - 0.04), 'z', 0.022, 0.03, seg=16, r2=0.04)            # 底心描金莲座
    sphere(gold, (0, 0, Z0 - 0.07), 0.024)
    tassel(knots, threads, gold, (0, 0, Z0 - 0.09), length=0.42, strands=18, spread=0.032)
    # 吊杆与挂钩
    cyl(frame, (0, 0, (Z0 + H + 0.24 + CEIL - z_bottom) / 2), 'z', 0.011, CEIL - z_bottom - Z0 - H - 0.24, seg=8)
    mesh_from(name + '_frame', frame, M['lantern_wood'], g, uv_scale=6)
    mesh_from(name + '_paint', paint, M['lantern_paint'], g, uv=None, recalc=False)
    mesh_from(name + '_knots', knots, M['tassel'], g, uv_scale=6)
    mesh_from(name + '_threads', threads, M['tassel'], g, uv_scale=6, smooth=True)
    mesh_from(name + '_gold', gold, M['tassel_gold'], g, uv_scale=6, smooth=True)
    return g


lantern('lantern_w', -2.6, -0.6, 2.5)
lantern('lantern_e', 2.6, -0.6, 2.5)

# ---- 西间窗下：三弯腿香几，青花梅瓶插一枝老梅 ----
stand = empty('flower_stand', (-3.55, 1.35, 0), root)
lathe('stand_top', [(0.0, 0.9), (0.2, 0.9), (0.215, 0.912), (0.215, 0.932), (0.203, 0.948), (0.0, 0.948)], M['zitan'], segments=48, parent=stand)
lathe('stand_waist', [(0.0, 0.85), (0.168, 0.85), (0.168, 0.9), (0.0, 0.9)], M['zitan'], segments=40, parent=stand)
lathe('stand_ring', [(0.15, 0.0), (0.2, 0.0), (0.2, 0.03), (0.15, 0.03)], M['zitan'], segments=40, parent=stand)
bm = bmesh.new()
for i in range(4):
    a = TAU * i / 4 + TAU / 8
    ca, sa = math.cos(a), math.sin(a)
    curve = [(0.172, 0.852), (0.2, 0.74), (0.19, 0.6), (0.14, 0.4), (0.13, 0.2), (0.16, 0.07), (0.185, 0.03)]
    loft(bm, [ring_rect(r * ca, r * sa, 0.019, 0.019, z, 0.006) for r, z in reversed(curve)])
mesh_from('stand_legs', bm, M['zitan'], stand, uv_scale=3, smooth=True)
lathe_uv('meiping', [(0.0, 0.95), (0.074, 0.95), (0.078, 0.965), (0.082, 1.03), (0.098, 1.14), (0.122, 1.26), (0.136, 1.33), (0.138, 1.36),
                     (0.128, 1.395), (0.1, 1.425), (0.062, 1.443), (0.034, 1.452), (0.029, 1.47), (0.031, 1.486), (0.038, 1.49), (0.036, 1.5), (0.0, 1.5)],
         M['porcelain_lotus'], segments=64, parent=stand)
import random
rnd = random.Random(5)
branch_bm, blossom_bm, heart_bm, bud_bm = bmesh.new(), bmesh.new(), bmesh.new(), bmesh.new()


def plum_flower(p, nrm, r):
    """五瓣梅：五片压扁的小瓣绕花心一圈，花心一点黄蕊"""
    nrm = nrm.normalized()
    t1 = nrm.orthogonal().normalized()
    t2 = nrm.cross(t1)
    a0 = rnd.uniform(0, TAU)
    for k in range(5):
        a = a0 + TAU * k / 5
        radial = t1 * math.cos(a) + t2 * math.sin(a)
        tang = nrm.cross(radial)
        vs = sphere(blossom_bm, (0, 0, 0), 1.0, scale=(r * 0.55, r * 0.46, r * 0.16), seg=8)
        rot = Matrix((radial, tang, nrm)).transposed()
        bmesh.ops.rotate(blossom_bm, cent=(0, 0, 0), matrix=rot, verts=vs)
        bmesh.ops.translate(blossom_bm, vec=p + radial * r * 0.55 + nrm * r * 0.12, verts=vs)
    sphere(heart_bm, p + nrm * r * 0.22, r * 0.2, seg=6)


def twig(p, d, length, radius, depth):
    if depth == 0 or radius < 0.0018:
        if rnd.random() < 0.7:
            plum_flower(p, d + Vector((rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), 0.3)), rnd.uniform(0.011, 0.014))
        else:
            sphere(bud_bm, p, 0.005, seg=6)
        return
    # 一段枝分两三折，转折处略顿
    q = p
    for s_ in range(3):
        dd = (d + Vector((rnd.uniform(-0.45, 0.45), rnd.uniform(-0.45, 0.45), rnd.uniform(-0.15, 0.3)))).normalized()
        q2 = q + dd * length / 3
        geom = bmesh.ops.create_cone(branch_bm, cap_ends=True, segments=6, radius1=radius, radius2=radius * 0.88, depth=length / 3)
        rot = Vector((0, 0, 1)).rotation_difference(dd).to_matrix()
        bmesh.ops.rotate(branch_bm, cent=(0, 0, 0), matrix=rot, verts=geom['verts'])
        bmesh.ops.translate(branch_bm, vec=(q + q2) / 2, verts=geom['verts'])
        q = q2
        radius *= 0.88
    if rnd.random() < 0.55:
        plum_flower(q + Vector((rnd.uniform(-0.01, 0.01), rnd.uniform(-0.01, 0.01), 0.008)), Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.6)), rnd.uniform(0.01, 0.013))
    if rnd.random() < 0.4:
        sphere(bud_bm, q + Vector((0.01, 0, 0.004)), 0.0045, seg=6)
    for k in range(2 if depth > 1 else rnd.randint(1, 3)):
        nd = (d + Vector((rnd.uniform(-0.9, 0.9), rnd.uniform(-0.9, 0.9), rnd.uniform(-0.1, 0.5)))).normalized()
        twig(q, nd, length * rnd.uniform(0.55, 0.8), radius * 0.72, depth - 1)


twig(Vector((0, 0, 1.47)), Vector((0.3, -0.12, 1)).normalized(), 0.26, 0.0085, 5)
twig(Vector((0, 0, 1.47)), Vector((-0.65, 0.2, 0.75)).normalized(), 0.22, 0.0075, 5)
twig(Vector((0, 0.005, 1.47)), Vector((0.1, 0.5, 0.9)).normalized(), 0.16, 0.006, 4)
mesh_from('plum_branches', branch_bm, M['branch'], stand, uv_scale=8, smooth=True)
mesh_from('plum_blossoms', blossom_bm, M['blossom'], stand, uv_scale=8, smooth=True)
mesh_from('plum_hearts', heart_bm, M['blossom_heart'], stand, uv_scale=8, smooth=True)
mesh_from('plum_buds', bud_bm, M['bud'], stand, uv_scale=8, smooth=True)

# ---- 宝座后一对宫扇：十字座、紫檀扇杆三道金箍，椭圆扇面绣双凤（扇面图里椭圆占宽 FAN_W、高 FAN_H） ----
FAN_W, FAN_H = 1.0, 0.985
for sx in (-1, 1):
    fg = empty(f'fan_{"we"[sx > 0]}', (sx * 0.98, -2.98, 0.16), root)
    fg.rotation_euler = (0, 0, -sx * math.radians(12))
    bm = bmesh.new()
    add_box(bm, -0.22, -0.035, 0.0, 0.22, 0.035, 0.06)
    add_box(bm, -0.035, -0.22, 0.0, 0.035, 0.22, 0.06)
    cyl(bm, (0, 0, 0.12), 'z', 0.05, 0.12, seg=16, r2=0.035)
    cyl(bm, (0, 0, 1.2), 'z', 0.021, 2.1, seg=12)
    mesh_from(f'fan_{sx}_pole', bm, TZ, fg, uv_scale=3)
    g2 = bmesh.new()
    for z in (0.3, 1.0, 2.2):
        cyl(g2, (0, 0, z), 'z', 0.026, 0.024, seg=12)
    A, B = 0.3, 0.444
    zc = 2.26 + B
    n = 64
    ring = [(A * math.cos(TAU * i / n), zc + B * math.sin(TAU * i / n)) for i in range(n)]
    for i in range(n):
        (xa, za), (xb, zb) = ring[i], ring[(i + 1) % n]
        v = Vector((xb - xa, 0, zb - za))
        geom = bmesh.ops.create_cone(g2, cap_ends=True, segments=6, radius1=0.011, radius2=0.011, depth=v.length * 1.05)
        bmesh.ops.rotate(g2, cent=(0, 0, 0), matrix=Vector((0, 0, 1)).rotation_difference(v.normalized()).to_matrix(), verts=geom['verts'])
        bmesh.ops.translate(g2, vec=((xa + xb) / 2, 0, (za + zb) / 2), verts=geom['verts'])
    sphere(g2, (0, 0, zc + B + 0.03), 0.028)
    mesh_from(f'fan_{sx}_gold', g2, M['tassel_gold'], fg, uv_scale=4, smooth=True)
    face = bmesh.new()
    uvl = face.loops.layers.uv.verify()
    for side, yy in ((1, 0.004), (-1, -0.004)):
        order = list(reversed(ring)) if side > 0 else ring
        f = face.faces.new([face.verts.new((x, yy, z)) for x, z in order])
        for l in f.loops:
            co = l.vert.co
            l[uvl].uv = (0.5 - side * co.x / A * FAN_W / 2, 0.5 + (co.z - zc) / B * FAN_H / 2)
    mesh_from(f'fan_{sx}_face', face, M['fan_face'], fg, uv=None, recalc=False)

# ---- 宝座前两侧一对香几，几上三足鼎炉（烟在 Three.js 里画） ----
for sx in (-1, 1):
    ig = empty(f'incense_{"we"[sx > 0]}', (sx * 1.1, -1.76, 0.16), root)
    bm = bmesh.new()
    loft(bm, [ring_rect(0, 0, 0.17, 0.17, 0.66, 0.008), ring_rect(0, 0, 0.19, 0.19, 0.68, 0.008), ring_rect(0, 0, 0.19, 0.19, 0.7, 0.008), ring_rect(0, 0, 0.18, 0.18, 0.715, 0.01)])
    add_box(bm, -0.155, -0.155, 0.62, 0.155, 0.155, 0.66)
    for fx in (-1, 1):
        for fy in (-1, 1):
            curve = [(0.15, 0.62), (0.165, 0.5), (0.15, 0.36), (0.125, 0.2), (0.12, 0.08), (0.135, 0.035), (0.15, 0.02)]
            loft(bm, [ring_rect(fx * c, fy * c, 0.017, 0.017, z, 0.005) for c, z in reversed(curve)])
    for (x0, y0, x1, y1) in [(-0.17, -0.17, 0.17, -0.13), (-0.17, 0.13, 0.17, 0.17), (-0.17, -0.13, -0.13, 0.13), (0.13, -0.13, 0.17, 0.13)]:
        add_box(bm, x0, y0, 0.0, x1, y1, 0.025)
    mesh_from(f'incense_{sx}_stand', bm, M['zitan'], ig, uv_scale=3, smooth=False)
    k = 2.4
    body = [(0, 0.030), (0.036, 0.030), (0.052, 0.040), (0.062, 0.058), (0.062, 0.078), (0.055, 0.094), (0.052, 0.100),
            (0.056, 0.104), (0.058, 0.108), (0.052, 0.110), (0.049, 0.102), (0.048, 0.096), (0, 0.090)]
    lathe(f'incense_{sx}_censer', [(r * k, 0.715 + z * k) for r, z in body], M['bronze'], segments=40, parent=ig)
    bm = bmesh.new()
    for i in range(3):
        a = TAU * i / 3 + math.pi / 2
        cyl(bm, (0.036 * k * math.cos(a), 0.036 * k * math.sin(a), 0.715 + 0.018 * k), 'z', 0.011 * k * 0.8, 0.036 * k, seg=10, r2=0.008 * k * 0.8)
    # 朝天双耳：立在口沿左右，一道拱
    rim_z = 0.715 + 0.108 * k
    for s_ in (-1, 1):
        arch = [Vector((s_ * 0.05 * k, 0.018 * k * math.cos(math.pi * j / 10), rim_z + 0.026 * k * math.sin(math.pi * j / 10))) for j in range(11)]
        for p0, p1 in zip(arch, arch[1:]):
            v = p1 - p0
            geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.0045 * k, radius2=0.0045 * k, depth=v.length * 1.1)
            bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Vector((0, 0, 1)).rotation_difference(v.normalized()).to_matrix(), verts=geom['verts'])
            bmesh.ops.translate(bm, vec=(p0 + p1) / 2, verts=geom['verts'])
    lathe(f'incense_{sx}_ash', [(0, 0.715 + 0.0955 * k), (0.047 * k, 0.715 + 0.0955 * k), (0, 0.715 + 0.097 * k)], M['base'], segments=32, parent=ig)
    mesh_from(f'incense_{sx}_parts', bm, M['bronze'], ig, uv_scale=6, smooth=True)


# ================= 烘光照（可选） =================
# 只烘「天光 + 糊纸门窗透进来的光」的直接与间接漫射（不含颜色），存成 HDR；太阳在 Three.js 里实时算（每个镜头方向不同）
def bake_lightmap(size):
    bake_only = []
    # 西间敞窗的菱花格（Three.js 那边另建同一套尺寸的真几何），这里补一份只为挡光
    lb = bmesh.new()
    wx0, wx1 = -ROOM_X + COL_R, -1.5 - COL_R
    frame, mullion, inner, leaves = 0.074, 0.06, 0.028, 3
    fb = bmesh.new()
    add_box(fb, wx0, SOUTH - 0.055, WIN_Z1 - frame, wx1, SOUTH + 0.055, WIN_Z1)
    add_box(fb, wx0, SOUTH - 0.055, WIN_Z0, wx1, SOUTH + 0.055, WIN_Z0 + frame)
    pw_ = (wx1 - wx0 - 2 * frame - mullion * (leaves - 1)) / leaves
    for i in range(leaves):
        px0 = wx0 + frame + i * (pw_ + mullion)
        if i:
            add_box(fb, px0 - mullion, SOUTH - 0.045, WIN_Z0, px0, SOUTH + 0.045, WIN_Z1)
        lattice_panel(lb, px0 + pw_ / 2, (WIN_Z0 + WIN_Z1) / 2, pw_ / 2 - inner, (WIN_Z1 - WIN_Z0) / 2 - frame - inner, SOUTH, flower=0.021)
    bake_only.append(mesh_from('bake_window_frame', fb, M['frame'], root))
    bake_only.append(mesh_from('bake_window_lattice', lb, M['lattice'], root))
    # 屋顶盖严、窗外一片石地（天光从地面反进窗来）
    bake_only.append(box('bake_roof', -ROOM_X - 0.5, NORTH - 0.5, CEIL + 0.03, ROOM_X + 0.5, SOUTH + 0.5, CEIL + 0.3, M['plaster'], root))
    ground = mat('bake_ground', '#cfc6b4', 0.8)
    bake_only.append(box('bake_ground', -12, SOUTH + 0.2, -0.3, 12, 14, -0.02, ground, root))
    bake_only.append(box('bake_court_wall', -12, 12, 0, 12, 12.4, 4.5, mat('bake_wall', '#a0453a', 0.9), root))

    # 细碎件（窗格、书函、穗子、梅枝……）不进光照贴图，Three.js 里用屋子的环境光照它们
    skip = {'lattice_wood', 'book_case', 'case_bone', 'case_slip', 'scroll_box', 'plum_branch', 'plum_blossom', 'tassel_red',
            'lantern_wood', 'lantern_silk', 'gilt_line', 'porcelain_blue', 'window_paper', 'throne_gilt',
            'lattice_gilt', 'plaque_frame', 'lantern_paint', 'tassel_gold', 'fan_face', 'porcelain_lotus', 'case_indigo', 'case_blue',
            'case_camel', 'case_brown', 'book_edge', 'scroll_silk', 'scroll_blue', 'jade_white', 'brass', 'box_nanmu', 'blossom_heart',
            'plum_bud', 'celadon_room', 'bronze'}
    statics = [o for o in scene.objects if o.type == 'MESH' and o not in bake_only
               and not any(m.name in skip for m in o.data.materials)]
    for o in statics:
        o.data = o.data.copy() if o.data.users > 1 else o.data
    bpy.ops.object.select_all(action='DESELECT')
    for o in statics:
        o.select_set(True)
    bpy.context.view_layer.objects.active = statics[0]
    bpy.ops.object.make_single_user(object=True, obdata=True)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')      # 先脱父级、保住世界位置，再把变换落进网格
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.objects.active = statics[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = 'room_static'
    ob.data.name = 'room_static'
    me = ob.data
    base_name = me.uv_layers[0].name
    me.uv_layers.new(name='lightmap')
    me.uv_layers.active_index = len(me.uv_layers) - 1   # 层数组会重排，别留旧引用
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=0.0025, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    print('LIGHTMAP uv done', len(me.polygons))

    img = bpy.data.images.new('room_lightmap', size, size, float_buffer=True)
    added = []
    for m in me.materials:
        nt = m.node_tree
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = img
        nt.nodes.active = n
        added.append((nt, n))
    # 窗纸自发光：外头的天光透过高丽纸
    pb = MATS['window_paper'].node_tree.nodes['Principled BSDF']
    pb.inputs['Emission Color'].default_value = (1.0, 0.93, 0.82, 1)
    pb.inputs['Emission Strength'].default_value = 8.0
    world = bpy.data.worlds.new('sky')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.78, 0.84, 0.95, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 3.0
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = SAMPLES
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 4
    scene.render.bake.margin = 6
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    import time
    import numpy as np
    t0 = time.time()
    # 第一遍：天光与窗纸的直接光
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT'}, margin=6, use_clear=True)
    direct = np.array(img.pixels[:], dtype=np.float32)
    # 第二遍：加上太阳（与 Three.js 御案镜头同向），只取间接光——太阳直射在网页里实时算
    sun = bpy.data.objects.new('bake_sun', bpy.data.lights.new('bake_sun', 'SUN'))
    sun.data.energy = 5.5
    sun.data.angle = 0.02
    sun.data.color = (1.0, 0.93, 0.82)
    link(sun)
    e, a = math.radians(38), math.radians(44)
    to_sun = Vector((-math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    sun.rotation_euler = to_sun.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'INDIRECT'}, margin=6, use_clear=True)
    indirect = np.array(img.pixels[:], dtype=np.float32)
    total = direct + indirect
    total[3::4] = 1.0
    img.pixels[:] = total.tolist()
    bpy.data.objects.remove(sun, do_unlink=True)
    print('LIGHTMAP baked in %.0fs' % (time.time() - t0))
    raw = os.path.join(OUT_DIR, 'room-lightmap-raw.hdr')
    img.filepath_raw = raw
    img.file_format = 'HDR'
    img.save()
    # 另起一个 Blender 用合成器的 OIDN 去噪（本场景是 Cycles，合成时会连场景一起渲，所以分开跑）
    import subprocess
    subprocess.run([bpy.app.binary_path, '-b', '--factory-startup', '-P', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'denoise_hdr.py'),
                    '--', raw, os.path.join(OUT_DIR, 'room-lightmap.hdr')], check=True)
    os.remove(raw)
    for nt, n in added:
        nt.nodes.remove(n)
    pb.inputs['Emission Strength'].default_value = 0.0
    me.uv_layers.active_index = 0
    me.uv_layers[base_name].active_render = True
    for o in bake_only:
        bpy.data.objects.remove(o, do_unlink=True)
    scene.world = None


if BAKE:
    bake_lightmap(BAKE)

# ================= 导出 =================
os.makedirs(OUT_DIR, exist_ok=True)
glb = os.path.join(OUT_DIR, 'room.glb')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_yup=True)
print('ROOM exported', glb, os.path.getsize(glb))

if PREVIEW:
    # 预览：白天从南窗打进来的光 + 天光；两台机位（启幕机位、从门口回看宝座）
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.9, 0.85, 0.78, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 4.5
    sun.data.angle = 0.02
    link(sun)
    # 太阳方向与 Three.js 的 sunVector(elev, az) 对应：指向太阳 = (-sin a cos e, cos a cos e, sin e)（Blender 坐标）
    e, a = math.radians(34), math.radians(48)
    to_sun = Vector((-math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    sun.rotation_euler = to_sun.to_track_quat('Z', 'Y').to_euler()
    for nm, x0, x1 in (('glow_c', -1.3, 1.3), ('glow_e', 1.7, 4.3)):
        al = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'AREA'))
        al.data.shape = 'RECTANGLE'
        al.data.size, al.data.size_y = x1 - x0, 2.0
        al.data.energy = 260
        al.location = ((x0 + x1) / 2, SOUTH - 0.2, 2.0)
        al.rotation_euler = (math.radians(-90), 0, 0)
        link(al)
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1600, 900
    scene.view_settings.view_transform = 'AgX'

    def cam_three(name, pos, look, fov):
        """Three.js 机位（毫米、案面 y=0）转 Blender"""
        def cv(p):
            return Vector((p[0] / 1000, -p[2] / 1000, (p[1] + 780) / 1000))
        c = bpy.data.objects.new(name, bpy.data.cameras.new(name))
        c.data.sensor_fit = 'VERTICAL'
        c.data.angle_y = math.radians(fov)
        c.location = cv(pos)
        c.rotation_euler = (cv(look) - cv(pos)).to_track_quat('-Z', 'Y').to_euler()
        return link(c)

    shots = [
        ('title', cam_three('cam_title', [1450, 430, 1500], [-1300, 680, -1800], 40)),
        ('wide', cam_three('cam_wide', [3600, 1500, -1500], [-600, 200, 400], 62)),
        ('throne', cam_three('cam_throne', [300, 900, -1700], [0, 600, 3000], 50)),
    ]
    for tag, c in shots:
        scene.camera = c
        scene.render.filepath = os.path.join(OUT_DIR, f'room-preview-{tag}.png')
        bpy.ops.render.render(write_still=True)
    print('PREVIEW done')
