"""Render the furnished third-floor master suite from the saved world."""
import os
import bpy
from mathutils import Vector

WORLD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scene = bpy.context.scene
camera_data = bpy.data.cameras.new('CAM_MasterSuiteReview')
camera_data.lens = 25
camera = bpy.data.objects.new('CAM_MasterSuiteReview', camera_data)
camera.location = (-13.1, 6.0, 9.55)
target = Vector((-18.0, 7.2, 8.85))
camera.rotation_euler = (target - Vector(camera.location)).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(camera)
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.cycles.use_denoising = True
scene.render.resolution_x = 800
scene.render.resolution_y = 450
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 1.0
scene.render.filepath = os.path.join(WORLD_DIR, 'renders', 'M7_master_suite.png')
bpy.ops.render.render(write_still=True)
print('SILID master suite preview saved:', scene.render.filepath, flush=True)
