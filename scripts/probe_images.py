"""Are the blend's textures actually reachable from this machine?"""
import os
import bpy
print('=== IMAGES ===')
missing = 0
for i in bpy.data.images:
    if i.source != 'FILE':
        continue
    p = bpy.path.abspath(i.filepath)
    ok = os.path.exists(p)
    if not ok:
        missing += 1
    print('%-40s exists=%-5s packed=%-5s size=%s path=%s' % (
        i.name, ok, bool(i.packed_file), i.size[:], p))
print('missing on disk:', missing, 'of', len([x for x in bpy.data.images if x.source == 'FILE']))
