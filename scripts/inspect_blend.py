"""Inspect a .blend without opening the GUI.

usage: blender -b file.blend -P scripts/inspect_blend.py -- [namefilter]

Reports collections, object types/bounds/poly counts, material node trees and
image datablocks with their real pixel sizes, so a decision about what to edit
is based on the file's actual contents rather than on its name.
"""
import sys
import bpy

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
name_filter = args[0].lower() if args else None

print('=== FILE ===')
print(bpy.data.filepath)

print('\n=== COLLECTIONS ===')
for c in bpy.data.collections:
    print('%-40s objects=%d children=%s' % (
        c.name, len(c.objects), [x.name for x in c.children]))

print('\n=== SCENE COLLECTIONS ===')
for c in bpy.context.scene.collection.children_recursive:
    print(' ', c.name)

print('\n=== OBJECTS (%d) ===' % len(bpy.data.objects))
by_type = {}
for o in bpy.data.objects:
    by_type.setdefault(o.type, []).append(o)
for t, lst in sorted(by_type.items()):
    print('-- %s (%d)' % (t, len(lst)))
    for o in lst:
        if name_filter and name_filter not in o.name.lower():
            continue
        dims = tuple(round(v, 3) for v in o.dimensions)
        loc = tuple(round(v, 2) for v in o.location)
        npoly = ''
        nvert = ''
        if o.type == 'MESH':
            npoly = len(o.data.polygons)
            nvert = len(o.data.vertices)
            mats = [m.name if m else 'None' for m in o.data.materials]
        else:
            mats = []
        users = [c.name for c in o.users_collection]
        print('   %-38s dims=%s loc=%s verts=%s faces=%s hides=%s coll=%s mats=%s' % (
            o.name, dims, loc, nvert, npoly, o.hide_viewport, users, mats))

print('\n=== MATERIALS (%d) ===' % len(bpy.data.materials))
for m in bpy.data.materials:
    if name_filter and name_filter not in m.name.lower():
        continue
    nodes = []
    if m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE':
                img = n.image.name if n.image else 'None'
                nodes.append('IMG:%s(%s)' % (img, n.image.size[:] if n.image else ''))
            elif n.type in ('BSDF_PRINCIPLED',):
                bc = n.inputs['Base Color']
                rgh = n.inputs['Roughness'].default_value if not n.inputs['Roughness'].is_linked else 'tex'
                nodes.append('PBR base=%s rough=%s metal=%.2f' % (
                    tuple(round(v, 3) for v in bc.default_value), rgh,
                    n.inputs['Metallic'].default_value))
            elif n.type == 'NORMAL_MAP':
                nodes.append('NORMALMAP')
            elif n.type == 'BUMP':
                nodes.append('BUMP')
    print('   %-34s blend=%s nodes=%s' % (m.name, getattr(m, 'blend_method', '?'), nodes))

print('\n=== IMAGES (%d) ===' % len(bpy.data.images))
for i in bpy.data.images:
    if name_filter and name_filter not in i.name.lower():
        continue
    print('   %-44s size=%s px=%s packed=%s src=%s' % (
        i.name, i.size[:], i.pixels[:2] and 'yes', bool(i.packed_file), i.source))

print('\n=== WORLD ===')
w = bpy.context.scene.world
if w and w.use_nodes:
    for n in w.node_tree.nodes:
        if n.type == 'BACKGROUND':
            print('  background', n.inputs[0].default_value[:], n.inputs[1].default_value)

print('\n=== SCENE UNITS ===')
print(' unit_scale', bpy.context.scene.unit_settings.scale_length,
      'frame', bpy.context.scene.frame_start, bpy.context.scene.frame_end)
