import bpy, json
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
with open('reports/world/world_plan.json', 'r', encoding='utf-8') as f:
    p = json.load(f)

def ray(o, d, dist):
    hit, loc, n, i, ob, m = bpy.context.scene.ray_cast(dg, Vector(o), Vector(d), distance=dist)
    return (loc.z, ob.name) if hit else (None, None)

F3 = next(l for l in p['levels'] if l['id'] == 'F3')
print('F3 rooms (corridors):')
for r in F3['rooms']:
    if r['kind'] == 'corridor':
        print(' ', r['id'], r['name'], 'x%.1f..%.1f z%.1f..%.1f' % (r['x0'], r['x1'], r['z0'], r['z1']))

print('\nWhere is the F2_Ceiling object over FF3-02? Bounding box:')
for ob in bpy.data.objects:
    if ob.name == 'F2_Ceiling':
        print('  F2_Ceiling world bbox:', [round(v,2) for v in ob.matrix_world @ Vector(b) for b in ob.bound_box] if False else 'n/a')
# Just sample one point inside FF3-02 going UP from y=7.95 (just below F3 floor top)
# to see what immediately above the F3 floor is.
print('\nRay up from y=7.95 (F3 floor top minus 0.05) over FF3-02 core:')
for x in [-10, -5, 0, 5, 10]:
    for z in [3]:
        hc, hn = ray((x, z, 7.95), (0,0,1), 5.0)
        print('  x=%.1f z=%.1f -> %.2f %s' % (x, z, hc-F3['y'] if hc else -99, hn[:12] if hn else 'none'))
