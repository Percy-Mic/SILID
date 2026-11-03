"""Render the preserved basement-to-cistern route from the master blend."""
import os
from mathutils import Vector
import bpy

WORLD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(WORLD_DIR, 'renders')
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
scene.view_settings.exposure = 1.7
os.makedirs(OUT, exist_ok=True)

# The terrain is above the service route. Hide it only for these interior
# inspection stills; the saved world keeps the terrain and its cistern cut.
terrain = bpy.data.objects.get('TERRAIN_Field')
if terrain:
    terrain.hide_render = True

for name, filename in (
    ('CAM_Underground_Cave', 'M8_cave_connector.png'),
    ('CAM_CisternCourt', 'M8_cistern_court.png'),
):
    if name == 'CAM_CisternCourt':
        camera_data = bpy.data.cameras.new('CAM_CisternCourt_Preview')
        camera_data.type = 'ORTHO'
        camera_data.ortho_scale = 15.0
        camera = bpy.data.objects.new('CAM_CisternCourt_Preview', camera_data)
        scene.collection.objects.link(camera)
        camera.location = (60.8, 6.0, 10.0)
        camera.rotation_euler = (Vector((60.8, 6.0, -1.0)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    else:
        camera = bpy.data.objects.get(name)
        if camera is None:
            raise RuntimeError('Missing underground preview camera: ' + name)
    scene.camera = camera
    scene.render.filepath = os.path.join(OUT, filename)
    bpy.ops.render.render(write_still=True)
    print('SILID preview saved:', scene.render.filepath, flush=True)
