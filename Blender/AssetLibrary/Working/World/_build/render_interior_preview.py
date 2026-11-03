"""Render a readable furnished foyer view from the saved master scene."""
import os
import bpy

WORLD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(WORLD_DIR, 'renders', 'M6_foyer_lit.png')
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.cycles.use_denoising = True
scene.render.use_compositing = False
scene.render.resolution_x = 800
scene.render.resolution_y = 450
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 1.0
cam = bpy.data.objects.get('CAM_Foyer')
if cam is None:
    raise RuntimeError('CAM_Foyer is missing from the master scene')
scene.camera = cam
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('SILID preview saved:', OUT, flush=True)
