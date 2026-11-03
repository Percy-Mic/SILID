"""Render quick road and facade plates from the saved, textured master file."""
import os
import bpy
from mathutils import Vector

WORLD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(WORLD_DIR, 'renders')
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 4
scene.cycles.use_denoising = True
scene.render.resolution_x = 720
scene.render.resolution_y = 405
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.6
os.makedirs(OUT, exist_ok=True)

for camera_name, filename in (
    ('CAM_FrontElevation', 'M3_front_pbr.png'),
    ('CAM_Approach', 'M3_approach_pbr.png'),
):
    cam = bpy.data.objects.get(camera_name)
    if not cam:
        raise RuntimeError('Missing camera: ' + camera_name)
    if camera_name == 'CAM_FrontElevation':
        # The original near-ground orthographic framing hid the roof pavilions
        # behind the azotea parapet. Lift the review camera and turn it slightly
        # so this plate shows the real roof silhouette and facade depth.
        cam.location = (32.0, 66.0, 25.0)
        target = Vector((0.0, 0.0, 8.5))
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(OUT, filename)
    bpy.ops.render.render(write_still=True)
    print('SILID preview saved:', scene.render.filepath, flush=True)
