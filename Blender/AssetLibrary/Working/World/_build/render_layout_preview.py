"""Render a readable ground-floor progress plate from the saved master scene.

Usage:
  blender -b SILID_COMPLETE_WORLD.blend --python render_layout_preview.py

This changes visibility and camera state in memory only. The master .blend is
not resaved; the output is a still for inspecting the furnished room layout.
"""
import os
import bpy
from mathutils import Vector

WORLD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(WORLD_DIR, 'renders', 'M4_ground_floor_layout.png')

HIDE_COLLECTIONS = {
    'ROAD_ENVIRONMENT', 'VEHICLE_BREAKDOWN', 'FOREST_ENVIRONMENT',
    'FOREST_VEGETATION', 'MANSION_EXTERIOR', 'MANSION_SECOND_FLOOR',
    'MANSION_THIRD_FLOOR', 'MANSION_FOURTH_FLOOR', 'MANSION_ROOF',
    'MANSION_STAIRS', 'COLLISION', 'CAMERAS', 'ANIMATIONS',
}
for name in HIDE_COLLECTIONS:
    collection = bpy.data.collections.get(name)
    if collection:
        collection.hide_render = True

data = bpy.data.cameras.new('CAM_M4_GroundFloorLayout')
data.type = 'ORTHO'
data.ortho_scale = 58
data.clip_start = 0.1
data.clip_end = 200
camera = bpy.data.objects.new('CAM_M4_GroundFloorLayout', data)
bpy.context.scene.collection.objects.link(camera)
camera.location = (0, 0, 65)
camera.rotation_euler = (0, 0, 0)
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.use_compositing = False
scene.render.resolution_x = 1160
scene.render.resolution_y = 790
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUT
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 1.3
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.render.render(write_still=True)
print('SILID preview saved:', OUT, flush=True)
