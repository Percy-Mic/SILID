"""Render the mansion from the playable approach through the textured forest."""
import os
import bpy

WORLD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.cycles.use_denoising = True
scene.render.resolution_x = 880
scene.render.resolution_y = 495
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.6
cam = bpy.data.objects.get('CAM_Approach')
if cam is None:
    raise RuntimeError('CAM_Approach is missing from the master scene')
scene.camera = cam
scene.render.filepath = os.path.join(WORLD_DIR, 'renders', 'M3_approach_pbr.png')
bpy.ops.render.render(write_still=True)
print('SILID approach preview saved:', scene.render.filepath, flush=True)
