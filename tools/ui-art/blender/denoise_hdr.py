"""用 Blender 合成器的 OIDN 去掉光照贴图的噪点。用法：blender -b --factory-startup -P denoise_hdr.py -- <入.hdr> <出.hdr>"""
import sys

import bpy

src, dst = sys.argv[sys.argv.index('--') + 1:][:2]
scene = bpy.context.scene
img = bpy.data.images.load(src)
w, h = img.size
tree = bpy.data.node_groups.new('denoise', 'CompositorNodeTree')
scene.compositing_node_group = tree
tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
n_img = tree.nodes.new('CompositorNodeImage')
n_img.image = img
n_den = tree.nodes.new('CompositorNodeDenoise')
out = tree.nodes.new('NodeGroupOutput')
print('DENOISE inputs', [(s.name, getattr(s, 'default_value', None)) for s in n_den.inputs])
for s in n_den.inputs:
    if s.name.lower() in ('hdr',):
        s.default_value = True
tree.links.new(n_img.outputs['Image'], n_den.inputs['Image'])
tree.links.new(n_den.outputs['Image'], out.inputs[0])
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x, scene.render.resolution_y = w, h
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'HDR'
scene.view_settings.view_transform = 'Standard'
scene.render.filepath = dst
bpy.ops.render.render(write_still=True)
print('DENOISE done', dst)
