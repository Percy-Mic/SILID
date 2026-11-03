import bpy, json
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
with open('reports/world/world_plan.json', 'r', encoding='utf-8') as f:
    p = json.load(f)

def ray(o, d, dist):
    hit, loc, n, i, ob, m = bpy.context.scene.ray_cast(dg, Vector(o), Vector(d), distance=dist)
    return (loc.z, ob.name) if hit else (None, None)

# F4 footroom is where the F4 floor slab sits -0.3 to 0, but F4's own internal
# volumes (rooms) also span x-22..20. Confirm room identity by name.
F4 = next(l for l in p['levels'] if l['id'] == 'F4')
FF3_02 = next(r for l in p['levels'] for r in l['rooms'] if r['id'] == 'FF3-02')
print('FF3-02:', FF3_02)
print('F4-y=%.1f h=%.1f' % (F4['y'], F4['h']))
print('cell grid over FF3-02 (x -22..20, z 2..4):')
xs = [FF3_02['x0']+0.8 + (FF3_02['x1']-FF3_02['x0']-1.6)*i/4 for i in range(5)]
zs = [FF3_02['z0']+0.8 + (FF3_02['z1']-FF3_02['z0']-1.6)*i/4 for i in range(5)]
for z in zs:
    print('  z%.1f:' % z, ' '.join('x%-11s'%('%+.1f'%ray((x,z,F4['y']+1.05),(0,0,1),3.0)[1]) if ray((x,z,F4['y']+1.05),(0,0,1),3.0)[0] else 'NONE' for x in xs))
