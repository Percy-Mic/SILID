"""Which surface does a camera standing on the road actually see?

usage: blender -b file.blend -P scripts/probe_scene_surfaces.py
Lists the objects with the largest ground-plane footprint, with their world
Z ranges and materials, plus every object whose name suggests ground or road.
"""
import bpy

rows = []
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.data.vertices:
        continue
    co = [o.matrix_world @ v.co for v in o.data.vertices]
    zs = [p.z for p in co]
    xs = [p.x for p in co]
    ys = [p.y for p in co]
    foot = (max(xs) - min(xs)) * (max(ys) - min(ys))
    rows.append((foot, o.name, (min(xs), max(xs)), (min(ys), max(ys)),
                 (round(min(zs), 3), round(max(zs), 3)),
                 [m.name for m in o.data.materials]))

rows.sort(reverse=True)
print('=== LARGEST FOOTPRINTS ===')
for foot, name, xr, yr, zr, mats in rows[:14]:
    print('%-24s foot=%9.1f x=%s y=%s z=%s mats=%s' % (
        name, foot, tuple(round(v, 1) for v in xr), tuple(round(v, 1) for v in yr), zr, mats))

print('\n=== GROUND / ROAD / TERRAIN NAMED ===')
for foot, name, xr, yr, zr, mats in rows:
    if any(k in name.lower() for k in ('ground', 'terrain', 'road', 'land', 'floor', 'yard')):
        print('%-24s foot=%9.1f x=%s y=%s z=%s mats=%s' % (
            name, foot, tuple(round(v, 1) for v in xr), tuple(round(v, 1) for v in yr), zr, mats))

print('\n=== Z HEIGHTS NEAR THE ROAD CAMERA (x 0, y 55..90) ===')
for foot, name, xr, yr, zr, mats in rows:
    if xr[0] <= 0.5 <= xr[1] and yr[0] <= 70 <= yr[1]:
        print('%-24s z=%s foot=%.1f mats=%s' % (name, zr, foot, mats))
