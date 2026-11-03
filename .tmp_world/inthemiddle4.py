import bpy, json
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
with open('reports/world/world_plan.json', 'r', encoding='utf-8') as f:
    p = json.load(f)

def ray(o, d, dist):
    hit, loc, n, i, ob, m = bpy.context.scene.ray_cast(dg, Vector(o), Vector(d), distance=dist)
    return (loc.z, ob.name) if hit else (None, None)

# Sample X along FF3-02 from -22 to 20 at z=3, starting y=8.3 (just above the
# F2 ceiling plate) going up to find what's above. If nothing until y=11.8,
# then the corridor IS open to the roof through the F2 ceiling slab.
print('UL from y=8.3 over FF3-02 (should be open to roof, hit F4 slab at 11.6ish):')
for x in [-21, -10, -5, 0, 5, 10, 19]:
    hc, hn = ray((x, 3, 8.3), (0,0,1), 5.0)
    cls = 'OPEN' if hc is None else 'HIT %.2f %s' % (hc-8.3, hn[:12])
    print('  x=%-4.1f: %s' % (x, cls))
