import bpy, json
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
with open('reports/world/world_plan.json', 'r', encoding='utf-8') as f:
    p = json.load(f)

def ray(o, d, dist):
    hit, loc, n, i, ob, m = bpy.context.scene.ray_cast(dg, Vector(o), Vector(d), distance=dist)
    return (loc.z, ob.name, (loc.x, loc.y, loc.z)) if hit else (None, None, None)

# B-01 is the basement corridor. Sample a 4x4 grid inside it.
for rid, r in [(r['id'], r) for l in p['levels'] for r in l['rooms'] if r['id'] in ('B-01', 'FF3-02')]:
    lvl = next(l for l in p['levels'] if l['id'] == r['parent_level']) if 'parent_level' in r else next(l for l in p['levels'] if any(rr['id']==r['id'] for rr in l['rooms']))
    print('=== ', rid, lvl['id'], 'x %.1f..%.1f z %.1f..%.1f' % (r['x0'], r['x1'], r['z0'], r['z1']))
    xs = [r['x0'] + 0.6 + (r['x1']-r['x0']-1.2)*i/3 for i in range(4)]
    zs = [r['z0'] + 0.6 + (r['z1']-r['z0']-1.2)*i/3 for i in range(4)]
    for x in xs:
        row = []
        for z in zs:
            hc,hn,hlm = ray((x, z, lvl['y']+1.05), (0,0,1), 4.5)
            row.append('%s=%.1f' % (hn[:6] if hn else 'none', hc-lvl['y'] if hc else -99) if hc is not None else 'NONE')
        print('  x%.1f ' % x, ' '.join('%-11s'%c for c in row))
