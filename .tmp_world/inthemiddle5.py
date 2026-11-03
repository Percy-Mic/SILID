import bpy, json
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
with open('reports/world/world_plan.json', 'r', encoding='utf-8') as f:
    p = json.load(f)

def ray(o, d, dist):
    hit, loc, n, i, ob, m = bpy.context.scene.ray_cast(dg, Vector(o), Vector(d), distance=dist)
    return (loc.z, ob.name) if hit else (None, None)

F3 = next(l for l in p['levels'] if l['id'] == 'F3')
F4 = next(l for l in p['levels'] if l['id'] == 'F4')
print('=== F3 room layout (with F4 footprint overlay) ===')
for r in F3['rooms']:
    print('  F3 %s %s x%.1f..%.1f z%.1f..%.1f kind=%s' % (r['id'], r['name'], r['x0'], r['x1'], r['z0'], r['z1'], r['kind']))
print('F4-y=%.1f h=%.1f' % (F4['y'], F4['h']))
print('=== is FF3-02 inside any F4 room? ===')
ff302 = next(r for l in p['levels'] for r in l['rooms'] if r['id']=='FF3-02')
for fr in F4['rooms']:
    if fr['x0'] <= ff302['x0'] and ff302['x1'] <= fr['x1'] and fr['z0'] <= ff302['z0'] and ff302['z1'] <= fr['z1']:
        print('  YES: inside F4 %s %s' % (fr['id'], fr['name']))
print('=== F4 room footprint (union) ===')
xu, zu = set(), set()
for fr in F4['rooms']:
    xu.add((fr['x0'], fr['x1']))
    zu.add((fr['z0'], fr['z1']))
xs = sorted(set([v for pr in xu for v in pr]))
zs = sorted(set([v for pr in zu for v in pr]))
print('  xs:', [round(x,1) for x in xs])
print('  zs:', [round(z,1) for z in zs])
# is the point (-10, 3) inside any F4 room cell?
for fr in F4['rooms']:
    if fr['x0'] <= -10 <= fr['x1'] and fr['z0'] <= 3 <= fr['z1']:
        print('  (-10,3) in F4 %s %s: YES' % (fr['id'], fr['name']))
# F3 corridor FF3-02 is x-22..20 z2..4. Is z=2..4 inside any F4 room's z-range?
print('  F4 rooms with z-range overlapping [2,4]:')
for fr in F4['rooms']:
    if fr['z0'] <= 4 and fr['z1'] >= 2:
        print('    F4 %s z%.1f..%.1f (overlap with FF3-02 z2..4: %s)' % (fr['id'], fr['z0'], fr['z1'], 'YES' if fr['z0']<=2 and fr['z1']>=4 else 'partial'))
