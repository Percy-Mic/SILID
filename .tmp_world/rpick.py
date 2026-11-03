import os
import sys

import bpy

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
samples = int(args[0]) if args else 12
res = (int(args[1]), int(args[2])) if len(args) > 2 else (900, 506)
names = args[3:]
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = samples
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 4
scene.render.resolution_x, scene.render.resolution_y = res
scene.render.resolution_percentage = 100
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 1.0
out = os.path.join(os.path.dirname(bpy.data.filepath), 'renders')
os.makedirs(out, exist_ok=True)
for name in names:
    ob = bpy.data.objects.get(name)
    if ob is None:
        print('MISSING CAMERA', name)
        continue
    scene.camera = ob
    scene.render.filepath = os.path.join(out, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('WROTE', scene.render.filepath, flush=True)
