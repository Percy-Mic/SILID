"""Render one imported rain tree close up for foliage and bark review."""
import math
import os
import bpy
from mathutils import Vector

WORLD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scene = bpy.context.scene
trees = [o for o in bpy.data.objects if o.type == 'MESH'
         and o.name.startswith('TREE_rain_') and o.name.endswith('_foliage')
         and '_distant_' not in o.name
         and any(m and 'island_tree_01_leaves' in m.name for m in o.data.materials)]
if not trees:
    raise RuntimeError('No imported rain tree instances found')
tree = min(trees, key=lambda o: math.hypot(o.location.x, o.location.y))
target = Vector(tree.location) + Vector((0.0, 0.0, 3.8))
offset = Vector((12.0, -16.0, 3.1))
# Isolate the tree so mansion geometry cannot occlude the foliage diagnosis.
for obj in bpy.data.objects:
    keep_ground = obj.type == 'MESH' and ('TERRAIN' in obj.name.upper() or 'GROUND' in obj.name.upper())
    if obj != tree and obj.type not in ('LIGHT', 'CAMERA') and not keep_ground:
        obj.hide_render = True
scene.render.use_compositing = False
fill_data = bpy.data.lights.new('TREE_DETAIL_MoonFill', 'AREA')
fill_data.energy = 900
fill_data.shape = 'DISK'
fill_data.size = 9
fill_data.color = (0.56, 0.68, 0.92)
fill = bpy.data.objects.new('TREE_DETAIL_MoonFill', fill_data)
fill.location = Vector(tree.location) + Vector((3.0, -5.0, 8.0))
fill.rotation_euler = (target - fill.location).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(fill)
data = bpy.data.cameras.new('CAM_TreeDetail')
data.lens = 50
cam = bpy.data.objects.new('CAM_TreeDetail', data)
cam.location = Vector(tree.location) + offset
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.cycles.use_denoising = True
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.6
scene.render.filepath = os.path.join(WORLD_DIR, 'renders', 'M3_tree_detail.png')
bpy.ops.render.render(write_still=True)
print('SILID tree detail saved:', scene.render.filepath, 'tree:', tree.name, flush=True)
