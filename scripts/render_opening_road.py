"""Render the blend's road and car for material evidence — nothing is saved.

usage: blender -b SILID_Act1_road_work.blend -P scripts/render_opening_road.py

The blend is opened read-only from this script's point of view: it adds a camera
and lights to light the materials for the render and never writes the file. These
renders are material evidence from the source scene, not screenshots of the game
— the game screenshots come from scripts/shoot_road.cjs.
"""
import math
import os
import bpy
from mathutils import Vector

# Blender is handed a relative -P path and runs with an unpredictable cwd, so
# the output directory is derived from where the .blend actually lives:
# <root>/Blender/AssetLibrary/Working/Opening/<file>.blend -> <root>/reports/...
BLEND_DIR = os.path.dirname(os.path.abspath(bpy.data.filepath))
ROOT = os.path.abspath(os.path.join(BLEND_DIR, '..', '..', '..', '..'))
OUT = os.path.join(ROOT, 'reports', 'road', 'blender')
os.makedirs(OUT, exist_ok=True)
print('project root', ROOT, '-> output', OUT)
scene = bpy.context.scene

# --- engine ---------------------------------------------------------------
# EEVEE renders every lit surface black in this headless session on the Intel
# GPU (the background still draws), so the evidence renders default to Cycles on
# the CPU. SILID_ENGINE=EEVEE switches back, SILID_SAMPLES sets the sample count.
ENGINE = os.environ.get('SILID_ENGINE', 'CYCLES').upper()
SAMPLES = int(os.environ.get('SILID_SAMPLES', '24'))
if ENGINE == 'EEVEE':
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.eevee.taa_render_samples = SAMPLES
else:
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
print('engine', scene.render.engine, 'samples', SAMPLES)

ONLY = os.environ.get('SILID_VIEW')
scene.render.resolution_x = int(os.environ.get('SILID_W', '1280'))
scene.render.resolution_y = int(os.environ.get('SILID_H', '720'))
scene.render.film_transparent = False
# Standard, not Filmic: this render exists to show what the surface materials
# are, and a filmic curve would crush the very dark values being inspected.
scene.view_settings.view_transform = 'Standard'

# --- a night world, so the road is lit by a sky and not by studio lights ------
world = bpy.data.worlds.new('TMP_night')
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs[0].default_value = (0.03, 0.035, 0.05, 1.0)
bg.inputs[1].default_value = 0.6
scene.world = world


def add_light(name, kind, loc, energy, color=(1, 1, 1), size=6.0, aim=None):
    data = bpy.data.lights.new(name, type=kind)
    data.energy = energy
    data.color = color
    if kind == 'AREA':
        data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    scene.collection.objects.link(obj)
    if aim is not None:
        d = (Vector(aim) - Vector(loc)).normalized()
        obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return obj


# moon: low, cool, grazing the road
add_light('TMP_moon', 'AREA', (-12, 45, 18), 900, (0.55, 0.62, 0.8), size=30,
          aim=(0, 80, 0))
# the sky's own contribution, so nothing is lit only by a studio lamp
add_light('TMP_fill', 'AREA', (0, 60, 9), 60, (0.6, 0.66, 0.8), size=20, aim=(0, 62, 0))
# headlights of the stopped car, aimed back down the road at the camera
add_light('TMP_beam_l', 'SPOT', (1.7, 76.0, 0.85), 4500, (1.0, 0.86, 0.66), aim=(0.2, 45, 0.0))
add_light('TMP_beam_r', 'SPOT', (0.4, 76.0, 0.85), 4500, (1.0, 0.86, 0.66), aim=(-0.4, 45, 0.0))
for name in ('TMP_beam_l', 'TMP_beam_r'):
    data = bpy.data.objects[name].data
    data.spot_size = math.radians(22)
    data.spot_blend = 0.6
    data.shadow_soft_size = 0.12

cam_data = bpy.data.cameras.new('TMP_cam')
cam_data.lens = 35
cam = bpy.data.objects.new('TMP_cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

VIEWS = [
    # standing on the carriageway looking north up the road into the parked car
    {'name': '01_road_driver_eye', 'loc': (0.0, 52.0, 1.55), 'aim': (1.05, 78.0, 1.2)},
    # looking straight down at the aggregate, the way the player inspects it
    {'name': '02_asphalt_closeup', 'loc': (-0.4, 62.0, 1.35), 'aim': (0.1, 67.0, 0.05)},
    # the edge of the carriageway, where the markings and the break are
    {'name': '03_road_edge', 'loc': (2.4, 56.0, 1.5), 'aim': (2.6, 74.0, 0.1)},
    # the car itself, three-quarter, headlights on
    {'name': '04_car_threequarter', 'loc': (-3.4, 84.0, 1.7), 'aim': (1.05, 78.0, 1.0)},
]

for v in VIEWS:
    if ONLY and ONLY not in v['name']:
        continue
    cam.location = v['loc']
    d = (Vector(v['aim']) - Vector(v['loc'])).normalized()
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(OUT, v['name'] + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', scene.render.filepath)
