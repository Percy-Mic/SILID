"""Report the road slab's UV layout and its material wiring in the blend.

usage: blender -b file.blend -P scripts/probe_road_uv.py
The road used to be textured as a 3 m Poly Haven tile; whether that is true in
the file depends on the UVs actually stored on the slab, so this prints them
instead of assuming.
"""
import bpy

def uv_bounds(obj):
    me = obj.data
    if not me.uv_layers:
        return None
    uv = me.uv_layers.active.data
    us = [d.uv[0] for d in uv]
    vs = [d.uv[1] for d in uv]
    return (round(min(us), 4), round(max(us), 4), round(min(vs), 4), round(max(vs), 4))

names = ['SM_Road_Act1', 'SM_Drive_Act1', 'CAR_Body', 'Car.015', 'CAR_Hood']
print('=== ROAD / CAR OBJECTS ===')
for n in names:
    o = bpy.data.objects.get(n)
    if not o:
        print('missing', n)
        continue
    print('%-16s dims=%s uv=%s mats=%s modifiers=%s' % (
        n, tuple(round(v, 3) for v in o.dimensions), uv_bounds(o),
        [m.name for m in o.data.materials], [m.type for m in o.modifiers]))
    print('                loc=%s scale=%s rot=%s' % (
        tuple(round(v, 3) for v in o.location),
        tuple(round(v, 3) for v in o.scale),
        tuple(round(v, 3) for v in o.rotation_euler)))

print('\n=== MATERIAL NODES (road + car) ===')
for key in ['PBR_asphalt_02', 'CAR_Paint', 'Glass', 'Texture', 'ACT1_line', 'ACT1_gravel', 'ACT1_soil']:
    m = bpy.data.materials.get(key)
    if not m:
        print('missing material', key)
        continue
    print('--', key)
    for n in m.node_tree.nodes:
        ins = {}
        for i in n.inputs:
            if not i.is_linked and hasattr(i, 'default_value'):
                try:
                    v = tuple(round(x, 3) for x in i.default_value)
                except TypeError:
                    v = round(i.default_value, 3) if isinstance(i.default_value, float) else i.default_value
                ins[i.name] = v
        links = ['%s<-%s.%s' % (i.name, i.links[0].from_node.name, i.links[0].from_socket.name)
                 for i in n.inputs if i.is_linked]
        print('   %-22s %-16s links=%s' % (n.name, n.type, links))
        print('        unlinked=%s' % {k: v for k, v in ins.items() if k in (
            'Scale', 'Base Color', 'Roughness', 'Metallic', 'Strength', 'Vector', 'IOR', 'Alpha')})

print('\n=== ROAD MARKING OBJECTS ===')
dashes = sorted([o.name for o in bpy.data.objects if o.name.startswith('SM_RoadDash')])
print('dashes=%d first=%s last=%s' % (len(dashes), dashes[:2], dashes[-2:]))
print('edges=', [o.name for o in bpy.data.objects if o.name.startswith('SM_RoadEdge')])
print('cracks=%d patches=%d' % (
    len([o for o in bpy.data.objects if o.name.startswith('SM_RoadCrack')]),
    len([o for o in bpy.data.objects if o.name.startswith('SM_RoadPatch')])))
