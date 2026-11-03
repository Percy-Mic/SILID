import bpy, json
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
with open('reports/world/world_plan.json', 'r', encoding='utf-8') as f:
    p = json.load(f)

def ray(o, d, dist):
    hit, loc, n, i, ob, m = bpy.context.scene.ray_cast(dg, Vector(o), Vector(d), distance=dist)
    return (loc.z, ob.name) if hit else (None, None)

F3 = next(l for l in p['levels'] if l['id'] == 'F3')
F2 = next(l for l in p['levels'] if l['id'] == 'F2')
print('F2-y=%.1f h=%.1f -> F2 ceiling band y [%.2f..%.2f]' % (F2['y'], F2['h'], F2['y']+F2['h'], F2['y']+F2['h']+0.22))

# What objects occupy y=8.0..8.22 over FF3-02 (x=-10,z=3)?
for y in [7.8, 8.0, 8.1, 8.2, 8.3]:
    hc, hn = ray((-10, 3, y), (0,0,1), 1.5)
    print('  from y=%.1f: hit %.2f %s' % (y, hc-y if hc else -99, hn[:12] if hn else 'none'))
