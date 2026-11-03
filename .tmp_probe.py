import bpy, bmesh, inspect
print("BL", bpy.app.version_string)
bm = bmesh.new()
for fn in ("create_cone","create_icosphere","create_cube","bevel","spin"):
    op = getattr(bmesh.ops, fn)
    print(fn, "::", op.__doc__.strip().splitlines()[0])
print(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
