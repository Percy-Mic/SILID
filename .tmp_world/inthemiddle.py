import bpy, json
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
with open('reports/world/world_plan.json', 'r', encoding='utf-8') as f:
    p = json.load(f)

def ray(o, d, dist):
    hit, loc, n, i, ob, m = bpy.context.scene.ray_cast(dg, Vector(o), Vector(d), distance=dist)
    return (loc.z, ob.name, (loc.x, loc.y, loc.z)) if hit else (None, None, None)

# What object sits between the F3 corridor cell and the F4 slab?
# Sample a tight grid over the F3 corridor's entire footprint, going up to F4.
F3 = next(l for l in p['levels'] if l['id'] == 'F3')
FF3_02 = next(r for l in p['levels'] for r in l['rooms'] if r['id'] == 'FF3-02')
print('FF3-02:', FF3_02, 'F3-y=%.1f' % F3['y'])
xs = [FF3_02['x0']+1.0 + (FF3_02['x1']-FF3_02['x0']-2.0)*i/4 for i in range(5)]
zs = [FF3_02['z0']+0.6 + (FF3_02['z1']-FF3_02['z0']-1.2)*i/4 for i in range(5)]
print('grid over corridor, ray up at y=%.1f+0.2: ' % F3['y'], 'cell-y=%.1f' % (F3['y']+F3['h']))
for z in zs:
    row = []
    for x in xs:
        hc, hn, pos = ray((x, z, F3['y']+0.2), (0,0,1), 4.5)
        row.append('%s=%.1f' % (hn[:7] if hn else 'none', hc-F3['y'] if hc else -99))
    print('  z%.1f ' % z, ' '.join('%-13s'%c for c in row))
