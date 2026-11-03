import bpy, json
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
with open('reports/world/world_plan.json', 'r', encoding='utf-8') as f:
    p = json.load(f)

def ray(o, d, dist):
    hit, loc, n, i, ob, m = bpy.context.scene.ray_cast(dg, Vector(o), Vector(d), distance=dist)
    return (loc.z, ob.name) if hit else (None, None)

for i, level in enumerate(p['levels']):
    above = p['levels'][i + 1] if i + 1 < len(p['levels']) else None
    ceiling_y = (above['y'] + above['h'] + 0.22) if above else None
    for r in level['rooms']:
        if r['kind'] == 'courtyard':
            continue
        cx, cz = (r['x0'] + r['x1']) / 2, (r['z0'] + r['z1']) / 2
        hc, hob = ray((cx, cz, level['y'] + 1.05), (0, 0, 1), 3.2)
        if hc is None:
            print('NO-CEL', level['id'], r['id'], 'cx=%.1f cz=%.1f cell-above=%s' % (cx, cz, above['id'] if above else None))
        elif hc - level['y'] < 2.15:
            print('LOW', level['id'], r['id'], '%.2f' % (hc - level['y']), 'above=%s' % (above['id'] if above else None), 'cell-y=%.2f' % ceiling_y, hob)
